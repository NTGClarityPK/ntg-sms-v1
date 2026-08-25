import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  SUPPORT_CONVERSATION_STATUSES,
  type SupportConversationStatus,
} from '../support.types';

export class QuerySupportConversationsDto {
  @IsOptional()
  @IsIn(SUPPORT_CONVERSATION_STATUSES)
  status?: SupportConversationStatus;

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
}
