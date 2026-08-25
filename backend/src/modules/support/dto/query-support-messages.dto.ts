import { Transform } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, Max, Min } from 'class-validator';

export class QuerySupportMessagesDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  @Transform(({ value }) => {
    const n = typeof value === 'string' ? Number.parseInt(value, 10) : (value as number);
    if (!Number.isFinite(n)) return undefined;
    return n;
  })
  limit?: number;

  @IsOptional()
  @IsISO8601()
  after?: string;

  @IsOptional()
  @IsISO8601()
  before?: string;
}
