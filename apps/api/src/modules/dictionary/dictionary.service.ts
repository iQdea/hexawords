import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../database';

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

  constructor(@Inject(PG_POOL) private pool: Pool) {}

  async onModuleInit() {
    const { rows } = await this.pool.query<{ word: string }>(
      'SELECT word FROM words WHERE len >= 2',
    );
    for (const { word } of rows) {
      this.wordSet.add(word);
    }
    this.logger.log(`Loaded ${this.wordSet.size} words into memory`);
  }

  async isValidWord(word: string): Promise<boolean> {
    if (word.length < 2) return false;
    const lower = word.toLowerCase();

    if (this.wordSet.has(lower)) return true;
    if (this.isBlocked(lower)) return false;

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

  get words(): string[] {
    return [...this.wordSet];
  }

  async getFreq(word: string): Promise<number> {
    const { rows } = await this.pool.query<{ freq: number }>(
      'SELECT freq FROM words WHERE word = $1',
      [word.toLowerCase()],
    );
    return rows[0]?.freq ?? 0;
  }

  async incrementFreq(word: string): Promise<void> {
    try {
      await this.pool.query(
        'UPDATE words SET freq = freq + 1 WHERE word = $1',
        [word.toLowerCase()],
      );
    } catch {
      // Word might not exist yet
    }
  }

  private isBlocked(word: string): boolean {
    return BLOCKED_STEMS.some(stem => word.includes(stem));
  }

  private async checkWiktionary(word: string): Promise<boolean> {
    try {
      const url = `https://ru.wiktionary.org/w/api.php?action=query&titles=${encodeURIComponent(word)}&format=json&formatversion=2`;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(3000),
        headers: { 'User-Agent': 'HexawordsBot/1.0 (word-game; dictionary-check)' },
      });
      if (!response.ok) return false;
      const data = await response.json();
      const pages = data?.query?.pages;
      if (!pages || !Array.isArray(pages) || pages.length === 0) return false;
      return !pages[0].missing;
    } catch (err) {
      this.logger.warn(`Wiktionary check failed for "${word}": ${err}`);
      return false;
    }
  }

  private async addWord(word: string): Promise<void> {
    try {
      await this.pool.query(
        'INSERT INTO words (word, freq, len) VALUES ($1, 0, $2) ON CONFLICT DO NOTHING',
        [word, word.length],
      );
      this.wordSet.add(word);
      this.logger.log(`Added new word from Wiktionary: "${word}"`);
    } catch {
      this.wordSet.add(word);
    }
  }
}
