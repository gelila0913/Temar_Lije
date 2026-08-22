import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateQuestionOptionDto } from './create-question-option.dto';

export enum QuestionType {
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  TRUE_FALSE = 'TRUE_FALSE',
}

export class CreateQuestionDto {
  @IsString()
  @IsNotEmpty({ message: 'Question text is required' })
  @MaxLength(500)
  text!: string;

  @IsEnum(QuestionType, {
    message: 'Type must be MULTIPLE_CHOICE or TRUE_FALSE',
  })
  type!: QuestionType;

  @IsInt()
  @Min(1, { message: 'Points must be at least 1' })
  @Max(100, { message: 'Points must be 100 or fewer' })
  points!: number;

  @IsArray()
  @ArrayMinSize(2, { message: 'A question needs at least 2 options' })
  @ArrayMaxSize(8, { message: 'A question can have at most 8 options' })
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionOptionDto)
  options!: CreateQuestionOptionDto[];
}
