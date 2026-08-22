import { IsEmail, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class ForgotPasswordDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'A valid email address is required' })
  @MaxLength(254)
  email!: string;
}
