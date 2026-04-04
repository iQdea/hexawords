export interface WordValidator {
  isValid(word: string): boolean | Promise<boolean>;
  getFreq(word: string): number | Promise<number>;
}

export interface LetterGenerator {
  generate(): { char: string; points: number };
}
