import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DENYLIST_COLUMN_NAMES,
  EXCLUDED_TABLES,
  EXPORT_ROW_PAGE_SIZE,
  EXPORT_VERSION,
} from './constants/export-denylist';
import {
  BRANCH_SCOPED_TABLES,
  SUBSCRIPTION_CHILD_TABLES,
  TENANT_SCOPED_TABLES,
} from './constants/export-manifest.v1';
import { sanitizeExportRow } from './utils/sanitize-export-row';

export type ExportScope = 'tenant' | 'branch';

export type SchoolDataExportPayload = {
  metadata: {
    version: string;
    exportedAt: string;
    scope: ExportScope;
    tenantId: string;
    branchIds: string[];
    excludedFields: string[];
    excludedTables: string[];
    note: string;
  };
  sections: Record<string, unknown[]>;
};

@Injectable()
export class SchoolDataCollectorService {
  private columnCache = new Map<string, string[]>();

  constructor(private readonly supabaseConfig: SupabaseConfig) {}

  async collect(input: {
    tenantId: string;
    branchIds: string[];
    scope: ExportScope;
  }): Promise<SchoolDataExportPayload> {
    const supabase = this.supabaseConfig.getClient();
    const sections: Record<string, unknown[]> = {};

    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select(
        'id, name, code, domain, email, phone, timezone, fiscal_year_start, vat_number, logo_url, is_active, created_at, updated_at',
      )
      .eq('id', input.tenantId)
      .maybeSingle();
    if (tenantError) throw new BadRequestException(tenantError.message);
    sections.tenant = tenant
      ? [sanitizeExportRow(tenant as unknown as Record<string, unknown>)]
      : [];

    const { data: branches, error: branchesError } = await supabase
      .from('branches')
      .select(
        'id, tenant_id, name, code, address, phone, email, is_active, created_at, updated_at',
      )
      .eq('tenant_id', input.tenantId)
      .in('id', input.branchIds);
    if (branchesError) throw new BadRequestException(branchesError.message);
    sections.branches = (branches ?? []).map((r) =>
      sanitizeExportRow(r as unknown as Record<string, unknown>),
    );

    const profileIds = await this.collectProfileIds(supabase, input.branchIds);
    if (profileIds.length > 0) {
      sections.profiles = await this.fetchByIds(
        supabase,
        'profiles',
        profileIds,
        'id, full_name, email, phone, avatar_url, current_branch_id, created_at, updated_at',
      );
    } else {
      sections.profiles = [];
    }

    for (const table of BRANCH_SCOPED_TABLES) {
      if (EXCLUDED_TABLES.has(table)) continue;
      const key = table;
      sections[key] = await this.fetchBranchScopedTable(supabase, table, input.branchIds, {
        isSubscriptionTable: false,
      });
    }

    for (const { key, table } of TENANT_SCOPED_TABLES) {
      if (EXCLUDED_TABLES.has(table)) continue;
      sections[key] = await this.fetchTenantScopedTable(supabase, table, input.tenantId);
    }

    await this.enrichSubscriptionTables(supabase, sections);
    await this.enrichChildTables(supabase, sections);

    return {
      metadata: {
        version: EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        scope: input.scope,
        tenantId: input.tenantId,
        branchIds: input.branchIds,
        excludedFields: Array.from(DENYLIST_COLUMN_NAMES),
        excludedTables: Array.from(EXCLUDED_TABLES),
        note:
          'Database records only. Uploaded storage files, auth credentials, and push subscriptions are not included.',
      },
      sections,
    };
  }

