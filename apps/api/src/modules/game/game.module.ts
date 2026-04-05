import { Module } from '@nestjs/common';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { DictionaryModule } from '../dictionary/dictionary.module';
import { SocketModule } from '../socket/socket.module';
import { QueueModule } from '../queue/queue.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DictionaryModule, SocketModule, QueueModule, AuthModule],
  controllers: [GameController],
  providers: [GameService],
})
export class GameModule {}
