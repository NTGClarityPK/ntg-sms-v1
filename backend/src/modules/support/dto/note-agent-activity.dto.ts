import { IsISO8601, IsOptional } from 'class-validator';

export class NoteAgentActivityDto {
  @IsOptional()
  @IsISO8601()
  at?: string;
}
