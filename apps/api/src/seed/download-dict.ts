/**
 * Downloads the Russian dictionary from the old hexawords-ts repo
 * and converts it to a JSON file for seeding.
 *
 * Usage: npx ts-node src/seed/download-dict.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

const DICT_URL =
  'https://raw.githubusercontent.com/iQdea/hexawords-ts/master/src/modules/dict/data/dict.ts';

const OUTPUT_PATH = path.join(__dirname, 'words.json');

function fetch(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  console.log('Downloading dictionary...');
  const raw = await fetch(DICT_URL);

  console.log('Parsing...');
  // Extract array content between [ and ]
  const match = raw.match(/\[\s*\n([\s\S]*)\n\s*\]/);
  if (!match) throw new Error('Could not find array in dict.ts');

  const words: Array<{ word: string; freq: number; len: number }> = [];

  // Parse each line like: ['год','3200'],
  const lineRegex = /\['([^']+)','([^']*)'\]/g;
  let m: RegExpExecArray | null;
  while ((m = lineRegex.exec(match[1])) !== null) {
    const word = m[1].toLowerCase();
    const freq = Math.round(parseFloat(m[2]) * 10000) || 0;

    // Skip words shorter than 3 chars (our game minimum)
    if (word.length < 3) continue;
    // Skip words longer than 30 chars
    if (word.length > 30) continue;
    // Only Russian letters
    if (!/^[а-яё]+$/.test(word)) continue;

    words.push({ word, freq, len: word.length });
  }

  console.log(`Parsed ${words.length} valid words`);

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(words));
  console.log(`Written to ${OUTPUT_PATH}`);
}

main().catch(console.error);
