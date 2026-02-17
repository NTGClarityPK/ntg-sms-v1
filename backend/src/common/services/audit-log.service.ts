import { Injectable } from '@nestjs/common';
import { SupabaseConfig } from '../config/supabase.config';
import { extractUsernameFromEmail } from '../utils/audit.utils';

export interface AuditLogEntry {
  tableName: string;
  recordId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  userEmail: string;
  branchId?: string | null;
  tenantId?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  changedFields?: string[];
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly supabaseConfig: SupabaseConfig) {}

  /**
   * Log an audit event
   * This is a fire-and-forget operation - errors are logged but don't throw
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      const supabase = this.supabaseConfig.getClient();
      const username = extractUsernameFromEmail(entry.userEmail);

      const { error } = await supabase.from('audit_logs').insert({
        table_name: entry.tableName,
        record_id: entry.recordId,
        action: entry.action,
        user_email: entry.userEmail,
        username,
        branch_id: entry.branchId || null,
        tenant_id: entry.tenantId || null,
        old_values: entry.oldValues || null,
        new_values: entry.newValues || null,
        changed_fields: entry.changedFields || null,
        ip_address: entry.ipAddress || null,
        user_agent: entry.userAgent || null,
      });

      if (error) {
        // Log error but don't throw - audit logging should never break the main flow
        console.error('[AuditLogService] Failed to log audit entry:', error);
      }
    } catch (error) {
      // Silently fail - audit logging is non-critical
      console.error('[AuditLogService] Unexpected error logging audit:', error);
    }
  }

  /**
   * Helper to create audit log for CREATE action
   */
  async logCreate(
    tableName: string,
    recordId: string,
    userEmail: string,
    newValues: Record<string, unknown>,
    options?: {
      branchId?: string | null;
      tenantId?: string | null;
      ipAddress?: string;
      userAgent?: string;
    },
  ): Promise<void> {
    await this.log({
      tableName,
      recordId,
      action: 'CREATE',
      userEmail,
      newValues,
      branchId: options?.branchId,
      tenantId: options?.tenantId,
      ipAddress: options?.ipAddress,
      userAgent: options?.userAgent,
    });
  }

  /**
   * Helper to create audit log for UPDATE action
   */
  async logUpdate(
    tableName: string,
    recordId: string,
    userEmail: string,
    oldValues: Record<string, unknown>,
    newValues: Record<string, unknown>,
    changedFields: string[],
    options?: {
      branchId?: string | null;
      tenantId?: string | null;
      ipAddress?: string;
      userAgent?: string;
    },
  ): Promise<void> {
    await this.log({
      tableName,
      recordId,
      action: 'UPDATE',
      userEmail,
      oldValues,
      newValues,
      changedFields,
      branchId: options?.branchId,
      tenantId: options?.tenantId,
      ipAddress: options?.ipAddress,
      userAgent: options?.userAgent,
    });
  }

  /**
   * Helper to create audit log for DELETE action
   */
  async logDelete(
    tableName: string,
    recordId: string,
    userEmail: string,
    oldValues: Record<string, unknown>,
    options?: {
      branchId?: string | null;
      tenantId?: string | null;
      ipAddress?: string;
      userAgent?: string;
    },
  ): Promise<void> {
    await this.log({
      tableName,
      recordId,
      action: 'DELETE',
      userEmail,
      oldValues,
      branchId: options?.branchId,
      tenantId: options?.tenantId,
      ipAddress: options?.ipAddress,
      userAgent: options?.userAgent,
    });
  }
}
