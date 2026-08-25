import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  ReachConversation,
  ReachCoverage,
  ReachMessage,
  ReachMinutesSummary,
  ReachRealtimeToken,
  ReachUploadResult,
  SupportConversationStatus,
  SupportMessageType,
  SupportUploadType,
} from './support.types';

const REACH_TIMEOUT_MS = 20_000;
const REACH_NOT_CONFIGURED = 'Reach support is not configured';
const REACH_UNAVAILABLE = 'Unable to reach the support service';

type ReachErrorBody = { error?: string };

export type ReachUploadedFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

@Injectable()
export class ReachClientService {
  private readonly logger = new Logger(ReachClientService.name);

  constructor(private readonly configService: ConfigService) {}

  async listConversations(query: {
    tenantId: string;
    status?: SupportConversationStatus;
    branchId?: string;
    limit?: number;
  }): Promise<ReachConversation[]> {
    const params = new URLSearchParams();
    params.set('tenant_id', query.tenantId);
    if (query.status) params.set('status', query.status);
    if (query.branchId) params.set('branch_id', query.branchId);
    if (query.limit != null) params.set('limit', String(query.limit));
    const payload = await this.requestJson<{ conversations?: ReachConversation[] }>(
      'GET',
      `/api/support/conversations?${params.toString()}`,
    );
    return payload.conversations ?? [];
  }

  async createConversation(body: {
    tenantId: string;
    tenantName: string;
    title?: string | null;
    branchId?: string | null;
    branchName?: string | null;
  }): Promise<ReachConversation> {
    const payload = await this.requestJson<{ conversation: ReachConversation }>(
      'POST',
      '/api/support/conversations',
      {
        tenant_id: body.tenantId,
        tenant_name: body.tenantName,
        title: body.title ?? null,
        branch_id: body.branchId ?? null,
        branch_name: body.branchName ?? null,
      },
    );
    return payload.conversation;
  }

  async listMessages(
    conversationId: string,
    query: { tenantId: string; limit?: number; after?: string; before?: string },
  ): Promise<ReachMessage[]> {
    const params = new URLSearchParams();
    params.set('tenant_id', query.tenantId);
    if (query.limit != null) params.set('limit', String(query.limit));
    if (query.after) params.set('after', query.after);
    if (query.before) params.set('before', query.before);
    const payload = await this.requestJson<{ messages?: ReachMessage[] }>(
      'GET',
      `/api/support/conversations/${encodeURIComponent(conversationId)}/messages?${params.toString()}`,
    );
    return payload.messages ?? [];
  }

  async sendMessage(body: {
    tenantId: string;
    conversationId: string;
    messageType: SupportMessageType;
    content?: string | null;
    fileUrl?: string | null;
    senderDisplayName?: string | null;
    expiresAt?: string | null;
  }): Promise<ReachMessage> {
    const payload = await this.requestJson<{ message: ReachMessage }>(
      'POST',
      '/api/support/messages',
      {
        tenant_id: body.tenantId,
        conversation_id: body.conversationId,
        message_type: body.messageType,
        content: body.content ?? null,
        file_url: body.fileUrl ?? null,
        sender_display_name: body.senderDisplayName ?? null,
        expires_at: body.expiresAt ?? null,
      },
    );
    return payload.message;
  }

  async upload(input: {
    tenantId: string;
    conversationId: string;
    messageType: SupportUploadType;
    file: ReachUploadedFile;
  }): Promise<ReachUploadResult> {
    const { baseUrl, apiKey } = this.requireConfig();
    const form = new FormData();
    form.append('tenant_id', input.tenantId);
    form.append('conversation_id', input.conversationId);
    form.append('message_type', input.messageType);
    const blob = new Blob([new Uint8Array(input.file.buffer)], {
      type: input.file.mimetype || 'application/octet-stream',
    });
    form.append('file', blob, input.file.originalname || 'upload');

    return this.send(baseUrl, apiKey, 'POST', '/api/support/uploads', form);
  }

