import Phaser from 'phaser';
import { CONFIG } from '../config';
import { leaderboard } from '../leaderboard';
import { makeButton, textStyle } from '../ui';

interface GameOverData {
  name: string;
  score: number;
  win: boolean;
}

export class GameOverScene extends Phaser.Scene {
  private res: GameOverData = { name: 'Player', score: 0, win: false };

  constructor() {
    super('GameOver');
  }

  init(data: GameOverData): void {
    this.res = data;
  }

  create(): void {
    const { name, score, win } = this.res;
    this.cameras.main.setBackgroundColor('#0b1020');

    // ----- sinistra: esito -----
    if (win) {
      this.add
        .text(320, 100, 'COMPLIMENTI!\nHai raggiunto il punteggio target!',
          textStyle(40, '#ffd54a', { wordWrap: { width: 540 } }))
        .setOrigin(0.5);
      const img = this.add.image(320, 330, 'win');
      img.setScale(Math.min(260 / img.width, 260 / img.height)); // mantiene le proporzioni
    } else {
      this.add.text(320, 280, 'HAI PERSO', textStyle(72, '#ff6b6b', { fontStyle: 'bold' })).setOrigin(0.5);
    }
    this.add
      .text(320, 540, `Punteggio: ${score}  (target: ${CONFIG.targetScore})`, textStyle(30))
      .setOrigin(0.5);

    // ----- destra: classifica -----
    this.add.text(900, 60, 'CLASSIFICA', textStyle(44, '#ffffff', { fontStyle: 'bold' })).setOrigin(0.5);
    const loading = this.add.text(900, 300, 'Caricamento...', textStyle(26, '#8a97b8')).setOrigin(0.5);

    leaderboard
      .getTop(10)
      .then((rows) => {
        if (!this.sys.isActive()) return;
        loading.destroy();
        let marked = false;
        rows.forEach((r, i) => {
          const mine = !marked && r.name === name && r.score === score;
          if (mine) marked = true; // evidenzia la tua partita
          const color = mine ? '#ffd54a' : '#ffffff';
          const y = 125 + i * 40;
          this.add.text(680, y, `${i + 1}.  ${r.name}`, textStyle(28, color, { align: 'left' }));
          this.add.text(1120, y, String(r.score), textStyle(28, color)).setOrigin(1, 0);
        });
      })
      .catch(() => {
        if (this.sys.isActive()) loading.setText('Classifica non disponibile');
      });

    // ----- riprova -----
    const retry = (): void => {
      this.scene.start('Game', { name });
    };
    makeButton(this, 900, 620, 300, 80, 'RIPROVA', retry);
    this.input.keyboard?.once('keydown-ENTER', retry);
  }
}
