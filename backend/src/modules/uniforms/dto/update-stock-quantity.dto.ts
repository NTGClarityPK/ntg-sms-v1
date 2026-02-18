import { IsInt, Min } from 'class-validator';

export class UpdateStockQuantityDto {
  @IsInt()
  @Min(0)
  quantity!: number;
}
