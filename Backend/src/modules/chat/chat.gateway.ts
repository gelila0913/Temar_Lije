import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ChatService } from './chat.service';
import { createSocketAuthMiddleware } from '../../common/socket-auth';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway {
  @WebSocketServer()
  server: Server;

  // Track active user IDs and their last seen timestamp
  public static onlineUsers = new Map<string, number>();

  public static getOnlineUserIds(): string[] {
    const now = Date.now();
    const activeThreshold = 25000; // active in last 25 seconds
    const list: string[] = [];
    for (const [userId, lastSeen] of ChatGateway.onlineUsers.entries()) {
      if (now - lastSeen <= activeThreshold) {
        list.push(userId);
      } else {
        ChatGateway.onlineUsers.delete(userId);
      }
    }
    return list;
  }

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    // Broadcast presence update every 5 seconds
    setInterval(() => {
      if (this.server) {
        const online = ChatGateway.getOnlineUserIds();
        this.server.emit('presenceUpdate', { onlineUserIds: online });
      }
    }, 5000);
  }

  afterInit(server: Server) {
    server.use(createSocketAuthMiddleware(this.jwtService, this.configService));
  }

  private _userId(client: Socket): string | undefined {
    return (client.data?.user as any)?.sub || (client.handshake?.auth as any)?.userId;
  }

  private _recordPresence(userId?: string) {
    if (userId) {
      ChatGateway.onlineUsers.set(userId, Date.now());
    }
  }

  handleConnection(client: Socket) {
    const userId = this._userId(client);
    if (userId) {
      this._recordPresence(userId);
      if (this.server) {
        this.server.emit('presenceUpdate', { onlineUserIds: ChatGateway.getOnlineUserIds() });
      }
    }

    client.on('disconnecting', () => {
      for (const room of client.rooms) {
        if (room === client.id) continue;
        this.server
          .to(room)
          .emit('voiceChatUserLeft', { groupId: room, userId });
      }
    });
  }

  handleDisconnect(client: Socket) {
    const userId = this._userId(client);
    if (userId) {
      ChatGateway.onlineUsers.delete(userId);
      if (this.server) {
        this.server.emit('presenceUpdate', { onlineUserIds: ChatGateway.getOnlineUserIds() });
      }
    }
  }

  @SubscribeMessage('heartbeat')
  handleHeartbeat(@ConnectedSocket() client: Socket, @MessageBody() data: any) {
    const userId = this._userId(client) || data?.userId;
    if (userId) {
      this._recordPresence(userId);
    }
    return { status: 'ok', time: Date.now() };
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    const { roomId } = data || {};
    if (!roomId) return;

    const userId = this._userId(client);
    if (userId) {
      await this.chatService.ensureUserExists(userId);
      const isAllowed = await this.chatService.canUserAccessRoom(roomId, userId);
      if (!isAllowed) {
        client.emit('chatError', { message: 'Access denied: You are not a member of this study group.' });
        return;
      }
    }

    client.join(roomId);
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    const { roomId } = data || {};
    if (roomId) {
      client.leave(roomId);
    }
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    const { roomId } = data;
    const senderId = this._userId(client) || data.senderId || data.userId;
    if (!roomId || !senderId) return;

    try {
      const isAllowed = await this.chatService.canUserAccessRoom(roomId, senderId);
      if (!isAllowed) {
        client.emit('chatError', { message: 'Access denied: You are not a member of this study group.' });
        return;
      }

      const savedMsg = await this.chatService.saveMessage(roomId, senderId, {
        text: data.text,
        image: data.image,
        type: data.type,
        fileName: data.fileName,
        fileSize: data.fileSize,
        fileIcon: data.fileIcon,
        replyToId: data.replyToId,
        forwardedFrom: data.forwardedFrom,
      });

      if (savedMsg) {
        const payload = {
          ...savedMsg,
          groupId: savedMsg.groupId || roomId,
          topicId: savedMsg.topicId || 'general',
          roomId: savedMsg.roomId || roomId,
          _optimisticId: data._optimisticId,
        };
        // Emit strictly to the specific room subscribers
        this.server.to(roomId).emit('newMessage', payload);
        if (savedMsg.roomId && savedMsg.roomId !== roomId) {
          this.server.to(savedMsg.roomId).emit('newMessage', payload);
        }
      }
    } catch (err: any) {
      console.warn(`sendMessage failed in ${roomId}:`, err?.message);
      const error = { message: err?.message || 'Failed to send message' };
      client.emit('chatError', error);
      this.server.to(roomId).emit('chatError', error);
    }
  }

  @SubscribeMessage('deleteMessage')
  async handleDeleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    const { messageId, roomId } = data;
    if (!messageId) return;

    try {
      await this.chatService.deleteMessage(messageId);
      if (roomId) {
        this.server.to(roomId).emit('messageDeleted', { messageId });
      }
    } catch (err: any) {
      console.warn(`deleteMessage failed:`, err?.message);
      client.emit('chatError', {
        message: err?.message || 'Failed to delete message',
      });
    }
  }

  @SubscribeMessage('editMessage')
  async handleEditMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    const { messageId, text, roomId } = data;
    if (!messageId || text === undefined) return;

    try {
      const updated = await this.chatService.editMessage(messageId, text);
      if (updated && roomId) {
        this.server.to(roomId).emit('messageUpdated', { messageId, text });
      }
    } catch (err: any) {
      console.warn(`editMessage failed:`, err?.message);
      client.emit('chatError', {
        message: err?.message || 'Failed to edit message',
      });
    }
  }

  @SubscribeMessage('toggleReaction')
  async handleToggleReaction(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    const { messageId, emoji, roomId } = data;
    const userId = this._userId(client);
    if (!messageId || !emoji || !userId) return;

    const reactions = await this.chatService.toggleReaction(messageId, userId, emoji);
    if (roomId) {
      this.server.to(roomId).emit('reactionToggled', { messageId, reactions });
    }
  }

  @SubscribeMessage('studyInvitation')
  async handleStudyInvitation(
    @MessageBody() data: any,
  ) {
    this.server.emit('studyInvitation', data);
  }

  @SubscribeMessage('teacherJoinedLive')
  handleTeacherJoinedLive(@MessageBody() data: any) {
    this.server.emit('liveClassStarted', data);
    return { status: 'broadcasted' };
  }

  @SubscribeMessage('teacherEndedLive')
  handleTeacherEndedLive(@MessageBody() data: any) {
    this.server.emit('liveClassEnded', data);
    return { status: 'broadcasted' };
  }

  @SubscribeMessage('deleteGroup')
  async handleDeleteGroup(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    const { groupId } = data;
    if (!groupId) return;

    try {
      await this.chatService.deleteGroup(groupId, this._userId(client));
      this.server.emit('groupDeleted', { groupId });
    } catch (err) {
      console.error(`Failed to delete group ${groupId}:`, err);
    }
  }

  @SubscribeMessage('joinVoiceChat')
  async handleJoinVoiceChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    if (!data?.groupId) return;
    const userId = this._userId(client);
    const payload = { ...data, userId: userId || data.userId };

    // Only join the voice-specific room if not already in it
    if (!client.rooms.has(data.groupId)) {
      client.join(data.groupId);
    }
    this.server.to(data.groupId).emit('voiceChatUserJoined', payload);
  }

  @SubscribeMessage('leaveVoiceChat')
  async handleLeaveVoiceChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    if (!data?.groupId) return;
    const userId = this._userId(client);
    this.server
      .to(data.groupId)
      .emit('voiceChatUserLeft', { ...data, userId: userId || data.userId });
    client.leave(data.groupId);
  }

  @SubscribeMessage('toggleMuteVoice')
  async handleToggleMuteVoice(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    if (!data?.groupId) return;
    const userId = this._userId(client);
    this.server
      .to(data.groupId)
      .emit('voiceChatUserMuteToggled', { ...data, userId: userId || data.userId });
  }

  broadcastGroupDeleted(groupId: string) {
    this.server.emit('groupDeleted', { groupId });
  }
}