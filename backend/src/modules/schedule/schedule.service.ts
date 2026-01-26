import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { QueryTimingTemplatesDto } from './dto/query-timing-templates.dto';
import { TimingTemplateDto } from './dto/timing-template.dto';
import { PublicHolidayDto } from './dto/public-holiday.dto';
import { VacationDto } from './dto/vacation.dto';
import { TimingSlotDto } from './dto/timing-slot.dto';

type Meta = { total: number; page: number; limit: number; totalPages: number };

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

type SchoolDayRow = {
  id: string;
  day_of_week: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type TimingTemplateRow = {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  period_duration_minutes: number;
  created_at: string;
  updated_at: string;
};

type TimingSlotRow = {
  id: string;
  timing_template_id: string;
  name: string;
  start_time: string | null;
  end_time: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type ClassTimingAssignmentRow = {
  class_id: string;
  timing_template_id: string;
};

type PublicHolidayRow = {
  id: string;
  name: string;
  name_ar: string | null;
  start_date: string;
  end_date: string;
  academic_year_id: string;
  created_at: string;
  updated_at: string;
};

type VacationRow = {
  id: string;
  name: string;
  name_ar: string | null;
  start_date: string;
  end_date: string;
  academic_year_id: string;
  created_at: string;
  updated_at: string;
};

function mapTimingSlot(row: TimingSlotRow): TimingSlotDto {
  return {
    id: row.id,
    name: row.name,
    startTime: row.start_time ?? undefined,
    endTime: row.end_time ?? undefined,
    sortOrder: row.sort_order,
  };
}

function mapTimingTemplate(row: TimingTemplateRow, assignedClassIds: string[], slots: TimingSlotDto[]): TimingTemplateDto {
  return new TimingTemplateDto({
    id: row.id,
    name: row.name,
    startTime: row.start_time,
    endTime: row.end_time,
    periodDurationMinutes: row.period_duration_minutes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    assignedClassIds,
    slots,
  });
}

function mapPublicHoliday(row: PublicHolidayRow): PublicHolidayDto {
  return new PublicHolidayDto({
    id: row.id,
    name: row.name,
    nameAr: row.name_ar ?? undefined,
    startDate: row.start_date,
    endDate: row.end_date,
    academicYearId: row.academic_year_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function mapVacation(row: VacationRow): VacationDto {
  return {
    id: row.id,
    name: row.name,
    nameAr: row.name_ar ?? undefined,
    startDate: row.start_date,
    endDate: row.end_date,
    academicYearId: row.academic_year_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

@Injectable()
export class ScheduleService {
  constructor(private readonly supabaseConfig: SupabaseConfig) {}

  async getSchoolDays(): Promise<{ data: number[] }> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('school_days')
      .select('day_of_week,is_active')
      .eq('is_active', true)
      .order('day_of_week', { ascending: true });
    throwIfDbError(error);

    const activeDays = ((data as Pick<SchoolDayRow, 'day_of_week'>[]) ?? []).map((d) => d.day_of_week);
    return { data: activeDays };
  }

  async updateSchoolDays(activeDays: number[]): Promise<{ data: number[] }> {
    const unique = Array.from(new Set(activeDays)).sort((a, b) => a - b);
    if (unique.some((d) => d < 0 || d > 6)) {
      throw new BadRequestException('activeDays must be between 0 and 6');
    }

    const supabase = this.supabaseConfig.getClient();

    // Soft approach: ensure rows exist for all 0..6, then update is_active
    const allDays = [0, 1, 2, 3, 4, 5, 6];

    const { data: existingRows, error: existingError } = await supabase
      .from('school_days')
      .select('day_of_week');
    throwIfDbError(existingError);

    const existing = new Set(((existingRows as Pick<SchoolDayRow, 'day_of_week'>[]) ?? []).map((r) => r.day_of_week));
    const toInsert = allDays.filter((d) => !existing.has(d)).map((d) => ({ day_of_week: d, is_active: false }));
    if (toInsert.length > 0) {
      const { error: insertError } = await supabase.from('school_days').insert(toInsert);
      throwIfDbError(insertError);
    }

    // Update all to inactive, then set selected to active
    const { error: setInactiveError } = await supabase.from('school_days').update({ is_active: false }).in('day_of_week', allDays);
    throwIfDbError(setInactiveError);

    if (unique.length > 0) {
      const { error: setActiveError } = await supabase.from('school_days').update({ is_active: true }).in('day_of_week', unique);
      throwIfDbError(setActiveError);
    }

    return { data: unique };
  }

  async listTimingTemplates(
    query: QueryTimingTemplatesDto,
    branchId: string,
  ): Promise<{ data: TimingTemplateDto[]; meta: Meta }> {
    const supabase = this.supabaseConfig.getClient();
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const sortBy = query.sortBy ?? 'created_at';
    const sortOrder = query.sortOrder ?? 'desc';

    let dbQuery = supabase
      .from('timing_templates')
      .select('*', { count: 'exact' })
      .eq('branch_id', branchId)
      .range(from, to)
      .order(sortBy, { ascending: sortOrder === 'asc' });

    if (query.search) {
      dbQuery = dbQuery.ilike('name', `%${query.search}%`);
    }

    const { data, error, count } = await dbQuery;
    throwIfDbError(error);

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const rows = (data as TimingTemplateRow[]) ?? [];
    const templateIds = rows.map((t) => t.id);

    let assignments: ClassTimingAssignmentRow[] = [];
    if (templateIds.length > 0) {
      const { data: a, error: aError } = await supabase
        .from('class_timing_assignments')
        .select('class_id,timing_template_id')
        .in('timing_template_id', templateIds);
      throwIfDbError(aError);
      assignments = (a as ClassTimingAssignmentRow[]) ?? [];
    }

    const classesByTemplate = new Map<string, string[]>();
    for (const a of assignments) {
      const arr = classesByTemplate.get(a.timing_template_id) ?? [];
      arr.push(a.class_id);
      classesByTemplate.set(a.timing_template_id, arr);
    }

    // Fetch slots for these templates
    let slotRows: TimingSlotRow[] = [];
    if (templateIds.length > 0) {
      const { data: s, error: sError } = await supabase
        .from('timing_template_slots')
        .select('*')
        .in('timing_template_id', templateIds)
        .order('sort_order', { ascending: true });
      throwIfDbError(sError);
      slotRows = (s as TimingSlotRow[]) ?? [];
    }

    const slotsByTemplate = new Map<string, TimingSlotDto[]>();
    for (const slot of slotRows) {
      const arr = slotsByTemplate.get(slot.timing_template_id) ?? [];
      arr.push(mapTimingSlot(slot));
      slotsByTemplate.set(slot.timing_template_id, arr);
    }

    return {
      data: rows.map((r) => mapTimingTemplate(r, classesByTemplate.get(r.id) ?? [], slotsByTemplate.get(r.id) ?? [])),
      meta: { total, page, limit, totalPages },
    };
  }

  async createTimingTemplate(
    input: {
      name: string;
      startTime: string;
      endTime: string;
      periodDurationMinutes?: number;
      slots?: Array<{ name: string; startTime?: string; endTime?: string; sortOrder?: number }>;
    },
    branchId: string,
    tenantId: string | null,
  ): Promise<TimingTemplateDto> {
    if (input.startTime >= input.endTime) {
      throw new BadRequestException('startTime must be before endTime');
    }

    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('timing_templates')
      .insert({
        name: input.name,
        start_time: input.startTime,
        end_time: input.endTime,
        period_duration_minutes: input.periodDurationMinutes ?? 60,
        branch_id: branchId,
        tenant_id: tenantId,
      })
      .select('*')
      .single();
    throwIfDbError(error);

    const template = data as TimingTemplateRow;
    const createdSlots: TimingSlotDto[] = [];

    // Create slots if provided
    if (input.slots && input.slots.length > 0) {
      const slotsToInsert = input.slots.map((slot, index) => ({
        timing_template_id: template.id,
        name: slot.name,
        start_time: slot.startTime ?? null,
        end_time: slot.endTime ?? null,
        sort_order: slot.sortOrder ?? index,
      }));

      const { data: slotData, error: slotError } = await supabase
        .from('timing_template_slots')
        .insert(slotsToInsert)
        .select('*');
      throwIfDbError(slotError);

      createdSlots.push(...((slotData as TimingSlotRow[]) ?? []).map(mapTimingSlot));
    }

    return mapTimingTemplate(template, [], createdSlots);
  }

  async assignClassesToTimingTemplate(timingTemplateId: string, classIds: string[]): Promise<{ data: string[] }> {
    const supabase = this.supabaseConfig.getClient();

    const { data: template, error: templateError } = await supabase
      .from('timing_templates')
      .select('id')
      .eq('id', timingTemplateId)
      .maybeSingle();
    throwIfDbError(templateError);
    if (!template) throw new NotFoundException('Timing template not found');

    const unique = Array.from(new Set(classIds));

    // For each class, upsert single assignment row to this template.
    // Strategy: delete existing assignments for these classes, then insert new ones.
    if (unique.length > 0) {
      const { error: deleteError } = await supabase
        .from('class_timing_assignments')
        .delete()
        .in('class_id', unique);
      throwIfDbError(deleteError);

      const payload = unique.map((classId) => ({
        class_id: classId,
        timing_template_id: timingTemplateId,
      }));
      const { error: insertError } = await supabase.from('class_timing_assignments').insert(payload);
      throwIfDbError(insertError);
    }

    return { data: unique };
  }

  async listPublicHolidays(academicYearId: string, branchId: string): Promise<{ data: PublicHolidayDto[] }> {
    const supabase = this.supabaseConfig.getClient();

    const { data, error } = await supabase
      .from('public_holidays')
      .select('*')
      .eq('academic_year_id', academicYearId)
      .eq('branch_id', branchId)
      .order('start_date', { ascending: true });
    throwIfDbError(error);

    return { data: ((data as PublicHolidayRow[]) ?? []).map(mapPublicHoliday) };
  }

  async createPublicHoliday(
    input: {
      name: string;
      nameAr?: string;
      startDate: string;
      endDate: string;
      academicYearId: string;
    },
    branchId: string,
    tenantId: string | null,
  ): Promise<PublicHolidayDto> {
    if (input.startDate > input.endDate) {
      throw new BadRequestException('startDate must be on or before endDate');
    }

    const supabase = this.supabaseConfig.getClient();
    const { data: year, error: yearError } = await supabase
      .from('academic_years')
      .select('id,start_date,end_date')
      .eq('id', input.academicYearId)
      .single();
    throwIfDbError(yearError);

    const yr = year as { start_date: string; end_date: string };
    if (input.startDate < yr.start_date || input.endDate > yr.end_date) {
      throw new BadRequestException('Holiday must be within the academic year date range');
    }

    const { data, error } = await supabase
      .from('public_holidays')
      .insert({
        name: input.name,
        name_ar: input.nameAr ?? null,
        start_date: input.startDate,
        end_date: input.endDate,
        academic_year_id: input.academicYearId,
        branch_id: branchId,
        tenant_id: tenantId,
      })
      .select('*')
      .single();
    throwIfDbError(error);

    return mapPublicHoliday(data as PublicHolidayRow);
  }

  async updatePublicHoliday(id: string, input: { name?: string; nameAr?: string; startDate?: string; endDate?: string }): Promise<PublicHolidayDto> {
    const supabase = this.supabaseConfig.getClient();

    const { data: existing, error: existingError } = await supabase
      .from('public_holidays')
      .select('*')
      .eq('id', id)
      .single();
    if (existingError || !existing) throw new NotFoundException('Holiday not found');

    const current = existing as PublicHolidayRow;
    const startDate = input.startDate ?? current.start_date;
    const endDate = input.endDate ?? current.end_date;

    if (startDate > endDate) {
      throw new BadRequestException('startDate must be on or before endDate');
    }

    // Ensure still inside academic year
    const { data: year, error: yearError } = await supabase
      .from('academic_years')
      .select('start_date,end_date')
      .eq('id', current.academic_year_id)
      .single();
    throwIfDbError(yearError);

    const yr = year as { start_date: string; end_date: string };
    if (startDate < yr.start_date || endDate > yr.end_date) {
      throw new BadRequestException('Holiday must be within the academic year date range');
    }

    const { data, error } = await supabase
      .from('public_holidays')
      .update({
        name: input.name ?? current.name,
        name_ar: input.nameAr ?? current.name_ar,
        start_date: startDate,
        end_date: endDate,
      })
      .eq('id', id)
      .select('*')
      .single();
    throwIfDbError(error);

    return mapPublicHoliday(data as PublicHolidayRow);
  }

  async deletePublicHoliday(id: string): Promise<{ data: { id: string } }> {
    const supabase = this.supabaseConfig.getClient();
    const { error } = await supabase.from('public_holidays').delete().eq('id', id);
    throwIfDbError(error);
    return { data: { id } };
  }

  async listVacations(academicYearId: string): Promise<{ data: VacationDto[] }> {
    const supabase = this.supabaseConfig.getClient();

    const { data, error } = await supabase
      .from('vacations')
      .select('*')
      .eq('academic_year_id', academicYearId)
      .order('start_date', { ascending: true });
    throwIfDbError(error);

    return { data: ((data as VacationRow[]) ?? []).map(mapVacation) };
  }

  async createVacation(input: {
    name: string;
    nameAr?: string;
    startDate: string;
    endDate: string;
    academicYearId: string;
  }): Promise<VacationDto> {
    if (input.startDate > input.endDate) {
      throw new BadRequestException('startDate must be on or before endDate');
    }

    const supabase = this.supabaseConfig.getClient();
    const { data: year, error: yearError } = await supabase
      .from('academic_years')
      .select('id,start_date,end_date')
      .eq('id', input.academicYearId)
      .single();
    throwIfDbError(yearError);

    const yr = year as { start_date: string; end_date: string };
    if (input.startDate < yr.start_date || input.endDate > yr.end_date) {
      throw new BadRequestException('Vacation must be within the academic year date range');
    }

    const { data, error } = await supabase
      .from('vacations')
      .insert({
        name: input.name,
        name_ar: input.nameAr ?? null,
        start_date: input.startDate,
        end_date: input.endDate,
        academic_year_id: input.academicYearId,
      })
      .select('*')
      .single();
    throwIfDbError(error);

    return mapVacation(data as VacationRow);
  }

  async updateVacation(id: string, input: { name?: string; nameAr?: string; startDate?: string; endDate?: string }): Promise<VacationDto> {
    const supabase = this.supabaseConfig.getClient();

    const { data: existing, error: existingError } = await supabase
      .from('vacations')
      .select('*')
      .eq('id', id)
      .single();
    if (existingError || !existing) throw new NotFoundException('Vacation not found');

    const current = existing as VacationRow;
    const startDate = input.startDate ?? current.start_date;
    const endDate = input.endDate ?? current.end_date;

    if (startDate > endDate) {
      throw new BadRequestException('startDate must be on or before endDate');
    }

    // Ensure still inside academic year
    const { data: year, error: yearError } = await supabase
      .from('academic_years')
      .select('start_date,end_date')
      .eq('id', current.academic_year_id)
      .single();
    throwIfDbError(yearError);

    const yr = year as { start_date: string; end_date: string };
    if (startDate < yr.start_date || endDate > yr.end_date) {
      throw new BadRequestException('Vacation must be within the academic year date range');
    }

    const { data, error } = await supabase
      .from('vacations')
      .update({
        name: input.name ?? current.name,
        name_ar: input.nameAr ?? current.name_ar,
        start_date: startDate,
        end_date: endDate,
      })
      .eq('id', id)
      .select('*')
      .single();
    throwIfDbError(error);

    return mapVacation(data as VacationRow);
  }

  async deleteVacation(id: string): Promise<{ data: { id: string } }> {
    const supabase = this.supabaseConfig.getClient();
    const { error } = await supabase.from('vacations').delete().eq('id', id);
    throwIfDbError(error);
    return { data: { id } };
  }
}


