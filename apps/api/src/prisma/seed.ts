import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  const wordsPath = path.join(__dirname, 'seed', 'words.json');

  if (!fs.existsSync(wordsPath)) {
    console.error('words.json not found. Run download-dict.ts first.');
    process.exit(1);
  }

  const existing = await prisma.word.count();
  if (existing > 0) {
    console.log(`Dictionary already seeded (${existing} words). Skipping.`);
    return;
  }

  console.log('Loading words.json...');
  const words: Array<{ word: string; freq: number; len: number }> =
    JSON.parse(fs.readFileSync(wordsPath, 'utf-8'));

  console.log(`Seeding ${words.length} words...`);

  // Batch insert in chunks of 5000
  const BATCH_SIZE = 5000;
  for (let i = 0; i < words.length; i += BATCH_SIZE) {
    const batch = words.slice(i, i + BATCH_SIZE);
    await prisma.word.createMany({
      data: batch,
      skipDuplicates: true,
    });
    console.log(`  ${Math.min(i + BATCH_SIZE, words.length)} / ${words.length}`);
  }

  console.log('Dictionary seeded successfully!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
