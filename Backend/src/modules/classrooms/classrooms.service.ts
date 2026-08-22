import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function generateClassCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

@Injectable()
export class ClassroomsService {
  constructor(private readonly databaseService: DatabaseService) {}

  private async resolveUser(userIdOrEmail?: string) {
    if (!userIdOrEmail) return null;
    const clean = String(userIdOrEmail).trim();

    if (isValidUUID(clean)) {
      try {
        const byId = await this.databaseService.user.findUnique({ where: { id: clean } });
        if (byId) return byId;
      } catch (e) {}
    }

    try {
      const byEmail = await this.databaseService.user.findUnique({ where: { email: clean } });
      if (byEmail) return byEmail;
    } catch (e) {}

    return null;
  }

  private async resolveClassroom(classroomIdOrCode: string) {
    if (!classroomIdOrCode) return null;
    const clean = String(classroomIdOrCode).trim();

    if (isValidUUID(clean)) {
      try {
        const byId = await this.databaseService.classroom.findUnique({
          where: { id: clean },
          include: {
            createdBy: { select: { id: true, fullName: true, name: true, email: true } },
            teachers: { include: { user: { select: { id: true, fullName: true, name: true, email: true } } } },
            members: { include: { user: { select: { id: true, fullName: true, name: true, email: true, role: true } } } },
          },
        });
        if (byId) return byId;
      } catch (e) {}
    }

    try {
      const byCode = await this.databaseService.classroom.findUnique({
        where: { inviteCode: clean.toUpperCase() },
        include: {
          createdBy: { select: { id: true, fullName: true, name: true, email: true } },
          teachers: { include: { user: { select: { id: true, fullName: true, name: true, email: true } } } },
          members: { include: { user: { select: { id: true, fullName: true, name: true, email: true, role: true } } } },
        },
      });
      if (byCode) return byCode;
    } catch (e) {}

    return null;
  }

  /**
   * Create a new classroom
   */
  async createClassroom(creatorId: string, dto: any) {
    const title = dto.title || dto.name;
    if (!title || !String(title).trim()) {
      throw new BadRequestException('Classroom title is required');
    }

    let user = await this.resolveUser(creatorId);
    if (!user) {
      // Fallback to first teacher or admin
      user = await this.databaseService.user.findFirst({
        where: { role: { in: ['TEACHER', 'ADMIN'] } },
      });
      if (!user) {
        user = await this.databaseService.user.findFirst();
      }
    }

    if (!user) {
      throw new BadRequestException('Valid creator user is required to create a classroom');
    }

    // Generate unique invite code
    let inviteCode = (dto.code || dto.inviteCode || generateClassCode()).toUpperCase().trim();
    let existingCode = await this.databaseService.classroom.findUnique({ where: { inviteCode } });
    let attempts = 0;
    while (existingCode && attempts < 10) {
      inviteCode = generateClassCode();
      existingCode = await this.databaseService.classroom.findUnique({ where: { inviteCode } });
      attempts++;
    }

    const classroom = await this.databaseService.classroom.create({
      data: {
        title: String(title).trim(),
        name: String(title).trim(),
        subject: dto.subject ? String(dto.subject).trim() : null,
        description: dto.description ? String(dto.description).trim() : null,
        inviteCode,
        createdById: user.id,
      },
    });

    // Add teacher membership
    try {
      await this.databaseService.classroomTeacher.create({
        data: {
          classroomId: classroom.id,
          userId: user.id,
          isOwner: true,
        },
      });
    } catch (e) {}

    return {
      id: classroom.id,
      title: classroom.title,
      name: classroom.title,
      subject: classroom.subject || '',
      description: classroom.description || '',
      code: classroom.inviteCode,
      inviteCode: classroom.inviteCode,
      instructor: user.fullName || user.name || 'Instructor',
      createdAt: classroom.createdAt,
    };
  }

