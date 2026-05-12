import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { CreateFeeStudentTemplateLinkDto, UpdateFeeStudentTemplateLinkDto } from './dto/create-student-template-link.dto';
import { CreateFeeMetricExclusionDto } from './dto/create-metric-exclusion.dto';

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  if (error.code === '23505') throw new ConflictException('Record already exists');
  throw new BadRequestException(error.message);
}

@Injectable()
export class FeeStudentConfigService {
  constructor(private readonly supabaseConfig: SupabaseConfig) {}

  async createStudentTemplateLink(
    input: CreateFeeStudentTemplateLinkDto,
    branchId: string,
  ): Promise<{ data: { id: string } }> {
    const supabase = this.supabaseConfig.getClient();

    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('id', input.studentId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(studentError);
    if (!student) throw new NotFoundException('Student not found');

    const { data: template, error: templateError } = await supabase
      .from('fee_templates')
      .select('id, scope, is_active')
      .eq('id', input.templateId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(templateError);
    if (!template) throw new NotFoundException('Fee template not found');

    const scope = (template as { scope: string }).scope;
    if (scope !== 'Individual') {
      throw new BadRequestException('Only Individual-scope templates can be linked directly to a student');
    }
    if ((template as { is_active: boolean }).is_active === false) {
      throw new BadRequestException('Template is inactive');
    }

    if ((input.startDate && !input.endDate) || (!input.startDate && input.endDate)) {
      throw new BadRequestException('Start date and end date must both be provided for date-ranged links');
    }
    if (input.startDate && input.endDate) {
      const start = new Date(input.startDate);
      const end = new Date(input.endDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new BadRequestException('Invalid dates');
      }
      if (end < start) throw new BadRequestException('End date must be on or after start date');
    }

    const { data: row, error } = await supabase
      .from('fee_student_template_links')
      .insert({
        student_id: input.studentId,
        template_id: input.templateId,
        start_date: input.startDate ?? null,
        end_date: input.endDate ?? null,
        is_active: true,
        branch_id: branchId,
      })
      .select('id')
      .single();

    if (error?.code === '23505') {
      throw new ConflictException('This template is already linked to the student');
    }
    throwIfDbError(error);
    if (!row) throw new BadRequestException('Failed to link template');
    return { data: { id: (row as { id: string }).id } };
  }

  async updateStudentTemplateLink(
    id: string,
    input: UpdateFeeStudentTemplateLinkDto,
    branchId: string,
  ): Promise<{ data: { id: string; isActive: boolean } }> {
    const supabase = this.supabaseConfig.getClient();

    const { data: existing, error: exErr } = await supabase
      .from('fee_student_template_links')
      .select('id, is_active')
      .eq('id', id)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(exErr);
    if (!existing) throw new NotFoundException('Template link not found');

    const { data: updated, error } = await supabase
      .from('fee_student_template_links')
      .update({ is_active: input.isActive })
      .eq('id', id)
      .eq('branch_id', branchId)
      .select('id, is_active')
      .single();
    throwIfDbError(error);
    if (!updated) throw new BadRequestException('Failed to update template link');
    return { data: { id: (updated as { id: string }).id, isActive: !!(updated as { is_active: boolean }).is_active } };
  }

  async createMetricExclusion(
    input: CreateFeeMetricExclusionDto,
    excludedByUserId: string,
    branchId: string,
  ): Promise<{ data: { id: string } }> {
    const supabase = this.supabaseConfig.getClient();

    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('id', input.studentId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(studentError);
    if (!student) throw new NotFoundException('Student not found');

    const { data: metric, error: metricError } = await supabase
      .from('fee_template_metrics')
      .select('id, template_id')
      .eq('id', input.metricId)
      .maybeSingle();
    throwIfDbError(metricError);
    if (!metric) throw new NotFoundException('Metric not found');

    const metricTemplateId = (metric as { template_id: string }).template_id;
    if (metricTemplateId !== input.templateId) {
      throw new BadRequestException('Metric does not belong to the provided template');
    }

    // Prevent excluding all fee metrics of a template (journey edge case)
    const { data: existingExclusions, error: exErr } = await supabase
      .from('fee_metric_exclusions')
      .select('metric_id')
      .eq('branch_id', branchId)
      .eq('student_id', input.studentId)
      .eq('template_id', input.templateId);
    throwIfDbError(exErr as PostgrestError | null);

    // Fallback: fetch list (template metric counts are small).
    const { data: allMetrics, error: allErr } = await supabase
      .from('fee_template_metrics')
      .select('id')
      .eq('template_id', input.templateId);
    throwIfDbError(allErr);
    const metricIds = (allMetrics ?? []).map((r) => (r as { id: string }).id);

    const excludedSet = new Set((existingExclusions ?? []).map((r) => (r as { metric_id: string }).metric_id));
    excludedSet.add(input.metricId);

    const feeMetricsCount = metricIds.length;
    if (feeMetricsCount > 0 && excludedSet.size >= feeMetricsCount) {
      throw new BadRequestException('Cannot exclude all metrics from a template');
    }

    const { data: row, error } = await supabase
      .from('fee_metric_exclusions')
      .insert({
        student_id: input.studentId,
        template_id: input.templateId,
        metric_id: input.metricId,
        excluded_by: excludedByUserId,
        reason: input.reason ?? null,
        branch_id: branchId,
      })
      .select('id')
      .single();

    if (error?.code === '23505') {
      throw new ConflictException('This metric is already excluded for the student');
    }
    throwIfDbError(error);
    if (!row) throw new BadRequestException('Failed to exclude metric');
    return { data: { id: (row as { id: string }).id } };
  }

  async deleteMetricExclusion(
    id: string,
    branchId: string,
  ): Promise<{ data: { success: boolean } }> {
    const supabase = this.supabaseConfig.getClient();

    const { data: existing, error: exErr } = await supabase
      .from('fee_metric_exclusions')
      .select('id')
      .eq('id', id)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(exErr);
    if (!existing) throw new NotFoundException('Metric exclusion not found');

    const { error } = await supabase
      .from('fee_metric_exclusions')
      .delete()
      .eq('id', id)
      .eq('branch_id', branchId);
    throwIfDbError(error);
    return { data: { success: true } };
  }
}

