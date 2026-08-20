import { Controller, Get, Param, UseGuards, Req } from '@nestjs/common';
import { ClassroomsService } from './classrooms.service';
import * as JwtAuthGuardModule from '../../common/guards/JwtAuthGuard';

@Controller('classrooms')
@UseGuards(JwtAuthGuardModule.JwtAuthGuard)
export class ClassroomsController {
  constructor(private readonly classroomsService: ClassroomsService) {}

  @Get(':classId/members')
  async getClassroomMembers(@Param('classId') classId: string) {
    return this.classroomsService.getClassroomMembers(classId);
  }
}
