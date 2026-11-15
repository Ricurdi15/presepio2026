export interface ScoreRow {
  name: string;
  score: number;
  t?: number;
}

// Interfaccia a Promise: quando passerai al database online scrivi un'altra
// implementazione (fetch / SDK) e cambia solo l'ultima riga del file.
export interface ILeaderboard {
  submit(name: string, score: number): Promise<void>;
  getTop(n?: number): Promise<ScoreRow[]>;
}

class LocalLeaderboard implements ILeaderboard {
  private readonly key = 'endless_runner_leaderboard_v1';

  private load(): ScoreRow[] {
    try {
      return JSON.parse(localStorage.getItem(this.key) ?? '[]') as ScoreRow[];
    } catch {
      return [];
    }
  }

  async submit(name: string, score: number): Promise<void> {
    const list = this.load();
    list.push({ name, score, t: Date.now() });
    list.sort((a, b) => b.score - a.score);
    try {
      localStorage.setItem(this.key, JSON.stringify(list.slice(0, 50)));
    } catch {
      /* storage non disponibile */
    }
  }

  async getTop(n = 10): Promise<ScoreRow[]> {
    return this.load().slice(0, n);
  }
}

export const leaderboard: ILeaderboard = new LocalLeaderboard();
