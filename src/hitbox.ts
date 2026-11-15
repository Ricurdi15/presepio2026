import type Phaser from 'phaser';
import { CONFIG } from './config';

// Il mondo e' 2D laterale: ogni cosa ha un rettangolo in x (orizzontale) e z (altezza dalla linea base).
// Collisione = rettangoli sovrapposti. Questo file e' l'UNICA fonte di verita':
// la usano sia il gioco sia i gizmo.

export interface Box {
  x0: number;
  x1: number;
  z0: number;   // parte bassa
  z1: number;   // parte alta
}

/** Dati di hitbox di un oggetto del mondo (senza grafica, cosi' si puo' testare senza Phaser). */
export interface HitData {
  wx: number;      // x del centro nel mondo
  z: number;       // z della base della hitbox
  hitW: number;
  hitH: number;
}

export interface WorldObj extends HitData {
  s: Phaser.GameObjects.Image;
  kind: 'pickup' | 'obstacle';
  air: boolean;    // solo per i gizmo (uccellini)
  points: number;
  done: boolean;
}

/** Hitbox del player: wx = posizione x nel mondo, feet = z dei piedi. */
export function playerBox(wx: number, feet: number): Box {
  const { w, h } = CONFIG.hitbox.player;
  return { x0: wx - w / 2, x1: wx + w / 2, z0: feet, z1: feet + h };
}

export function objectBox(o: HitData): Box {
  return { x0: o.wx - o.hitW / 2, x1: o.wx + o.hitW / 2, z0: o.z, z1: o.z + o.hitH };
}

export function overlaps(a: Box, b: Box): boolean {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
}
