import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export type SortOrder = 'asc' | 'desc';

/**
 * Base query DTO for paginated list endpoints.
 * Every list endpoint should extend this DTO and add feature-specific filters.
 */
export class BasePaginationDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => {
    // Accept both numbers and strings; clamp to avoid massive ranges.
    const n = typeof value === 'string' ? Number.parseInt(value, 10) : (value as number);
    if (!Number.isFinite(n)) return 1;
    return Math.min(Math.max(n, 1), 10000);
  })
  page: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  @Transform(({ value }) => {
    const n = typeof value === 'string' ? Number.parseInt(value, 10) : (value as number);
    if (!Number.isFinite(n)) return 20;
    return Math.min(Math.max(n, 1), 500);
  })
  limit: number = 20;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: SortOrder = 'desc';
}


