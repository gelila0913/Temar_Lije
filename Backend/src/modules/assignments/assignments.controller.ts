import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Req,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AssignmentsService } from './assignments.service';
import { createMulterOptions } from '../../common/config/multer.config';

@Controller()
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  /**
   * POST /assignments/create and POST /assignments
   * Instructor endpoint to create an assignment (title, description, guide file/link, deadline, classId).
   */
  @Post('assignments/create')
  @Post('assignments')
  @UseInterceptors(FileInterceptor('file', createMulterOptions('assignments')))
  async createAssignment(
    @UploadedFile() file: any,
    @Body('title') title: string,
    @Body('description') description: string,
    @Body('deadline') deadline: string,
    @Body('classId') classId: string,
    @Body('guideUrl') guideUrl?: string,
  ) {
    const guidePath = file ? `/uploads/assignments/${file.filename}` : guideUrl || undefined;

    return await this.assignmentsService.createAssignment({
      title,
      description: description ? `${description}${guidePath ? `\nGuide: ${guidePath}` : ''}` : guidePath,
      deadline,
      classId,
    });
  }

  /**
   * GET /assignments/class/:classId, GET /assignments/:classId, and GET /classrooms/:classId/assignments
   * Display active and past assignments for a class dashboard.
   */
  @Get('assignments/class/:classId')
  @Get('assignments/:classId')
  @Get('classrooms/:classId/assignments')
  async getAssignmentsByClass(@Param('classId') classId: string, @Req() req: any) {
    const authHeader = req.headers?.authorization;
    const userId = req.user?.id || req.user?.sub;
    return await this.assignmentsService.getAssignmentsByClass(classId, userId, authHeader);
  }

  /**
   * POST /assignments/:id/submit
   * Student endpoint to submit work. Supports PDF file upload (to ./uploads/submissions), link URL, or both.
   * Strict single-submission rule enforced on backend.
   */
  @Post('assignments/:id/submit')
  @UseInterceptors(FileInterceptor('file', createMulterOptions('submissions')))
  async submitAssignment(
    @Param('id') assignmentId: string,
    @UploadedFile() file: any,
    @Body('studentId') studentId: string,
    @Body('linkUrl') linkUrl?: string,
    @Req() req?: any,
  ) {
    const authHeader = req?.headers?.authorization;
    const effectiveStudentId = req?.user?.id || req?.user?.sub || studentId;
    const pdfPath = file ? `/uploads/submissions/${file.filename}` : undefined;

    return await this.assignmentsService.submitAssignment(assignmentId, {
      studentId: effectiveStudentId,
      pdfPath,
      linkUrl,
    }, authHeader);
  }

  /**
   * GET /assignments/:id/submissions
   * Instructor endpoint to view all student submissions for an assignment.
   */
  @Get('assignments/:id/submissions')
  async getSubmissions(@Param('id') assignmentId: string) {
    return await this.assignmentsService.getSubmissions(assignmentId);
  }

  /**
   * DELETE /assignments/:id and POST /assignments/:id/delete
   * Instructor endpoint to delete an assignment.
   */
  @Delete('assignments/:id')
  @Post('assignments/:id/delete')
  async deleteAssignment(@Param('id') assignmentId: string) {
    return await this.assignmentsService.deleteAssignment(assignmentId);
  }
}
