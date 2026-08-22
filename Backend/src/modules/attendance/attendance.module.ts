import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { AttendanceGateway } from './attendance.gateway';

/**
 * AttendanceModule bundling attendance controllers, providers, and gateway services.
 */
import { DatabaseModule } from '../../database/database.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [DatabaseModule, JwtModule.register({})],
  controllers: [AttendanceController],
  providers: [AttendanceService, AttendanceGateway],
  exports: [AttendanceService, AttendanceGateway],
})
export class AttendanceModule {}
