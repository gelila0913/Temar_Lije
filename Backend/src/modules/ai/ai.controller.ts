import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  async chat(@Body() body: { message: string; isTeacher?: boolean; conversationHistory?: any[] }) {
    const { message = '', isTeacher = false, conversationHistory = [] } = body || {};
    return this.aiService.chat(message, isTeacher, conversationHistory);
  }

  @Post('generate-quiz')
  @HttpCode(HttpStatus.OK)
  async generateQuiz(@Body() body: { topic: string; numQuestions?: number }) {
    const { topic = 'General Knowledge', numQuestions = 5 } = body || {};
    return this.aiService.generateQuiz(topic, numQuestions);
  }
}
