export interface CampaignLevel {
  level: number;
  hexCount: number;
  targetScore: number;
}

export const CAMPAIGN_LEVELS: CampaignLevel[] = [
  // 3 hexagons — levels 1-5
  { level: 1,  hexCount: 3,  targetScore: 500 },
  { level: 2,  hexCount: 3,  targetScore: 1000 },
  { level: 3,  hexCount: 3,  targetScore: 1800 },
  { level: 4,  hexCount: 3,  targetScore: 3000 },
  { level: 5,  hexCount: 3,  targetScore: 5000 },

  // 4 hexagons — levels 6-10
  { level: 6,  hexCount: 4,  targetScore: 3000 },
  { level: 7,  hexCount: 4,  targetScore: 5000 },
  { level: 8,  hexCount: 4,  targetScore: 8000 },
  { level: 9,  hexCount: 4,  targetScore: 12000 },
  { level: 10, hexCount: 4,  targetScore: 18000 },

  // 5 hexagons — levels 11-17
  { level: 11, hexCount: 5,  targetScore: 8000 },
  { level: 12, hexCount: 5,  targetScore: 13000 },
  { level: 13, hexCount: 5,  targetScore: 20000 },
  { level: 14, hexCount: 5,  targetScore: 30000 },
  { level: 15, hexCount: 5,  targetScore: 45000 },
  { level: 16, hexCount: 5,  targetScore: 65000 },
  { level: 17, hexCount: 5,  targetScore: 90000 },

  // 7 hexagons — levels 18-25
  { level: 18, hexCount: 7,  targetScore: 40000 },
  { level: 19, hexCount: 7,  targetScore: 60000 },
  { level: 20, hexCount: 7,  targetScore: 85000 },
  { level: 21, hexCount: 7,  targetScore: 120000 },
  { level: 22, hexCount: 7,  targetScore: 170000 },
  { level: 23, hexCount: 7,  targetScore: 230000 },
  { level: 24, hexCount: 7,  targetScore: 310000 },
  { level: 25, hexCount: 7,  targetScore: 420000 },

  // 7 hexagons endgame — levels 26-31
  { level: 26, hexCount: 7,  targetScore: 550000 },
  { level: 27, hexCount: 7,  targetScore: 720000 },
  { level: 28, hexCount: 7,  targetScore: 950000 },
  { level: 29, hexCount: 7,  targetScore: 1250000 },
  { level: 30, hexCount: 7,  targetScore: 1650000 },
  { level: 31, hexCount: 7,  targetScore: 2200000 },
];
