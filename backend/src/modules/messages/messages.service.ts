import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { PostgrestError } from '@supabase/supabase-js';
import { MessageDto, type MessageType } from './dto/message.dto';
import {
  ConversationDto,
  ConversationListDto,
  ConversationParticipantDto,
} from './dto/conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { QueryMessagesDto } from './dto/query-messages.dto';
import { QueryConversationsDto } from './dto/query-conversations.dto';

type CommunicationDirectionValue = {
  teacher_student?: 'both' | 'teacher_only';
  teacher_parent?: 'both' | 'teacher_only';
};

type ConversationRow = {
  id: string;
  branch_id: string;
  type: string;
  class_section_id: string | null;
  academic_year_id: string | null;
  created_at: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  message_type: string;
  subject: string;
  body: string;
  created_at: string;
};

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

const TEACHER_ROLES = [
  'class_teacher',
  'subject_teacher',
  'academic_coordinator',
  'guidance_counselor',
  'principal',
  'school_admin',
  'admin_assistant',
  'super_admin',
];

@Injectable()
export class MessagesService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly systemSettingsService: SystemSettingsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private isTeacher(roles: string[]): boolean {
    return roles.some((r) => TEACHER_ROLES.includes(r));
  }

  private async getCommunicationDirection(): Promise<CommunicationDirectionValue> {
    try {
      const { data } = await this.systemSettingsService.getByKey('communication_direction');
      const value = data?.value;
      if (value && typeof value === 'object' && value !== null) {
        return value as CommunicationDirectionValue;
      }
    } catch {
      // default: both
    }
    return { teacher_student: 'both', teacher_parent: 'both' };
  }

  private async enforceCommunicationDirection(
    senderId: string,
    senderRoles: string[],
    branchId: string,
    conversationType: 'one_to_one' | 'broadcast',
    otherParticipantRole?: 'student' | 'parent',
  ): Promise<void> {
    if (this.isTeacher(senderRoles)) return;
    const dir = await this.getCommunicationDirection();
    if (senderRoles.includes('student')) {
      if (dir.teacher_student === 'teacher_only') {
        throw new ForbiddenException(
          'Students cannot send messages when communication direction is Teacher only.',
        );
      }
    }
    if (senderRoles.includes('parent')) {
      if (dir.teacher_parent === 'teacher_only') {
        throw new ForbiddenException(
          'Parents cannot send messages when communication direction is Teacher only.',
        );
      }
    }
  }

  async listConversations(
    userId: string,
    branchId: string,
    query: QueryConversationsDto,
  ): Promise<{
    data: ConversationListDto[];
    meta: { total: number; page: number; limit: number; totalPages: number; allConversationIds: string[] };
  }> {
    const supabase = this.supabaseConfig.getClient();
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data: participantRows, error: partError } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', userId);
    throwIfDbError(partError);
    const allParticipantIds = (participantRows || []).map((p) => p.conversation_id);
    const emptyMeta = {
      total: 0,
      page,
      limit,
      totalPages: 0,
      allConversationIds: allParticipantIds,
    };
    if (allParticipantIds.length === 0) {
      return { data: [], meta: emptyMeta };
    }

    const { data: hiddenRows } = await supabase
      .from('conversation_hidden')
      .select('conversation_id')
      .eq('user_id', userId)
      .in('conversation_id', allParticipantIds);
    const hiddenSet = new Set((hiddenRows || []).map((r: { conversation_id: string }) => r.conversation_id));
    const conversationIds = allParticipantIds.filter((id) => !hiddenSet.has(id));
    if (conversationIds.length === 0) {
      return { data: [], meta: emptyMeta };
    }

    let convQuery = supabase
      .from('conversations')
      .select('id, branch_id, type, class_section_id, academic_year_id, created_at', {
        count: 'exact',
      })
      .eq('branch_id', branchId)
      .in('id', conversationIds)
      .order('created_at', { ascending: false });

    const { data: convRows, error: convError, count } = await convQuery.range(from, to);
    throwIfDbError(convError);
    const total = count ?? 0;
    const rows = (convRows as ConversationRow[]) ?? [];

    const result = await this.buildConversationListDtos(supabase, rows, userId);

    return {
      data: result,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        allConversationIds: allParticipantIds,
      },
    };
  }

  /** Batched lookups for the current page of conversations (avoids N+1 per row). */
  private async buildConversationListDtos(
    supabase: ReturnType<SupabaseConfig['getClient']>,
    rows: ConversationRow[],
    userId: string,
  ): Promise<ConversationListDto[]> {
    if (rows.length === 0) return [];

    const pageIds = rows.map((r) => r.id);

    const { data: partData, error: partErr } = await supabase
      .from('conversation_participants')
      .select('conversation_id, user_id')
      .in('conversation_id', pageIds);
    throwIfDbError(partErr);

    const participantsByConv = new Map<string, string[]>();
    for (const r of partData || []) {
      const row = r as { conversation_id: string; user_id: string };
      const list = participantsByConv.get(row.conversation_id) ?? [];
      list.push(row.user_id);
      participantsByConv.set(row.conversation_id, list);
    }

    const otherUserIds = new Set<string>();
    for (const cid of pageIds) {
      for (const uid of participantsByConv.get(cid) ?? []) {
        if (uid !== userId) otherUserIds.add(uid);
      }
    }
    const orderedOtherIds = [...otherUserIds];
    const namesList =
      orderedOtherIds.length > 0
        ? await this.getParticipantNames(supabase, orderedOtherIds)
        : [];
    const nameByUserId = new Map<string, string>();
    orderedOtherIds.forEach((uid, idx) => {
      nameByUserId.set(uid, namesList[idx] ?? 'Unknown');
    });

    const [{ data: lastRows, error: lastErr }, { data: unreadRows, error: unreadErr }] =
      await Promise.all([
        supabase.rpc('last_message_preview_for_conversations', {
          p_conversation_ids: pageIds,
        }),
        supabase.rpc('count_unread_per_conversation', {
          p_conversation_ids: pageIds,
          p_user_id: userId,
        }),
      ]);
    throwIfDbError(lastErr);
    throwIfDbError(unreadErr);

    type LastPreviewRow = {
      conversation_id: string;
      subject: string;
      body: string;
      created_at: string;
      message_type: string;
    };
    const lastMap = new Map<string, LastPreviewRow>();
    for (const r of (lastRows || []) as LastPreviewRow[]) {
      lastMap.set(r.conversation_id, r);
    }
    const unreadMap = new Map<string, number>();
    for (const r of (unreadRows || []) as { conversation_id: string; unread_count: number | string }[]) {
      unreadMap.set(r.conversation_id, Number(r.unread_count));
    }

    const uniqueClassSectionIds = [
      ...new Set(rows.map((r) => r.class_section_id).filter((id): id is string => Boolean(id))),
    ];
    const classSectionMap = await this.getClassSectionDisplayNamesMap(supabase, uniqueClassSectionIds);

    return rows.map((row) => {
      const otherIds = (participantsByConv.get(row.id) ?? []).filter((id) => id !== userId);
      const participantNames = otherIds.map((id) => nameByUserId.get(id) ?? 'Unknown');

      const last = lastMap.get(row.id);
      let lastMessagePreview: string | undefined;
      let lastMessageAt: string | undefined;
      let lastMessageType: MessageType | undefined;
      if (last) {
        const preview = last.subject || last.body?.slice(0, 50) || '';
        lastMessagePreview = preview.length > 60 ? preview.slice(0, 57) + '...' : preview;
        lastMessageAt = last.created_at;
        lastMessageType = last.message_type as MessageType;
      }

      const unreadCount = unreadMap.get(row.id) ?? 0;
      let className: string | undefined;
      let sectionName: string | undefined;
      if (row.class_section_id) {
        const cs = classSectionMap.get(row.class_section_id);
        className = cs?.className;
        sectionName = cs?.sectionName;
      }

      return new ConversationListDto({
        id: row.id,
        branchId: row.branch_id,
        type: row.type as 'one_to_one' | 'broadcast',
        classSectionId: row.class_section_id ?? undefined,
        academicYearId: row.academic_year_id ?? undefined,
        createdAt: row.created_at,
        lastMessagePreview,
        lastMessageAt,
        lastMessageType,
        unreadCount,
        participantNames,
        className,
        sectionName,
      });
    });
  }

  private async getParticipantNames(
    supabase: ReturnType<SupabaseConfig['getClient']>,
    userIds: string[],
  ): Promise<string[]> {
    if (userIds.length === 0) return [];
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds);
    throwIfDbError(error);
    const map = new Map(
      (data || []).map((r: { id: string; full_name: string | null }) => [r.id, r.full_name ?? '']),
    );
    return userIds.map((id) => map.get(id) ?? 'Unknown');
  }

  private async getClassSectionDisplayNames(
    supabase: ReturnType<SupabaseConfig['getClient']>,
    classSectionId: string,
  ): Promise<{ className: string; sectionName: string }> {
    const { data, error } = await supabase
      .from('class_sections')
      .select('class_id, section_id, classes:class_id(name, display_name), sections:section_id(name)')
      .eq('id', classSectionId)
      .single();
    throwIfDbError(error);
    if (!data) return { className: '', sectionName: '' };
    const d = data as {
      classes?: { name: string; display_name: string } | { name: string; display_name: string }[];
      sections?: { name: string } | { name: string }[];
    };
    const classes = Array.isArray(d.classes) ? d.classes[0] : d.classes;
    const sections = Array.isArray(d.sections) ? d.sections[0] : d.sections;
    return {
      className: classes?.display_name || classes?.name || '',
      sectionName: sections?.name || '',
    };
  }

  private async getClassSectionDisplayNamesMap(
    supabase: ReturnType<SupabaseConfig['getClient']>,
    classSectionIds: string[],
  ): Promise<Map<string, { className: string; sectionName: string }>> {
    const out = new Map<string, { className: string; sectionName: string }>();
    if (classSectionIds.length === 0) return out;
    const { data, error } = await supabase
      .from('class_sections')
      .select('id, class_id, section_id, classes:class_id(name, display_name), sections:section_id(name)')
      .in('id', classSectionIds);
    throwIfDbError(error);
    for (const raw of data || []) {
      const row = raw as {
        id: string;
        classes?: { name: string; display_name: string } | { name: string; display_name: string }[];
        sections?: { name: string } | { name: string }[];
      };
      const cls = Array.isArray(row.classes) ? row.classes[0] : row.classes;
      const sec = Array.isArray(row.sections) ? row.sections[0] : row.sections;
      out.set(row.id, {
        className: cls?.display_name || cls?.name || '',
        sectionName: sec?.name || '',
      });
    }
    return out;
  }

  async getConversation(
    conversationId: string,
    userId: string,
    branchId: string,
  ): Promise<ConversationDto> {
    const supabase = this.supabaseConfig.getClient();
    const { data: conv, error: convError } = await supabase
      .from('conversations')
      .select('id, branch_id, type, class_section_id, academic_year_id, created_at')
      .eq('id', conversationId)
      .eq('branch_id', branchId)
      .single();
    throwIfDbError(convError);
    if (!conv) throw new NotFoundException('Conversation not found');

    const { data: partRows, error: partError } = await supabase
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversationId);
    throwIfDbError(partError);
    const participantIds = (partRows || []).map((p: { user_id: string }) => p.user_id);
    if (!participantIds.includes(userId)) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    const names = await this.getParticipantNames(supabase, participantIds);
    const participants: ConversationParticipantDto[] = participantIds.map((id, i) => ({
      userId: id,
      fullName: names[i],
    }));

    let className: string | undefined;
    let sectionName: string | undefined;
    if ((conv as ConversationRow).class_section_id) {
      const namesMap = await this.getClassSectionDisplayNames(
        supabase,
        (conv as ConversationRow).class_section_id!,
      );
      className = namesMap.className;
      sectionName = namesMap.sectionName;
    }

    return new ConversationDto({
      id: (conv as ConversationRow).id,
      branchId: (conv as ConversationRow).branch_id,
      type: (conv as ConversationRow).type as 'one_to_one' | 'broadcast',
      classSectionId: (conv as ConversationRow).class_section_id ?? undefined,
      academicYearId: (conv as ConversationRow).academic_year_id ?? undefined,
      createdAt: (conv as ConversationRow).created_at,
      participants,
      className,
      sectionName,
    });
  }

  async listMessages(
    conversationId: string,
    userId: string,
    query: QueryMessagesDto,
  ): Promise<{
    data: MessageDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const supabase = this.supabaseConfig.getClient();
    const { data: partRows, error: partError } = await supabase
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);
    throwIfDbError(partError);
    if (!partRows || partRows.length === 0) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let clearedAt: string | null = null;
    const { data: clearedRow } = await supabase
      .from('conversation_cleared')
      .select('cleared_at')
      .eq('user_id', userId)
      .eq('conversation_id', conversationId)
      .maybeSingle();
    if (clearedRow && (clearedRow as { cleared_at: string }).cleared_at) {
      clearedAt = (clearedRow as { cleared_at: string }).cleared_at;
    }

    let msgQuery = supabase
      .from('messages')
      .select('id, conversation_id, sender_id, message_type, subject, body, created_at', {
        count: 'exact',
      })
      .eq('conversation_id', conversationId);
    if (clearedAt) {
      msgQuery = msgQuery.gt('created_at', clearedAt);
    }
    msgQuery = msgQuery.order('created_at', { ascending: false });

    const { data: msgRows, error: msgError, count } = await msgQuery.range(from, to);
    throwIfDbError(msgError);
    const total = count ?? 0;
    const rows = (msgRows as MessageRow[]) ?? [];

    const senderIds = [...new Set(rows.map((r) => r.sender_id))];
    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', senderIds);
    const senderNameMap = new Map(
      (profileRows || []).map((r: { id: string; full_name: string | null }) => [
        r.id,
        r.full_name ?? 'Unknown',
      ]),
    );

    const messageIds = rows.map((r) => r.id);
    const { data: readRows } = await supabase
      .from('message_reads')
      .select('message_id')
      .in('message_id', messageIds)
      .eq('user_id', userId)
      .not('read_at', 'is', null);
    const readSet = new Set((readRows || []).map((r: { message_id: string }) => r.message_id));

    const data = rows.map(
      (row) =>
        new MessageDto({
          id: row.id,
          conversationId: row.conversation_id,
          senderId: row.sender_id,
          messageType: row.message_type as MessageType,
          subject: row.subject,
          body: row.body,
          createdAt: row.created_at,
          isRead: readSet.has(row.id),
          senderName: senderNameMap.get(row.sender_id),
        }),
    );

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createConversation(
    dto: CreateConversationDto,
    userId: string,
    branchId: string,
  ): Promise<ConversationDto> {
    const supabase = this.supabaseConfig.getClient();

    if (dto.type === 'one_to_one') {
      if (!dto.recipientUserId) {
        throw new BadRequestException('recipientUserId is required for one_to_one conversation');
      }
      if (dto.recipientUserId === userId) {
        throw new BadRequestException('Cannot create conversation with yourself');
      }
      const participantIds = [userId, dto.recipientUserId].sort();
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('branch_id', branchId)
        .eq('type', 'one_to_one');
      const existingIds = (existing || []).map((c: { id: string }) => c.id);
      if (existingIds.length > 0) {
        const { data: partRows } = await supabase
          .from('conversation_participants')
          .select('conversation_id, user_id')
          .in('conversation_id', existingIds);
        const byConv = new Map<string, Set<string>>();
        for (const p of partRows || []) {
          const pp = p as { conversation_id: string; user_id: string };
          if (!byConv.has(pp.conversation_id)) byConv.set(pp.conversation_id, new Set());
          byConv.get(pp.conversation_id)!.add(pp.user_id);
        }
        for (const [cid, set] of byConv) {
          if (set.has(userId) && set.has(dto.recipientUserId!)) {
            // Conversation may have been previously hidden (per-user). Ensure the creator sees it immediately.
            const { error: unhideSelfError } = await supabase
              .from('conversation_hidden')
              .delete()
              .eq('conversation_id', cid)
              .eq('user_id', userId);
            throwIfDbError(unhideSelfError);
            return this.getConversation(cid, userId, branchId);
          }
        }
      }
      const { data: newConv, error: insError } = await supabase
        .from('conversations')
        .insert({
          branch_id: branchId,
          type: 'one_to_one',
        })
        .select('id, branch_id, type, class_section_id, academic_year_id, created_at')
        .single();
      throwIfDbError(insError);
      if (!newConv) throw new BadRequestException('Failed to create conversation');
      await supabase.from('conversation_participants').insert([
        { conversation_id: (newConv as ConversationRow).id, user_id: userId },
        { conversation_id: (newConv as ConversationRow).id, user_id: dto.recipientUserId! },
      ]);
      return this.getConversation((newConv as ConversationRow).id, userId, branchId);
    }

    if (dto.type === 'broadcast') {
      if (!dto.classSectionId) {
        throw new BadRequestException('classSectionId is required for broadcast conversation');
      }
      const { data: cs } = await supabase
        .from('class_sections')
        .select('id, class_id, section_id, academic_year_id')
        .eq('id', dto.classSectionId)
        .eq('branch_id', branchId)
        .single();
      if (!cs) throw new NotFoundException('Class section not found');
      const csRow = cs as { class_id: string; section_id: string; academic_year_id: string };
      const { data: enrolments } = await supabase
        .from('student_enrolments')
        .select('student_id')
        .eq('branch_id', branchId)
        .eq('academic_year_id', csRow.academic_year_id)
        .eq('class_id', csRow.class_id)
        .eq('section_id', csRow.section_id)
        .eq('status', 'active');
      const studentIds = (enrolments || []).map((e: { student_id: string }) => e.student_id);
      const { data: studentRows } =
        studentIds.length > 0
          ? await supabase
              .from('students')
              .select('user_id')
              .in('id', studentIds)
              .eq('branch_id', branchId)
              .eq('is_active', true)
          : { data: [] };
      const studentUserIds = (studentRows || [])
        .map((s: { user_id: string | null }) => s.user_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);
      const allParticipantIds = [userId, ...studentUserIds];
      const { data: newConv, error: insError } = await supabase
        .from('conversations')
        .insert({
          branch_id: branchId,
          type: 'broadcast',
          class_section_id: dto.classSectionId,
          academic_year_id: csRow.academic_year_id,
        })
        .select('id, branch_id, type, class_section_id, academic_year_id, created_at')
        .single();
      throwIfDbError(insError);
      if (!newConv) throw new BadRequestException('Failed to create conversation');
      await supabase.from('conversation_participants').insert(
        allParticipantIds.map((uid) => ({
          conversation_id: (newConv as ConversationRow).id,
          user_id: uid,
        })),
      );
      return this.getConversation((newConv as ConversationRow).id, userId, branchId);
    }

    throw new BadRequestException('Invalid conversation type');
  }

  async sendMessage(
    conversationId: string,
    dto: CreateMessageDto,
    userId: string,
    branchId: string,
    senderRoles: string[],
  ): Promise<MessageDto> {
    const supabase = this.supabaseConfig.getClient();

    const { data: conv, error: convError } = await supabase
      .from('conversations')
      .select('id, branch_id, type')
      .eq('id', conversationId)
      .eq('branch_id', branchId)
      .single();
    throwIfDbError(convError);
    if (!conv) throw new NotFoundException('Conversation not found');

    const { data: partRows, error: partError } = await supabase
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversationId);
    throwIfDbError(partError);
    const participantIds = (partRows || []).map((p: { user_id: string }) => p.user_id);
    if (!participantIds.includes(userId)) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    await this.enforceCommunicationDirection(
      userId,
      senderRoles,
      branchId,
      (conv as { type: string }).type as 'one_to_one' | 'broadcast',
    );

    const { data: msg, error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: userId,
        message_type: dto.messageType ?? 'other',
        subject: dto.subject ?? '',
        body: dto.body ?? '',
      })
      .select('id, conversation_id, sender_id, message_type, subject, body, created_at')
      .single();
    throwIfDbError(msgError);
    if (!msg) throw new BadRequestException('Failed to create message');
    const msgRow = msg as MessageRow;

    const recipientIds = participantIds.filter((id) => id !== userId);
    const readRows = recipientIds.map((recipientId) => ({
      message_id: msgRow.id,
      user_id: recipientId,
      read_at: null,
    }));
    if (readRows.length > 0) {
      const { error: readError } = await supabase.from('message_reads').insert(readRows);
      throwIfDbError(readError);
    }

    // Unhide conversation for all recipients so it reappears in their list when someone messages them
    if (recipientIds.length > 0) {
      const { error: unhideError } = await supabase
        .from('conversation_hidden')
        .delete()
        .eq('conversation_id', conversationId)
        .in('user_id', recipientIds);
      throwIfDbError(unhideError);
    }

    // Also unhide for the sender (e.g. if they previously hid/deleted the thread).
    const { error: unhideSenderError } = await supabase
      .from('conversation_hidden')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);
    throwIfDbError(unhideSenderError);

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .single();
    const senderName = (profile as { full_name: string | null } | null)?.full_name ?? 'Someone';

    try {
      // Only notify recipients (recipientIds excludes sender); push is sent per recipient in createNotification.
      const notificationBody = (dto.body ?? '').trim().slice(0, 80) || 'New message';
      const notificationTitle = `Message from ${senderName}`;
      for (const recipientId of recipientIds) {
        await this.notificationsService.createNotification({
          userId: recipientId,
          type: 'message',
          title: notificationTitle,
          body: notificationBody,
          data: { conversationId, messageId: msgRow.id },
        });
      }
    } catch {
      // non-fatal
    }

    return new MessageDto({
      id: msgRow.id,
      conversationId: msgRow.conversation_id,
      senderId: msgRow.sender_id,
      messageType: msgRow.message_type as MessageType,
      subject: msgRow.subject,
      body: msgRow.body,
      createdAt: msgRow.created_at,
      isRead: true,
      senderName,
    });
  }

  async markMessageRead(messageId: string, userId: string): Promise<MessageDto> {
    const supabase = this.supabaseConfig.getClient();

    const { data: msg, error: msgError } = await supabase
      .from('messages')
      .select('id, conversation_id, sender_id, message_type, subject, body, created_at')
      .eq('id', messageId)
      .single();
    throwIfDbError(msgError);
    if (!msg) throw new NotFoundException('Message not found');
    const msgRow = msg as MessageRow;

    const { data: partRows, error: partError } = await supabase
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', msgRow.conversation_id)
      .eq('user_id', userId);
    throwIfDbError(partError);
    if (!partRows || partRows.length === 0) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    const now = new Date().toISOString();
    await supabase
      .from('message_reads')
      .upsert(
        { message_id: messageId, user_id: userId, read_at: now },
        { onConflict: 'message_id,user_id' },
      );

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', msgRow.sender_id)
      .single();
    const senderName = (profile as { full_name: string | null } | null)?.full_name ?? undefined;

    return new MessageDto({
      id: msgRow.id,
      conversationId: msgRow.conversation_id,
      senderId: msgRow.sender_id,
      messageType: msgRow.message_type as MessageType,
      subject: msgRow.subject,
      body: msgRow.body,
      createdAt: msgRow.created_at,
      isRead: true,
      senderName,
    });
  }

  /** Mark all messages in a conversation as read for the current user (e.g. when viewing the thread). */
  async markConversationRead(conversationId: string, userId: string): Promise<void> {
    const supabase = this.supabaseConfig.getClient();

    const { data: partRows, error: partError } = await supabase
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);
    throwIfDbError(partError);
    if (!partRows || partRows.length === 0) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    const { error: rpcError } = await supabase.rpc('mark_conversation_messages_read', {
      p_conversation_id: conversationId,
      p_user_id: userId,
    });
    throwIfDbError(rpcError);
  }

  /** Hide conversation from this user's list only (per-user; other participants still see it). */
  async deleteConversation(
    conversationId: string,
    userId: string,
    branchId: string,
  ): Promise<void> {
    const supabase = this.supabaseConfig.getClient();

    const { data: conv, error: convError } = await supabase
      .from('conversations')
      .select('id, branch_id')
      .eq('id', conversationId)
      .single();
    throwIfDbError(convError);
    if (!conv) throw new NotFoundException('Conversation not found');
    if ((conv as { branch_id: string }).branch_id !== branchId) {
      throw new ForbiddenException('Conversation does not belong to current branch');
    }

    const { data: partRows, error: partError } = await supabase
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);
    throwIfDbError(partError);
    if (!partRows || partRows.length === 0) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    const now = new Date().toISOString();
    const { error: upsertError } = await supabase
      .from('conversation_hidden')
      .upsert(
        { user_id: userId, conversation_id: conversationId, hidden_at: now },
        { onConflict: 'user_id,conversation_id' },
      );
    throwIfDbError(upsertError);
  }

  /** Clear chat for the current user only (per-user; other participants still see all messages). */
  async clearConversationMessages(conversationId: string, userId: string): Promise<void> {
    const supabase = this.supabaseConfig.getClient();

    const { data: partRows, error: partError } = await supabase
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);
    throwIfDbError(partError);
    if (!partRows || partRows.length === 0) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    const now = new Date().toISOString();
    const { error: upsertError } = await supabase
      .from('conversation_cleared')
      .upsert(
        { user_id: userId, conversation_id: conversationId, cleared_at: now },
        { onConflict: 'user_id,conversation_id' },
      );
    throwIfDbError(upsertError);
  }
}
