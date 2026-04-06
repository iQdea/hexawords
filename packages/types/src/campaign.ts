export interface CampaignLevel {
  level: number;
  hexCount: number;
  targetScore: number;
  /** Minimum word length for this level. */
  minWordLength: number;
}

export const CAMPAIGN_LEVELS: CampaignLevel[] = [
  // Tier 1: 3 hexagons, words 2+ letters — easy start
  { level: 1,  hexCount: 3, minWordLength: 2, targetScore: 300 },
  { level: 2,  hexCount: 3, minWordLength: 2, targetScore: 600 },
  { level: 3,  hexCount: 3, minWordLength: 2, targetScore: 1000 },
  { level: 4,  hexCount: 3, minWordLength: 2, targetScore: 1800 },
  { level: 5,  hexCount: 3, minWordLength: 2, targetScore: 3000 },

  // Tier 2: 4 hexagons, words 3+ letters
  { level: 6,  hexCount: 4, minWordLength: 3, targetScore: 2000 },
  { level: 7,  hexCount: 4, minWordLength: 3, targetScore: 4000 },
  { level: 8,  hexCount: 4, minWordLength: 3, targetScore: 7000 },
  { level: 9,  hexCount: 4, minWordLength: 3, targetScore: 11000 },
  { level: 10, hexCount: 4, minWordLength: 3, targetScore: 16000 },

  // Tier 3: 5 hexagons, words 3+ letters
  { level: 11, hexCount: 5, minWordLength: 3, targetScore: 8000 },
  { level: 12, hexCount: 5, minWordLength: 3, targetScore: 14000 },
  { level: 13, hexCount: 5, minWordLength: 3, targetScore: 22000 },
  { level: 14, hexCount: 5, minWordLength: 3, targetScore: 35000 },
  { level: 15, hexCount: 5, minWordLength: 3, targetScore: 50000 },

  // Tier 4: 5 hexagons, words 4+ letters — harder
  { level: 16, hexCount: 5, minWordLength: 4, targetScore: 30000 },
  { level: 17, hexCount: 5, minWordLength: 4, targetScore: 50000 },
  { level: 18, hexCount: 5, minWordLength: 4, targetScore: 75000 },
  { level: 19, hexCount: 5, minWordLength: 4, targetScore: 110000 },
  { level: 20, hexCount: 5, minWordLength: 4, targetScore: 160000 },

  // Tier 5: 7 hexagons, words 4+ letters
  { level: 21, hexCount: 7, minWordLength: 4, targetScore: 80000 },
  { level: 22, hexCount: 7, minWordLength: 4, targetScore: 130000 },
  { level: 23, hexCount: 7, minWordLength: 4, targetScore: 200000 },
  { level: 24, hexCount: 7, minWordLength: 4, targetScore: 300000 },
  { level: 25, hexCount: 7, minWordLength: 4, targetScore: 420000 },

  // Tier 6: 7 hexagons, words 5+ letters — endgame
  { level: 26, hexCount: 7, minWordLength: 5, targetScore: 250000 },
  { level: 27, hexCount: 7, minWordLength: 5, targetScore: 400000 },
  { level: 28, hexCount: 7, minWordLength: 5, targetScore: 600000 },
  { level: 29, hexCount: 7, minWordLength: 5, targetScore: 900000 },
  { level: 30, hexCount: 7, minWordLength: 5, targetScore: 1300000 },
  { level: 31, hexCount: 7, minWordLength: 5, targetScore: 2000000 },
];
