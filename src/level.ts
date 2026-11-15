// Generatore del livello (terreno + piattaforme + oggetti). Nessuna dipendenza da Phaser:
// si puo' testare da solo. Tutto in coordinate del mondo (x = px, z = altezza dalla linea base).
import { CONFIG } from './config';
import type { HazardId, ObstacleDef, PickupDef } from './config';

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const rand = (a: number, b: number): number => a + Math.random() * (b - a);
const randInt = (a: number, b: number): number => Math.floor(rand(a, b + 1));
const pickOne = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** Superficie orizzontale: da x0 a x1 alla quota `top`. */
export interface Surface {
  x0: number;
  x1: number;
  top: number;
}

export interface Spawn {
  kind: 'obstacle' | 'pickup';
  wx: number;
  z: number;               // z della base dell'oggetto
  obstacle?: ObstacleDef;
  pickup?: PickupDef;
}

/** Stima di difficolta' e velocita' al momento (t, in secondi di gioco) in cui il player arrivera' in un punto. */
export interface Pace {
  t: number;
  d: number;
  speed: number;
}
export type PaceFn = (wx: number) => Pace;

export function paceAtTime(t: number): Pace {
  const D = CONFIG.difficulty;
  const d = Math.min(1, Math.max(0, t / D.rampSeconds));
  return { t, d, speed: lerp(D.startSpeed, D.maxSpeed, Math.pow(d, D.speedCurve)) };
}

export class Level {
  /** Terreno solido (dal bordo alto fino in fondo allo schermo): ha anche pareti laterali. */
  ground: Surface[] = [];
  /** Piattaforme sospese "a senso unico": ci atterri da sopra, ci passi attraverso da sotto. */
  platforms: Surface[] = [];

  private genX = 0;
  private genTop = 0;
  private last: HazardId | null = null;

  reset(startX: number): void {
    this.ground = [];
    this.platforms = [];
    this.last = null;
    this.genTop = 0;
    this.ground.push({ x0: startX - 800, x1: startX + 900, top: 0 });
    this.genX = startX + 900;
  }

  get generatedUntil(): number {
    return this.genX;
  }

  generateUntil(limit: number, pace: PaceFn): Spawn[] {
    const out: Spawn[] = [];
    while (this.genX < limit) this.addChunk(pace, out);
    return out;
  }

  prune(minX: number): void {
    this.ground = this.ground.filter((g) => g.x1 > minX);
    this.platforms = this.platforms.filter((p) => p.x1 > minX);
  }

  // ======================= query per la fisica =======================

  /** Quota della superficie su cui poggiano i piedi (null = vuoto). Il suolo si "sale" da solo fino a stepTol. */
  supportTop(x0: number, x1: number, z: number, stepTol: number): number | null {
    let best: number | null = null;
    for (const g of this.ground) {
      if (g.x1 > x0 && g.x0 < x1 && g.top <= z + stepTol && (best === null || g.top > best)) best = g.top;
    }
    for (const p of this.platforms) {
      if (p.x1 > x0 && p.x0 < x1 && p.top <= z + 0.5 && (best === null || p.top > best)) best = p.top;
    }
    return best;
  }

  /** Parete: il suolo piu' alto che tocca [x0,x1] e supera i piedi di piu' della tolleranza. */
  wallTop(x0: number, x1: number, z: number, stepTol: number): number | null {
    let best: number | null = null;
    for (const g of this.ground) {
      if (g.x1 > x0 && g.x0 < x1 && g.top > z + stepTol && (best === null || g.top > best)) best = g.top;
    }
    return best;
  }

  /** Atterraggio: superficie piu' alta attraversata dai piedi scendendo da prevZ a newZ. */
  landingTop(x0: number, x1: number, prevZ: number, newZ: number, stepTol: number): number | null {
    let best: number | null = null;
    for (const g of this.ground) {
      if (g.x1 > x0 && g.x0 < x1 && g.top <= prevZ + stepTol && g.top >= newZ && (best === null || g.top > best)) best = g.top;
    }
    for (const p of this.platforms) {
      if (p.x1 > x0 && p.x0 < x1 && p.top <= prevZ + 0.5 && p.top >= newZ && (best === null || p.top > best)) best = p.top;
    }
    return best;
  }

