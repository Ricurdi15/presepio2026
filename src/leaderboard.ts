import { fetchLeaderboard } from './api';
import type { ScoreRow } from './api';

export type { ScoreRow };

// La classifica ora arriva dal server (MongoDB). Vedi api.ts e la cartella /api.
export const leaderboard = {
  async getTop(n = 10): Promise<ScoreRow[]> {
    return (await fetchLeaderboard()).slice(0, n);
  },
};
