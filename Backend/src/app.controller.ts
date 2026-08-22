import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
import { AppService } from './app.service';
import { DatabaseService } from './database/database.service';
import { ChatGateway } from './modules/chat/chat.gateway';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: DatabaseService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('users/presence')
  getOnlinePresence() {
    return {
      onlineUserIds: ChatGateway.getOnlineUserIds(),
      timestamp: Date.now(),
    };
  }

  @Post('users/heartbeat')
  recordHeartbeat(@Body('userId') userId: string) {
    if (userId) {
      ChatGateway.onlineUsers.set(userId, Date.now());
    }
    return {
      status: 'ok',
      onlineUserIds: ChatGateway.getOnlineUserIds(),
      timestamp: Date.now(),
    };
  }

  @Get('users/students')
  async getAllStudents() {
    return await this.prisma.user.findMany({
      where: { role: 'STUDENT' },
      select: {
        id: true,
        fullName: true,
        name: true,
        email: true,
        role: true,
        initials: true,
        avatarBg: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('classrooms/:classId/members')
  async getClassroomMembers(@Param('classId') classId: string) {
    try {
      // 1. Look for enrolled members in classroomMember
      const members = await this.prisma.classroomMember.findMany({
        where: { classroomId: classId },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              name: true,
              email: true,
              initials: true,
              avatarBg: true,
              role: true,
              createdAt: true,
            },
          },
        },
        orderBy: { joinedAt: 'desc' },
      });

      if (members && members.length > 0) {
        return members
          .filter((m) => (m.user.role || '').toUpperCase() !== 'TEACHER')
          .map((m) => ({
            id: m.user.id,
            name: m.user.fullName || m.user.name || m.user.email,
            email: m.user.email,
            initials: m.user.initials || 'U',
            joinedAt: m.joinedAt,
            role: m.user.role,
          }));
      }

      // 2. Fallback: Return all registered students from the real database
      const students = await this.prisma.user.findMany({
        where: { role: 'STUDENT' },
        select: {
          id: true,
          fullName: true,
          name: true,
          email: true,
          initials: true,
          avatarBg: true,
          role: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return students.map((s) => ({
        id: s.id,
        name: s.fullName || s.name || s.email,
        email: s.email,
        initials: s.initials || (s.fullName ? s.fullName.slice(0, 2).toUpperCase() : 'ST'),
        joinedAt: s.createdAt,
        role: s.role,
      }));
    } catch (err) {
      return [];
    }
  }

  @Post('classrooms/:classId/members')
  async addClassroomMember(
    @Param('classId') classId: string,
    @Body('userId') userId: string,
  ) {
    if (!userId) return { success: false };
    return await this.prisma.classroomMember.upsert({
      where: {
        classroomId_userId: { classroomId: classId, userId },
      },
      create: { classroomId: classId, userId },
      update: {},
    });
  }

  @Delete('classrooms/:classId/members/:memberId')
  async removeClassroomMember(
    @Param('classId') classId: string,
    @Param('memberId') memberId: string,
  ) {
    await this.prisma.classroomMember.deleteMany({
      where: { classroomId: classId, userId: memberId },
    });
    return { success: true };
  }
}
