import { IsEmail, IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'A valid email address is required' })
  @MaxLength(254)
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MaxLength(72)
  password!: string;
}
