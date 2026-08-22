import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
} from '@nestjs/common';
import { QuizzesService } from './quizzes.service';

@Controller()
export class QuizzesController {
  constructor(private readonly quizzesService: QuizzesService) {}

  /**
   * POST /quizzes/generate-ai
   */
  @Post('quizzes/generate-ai')
  async generateAIQuiz(@Body() dto: any) {
    return await this.quizzesService.generateAIQuiz(dto);
  }

  /**
   * POST /classrooms/:classroomId/quizzes, POST /quizzes/create, and POST /quizzes
   */
  @Post('classrooms/:classroomId/quizzes')
  @Post('quizzes/create')
  @Post('quizzes')
  async createQuiz(
    @Param('classroomId') classroomId: string,
    @Req() req: any,
    @Body() dto: any,
  ) {
    const targetClassroomId = classroomId || dto.classId || dto.classroomId;
    const teacherId = req.user?.id || req.user?.sub;
    return await this.quizzesService.createQuiz(targetClassroomId, teacherId, dto);
  }

  /**
   * GET /classrooms/:classroomId/quizzes, GET /quizzes/class/:classId, GET /quizzes/classroom/:classroomId
   */
  @Get('classrooms/:classroomId/quizzes')
  @Get('quizzes/class/:classId')
  @Get('quizzes/classroom/:classroomId')
  async getQuizzesByClassroom(
    @Param('classroomId') classroomId: string,
    @Param('classId') classId: string,
    @Req() req: any,
  ) {
    const targetClassId = classroomId || classId;
    return await this.quizzesService.getQuizzesByClassroom(targetClassId, req.user);
  }

  /**
   * PATCH /quizzes/:quizId/publish and POST /quizzes/:quizId/publish
   */
  @Patch('quizzes/:quizId/publish')
  @Post('quizzes/:quizId/publish')
  async publishQuiz(@Param('quizId') quizId: string) {
    return await this.quizzesService.publishQuiz(quizId);
  }

  /**
   * GET /quizzes/:quizId/details or GET /quizzes/:quizId/teacher
   */
  @Get('quizzes/:quizId/details')
  @Get('quizzes/:quizId/teacher')
  async getQuizForTeacher(@Param('quizId') quizId: string) {
    return await this.quizzesService.getQuizForTeacher(quizId);
  }

  /**
   * GET /quizzes/:quizId
   */
  @Get('quizzes/:quizId')
  async getQuiz(@Param('quizId') quizId: string, @Req() req: any) {
    if (req.user?.role === 'TEACHER') {
      return await this.quizzesService.getQuizForTeacher(quizId);
    }
    return await this.quizzesService.getQuizForStudent(quizId, req.user);
  }

  /**
   * POST /quizzes/:quizId/submit
   */
  @Post('quizzes/:quizId/submit')
  async submitQuiz(
    @Param('quizId') quizId: string,
    @Req() req: any,
    @Body() dto: any,
  ) {
    const authHeader = req.headers?.authorization;
    return await this.quizzesService.submitQuiz(quizId, req.user, dto, authHeader);
  }

  /**
   * GET /quizzes/:quizId/result
   */
  @Get('quizzes/:quizId/result')
  async getSubmissionResult(@Param('quizId') quizId: string, @Req() req: any) {
    const studentId = req.user?.id || req.user?.sub;
    const authHeader = req.headers?.authorization;
    return await this.quizzesService.getSubmissionResult(quizId, studentId, authHeader);
  }

  /**
   * GET /quizzes/:quizId/analytics
   */
  @Get('quizzes/:quizId/analytics')
  async getQuizAnalytics(@Param('quizId') quizId: string) {
    return await this.quizzesService.getQuizAnalytics(quizId);
  }

  /**
   * DELETE /quizzes/:quizId and POST /quizzes/:quizId/delete
   */
  @Delete('quizzes/:quizId')
  @Post('quizzes/:quizId/delete')
  async deleteQuiz(@Param('quizId') quizId: string) {
    return await this.quizzesService.deleteQuiz(quizId);
  }
}
