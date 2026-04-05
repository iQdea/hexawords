import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database';
import { GameModule } from './modules/game/game.module';
import { DictionaryModule } from './modules/dictionary/dictionary.module';
import { SocketModule } from './modules/socket/socket.module';
import { AuthModule } from './modules/auth/auth.module';
import { LeaderboardModule } from './modules/leaderboard/leaderboard.module';
import { UserModule } from './modules/user/user.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    DictionaryModule,
    GameModule,
    LeaderboardModule,
    UserModule,
    SocketModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