  private async collectProfileIds(
    supabase: SupabaseClient,
    branchIds: string[],
  ): Promise<string[]> {
    const ids = new Set<string>();
    const { data: ub, error: ubError } = await supabase
      .from('user_branches')
      .select('user_id')
      .in('branch_id', branchIds);
    if (ubError) throw new BadRequestException(ubError.message);
    for (const row of ub ?? []) {
      const uid = (row as { user_id: string }).user_id;
      if (uid) ids.add(uid);
    }

    const { data: staff, error: staffError } = await supabase
      .from('staff')
      .select('user_id')
      .in('branch_id', branchIds)
      .not('user_id', 'is', null);
    if (staffError) throw new BadRequestException(staffError.message);
    for (const row of staff ?? []) {
      const uid = (row as { user_id: string | null }).user_id;
      if (uid) ids.add(uid);
    }

    return Array.from(ids);
  }

  private async fetchByIds(
    supabase: SupabaseClient,
    table: string,
    ids: string[],
    select: string,
  ): Promise<Record<string, unknown>[]> {
    const all: Record<string, unknown>[] = [];
    const chunkSize = 200;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const { data, error } = await supabase.from(table).select(select).in('id', chunk);
      if (error) throw new BadRequestException(`${table}: ${error.message}`);
      for (const row of data ?? []) {
        all.push(sanitizeExportRow(row as unknown as Record<string, unknown>));
      }
    }
    return all;
  }

  private async resolveSelectColumns(
    supabase: SupabaseClient,
    table: string,
    isSubscriptionTable: boolean,
  ): Promise<string> {
    const cached = this.columnCache.get(table);
    if (cached) return cached.join(',');

    const { data, error } = await supabase.rpc('get_exportable_columns', { p_table: table });
    if (!error && Array.isArray(data) && data.length > 0) {
      const cols = (data as string[]).filter(
        (c) => !DENYLIST_COLUMN_NAMES.has(c.toLowerCase()),
      );
      this.columnCache.set(table, cols);
      return cols.join(',');
    }

    const fallback = ['id', 'branch_id', 'created_at'];
    this.columnCache.set(table, fallback);
    return fallback.join(',');
  }

  private async enrichSubscriptionTables(
    supabase: SupabaseClient,
    sections: Record<string, unknown[]>,
  ): Promise<void> {
    const subscriptionIds = this.pluckIds(sections.subscriptions, 'id');
    for (const { key, table, fk } of SUBSCRIPTION_CHILD_TABLES) {
      if (EXCLUDED_TABLES.has(table)) continue;
      sections[key] =
        subscriptionIds.length > 0
          ? await this.fetchByForeignKey(supabase, table, fk, subscriptionIds, {
              isSubscriptionTable: true,
            })
          : [];
    }
  }

  private async enrichChildTables(
    supabase: SupabaseClient,
    sections: Record<string, unknown[]>,
  ): Promise<void> {
    const levelIds = this.pluckIds(sections.levels, 'id');
    if (levelIds.length) {
      sections.level_classes = await this.fetchByForeignKey(
        supabase,
        'level_classes',
        'level_id',
        levelIds,
      );
    } else {
      sections.level_classes = [];
    }

    const templateIds = this.pluckIds(sections.grade_templates, 'id');
    if (templateIds.length) {
      sections.grade_ranges = await this.fetchByForeignKey(
        supabase,
        'grade_ranges',
        'grade_template_id',
        templateIds,
      );
    } else {
      sections.grade_ranges = [];
    }

    const studentIds = this.pluckIds(sections.students, 'id');
    if (studentIds.length) {
      sections.parent_students = await this.fetchByForeignKey(
        supabase,
        'parent_students',
        'student_id',
        studentIds,
      );
    } else {
      sections.parent_students = [];
    }

    const challanIds = this.pluckIds(sections.fee_challans, 'id');
    if (challanIds.length) {
      sections.fee_challan_items = await this.fetchByForeignKey(
        supabase,
        'fee_challan_items',
        'challan_id',
        challanIds,
      );
    } else {
      sections.fee_challan_items = [];
    }

    const requestIds = this.pluckIds(sections.uniform_requests, 'id');
    if (requestIds.length) {
      sections.uniform_request_items = await this.fetchByForeignKey(
        supabase,
        'uniform_request_items',
        'request_id',
        requestIds,
      );
    } else {
      sections.uniform_request_items = [];
    }

    const conversationIds = this.pluckIds(sections.conversations, 'id');
    if (conversationIds.length) {
      sections.conversation_participants = await this.fetchByForeignKey(
        supabase,
        'conversation_participants',
        'conversation_id',
        conversationIds,
      );
      sections.messages = await this.fetchByForeignKey(
        supabase,
        'messages',
        'conversation_id',
        conversationIds,
      );
      const messageIds = this.pluckIds(sections.messages, 'id');
      sections.message_reads =
        messageIds.length > 0
          ? await this.fetchByForeignKey(supabase, 'message_reads', 'message_id', messageIds)
          : [];
    } else {
      sections.conversation_participants = [];
      sections.messages = [];
      sections.message_reads = [];
    }
  }

  private pluckIds(rows: unknown[] | undefined, key: string): string[] {
    if (!rows?.length) return [];
    const ids: string[] = [];
    for (const row of rows) {
      const id = (row as Record<string, unknown>)[key];
      if (typeof id === 'string') ids.push(id);
    }
    return ids;
  }

  private async fetchByForeignKey(
    supabase: SupabaseClient,
    table: string,
    column: string,
    ids: string[],
    options?: { isSubscriptionTable?: boolean },
  ): Promise<Record<string, unknown>[]> {
    const select = await this.resolveSelectColumns(
      supabase,
      table,
      options?.isSubscriptionTable ?? false,
    );
    const all: Record<string, unknown>[] = [];
    const chunkSize = 200;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const { data, error } = await supabase.from(table).select(select).in(column, chunk);
      if (error) throw new BadRequestException(`${table}: ${error.message}`);
      for (const row of data ?? []) {
        all.push(
          sanitizeExportRow(row as unknown as Record<string, unknown>, {
            isSubscriptionTable: options?.isSubscriptionTable,
          }),
        );
      }
    }
    return all;
  }

  private async fetchBranchScopedTable(
    supabase: SupabaseClient,
    table: string,
    branchIds: string[],
    options: { isSubscriptionTable: boolean },
  ): Promise<Record<string, unknown>[]> {
    if (branchIds.length === 0) return [];
    let select: string;
    try {
      select = await this.resolveSelectColumns(supabase, table, options.isSubscriptionTable);
    } catch {
      select = 'id, branch_id, created_at';
    }
    if (!select) return [];

    const all: Record<string, unknown>[] = [];
    let offset = 0;
    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select(select)
        .in('branch_id', branchIds)
        .range(offset, offset + EXPORT_ROW_PAGE_SIZE - 1);
      if (error) {
        if (error.message.includes('branch_id')) {
          return [];
        }
        throw new BadRequestException(`${table}: ${error.message}`);
      }
      const rows = data ?? [];
      for (const row of rows) {
        all.push(
          sanitizeExportRow(row as unknown as Record<string, unknown>, {
            isSubscriptionTable: options.isSubscriptionTable,
          }),
        );
      }
      if (rows.length < EXPORT_ROW_PAGE_SIZE) break;
      offset += EXPORT_ROW_PAGE_SIZE;
    }
    return all;
  }

  private async fetchTenantScopedTable(
    supabase: SupabaseClient,
    table: string,
    tenantId: string,
  ): Promise<Record<string, unknown>[]> {
    let select: string;
    try {
      select = await this.resolveSelectColumns(supabase, table, true);
    } catch {
      select = 'id, tenant_id, created_at';
    }
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .eq('tenant_id', tenantId);
    if (error) throw new BadRequestException(`${table}: ${error.message}`);
    return (data ?? []).map((row) =>
      sanitizeExportRow(row as unknown as Record<string, unknown>, {
        isSubscriptionTable: true,
      }),
    );
  }
}