  /** Primo tratto di suolo che inizia dopo x (serve per il respawn dopo una caduta). */
  firstGroundAfter(x: number): Surface | null {
    let best: Surface | null = null;
    for (const g of this.ground) {
      if (g.x0 > x && (best === null || g.x0 < best.x0)) best = g;
    }
    return best;
  }

  // ======================= generazione =======================

  private addChunk(pace: PaceFn, out: Spawn[]): void {
    const D = CONFIG.difficulty;
    const L = CONFIG.level;
    const p = pace(this.genX);
    const grace = p.t < D.graceSeconds;
    const id = this.pickHazard(p, grace);
    this.last = id;

    // terreno piano prima di ogni pezzo: lo spazio per prendere la rincorsa
    const rest = lerp(D.restSeconds.start, D.restSeconds.end, p.d) * p.speed * rand(0.85, 1.25);

    switch (id) {
      case 'obstacles': {
        this.emitFlat(rest + p.speed * rand(2.0, 3.4), p, !grace, out);
        break;
      }
      case 'platforms': {
        const seg = this.pushFlat(rest + p.speed * rand(1.4, 2.2) + 300);
        this.addPlatforms(seg, p, !grace, out);
        break;
      }
      case 'pit': {
        this.emitFlat(rest, p, false, out);
        const w = this.pitWidth(p);
        this.birdsOverGap(this.genX, w, this.genTop, out);
        this.genX += w;
        break;
      }
      case 'stepUp': {
        this.emitFlat(rest, p, false, out);
        const h = rand(40, 95);
        if (this.genTop + h <= L.groundMaxTop) this.genTop += h;
        else this.genTop = Math.max(L.groundMinTop, this.genTop - h);
        break;
      }
      case 'stepDown': {
        this.emitFlat(rest, p, false, out);
        this.genTop = Math.max(L.groundMinTop, this.genTop - rand(50, 140));
        break;
      }
      case 'stairsUp': {
        this.emitFlat(rest, p, false, out);
        const n = randInt(2, 3);
        for (let i = 0; i < n; i++) {
          const h = rand(45, 65);
          if (this.genTop + h > L.groundMaxTop) break;
          this.genTop += h;
          if (i < n - 1) this.emitFlat(Math.max(170, p.speed * 0.5), p, false, out);
        }
        break;
      }
      case 'islandPit': {
        this.emitFlat(rest, p, false, out);
        this.genX += this.pitWidth(p);
        const w = Math.max(150, p.speed * 0.35);
        this.platforms.push({ x0: this.genX, x1: this.genX + w, top: this.genTop });
        const def = this.pickPickup(false);
        if (def) out.push({ kind: 'pickup', wx: this.genX + w / 2, z: this.genTop, pickup: def });
        this.genX += w;
        this.genX += this.pitWidth(p);
        break;
      }
    }
  }

  private pickHazard(p: Pace, grace: boolean): HazardId {
    const hz = CONFIG.level.hazards;
    const cand: { id: HazardId; weight: number }[] = [];
    for (const id of Object.keys(hz) as HazardId[]) {
      const cfg = hz[id];
      if (p.d < cfg.minDifficulty) continue;
      if (grace && id !== 'obstacles' && id !== 'platforms') continue;
      let w = cfg.weight;
      if (id === this.last) w *= 0.4;                                   // meno ripetizioni
      if (id === 'stepUp' && this.genTop > 120) w *= 0.2;               // se sei gia' in alto, meno salite
      if (id === 'stairsUp' && this.genTop > 100) w = 0;
      if (id === 'stepDown') w = this.genTop < 50 ? 0 : w * (1 + this.genTop / 80);  // se sei in alto, scendi
      if (w > 0) cand.push({ id, weight: w });
    }
    return this.weighted(cand)?.id ?? 'obstacles';
  }

  private pitWidth(p: Pace): number {
    const a = CONFIG.difficulty.pitSeconds;
    const sec = rand(lerp(a.start[0], a.end[0], p.d), lerp(a.start[1], a.end[1], p.d));
    return Math.max(110, p.speed * sec);
  }

  private pushFlat(len: number): Surface {
    const seg: Surface = { x0: this.genX, x1: this.genX + len, top: this.genTop };
    this.ground.push(seg);
    this.genX += len;
    return seg;
  }

  private emitFlat(len: number, p: Pace, withObstacles: boolean, out: Spawn[]): void {
    this.decorate(this.pushFlat(len), p, withObstacles, out);
  }

