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
      console.log(`Dictionary already seeded (${count} words). Skipping.`);
      return;
    }

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
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
