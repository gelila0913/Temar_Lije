import {
  Injectable,
  BadRequestException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../../database/database.service';

function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
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
export class AttendanceService {
  constructor(
    private readonly databaseService: DatabaseService,
    @Optional() private readonly jwtService?: JwtService,
  ) {}

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

  private async resolveClassroom(classIdOrCode: string) {
    if (!classIdOrCode) return null;
    const clean = String(classIdOrCode).trim();

    if (isValidUUID(clean)) {
      try {
        const byId = await this.databaseService.classroom.findUnique({ where: { id: clean } });
        if (byId) return byId;
      } catch (e) {}
    }

    try {
      const byCode = await this.databaseService.classroom.findUnique({
        where: { inviteCode: clean.toUpperCase() },
      });
      if (byCode) return byCode;
    } catch (e) {}

    return await this.databaseService.classroom.findFirst();
  }

  private async ensureClassroomExists(classId: string): Promise<string> {
    const resolved = await this.resolveClassroom(classId);
    if (resolved) return resolved.id;

    const validClassId = toUuid(classId);
    let defaultUser = await this.databaseService.user.findFirst({
      where: { role: { in: ['TEACHER', 'ADMIN'] } },
    });
    if (!defaultUser) {
      defaultUser = await this.databaseService.user.findFirst();
    }

    if (!defaultUser) {
      defaultUser = await this.databaseService.user.create({
        data: {
          id: '00000000-0000-4000-8000-000000000001',
          email: 'teacher@temarlije.local',
          fullName: 'Default Teacher',
          role: 'TEACHER',
        },
      });
    }

    const created = await this.databaseService.classroom.create({
      data: {
        id: validClassId,
        title: 'Classroom',
        inviteCode: 'CLS' + Math.floor(100 + Math.random() * 900),
        createdById: defaultUser.id,
      },
    });
    return created.id;
  }

  private async ensureUserExists(userId?: string): Promise<string> {
    if (userId) {
      const resolved = await this.resolveUser(userId);
      if (resolved) return resolved.id;
    }

    const validUserId = toUuid(userId || 'student');
    const existing = await this.databaseService.user.findUnique({
      where: { id: validUserId },
    });
    if (existing) return existing.id;

    const sanitized = (userId || 'student').replace(/[^a-zA-Z0-9]/g, '');
    const created = await this.databaseService.user.create({
      data: {
        id: validUserId,
        email: `${sanitized || 'student'}@placeholder.com`,
        fullName: `Student ${userId || ''}`.trim(),
        role: 'STUDENT',
      },
    });
    return created.id;
  }

  isLocalIp(rawIp: string): boolean {
    if (!rawIp || typeof rawIp !== 'string') return false;
    const cleanIp = rawIp.replace(/^::ffff:/, '').trim();

    return (
      cleanIp.startsWith('192.168.') ||
      cleanIp.startsWith('10.') ||
      cleanIp.startsWith('172.16.') ||
      cleanIp === '127.0.0.1' ||
      cleanIp === '::1' ||
      cleanIp === 'localhost'
    );
  }

  /**
   * Teacher creates or starts a named attendance session for a class.
   */
  async createSession(classId: string, topic?: string, teacherId?: string) {
    const validClassId = await this.ensureClassroomExists(classId);

    // Deactivate previous open sessions for this classroom
    await this.databaseService.attendanceSession.updateMany({
      where: { classroomId: validClassId, isActive: true },
      data: { isActive: false, endedAt: new Date() },
    });

    const sessionTopic = topic && topic.trim() ? topic.trim() : `Session - ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;

    const session = await this.databaseService.attendanceSession.create({
      data: {
        classroomId: validClassId,
        sessionCode: sessionTopic,
        isActive: true,
        startedAt: new Date(),
      },
    });

    return session;
  }

  /**
   * Records student check-in for an active attendance session.
   * STRICT ONE-TIME RULE: Throws ConflictException if student already checked in for this session.
   */
  async recordCheckIn(
    classId: string,
    studentId?: string,
    clientIp?: string,
    authHeader?: string,
  ) {
    if (!classId) {
      throw new BadRequestException('classId is required for check-in');
    }

    let targetStudentId = studentId;

    if (!targetStudentId && authHeader && authHeader.startsWith('Bearer ') && this.jwtService) {
      try {
        const token = authHeader.replace(/^Bearer\s+/i, '');
        const decoded: any = this.jwtService.decode(token);
        if (decoded?.sub || decoded?.id) {
          targetStudentId = decoded.sub || decoded.id;
        }
      } catch (e) {}
    }

    const validClassId = await this.ensureClassroomExists(classId);
    const validStudentId = await this.ensureUserExists(targetStudentId);

    const isWifiVerified = this.isLocalIp(clientIp || '');

    // 1. Find or create an active attendance session for this class
    let session = await this.databaseService.attendanceSession.findFirst({
      where: { classroomId: validClassId, isActive: true },
      orderBy: { startedAt: 'desc' },
    });

    if (!session) {
      session = await this.databaseService.attendanceSession.create({
        data: {
          classroomId: validClassId,
          sessionCode: `Session - ${new Date().toLocaleDateString()}`,
          isActive: true,
          startedAt: new Date(),
        },
      });
    }

    // 2. Strict One-Time Enforcement: Check if already checked in for THIS session
    const existingRecord = await this.databaseService.attendanceRecord.findFirst({
      where: {
        sessionId: session.id,
        studentId: validStudentId,
      },
      include: {
        student: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    if (existingRecord) {
      throw new ConflictException('Attendance already recorded for this session.');
    }

    // Calculate time difference in minutes
    const now = new Date();
    const startTime = session.startedAt || now;
    const diffInMinutes = (now.getTime() - new Date(startTime).getTime()) / (1000 * 60);

    const status = diffInMinutes <= 15 ? 'PRESENT' : 'LATE';

    const createdRecord = await this.databaseService.attendanceRecord.create({
      data: {
        sessionId: session.id,
        studentId: validStudentId,
        status,
        checkedInAt: now,
      },
      include: {
        student: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    return {
      ...createdRecord,
      hasCheckedIn: true,
      wifiVerified: isWifiVerified,
      message: `Checked in successfully as ${status}`,
    };
  }

  /**
   * Generates an aggregated attendance report for a classroom's active session.
   */
  async getAttendanceReport(classId: string, currentUserId?: string, authHeader?: string) {
    if (!classId) {
      throw new BadRequestException('classId is required');
    }

    let resolvedUserId = currentUserId;
    if (!resolvedUserId && authHeader && authHeader.startsWith('Bearer ') && this.jwtService) {
      try {
        const token = authHeader.replace(/^Bearer\s+/i, '');
        const decoded: any = this.jwtService.decode(token);
        if (decoded?.sub || decoded?.id) {
          resolvedUserId = decoded.sub || decoded.id;
        }
      } catch (e) {}
    }

    const classroom = await this.resolveClassroom(classId);
    const validClassId = classroom ? classroom.id : toUuid(classId);

    // Get the most recent attendance session
    const session = await this.databaseService.attendanceSession.findFirst({
      where: { classroomId: validClassId },
      orderBy: { startedAt: 'desc' },
    });

    const sessionIds = session ? [session.id] : [];

    const attendanceRecords = session
      ? await this.databaseService.attendanceRecord.findMany({
          where: { sessionId: session.id },
          include: {
            student: {
              select: { id: true, fullName: true, name: true, email: true, avatarUrl: true },
            },
          },
          orderBy: { checkedInAt: 'desc' },
        })
      : [];

    const enrollments = await this.databaseService.classroomMember.findMany({
      where: { classroomId: validClassId },
      include: {
        user: {
          select: { id: true, fullName: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    const checkedInMap = new Map<string, any>();
    for (const rec of attendanceRecords) {
      checkedInMap.set(rec.studentId, rec);
    }

    // Build the complete student roster with real status and timestamp
    const studentRoster = enrollments.map((en) => {
      const rec = checkedInMap.get(en.userId);
      if (rec) {
        return {
          id: rec.id,
          studentId: en.userId,
          student: en.user,
          status: rec.status, // PRESENT or LATE
          checkedInAt: rec.checkedInAt,
        };
      }
      return {
        id: `absent_${en.userId}`,
        studentId: en.userId,
        student: en.user,
        status: 'NOT_SUBMITTED',
        checkedInAt: null,
      };
    });

    // Also include any guest records if enrolled list was empty
    if (studentRoster.length === 0 && attendanceRecords.length > 0) {
      for (const rec of attendanceRecords) {
        studentRoster.push({
          id: rec.id,
          studentId: rec.studentId,
          student: rec.student,
          status: rec.status,
          checkedInAt: rec.checkedInAt,
        });
      }
    }

    const present = studentRoster.filter((r) => r.status === 'PRESENT');
    const late = studentRoster.filter((r) => r.status === 'LATE');
    const notSubmitted = studentRoster.filter((r) => r.status === 'NOT_SUBMITTED' || r.status === 'ABSENT');

    // Check if requesting user has already checked in
    let hasCheckedIn = false;
    let myRecord: any = null;

    if (resolvedUserId) {
      const cleanUserUuid = toUuid(resolvedUserId);
      const myRec = studentRoster.find((r) => r.studentId === resolvedUserId || r.studentId === cleanUserUuid);
      if (myRec && myRec.status !== 'NOT_SUBMITTED' && myRec.status !== 'ABSENT') {
        hasCheckedIn = true;
        myRecord = myRec;
      }
    }

    return {
      classId: validClassId,
      session: session
        ? {
            id: session.id,
            topic: session.sessionCode || 'General Attendance',
            startedAt: session.startedAt,
            isActive: session.isActive,
          }
        : null,
      timestamp: new Date().toISOString(),
      hasCheckedIn,
      myRecord,
      summary: {
        totalEnrolled: studentRoster.length,
        PRESENT: present.length,
        LATE: late.length,
        ABSENT: notSubmitted.length,
      },
      records: {
        PRESENT: present,
        LATE: late,
        ABSENT: notSubmitted,
      },
      students: studentRoster,
    };
  }

  async recordJoin(classId: string, userId: string) {
    if (!classId || !userId) return null;

    const validClassId = await this.ensureClassroomExists(classId);
    const validUserId = await this.ensureUserExists(userId);

    const existing = await this.databaseService.attendance.findUnique({
      where: {
        classId_userId: {
          classId: validClassId,
          userId: validUserId,
        },
      },
    });

    if (existing) return existing;

    const session = await this.databaseService.attendanceSession.findFirst({
      where: { classroomId: validClassId, isActive: true },
      orderBy: { startedAt: 'desc' },
    });

    const now = new Date();
    const sessionStart = session?.startedAt || now;
    const diffMinutes = (now.getTime() - sessionStart.getTime()) / (1000 * 60);
    const status = diffMinutes <= 10 ? 'PRESENT' : 'LATE';

    return await this.databaseService.attendance.create({
      data: {
        classId: validClassId,
        userId: validUserId,
        joinedAt: now,
        status: status as any,
      },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
      },
    });
  }

  async recordLeave(classId: string, userId: string) {
    if (!classId || !userId) return null;

    const validClassId = toUuid(classId);
    const validUserId = toUuid(userId);

    const existing = await this.databaseService.attendance.findUnique({
      where: {
        classId_userId: {
          classId: validClassId,
          userId: validUserId,
        },
      },
    });

    if (!existing) return null;

    const leftAt = new Date();
    const joinedAt = existing.joinedAt || leftAt;
    const durationMinutes = Math.max(
      1,
      Math.round((leftAt.getTime() - joinedAt.getTime()) / (1000 * 60)),
    );

    return await this.databaseService.attendance.update({
      where: { id: existing.id },
      data: {
        leftAt,
        durationMinutes,
      },
    });
  }

  async getClassroomAttendance(classId: string) {
    if (!classId) throw new BadRequestException('classId is required');

    const classroom = await this.resolveClassroom(classId);
    const validClassId = classroom ? classroom.id : toUuid(classId);

    const records = await this.databaseService.attendance.findMany({
      where: { classId: validClassId },
      include: {
        user: { select: { id: true, fullName: true, email: true, role: true } },
      },
      orderBy: { joinedAt: 'desc' },
    });

    const presentCount = records.filter((r) => r.status === 'PRESENT').length;
    const lateCount = records.filter((r) => r.status === 'LATE').length;
    const absentCount = records.filter((r) => r.status === 'ABSENT').length;

    return {
      classId: validClassId,
      summary: {
        totalTracked: records.length,
        PRESENT: presentCount,
        LATE: lateCount,
        ABSENT: absentCount,
      },
      records,
    };
  }
}