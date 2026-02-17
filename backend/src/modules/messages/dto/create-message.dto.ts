import { IsString, IsIn, IsOptional, MinLength } from 'class-validator';

const MESSAGE_TYPES = ['event', 'meeting', 'grade', 'other'] as const;
export type CreateMessageMessageType = (typeof MESSAGE_TYPES)[number];

export class CreateMessageDto {
  @IsOptional()
  @IsIn(MESSAGE_TYPES)
  messageType?: CreateMessageMessageType;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsString()
  @MinLength(1, { message: 'Message cannot be empty' })
  body!: string;
}
