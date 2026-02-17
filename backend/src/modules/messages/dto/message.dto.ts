export type MessageType = 'event' | 'meeting' | 'grade' | 'other';

export class MessageDto {
  id!: string;
  conversationId!: string;
  senderId!: string;
  messageType!: MessageType;
  subject!: string;
  body!: string;
  createdAt!: string;
  isRead?: boolean;
  senderName?: string;

  constructor(partial: Partial<MessageDto>) {
    Object.assign(this, partial);
  }
}
