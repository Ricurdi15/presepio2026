import Phaser from 'phaser';
import { ASSET_FILES, CONFIG } from '../config';

// Carica gli sprite veri (se li hai indicati in ASSET_FILES) e genera i placeholder per il resto.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    for (const [key, path] of Object.entries(ASSET_FILES)) {
      if (path) this.load.image(key, path);
    }
  }

  create(): void {
    this.makePlaceholders();
    this.scene.start('Name');
  }

  private makePlaceholders(): void {
    const tex = this.textures;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    const done = (key: string, w: number, h: number): void => {
      g.generateTexture(key, w, h);
      g.clear();
      tex.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    };
    const darker = (c: number): number => Phaser.Display.Color.IntegerToColor(c).darken(40).color;

    // --- player: 4 frame di corsa + frame di morte (griglia 32x32) ---
    if (!tex.exists('player_run_0')) {
      const legA = [0, 2, 4, 2];
      const legB = [4, 2, 0, 2];
      for (let i = 0; i < 4; i++) {
        g.fillStyle(0x1a40a0);
        g.fillRect(9, 22, 5, 10 - legA[i]);
        g.fillRect(18, 22, 5, 10 - legB[i]);
        g.fillStyle(0x3380ff);
        g.fillRect(8, 2, 16, 20);
        g.fillStyle(0xffffff);
        g.fillRect(17, 5, 5, 5);
        done(`player_run_${i}`, 32, 32);
      }
    }
    if (!tex.exists('player_dead')) {
      g.fillStyle(0x80808c);
      g.fillRect(2, 20, 28, 12);
      g.fillStyle(0x000000);
      g.fillRect(8, 23, 3, 3);
      g.fillRect(20, 23, 3, 3);
      done('player_dead', 32, 32);
    }

    // --- oggetti da raccogliere: un frame unico ciascuno ---
    // a terra = cerchio, in aria = uccellino (si riconoscono al volo)
    for (const p of CONFIG.pickups) {
      if (tex.exists(p.key)) continue;
      if (p.shape === 'bird') {
        // uccellino rivolto a sinistra, griglia 48x32
        g.fillStyle(darker(p.color));
        g.fillTriangle(38, 16, 47, 10, 45, 21);          // coda
        g.fillStyle(p.color);
        g.fillEllipse(26, 18, 30, 16);                   // corpo
        g.fillStyle(darker(p.color));
        g.fillTriangle(20, 17, 33, 17, 27, 4);           // ala
        g.fillStyle(p.color);
        g.fillCircle(13, 14, 7);                         // testa
        g.fillStyle(0xff9a1a);
        g.fillTriangle(7, 12, 0, 15, 7, 18);             // becco
        g.fillStyle(0x000000);
        g.fillRect(11, 12, 2, 2);                        // occhio
        done(p.key, 48, 32);
      } else {
        g.fillStyle(darker(p.color));
        g.fillCircle(16, 16, 15);
        g.fillStyle(p.color);
        g.fillCircle(16, 16, 12);
        done(p.key, 32, 32);
      }
    }

    // --- ostacoli: un frame unico ciascuno ---
    for (const o of CONFIG.obstacles) {
      if (tex.exists(o.key)) continue;
      g.fillStyle(darker(o.color));
      g.fillRect(0, 0, 32, 32);
      g.fillStyle(o.color);
      g.fillRect(2, 2, 28, 28);
      done(o.key, 32, 32);
    }

    // --- ombra, colline di sfondo, immagine di vittoria ---
    if (!tex.exists('shadow')) {
      g.fillStyle(0x000000, 0.35);
      g.fillEllipse(32, 10, 60, 18);
      done('shadow', 64, 20);
    }
    if (!tex.exists('hills')) {
      // colline per lo sfondo (si ripetono senza stacchi: nulla tocca i bordi)
      g.fillStyle(0x8fcf7a);
      g.fillEllipse(130, 200, 220, 170);
      g.fillEllipse(540, 200, 160, 90);
      g.fillStyle(0x7dbd6a);
      g.fillEllipse(360, 200, 260, 120);
      done('hills', 640, 200);
    }
    if (!tex.exists('win')) {
      g.fillStyle(0xcc9a00);
      g.fillRect(0, 0, 256, 256);
      g.fillStyle(0xffd633);
      g.fillRect(8, 8, 240, 240);
      done('win', 256, 256);
    }
    g.destroy();
  }
}
