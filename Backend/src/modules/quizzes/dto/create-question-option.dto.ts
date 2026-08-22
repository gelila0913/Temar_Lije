import { IsString, IsNotEmpty, IsBoolean, MaxLength } from 'class-validator';

export class CreateQuestionOptionDto {
  @IsString()
  @IsNotEmpty({ message: 'Option text is required' })
  @MaxLength(300)
  text!: string;

  @IsBoolean()
  isCorrect!: boolean;
}
