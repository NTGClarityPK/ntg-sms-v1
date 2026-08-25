import { IsUUID } from 'class-validator';

export class RealtimeTokenDto {
  @IsUUID()
  conversationId!: string;
}
