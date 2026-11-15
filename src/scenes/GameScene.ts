import Phaser from 'phaser';
import { CONFIG } from '../config';
import { DebugGizmos } from '../debug';
import { objectBox, overlaps, playerBox } from '../hitbox';
import type { WorldObj } from '../hitbox';
import { reportGame } from '../api';
import type { GameReport } from '../api';
import { Level, paceAtTime } from '../level';
import type { Pace, Spawn } from '../level';
import { newPlayer, respawnAfterFall, stepPlayer } from '../physics';
import type { PlayerState, StepResult } from '../physics';
import { textStyle } from '../ui';

type GameState = 'playing' | 'dying' | 'over';
type Keys = Record<'space', Phaser.Input.Keyboard.Key>;

export class GameScene extends Phaser.Scene {
  private playerName = 'Player';

  private state: GameState = 'playing';
  private score = 0;
  private lives = 0;
  private speed = 0;
  private elapsed = 0;          // secondi di gioco effettivo (guida la difficolta')
  private invul = 0;
  private animT = 0;
  private pl: PlayerState = newPlayer();   // x = posizione nel mondo, z = quota dei piedi
  private level = new Level();
  private objects: WorldObj[] = [];

  private runFrames: string[] = [];
  private curKey = '';
  private player!: Phaser.GameObjects.Image;
  private shadow!: Phaser.GameObjects.Image;
  private hills!: Phaser.GameObjects.TileSprite;
  private terrainG!: Phaser.GameObjects.Graphics;
  private livesText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private gizmos!: DebugGizmos;

  private keys!: Keys;
  private jumpPressed = false;
  private jumpPointers = new Set<number>();

  constructor() {
    super('Game');
  }

  init(data: { name?: string }): void {
    this.playerName = data.name ?? 'Player';
  }

