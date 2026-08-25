export const SUPPORT_CONVERSATION_STATUSES = ['open', 'closed'] as const;
export type SupportConversationStatus = (typeof SUPPORT_CONVERSATION_STATUSES)[number];

export const SUPPORT_MESSAGE_TYPES = ['text', 'image', 'voice', 'video', 'file'] as const;
export type SupportMessageType = (typeof SUPPORT_MESSAGE_TYPES)[number];

export const SUPPORT_UPLOAD_TYPES = ['image', 'voice', 'video', 'file'] as const;
export type SupportUploadType = (typeof SUPPORT_UPLOAD_TYPES)[number];

export const REACH_UPLOAD_MAX_BYTES: Record<SupportUploadType, number> = {
  image: 5 * 1024 * 1024,
  file: 3 * 1024 * 1024,
  voice: 2 * 1024 * 1024,
  video: 20 * 1024 * 1024,
};

export const REACH_UPLOAD_ABSOLUTE_MAX_BYTES = REACH_UPLOAD_MAX_BYTES.video;

export type SupportContext = {
  tenantId: string;
  tenantName: string;
  branchId: string;
  branchName: string;
  senderDisplayName: string;
};

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
  senderType: 'customer' | 'agent';
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

export type ReachConversation = {
  id: string;
  tenant_id: string;
  tenant_name: string;
  title: string | null;
  status: SupportConversationStatus;
  created_by: string;
  assigned_to: string | null;
  created_at: string;
  closed_at: string | null;
  last_message_at: string | null;
  product: string;
  support_category: string | null;
  logged_minutes: number;
  branch_id: string | null;
  branch_name: string | null;
};

export type ReachMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_type: 'customer' | 'agent';
  sender_display_name: string | null;
  message_type: SupportMessageType;
  content: string | null;
  file_url: string | null;
  created_at: string;
  read_at: string | null;
  expires_at: string | null;
};

export type ReachUploadResult = {
  file_url: string;
  expires_at: string | null;
  message_type: SupportUploadType;
  file_name: string | null;
};

export type ReachMinutesSummary = {
  tenant_id: string;
  month: string;
  platform_minutes: number;
  operational_minutes: number;
  chat_count: number;
};

export type ReachCoverage = {
  on_duty: boolean;
  offline_message: string;
  next_available_at: string | null;
  coverage_ends_at: string | null;
};

export type ReachRealtimeToken =
  | {
      mode: 'realtime';
      access_token: string;
      expires_at: string;
      supabase_url: string;
      supabase_anon_key: string;
      refresh_after_seconds: number;
    }
  | {
      mode: 'poll';
      poll_interval_ms: number;
      message: string;
    };

export function mapReachConversation(row: ReachConversation): SupportConversation {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    tenantName: row.tenant_name,
    title: row.title ?? null,
    status: row.status,
    createdBy: row.created_by,
    assignedTo: row.assigned_to ?? null,
    createdAt: row.created_at,
    closedAt: row.closed_at ?? null,
    lastMessageAt: row.last_message_at ?? null,
    product: row.product,
    supportCategory: row.support_category ?? null,
    loggedMinutes: row.logged_minutes ?? 0,
    branchId: row.branch_id ?? null,
    branchName: row.branch_name ?? null,
  };
}

export function mapReachMessage(row: ReachMessage): SupportMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    senderType: row.sender_type,
    senderDisplayName: row.sender_display_name ?? null,
    messageType: row.message_type,
    content: row.content ?? null,
    fileUrl: row.file_url ?? null,
    createdAt: row.created_at,
    readAt: row.read_at ?? null,
    expiresAt: row.expires_at ?? null,
  };
}

export function mapReachUpload(row: ReachUploadResult): SupportUploadResult {
  return {
    fileUrl: row.file_url,
    expiresAt: row.expires_at ?? null,
    messageType: row.message_type,
    fileName: row.file_name ?? null,
  };
}

export function mapReachMinutes(row: ReachMinutesSummary): SupportMinutesSummary {
  return {
    tenantId: row.tenant_id,
    month: row.month,
    platformMinutes: row.platform_minutes,
    operationalMinutes: row.operational_minutes,
    chatCount: row.chat_count,
  };
}

export function mapReachCoverage(row: ReachCoverage): SupportCoverage {
  return {
    onDuty: row.on_duty,
    offlineMessage: row.offline_message,
    nextAvailableAt: row.next_available_at ?? null,
    coverageEndsAt: row.coverage_ends_at ?? null,
  };
}

export function mapReachRealtimeToken(row: ReachRealtimeToken): SupportRealtimeToken {
  if (row.mode === 'poll') {
    return {
      mode: 'poll',
      pollIntervalMs: row.poll_interval_ms,
      message: row.message,
    };
  }
  return {
    mode: 'realtime',
    accessToken: row.access_token,
    expiresAt: row.expires_at,
    supabaseUrl: row.supabase_url,
    supabaseAnonKey: row.supabase_anon_key,
    refreshAfterSeconds: row.refresh_after_seconds,
  };
}

export function formatSenderDisplayName(actorName: string, tenantName: string): string {
  const name = actorName.trim();
  const tenant = tenantName.trim();
  if (name && tenant) return `${name} — ${tenant}`;
  return name || tenant || 'Alma user';
}
