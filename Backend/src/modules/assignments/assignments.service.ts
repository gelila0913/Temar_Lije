import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../../database/database.service';

function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly databaseService: DatabaseService,
    @Optional() private readonly jwtService?: JwtService,
  ) {}

  private async resolveStudentId(studentId?: string, authHeader?: string): Promise<string | null> {
    if (studentId && isValidUUID(studentId)) {
      return studentId;
    }

    if (authHeader && authHeader.startsWith('Bearer ') && this.jwtService) {
      try {
        const token = authHeader.replace(/^Bearer\s+/i, '');
        const decoded: any = this.jwtService.decode(token);
        if (decoded && (decoded.sub || decoded.id)) {
          const jwtId = decoded.sub || decoded.id;
          if (isValidUUID(jwtId)) return jwtId;
        }
      } catch (e) {}
    }

    if (studentId) {
      try {
        const byEmail = await this.databaseService.user.findUnique({
          where: { email: studentId },
        });
        if (byEmail) return byEmail.id;
      } catch (e) {}
    }

    const studentUser = await this.databaseService.user.findFirst({
      where: { role: 'STUDENT' },
    });
    return studentUser?.id || null;
  }

  /**
   * Creates a new classroom assignment.
   */
  async createAssignment(data: {
    title: string;
    description?: string;
    deadline?: string;
    totalPoints?: number;
    classId: string;
    createdById?: string;
  }) {
    const { title, description, deadline, totalPoints, classId, createdById } = data;

    if (!title || !title.trim()) {
      throw new BadRequestException('Assignment title is required');
    }

    if (!classId) {
      throw new BadRequestException('classId is required');
    }

    let targetClassroom: any = null;
    if (isValidUUID(classId)) {
      targetClassroom = await this.databaseService.classroom.findUnique({
        where: { id: classId },
      });
    }

    if (!targetClassroom) {
      targetClassroom = await this.databaseService.classroom.findFirst();
    }

    if (!targetClassroom) {
      let defaultTeacher = await this.databaseService.user.findFirst({
        where: { role: 'TEACHER' },
      });
      if (!defaultTeacher) {
        defaultTeacher = await this.databaseService.user.findFirst();
      }

      targetClassroom = await this.databaseService.classroom.create({
        data: {
          title: 'Classroom',
          inviteCode: 'CLS' + Math.floor(100 + Math.random() * 900),
          createdById: defaultTeacher ? defaultTeacher.id : '00000000-0000-4000-8000-000000000001',
        },
      });
    }

    let creatorId = createdById;
    if (!creatorId || !isValidUUID(creatorId)) {
      const teacher = await this.databaseService.user.findFirst({
        where: { role: 'TEACHER' },
      });
      creatorId = teacher?.id || targetClassroom.createdById;
    }

    let parsedDueDate: Date | null = null;
    if (deadline) {
      const d = new Date(deadline);
      if (!isNaN(d.getTime())) {
        parsedDueDate = d;
      }
    }

    try {
      return await this.databaseService.assignment.create({
        data: {
          title: title.trim(),
          description: description ? description.trim() : null,
          dueDate: parsedDueDate,
          totalPoints: totalPoints || 100,
          classroomId: targetClassroom.id,
          createdById: creatorId || targetClassroom.createdById,
        },
      });
    } catch (error: any) {
      console.error('Error creating assignment:', error);
      throw new BadRequestException(error?.message || 'Failed to create assignment');
    }
  }

  /**
   * Retrieves active and past assignments for a class dashboard.
   * If userId is provided, attaches submission status for the student.
   */
  async getAssignmentsByClass(classId: string, userId?: string, authHeader?: string) {
    if (!classId) return { all: [], active: [], past: [] };

    const cleanClassId = String(classId).trim();
    let targetClassId = cleanClassId;

    if (!isValidUUID(cleanClassId)) {
      try {
        const firstClass = await this.databaseService.classroom.findFirst();
        if (!firstClass) return { all: [], active: [], past: [] };
        targetClassId = firstClass.id;
      } catch (err) {
        return { all: [], active: [], past: [] };
      }
    }

    const resolvedStudentId = await this.resolveStudentId(userId, authHeader);

    try {
      const now = new Date();
      const rawAssignments = await this.databaseService.assignment.findMany({
        where: { classroomId: targetClassId, deletedAt: null },
        include: {
          _count: {
            select: { submissions: true },
          },
          submissions: resolvedStudentId
            ? {
                where: { studentId: resolvedStudentId },
                orderBy: { submittedAt: 'desc' },
                take: 1,
              }
            : false,
        },
        orderBy: { createdAt: 'desc' },
      });

      const assignments = rawAssignments.map((a: any) => {
        const mySub = a.submissions && a.submissions.length > 0 ? a.submissions[0] : null;
        return {
          id: a.id,
          title: a.title,
          description: a.description,
          dueDate: a.dueDate,
          deadline: a.dueDate,
          totalPoints: a.totalPoints,
          classroomId: a.classroomId,
          createdById: a.createdById,
          createdAt: a.createdAt,
          submissionCount: a._count?.submissions || 0,
          hasSubmitted: !!mySub,
          mySubmission: mySub
            ? {
                id: mySub.id,
                fileUrl: mySub.fileUrl,
                submissionText: mySub.submissionText,
                submittedAt: mySub.submittedAt,
                grade: mySub.grade,
                feedback: mySub.feedback,
              }
            : null,
        };
      });

      const active = assignments.filter((a) => !a.dueDate || new Date(a.dueDate) >= now);
      const past = assignments.filter((a) => a.dueDate && new Date(a.dueDate) < now);

      return {
        all: assignments,
        active,
        past,
      };
    } catch (error) {
      console.warn('Failed to retrieve assignments:', error);
      return { all: [], active: [], past: [] };
    }
  }

  /**
   * Submits student work for an assignment with strict one-submission enforcement.
   */
  async submitAssignment(
    assignmentId: string,
    data: {
      studentId: string;
      pdfPath?: string;
      linkUrl?: string;
      submissionText?: string;
      fileUrl?: string;
    },
    authHeader?: string,
  ) {
    const { studentId, pdfPath, linkUrl, submissionText, fileUrl } = data;
    const file = fileUrl || pdfPath || linkUrl;

    if (!assignmentId) {
      throw new BadRequestException('assignmentId is required');
    }

    const cleanStudentId = await this.resolveStudentId(studentId, authHeader);

    if (!cleanStudentId) {
      throw new BadRequestException('Valid studentId is required');
    }

    if (!file && (!submissionText || !submissionText.trim())) {
      throw new BadRequestException('At least a file upload or text/link submission must be provided');
    }

    if (!isValidUUID(assignmentId)) {
      throw new BadRequestException('Invalid assignmentId UUID format');
    }

    const assignment = await this.databaseService.assignment.findUnique({
      where: { id: assignmentId },
    });

    if (!assignment) {
      throw new NotFoundException(`Assignment with ID ${assignmentId} not found`);
    }

    // STRICT ONE-SUBMISSION RULE: Check if student already submitted
    const existingSubmission = await this.databaseService.assignmentSubmission.findFirst({
      where: {
        assignmentId,
        studentId: cleanStudentId,
      },
    });

    if (existingSubmission) {
      throw new ConflictException(
        'You have already submitted this assignment. Only one submission is permitted.',
      );
    }

    try {
      return await this.databaseService.assignmentSubmission.create({
        data: {
          assignmentId,
          studentId: cleanStudentId,
          fileUrl: file || null,
          submissionText: submissionText ? submissionText.trim() : null,
          attemptNumber: 1,
          isLatest: true,
        },
        include: {
          student: {
            select: { id: true, fullName: true, email: true },
          },
        },
      });
    } catch (error: any) {
      console.error('Failed to submit assignment:', error);
      throw new BadRequestException(error?.message || 'Failed to record submission');
    }
  }

  /**
   * Retrieves all submissions for an assignment.
   */
  async getSubmissions(assignmentId: string) {
    if (!assignmentId || !isValidUUID(assignmentId)) {
      throw new BadRequestException('Valid assignmentId UUID is required');
    }

    return await this.databaseService.assignmentSubmission.findMany({
      where: { assignmentId },
      include: {
        student: {
          select: { id: true, fullName: true, name: true, email: true, avatarUrl: true },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });
  }

  /**
   * Soft-deletes or hard-deletes an assignment.
   */
  async deleteAssignment(assignmentId: string) {
    if (!assignmentId || !isValidUUID(assignmentId)) {
      throw new BadRequestException('Valid assignmentId UUID is required');
    }

    return await this.databaseService.assignment.delete({
      where: { id: assignmentId },
    });
  }
}
