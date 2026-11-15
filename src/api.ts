import { clearSession, getSession, setSession } from './session';
import type { Session } from './session';

export interface ScoreRow {
  name: string;
  score: number;
}

export interface GameReport {
  guest: boolean;      // true = partita registrata ma non in classifica
  best: number;        // record personale (solo utenti loggati)
  isRecord: boolean;   // questa partita ha battuto il record
  expired: boolean;    // la sessione era scaduta: bisogna rifare il login
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const s = getSession();
  if (s) headers.Authorization = `Bearer ${s.token}`;
  try {
    const res = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
    const data: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = (data as { error?: string } | null)?.error ?? `Errore ${res.status}`;
      throw new ApiError(res.status, msg);
    }
    return data as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(0, 'Server non raggiungibile');
  } finally {
    clearTimeout(timer);
  }
}

export async function register(username: string, password: string): Promise<Session> {
  const s = await call<Session>('/api/register', { username, password });
  setSession(s);
  return s;
}

export async function login(username: string, password: string): Promise<Session> {
  const s = await call<Session>('/api/login', { username, password });
  setSession(s);
  return s;
}

export async function fetchLeaderboard(): Promise<ScoreRow[]> {
  const r = await call<{ rows: ScoreRow[] }>('/api/leaderboard');
  return r.rows;
}

/** Registra la partita sul server (anche se sei ospite). Se sei loggato aggiorna il tuo record. */
export async function reportGame(info: {
  score: number;
  durationSec: number;
  reachedTarget: boolean;
  name: string;
}): Promise<GameReport> {
  const r = await call<{ guest: boolean; best: number; isRecord: boolean; authError: boolean }>('/api/game', info);
  if (r.authError) clearSession();
  return { guest: r.guest, best: r.best, isRecord: r.isRecord, expired: r.authError };
}
