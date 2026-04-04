import { Module } from '@nestjs/common';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { DictionaryModule } from '../dictionary/dictionary.module';
import { SocketModule } from '../socket/socket.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [DictionaryModule, SocketModule, QueueModule],
  controllers: [GameController],
  providers: [GameService],
})
export class GameModule {}
