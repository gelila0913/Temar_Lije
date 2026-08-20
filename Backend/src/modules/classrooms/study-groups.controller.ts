import { Controller, Post, Get, Body, Req, UseGuards, Query } from '@nestjs/common';
import { ClassroomsService } from './classrooms.service';
import * as JwtAuthGuardModule from '../../common/guards/JwtAuthGuard';

@Controller('study-groups')
@UseGuards(JwtAuthGuardModule.JwtAuthGuard)
export class StudyGroupsController {
  constructor(private readonly classroomsService: ClassroomsService) {}

  @Post()
  async createStudyGroup(@Body() body: any, @Req() req: any) {
    return this.classroomsService.createStudyGroup(body, req.user?.id);
  }

  @Get()
  async getStudyGroups(@Query('classroomId') classroomId: string) {
    return this.classroomsService.getStudyGroups(classroomId);
  }
}
