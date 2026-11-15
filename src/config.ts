// Tutte le regole e i parametri del gioco in un unico posto.
// Unita': pixel su un canvas logico 1280x720 (scalato automaticamente).
// Coordinate del mondo: x = orizzontale (cresce verso destra), z = altezza sopra la linea base (cresce verso l'alto).

export type PickupShape = 'circle' | 'bird';

export interface PickupDef {
  key: string;          // nome texture (e nome file se aggiungi lo sprite vero)
  color: number;        // colore del placeholder
  points: number;
  elevation: number;    // altezza sopra la superficie: 0 = appoggiato (a terra / su piattaforma), >0 = in aria
  weight: number;       // piu' alto = piu' frequente
  shape: PickupShape;   // forma del placeholder: 'circle' (a terra) o 'bird' (in aria)
  width: number;        // dimensione a schermo
  height: number;
}

export interface ObstacleDef {
  key: string;
  color: number;
  width: number;        // dimensione a schermo
  height: number;       // il player deve saltare piu' in alto di questo valore
  minDifficulty: number; // 0..1: da quando (nella progressione) puo' comparire
}

// Tipi di "pezzi di livello" che il generatore sceglie a caso. Aggiungerne uno = scrivere una voce qui
// + un case in Level.addChunk (level.ts).
export type HazardId = 'obstacles' | 'platforms' | 'pit' | 'stepUp' | 'stepDown' | 'islandPit' | 'stairsUp';

export interface HazardCfg {
  weight: number;         // frequenza relativa
  minDifficulty: number;  // 0..1: da quando puo' comparire
}

// N tipi di oggetti da raccogliere (aggiungine quanti vuoi)
const pickups: PickupDef[] = [
  { key: 'pickup_0', color: 0xffd400, points: 10, elevation: 0,   weight: 1,    shape: 'circle', width: 44, height: 44 },
  { key: 'pickup_1', color: 0x4dc3ff, points: 25, elevation: 105, weight: 0.4,  shape: 'bird',   width: 54, height: 36 }, // in aria
  { key: 'pickup_2', color: 0xff4de6, points: 50, elevation: 0,   weight: 0.15, shape: 'circle', width: 44, height: 44 },
];

// N tipi di ostacoli (aggiungine quanti vuoi). Quelli alti arrivano piu' avanti nella partita.
const obstacles: ObstacleDef[] = [
  { key: 'obstacle_0', color: 0xd93333, width: 65, height: 58,  minDifficulty: 0 },
  { key: 'obstacle_1', color: 0xe68c1a, width: 72, height: 86,  minDifficulty: 0.15 },
  { key: 'obstacle_2', color: 0x8c33b3, width: 50, height: 108, minDifficulty: 0.35 },
];

const hazards: Record<HazardId, HazardCfg> = {
  obstacles: { weight: 3,   minDifficulty: 0 },     // tratto piano con ostacoli e oggetti
  platforms: { weight: 2,   minDifficulty: 0 },     // piattaforme singole sospese (con oggetti)
  pit:       { weight: 2.2, minDifficulty: 0.05 },  // buca
  stepUp:    { weight: 1.2, minDifficulty: 0.1 },   // gradino in salita
  stepDown:  { weight: 1,   minDifficulty: 0.1 },   // gradino in discesa
  stairsUp:  { weight: 0.8, minDifficulty: 0.25 },  // 2-3 gradini consecutivi
  islandPit: { weight: 1.2, minDifficulty: 0.3 },   // buca larga con una piattaforma "isola" in mezzo
};

