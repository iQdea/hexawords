import { Controller, Get, Header } from '@nestjs/common';
import { DictionaryService } from './dictionary.service';

@Controller('dictionary')
export class DictionaryController {
  constructor(private dictionary: DictionaryService) {}

  @Get('words')
  @Header('Cache-Control', 'public, max-age=86400')
  getWords(): string[] {
    return this.dictionary.words;
  }
}
