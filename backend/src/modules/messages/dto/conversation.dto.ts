import type { MessageType } from './message.dto';

export type ConversationType = 'one_to_one' | 'broadcast';

export class ConversationParticipantDto {
  userId!: string;
  fullName?: string;
  role?: string;

  constructor(partial: Partial<ConversationParticipantDto>) {
    Object.assign(this, partial);
  }
}

export class ConversationDto {
  id!: string;
  branchId!: string;
  type!: ConversationType;
  classSectionId?: string;
  academicYearId?: string;
  createdAt!: string;
  participants!: ConversationParticipantDto[];
  className?: string;
  sectionName?: string;
  /** When a school-admin broadcast created threads in other branches, those conversation ids (excluding `id`). */
  linkedBroadcastConversationIds?: string[];

  constructor(partial: Partial<ConversationDto>) {
    Object.assign(this, partial);
  }
}

export class ConversationListDto {
  id!: string;
  branchId!: string;
  type!: ConversationType;
  classSectionId?: string;
  academicYearId?: string;
  createdAt!: string;
  lastMessagePreview?: string;
  lastMessageAt?: string;
  lastMessageType?: MessageType;
  unreadCount!: number;
  participantNames!: string[];
  className?: string;
  sectionName?: string;

  constructor(partial: Partial<ConversationListDto>) {
    Object.assign(this, partial);
  }
}
