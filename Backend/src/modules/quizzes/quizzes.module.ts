import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { QuizzesController } from './quizzes.controller';
import { QuizzesService } from './quizzes.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule, JwtModule.register({}), ConfigModule],
  controllers: [QuizzesController],
  providers: [QuizzesService],
  exports: [QuizzesService],
})
export class QuizzesModule {}

