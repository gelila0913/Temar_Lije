import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { ChatModule } from './modules/chat/chat.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { LiveClassModule } from './modules/live-class/live-class.module';
import { SyncModule } from './modules/sync/sync.module';
import { MaterialsModule } from './modules/materials/materials.module';
import { AssignmentsModule } from './modules/assignments/assignments.module';
import { QuizzesModule } from './modules/quizzes/quizzes.module';
import { ClassroomsModule } from './modules/classrooms/classrooms.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    DatabaseModule,
    AuthModule,
    ChatModule,
    AttendanceModule,
    LiveClassModule,
    SyncModule,
    MaterialsModule,
    AssignmentsModule,
    QuizzesModule,
    ClassroomsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global rate limiting; tighter per-route limits applied on auth endpoints
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}