import { IsString, IsIn, IsOptional, IsUUID } from 'class-validator';

const CONVERSATION_TYPES = ['one_to_one', 'broadcast'] as const;

export class CreateConversationDto {
  @IsIn(CONVERSATION_TYPES)
  type!: (typeof CONVERSATION_TYPES)[number];

  /** For one_to_one: the other user's id. For broadcast: ignored. */
  @IsOptional()
  @IsUUID()
  recipientUserId?: string;

  /** For broadcast: class_section id. For one_to_one: ignored. */
  @IsOptional()
  @IsUUID()
  classSectionId?: string;
}
