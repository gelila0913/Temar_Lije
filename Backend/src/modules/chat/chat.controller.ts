import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Req,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
const { OptionalJwtAuthGuard } = require('../../common/guards/JwtAuthGuard');

const MAX_UPLOAD_SIZE = 20 * 1024 * 1024; // 20 MB

const ALLOWED_MIME_TYPES = new Set([
  // images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  // audio (incl. MediaRecorder voice notes)
  'audio/webm',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
  // video
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  // documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/rtf',
  'text/plain',
  // archives
  'application/zip',
  'application/x-rar-compressed',
  'application/x-tar',
  'application/gzip',
  'application/x-7z-compressed',
]);

const uploadStorage = diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = join(process.cwd(), 'uploads');
    if (!existsSync(uploadPath)) {
      mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    let ext = extname(file.originalname || '');
    if (!ext && file.mimetype) {
      if (file.mimetype.includes('mp4') || file.mimetype.includes('aac')) ext = '.mp4';
      else if (file.mimetype.includes('ogg')) ext = '.ogg';
      else if (file.mimetype.includes('wav')) ext = '.wav';
      else if (file.mimetype.includes('audio') || file.mimetype.includes('webm')) ext = '.webm';
      else if (file.mimetype.includes('png')) ext = '.png';
      else if (file.mimetype.includes('jpeg') || file.mimetype.includes('jpg')) ext = '.jpg';
      else if (file.mimetype.includes('pdf')) ext = '.pdf';
    }
    cb(null, `${uniqueSuffix}${ext || '.webm'}`);
  },
});

@Controller('chat')
@UseGuards(OptionalJwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: uploadStorage,
    limits: { fileSize: MAX_UPLOAD_SIZE, files: 1 },
    fileFilter: (req, file, cb) => {
      if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
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
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const fileUrl = `${baseUrl}/uploads/${file.filename}`;
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
    const group = await this.chatService.createGroup(
      createGroupDto.name,
      createGroupDto.description,
      createGroupDto.icon,
      createGroupDto.color,
      createGroupDto.memberIds || [],
      createGroupDto.id,
      req.user?.id,
      createGroupDto.classroomId,
    );
    this.chatGateway.server.emit('groupCreated', group);
    return group;
  }

  @Get('groups')
  async getGroups(@Req() req: any, @Query('classroomId') classroomId?: string) {
    return this.chatService.getGroups(req.user?.id, classroomId);
  }

  @Get('history/:groupId')
  async getChatHistory(@Param('groupId') groupId: string, @Req() req: any) {
    return this.chatService.getChatHistory(groupId, req.user?.id);
  }

  @Put('messages/:id/pin')
  async togglePinMessage(
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const updated = await this.chatService.togglePinMessage(id, body.isPinned);
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
  ) {
    await this.chatService.deleteMessage(id);
    if (body?.roomId) {
      this.chatGateway.server.to(body.roomId).emit('messageDeleted', { messageId: id });
    }
    return { success: true };
  }

  @Put('messages/:id')
  async editMessage(
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const updated = await this.chatService.editMessage(id, body.text);
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
    const reactions = await this.chatService.toggleReaction(
      id,
      req.user?.id,
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

  @Put('groups/:groupId/members/:userId/role')
  async updateMemberRole(
    @Param('groupId') groupId: string,
    @Param('userId') userId: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const updated = await this.chatService.updateMemberRole(
      groupId,
      userId,
      body.role,
      req.user?.id,
    );
    this.chatGateway.server.emit('roleUpdated', {
      groupId,
      userId,
      role: body.role,
    });
    return updated;
  }

  @Delete('groups/:id')
  async deleteGroup(@Param('id') id: string, @Req() req: any) {
    const deleted = await this.chatService.deleteGroup(id, req.user?.id);
    this.chatGateway.broadcastGroupDeleted(id);
    return deleted;
  }

  @Delete('groups/:groupId/members/:userId')
  async removeMember(
    @Param('groupId') groupId: string,
    @Param('userId') userId: string,
    @Req() req: any,
  ) {
    const deleted = await this.chatService.removeMember(
      groupId,
      userId,
      req.user?.id,
    );
    this.chatGateway.server.emit('memberRemoved', { groupId, userId });
    return deleted;
  }
}

