import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AcademicYearsService } from '../academic-years/academic-years.service';
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

const SCHOOL_ADMIN_ROLE_NAME = 'school_admin';

/** Roles a school admin may include in an organisation / branch broadcast (lowercase names). */
const BROADCASTABLE_ROLE_NAMES = new Set([
  'student',
  'parent',
  'class_teacher',
  'subject_teacher',
  'academic_coordinator',
  'guidance_counselor',
  'principal',
  'school_admin',
  'admin_assistant',
  'super_admin',
]);

const PARTICIPANT_INSERT_CHUNK = 500;

@Injectable()
export class MessagesService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly systemSettingsService: SystemSettingsService,
    private readonly notificationsService: NotificationsService,
    private readonly academicYearsService: AcademicYearsService,
  ) {}

  private isTeacher(roles: string[]): boolean {
    return roles.some((r) => TEACHER_ROLES.includes(String(r).toLowerCase()));
  }

  private async userHasSchoolAdminOnBranch(
    supabase: ReturnType<SupabaseConfig['getClient']>,
    userId: string,
    branchId: string,
  ): Promise<boolean> {
    return this.userHasRoleOnBranch(supabase, userId, branchId, SCHOOL_ADMIN_ROLE_NAME);
  }

  private async userHasRoleOnBranch(
    supabase: ReturnType<SupabaseConfig['getClient']>,
    userId: string,
    branchId: string,
    roleNameLower: string,
  ): Promise<boolean> {
    const target = roleNameLower.toLowerCase();
    const { data, error } = await supabase
      .from('user_roles')
      .select('roles(name)')
      .eq('user_id', userId)
      .eq('branch_id', branchId);
    throwIfDbError(error);
    for (const row of data || []) {
      const roleData = row.roles as unknown;
      if (roleData && typeof roleData === 'object' && 'name' in roleData) {
        const name = String((roleData as { name: string }).name).toLowerCase();
        if (name === target) return true;
      }
    }
    return false;
  }

  private async getCommunicationBranchBroadcastDelegation(): Promise<{
    allowAdminAssistant: boolean;
    allowPrincipal: boolean;
  }> {
    const { data } = await this.systemSettingsService.getByKey('communication_branch_broadcast');
    const v = data.value;
    if (!v || typeof v !== 'object' || Array.isArray(v)) {
      return { allowAdminAssistant: false, allowPrincipal: false };
    }
    const obj = v as Record<string, unknown>;
    return {
      allowAdminAssistant: Boolean(obj.allow_admin_assistant),
      allowPrincipal: Boolean(obj.allow_principal),
    };
  }

  private async getTenantIdForBranch(
    supabase: ReturnType<SupabaseConfig['getClient']>,
    branchId: string,
  ): Promise<string> {
    const { data, error } = await supabase
      .from('branches')
      .select('tenant_id')
      .eq('id', branchId)
      .maybeSingle();
    throwIfDbError(error);
    const tid = (data as { tenant_id: string | null } | null)?.tenant_id;
    if (!tid) throw new BadRequestException('Branch has no organisation');
    return tid;
  }

  private async assertBranchBelongsToTenant(
    supabase: ReturnType<SupabaseConfig['getClient']>,
    branchId: string,
    tenantId: string,
  ): Promise<void> {
    const { data, error } = await supabase
      .from('branches')
      .select('id')
      .eq('id', branchId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    throwIfDbError(error);
    if (!data) throw new BadRequestException('Target branch is not in your organisation');
  }

  private async listActiveTenantBranchIds(
    supabase: ReturnType<SupabaseConfig['getClient']>,
    tenantId: string,
  ): Promise<string[]> {
    const { data, error } = await supabase
      .from('branches')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);
    throwIfDbError(error);
    return (data || []).map((r: { id: string }) => r.id);
  }

  private normalizeAdminBroadcastRoleNames(input: string[]): string[] {
    const out = new Set<string>();
    for (const raw of input) {
      const r = String(raw).trim().toLowerCase();
      if (!BROADCASTABLE_ROLE_NAMES.has(r)) {
        throw new BadRequestException(`Unsupported role for broadcast: ${raw}`);
      }
      out.add(r);
    }
    return [...out];
  }

  private async resolveAdminBroadcastUserIds(
    supabase: ReturnType<SupabaseConfig['getClient']>,
    targetBranchId: string,
    roleNamesLower: string[],
    academicYearId: string,
    senderId: string,
  ): Promise<string[]> {
    const ids = new Set<string>([senderId]);

    if (roleNamesLower.includes('student')) {
      const { data: enrolments, error: enrError } = await supabase
        .from('student_enrolments')
        .select('student_id')
        .eq('branch_id', targetBranchId)
        .eq('academic_year_id', academicYearId)
        .eq('status', 'active');
      throwIfDbError(enrError);
      const studentIds = [...new Set((enrolments || []).map((e: { student_id: string }) => e.student_id))];
      if (studentIds.length > 0) {
        const { data: studentRows, error: stuError } = await supabase
          .from('students')
          .select('user_id')
          .in('id', studentIds)
          .eq('branch_id', targetBranchId)
          .eq('is_active', true);
        throwIfDbError(stuError);
        for (const s of studentRows || []) {
          const uid = (s as { user_id: string | null }).user_id;
          if (uid) ids.add(uid);
        }
      }
    }

    const nonStudentRoles = roleNamesLower.filter((r) => r !== 'student');
    if (nonStudentRoles.length > 0) {
      const wanted = new Set(nonStudentRoles);
      const { data: userRoleRows, error: urError } = await supabase
        .from('user_roles')
        .select('user_id, roles(name)')
        .eq('branch_id', targetBranchId);
      throwIfDbError(urError);
      for (const row of userRoleRows || []) {
        const roleData = row.roles as unknown;
        if (roleData && typeof roleData === 'object' && 'name' in roleData) {
          const name = String((roleData as { name: string }).name).toLowerCase();
          if (wanted.has(name)) {
            ids.add((row as { user_id: string }).user_id);
          }
        }
      }
    }

    return [...ids];
  }

  private async insertConversationParticipants(
    supabase: ReturnType<SupabaseConfig['getClient']>,
    conversationId: string,
    userIds: string[],
  ): Promise<void> {
    const unique = [...new Set(userIds)];
    const rows = unique.map((user_id) => ({ conversation_id: conversationId, user_id }));
    for (let i = 0; i < rows.length; i += PARTICIPANT_INSERT_CHUNK) {
      const chunk = rows.slice(i, i + PARTICIPANT_INSERT_CHUNK);
      const { error } = await supabase.from('conversation_participants').insert(chunk);
      throwIfDbError(error);
    }
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
    const rolesLower = senderRoles.map((r) => String(r).toLowerCase());
    const dir = await this.getCommunicationDirection();
    if (rolesLower.includes('student')) {
      if (dir.teacher_student === 'teacher_only') {
        throw new ForbiddenException(
          'Students cannot send messages when communication direction is Teacher only.',
        );
      }
    }
    if (rolesLower.includes('parent')) {
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
      .maybeSingle();
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

  /** Prefer branch-scoped lookup; fall back when the conversation belongs to another branch but the user is a participant. */
  async getConversationForRequester(
    conversationId: string,
    userId: string,
    branchId: string,
  ): Promise<ConversationDto> {
    try {
      return await this.getConversation(conversationId, userId, branchId);
    } catch (e) {
      if (e instanceof NotFoundException) {
        return await this.getConversationForParticipant(conversationId, userId);
      }
      throw e;
    }
  }

  /**
   * Same as getConversation but does not filter by request branch — used when the conversation row
   * may belong to another branch (e.g. organisation-wide admin broadcast) while the caller is still a participant.
   */
  private async getConversationForParticipant(
    conversationId: string,
    userId: string,
  ): Promise<ConversationDto> {
    const supabase = this.supabaseConfig.getClient();
    const { data: conv, error: convError } = await supabase
      .from('conversations')
      .select('id, branch_id, type, class_section_id, academic_year_id, created_at')
      .eq('id', conversationId)
      .maybeSingle();
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
    requesterRoles: string[],
  ): Promise<ConversationDto> {
    const supabase = this.supabaseConfig.getClient();
    const creatorRoles = (requesterRoles ?? []).map((r) => String(r).toLowerCase());

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
      await this.enforceCommunicationDirection(userId, creatorRoles, branchId, 'one_to_one');
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
      if (dto.adminBroadcastScope) {
        if (dto.classSectionId) {
          throw new BadRequestException('Class broadcast cannot be combined with admin broadcast options');
        }
        const isSchoolAdmin = await this.userHasSchoolAdminOnBranch(supabase, userId, branchId);
        const delegation = await this.getCommunicationBranchBroadcastDelegation();
        const hasPrincipal = await this.userHasRoleOnBranch(supabase, userId, branchId, 'principal');
        const hasAdminAssistant = await this.userHasRoleOnBranch(supabase, userId, branchId, 'admin_assistant');

        const canTenantBroadcast = isSchoolAdmin;
        const canBranchBroadcast =
          isSchoolAdmin ||
          (hasPrincipal && delegation.allowPrincipal) ||
          (hasAdminAssistant && delegation.allowAdminAssistant);

        if (!canBranchBroadcast) {
          throw new ForbiddenException('You are not allowed to create this broadcast.');
        }
        if (dto.adminBroadcastScope === 'tenant' && !canTenantBroadcast) {
          throw new ForbiddenException(
            'Only school administrators can broadcast to all branches in the organisation.',
          );
        }

        const roleNamesLower = this.normalizeAdminBroadcastRoleNames(dto.adminBroadcastRoleNames ?? []);
        const tenantId = await this.getTenantIdForBranch(supabase, branchId);
        let targetBranchIds: string[];
        if (dto.adminBroadcastScope === 'tenant') {
          targetBranchIds = await this.listActiveTenantBranchIds(supabase, tenantId);
        } else {
          let bid: string;
          if (isSchoolAdmin) {
            if (!dto.adminBroadcastBranchId) {
              throw new BadRequestException('adminBroadcastBranchId is required when adminBroadcastScope is branch');
            }
            bid = dto.adminBroadcastBranchId;
          } else {
            bid = branchId;
            if (dto.adminBroadcastBranchId && dto.adminBroadcastBranchId !== branchId) {
              throw new BadRequestException('You may only broadcast to the current branch.');
            }
          }
          await this.assertBranchBelongsToTenant(supabase, bid, tenantId);
          targetBranchIds = [bid];
        }
        if (targetBranchIds.length === 0) {
          throw new BadRequestException('No active branches found for this organisation');
        }
        targetBranchIds = [...new Set(targetBranchIds)].sort((a, b) => {
          if (a === branchId) return -1;
          if (b === branchId) return 1;
          return a.localeCompare(b);
        });

        const createdIds: string[] = [];
        let primaryConversationId: string | null = null;
        for (const bid of targetBranchIds) {
          const activeYear = await this.academicYearsService.getActiveForBranch(bid);
          if (!activeYear) {
            continue;
          }
          const participantIds = await this.resolveAdminBroadcastUserIds(
            supabase,
            bid,
            roleNamesLower,
            activeYear.id,
            userId,
          );
          const { data: newConv, error: insError } = await supabase
            .from('conversations')
            .insert({
              branch_id: bid,
              type: 'broadcast',
              class_section_id: null,
              academic_year_id: activeYear.id,
            })
            .select('id, branch_id, type, class_section_id, academic_year_id, created_at')
            .single();
          throwIfDbError(insError);
          if (!newConv) throw new BadRequestException('Failed to create conversation');
          const convId = (newConv as ConversationRow).id;
          createdIds.push(convId);
          if (bid === branchId) {
            primaryConversationId = convId;
          }
          await this.insertConversationParticipants(supabase, convId, participantIds);
        }

        if (createdIds.length === 0) {
          throw new BadRequestException(
            'No broadcast was created: no active academic year on any target branch.',
          );
        }

        const primaryId = primaryConversationId ?? createdIds[0];
        const dtoOut = await this.getConversationForParticipant(primaryId, userId);
        const linked = createdIds.filter((id) => id !== primaryId);
        if (linked.length > 0) {
          dtoOut.linkedBroadcastConversationIds = linked;
        }
        return dtoOut;
      }

      if (!this.isTeacher(creatorRoles)) {
        throw new ForbiddenException('Only staff members can broadcast to a class.');
      }

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
      await this.insertConversationParticipants(
        supabase,
        (newConv as ConversationRow).id,
        allParticipantIds,
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
      .single();
    throwIfDbError(convError);
    if (!conv) throw new NotFoundException('Conversation not found');

    const convBranchId = (conv as { branch_id: string }).branch_id;

    const { data: partRows, error: partError } = await supabase
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversationId);
    throwIfDbError(partError);
    const participantIds = (partRows || []).map((p: { user_id: string }) => p.user_id);
    if (!participantIds.includes(userId)) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    const senderRolesNorm = (senderRoles ?? []).map((r) => String(r).toLowerCase());
    await this.enforceCommunicationDirection(
      userId,
      senderRolesNorm,
      convBranchId,
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
