import {
  IsIn,
  IsOptional,
  IsUUID,
  IsArray,
  ArrayMinSize,
  IsString,
  ValidateIf,
} from 'class-validator';

const CONVERSATION_TYPES = ['one_to_one', 'broadcast'] as const;

const ADMIN_BROADCAST_SCOPES = ['tenant', 'branch'] as const;

export class CreateConversationDto {
  @IsIn(CONVERSATION_TYPES)
  type!: (typeof CONVERSATION_TYPES)[number];

  /** For one_to_one: the other user's id. For broadcast: ignored. */
  @IsOptional()
  @IsUUID()
  recipientUserId?: string;

  /** For broadcast to a class: class_section id. Mutually exclusive with admin broadcast fields. */
  @IsOptional()
  @IsUUID()
  classSectionId?: string;

  /**
   * School admin only: organisation-wide broadcast — one conversation per branch in the tenant,
   * with recipients resolved per branch from `adminBroadcastRoleNames`.
   */
  @IsOptional()
  @IsIn(ADMIN_BROADCAST_SCOPES)
  adminBroadcastScope?: (typeof ADMIN_BROADCAST_SCOPES)[number];

  /** Required when `adminBroadcastScope === 'branch'`. Must belong to the same tenant as the current branch. */
  @ValidateIf((o: CreateConversationDto) => o.adminBroadcastScope === 'branch')
  @IsUUID()
  adminBroadcastBranchId?: string;

  /** Role names (lowercase) to include; must include at least one when using admin broadcast. `student` uses active enrolments. */
  @ValidateIf((o: CreateConversationDto) => o.adminBroadcastScope != null)
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  adminBroadcastRoleNames?: string[];
}
