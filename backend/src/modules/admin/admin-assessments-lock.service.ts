import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AssessmentsLockDto } from './dto/enterprise-offer.dto';

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

@Injectable()
export class AdminAssessmentsLockService {
  constructor(private readonly supabaseConfig: SupabaseConfig) {}

  async getLock(tenantId: string): Promise<Record<string, unknown>> {
    const tenant = await this.fetchTenant(tenantId);
    return this.mapLock(tenant, false);
  }

  async setLock(
    tenantId: string,
    dto: AssessmentsLockDto,
  ): Promise<Record<string, unknown>> {
    const before = await this.fetchTenant(tenantId);
    const wasLocked = Boolean(before.assessments_creation_locked);
    const nextLocked = dto.locked;

    const patch = nextLocked
      ? {
          assessments_creation_locked: true,
          assessments_creation_locked_at: new Date().toISOString(),
          assessments_creation_lock_reason: dto.reason?.trim() || null,
        }
      : {
          assessments_creation_locked: false,
          assessments_creation_locked_at: null,
          assessments_creation_lock_reason: null,
        };

    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('tenants')
      .update(patch)
      .eq('id', tenantId)
      .select(
        'id, name, code, domain, assessments_creation_locked, assessments_creation_locked_at, assessments_creation_lock_reason',
      )
      .single();

    throwIfDbError(error);
    if (!data) throw new BadRequestException('Failed to update assessments lock');

    return this.mapLock(
      data as typeof before,
      wasLocked !== nextLocked,
    );
  }

  async isCreationLocked(tenantId: string): Promise<boolean> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('tenants')
      .select('assessments_creation_locked')
      .eq('id', tenantId)
      .maybeSingle();
    throwIfDbError(error);
    return Boolean(
      (data as { assessments_creation_locked?: boolean } | null)
        ?.assessments_creation_locked,
    );
  }

  private async fetchTenant(tenantId: string): Promise<{
    id: string;
    name: string;
    code: string | null;
    domain: string | null;
    assessments_creation_locked: boolean | null;
    assessments_creation_locked_at: string | null;
    assessments_creation_lock_reason: string | null;
  }> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('tenants')
      .select(
        'id, name, code, domain, assessments_creation_locked, assessments_creation_locked_at, assessments_creation_lock_reason',
      )
      .eq('id', tenantId)
      .maybeSingle();
    throwIfDbError(error);
    if (!data) throw new NotFoundException('Tenant not found');
    return data as {
      id: string;
      name: string;
      code: string | null;
      domain: string | null;
      assessments_creation_locked: boolean | null;
      assessments_creation_locked_at: string | null;
      assessments_creation_lock_reason: string | null;
    };
  }

  private mapLock(
    tenant: {
      id: string;
      name: string;
      code: string | null;
      domain: string | null;
      assessments_creation_locked: boolean | null;
      assessments_creation_locked_at: string | null;
      assessments_creation_lock_reason: string | null;
    },
    changed: boolean,
  ): Record<string, unknown> {
    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      subdomain: tenant.code || tenant.domain,
      locked: Boolean(tenant.assessments_creation_locked),
      lockedAt: tenant.assessments_creation_locked_at,
      reason: tenant.assessments_creation_lock_reason,
      changed,
    };
  }
}
