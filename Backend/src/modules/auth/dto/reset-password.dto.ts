import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'token is required' })
  token!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(72, { message: 'Password must be 72 characters or fewer' })
  @Matches(/(?=.*[a-z])/, {
    message: 'Password must contain a lowercase letter',
  })
  @Matches(/(?=.*[A-Z])/, {
    message: 'Password must contain an uppercase letter',
  })
  @Matches(/(?=.*\d)/, { message: 'Password must contain a number' })
  @Matches(/(?=.*[^A-Za-z0-9])/, { message: 'Password must contain a symbol' })
  newPassword!: string;
}
