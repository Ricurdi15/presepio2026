import Phaser from 'phaser';
import { CONFIG } from '../config';
import type { GameReport } from '../api';
import { leaderboard } from '../leaderboard';
import { makeButton, textStyle } from '../ui';

interface GameOverData {
  name: string;
  score: number;
  win: boolean;
  report: GameReport | null;
}

export class GameOverScene extends Phaser.Scene {
  private res: GameOverData = { name: 'Player', score: 0, win: false, report: null };

  constructor() {
    super('GameOver');
  }

  init(data: GameOverData): void {
    this.res = data;
  }

  create(): void {
    const { name, score, win, report } = this.res;
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

    // esito del salvataggio
    let note = '';
    let noteColor = '#8a97b8';
    if (!report) {
      note = 'Server non raggiungibile: punteggio non salvato.';
      noteColor = '#ff8a8a';
    } else if (report.expired) {
      note = 'Sessione scaduta: torna alla schermata iniziale e accedi di nuovo.';
      noteColor = '#ff8a8a';
    } else if (report.guest) {
      note = 'Sei ospite: accedi per entrare in classifica.';
    } else if (report.isRecord) {
      note = 'Nuovo record personale!';
      noteColor = '#ffd54a';
    } else {
      note = `Record personale: ${report.best}`;
    }
    this.add.text(320, 590, note, textStyle(24, noteColor, { wordWrap: { width: 540 } })).setOrigin(0.5);

    // ----- destra: classifica -----
    this.add.text(900, 60, 'CLASSIFICA', textStyle(44, '#ffffff', { fontStyle: 'bold' })).setOrigin(0.5);
    const loading = this.add.text(900, 300, 'Caricamento...', textStyle(26, '#8a97b8')).setOrigin(0.5);

    const isGuest = !report || report.guest;
    leaderboard
      .getTop(10)
      .then((rows) => {
        if (!this.sys.isActive()) return;
        loading.destroy();
        if (rows.length === 0) {
          this.add.text(900, 300, 'Ancora nessun punteggio', textStyle(26, '#8a97b8')).setOrigin(0.5);
        }
        rows.forEach((r, i) => {
          const mine = !isGuest && r.name.toLowerCase() === name.toLowerCase();   // evidenzia la tua riga
          const color = mine ? '#ffd54a' : '#ffffff';
          const y = 125 + i * 40;
          this.add.text(680, y, `${i + 1}.  ${r.name}`, textStyle(28, color, { align: 'left' }));
          this.add.text(1120, y, String(r.score), textStyle(28, color)).setOrigin(1, 0);
        });
      })
      .catch(() => {
        if (this.sys.isActive()) loading.setText('Classifica non disponibile');
      });

    // ----- riprova / menu -----
    const retry = (): void => {
      this.scene.start('Game', { name });
    };
    makeButton(this, 900, 600, 300, 70, 'RIPROVA', retry);
    const menu = this.add
      .text(900, 670, 'Menu (accedi / cambia utente)', textStyle(22, '#8a97b8'))
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    menu.on('pointerdown', () => this.scene.start('Name'));
    this.input.keyboard?.once('keydown-ENTER', retry);
  }
}
