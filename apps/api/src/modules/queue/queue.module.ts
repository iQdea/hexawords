import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CellRespawnProcessor } from './cell-respawn.processor';
import { CellRespawnService } from './cell-respawn.service';
import { SocketModule } from '../socket/socket.module';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
      }),
    }),
    BullModule.registerQueue({ name: 'cell-respawn' }),
    SocketModule,
  ],
  providers: [CellRespawnProcessor, CellRespawnService],
  exports: [CellRespawnService],
})
export class QueueModule {}
