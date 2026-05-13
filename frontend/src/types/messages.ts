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
  linkedBroadcastConversationIds?: string[];
}

export interface ConversationListItem {
  id: string;
  branchId: string;
  type: ConversationType;
  classSectionId?: string;
  academicYearId?: string;
  createdAt: string;
  lastMessagePreview?: string;
  lastMessageDeleted?: boolean;
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
  /** Sender deleted for everyone — body/subject empty from API */
  isDeleted?: boolean;
  isRead?: boolean;
  senderName?: string;
}

export interface CreateMessageInput {
  body: string;
  messageType?: MessageType;
  subject?: string;
}

export interface CreateConversationInput {
  type: ConversationType;
  recipientUserId?: string;
  classSectionId?: string;
  /** School admin only. One conversation per target branch. */
  adminBroadcastScope?: 'tenant' | 'branch';
  adminBroadcastBranchId?: string;
  adminBroadcastRoleNames?: string[];
}
