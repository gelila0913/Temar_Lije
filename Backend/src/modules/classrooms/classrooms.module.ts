import { Module } from '@nestjs/common';
import { ClassroomsController } from './classrooms.controller';
import { StudyGroupsController } from './study-groups.controller';
import { ClassroomsService } from './classrooms.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ClassroomsController, StudyGroupsController],
  providers: [ClassroomsService],
  exports: [ClassroomsService],
})
export class ClassroomsModule {}
