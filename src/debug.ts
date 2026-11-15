import Phaser from 'phaser';
import { CONFIG, DEBUG } from './config';
import { objectBox, overlaps, playerBox } from './hitbox';
import type { Box, WorldObj } from './hitbox';
import type { Level } from './level';

export interface DebugInfo {
  distance: number;                        // x del player nel mondo
  z: number;                               // quota dei piedi
  player: Phaser.GameObjects.Image;
  objects: WorldObj[];
  level: Level;
  stats: string;
}

// Disegna le hitbox usando le STESSE funzioni della collisione, cosi' vedi cio' che il gioco calcola davvero.
export class DebugGizmos {
  private g: Phaser.GameObjects.Graphics | null = null;
  private label: Phaser.GameObjects.Text | null = null;

  constructor(scene: Phaser.Scene) {
    if (!DEBUG.enabled) return;
    this.g = scene.add.graphics().setDepth(2000);
    if (DEBUG.stats) {
      this.label = scene.add
        .text(CONFIG.width / 2, 12, '', { fontFamily: 'monospace', fontSize: '18px', color: '#ffffff', backgroundColor: '#000000aa' })
        .setOrigin(0.5, 0)
        .setDepth(2001);
    }
  }

  update(info: DebugInfo): void {
    const g = this.g;
    if (!g) return;
    g.clear();

    const L = CONFIG.level;
    const off = CONFIG.playerX - info.distance;   // schermo = mondo + off
    const pBox = playerBox(info.distance, info.z);

    if (DEBUG.terrain) {
      g.lineStyle(3, 0xffff00, 0.9);
      for (const s of info.level.ground) {
        const y = L.baselineY - s.top;
        g.lineBetween(s.x0 + off, y, s.x1 + off, y);
        g.lineBetween(s.x0 + off, y, s.x0 + off, y + 24);   // parete sinistra (il lato che puo' fermarti)
      }
      g.lineStyle(3, 0x00ffff, 0.9);
      for (const s of info.level.platforms) {
        const y = L.baselineY - s.top;
        g.lineBetween(s.x0 + off, y, s.x1 + off, y);
      }
      // appoggio dei piedi
      g.lineStyle(4, 0xff00ff, 1);
      const y = L.baselineY - info.z;
      g.lineBetween(CONFIG.playerX - L.feetHalfWidth, y, CONFIG.playerX + L.feetHalfWidth, y);
    }

    if (DEBUG.hitboxes) {
      this.drawBox(off, pBox, 0x00ff55);
      for (const o of info.objects) {
        const b = objectBox(o);
        const hit = overlaps(pBox, b);
        const base = o.kind === 'obstacle' ? 0xff3333 : o.air ? 0x4dc3ff : 0xffd400;
        this.drawBox(off, b, hit ? 0xffffff : base);
      }
    }

    if (DEBUG.spriteBounds) {
      g.lineStyle(1, 0x4da6ff, 0.9);
      const pb = info.player.getBounds();
      g.strokeRect(pb.x, pb.y, pb.width, pb.height);
      for (const o of info.objects) {
        const b = o.s.getBounds();
        g.strokeRect(b.x, b.y, b.width, b.height);
      }
    }

    this.label?.setText(info.stats);
  }

  private drawBox(off: number, b: Box, color: number): void {
    const g = this.g!;
    const x = b.x0 + off;
    const y = CONFIG.level.baselineY - b.z1;   // z cresce verso l'alto, y dello schermo verso il basso
    const w = b.x1 - b.x0;
    const h = b.z1 - b.z0;
    g.fillStyle(color, 0.18);
    g.fillRect(x, y, w, h);
    g.lineStyle(2, color, 1);
    g.strokeRect(x, y, w, h);
  }
}
