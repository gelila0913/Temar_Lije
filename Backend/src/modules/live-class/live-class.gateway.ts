import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WsException,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createSocketAuthMiddleware } from '../../common/socket-auth';
import { AttendanceService } from '../attendance/attendance.service';

/**
 * Socket.io gateway handling offline/LAN fallback, low-bandwidth audio streaming,
 * real-time whiteboard vector stroke synchronization, and automated attendance tracking.
 */
@WebSocketGateway({
  namespace: 'live-class',
  cors: {
    origin: '*',
  },
})
export class LiveClassGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // In-memory buffer of vector strokes per classroom room to sync reconnected/new students
  private whiteboardHistory: Map<string, Array<any>> = new Map();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly attendanceService: AttendanceService,
  ) {}

  afterInit(server: Server) {
    server.use(createSocketAuthMiddleware(this.jwtService, this.configService));
  }

  @SubscribeMessage('teacherJoinedLive')
  handleTeacherJoinedLive(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ) {
    const { classId, className, teacherName } = data || {};
    this.server.emit('liveClassStarted', {
      classId,
      className: className || 'Live Classroom',
      teacherName: teacherName || 'Teacher',
      startedAt: Date.now(),
    });
    return { status: 'broadcasted' };
  }

  @SubscribeMessage('teacherEndedLive')
  handleTeacherEndedLive(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ) {
    const { classId } = data || {};
    this.server.emit('liveClassEnded', { classId });
    return { status: 'broadcasted' };
  }

  async handleDisconnect(client: Socket) {
    const { classId, userId } = client.data || {};
    if (classId && userId) {
      const record = await this.attendanceService.recordLeave(classId, userId);
      if (record) {
        this.server.to(classId).emit('attendanceUpdated', { classId, record });
      }
    }
  }

  /**
   * Handles explicit socket room joining for classroom channels & syncs stroke history & attendance.
   */
  @SubscribeMessage('joinRoom')
  @SubscribeMessage('joinLiveClassRoom')
  async handleJoinRoom(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    const classId = data?.classId || data?.roomId || (typeof data === 'string' ? data : null);
    const userId = data?.userId || client.data?.user?.id || (client.handshake?.query?.userId as string);

    if (classId && typeof classId === 'string') {
      client.join(classId);
      client.data = { ...client.data, classId, userId };

      // Automated attendance join tracking
      if (userId && typeof userId === 'string') {
        const record = await this.attendanceService.recordJoin(classId, userId);
        if (record) {
          this.server.to(classId).emit('attendanceUpdated', { classId, record });
        }
      }

      // Emit cached stroke vector history for this classroom to the joining student
      const history = this.whiteboardHistory.get(classId) || [];
      client.emit('syncWhiteboardHistory', { classId, strokes: history });

      return { status: 'joined', classId, strokeCount: history.length };
    }
  }

  /**
   * Receives vector stroke tuple/object and broadcasts 'receiveWhiteboardStroke'
   * to all other connected clients in the classroom room.
   */
  @SubscribeMessage('sendWhiteboardStroke')
  handleSendWhiteboardStroke(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ) {
    const { classId, stroke, x0, y0, x1, y1, color, lineWeight } = data || {};

    if (!classId) {
      throw new WsException(
        'classId is required to broadcast whiteboard stroke',
      );
    }

    // If stroke is an object payload (e.g. text vector)
    if (data?.type === 'text' || (stroke && typeof stroke === 'object' && !Array.isArray(stroke) && stroke.type === 'text')) {
      const textPayload = stroke || data;
      if (!this.whiteboardHistory.has(classId)) {
        this.whiteboardHistory.set(classId, []);
      }
      this.whiteboardHistory.get(classId)!.push(textPayload);

      client.to(classId).emit('receiveWhiteboardStroke', {
        classId,
        stroke: textPayload,
      });
      client.to(classId).emit('receiveWhiteboardText', {
        classId,
        ...textPayload,
      });
      return;
    }

    const strokePayload = stroke || [
      x0 ?? data?.prevX,
      y0 ?? data?.prevY,
      x1 ?? data?.x,
      y1 ?? data?.y,
      color || '#3b82f6',
      lineWeight || data?.lineWeight || 3,
    ];

    // Buffer stroke vector in room history (capped at 2000 strokes to limit RAM usage)
    if (!this.whiteboardHistory.has(classId)) {
      this.whiteboardHistory.set(classId, []);
    }
    const history = this.whiteboardHistory.get(classId)!;
    history.push(strokePayload);
    if (history.length > 2000) {
      history.shift();
    }

    // Broadcast receiveWhiteboardStroke to all other clients in classId room
    client.to(classId).emit('receiveWhiteboardStroke', {
      classId,
      stroke: strokePayload,
      x0: strokePayload[0],
      y0: strokePayload[1],
      x1: strokePayload[2],
      y1: strokePayload[3],
      color: strokePayload[4],
      lineWeight: strokePayload[5],
    });
  }

  /**
   * Receives real-time typed text vectors and broadcasts to all other participants.
   */
  @SubscribeMessage('sendWhiteboardText')
  handleSendWhiteboardText(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ) {
    const { classId, text, x, y, color, fontSize } = data || {};
    if (!classId || !text) return;

    const payload = {
      type: 'text',
      text,
      x,
      y,
      color: color || '#3b82f6',
      fontSize: fontSize || 20,
    };

    if (!this.whiteboardHistory.has(classId)) {
      this.whiteboardHistory.set(classId, []);
    }
    const history = this.whiteboardHistory.get(classId)!;
    history.push(payload);
    if (history.length > 2000) {
      history.shift();
    }

    client.to(classId).emit('receiveWhiteboardText', {
      classId,
      ...payload,
    });
    client.to(classId).emit('receiveWhiteboardStroke', {
      classId,
      stroke: payload,
    });
  }

  /**
   * Wipes whiteboard vector history for a classroom and notifies all participants.
   */
  @SubscribeMessage('clearWhiteboard')
  handleClearWhiteboard(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ) {
    const classId = data?.classId || data;
    if (classId) {
      this.whiteboardHistory.set(classId, []);
      client.to(classId).emit('receiveClearWhiteboard', { classId });
      this.server.to(classId).emit('receiveClearWhiteboard', { classId });
    }
  }

  /**
   * Relays real-time low-bandwidth PCM/Opus audio stream chunks from teacher to students.
   */
  @SubscribeMessage('streamAudioChunk')
  handleStreamAudioChunk(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ) {
    const { classId, audioChunk, senderId } = data || {};
    if (classId && audioChunk) {
      client.to(classId).emit('receiveAudioChunk', {
        classId,
        audioChunk,
        senderId: senderId || client.id,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Heartbeat ping handler to measure socket latency.
   */
  @SubscribeMessage('ping')
  handlePing() {
    return { status: 'pong', timestamp: Date.now() };
  }
}

