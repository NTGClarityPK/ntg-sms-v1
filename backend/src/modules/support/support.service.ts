import {
  BadRequestException,
  Injectable,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import type { CurrentBranchContext } from '../../common/decorators/current-branch.decorator';
import type { CurrentStudentPayload } from '../../common/decorators/current-student.decorator';
import type { CreateSupportConversationDto } from './dto/create-support-conversation.dto';
import type { QueryMinutesSummaryDto } from './dto/query-minutes-summary.dto';
import type { QuerySupportConversationsDto } from './dto/query-support-conversations.dto';
import type { QuerySupportMessagesDto } from './dto/query-support-messages.dto';
import type { SendSupportMessageDto } from './dto/send-support-message.dto';
import { ReachClientService, type ReachUploadedFile } from './reach-client.service';
import {
  REACH_UPLOAD_MAX_BYTES,
  formatSenderDisplayName,
  mapReachConversation,
  mapReachCoverage,
  mapReachMessage,
  mapReachMinutes,
  mapReachRealtimeToken,
  mapReachUpload,
  type SupportContext,
  type SupportConversation,
  type SupportCoverage,
  type SupportMessage,
  type SupportMinutesSummary,
  type SupportRealtimeToken,
  type SupportUploadResult,
  type SupportUploadType,
} from './support.types';

const CACHE_TTL_MS = 60_000;

type CacheEntry<T> = { expiresAt: number; value: T };

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);
  private readonly cache = new Map<string, CacheEntry<unknown>>();

  constructor(
    private readonly reachClient: ReachClientService,
    private readonly supabaseConfig: SupabaseConfig,
  ) {}

  async getPortalContext(
    branch: CurrentBranchContext,
    userId: string,
  ): Promise<SupportContext> {
    if (!branch.tenantId) {
      throw new BadRequestException('Tenant not resolved from branch');
    }
    return this.buildContext({
      tenantId: branch.tenantId,
      branchId: branch.branchId,
      userId,
    });
  }

  async getStudentContext(student: CurrentStudentPayload): Promise<SupportContext> {
    if (!student.branchId) {
      throw new BadRequestException('Branch not resolved for student');
    }
    return this.buildContext({
      branchId: student.branchId,
      studentId: student.id,
    });
  }

  async listConversations(
    ctx: SupportContext,
    query: QuerySupportConversationsDto,
  ): Promise<{ data: SupportConversation[] }> {
    const rows = await this.reachClient.listConversations({
      tenantId: ctx.tenantId,
      status: query.status,
      branchId: ctx.branchId,
      limit: query.limit,
    });
    return { data: rows.map(mapReachConversation) };
  }

  async createConversation(
    ctx: SupportContext,
    dto: CreateSupportConversationDto,
  ): Promise<{ data: SupportConversation }> {
    const row = await this.reachClient.createConversation({
      tenantId: ctx.tenantId,
      tenantName: ctx.tenantName,
      title: dto.title?.trim() || null,
      branchId: ctx.branchId,
      branchName: ctx.branchName,
    });
    return { data: mapReachConversation(row) };
  }

  async listMessages(
    ctx: SupportContext,
    conversationId: string,
    query: QuerySupportMessagesDto,
  ): Promise<{ data: SupportMessage[] }> {
    const rows = await this.reachClient.listMessages(conversationId, {
      tenantId: ctx.tenantId,
      limit: query.limit,
      after: query.after,
      before: query.before,
    });
    return { data: rows.map(mapReachMessage) };
  }

  async sendMessage(
    ctx: SupportContext,
    dto: SendSupportMessageDto,
  ): Promise<{ data: SupportMessage }> {
    if (dto.messageType === 'text' && !dto.content?.trim()) {
      throw new BadRequestException('Message cannot be empty');
    }
    const row = await this.reachClient.sendMessage({
      tenantId: ctx.tenantId,
      conversationId: dto.conversationId,
      messageType: dto.messageType,
      content: dto.content?.trim() || null,
      fileUrl: dto.fileUrl ?? null,
      senderDisplayName: ctx.senderDisplayName,
      expiresAt: dto.expiresAt ?? null,
    });
    return { data: mapReachMessage(row) };
  }

  async upload(
    ctx: SupportContext,
    messageType: SupportUploadType,
    conversationId: string,
    file: ReachUploadedFile & { size?: number },
  ): Promise<{ data: SupportUploadResult }> {
    const size = file.size ?? file.buffer.byteLength;
    const maxBytes = REACH_UPLOAD_MAX_BYTES[messageType];
    if (size > maxBytes) {
      throw new PayloadTooLargeException(
        `File exceeds the ${Math.round(maxBytes / (1024 * 1024))} MB limit for ${messageType}`,
      );
    }
    const row = await this.reachClient.upload({
      tenantId: ctx.tenantId,
      conversationId,
      messageType,
      file,
    });
    return { data: mapReachUpload(row) };
  }

  async deleteMessage(
    ctx: SupportContext,
    messageId: string,
  ): Promise<{ data: { ok: true } }> {
    await this.reachClient.deleteMessage(messageId, ctx.tenantId);
    return { data: { ok: true } };
  }

  async getMinutesSummary(
    ctx: SupportContext,
    query: QueryMinutesSummaryDto,
  ): Promise<{ data: SupportMinutesSummary }> {
    const cacheKey = `minutes:${ctx.tenantId}:${query.month ?? 'current'}`;
    const cached = this.getCached<SupportMinutesSummary>(cacheKey);
    if (cached) return { data: cached };
    const row = await this.reachClient.getMinutesSummary(ctx.tenantId, query.month);
    const mapped = mapReachMinutes(row);
    this.setCached(cacheKey, mapped);
    return { data: mapped };
  }

  async getCoverage(): Promise<{ data: SupportCoverage }> {
    const cached = this.getCached<SupportCoverage>('coverage');
    if (cached) return { data: cached };
    const row = await this.reachClient.getCoverage();
    const mapped = mapReachCoverage(row);
    this.setCached('coverage', mapped);
    return { data: mapped };
  }

  async getRealtimeToken(
    ctx: SupportContext,
    conversationId: string,
  ): Promise<{ data: SupportRealtimeToken }> {
    const row = await this.reachClient.getRealtimeToken(ctx.tenantId, conversationId);
    return { data: mapReachRealtimeToken(row) };
  }

  async getUnreadSummary(
    ctx: SupportContext,
  ): Promise<{ data: { count: number; conversationIds: string[] } }> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('support_conversation_reads')
      .select('conversation_id, last_read_at, last_agent_message_at')
      .eq('tenant_id', ctx.tenantId)
      .eq('branch_id', ctx.branchId)
      .not('last_agent_message_at', 'is', null);

    if (error) throw new BadRequestException(error.message);

    const rows = (data ?? []) as Array<{
      conversation_id: string;
      last_read_at: string | null;
      last_agent_message_at: string | null;
    }>;

    const conversationIds = rows
      .filter((row) => {
        if (!row.last_agent_message_at) return false;
        if (!row.last_read_at) return true;
        return new Date(row.last_agent_message_at).getTime() > new Date(row.last_read_at).getTime();
      })
      .map((row) => row.conversation_id);

    return { data: { count: conversationIds.length, conversationIds } };
  }

  async markConversationRead(
    ctx: SupportContext,
    conversationId: string,
  ): Promise<{ data: { ok: true } }> {
    const supabase = this.supabaseConfig.getClient();
    const now = new Date().toISOString();

    const { data: existing, error: fetchError } = await supabase
      .from('support_conversation_reads')
      .select('id')
      .eq('tenant_id', ctx.tenantId)
      .eq('branch_id', ctx.branchId)
      .eq('conversation_id', conversationId)
      .maybeSingle();

    if (fetchError) throw new BadRequestException(fetchError.message);

    if (existing) {
      const { error } = await supabase
        .from('support_conversation_reads')
        .update({ last_read_at: now })
        .eq('id', (existing as { id: string }).id);
      if (error) throw new BadRequestException(error.message);
    } else {
      const { error } = await supabase.from('support_conversation_reads').insert({
        tenant_id: ctx.tenantId,
        branch_id: ctx.branchId,
        conversation_id: conversationId,
        last_read_at: now,
      });
      if (error) throw new BadRequestException(error.message);
    }

    return { data: { ok: true } };
  }

  async noteAgentActivity(
    ctx: SupportContext,
    conversationId: string,
    at?: string,
  ): Promise<{ data: { ok: true } }> {
    const supabase = this.supabaseConfig.getClient();
    const activityAt = at ? new Date(at) : new Date();
    if (Number.isNaN(activityAt.getTime())) {
      throw new BadRequestException('Invalid activity timestamp');
    }
    const activityIso = activityAt.toISOString();

    const { data: existing, error: fetchError } = await supabase
      .from('support_conversation_reads')
      .select('id, last_agent_message_at')
      .eq('tenant_id', ctx.tenantId)
      .eq('branch_id', ctx.branchId)
      .eq('conversation_id', conversationId)
      .maybeSingle();

    if (fetchError) throw new BadRequestException(fetchError.message);

    const existingRow = existing as {
      id: string;
      last_agent_message_at: string | null;
    } | null;

    if (existingRow) {
      const previous = existingRow.last_agent_message_at
        ? new Date(existingRow.last_agent_message_at).getTime()
        : 0;
      if (activityAt.getTime() <= previous) {
        return { data: { ok: true } };
      }
      const { error } = await supabase
        .from('support_conversation_reads')
        .update({ last_agent_message_at: activityIso })
        .eq('id', existingRow.id);
      if (error) throw new BadRequestException(error.message);
    } else {
      const { error } = await supabase.from('support_conversation_reads').insert({
        tenant_id: ctx.tenantId,
        branch_id: ctx.branchId,
        conversation_id: conversationId,
        last_agent_message_at: activityIso,
      });
      if (error) throw new BadRequestException(error.message);
    }

    return { data: { ok: true } };
  }

  private getCached<T>(key: string): T | undefined {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  private setCached<T>(key: string, value: T): void {
    this.cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  private async buildContext(input: {
    tenantId?: string;
    branchId: string;
    userId?: string;
    studentId?: string;
  }): Promise<SupportContext> {
    const supabase = this.supabaseConfig.getClient();

    const branchPromise = supabase
      .from('branches')
      .select('id, name, tenant_id')
      .eq('id', input.branchId)
      .maybeSingle();

    const profilePromise = input.userId
      ? supabase.from('profiles').select('full_name').eq('id', input.userId).maybeSingle()
      : Promise.resolve({ data: null, error: null });

    const studentPromise = input.studentId
      ? supabase
          .from('students')
          .select('first_name, last_name')
          .eq('id', input.studentId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null });

    const tenantPrefetch = input.tenantId
      ? supabase.from('tenants').select('id, name').eq('id', input.tenantId).maybeSingle()
      : Promise.resolve({ data: null, error: null });

    const [branchResult, profileResult, studentResult, tenantPrefetchResult] = await Promise.all([
      branchPromise,
      profilePromise,
      studentPromise,
      tenantPrefetch,
    ]);

    if (branchResult.error) {
      throw new BadRequestException(branchResult.error.message);
    }
    const branchRow = branchResult.data as {
      id: string;
      name: string;
      tenant_id: string | null;
    } | null;
    if (!branchRow) {
      throw new BadRequestException('Branch not found');
    }

    const tenantId = input.tenantId ?? branchRow.tenant_id;
    if (!tenantId) {
      throw new BadRequestException('Tenant not resolved from branch');
    }

    let tenant = tenantPrefetchResult.data as { id: string; name: string } | null;
    if (tenantPrefetchResult.error) {
      throw new BadRequestException(tenantPrefetchResult.error.message);
    }
    if (!tenant) {
      const { data: tenantRow, error: tenantError } = await supabase
        .from('tenants')
        .select('id, name')
        .eq('id', tenantId)
        .maybeSingle();
      if (tenantError) {
        throw new BadRequestException(tenantError.message);
      }
      tenant = tenantRow as { id: string; name: string } | null;
    }
    if (!tenant) {
      throw new BadRequestException('Tenant not found');
    }

    if (profileResult.error) {
      this.logger.warn(`Failed to load profile name: ${profileResult.error.message}`);
    }
    if (studentResult.error) {
      this.logger.warn(`Failed to load student name: ${studentResult.error.message}`);
    }

    const profile = profileResult.data as { full_name?: string | null } | null;
    const student = studentResult.data as {
      first_name?: string | null;
      last_name?: string | null;
    } | null;
    const studentName = `${student?.first_name ?? ''} ${student?.last_name ?? ''}`.trim();
    const actorName = (profile?.full_name ?? '').trim() || studentName || 'Alma user';

    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      branchId: branchRow.id,
      branchName: branchRow.name,
      senderDisplayName: formatSenderDisplayName(actorName, tenant.name),
    };
  }
}
