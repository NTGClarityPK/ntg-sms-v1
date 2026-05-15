import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { FeeTemplateAssignmentDto, FeeTemplateDto, FeeTemplateMetricDto } from './dto/fee-template.dto';
import { CreateFeeTemplateDto } from './dto/create-fee-template.dto';
import { UpdateFeeTemplateDto } from './dto/update-fee-template.dto';
import { CreateFeeTemplateAssignmentDto } from './dto/create-fee-template-assignment.dto';

type FeeTemplateRow = {
  id: string;
  branch_id: string;
  name: string;
  type: 'Fee' | 'Discount';
  scope: 'Levels' | 'Class' | 'Class-Section' | 'Individual';
  currency_code?: 'PKR' | 'IQD' | 'SAR' | 'USD';
  auto_apply: boolean;
  auto_apply_condition: Record<string, unknown> | null;
  days_until_due: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type FeeTemplateMetricRow = {
  id: string;
  template_id: string;
  name: string;
  amount_type: 'Absolute' | 'Percentage';
  amount: number;
  per_day: boolean;
  display_order: number;
  created_at: string;
};

type FeeTemplateAssignmentRow = {
  id: string;
  scope_type: 'Level' | 'Class' | 'Section';
  scope_id: string;
  created_at: string;
};

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  if (error.code === '23505') {
    throw new ConflictException('A template with this name already exists');
  }
  throw new BadRequestException(error.message);
}

function mapMetric(row: FeeTemplateMetricRow): FeeTemplateMetricDto {
  return new FeeTemplateMetricDto({
    id: row.id,
    templateId: row.template_id,
    name: row.name,
    amountType: row.amount_type,
    amount: Number(row.amount),
    perDay: row.per_day,
    displayOrder: Number(row.display_order),
    createdAt: row.created_at,
  });
}

function mapTemplate(row: FeeTemplateRow, metrics: FeeTemplateMetricDto[]): FeeTemplateDto {
  return new FeeTemplateDto({
    id: row.id,
    branchId: row.branch_id,
    name: row.name,
    type: row.type,
    scope: row.scope,
    currencyCode: row.currency_code ?? 'PKR',
    autoApply: row.auto_apply,
    autoApplyCondition: row.auto_apply_condition,
    daysUntilDue: Number(row.days_until_due),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metrics,
  });
}

function isMissingCurrencyColumn(error: PostgrestError | null): boolean {
  const msg = error?.message ?? '';
  // Supabase/PostgREST can surface missing columns as either:
  // - "column fee_templates.currency_code does not exist"
  // - "Could not find the 'currency_code' column ... in the schema cache"
  return msg.includes('currency_code') && (msg.includes('does not exist') || msg.includes('schema cache'));
}

@Injectable()
export class TemplateService {
  constructor(private readonly supabaseConfig: SupabaseConfig) {}

  async create(
    input: CreateFeeTemplateDto,
    branchId: string,
  ): Promise<{ data: FeeTemplateDto }> {
    const supabase = this.supabaseConfig.getClient();

    const insertBase = {
      branch_id: branchId,
      name: input.name.trim(),
      type: input.type,
      scope: input.scope,
      auto_apply: input.autoApply ?? false,
      auto_apply_condition: input.autoApplyCondition ?? null,
      days_until_due: input.daysUntilDue ?? 30,
      is_active: true,
    };

    let templateRow: unknown = null;
    let templateError: PostgrestError | null = null;

    ({ data: templateRow, error: templateError } = await supabase
      .from('fee_templates')
      .insert({ ...insertBase, currency_code: input.currencyCode ?? 'PKR' })
      .select(
        'id, branch_id, name, type, scope, currency_code, auto_apply, auto_apply_condition, days_until_due, is_active, created_at, updated_at',
      )
      .single());

    // Backward-compat: DB without currency_code column
    if (isMissingCurrencyColumn(templateError)) {
      ({ data: templateRow, error: templateError } = await supabase
        .from('fee_templates')
        .insert(insertBase)
        .select(
          'id, branch_id, name, type, scope, auto_apply, auto_apply_condition, days_until_due, is_active, created_at, updated_at',
        )
        .single());
    }

    throwIfDbError(templateError);
    if (!templateRow) {
      throw new BadRequestException('Failed to create fee template');
    }

    const template = templateRow as FeeTemplateRow;

    const metricsToInsert = input.metrics.map((m, idx) => ({
      template_id: template.id,
      name: m.name.trim(),
      amount_type: m.amountType,
      amount: m.amount,
      per_day: m.perDay ?? false,
      display_order: m.displayOrder ?? idx,
    }));

    const { data: metricRows, error: metricsError } = await supabase
      .from('fee_template_metrics')
      .insert(metricsToInsert)
      .select('id, template_id, name, amount_type, amount, per_day, display_order, created_at');

    if (metricsError) {
      // Best-effort rollback so we don't leave empty templates behind.
      await supabase.from('fee_templates').delete().eq('id', template.id).eq('branch_id', branchId);
      throwIfDbError(metricsError);
    }

    const metrics = ((metricRows ?? []) as FeeTemplateMetricRow[]).map(mapMetric);
    return { data: mapTemplate(template, metrics) };
  }

