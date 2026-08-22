import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SubmitAnswerDto {
  @IsString()
  @IsNotEmpty({ message: 'questionId is required' })
  questionId!: string;

  @IsOptional()
  @IsString()
  selectedOptionId?: string;
}

export class SubmitQuizDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmitAnswerDto)
  answers!: SubmitAnswerDto[];

  @IsOptional()
  @IsString()
  studentId?: string;
}
