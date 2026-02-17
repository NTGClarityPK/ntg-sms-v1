import { IsString, IsIn, IsOptional, MinLength } from 'class-validator';

const MESSAGE_TYPES = ['event', 'meeting', 'grade', 'other'] as const;
export type CreateMessageMessageType = (typeof MESSAGE_TYPES)[number];

export class CreateMessageDto {
  @IsIn(MESSAGE_TYPES)
  messageType!: CreateMessageMessageType;

  @IsString()
  @MinLength(1)
  subject!: string;

  @IsOptional()
  @IsString()
  body?: string;
}