  async list(
    branchId: string,
    query?: { scope?: string; type?: string; isActive?: string },
  ): Promise<{ data: FeeTemplateDto[] }> {
    const supabase = this.supabaseConfig.getClient();

    let dbQuery = supabase
      .from('fee_templates')
      .select(
        'id, branch_id, name, type, scope, currency_code, auto_apply, auto_apply_condition, days_until_due, is_active, created_at, updated_at, fee_template_metrics(id, template_id, name, amount_type, amount, per_day, display_order, created_at), fee_template_assignments(id, scope_type, scope_id, created_at)',
      )
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false });

    if (query?.scope) dbQuery = dbQuery.eq('scope', query.scope);
    if (query?.type) dbQuery = dbQuery.eq('type', query.type);
    if (query?.isActive !== undefined) {
      const v = query.isActive === 'true' || query.isActive === '1';
      dbQuery = dbQuery.eq('is_active', v);
    }

    let data: unknown = null;
    let error: PostgrestError | null = null;
    ({ data, error } = await dbQuery);

    // Backward-compat: DB without currency_code column
    if (isMissingCurrencyColumn(error)) {
      let fallbackQuery = supabase
        .from('fee_templates')
        .select(
          'id, branch_id, name, type, scope, auto_apply, auto_apply_condition, days_until_due, is_active, created_at, updated_at, fee_template_metrics(id, template_id, name, amount_type, amount, per_day, display_order, created_at), fee_template_assignments(id, scope_type, scope_id, created_at)',
        )
        .eq('branch_id', branchId)
        .order('created_at', { ascending: false });

      if (query?.scope) fallbackQuery = fallbackQuery.eq('scope', query.scope);
      if (query?.type) fallbackQuery = fallbackQuery.eq('type', query.type);
      if (query?.isActive !== undefined) {
        const v = query.isActive === 'true' || query.isActive === '1';
        fallbackQuery = fallbackQuery.eq('is_active', v);
      }

      ({ data, error } = await fallbackQuery);
    }

    throwIfDbError(error);

    const rows = (data ?? []) as Array<
      FeeTemplateRow & { fee_template_metrics: FeeTemplateMetricRow[]; fee_template_assignments: FeeTemplateAssignmentRow[] }
    >;

    return {
      data: rows.map((r) => {
        const metrics = (r.fee_template_metrics ?? []).map(mapMetric).sort((a, b) => a.displayOrder - b.displayOrder);
        const assignments = (r.fee_template_assignments ?? []).map(
          (a) =>
            new FeeTemplateAssignmentDto({
              id: a.id,
              scopeType: a.scope_type,
              scopeId: a.scope_id,
              createdAt: a.created_at,
            }),
        );
        return new FeeTemplateDto({
          ...mapTemplate(r, metrics),
          assignments,
        });
      }),
    };
  }

  async getById(id: string, branchId: string): Promise<{ data: FeeTemplateDto }> {
    const supabase = this.supabaseConfig.getClient();

    let data: unknown = null;
    let error: PostgrestError | null = null;

    ({ data, error } = await supabase
      .from('fee_templates')
      .select(
        'id, branch_id, name, type, scope, currency_code, auto_apply, auto_apply_condition, days_until_due, is_active, created_at, updated_at, fee_template_metrics(id, template_id, name, amount_type, amount, per_day, display_order, created_at), fee_template_assignments(id, scope_type, scope_id, created_at)',
      )
      .eq('id', id)
      .eq('branch_id', branchId)
      .maybeSingle());

    // Backward-compat: DB without currency_code column
    if (isMissingCurrencyColumn(error)) {
      ({ data, error } = await supabase
        .from('fee_templates')
        .select(
          'id, branch_id, name, type, scope, auto_apply, auto_apply_condition, days_until_due, is_active, created_at, updated_at, fee_template_metrics(id, template_id, name, amount_type, amount, per_day, display_order, created_at), fee_template_assignments(id, scope_type, scope_id, created_at)',
        )
        .eq('id', id)
        .eq('branch_id', branchId)
        .maybeSingle());
    }

    throwIfDbError(error);
    if (!data) throw new NotFoundException('Fee template not found');

    const row = data as FeeTemplateRow & { fee_template_metrics: FeeTemplateMetricRow[]; fee_template_assignments: FeeTemplateAssignmentRow[] };
    const metrics = (row.fee_template_metrics ?? []).map(mapMetric).sort((a, b) => a.displayOrder - b.displayOrder);
    const assignments = (row.fee_template_assignments ?? []).map(
      (a) =>
        new FeeTemplateAssignmentDto({
          id: a.id,
          scopeType: a.scope_type,
          scopeId: a.scope_id,
          createdAt: a.created_at,
        }),
    );
    return { data: new FeeTemplateDto({ ...mapTemplate(row, metrics), assignments }) };
  }

  async update(
    id: string,
    input: UpdateFeeTemplateDto,
    branchId: string,
  ): Promise<{ data: FeeTemplateDto }> {
    const supabase = this.supabaseConfig.getClient();

    const { data: existing, error: existingError } = await supabase
      .from('fee_templates')
      .select('id')
      .eq('id', id)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(existingError);
    if (!existing) throw new NotFoundException('Fee template not found');

    const updates: Record<string, unknown> = {
      name: input.name?.trim(),
      type: input.type,
      scope: input.scope,
      currency_code: input.currencyCode,
      auto_apply: input.autoApply,
      auto_apply_condition: input.autoApplyCondition,
      days_until_due: input.daysUntilDue,
      is_active: input.isActive,
    };

    const { data: updatedRow, error: updateError } = await supabase
      .from('fee_templates')
      .update(updates)
      .eq('id', id)
      .eq('branch_id', branchId)
      .select(
        'id, branch_id, name, type, scope, currency_code, auto_apply, auto_apply_condition, days_until_due, is_active, created_at, updated_at',
      )
      .single();

    // Backward-compat: DB without currency_code column
    if (isMissingCurrencyColumn(updateError)) {
      const fallbackUpdates = { ...updates };
      delete fallbackUpdates.currency_code;
      const { error: fbErr } = await supabase
        .from('fee_templates')
        .update(fallbackUpdates)
        .eq('id', id)
        .eq('branch_id', branchId);
      throwIfDbError(fbErr);
      // Currency isn't stored on older DBs, so just return updated template using PKR default.
      return this.getById(id, branchId);
    }

    throwIfDbError(updateError);
    if (!updatedRow) throw new BadRequestException('Failed to update fee template');

    // If metrics are provided, replace them (versioning is handled at template level per journeys).
    if (input.metrics) {
      await supabase.from('fee_template_metrics').delete().eq('template_id', id);
      const metricsToInsert = input.metrics.map((m, idx) => ({
        template_id: id,
        name: m.name.trim(),
        amount_type: m.amountType,
        amount: m.amount,
        per_day: m.perDay ?? false,
        display_order: m.displayOrder ?? idx,
      }));
      const { data: metricRows, error: metricsError } = await supabase
        .from('fee_template_metrics')
        .insert(metricsToInsert)
        .select('id, template_id, name, amount_type, amount, per_day, display_order, created_at');
      throwIfDbError(metricsError);
      const metrics = ((metricRows ?? []) as FeeTemplateMetricRow[]).map(mapMetric);
      return { data: mapTemplate(updatedRow as FeeTemplateRow, metrics) };
    }

    // Otherwise, refetch with metrics.
    return this.getById(id, branchId);
  }

  async remove(id: string, branchId: string): Promise<{ data: { success: boolean } }> {
    const supabase = this.supabaseConfig.getClient();
    const { error } = await supabase.from('fee_templates').delete().eq('id', id).eq('branch_id', branchId);
    throwIfDbError(error);
    return { data: { success: true } };
  }

  async createAssignment(
    templateId: string,
    input: CreateFeeTemplateAssignmentDto,
    branchId: string,
  ): Promise<{ data: { id: string } }> {
    const supabase = this.supabaseConfig.getClient();

    const { data: template, error: templateError } = await supabase
      .from('fee_templates')
      .select('id')
      .eq('id', templateId)
      .eq('branch_id', branchId)
      .maybeSingle();

    throwIfDbError(templateError);
    if (!template) throw new NotFoundException('Fee template not found');

    const { data: row, error } = await supabase
      .from('fee_template_assignments')
      .insert({
        template_id: templateId,
        scope_type: input.scopeType,
        scope_id: input.scopeId,
        branch_id: branchId,
      })
      .select('id')
      .single();

    if (error?.code === '23505') {
      throw new ConflictException('Template is already linked to this scope');
    }
    throwIfDbError(error);
    if (!row) throw new BadRequestException('Failed to link template');
    return { data: { id: (row as { id: string }).id } };
  }
}

