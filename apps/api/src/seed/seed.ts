import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const wordsPath = path.join(__dirname, 'words.json');

    if (!fs.existsSync(wordsPath)) {
      console.error('words.json not found. Run download-dict.ts first.');
      process.exit(1);
    }

    const { rows: [{ count }] } = await pool.query<{ count: string }>('SELECT COUNT(*) as count FROM words');
    if (Number(count) > 0) {
      console.log(`Dictionary already seeded (${count} words). Skipping words.`);
    } else {
    console.log('Loading words.json...');
    const words: Array<{ word: string; freq: number; len: number }> =
      JSON.parse(fs.readFileSync(wordsPath, 'utf-8'));

    console.log(`Seeding ${words.length} words...`);

    const BATCH_SIZE = 5000;
    for (let i = 0; i < words.length; i += BATCH_SIZE) {
      const batch = words.slice(i, i + BATCH_SIZE);
      const values: (string | number)[] = [];
      const placeholders: string[] = [];
      let idx = 1;
      for (const w of batch) {
        placeholders.push(`($${idx}, $${idx + 1}, $${idx + 2})`);
        values.push(w.word, w.freq, w.len);
        idx += 3;
      }
      await pool.query(
        `INSERT INTO words (word, freq, len) VALUES ${placeholders.join(', ')} ON CONFLICT DO NOTHING`,
        values,
      );
      console.log(`  ${Math.min(i + BATCH_SIZE, words.length)} / ${words.length}`);
    }

    console.log('Dictionary seeded successfully!');
    }

    // Seed campaign levels
    const { rows: [{ count: levelCount }] } = await pool.query<{ count: string }>('SELECT COUNT(*) as count FROM campaign_levels');
    if (Number(levelCount) === 0) {
      console.log('Seeding campaign levels...');
      // [level, hex_count, min_word_length, target_score, color_mode, locked_ratio]
      const levels: [number, number, number, number, boolean, number][] = [
        [1,3,2,300,false,0],[2,3,2,600,false,0],[3,3,2,1000,false,0],[4,3,2,1800,false,0],[5,3,2,3000,false,0],
        [6,4,3,2000,false,0],[7,4,3,4000,false,0],[8,4,3,7000,false,0],[9,4,3,11000,false,0],[10,4,3,16000,false,0],
        [11,5,3,8000,false,0.2],[12,5,3,14000,false,0.2],[13,5,3,22000,false,0.25],[14,5,3,35000,false,0.25],[15,5,3,50000,false,0.3],
        [16,5,4,30000,true,0.2],[17,5,4,50000,true,0.25],[18,5,4,75000,true,0.25],[19,5,4,110000,true,0.3],[20,5,4,160000,true,0.3],
        [21,7,4,80000,true,0.2],[22,7,4,130000,true,0.25],[23,7,4,200000,true,0.25],[24,7,4,300000,true,0.3],[25,7,4,420000,true,0.3],
        [26,7,5,250000,true,0.3],[27,7,5,400000,true,0.3],[28,7,5,600000,true,0.35],[29,7,5,900000,true,0.35],[30,7,5,1300000,true,0.4],[31,7,5,2000000,true,0.4],
      ];
      const vals: (number | boolean)[] = [];
      const ph: string[] = [];
      let i = 1;
      for (const [lv, hc, mw, ts, cm, lr] of levels) {
        ph.push(`($${i},$${i+1},$${i+2},$${i+3},$${i+4},$${i+5})`);
        vals.push(lv, hc, mw, ts, cm, lr);
        i += 6;
      }
      await pool.query(`INSERT INTO campaign_levels (level, hex_count, min_word_length, target_score, color_mode, locked_ratio) VALUES ${ph.join(',')} ON CONFLICT DO NOTHING`, vals);
      console.log(`Seeded ${levels.length} campaign levels.`);
    } else {
      console.log(`Campaign levels already seeded (${levelCount}). Skipping.`);
    }
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
