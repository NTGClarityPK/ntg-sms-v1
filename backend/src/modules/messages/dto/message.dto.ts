export type MessageType = 'event' | 'meeting' | 'grade' | 'other';

export class MessageDto {
  id!: string;
  conversationId!: string;
  senderId!: string;
  messageType!: MessageType;
  subject!: string;
  body!: string;
  createdAt!: string;
  /** When true, body/subject are cleared server-side; UI shows deleted placeholder for everyone */
  isDeleted?: boolean;
  isRead?: boolean;
  senderName?: string;

  constructor(partial: Partial<MessageDto>) {
    Object.assign(this, partial);
  }
}