  /** Riempie un tratto piano con ostacoli e oggetti, a distanza di sicurezza dai bordi. */
  private decorate(seg: Surface, p: Pace, withObstacles: boolean, out: Spawn[]): void {
    const D = CONFIG.difficulty;
    const margin = p.speed * 0.45;
    const a = seg.x0 + margin;
    const b = seg.x1 - margin;
    if (b - a < 80) return;

    const spacing = p.speed * lerp(D.slotSeconds.start, D.slotSeconds.end, p.d);
    const pObs = withObstacles ? lerp(D.obstacleChance.start, D.obstacleChance.end, p.d) : 0;
    const pPick = lerp(D.pickupChance.start, D.pickupChance.end, p.d);
    const avail = CONFIG.obstacles.filter((o) => o.minDifficulty <= p.d);

    let x = a + rand(0, spacing * 0.4);
    while (x < b) {
      const r = Math.random();
      if (r < pObs && avail.length > 0) {
        const ob = pickOne(avail);
        out.push({ kind: 'obstacle', wx: x, z: seg.top, obstacle: ob });
        // a volte un uccellino sopra l'ostacolo: premia il salto
        if (Math.random() < 0.35) {
          const bird = this.pickPickup(true);
          if (bird) out.push({ kind: 'pickup', wx: x, z: seg.top + Math.min(130, Math.max(bird.elevation, ob.height + 22)), pickup: bird });
        }
      } else if (r < pObs + pPick) {
        const def = this.pickPickup(false);
        if (def) for (let k = 0; k < 3; k++) out.push({ kind: 'pickup', wx: x + k * 52, z: seg.top, pickup: def });
      }
      x += spacing * rand(0.9, 1.25);
    }
  }

  /** Piattaforme singole sospese sopra un tratto piano; a volte con un ostacolo sotto. */
  private addPlatforms(seg: Surface, p: Pace, withObstacles: boolean, out: Spawn[]): void {
    const thickness = CONFIG.level.platformThickness;
    const n = p.d >= 0.4 && seg.x1 - seg.x0 > 900 ? 2 : 1;
    let x = seg.x0 + Math.max(220, p.speed * 0.7);
    let h = rand(85, 125);

    for (let i = 0; i < n; i++) {
      const w = rand(170, 300);
      if (x + w > seg.x1 - Math.max(150, p.speed * 0.4)) break;
      const top = seg.top + h;
      this.platforms.push({ x0: x, x1: x + w, top });

      // oggetti appoggiati sulla piattaforma
      const def = this.pickPickup(false);
      if (def) {
        const cnt = Math.max(2, Math.floor(w / 60));
        for (let k = 0; k < cnt; k++) out.push({ kind: 'pickup', wx: x + (w * (k + 0.5)) / cnt, z: top, pickup: def });
      }

      // ostacolo basso sotto la piattaforma (passi sopra o ci salti sopra)
      if (withObstacles && p.d > 0.2 && Math.random() < 0.5) {
        const low = CONFIG.obstacles.filter((o) => o.minDifficulty <= p.d && o.height <= h - thickness - 5);
        if (low.length > 0) out.push({ kind: 'obstacle', wx: x + w / 2, z: seg.top, obstacle: pickOne(low) });
      }

      x += w + p.speed * rand(0.2, 0.3);
      h = Math.min(135, Math.max(85, h + rand(-30, 40)));
    }
  }

  private birdsOverGap(x: number, w: number, top: number, out: Spawn[]): void {
    if (Math.random() > 0.7) return;
    const def = this.pickPickup(true);
    if (!def) return;
    const n = w > 300 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      out.push({ kind: 'pickup', wx: x + (w * (i + 1)) / (n + 1), z: top + def.elevation + (i === 1 ? 20 : 0), pickup: def });
    }
  }

  /** Sceglie un tipo di oggetto: air = true -> in aria (uccellini), false -> a terra. */
  private pickPickup(air: boolean): PickupDef | null {
    return this.weighted(CONFIG.pickups.filter((p) => (p.elevation > 0) === air));
  }

  private weighted<T extends { weight: number }>(list: T[]): T | null {
    if (list.length === 0) return null;
    let roll = Math.random() * list.reduce((s, e) => s + e.weight, 0);
    for (const e of list) {
      roll -= e.weight;
      if (roll <= 0) return e;
    }
    return list[0];
  }
}
