import { Injectable } from '@nestjs/common';
import { SocketGateway } from './socket.gateway';

@Injectable()
export class SocketService {
  constructor(private gateway: SocketGateway) {}

  sendToUser(userId: string, event: string, data: unknown) {
    this.gateway.server.to(`user:${userId}`).emit(event, data);
  }

  sendToGame(gameId: string, event: string, data: unknown) {
    this.gateway.server.to(`game:${gameId}`).emit(event, data);
  }
}
