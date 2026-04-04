export interface LeaderboardEntry {
  rank: number;
  userId: string;
  nickname: string;
  avatarUrl?: string;
  totalPoints: number;
  gamesPlayed: number;
}

export interface LeaderboardQuery {
  limit?: number;
  offset?: number;
  period?: 'week' | 'month' | 'all';
}