  async deleteMessage(messageId: string, tenantId: string): Promise<{ ok: true }> {
    const params = new URLSearchParams();
    params.set('tenant_id', tenantId);
    return this.requestJson<{ ok: true }>(
      'DELETE',
      `/api/support/messages/${encodeURIComponent(messageId)}?${params.toString()}`,
    );
  }

  async getMinutesSummary(tenantId: string, month?: string): Promise<ReachMinutesSummary> {
    const params = new URLSearchParams();
    params.set('tenant_id', tenantId);
    if (month) params.set('month', month);
    return this.requestJson<ReachMinutesSummary>(
      'GET',
      `/api/support/minutes-summary?${params.toString()}`,
    );
  }

  async getCoverage(): Promise<ReachCoverage> {
    return this.requestJson<ReachCoverage>('GET', '/api/support/coverage');
  }

  async getRealtimeToken(
    tenantId: string,
    conversationId: string,
  ): Promise<ReachRealtimeToken> {
    return this.requestJson<ReachRealtimeToken>('POST', '/api/support/realtime-token', {
      tenant_id: tenantId,
      conversation_id: conversationId,
    });
  }

  private async requestJson<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const { baseUrl, apiKey } = this.requireConfig();
    const payload =
      method === 'GET' || method === 'DELETE' || body === undefined
        ? undefined
        : JSON.stringify(body);
    return this.send(baseUrl, apiKey, method, path, payload, payload ? 'application/json' : undefined);
  }

  private async send<T>(
    baseUrl: string,
    apiKey: string,
    method: string,
    path: string,
    body?: BodyInit,
    jsonContentType?: string,
  ): Promise<T> {
    const url = `${baseUrl}${path}`;
    const headers: Record<string, string> = {
      'x-api-key': apiKey,
      Accept: 'application/json',
    };
    if (jsonContentType) {
      headers['Content-Type'] = jsonContentType;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body,
        signal: AbortSignal.timeout(REACH_TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.warn(
        `Reach request failed (${method} ${path}): ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      throw new ServiceUnavailableException(REACH_UNAVAILABLE);
    }

    const raw = await response.text();
    let parsed: unknown = {};
    if (raw) {
      try {
        parsed = JSON.parse(raw) as unknown;
      } catch {
        this.logger.warn(`Reach returned non-JSON (${response.status}) for ${method} ${path}`);
        throw new ServiceUnavailableException(
          'Support service returned an unexpected response',
        );
      }
    }

    if (!response.ok) {
      const message =
        typeof parsed === 'object' &&
        parsed !== null &&
        typeof (parsed as ReachErrorBody).error === 'string'
          ? (parsed as ReachErrorBody).error
          : `Support service error (${response.status})`;
      this.throwMappedError(response.status, message ?? 'Support service error');
    }

    return parsed as T;
  }

  private throwMappedError(status: number, message: string): never {
    if (status === 401) {
      this.logger.warn('Reach rejected the API key (401)');
      throw new ServiceUnavailableException('Support service is not configured correctly');
    }
    if (status === 400) throw new BadRequestException(message);
    if (status === 403) throw new ForbiddenException(message);
    if (status === 404) throw new NotFoundException(message);
    if (status === 413) throw new PayloadTooLargeException(message);
    this.logger.warn(`Reach unexpected status ${status}: ${message}`);
    throw new ServiceUnavailableException(message || 'Support service is unavailable');
  }

  private requireConfig(): { baseUrl: string; apiKey: string } {
    const baseUrl = this.readBaseUrl();
    const apiKey = this.readApiKey();
    if (!baseUrl || !apiKey) {
      throw new ServiceUnavailableException(REACH_NOT_CONFIGURED);
    }
    return { baseUrl, apiKey };
  }

  private readBaseUrl(): string {
    const raw = this.configService.get<string>('REACH_BASE_URL')?.trim() ?? '';
    return raw
      .replace(/\/+$/, '')
      .replace(/\/api\/support$/i, '')
      .replace(/\/api$/i, '');
  }

  private readApiKey(): string {
    const raw = this.configService.get<string>('REACH_API_KEY')?.trim() ?? '';
    return raw.replace(/^SUPPORT_ALMA_API_KEY=/i, '').trim();
  }
}