  /**
   * Join a classroom using its 6-character invite code
   */
  async joinClassroom(userId: string, code: string) {
    if (!code || !String(code).trim()) {
      throw new BadRequestException('Classroom invite code is required');
    }

    const cleanCode = String(code).trim().toUpperCase();
    const classroom = await this.databaseService.classroom.findUnique({
      where: { inviteCode: cleanCode },
      include: {
        createdBy: { select: { id: true, fullName: true, name: true } },
      },
    });

    if (!classroom || classroom.deletedAt) {
      throw new NotFoundException(`No active classroom found with code "${cleanCode}"`);
    }

    let user = await this.resolveUser(userId);
    if (!user) {
      user = await this.databaseService.user.findFirst({ where: { role: 'STUDENT' } });
    }

    if (!user) {
      throw new BadRequestException('Valid user is required to join classroom');
    }

    // Check if already a member
    const existingMember = await this.databaseService.classroomMember.findUnique({
      where: {
        classroomId_userId: {
          classroomId: classroom.id,
          userId: user.id,
        },
      },
    });

    if (!existingMember) {
      await this.databaseService.classroomMember.create({
        data: {
          classroomId: classroom.id,
          userId: user.id,
        },
      });
    }

    return {
      id: classroom.id,
      title: classroom.title,
      name: classroom.title,
      subject: classroom.subject || '',
      description: classroom.description || '',
      code: classroom.inviteCode,
      inviteCode: classroom.inviteCode,
      instructor: classroom.createdBy?.fullName || classroom.createdBy?.name || 'Instructor',
      joinedAt: existingMember?.joinedAt || new Date(),
    };
  }

