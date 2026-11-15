// Sessione dell'utente loggato, salvata nel browser (localStorage).
export interface Session {
  token: string;
  username: string;
  best: number;
}

const KEY = 'runner_session_v1';

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function setSession(s: Session): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage non disponibile */
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignora */
  }
}
