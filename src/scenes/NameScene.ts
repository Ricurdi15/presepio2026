import Phaser from 'phaser';
import { CONFIG } from '../config';
import { makeButton, textStyle } from '../ui';

export class NameScene extends Phaser.Scene {
  constructor() {
    super('Name');
  }

  create(): void {
    const W = CONFIG.width;
    this.cameras.main.setBackgroundColor('#0d1426');

    this.add.text(W / 2, 140, 'ENDLESS RUNNER', textStyle(72, '#ffffff', { fontStyle: 'bold' })).setOrigin(0.5);
    this.add.text(W / 2, 250, 'Inserisci il tuo nome', textStyle(32, '#b8c4e0')).setOrigin(0.5);

    // input HTML vero: sul telefono si apre la tastiera nativa
    const dom = this.add.dom(W / 2, 330).createFromHTML(
      '<input type="text" name="nameInput" maxlength="12" placeholder="Nome..." autocomplete="off" ' +
        'style="width:360px;font:32px Arial,sans-serif;padding:10px 14px;text-align:center;' +
        'border:none;border-radius:6px;outline:none;">',
    );
    const input = dom.getChildByName('nameInput') as HTMLInputElement;
    try {
      input.value = localStorage.getItem('runner_last_name') ?? '';
    } catch {
      /* ignora */
    }

    const start = (): void => {
      const name = input.value.trim().slice(0, 12) || 'Player';
      try {
        localStorage.setItem('runner_last_name', name);
      } catch {
        /* ignora */
      }
      this.scene.start('Game', { name });
    };
    input.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') start();
    });
    makeButton(this, W / 2, 470, 280, 80, 'GIOCA', start);

    this.add
      .text(
        W / 2,
        620,
        'PC: SPAZIO = salto (tieni premuto per saltare piu in alto)\n' +
          'Telefono: tocca lo schermo = salto (tieni premuto per saltare piu in alto)',
        textStyle(22, '#8a97b8'),
      )
      .setOrigin(0.5);
  }
}