  /**
   * List classrooms for the current user
   */
  async getMyClassrooms(user?: any) {
    const resolvedUser = user?.id || user?.sub ? await this.resolveUser(user.id || user.sub) : null;

    let classrooms: any[] = [];

    if (resolvedUser) {
      if (resolvedUser.role === 'TEACHER' || resolvedUser.role === 'ADMIN') {
        classrooms = await this.databaseService.classroom.findMany({
          where: {
            deletedAt: null,
            OR: [
              { createdById: resolvedUser.id },
              { teachers: { some: { userId: resolvedUser.id } } },
            ],
          },
          include: {
            createdBy: { select: { id: true, fullName: true, name: true } },
            _count: { select: { members: true, materials: true, assignments: true, quizzes: true } },
          },
          orderBy: { createdAt: 'desc' },
        });
      } else {
        classrooms = await this.databaseService.classroom.findMany({
          where: {
            deletedAt: null,
            OR: [
              { members: { some: { userId: resolvedUser.id } } },
              { createdById: resolvedUser.id },
            ],
          },
          include: {
            createdBy: { select: { id: true, fullName: true, name: true } },
            _count: { select: { members: true, materials: true, assignments: true, quizzes: true } },
          },
          orderBy: { createdAt: 'desc' },
        });
      }
    }

    // If no user or empty result, return all platform classrooms for seamless exploration
    if (classrooms.length === 0) {
      classrooms = await this.databaseService.classroom.findMany({
        where: { deletedAt: null },
        include: {
          createdBy: { select: { id: true, fullName: true, name: true } },
          _count: { select: { members: true, materials: true, assignments: true, quizzes: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    return classrooms.map((c: any) => ({
      id: c.id,
      title: c.title,
      name: c.title,
      subject: c.subject || '',
      description: c.description || '',
      code: c.inviteCode,
      inviteCode: c.inviteCode,
      instructor: c.createdBy?.fullName || c.createdBy?.name || 'Instructor',
      studentCount: c._count?.members || 0,
      materialCount: c._count?.materials || 0,
      assignmentCount: c._count?.assignments || 0,
      quizCount: c._count?.quizzes || 0,
      createdAt: c.createdAt,
    }));
  }

  /**
   * Get single classroom details
   */
  async getClassroomDetails(classroomId: string, user?: any) {
    const classroom = await this.resolveClassroom(classroomId);
    if (!classroom) {
      throw new NotFoundException('Classroom not found');
    }

    const counts = await this.databaseService.classroom.findUnique({
      where: { id: classroom.id },
      select: {
        _count: { select: { members: true, materials: true, assignments: true, quizzes: true } },
      },
    });

    return {
      id: classroom.id,
      title: classroom.title,
      name: classroom.title,
      subject: classroom.subject || '',
      description: classroom.description || '',
      code: classroom.inviteCode,
      inviteCode: classroom.inviteCode,
      instructor: classroom.createdBy?.fullName || classroom.createdBy?.name || 'Instructor',
      createdById: classroom.createdById,
      studentCount: counts?._count?.members || 0,
      materialCount: counts?._count?.materials || 0,
      assignmentCount: counts?._count?.assignments || 0,
      quizCount: counts?._count?.quizzes || 0,
      createdAt: classroom.createdAt,
    };
  }

  /**
   * Get members of a classroom
   */
  async getClassroomMembers(classroomId: string) {
    const classroom = await this.resolveClassroom(classroomId);
    if (!classroom) {
      throw new NotFoundException('Classroom not found');
    }

    const members = await this.databaseService.classroomMember.findMany({
      where: { classroomId: classroom.id },
      include: {
        user: { select: { id: true, fullName: true, name: true, email: true, role: true, avatarUrl: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });

    const teachers = await this.databaseService.classroomTeacher.findMany({
      where: { classroomId: classroom.id },
      include: {
        user: { select: { id: true, fullName: true, name: true, email: true, role: true, avatarUrl: true } },
      },
    });

    return {
      classroomId: classroom.id,
      teachers: teachers.map((t: any) => ({
        id: t.user.id,
        name: t.user.fullName || t.user.name || 'Instructor',
        email: t.user.email,
        role: 'TEACHER',
        isOwner: t.isOwner,
      })),
      students: members.map((m: any) => ({
        id: m.user.id,
        name: m.user.fullName || m.user.name || 'Student',
        email: m.user.email,
        role: 'STUDENT',
        joinedAt: m.joinedAt,
      })),
      members: [
        ...teachers.map((t: any) => ({
          id: t.user.id,
          name: t.user.fullName || t.user.name || 'Instructor',
          email: t.user.email,
          role: 'TEACHER',
          isOwner: t.isOwner,
        })),
        ...members.map((m: any) => ({
          id: m.user.id,
          name: m.user.fullName || m.user.name || 'Student',
          email: m.user.email,
          role: 'STUDENT',
          joinedAt: m.joinedAt,
        })),
      ],
    };
  }

  /**
   * Enroll a student into a classroom
   */
  async addStudentToClassroom(classroomId: string, studentIdOrEmail: string) {
    const classroom = await this.resolveClassroom(classroomId);
    if (!classroom) {
      throw new NotFoundException('Classroom not found');
    }

    const user = await this.resolveUser(studentIdOrEmail);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.databaseService.classroomMember.upsert({
      where: {
        classroomId_userId: {
          classroomId: classroom.id,
          userId: user.id,
        },
      },
      create: {
        classroomId: classroom.id,
        userId: user.id,
      },
      update: {},
    });

    return await this.getClassroomMembers(classroom.id);
  }

  /**
   * Remove / un-enroll a student from a classroom.
   * When a teacher removes a student, the student's account is permanently deleted
   * so they lose access and must register anew as a new student.
   */
  async removeStudentFromClassroom(classroomId: string, studentId: string, teacherId?: string) {
    const classroom = await this.resolveClassroom(classroomId);
    if (!classroom) {
      throw new NotFoundException('Classroom not found');
    }

    if (teacherId) {
      const teacherUser = await this.resolveUser(teacherId);
      const isOwner = classroom.createdById === teacherUser?.id;
      const isTeacher = isOwner || (await this.databaseService.classroomTeacher.findUnique({
        where: {
          classroomId_userId: {
            classroomId: classroom.id,
            userId: teacherUser?.id || '',
          },
        },
      }));

      if (!isTeacher && teacherUser?.role !== 'ADMIN' && teacherUser?.role !== 'TEACHER') {
        throw new ForbiddenException('Only teachers or classroom owners have the power to remove students.');
      }
    }

    const user = await this.resolveUser(studentId);
    if (user) {
      // If the removed user is a student, delete their account completely
      if (user.role === 'STUDENT') {
        try {
          await this.databaseService.user.delete({
            where: { id: user.id },
          });
        } catch {
          // Manual fallback if relation constraints require manual unlinking
          await this.databaseService.classroomMember.deleteMany({
            where: { userId: user.id },
          });
          await this.databaseService.studyGroupMember.deleteMany({
            where: { userId: user.id },
          });
          await this.databaseService.user.delete({
            where: { id: user.id },
          }).catch(() => {});
        }
      } else {
        await this.databaseService.classroomMember.deleteMany({
          where: {
            classroomId: classroom.id,
            userId: user.id,
          },
        });
      }
    }

    return await this.getClassroomMembers(classroom.id);
  }

  /**
   * Delete or leave a classroom
   */
  async deleteClassroom(classroomId: string, userId?: string) {
    const classroom = await this.resolveClassroom(classroomId);
    if (!classroom) {
      throw new NotFoundException('Classroom not found');
    }

    return await this.databaseService.classroom.delete({
      where: { id: classroom.id },
    });
  }
}
