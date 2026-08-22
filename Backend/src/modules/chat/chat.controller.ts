import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { JwtAuthGuard } from '../../common/guards/JwtAuthGuard';

const ALLOWED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.txt', '.zip', '.tar', '.gz',
  '.mp3', '.wav', '.ogg', '.m4a', '.webm', '.mp4',
]);

const ALLOWED_MIME_PREFIXES = [
  'image/', 'audio/', 'video/', 'text/',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument',
  'application/vnd.ms-excel', 'application/vnd.ms-powerpoint',
  'application/zip', 'application/x-zip-compressed',
  'application/octet-stream',
];

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const ext = extname(file.originalname).toLowerCase();
        cb(null, `${uniqueSuffix}${ext}`);
      },
    }),
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
    fileFilter: (req, file, cb) => {
      const ext = extname(file.originalname).toLowerCase();
      if (ALLOWED_EXTENSIONS.has(ext)) {
        return cb(null, true);
      }
      const mime = (file.mimetype || '').toLowerCase();
      if (ALLOWED_MIME_PREFIXES.some((p) => mime.startsWith(p))) {
        return cb(null, true);
      }
      cb(
        new BadRequestException(
          `File type "${file.mimetype || 'unknown'}" is not allowed`,
        ),
        false,
      );
    },
  }))
  async uploadFile(@UploadedFile() file: any, @Req() req: any) {
    if (!file) {
      return { error: 'No file uploaded' };
    }
    const fileUrl = `/uploads/${file.filename}`;
    return {
      url: fileUrl,
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
    };
  }

  @Post('groups')
  async createGroup(@Body() createGroupDto: any, @Req() req: any) {
    const actorId = req.user?.id || req.user?.sub || createGroupDto.creatorId;
    const group = await this.chatService.createGroup(
      createGroupDto.name,
      createGroupDto.description,
      createGroupDto.icon,
      createGroupDto.color,
      createGroupDto.memberIds || [],
      createGroupDto.id,
      actorId,
      createGroupDto.classroomId,
      createGroupDto.isTopic,
      createGroupDto.parentGroupId,
      createGroupDto.topicId,
    );
    this.chatGateway.server.emit('groupCreated', group);
    return group;
  }

  @Get('groups')
  async getGroups(@Req() req: any, @Query('classroomId') classroomId?: string) {
    const actorId = req.user?.id || req.user?.sub;
    return this.chatService.getGroups(actorId, classroomId);
  }

  @Put('groups/:id')
  async updateGroup(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const actorId = req.user?.id || req.user?.sub;
    const updated = await this.chatService.updateGroup(
      id,
      {
        name: body.name,
        description: body.description,
        icon: body.icon,
        color: body.color,
      },
      actorId,
    );
    this.chatGateway.server.emit('groupUpdated', { groupId: id, ...updated });
    return updated;
  }

  @Delete('groups/:id')
  async deleteGroup(@Param('id') id: string, @Req() req: any) {
    const actorId = req.user?.id || req.user?.sub;
    const deleted = await this.chatService.deleteGroup(id, actorId);
    this.chatGateway.broadcastGroupDeleted(id);
    return deleted;
  }

  /**
   * POST /chat/groups/:id/topics
   * Create a permanent topic inside a group
   */
  @Post('groups/:id/topics')
  async createTopic(
    @Param('id') groupId: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const actorId = req.user?.id || req.user?.sub;
    if (!body?.name || !body.name.trim()) {
      throw new BadRequestException('Topic name is required');
    }
    const topic = await this.chatService.createTopic(
      groupId,
      body.name,
      body.icon,
      body.color,
      actorId,
      body.topicId,
    );
    this.chatGateway.server.emit('topicCreated', { groupId, topic });
    return topic;
  }

  /**
   * DELETE /chat/groups/:id/topics/:topicId
   * Delete a topic from a group
   */
  @Delete('groups/:id/topics/:topicId')
  async deleteTopic(
    @Param('id') groupId: string,
    @Param('topicId') topicId: string,
    @Req() req: any,
  ) {
    const actorId = req.user?.id || req.user?.sub;
    const result = await this.chatService.deleteTopic(groupId, topicId, actorId);
    this.chatGateway.server.emit('topicDeleted', { groupId, topicId });
    return result;
  }

  /**
   * POST /chat/groups/:id/members
   * Add members to group
   */
  @Post('groups/:id/members')
  async addMembers(
    @Param('id') groupId: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const actorId = req.user?.id || req.user?.sub;
    const userIds = Array.isArray(body.userIds) ? body.userIds : [body.userId].filter(Boolean);
    const members = await this.chatService.addMembers(groupId, userIds, actorId);
    this.chatGateway.server.emit('membersAdded', { groupId, members });
    return members;
  }

  /**
   * DELETE /chat/groups/:groupId/members/:userId
   * Remove a member from the group
   */
  @Delete('groups/:groupId/members/:userId')
  async removeMember(
    @Param('groupId') groupId: string,
    @Param('userId') userId: string,
    @Req() req: any,
  ) {
    const actorId = req.user?.id || req.user?.sub;
    const deleted = await this.chatService.removeMember(
      groupId,
      userId,
      actorId,
    );
    this.chatGateway.server.emit('memberRemoved', { groupId, userId });
    return deleted;
  }

  /**
   * PUT /chat/groups/:groupId/members/:userId/role
   * Promote to Admin or Demote to Member with custom permissions
   */
  @Put('groups/:groupId/members/:userId/role')
  async updateMemberRole(
    @Param('groupId') groupId: string,
    @Param('userId') userId: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const actorId = req.user?.id || req.user?.sub;
    const updated = await this.chatService.updateMemberRole(
      groupId,
      userId,
      body.role || 'MEMBER',
      body.permissions,
      actorId,
    );
    this.chatGateway.server.emit('roleUpdated', {
      groupId,
      userId,
      role: body.role,
      permissions: updated.permissions,
    });
    return updated;
  }

  @Get('history/:groupId')
  async getChatHistory(@Param('groupId') groupId: string, @Req() req: any) {
    const actorId = req.user?.id || req.user?.sub;
    return this.chatService.getChatHistory(groupId, actorId);
  }

  @Put('messages/:id/pin')
  async togglePinMessage(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const actorId = req.user?.id || req.user?.sub;
    const updated = await this.chatService.togglePinMessage(id, body.isPinned, actorId, body.groupId);
    this.chatGateway.server.emit('messagePinned', {
      messageId: id,
      isPinned: body.isPinned,
      message: updated,
    });
    return updated;
  }

  @Delete('messages/:id')
  async deleteMessage(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const actorId = req.user?.id || req.user?.sub;
    await this.chatService.deleteMessage(id, actorId, body?.groupId);
    if (body?.roomId) {
      this.chatGateway.server.to(body.roomId).emit('messageDeleted', { messageId: id });
    }
    return { success: true };
  }

  @Put('messages/:id')
  async editMessage(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const actorId = req.user?.id || req.user?.sub;
    const updated = await this.chatService.editMessage(id, body.text, actorId);
    if (body?.roomId) {
      this.chatGateway.server.to(body.roomId).emit('messageUpdated', {
        messageId: id,
        text: body.text,
      });
    }
    return updated;
  }

  @Post('messages/:id/reactions')
  async toggleReaction(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    if (!body?.emoji) {
      throw new BadRequestException('emoji is required');
    }
    const actorId = req.user?.id || req.user?.sub;
    const reactions = await this.chatService.toggleReaction(
      id,
      actorId,
      body.emoji,
    );
    if (body?.roomId) {
      this.chatGateway.server.to(body.roomId).emit('reactionToggled', {
        messageId: id,
        reactions,
      });
    }
    return reactions;
  }
}
