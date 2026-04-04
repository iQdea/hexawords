import { Controller, Get } from '@nestjs/common';
import { DictionaryService } from './modules/dictionary/dictionary.service';

@Controller()
export class AppController {
  constructor(private dictionary: DictionaryService) {}

  @Get()
  health() {
    return {
      status: 'ok',
      dictionary: this.dictionary.wordCount,
    };
  }
}
