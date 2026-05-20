import { IsString, MinLength } from 'class-validator';

export class ConfirmCheckoutDto {
  @IsString()
  @MinLength(1)
  sessionId!: string;
}
