import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EventsService } from './events.service';

interface JoinProjectPayload {
  projectId: string;
  token: string;
}

@WebSocketGateway({
  namespace: '/ws',
  cors: { origin: '*', credentials: true },
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private eventsService: EventsService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  afterInit(server: Server) {
    this.eventsService.setServer(server);
  }

  handleConnection(client: Socket) {
    console.log(`WS client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`WS client disconnected: ${client.id}`);
  }

  /**
   * Client emits 'join:project' with their JWT and the projectId they want to watch.
   * Server validates the token, then adds the socket to the project room.
   *
   * Client example:
   *   socket.emit('join:project', { projectId: 'abc', token: 'Bearer eyJ...' })
   */
  @SubscribeMessage('join:project')
  async handleJoinProject(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinProjectPayload,
  ) {
    try {
      const raw = payload.token?.replace('Bearer ', '');
      this.jwtService.verify(raw, {
        secret: this.config.get('JWT_SECRET'),
      });
      await client.join(`project:${payload.projectId}`);
      client.emit('joined', { projectId: payload.projectId });
    } catch {
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect();
    }
  }

  /** Client can leave a project room */
  @SubscribeMessage('leave:project')
  async handleLeaveProject(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { projectId: string },
  ) {
    await client.leave(`project:${payload.projectId}`);
    client.emit('left', { projectId: payload.projectId });
  }
}
