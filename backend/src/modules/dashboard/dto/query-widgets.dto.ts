import { IsOptional, IsString } from 'class-validator';

export class QueryWidgetsDto {
  @IsOptional()
  @IsString()
  role?: string;
}
