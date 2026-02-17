export type MessageType = 'event' | 'meeting' | 'grade' | 'other';

export type ConversationType = 'one_to_one' | 'broadcast';

export interface ConversationParticipant {
  userId: string;
  fullName?: string;
  role?: string;
}

export interface Conversation {
  id: string;
  branchId: string;
  type: ConversationType;
  classSectionId?: string;
  academicYearId?: string;
  createdAt: string;
  participants: ConversationParticipant[];
  className?: string;
  sectionName?: string;
}

export interface ConversationListItem {
  id: string;
  branchId: string;
  type: ConversationType;
  classSectionId?: string;
  academicYearId?: string;
  createdAt: string;
  lastMessagePreview?: string;
  lastMessageAt?: string;
  lastMessageType?: MessageType;
  unreadCount: number;
  participantNames: string[];
  className?: string;
  sectionName?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  messageType: MessageType;
  subject: string;
  body: string;
  createdAt: string;
  isRead?: boolean;
  senderName?: string;
}

export interface CreateMessageInput {
  messageType: MessageType;
  subject: string;
  body?: string;
}

export interface CreateConversationInput {
  type: ConversationType;
  recipientUserId?: string;
  classSectionId?: string;
}
