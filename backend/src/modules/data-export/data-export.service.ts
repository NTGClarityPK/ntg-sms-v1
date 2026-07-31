import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { SupabaseConfig } from '../../common/config/supabase.config';
import type { CurrentBranchContext } from '../../common/decorators/current-branch.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import {
  EXPORT_MAX_FAILURES_PER_HOUR,
  EXPORT_RATE_LIMIT_HOURS,
} from './constants/export-denylist';
import { CreateDataExportDto } from './dto/create-data-export.dto';
import { DataExportStatusDto } from './dto/data-export-status.dto';
import { DataExportReauthService } from './data-export-reauth.service';
import {
  SchoolDataCollectorService,
  type ExportScope,
} from './school-data-collector.service';
import { encryptExportJson } from './utils/export-crypto.util';
import { buildExportReadme } from './utils/export-readme.util';
import { buildEncryptedExportZip, buildExportFilename } from './utils/export-zip.util';

type ExportLogRow = {
  id: string;
  created_at: string;
  scope: string;
  status: string;
};

@Injectable()
export class DataExportService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly collector: SchoolDataCollectorService,
    private readonly reauth: DataExportReauthService,
  ) {}

  async getStatus(
    branch: CurrentBranchContext,
    user: CurrentUserPayload,
  ): Promise<{ data: DataExportStatusDto }> {
    const tenantId = await this.requireTenantId(branch);
    await this.assertUserInTenant(user.id, tenantId);

    const lastSuccess = await this.getLastSuccessfulExport(tenantId);
    const nextAvailableAt = lastSuccess
      ? new Date(
          new Date(lastSuccess.created_at).getTime() +
            EXPORT_RATE_LIMIT_HOURS * 60 * 60 * 1000,
        ).toISOString()
      : null;
    const canExport = !lastSuccess || (nextAvailableAt !== null && new Date() >= new Date(nextAvailableAt));

    return {
      data: {
        canExport,
        lastExportAt: lastSuccess?.created_at ?? null,
        nextAvailableAt: canExport ? null : nextAvailableAt,
        lastScope: (lastSuccess?.scope as 'tenant' | 'branch') ?? null,
      },
    };
  }

  async createExport(
    dto: CreateDataExportDto,
    branch: CurrentBranchContext,
    user: CurrentUserPayload,
    req: Request,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const tenantId = await this.requireTenantId(branch);
    await this.assertUserInTenant(user.id, tenantId);
    await this.enforceRateLimit(tenantId);
    await this.enforceFailureRateLimit(tenantId);

    try {
      await this.reauth.verifyAccountPassword(user.id, user.email, dto.accountPassword);
    } catch (e) {
      await this.logExportAttempt({
        tenantId,
        branchId: branch.branchId,
        userId: user.id,
        scope: dto.scope,
        status: 'failed',
        req,
        errorMessage: 'account_verification_failed',
      });
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('Invalid account password');
    }

    const branchIds = await this.resolveBranchIds(tenantId, branch.branchId, dto.scope);
    const tenantSlug = await this.loadTenantSlug(tenantId);

    try {
      const payload = await this.collector.collect({
        tenantId,
        branchIds,
        scope: dto.scope,
      });
      const plaintext = JSON.stringify(payload);
      const { ciphertext, meta } = encryptExportJson(plaintext, dto.backupPassword);
      const readme = buildExportReadme(payload);

      const buffer = await buildEncryptedExportZip({
        ciphertext,
        meta,
        readme,
        password: dto.backupPassword,
      });

      await this.logExportAttempt({
        tenantId,
        branchId: branch.branchId,
        userId: user.id,
        scope: dto.scope,
        status: 'success',
        req,
        fileSizeBytes: buffer.length,
      });


      return {
        buffer,
        filename: buildExportFilename(tenantSlug, dto.scope),
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'export_failed';
      await this.logExportAttempt({
        tenantId,
        branchId: branch.branchId,
        userId: user.id,
        scope: dto.scope,
        status: 'failed',
        req,
        errorMessage: message.slice(0, 500),
      });
      throw e;
    }
  }

  private async requireTenantId(branch: CurrentBranchContext): Promise<string> {
    if (!branch.tenantId) {
      throw new BadRequestException('Tenant context is required for data export');
    }
    return branch.tenantId;
  }

  private async assertUserInTenant(userId: string, tenantId: string): Promise<void> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('branches')
      .select('id')
      .eq('tenant_id', tenantId)
      .limit(1);
    if (error) throw new BadRequestException(error.message);

    const branchIds = (data ?? []).map((b) => (b as { id: string }).id);
    if (branchIds.length === 0) {
      throw new BadRequestException('No branches found for tenant');
    }

    const { data: ub, error: ubError } = await supabase
      .from('user_branches')
      .select('branch_id')
      .eq('user_id', userId)
      .in('branch_id', branchIds)
      .limit(1);
    if (ubError) throw new BadRequestException(ubError.message);
    if (!ub?.length) {
      throw new BadRequestException('You do not have access to this school');
    }
  }

  private async resolveBranchIds(
    tenantId: string,
    currentBranchId: string,
    scope: ExportScope,
  ): Promise<string[]> {
    if (scope === 'branch') return [currentBranchId];

    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('branches')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);
    if (error) throw new BadRequestException(error.message);
    const ids = (data ?? []).map((b) => (b as { id: string }).id);
    if (!ids.length) throw new BadRequestException('No active branches for export');
    return ids;
  }

  private async loadTenantSlug(tenantId: string): Promise<string> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('tenants')
      .select('domain, name')
      .eq('id', tenantId)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    const row = data as { domain: string | null; name: string | null } | null;
    return row?.domain ?? row?.name ?? tenantId.slice(0, 8);
  }

  private async getLastSuccessfulExport(tenantId: string): Promise<ExportLogRow | null> {
    const supabase = this.supabaseConfig.getClient();
    const since = new Date(
      Date.now() - EXPORT_RATE_LIMIT_HOURS * 60 * 60 * 1000,
    ).toISOString();
    const { data, error } = await supabase
      .from('school_data_export_logs')
      .select('id, created_at, scope, status')
      .eq('tenant_id', tenantId)
      .eq('status', 'success')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      if (error.message.includes('school_data_export_logs')) {
        return null;
      }
      throw new BadRequestException(error.message);
    }
    return (data as ExportLogRow | null) ?? null;
  }

  private async enforceRateLimit(tenantId: string): Promise<void> {
    const last = await this.getLastSuccessfulExport(tenantId);
    if (last) {
      throw new HttpException(
        'A successful export was already completed in the last 24 hours. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async enforceFailureRateLimit(tenantId: string): Promise<void> {
    const supabase = this.supabaseConfig.getClient();
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error } = await supabase
      .from('school_data_export_logs')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'failed')
      .gte('created_at', since);
    if (error) {
      if (error.message.includes('school_data_export_logs')) return;
      throw new BadRequestException(error.message);
    }
    if ((count ?? 0) >= EXPORT_MAX_FAILURES_PER_HOUR) {
      throw new HttpException(
        'Too many failed export attempts. Try again in an hour.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async logExportAttempt(input: {
    tenantId: string;
    branchId: string;
    userId: string;
    scope: ExportScope;
    status: 'success' | 'failed';
    req: Request;
    fileSizeBytes?: number;
    errorMessage?: string;
  }): Promise<void> {
    const supabase = this.supabaseConfig.getClient();
    const { error } = await supabase.from('school_data_export_logs').insert({
      tenant_id: input.tenantId,
      branch_id: input.branchId,
      user_id: input.userId,
      scope: input.scope,
      export_type: 'manual',
      status: input.status,
      file_size_bytes: input.fileSizeBytes ?? null,
      ip_address: this.extractIp(input.req),
      user_agent: input.req.headers['user-agent'] ?? null,
      error_message: input.errorMessage ?? null,
    });
    if (error) {
      // Non-blocking if migration not applied yet
    }
  }

  private extractIp(req: Request): string | undefined {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim();
    return req.ip;
  }
}
