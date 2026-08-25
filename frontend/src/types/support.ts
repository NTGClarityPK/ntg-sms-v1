export type SupportConversationStatus = 'open' | 'closed';

export type SupportMessageType = 'text' | 'image' | 'voice' | 'video' | 'file';

export type SupportUploadType = 'image' | 'voice' | 'video' | 'file';

export type SupportSenderType = 'customer' | 'agent';

export type SupportConversation = {
  id: string;
  tenantId: string;
  tenantName: string;
  title: string | null;
  status: SupportConversationStatus;
  createdBy: string;
  assignedTo: string | null;
  createdAt: string;
  closedAt: string | null;
  lastMessageAt: string | null;
  product: string;
  supportCategory: string | null;
  loggedMinutes: number;
  branchId: string | null;
  branchName: string | null;
};

export type SupportMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  senderType: SupportSenderType;
  senderDisplayName: string | null;
  messageType: SupportMessageType;
  content: string | null;
  fileUrl: string | null;
  createdAt: string;
  readAt: string | null;
  expiresAt: string | null;
};

export type SupportUploadResult = {
  fileUrl: string;
  expiresAt: string | null;
  messageType: SupportUploadType;
  fileName: string | null;
};

export type SupportMinutesSummary = {
  tenantId: string;
  month: string;
  platformMinutes: number;
  operationalMinutes: number;
  chatCount: number;
};

export type SupportCoverage = {
  onDuty: boolean;
  offlineMessage: string;
  nextAvailableAt: string | null;
  coverageEndsAt: string | null;
};

export type SupportUnreadSummary = {
  count: number;
  conversationIds: string[];
};

export type SupportRealtimeToken =
  | {
      mode: 'realtime';
      accessToken: string;
      expiresAt: string;
      supabaseUrl: string;
      supabaseAnonKey: string;
      refreshAfterSeconds: number;
    }
  | {
      mode: 'poll';
      pollIntervalMs: number;
      message: string;
    };

export type SendSupportMessageInput = {
  conversationId: string;
  messageType: SupportMessageType;
  content?: string;
  fileUrl?: string;
  expiresAt?: string;
};
