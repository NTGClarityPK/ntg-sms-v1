import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new Error(error.message);
}

@Injectable()
export class TenantDeletionScheduler {
  private readonly logger = new Logger(TenantDeletionScheduler.name);

  constructor(private readonly supabaseConfig: SupabaseConfig) {}

  // Run frequently so the 2-minute window feels accurate.
  @Cron('*/30 * * * * *')
  async run(): Promise<void> {
    const supabase = this.supabaseConfig.getClient();
    const nowIso = new Date().toISOString();

    const { data: dueTenants, error } = await supabase
      .from('tenants')
      .select('id, deletion_status, deletion_execute_at')
      .eq('deletion_status', 'pending')
      .lte('deletion_execute_at', nowIso)
      .limit(25);

    if (error) {
      this.logger.warn(`Failed to fetch due deletions: ${error.message}`);
      return;
    }

    const rows = (dueTenants || []) as Array<{
      id: string;
      deletion_status: string | null;
      deletion_execute_at: string | null;
    }>;

    if (rows.length === 0) return;

    await Promise.all(
      rows.map(async (t) => {
        try {
          // Best-effort lock: only one scheduler run should move it to executing.
          const { data: locked, error: lockError } = await supabase
            .from('tenants')
            .update({ deletion_status: 'executing' })
            .eq('id', t.id)
            .eq('deletion_status', 'pending')
            .select('id')
            .maybeSingle();

          if (lockError) {
            this.logger.warn(`Failed to lock tenant ${t.id} for deletion: ${lockError.message}`);
            return;
          }
          if (!locked) {
            return;
          }

          const { error: rpcError } = await supabase.rpc('delete_tenant_cascade', {
            p_tenant_id: t.id,
          });

          if (rpcError) {
            this.logger.error(`Deletion RPC failed for tenant ${t.id}: ${rpcError.message}`);

            // Allow retry on next tick.
            const { error: revertError } = await supabase
              .from('tenants')
              .update({ deletion_status: 'pending' })
              .eq('id', t.id)
              .eq('deletion_status', 'executing');
            if (revertError) {
              this.logger.warn(`Failed to revert tenant ${t.id} deletion_status: ${revertError.message}`);
            }
          }
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Unknown error';
          this.logger.error(`Tenant deletion worker crashed for tenant ${t.id}: ${message}`);
        }
      }),
    );
  }
}