  create(): void {
    const C = CONFIG;
    this.cameras.main.setBackgroundColor('#87CEEB');

    // ---------- sfondo ----------
    this.hills = this.add.tileSprite(C.width / 2, C.level.baselineY - 100, C.width, 200, 'hills').setDepth(-200);
    this.terrainG = this.add.graphics().setDepth(-50);

    // ---------- stato ----------
    this.state = 'playing';
    this.score = 0;
    this.lives = C.maxLives;
    this.elapsed = 0;
    this.speed = paceAtTime(0).speed;
    this.invul = 0;
    this.animT = 0;
    this.objects = [];
    this.pl = newPlayer();
    this.level = new Level();
    this.level.reset(0);
    this.ensureLevel();

    // ---------- player ----------
    this.runFrames = [];
    for (let i = 0; this.textures.exists(`player_run_${i}`); i++) this.runFrames.push(`player_run_${i}`);
    this.shadow = this.add.image(C.playerX, C.level.baselineY, 'shadow').setDepth(19);
    this.player = this.add.image(C.playerX, C.level.baselineY, this.runFrames[0]).setOrigin(0.5, 1).setDepth(20);
    this.curKey = '';
    this.setPlayerTexture(this.runFrames[0]);

    // ---------- HUD: vite a sinistra, punteggio a destra ----------
    const hudStyle = textStyle(40, '#ffffff', { stroke: '#000000', strokeThickness: 5 });
    this.livesText = this.add.text(24, 16, '', hudStyle).setDepth(1000);
    this.scoreText = this.add.text(C.width - 24, 16, '', hudStyle).setOrigin(1, 0).setDepth(1000);

    this.gizmos = new DebugGizmos(this);

    // ---------- input: SPAZIO su PC, tocco su telefono (tieni premuto = salto piu' alto) ----------
    this.keys = this.input.keyboard!.addKeys({ space: 'SPACE' }) as Keys;
    this.jumpPressed = false;
    this.jumpPointers.clear();
    this.input.addPointer(2);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.jumpPointers.add(p.id);
      this.jumpPressed = true;
    });
    const release = (p: Phaser.Input.Pointer): void => {
      this.jumpPointers.delete(p.id);
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);

    this.refreshHud();
  }

  private setPlayerTexture(key: string): void {
    if (this.curKey === key) return;
    this.curKey = key;
    this.player.setTexture(key).setDisplaySize(CONFIG.playerSize, CONFIG.playerSize);
  }

  private refreshHud(): void {
    this.livesText.setText(`VITE: ${this.lives}`);
    this.scoreText.setText(`PUNTI: ${this.score}`);
  }

  // ---------- livello e oggetti ----------
  /** Stima difficolta' e velocita' di quando il player arrivera' a wx. */
  private paceAt = (wx: number): Pace => {
    const ahead = Math.max(0, wx - this.pl.x);
    return paceAtTime(this.elapsed + ahead / Math.max(this.speed, 1));
  };

  private ensureLevel(ahead: number = CONFIG.level.aheadPx): void {
    const spawns = this.level.generateUntil(this.pl.x + ahead, this.paceAt);
    for (const sp of spawns) this.addObject(sp);
  }

  private addObject(sp: Spawn): void {
    if (sp.kind === 'obstacle' && sp.obstacle) {
      const t = sp.obstacle;
      const k = CONFIG.hitbox.obstacleScale;
      const s = this.add.image(0, 0, t.key).setOrigin(0.5, 1).setDisplaySize(t.width, t.height).setDepth(10);
      this.objects.push({ s, kind: 'obstacle', air: false, wx: sp.wx, z: sp.z, hitW: t.width * k, hitH: t.height * k, points: 0, done: false });
    } else if (sp.kind === 'pickup' && sp.pickup) {
      const t = sp.pickup;
      const k = CONFIG.hitbox.pickupScale;
      const s = this.add.image(0, 0, t.key).setOrigin(0.5, 1).setDisplaySize(t.width, t.height).setDepth(12);
      this.objects.push({ s, kind: 'pickup', air: t.elevation > 0, wx: sp.wx, z: sp.z, hitW: t.width * k, hitH: t.height * k, points: t.points, done: false });
    }
  }

  private clearObjects(fromX: number, toX: number): void {
    this.objects = this.objects.filter((o) => {
      if (o.wx >= fromX && o.wx <= toX) {
        o.s.destroy();
        return false;
      }
      return true;
    });
  }

  // ---------- eventi di gioco ----------
  private hurt(): void {
    if (this.invul > 0) return;
    this.loseLife();
  }

  private loseLife(): void {
    this.lives--;
    this.invul = CONFIG.invulnerableTime;
    this.refreshHud();
    if (this.lives <= 0) this.die();
  }

  private die(): void {
    this.state = 'dying';
    this.player.setVisible(true);
    this.setPlayerTexture('player_dead');
    this.time.delayedCall(1200, () => {
      void this.finish();
    });
  }

  private async finish(): Promise<void> {
    this.state = 'over';
    const win = this.score >= CONFIG.targetScore;
    // registra SEMPRE la partita sul server (anche da ospite); se sei loggato aggiorna il record
    let report: GameReport | null = null;
    try {
      report = await reportGame({
        score: this.score,
        durationSec: this.elapsed,
        reachedTarget: win,
        name: this.playerName,
      });
    } catch (e) {
      console.error(e);
    }
    this.scene.start('GameOver', { name: this.playerName, score: this.score, win, report });
  }

  private handlePhysics(res: StepResult): void {
    // parete urtata (gradino troppo alto o salto troppo corto): il player e' gia' stato riportato sopra il blocco
    if (res.wall) this.hurt();
    if (this.state !== 'playing') return;

    // caduto in una buca: riparte dal primo suolo dopo la buca
    if (res.fell) {
      this.ensureLevel(this.pl.x + 4000);
      const r = respawnAfterFall(this.pl, this.level);
      if (r) this.clearObjects(r.from - 250, r.to + 250);
      else {
        this.pl.z = 0;
        this.pl.grounded = true;
      }
      this.hurt();
    }
  }

  private stepObjects(): void {
    const C = CONFIG;
    const pBox = playerBox(this.pl.x, this.pl.z);
    for (let i = this.objects.length - 1; i >= 0; i--) {
      const o = this.objects[i];
      if (!o.done && overlaps(pBox, objectBox(o))) {
        if (o.kind === 'pickup') {
          this.score += o.points;
          this.refreshHud();
          o.s.destroy();
          this.objects.splice(i, 1);
          continue;
        }
        if (this.invul <= 0) {
          o.done = true;
          this.loseLife();
          if (this.state !== 'playing') return;
        }
      }
      if (o.wx - this.pl.x + C.playerX < -150) {
        o.s.destroy();
        this.objects.splice(i, 1);
      }
    }
  }

  // ---------- loop ----------
  update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.05);

    // in verticale (telefono) il gioco va in pausa: l'overlay HTML chiede di ruotare
    if (window.innerHeight > window.innerWidth) return;
    if (this.state === 'over') return;

    if (this.state === 'playing') {
      const pressed = Phaser.Input.Keyboard.JustDown(this.keys.space) || this.jumpPressed;
      const held = this.keys.space.isDown || this.jumpPointers.size > 0;

      // progressione: velocita' e difficolta' salgono col tempo fino al massimo
      this.elapsed += dt;
      this.speed = paceAtTime(this.elapsed).speed;

      this.handlePhysics(stepPlayer(this.pl, this.level, this.speed, dt, pressed, held));
      if (this.state === 'playing') this.stepObjects();
      if (this.state === 'playing') {
        this.ensureLevel();
        this.level.prune(this.pl.x - CONFIG.playerX - 300);
      }
    }
    this.jumpPressed = false;

    this.render(dt);
  }

  // ---------- grafica ----------
  private render(dt: number): void {
    const C = CONFIG;
    const L = C.level;
    const off = C.playerX - this.pl.x;   // schermo = mondo + off

    this.hills.tilePositionX = this.pl.x * 0.25;
    this.drawTerrain(off);

    for (const o of this.objects) o.s.setPosition(o.wx + off, L.baselineY - o.z);

    this.player.setPosition(C.playerX, L.baselineY - this.pl.z);

    // ombra sulla superficie sotto i piedi
    const fw = L.feetHalfWidth;
    const under = this.level.supportTop(this.pl.x - fw, this.pl.x + fw, this.pl.z, 0.5);
    if (under === null) {
      this.shadow.setVisible(false);
    } else {
      const k = 1 / (1 + (this.pl.z - under) / 200);
      this.shadow.setVisible(true).setPosition(C.playerX, L.baselineY - under + 2).setDisplaySize(64 * k, 20 * k);
    }

    if (this.state !== 'dying') {
      if (!this.pl.grounded) {
        this.setPlayerTexture(this.runFrames[Math.min(1, this.runFrames.length - 1)]);
      } else {
        this.animT += dt * C.runAnimFps * (this.speed / C.difficulty.startSpeed);
        this.setPlayerTexture(this.runFrames[Math.floor(this.animT) % this.runFrames.length]);
      }
      this.invul -= dt;
      this.player.setVisible(this.invul <= 0 || Math.floor(this.invul * 12) % 2 === 0);
    }

    this.gizmos.update({
      distance: this.pl.x,
      z: this.pl.z,
      player: this.player,
      objects: this.objects,
      level: this.level,
      stats:
        `t=${this.elapsed.toFixed(0)}s  vel=${this.speed.toFixed(0)}px/s  ` +
        `diff=${(paceAtTime(this.elapsed).d * 100).toFixed(0)}%  oggetti=${this.objects.length}`,
    });
  }

  /** Disegna terreno e piattaforme (placeholder a rettangoli, con una texture a quadretti che scorre). */
  private drawTerrain(off: number): void {
    const C = CONFIG;
    const L = C.level;
    const g = this.terrainG;
    g.clear();

    for (const s of this.level.ground) {
      const sx0 = Math.max(-10, s.x0 + off);
      const sx1 = Math.min(C.width + 10, s.x1 + off);
      if (sx1 <= sx0) continue;
      const top = L.baselineY - s.top;

      g.fillStyle(0x7a5230);
      g.fillRect(sx0, top, sx1 - sx0, C.height - top);

      // quadretti scuri agganciati al mondo: danno l'idea della velocita'
      g.fillStyle(0x6b4527);
      for (let wx = Math.floor((sx0 - off) / 80) * 80; wx < sx1 - off; wx += 80) {
        for (let row = 0; top + 40 + row * 44 < C.height; row++) {
          const h = (Math.floor(wx / 80) * 7 + row * 13) % 3;
          const x = wx + off + 12;
          if (h === 0 && x >= sx0 && x + 22 <= sx1) g.fillRect(x, top + 40 + row * 44, 22, 12);
        }
      }

      g.fillStyle(0x4caf50);
      g.fillRect(sx0, top, sx1 - sx0, 14);
      g.fillStyle(0x388e3c);
      g.fillRect(sx0, top + 14, sx1 - sx0, 4);
    }

    for (const p of this.level.platforms) {
      const sx0 = p.x0 + off;
      const sx1 = p.x1 + off;
      if (sx1 < -10 || sx0 > C.width + 10) continue;
      const top = L.baselineY - p.top;
      g.fillStyle(0xa9743f);
      g.fillRect(sx0, top, sx1 - sx0, L.platformThickness);
      g.fillStyle(0xc99560);
      g.fillRect(sx0, top, sx1 - sx0, 5);
      g.fillStyle(0x7d532b);
      g.fillRect(sx0, top + L.platformThickness - 4, sx1 - sx0, 4);
    }
  }
}
