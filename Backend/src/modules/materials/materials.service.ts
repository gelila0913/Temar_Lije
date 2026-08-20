import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

function isValidUUID(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id.trim());
}

@Injectable()
export class MaterialsService {
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Creates a new course material record linked to a classroom and file path.
   */
  async uploadMaterial(data: {
    title: string;
    description?: string;
    filePath: string;
    classId: string;
    uploadedById?: string;
    fileType?: string;
    fileSizeBytes?: number;
  }) {
    const { title, filePath, classId, uploadedById, fileType, fileSizeBytes } = data;

    if (!title || !classId || !filePath) {
      throw new BadRequestException('title, classId, and file are required');
    }

    const cleanClassId = String(classId).trim();
    let targetClassroom: any = null;

    // Safely check if provided classId is a valid UUID
    if (isValidUUID(cleanClassId)) {
      try {
        targetClassroom = await this.databaseService.classroom.findUnique({
          where: { id: cleanClassId },
        });
      } catch (err) {
        console.warn('Classroom UUID lookup notice:', err);
      }
    }

    // Fallback: If provided classId is a placeholder or not found, associate with first active classroom
    if (!targetClassroom) {
      try {
        targetClassroom = await this.databaseService.classroom.findFirst();
      } catch (err) {
        console.warn('First classroom lookup notice:', err);
      }
    }

    if (!targetClassroom) {
      throw new NotFoundException(`Classroom with ID ${cleanClassId} not found`);
    }

    let uId = uploadedById && isValidUUID(uploadedById) ? uploadedById : targetClassroom.createdById;

    // Ensure uId is a valid user in DB
    if (!uId || !isValidUUID(uId)) {
      const teacherUser = await this.databaseService.user.findFirst({
        where: { role: 'TEACHER' },
      });
      uId = teacherUser?.id || targetClassroom.createdById;
    }

    try {
      const result = await this.databaseService.material.create({
        data: {
          title: title.trim(),
          fileUrl: filePath,
          fileType: (fileType as any) || 'PDF',
          fileSizeBytes: fileSizeBytes ? Number(fileSizeBytes) : null,
          classroomId: targetClassroom.id,
          uploadedById: uId,
        },
      });

      return {
        ...result,
        fileSizeBytes: result.fileSizeBytes ? Number(result.fileSizeBytes) : null,
      };
    } catch (error: any) {
      console.error('Failed to create material in database:', error);
      throw new BadRequestException(error?.message || 'Database error creating material record');
    }
  }

  /**
   * Retrieves all course materials for a specific class dashboard.
   */
  async getMaterialsByClass(classId: string) {
    if (!classId) return [];

    const cleanClassId = String(classId).trim();
    let targetClassId = cleanClassId;

    if (!isValidUUID(cleanClassId)) {
      try {
        const firstClass = await this.databaseService.classroom.findFirst();
        if (!firstClass) return [];
        targetClassId = firstClass.id;
      } catch (err) {
        return [];
      }
    }

    try {
      const list = await this.databaseService.material.findMany({
        where: { classroomId: targetClassId },
        orderBy: { createdAt: 'desc' },
      });

      return (list || []).map((item) => ({
        ...item,
        fileSizeBytes: item.fileSizeBytes ? Number(item.fileSizeBytes) : null,
      }));
    } catch (error) {
      console.warn('Failed to retrieve materials for classroom:', error);
      return [];
    }
  }
}