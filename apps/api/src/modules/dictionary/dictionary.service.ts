import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// Common Russian profanity stems to block
const BLOCKED_STEMS = [
  'хуй', 'хуе', 'хуя', 'хуё', 'пизд', 'блят', 'блял', 'бляд',
  'ебат', 'ебал', 'ебан', 'ебну', 'ебёт', 'ебут', 'ёбан',
  'сука', 'суки', 'суче', 'пидор', 'пидар', 'мудак', 'мудач',
  'залуп', 'шлюх', 'дроч', 'гандон', 'манда', 'жоп', 'срак',
  'говн', 'дерьм', 'засран', 'сраны', 'сраль',
];

@Injectable()
export class DictionaryService implements OnModuleInit {
  private readonly logger = new Logger(DictionaryService.name);
  private wordSet = new Set<string>();

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    const words = await this.prisma.word.findMany({
      where: { len: { gte: 3 } },
      select: { word: true },
    });

    for (const { word } of words) {
      this.wordSet.add(word);
    }

    this.logger.log(`Loaded ${this.wordSet.size} words into memory`);
  }

  /** Check local dictionary first, then try Wiktionary if not found. */
  async isValidWord(word: string): Promise<boolean> {
    if (word.length < 3) return false;
    const lower = word.toLowerCase();

    // 1. Check local dictionary
    if (this.wordSet.has(lower)) return true;

    // 2. Check profanity
    if (this.isBlocked(lower)) return false;

    // 3. Try Wiktionary
    const existsInWiki = await this.checkWiktionary(lower);
    if (existsInWiki) {
      await this.addWord(lower);
      return true;
    }

    return false;
  }

  get wordCount(): number {
    return this.wordSet.size;
  }

  /** Get the discovery frequency of a word (how many times players found it). */
  async getFreq(word: string): Promise<number> {
    const entry = await this.prisma.word.findUnique({
      where: { word: word.toLowerCase() },
      select: { freq: true },
    });
    return entry?.freq ?? 0;
  }

  /** Increment frequency when a player finds a word. */
  async incrementFreq(word: string): Promise<void> {
    try {
      await this.prisma.word.update({
        where: { word: word.toLowerCase() },
        data: { freq: { increment: 1 } },
      });
    } catch {
      // Word might not exist yet
    }
  }

  private isBlocked(word: string): boolean {
    return BLOCKED_STEMS.some(stem => word.includes(stem));
  }

  /** Check if word exists in Russian Wiktionary. */
  private async checkWiktionary(word: string): Promise<boolean> {
    try {
      const url = `https://ru.wiktionary.org/w/api.php?action=query&titles=${encodeURIComponent(word)}&format=json&formatversion=2`;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(3000),
        headers: {
          'User-Agent': 'HexawordsBot/1.0 (word-game; dictionary-check)',
        },
      });

      if (!response.ok) return false;

      const data = await response.json();
      const pages = data?.query?.pages;
      if (!pages || !Array.isArray(pages) || pages.length === 0) return false;

      // If page exists (no "missing" flag) — word is real
      const page = pages[0];
      return !page.missing;
    } catch (err) {
      this.logger.warn(`Wiktionary check failed for "${word}": ${err}`);
      return false;
    }
  }

  /** Add newly discovered word to DB and in-memory set. */
  private async addWord(word: string): Promise<void> {
    try {
      await this.prisma.word.create({
        data: { word, freq: 0, len: word.length },
      });
      this.wordSet.add(word);
      this.logger.log(`Added new word from Wiktionary: "${word}"`);
    } catch {
      // Duplicate — already exists, just add to memory
      this.wordSet.add(word);
    }
  }
}