export const CONFIG = {
  width: 1280,
  height: 720,

  // --- regole ---
  maxLives: 3,
  targetScore: 150,          // punteggio target per la schermata "vittoria"

  // --- progressione: la difficolta' d va da 0 a 1 in rampSeconds secondi di gioco ---
  difficulty: {
    rampSeconds: 120,        // dopo 2 minuti si e' al massimo
    speedCurve: 1,           // 1 = lineare, >1 = parte piu' piano e accelera dopo
    startSpeed: 380,         // px/s all'inizio
    maxSpeed: 1100,          // px/s al massimo (il "limite")
    graceSeconds: 5,         // all'inizio solo tratti sicuri, niente pericoli
    // secondi di terreno piano tra un pezzo di livello e il successivo
    restSeconds: { start: 1.4, end: 0.55 },
    // secondi tra uno "slot" di oggetti/ostacoli e il successivo nei tratti piani
    slotSeconds: { start: 1.3, end: 0.7 },
    obstacleChance: { start: 0.45, end: 0.85 },   // probabilita' di ostacolo per slot
    pickupChance: { start: 0.5, end: 0.35 },      // probabilita' di oggetti per slot
    // larghezza delle buche espressa come "secondi di volo" necessari per scavalcarle: [min, max]
    // (il salto massimo dura ~0.73 s, quindi 0.55 e' gia' molto impegnativo)
    pitSeconds: { start: [0.25, 0.35] as [number, number], end: [0.4, 0.55] as [number, number] },
  },

  // --- livello ---
  level: {
    baselineY: 580,          // y dello schermo che corrisponde a z = 0
    groundMinTop: 0,         // quota minima/massima del terreno
    groundMaxTop: 200,
    platformThickness: 22,
    aheadPx: 2200,           // quanto livello genera in anticipo
    stepTolerance: 30,       // gradini piu' bassi di cosi' si salgono da soli; piu' alti = muro
    feetHalfWidth: 14,       // mezza larghezza dell'appoggio dei piedi
    deathZ: -200,            // sotto questa quota si e' caduti in una buca
    coyoteTime: 0.08,        // si puo' ancora saltare per un attimo dopo aver lasciato un bordo
    hazards,
  },

  // --- player ---
  playerX: 250,              // posizione fissa sullo schermo (scorre il mondo)
  playerSize: 86,            // dimensione dello sprite
  runAnimFps: 10,
  invulnerableTime: 1.5,     // secondi di invulnerabilita' dopo un colpo

  // --- hitbox (rettangoli in x/altezza, ancorati ai piedi) ---
  hitbox: {
    player: { w: 40, h: 70 },  // piu' piccola dello sprite (86x86) = piu' "onesta"
    obstacleScale: 0.85,       // hitbox ostacoli = 85% dello sprite
    pickupScale: 1,            // hitbox raccoglibili = 100% dello sprite
  },

  // --- salto stile Mario ---
  jumpVelocity: 800,         // altezza max = v^2 / (2*g) = ~145 px, durata max ~0.73 s
  gravity: 2200,
  releaseGravityMultiplier: 3, // rilasci in salita -> salto piu' corto
  jumpBuffer: 0.1,

  pickups,
  obstacles,
};

// Gizmo di sviluppo. 'enabled' e' true solo con `npm run dev` e si spegne da solo nella build.
// Metti enabled: false per disattivarli del tutto, oppure spegni le singole voci.
export const DEBUG = {
  enabled: Boolean(import.meta.env?.DEV),
  hitboxes: true,       // rettangoli (verde player, rosso ostacoli, giallo/azzurro oggetti, bianco = collisione)
  terrain: true,        // linee del terreno (giallo = suolo solido, azzurro = piattaforme) e appoggio dei piedi (viola)
  spriteBounds: false,  // contorno blu degli sprite (per confrontarli con le hitbox)
  stats: true,          // testo con tempo, velocita', difficolta'
};

// Sprite veri (opzionali). Chiave -> percorso (i file stanno in /public).
// Cio' che lasci fuori usa il placeholder.
// Esempio: 'player_run_0': '/assets/player_run_0.png'
// I frame di corsa si chiamano player_run_0, player_run_1, ... (ne carica quanti ne trova).
export const ASSET_FILES: Record<string, string> = {
  // 'player_run_0': '/assets/player_run_0.png',
  // 'player_dead':  '/assets/player_dead.png',
  // 'pickup_0':     '/assets/coin.png',
  // 'obstacle_0':   '/assets/rock.png',
  // 'win':          '/assets/win.png',
};
