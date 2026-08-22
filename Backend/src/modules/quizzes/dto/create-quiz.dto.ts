import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
  IsISO8601,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateQuestionDto } from './create-question.dto';

export class CreateQuizDto {
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  @MaxLength(150)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'dueDate must be a valid ISO 8601 date' })
  dueDate?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'A quiz needs at least 1 question' })
  @ArrayMaxSize(50, { message: 'A quiz can have at most 50 questions' })
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  questions!: CreateQuestionDto[];
}
