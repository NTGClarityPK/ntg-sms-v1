import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AddOrUpdateStockDto {
  @IsString()
  size!: string;

  @IsInt()
  @Min(0)
  quantity!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;
}
