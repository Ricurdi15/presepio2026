import Phaser from 'phaser';
import { CONFIG } from '../config';
import { ApiError, login, register } from '../api';
import { clearSession, getSession } from '../session';
import { makeButton, textStyle } from '../ui';

const FIELD =
  'width:100%;box-sizing:border-box;font:28px Arial,sans-serif;padding:10px 14px;border:none;border-radius:6px;outline:none;text-align:center;';
const BTN =
  'flex:1;font:bold 26px Arial,sans-serif;padding:12px;border:none;border-radius:6px;background:#3399e6;color:#fff;cursor:pointer;';

// Schermata iniziale: accesso / registrazione / ospite (o "Ciao, nome" se sei gia' dentro).
export class NameScene extends Phaser.Scene {
  constructor() {
    super('Name');
  }

  create(): void {
    const W = CONFIG.width;
    this.cameras.main.setBackgroundColor('#0d1426');
    this.add.text(W / 2, 90, 'ENDLESS RUNNER', textStyle(72, '#ffffff', { fontStyle: 'bold' })).setOrigin(0.5);

    const session = getSession();
    if (session) this.showLoggedIn(session.username, session.best);
    else this.showForm();

    this.add
      .text(
        W / 2,
        665,
        'PC: SPAZIO = salto (tieni premuto per saltare piu in alto)\n' +
          'Telefono: tocca lo schermo = salto (tieni premuto per saltare piu in alto)',
        textStyle(20, '#8a97b8'),
      )
      .setOrigin(0.5);
  }

  private showLoggedIn(username: string, best: number): void {
    const W = CONFIG.width;
    this.add.text(W / 2, 240, `Ciao, ${username}!`, textStyle(48, '#ffd54a')).setOrigin(0.5);
    if (best > 0) this.add.text(W / 2, 300, `Record personale: ${best}`, textStyle(28, '#b8c4e0')).setOrigin(0.5);
    makeButton(this, W / 2, 400, 300, 84, 'GIOCA', () => this.scene.start('Game', { name: username }));
    const out = this.add
      .text(W / 2, 500, 'Esci / cambia utente', textStyle(26, '#8a97b8'))
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    out.on('pointerdown', () => {
      clearSession();
      this.scene.restart();
    });
  }

  private showForm(): void {
    const W = CONFIG.width;
    const dom = this.add.dom(W / 2, 385).createFromHTML(
      `<div style="width:440px;display:flex;flex-direction:column;gap:12px;">
         <input name="u" type="text" maxlength="16" placeholder="Nome utente" autocomplete="username" style="${FIELD}">
         <input name="p" type="password" maxlength="72" placeholder="Password" autocomplete="current-password" style="${FIELD}">
         <div style="display:flex;gap:12px;">
           <button name="login" style="${BTN}">ACCEDI</button>
           <button name="register" style="${BTN}">REGISTRATI</button>
         </div>
         <button name="guest" style="${BTN}background:#46506b;font-size:22px;">Gioca come ospite (non va in classifica)</button>
         <div name="msg" style="min-height:26px;color:#ff8a8a;text-align:center;font:20px Arial,sans-serif;"></div>
       </div>`,
    );
    const q = <T extends HTMLElement>(n: string): T => dom.getChildByName(n) as T;
    const user = q<HTMLInputElement>('u');
    const pass = q<HTMLInputElement>('p');
    const msg = q<HTMLElement>('msg');
    const bLogin = q<HTMLButtonElement>('login');
    const bReg = q<HTMLButtonElement>('register');
    const bGuest = q<HTMLButtonElement>('guest');
    const setBusy = (b: boolean): void => [bLogin, bReg, bGuest].forEach((x) => (x.disabled = b));

    const run = async (fn: () => Promise<string>): Promise<void> => {
      msg.textContent = '';
      setBusy(true);
      try {
        const name = await fn();
        this.scene.start('Game', { name });
      } catch (e) {
        msg.textContent = e instanceof ApiError ? e.message : 'Errore imprevisto';
        setBusy(false);
      }
    };

    bLogin.addEventListener('click', () => void run(async () => (await login(user.value.trim(), pass.value)).username));
    bReg.addEventListener('click', () => void run(async () => (await register(user.value.trim(), pass.value)).username));
    bGuest.addEventListener('click', () => this.scene.start('Game', { name: user.value.trim().slice(0, 16) || 'Ospite' }));
    pass.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') bLogin.click();
    });
  }
}
