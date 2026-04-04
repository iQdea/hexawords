import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: true },
  transports: ['websocket'],
})
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(SocketGateway.name);

  handleConnection(client: Socket) {
    // Temporary: use handshake query userId until JWT auth is implemented
    const userId = client.handshake.query['userId'] as string;
    if (userId) {
      client.join(`user:${userId}`);
      this.logger.log(`Client ${client.id} joined room user:${userId}`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client ${client.id} disconnected`);
  }

  @SubscribeMessage('game:join')
  handleJoinGame(client: Socket, data: { gameId: string }) {
    client.join(`game:${data.gameId}`);
    this.logger.log(`Client ${client.id} joined game room game:${data.gameId}`);
  }
}
