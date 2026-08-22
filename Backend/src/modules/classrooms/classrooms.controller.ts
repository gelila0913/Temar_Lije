import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
} from '@nestjs/common';
import { ClassroomsService } from './classrooms.service';

@Controller('classrooms')
export class ClassroomsController {
  constructor(private readonly classroomsService: ClassroomsService) {}

  /**
   * POST /classrooms
   */
  @Post()
  async createClassroom(@Req() req: any, @Body() dto: any) {
    const creatorId = req.user?.id || req.user?.sub || dto?.creatorId || dto?.teacherId;
    return await this.classroomsService.createClassroom(creatorId, dto);
  }

  /**
   * POST /classrooms/join
   */
  @Post('join')
  async joinClassroom(@Req() req: any, @Body() dto: any) {
    const userId = req.user?.id || req.user?.sub || dto?.userId || dto?.studentId;
    const code = dto.code || dto.inviteCode;
    return await this.classroomsService.joinClassroom(userId, code);
  }

  /**
   * GET /classrooms
   */
  @Get()
  async getMyClassrooms(@Req() req: any) {
    return await this.classroomsService.getMyClassrooms(req.user);
  }

  /**
   * GET /classrooms/:classroomId
   */
  @Get(':classroomId')
  async getClassroomDetails(
    @Param('classroomId') classroomId: string,
    @Req() req: any,
  ) {
    return await this.classroomsService.getClassroomDetails(classroomId, req.user);
  }

  /**
   * GET /classrooms/:classroomId/members
   */
  @Get(':classroomId/members')
  async getClassroomMembers(@Param('classroomId') classroomId: string) {
    return await this.classroomsService.getClassroomMembers(classroomId);
  }

  /**
   * POST /classrooms/:classroomId/members
   * Enroll a student into the classroom
   */
  @Post(':classroomId/members')
  async addClassroomMember(
    @Param('classroomId') classroomId: string,
    @Body() body: any,
  ) {
    const studentIdOrEmail = body.userId || body.studentId || body.email;
    return await this.classroomsService.addStudentToClassroom(classroomId, studentIdOrEmail);
  }

  /**
   * DELETE /classrooms/:classroomId/members/:userId
   * Remove / un-enroll a student from the classroom
   */
  @Delete(':classroomId/members/:userId')
  async removeClassroomMember(
    @Param('classroomId') classroomId: string,
    @Param('userId') userId: string,
    @Req() req: any,
  ) {
    const requesterId = req.user?.id || req.user?.sub;
    return await this.classroomsService.removeStudentFromClassroom(classroomId, userId, requesterId);
  }

  /**
   * DELETE /classrooms/:classroomId
   */
  @Delete(':classroomId')
  async deleteClassroom(
    @Param('classroomId') classroomId: string,
    @Req() req: any,
  ) {
    const userId = req.user?.id || req.user?.sub;
    return await this.classroomsService.deleteClassroom(classroomId, userId);
  }
}
