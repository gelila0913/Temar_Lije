import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

function isValidUUID(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id.trim());
}

function toUuid(id: string): string {
  if (!id) return '00000000-0000-4000-8000-000000000000';
  if (isValidUUID(id)) return id;
  let hex = '';
  for (let i = 0; i < id.length; i++) {
    hex += id.charCodeAt(i).toString(16).padStart(2, '0');
  }
  hex = hex.padEnd(32, '0').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

@Injectable()
export class ClassroomsService {
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Helper to ensure user exists in DB for foreign key constraints.
   */
  private async ensureUserExists(userId: string, name?: string) {
    const validId = toUuid(userId);
    const existing = await this.databaseService.user.findUnique({
      where: { id: validId },
    });
    if (existing) return existing;

    const sanitized = userId.replace(/[^a-zA-Z0-9]/g, '') || 'user';
    try {
      return await this.databaseService.user.create({
        data: {
          id: validId,
          email: `${sanitized}@placeholder.com`,
          fullName: name || `Student ${userId.slice(0, 4)}`,
          initials: (name || userId).substring(0, 2).toUpperCase(),
          avatarBg: '#3b82f6',
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        const found = await this.databaseService.user.findUnique({ where: { id: validId } });
        if (found) return found;
      }
      throw err;
    }
  }

  /**
   * Get all members for a specific classroom (GET /classrooms/:classId/members)
   */
  async getClassroomMembers(classId: string) {
    const cleanClassId = String(classId || '').trim();
    let targetClassroom: any = null;

    if (isValidUUID(cleanClassId)) {
      try {
        targetClassroom = await this.databaseService.classroom.findUnique({
          where: { id: cleanClassId },
        });
      } catch (err) {
        console.warn('Classroom UUID lookup warning:', err);
      }
    }

    if (!targetClassroom) {
      try {
        targetClassroom = await this.databaseService.classroom.findFirst();
      } catch (err) {
        console.warn('Fallback classroom lookup warning:', err);
      }
    }

    // Query existing members & teachers if classroom exists
    let membersList: any[] = [];
    if (targetClassroom) {
      const studentMembers = await this.databaseService.classroomMember.findMany({
        where: { classroomId: targetClassroom.id },
        include: { user: true },
      });
      const teacherMembers = await this.databaseService.classroomTeacher.findMany({
        where: { classroomId: targetClassroom.id },
        include: { user: true },
      });

      membersList = [
        ...teacherMembers.map((tm) => ({ ...tm.user, role: 'TEACHER' })),
        ...studentMembers.map((sm) => ({ ...sm.user, role: 'STUDENT' })),
      ];
    }

    // Fallback: If no members associated yet, query all active users from database
    if (membersList.length === 0) {
      const allUsers = await this.databaseService.user.findMany({ take: 20 });
      membersList = allUsers;
    }

    // Map into standardized output structure
    return membersList.map((u) => ({
      id: u.id,
      name: u.fullName || u.email || 'Classroom Member',
      fullName: u.fullName || u.email || 'Classroom Member',
      email: u.email,
      initials: u.initials || (u.fullName ? u.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : 'U'),
      avatarBg: u.avatarBg || '#3b82f6',
      role: u.role || 'STUDENT',
      status: 'online',
    }));
  }

  /**
   * Create a study group (POST /study-groups)
   */
  async createStudyGroup(data: {
    name: string;
    classroomId?: string;
    memberIds?: string[];
    icon?: string;
    colorAccent?: string;
    color?: string;
  }, creatorId?: string) {
    if (!data.name || !data.name.trim()) {
      throw new BadRequestException('Group name is required');
    }

    const effectiveCreatorId = creatorId || (data.memberIds && data.memberIds[0]) || '33333333-3333-4333-8333-333333333333';
    await this.ensureUserExists(effectiveCreatorId);

    const validMemberIds: string[] = [];
    if (Array.isArray(data.memberIds)) {
      for (const mId of data.memberIds) {
        if (mId) {
          const userObj = await this.ensureUserExists(mId);
          validMemberIds.push(userObj.id);
        }
      }
    }

    // Ensure effectiveCreatorId is included in members
    const creatorUuid = toUuid(effectiveCreatorId);
    if (!validMemberIds.includes(creatorUuid)) {
      validMemberIds.push(creatorUuid);
    }

    // Find target classroom UUID
    let targetClassroomUuid = data.classroomId && isValidUUID(data.classroomId) ? data.classroomId : null;
    if (!targetClassroomUuid) {
      const firstClass = await this.databaseService.classroom.findFirst();
      if (firstClass) {
        targetClassroomUuid = firstClass.id;
      } else {
        const createdClass = await this.databaseService.classroom.create({
          data: {
            title: 'Flutter Course',
            inviteCode: 'FLT' + Math.floor(100 + Math.random() * 900),
            createdById: creatorUuid,
          },
        });
        targetClassroomUuid = createdClass.id;
      }
    }

    const createdGroup = await this.databaseService.studyGroup.create({
      data: {
        name: data.name.trim(),
        icon: data.icon || '📚',
        colorAccent: data.colorAccent || data.color || '#6366f1',
        classroomId: targetClassroomUuid,
        createdById: creatorUuid,
        members: {
          create: validMemberIds.map((userId) => ({
            user: {
              connect: { id: userId },
            },
          })),
        },
      },
      include: {
        members: {
          include: {
            user: true,
          },
        },
      },
    });

    return {
      id: createdGroup.id,
      name: createdGroup.name,
      classroomId: createdGroup.classroomId,
      createdById: createdGroup.createdById,
      icon: createdGroup.icon || '📚',
      color: createdGroup.colorAccent || '#6366f1',
      colorAccent: createdGroup.colorAccent || '#6366f1',
      subtitle: `${createdGroup.members.length} members`,
      createdAt: createdGroup.createdAt,
      members: createdGroup.members.map((m) => ({
        id: m.userId,
        name: m.user?.fullName || m.userId,
        initials: m.user?.initials || 'U',
        avatarBg: m.user?.avatarBg || '#3b82f6',
      })),
    };
  }

  /**
   * Get list of study groups (GET /study-groups)
   */
  async getStudyGroups(classroomId?: string) {
    let whereClause: any = {};
    if (classroomId && isValidUUID(classroomId)) {
      whereClause.classroomId = classroomId;
    }

    const groups = await this.databaseService.studyGroup.findMany({
      where: whereClause,
      include: {
        members: {
          include: {
            user: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      classroomId: g.classroomId,
      createdById: g.createdById,
      icon: g.icon || '📚',
      color: g.colorAccent || '#6366f1',
      colorAccent: g.colorAccent || '#6366f1',
      subtitle: `${g.members.length} members`,
      createdAt: g.createdAt,
      members: g.members.map((m) => ({
        id: m.userId,
        name: m.user?.fullName || m.userId,
        initials: m.user?.initials || 'U',
        avatarBg: m.user?.avatarBg || '#3b82f6',
      })),
    }));
  }
}
