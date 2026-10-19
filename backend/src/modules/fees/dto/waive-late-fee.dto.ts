import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class WaiveLateFeeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;
}
