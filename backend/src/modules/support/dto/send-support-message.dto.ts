import { IsIn, IsISO8601, IsOptional, IsString, IsUUID, MinLength, ValidateIf } from 'class-validator';
import { SUPPORT_MESSAGE_TYPES, type SupportMessageType } from '../support.types';

export class SendSupportMessageDto {
  @IsUUID()
  conversationId!: string;

  @IsIn(SUPPORT_MESSAGE_TYPES)
  messageType!: SupportMessageType;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Message cannot be empty' })
  content?: string;

  @ValidateIf((o: SendSupportMessageDto) => o.messageType !== 'text')
  @IsString()
  @MinLength(1)
  fileUrl?: string;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}
