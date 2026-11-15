// Fisica del player contro il livello. Nessuna dipendenza da Phaser (testabile da sola).
import { CONFIG } from './config';
import type { Level, Surface } from './level';

export interface PlayerState {
  x: number;          // posizione nel mondo (il player e' fermo sullo schermo, scorre il mondo)
  z: number;          // quota dei piedi
  vz: number;
  grounded: boolean;
  coyote: number;
  jumpBuf: number;
}

export interface StepResult {
  wall: boolean;      // ha urtato una parete (e' stato riportato sopra il blocco)
  fell: boolean;      // e' caduto in una buca
}

export function newPlayer(): PlayerState {
  return { x: 0, z: 0, vz: 0, grounded: true, coyote: 0, jumpBuf: 0 };
}

export function stepPlayer(
  p: PlayerState,
  level: Level,
  speed: number,
  dt: number,
  jumpPressed: boolean,
  jumpHeld: boolean,
): StepResult {
  const C = CONFIG;
  const L = C.level;
  const hw = C.hitbox.player.w / 2;
  const fw = L.feetHalfWidth;
  const tol = L.stepTolerance;
  const res: StepResult = { wall: false, fell: false };

  p.x += speed * dt;
  if (jumpPressed) p.jumpBuf = C.jumpBuffer;

  // 1. pareti: un blocco piu' alto dei piedi (oltre la tolleranza) ti ferma. Qui lo risolviamo
  //    riportando il player sopra il blocco; il gioco decide poi se togliere una vita.
  const wall = level.wallTop(p.x - hw, p.x + hw, p.z, tol);
  if (wall !== null) {
    p.z = wall;
    p.vz = 0;
    p.grounded = true;
    res.wall = true;
  }

  // 2. appoggio: se sei a terra e sotto i piedi non c'e' piu' niente, cadi (con un attimo di "coyote time")
  if (p.grounded) {
    const sup = level.supportTop(p.x - fw, p.x + fw, p.z, tol);
    if (sup === null || sup < p.z - 0.5) {
      p.grounded = false;
      p.vz = 0;
    } else {
      p.z = sup;                 // include i gradini piccoli (salita automatica)
      p.coyote = L.coyoteTime;
    }
  } else {
    p.coyote -= dt;
  }

  // 3. salto (con buffer: il tasto premuto poco prima di toccare terra vale)
  p.jumpBuf -= dt;
  if (p.jumpBuf > 0 && (p.grounded || p.coyote > 0)) {
    p.vz = C.jumpVelocity;
    p.grounded = false;
    p.coyote = 0;
    p.jumpBuf = 0;
  }

  // 4. gravita': piu' tieni premuto, piu' sali. Se rilasci in salita la gravita' aumenta.
  if (!p.grounded) {
    let g = C.gravity;
    if (p.vz > 0 && !jumpHeld) g *= C.releaseGravityMultiplier;
    p.vz -= g * dt;
    const prev = p.z;
    p.z += p.vz * dt;
    if (p.vz <= 0) {
      const land = level.landingTop(p.x - fw, p.x + fw, prev, p.z, tol);
      if (land !== null) {
        p.z = land;
        p.vz = 0;
        p.grounded = true;
      }
    }
  }

  if (p.z < L.deathZ) res.fell = true;
  return res;
}

/** Dopo una caduta: riporta il player sul primo suolo dopo la buca. Ritorna l'intervallo "saltato". */
export function respawnAfterFall(p: PlayerState, level: Level): { from: number; to: number } | null {
  const next: Surface | null = level.firstGroundAfter(p.x);
  if (!next) return null;
  const from = p.x;
  p.x = next.x0 + 70;
  p.z = next.top;
  p.vz = 0;
  p.grounded = true;
  p.coyote = 0;
  p.jumpBuf = 0;
  return { from, to: p.x };
}
