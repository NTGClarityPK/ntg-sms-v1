import {
  IsEmail,
  IsString,
  IsArray,
  IsBoolean,
  IsIn,
  MinLength,
  ArrayNotEmpty,
  IsUUID,
  IsOptional,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  fullName!: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @IsOptional()
  @IsIn(['male', 'female'])
  gender?: 'male' | 'female';

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID(undefined, { each: true })
  roleIds!: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

