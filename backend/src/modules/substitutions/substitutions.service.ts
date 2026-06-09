import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AcademicYearsService } from '../academic-years/academic-years.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import type { PostgrestError } from '@supabase/supabase-js';
import { SuggestSubstitutionsDto } from './dto/suggest-substitutions.dto';
import { AssignSubstitutionsDto } from './dto/assign-substitutions.dto';
import { QuerySubstitutionsDto } from './dto/query-substitutions.dto';
import { QuerySubstitutionLoadStatsDto } from './dto/query-substitution-load-stats.dto';
import { QuerySubstitutionOverlaysDto } from './dto/query-substitution-overlays.dto';
import { SubstitutionOverlayDto } from './dto/substitution-overlay.dto';
import {
  eachDateInRange,
  dayOfWeekFromDate,
  todayDateString,
} from './substitutions-date.util';
import type { SlotDatePair } from './substitutions-matching.util';
import {
  AffectedSlotDto,
  SuggestSubstitutionsResultDto,
} from './dto/suggested-substitute.dto';
import {
  AssignSubstitutionsResultDto,
  SubstitutionDto,
  SubstitutionLoadStatDto,
} from './dto/substitution.dto';
import {
  rankSubstituteCandidates,
  splitSuggestedAndOthers,
  type AffectedSlotForMatching,
  type CandidateBusySlot,
  type CandidateMeta,
} from './substitutions-matching.util';
import {
  clockTimeToMinutes,
  storedSlotEndToUserDisplay,
  storedTimetableSlotRangesOverlap,
} from '../timetable/timetable-slot-time.util';
import type { AbsenceReason } from './dto/absence-reason.type';

type TimetableSlotRow = {
  id: string;
  class_section_id: string;
  day_of_week: number;
  period_number: number | null;
  start_time: string;
  end_time: string;
  subject_id: string | null;
  staff_id: string | null;
  slot_type: string;
  branch_id: string;
  academic_year_id: string;
  subjects?: { name: string } | { name: string }[] | null;
};

type SubstitutionRow = {
  id: string;
  branch_id: string;
  academic_year_id: string;
  absent_teacher_id: string;
  substitute_teacher_id: string;
  absence_date: string;
  absence_reason: AbsenceReason;
  timetable_slot_id: string;
  status: string;
  notified_at: string | null;
  reminder_sent_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

function assertDateNotInPast(date: string): void {
  if (date < todayDateString()) {
    throw new BadRequestException('Absence date cannot be in the past');
  }
}

function assertValidDateRange(startDate: string, endDate?: string): string[] {
  assertDateNotInPast(startDate);
  if (!endDate || endDate === startDate) {
    return [startDate];
  }
  if (endDate < startDate) {
    throw new BadRequestException('End date must be on or after start date');
  }
  return eachDateInRange(startDate, endDate);
}

function monthRangeForDate(date: string): { start: string; end: string } {
  const [y, m] = date.split('-');
  const lastDay = new Date(parseInt(y, 10), parseInt(m, 10), 0).getDate();
  return {
    start: `${y}-${m}-01`,
    end: `${y}-${m}-${String(lastDay).padStart(2, '0')}`,
  };
}

function periodLabel(slot: { period_number: number | null; start_time: string; end_time: string }): string {
  if (slot.period_number != null) {
    return `Period ${slot.period_number}`;
  }
  const endDisplay = storedSlotEndToUserDisplay(slot.end_time);
  return `${slot.start_time}–${endDisplay}`;
}

@Injectable()
export class SubstitutionsService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly academicYearsService: AcademicYearsService,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async suggest(
    input: SuggestSubstitutionsDto,
    branchId: string,
  ): Promise<{ data: SuggestSubstitutionsResultDto }> {
    const dates = assertValidDateRange(input.date, input.endDate);
    const academicYearId = await this.resolveAcademicYearId(branchId);
    const daysInRange = [...new Set(dates.map((d) => dayOfWeekFromDate(d)))];

    const absentMeta = await this.fetchStaffProfile(input.absentTeacherId, branchId);
    const allSlots = await this.fetchAllClassSlotsForTeacher(
      input.absentTeacherId,
      branchId,
      academicYearId,
    );

    const pairs: SlotDatePair[] = [];
    const slotIdsSeen = new Set<string>();
    const affectedSlotsUnique: TimetableSlotRow[] = [];

    for (const dateStr of dates) {
      const dow = dayOfWeekFromDate(dateStr);
      for (const slot of allSlots.filter((s) => s.day_of_week === dow)) {
        pairs.push({
          date: dateStr,
          slot: {
            id: slot.id,
            subjectId: slot.subject_id,
            startTime: slot.start_time,
            endTime: storedSlotEndToUserDisplay(slot.end_time),
            storedEndTime: slot.end_time,
          },
        });
        if (!slotIdsSeen.has(slot.id)) {
          slotIdsSeen.add(slot.id);
          affectedSlotsUnique.push(slot);
        }
      }
    }

    const affectedDtos = await this.mapAffectedSlotsToDtos(affectedSlotsUnique);

    const { candidates, busyByStaff } = await this.buildCandidatePool(
      input.absentTeacherId,
      branchId,
      academicYearId,
      daysInRange,
      dates,
    );

    const ranked = rankSubstituteCandidates(pairs, candidates, busyByStaff);
    const { suggested, others } = splitSuggestedAndOthers(ranked);

    return {
      data: new SuggestSubstitutionsResultDto({
        absentTeacherId: input.absentTeacherId,
        absentTeacherName: absentMeta.fullName,
        date: input.date,
        endDate: input.endDate && input.endDate !== input.date ? input.endDate : undefined,
        totalPeriodAssignments: pairs.length,
        affectedSlots: affectedDtos,
        suggested,
        others,
      }),
    };
  }

  async getOverlays(
    query: QuerySubstitutionOverlaysDto,
    branchId: string,
  ): Promise<{ data: SubstitutionOverlayDto[] }> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('teacher_substitutions')
      .select(
        'id, timetable_slot_id, absence_date, absent_teacher_id, substitute_teacher_id, status',
      )
      .eq('branch_id', branchId)
      .gte('absence_date', query.startDate)
      .lte('absence_date', query.endDate)
      .in('status', ['confirmed', 'completed']);
    throwIfDbError(error);

    const rows = (data as SubstitutionRow[]) ?? [];
    if (rows.length === 0) {
      return { data: [] };
    }

    const staffIds = [
      ...new Set(rows.flatMap((r) => [r.absent_teacher_id, r.substitute_teacher_id])),
    ];
    const nameByStaff = await this.fetchStaffNamesByIds(staffIds, branchId);

    const overlays = rows.map(
      (row) =>
        new SubstitutionOverlayDto({
          substitutionId: row.id,
          timetableSlotId: row.timetable_slot_id,
          absenceDate: row.absence_date,
          absentTeacherId: row.absent_teacher_id,
          absentTeacherName: nameByStaff.get(row.absent_teacher_id) ?? 'Unknown',
          substituteTeacherId: row.substitute_teacher_id,
          substituteTeacherName: nameByStaff.get(row.substitute_teacher_id) ?? 'Unknown',
        }),
    );

    return { data: overlays };
  }

  async assign(
    input: AssignSubstitutionsDto,
    branchId: string,
    userId: string,
    userEmail?: string,
  ): Promise<{ data: AssignSubstitutionsResultDto }> {
    const dates = assertValidDateRange(input.date, input.endDate);
    if (input.absentTeacherId === input.substituteTeacherId) {
      throw new BadRequestException('Substitute cannot be the same as the absent teacher');
    }

    const academicYearId = await this.resolveAcademicYearId(branchId);
    const slots = await this.fetchSlotsByIds(input.timetableSlotIds, branchId, academicYearId);
    if (slots.length !== input.timetableSlotIds.length) {
      throw new BadRequestException('One or more timetable slots were not found');
    }

    const slotById = new Map(slots.map((s) => [s.id, s]));
    for (const slot of slots) {
      if (slot.staff_id !== input.absentTeacherId) {
        throw new BadRequestException('Timetable slot is not assigned to the absent teacher');
      }
      if (slot.slot_type !== 'class') {
        throw new BadRequestException('Only class periods can be substituted');
      }
    }

    const substituteMeta = await this.fetchStaffProfile(input.substituteTeacherId, branchId);
    const absentMeta = await this.fetchStaffProfile(input.absentTeacherId, branchId);

    const monthlyCount = await this.countSubstitutionsForMonth(
      input.substituteTeacherId,
      branchId,
      input.date,
    );
    if (monthlyCount > 8) {
      throw new ConflictException(
        `Substitute already has ${monthlyCount} substitutions this month (limit warning: 8)`,
      );
    }

    const inserts: Array<{
      branch_id: string;
      academic_year_id: string;
      absent_teacher_id: string;
      substitute_teacher_id: string;
      absence_date: string;
      absence_reason: AbsenceReason;
      timetable_slot_id: string;
      status: string;
      notified_at: string;
      created_by: string;
    }> = [];

    for (const dateStr of dates) {
      const dow = dayOfWeekFromDate(dateStr);
      const slotsForDay = input.timetableSlotIds
        .map((id) => slotById.get(id))
        .filter((s): s is TimetableSlotRow => !!s && s.day_of_week === dow);

      if (slotsForDay.length === 0) continue;

      if (await this.isStaffAbsentOnDate(input.substituteTeacherId, branchId, dateStr)) {
        throw new ConflictException(
          `Substitute teacher is marked absent on ${dateStr}`,
        );
      }

      const busySlots = await this.fetchStaffBusySlots(
        input.substituteTeacherId,
        branchId,
        academicYearId,
        dow,
      );

      for (const slot of slotsForDay) {
        if (await this.hasActiveSubstitution(slot.id, dateStr)) {
          throw new ConflictException(
            `A substitution already exists for this period on ${dateStr}`,
          );
        }
        for (const busy of busySlots) {
          if (
            storedTimetableSlotRangesOverlap(
              slot.start_time,
              slot.end_time,
              busy.start_time,
              busy.end_time,
            )
          ) {
            throw new ConflictException(
              `Substitute teacher already has a class on ${dateStr} during this period`,
            );
          }
        }
      }

      const now = new Date().toISOString();
      for (const slot of slotsForDay) {
        inserts.push({
          branch_id: branchId,
          academic_year_id: academicYearId,
          absent_teacher_id: input.absentTeacherId,
          substitute_teacher_id: input.substituteTeacherId,
          absence_date: dateStr,
          absence_reason: input.absenceReason,
          timetable_slot_id: slot.id,
          status: 'confirmed',
          notified_at: now,
          created_by: userId,
        });
      }
    }

    if (inserts.length === 0) {
      throw new BadRequestException(
        'No class periods fall on the selected dates for the chosen timetable slots',
      );
    }

    const supabase = this.supabaseConfig.getClient();
    const { data: inserted, error } = await supabase
      .from('teacher_substitutions')
      .insert(inserts)
      .select(
        'id, branch_id, academic_year_id, absent_teacher_id, substitute_teacher_id, absence_date, absence_reason, timetable_slot_id, status, notified_at, reminder_sent_at, created_by, created_at, updated_at',
      );
    throwIfDbError(error);

    const rows = (inserted as SubstitutionRow[]) ?? [];
    const rowsByDate = new Map<string, SubstitutionRow[]>();
    for (const row of rows) {
      const list = rowsByDate.get(row.absence_date) ?? [];
      list.push(row);
      rowsByDate.set(row.absence_date, list);
    }

    for (const [dateStr, dayRows] of rowsByDate) {
      const periodCount = dayRows.length;
      await this.notificationsService.createNotification({
        userId: substituteMeta.userId,
        type: 'teacher_substitution',
        title: 'Substitution assignment',
        body:
          dates.length > 1
            ? `You're covering for ${absentMeta.fullName} on ${dateStr} (${periodCount} period${periodCount === 1 ? '' : 's'})`
            : `You're covering for ${absentMeta.fullName} on ${dateStr} — ${periodCount} period${periodCount === 1 ? '' : 's'}`,
        data: {
          substitutionId: dayRows[0].id,
          absenceDate: dateStr,
        },
      });
    }

    if (userEmail) {
      for (const row of rows) {
        this.auditLogService
          .logCreate('teacher_substitutions', row.id, userEmail, { ...row } as Record<string, unknown>)
          .catch(() => undefined);
      }
    }

    return {
      data: new AssignSubstitutionsResultDto({
        substitutionIds: rows.map((r) => r.id),
      }),
    };
  }

  async list(
    query: QuerySubstitutionsDto,
    branchId: string,
  ): Promise<{
    data: SubstitutionDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    return this.querySubstitutions(query, branchId);
  }

  async listHistory(
    query: QuerySubstitutionsDto,
    branchId: string,
  ): Promise<{
    data: SubstitutionDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    return this.querySubstitutions(query, branchId);
  }

  async listMine(
    substituteStaffId: string,
    query: QuerySubstitutionsDto,
    branchId: string,
  ): Promise<{
    data: SubstitutionDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const supabase = this.supabaseConfig.getClient();
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let dbQuery = supabase
      .from('teacher_substitutions')
      .select(
        'id, branch_id, academic_year_id, absent_teacher_id, substitute_teacher_id, absence_date, absence_reason, timetable_slot_id, status, notified_at, reminder_sent_at, created_by, created_at, updated_at',
        { count: 'exact' },
      )
      .eq('branch_id', branchId)
      .eq('substitute_teacher_id', substituteStaffId)
      .neq('status', 'cancelled')
      .order('absence_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (query.startDate) dbQuery = dbQuery.gte('absence_date', query.startDate);
    if (query.endDate) dbQuery = dbQuery.lte('absence_date', query.endDate);
    if (query.date) dbQuery = dbQuery.eq('absence_date', query.date);

    const { data, error, count } = await dbQuery.range(from, to);
    throwIfDbError(error);

    const dtos = await this.enrichSubstitutionRows((data as SubstitutionRow[]) ?? []);
    return {
      data: dtos,
      meta: {
        total: count ?? 0,
        page,
        limit,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    };
  }

  async getLoadStats(
    query: QuerySubstitutionLoadStatsDto,
    branchId: string,
  ): Promise<{ data: SubstitutionLoadStatDto[] }> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('teacher_substitutions')
      .select('substitute_teacher_id')
      .eq('branch_id', branchId)
      .gte('absence_date', query.startDate)
      .lte('absence_date', query.endDate)
      .in('status', ['confirmed', 'completed']);
    throwIfDbError(error);

    const counts = new Map<string, number>();
    for (const row of (data as { substitute_teacher_id: string }[]) ?? []) {
      counts.set(row.substitute_teacher_id, (counts.get(row.substitute_teacher_id) ?? 0) + 1);
    }

    const staffIds = Array.from(counts.keys());
    const nameByStaffId = await this.fetchStaffNamesByIds(staffIds, branchId);

    const stats = staffIds
      .map((staffId) => {
        const count = counts.get(staffId) ?? 0;
        return new SubstitutionLoadStatDto({
          staffId,
          staffName: nameByStaffId.get(staffId) ?? 'Unknown',
          substitutionCount: count,
          isOverloaded: count > 10,
        });
      })
      .sort((a, b) => b.substitutionCount - a.substitutionCount);

    return { data: stats };
  }

  async exportHistoryCsv(
    query: QuerySubstitutionsDto,
    branchId: string,
  ): Promise<string> {
    const { data } = await this.querySubstitutions(
      { ...query, page: 1, limit: 500 },
      branchId,
    );
    const header = [
      'Date',
      'Absent Teacher',
      'Substitute',
      'Period',
      'Class',
      'Subject',
      'Status',
      'Reason',
    ];
    const lines = data.map((row) =>
      [
        row.absenceDate,
        row.absentTeacherName,
        row.substituteTeacherName,
        row.periodLabel ?? '',
        row.className && row.sectionName ? `${row.className} ${row.sectionName}` : '',
        row.subjectName ?? '',
        row.status,
        row.absenceReason,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );
    return [header.join(','), ...lines].join('\n');
  }

  async cancel(id: string, branchId: string, userEmail?: string): Promise<{ data: SubstitutionDto }> {
    const supabase = this.supabaseConfig.getClient();
    const { data: row, error } = await supabase
      .from('teacher_substitutions')
      .select(
        'id, branch_id, academic_year_id, absent_teacher_id, substitute_teacher_id, absence_date, absence_reason, timetable_slot_id, status, notified_at, reminder_sent_at, created_by, created_at, updated_at',
      )
      .eq('id', id)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(error);
    if (!row) {
      throw new NotFoundException('Substitution not found');
    }
    if ((row as SubstitutionRow).status === 'cancelled') {
      throw new BadRequestException('Substitution is already cancelled');
    }

    const slot = await this.fetchSlotById((row as SubstitutionRow).timetable_slot_id, branchId);
    if (!this.canCancelBeforePeriod((row as SubstitutionRow).absence_date, slot.start_time)) {
      throw new ForbiddenException(
        'Substitutions can only be cancelled up to 1 hour before the period starts',
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from('teacher_substitutions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(
        'id, branch_id, academic_year_id, absent_teacher_id, substitute_teacher_id, absence_date, absence_reason, timetable_slot_id, status, notified_at, reminder_sent_at, created_by, created_at, updated_at',
      )
      .single();
    throwIfDbError(updateError);

    if (userEmail) {
      const oldRow = row as SubstitutionRow;
      this.auditLogService
        .logUpdate(
          'teacher_substitutions',
          id,
          userEmail,
          { status: oldRow.status },
          { status: 'cancelled' },
          ['status'],
        )
        .catch(() => undefined);
    }

    const dtos = await this.enrichSubstitutionRows([updated as SubstitutionRow]);
    return { data: dtos[0] };
  }

  async processReminderNotifications(): Promise<void> {
    const supabase = this.supabaseConfig.getClient();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const now = new Date();

    const { data, error } = await supabase
      .from('teacher_substitutions')
      .select(
        'id, branch_id, absent_teacher_id, substitute_teacher_id, absence_date, timetable_slot_id, notified_at, reminder_sent_at, status',
      )
      .eq('status', 'confirmed')
      .not('notified_at', 'is', null)
      .lt('notified_at', oneHourAgo)
      .is('reminder_sent_at', null)
      .limit(100);
    throwIfDbError(error);

    for (const row of (data as SubstitutionRow[]) ?? []) {
      const slot = await this.fetchSlotById(row.timetable_slot_id, row.branch_id);
      const periodStart = this.periodStartDate(row.absence_date, slot.start_time);
      if (periodStart <= now) continue;

      const [absentMeta, substituteMeta] = await Promise.all([
        this.fetchStaffProfile(row.absent_teacher_id, row.branch_id),
        this.fetchStaffProfile(row.substitute_teacher_id, row.branch_id),
      ]);
      const classInfo = await this.resolveClassSectionNames(slot.class_section_id);
      const label = periodLabel(slot);

      await this.notificationsService.createNotification({
        userId: substituteMeta.userId,
        type: 'teacher_substitution',
        title: 'Substitution reminder',
        body: `Reminder: You're covering for ${absentMeta.fullName} on ${row.absence_date} - ${label} - Class ${classInfo.className} ${classInfo.sectionName}`,
        data: {
          substitutionId: row.id,
          timetableSlotId: row.timetable_slot_id,
          absenceDate: row.absence_date,
          isReminder: true,
        },
      });

      await supabase
        .from('teacher_substitutions')
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq('id', row.id);
    }
  }

  async resolveStaffIdForUser(userId: string, branchId: string): Promise<string | null> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('staff')
      .select('id')
      .eq('user_id', userId)
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .maybeSingle();
    throwIfDbError(error);
    return (data as { id: string } | null)?.id ?? null;
  }

  private async resolveAcademicYearId(branchId: string): Promise<string> {
    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) {
      throw new BadRequestException('No active academic year found');
    }
    return activeYear.id;
  }

  private async querySubstitutions(
    query: QuerySubstitutionsDto,
    branchId: string,
  ): Promise<{
    data: SubstitutionDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const supabase = this.supabaseConfig.getClient();
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let dbQuery = supabase
      .from('teacher_substitutions')
      .select(
        'id, branch_id, academic_year_id, absent_teacher_id, substitute_teacher_id, absence_date, absence_reason, timetable_slot_id, status, notified_at, reminder_sent_at, created_by, created_at, updated_at',
        { count: 'exact' },
      )
      .eq('branch_id', branchId)
      .order('absence_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (query.date) dbQuery = dbQuery.eq('absence_date', query.date);
    if (query.startDate) dbQuery = dbQuery.gte('absence_date', query.startDate);
    if (query.endDate) dbQuery = dbQuery.lte('absence_date', query.endDate);
    if (query.status) dbQuery = dbQuery.eq('status', query.status);

    const { data, error, count } = await dbQuery.range(from, to);
    throwIfDbError(error);

    const dtos = await this.enrichSubstitutionRows((data as SubstitutionRow[]) ?? []);
    return {
      data: dtos,
      meta: {
        total: count ?? 0,
        page,
        limit,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    };
  }

  private async fetchAllClassSlotsForTeacher(
    absentTeacherId: string,
    branchId: string,
    academicYearId: string,
  ): Promise<TimetableSlotRow[]> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('timetable_slots')
      .select(
        'id, class_section_id, day_of_week, period_number, start_time, end_time, subject_id, staff_id, slot_type, branch_id, academic_year_id, subjects:subject_id(name)',
      )
      .eq('staff_id', absentTeacherId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', academicYearId)
      .eq('slot_type', 'class')
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });
    throwIfDbError(error);
    return (data as TimetableSlotRow[]) ?? [];
  }

  private async mapAffectedSlotsToDtos(slots: TimetableSlotRow[]): Promise<AffectedSlotDto[]> {
    const results: AffectedSlotDto[] = [];
    for (const slot of slots) {
      const classInfo = await this.resolveClassSectionNames(slot.class_section_id);
      results.push(
        new AffectedSlotDto({
          id: slot.id,
          dayOfWeek: slot.day_of_week,
          startTime: slot.start_time,
          endTime: storedSlotEndToUserDisplay(slot.end_time),
          periodNumber: slot.period_number ?? undefined,
          subjectId: slot.subject_id ?? undefined,
          subjectName: this.extractSubjectName(slot),
          className: classInfo.className,
          sectionName: classInfo.sectionName,
        }),
      );
    }
    return results;
  }

  private async buildCandidatePool(
    absentTeacherId: string,
    branchId: string,
    academicYearId: string,
    daysOfWeek: number[],
    absenceDates: string[],
  ): Promise<{
    candidates: CandidateMeta[];
    busyByStaff: Map<string, CandidateBusySlot[]>;
  }> {
    const supabase = this.supabaseConfig.getClient();
    const { data: staffRows, error: staffError } = await supabase
      .from('staff')
      .select('id, user_id')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .neq('id', absentTeacherId);
    throwIfDbError(staffError);

    const staffList = (staffRows as { id: string; user_id: string }[]) ?? [];
    if (staffList.length === 0) {
      return { candidates: [], busyByStaff: new Map() };
    }

    const staffIds = staffList.map((s) => s.id);
    const userIds = staffList.map((s) => s.user_id);

    const month = monthRangeForDate(absenceDates[0]);

    const [profilesRes, assignmentsRes, busyRes, monthlyRes, absentRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name').in('id', userIds),
      supabase
        .from('teacher_assignments')
        .select('staff_id, subject_id, subjects:subject_id(name)')
        .eq('branch_id', branchId)
        .eq('academic_year_id', academicYearId)
        .in('staff_id', staffIds),
      supabase
        .from('timetable_slots')
        .select('id, staff_id, start_time, end_time')
        .eq('branch_id', branchId)
        .eq('academic_year_id', academicYearId)
        .in('day_of_week', daysOfWeek)
        .in('staff_id', staffIds)
        .not('staff_id', 'is', null),
      supabase
        .from('teacher_substitutions')
        .select('substitute_teacher_id')
        .eq('branch_id', branchId)
        .gte('absence_date', month.start)
        .lte('absence_date', month.end)
        .in('substitute_teacher_id', staffIds)
        .in('status', ['confirmed', 'completed']),
      supabase
        .from('teacher_substitutions')
        .select('absent_teacher_id, absence_date')
        .eq('branch_id', branchId)
        .in('absence_date', absenceDates)
        .in('absent_teacher_id', staffIds)
        .neq('status', 'cancelled'),
    ]);

    throwIfDbError(profilesRes.error);
    throwIfDbError(assignmentsRes.error);
    throwIfDbError(busyRes.error);
    throwIfDbError(monthlyRes.error);
    throwIfDbError(absentRes.error);

    const nameByUserId = new Map(
      ((profilesRes.data as { id: string; full_name: string }[]) ?? []).map((p) => [
        p.id,
        p.full_name,
      ]),
    );

    const assignmentsByStaff = new Map<string, { subjectIds: Set<string>; subjectName?: string }>();
    for (const row of (assignmentsRes.data as {
      staff_id: string;
      subject_id: string;
      subjects?: { name: string } | { name: string }[];
    }[]) ?? []) {
      const existing = assignmentsByStaff.get(row.staff_id) ?? { subjectIds: new Set<string>() };
      existing.subjectIds.add(row.subject_id);
      const sub = Array.isArray(row.subjects) ? row.subjects[0] : row.subjects;
      if (sub?.name && !existing.subjectName) {
        existing.subjectName = sub.name;
      }
      assignmentsByStaff.set(row.staff_id, existing);
    }

    const monthlyCounts = new Map<string, number>();
    for (const row of (monthlyRes.data as { substitute_teacher_id: string }[]) ?? []) {
      monthlyCounts.set(
        row.substitute_teacher_id,
        (monthlyCounts.get(row.substitute_teacher_id) ?? 0) + 1,
      );
    }

    const absentDatesByStaff = new Map<string, Set<string>>();
    for (const row of (absentRes.data as { absent_teacher_id: string; absence_date: string }[]) ??
      []) {
      const set = absentDatesByStaff.get(row.absent_teacher_id) ?? new Set<string>();
      set.add(row.absence_date);
      absentDatesByStaff.set(row.absent_teacher_id, set);
    }

    const busyByStaff = new Map<string, CandidateBusySlot[]>();
    for (const row of (busyRes.data as {
      staff_id: string;
      start_time: string;
      end_time: string;
    }[]) ?? []) {
      const list = busyByStaff.get(row.staff_id) ?? [];
      list.push({
        staffId: row.staff_id,
        startTime: row.start_time,
        storedEndTime: row.end_time,
      });
      busyByStaff.set(row.staff_id, list);
    }

    const candidates: CandidateMeta[] = staffList.map((s) => {
      const assignment = assignmentsByStaff.get(s.id);
      return {
        staffId: s.id,
        fullName: nameByUserId.get(s.user_id) ?? 'Unknown',
        primarySubject: assignment?.subjectName,
        monthlyCount: monthlyCounts.get(s.id) ?? 0,
        absentDates: absentDatesByStaff.get(s.id) ?? new Set(),
        subjectIdsFromAssignments: assignment?.subjectIds ?? new Set(),
      };
    });

    return { candidates, busyByStaff };
  }

  private async fetchStaffProfile(
    staffId: string,
    branchId: string,
  ): Promise<{ userId: string; fullName: string }> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('staff')
      .select('id, user_id')
      .eq('id', staffId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(error);
    if (!data) {
      throw new NotFoundException('Staff member not found');
    }
    const userId = (data as { user_id: string }).user_id;
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .maybeSingle();
    throwIfDbError(profileError);
    return {
      userId,
      fullName: (profile as { full_name: string } | null)?.full_name ?? 'Unknown',
    };
  }

  private async fetchStaffNamesByIds(
    staffIds: string[],
    branchId: string,
  ): Promise<Map<string, string>> {
    if (staffIds.length === 0) return new Map();
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('staff')
      .select('id, user_id')
      .in('id', staffIds)
      .eq('branch_id', branchId);
    throwIfDbError(error);
    const rows = (data as { id: string; user_id: string }[]) ?? [];
    const userIds = rows.map((r) => r.user_id);
    const { data: profiles, error: pError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds);
    throwIfDbError(pError);
    const nameByUser = new Map(
      ((profiles as { id: string; full_name: string }[]) ?? []).map((p) => [p.id, p.full_name]),
    );
    const result = new Map<string, string>();
    for (const row of rows) {
      result.set(row.id, nameByUser.get(row.user_id) ?? 'Unknown');
    }
    return result;
  }

  private async fetchSlotsByIds(
    ids: string[],
    branchId: string,
    academicYearId: string,
  ): Promise<TimetableSlotRow[]> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('timetable_slots')
      .select(
        'id, class_section_id, day_of_week, period_number, start_time, end_time, subject_id, staff_id, slot_type, branch_id, academic_year_id',
      )
      .in('id', ids)
      .eq('branch_id', branchId)
      .eq('academic_year_id', academicYearId);
    throwIfDbError(error);
    return (data as TimetableSlotRow[]) ?? [];
  }

  private async fetchSlotById(id: string, branchId: string): Promise<TimetableSlotRow> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('timetable_slots')
      .select(
        'id, class_section_id, day_of_week, period_number, start_time, end_time, subject_id, staff_id, slot_type, branch_id, academic_year_id',
      )
      .eq('id', id)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(error);
    if (!data) {
      throw new NotFoundException('Timetable slot not found');
    }
    return data as TimetableSlotRow;
  }

  private async fetchStaffBusySlots(
    staffId: string,
    branchId: string,
    academicYearId: string,
    dayOfWeek: number,
  ): Promise<TimetableSlotRow[]> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('timetable_slots')
      .select(
        'id, class_section_id, day_of_week, period_number, start_time, end_time, subject_id, staff_id, slot_type, branch_id, academic_year_id',
      )
      .eq('staff_id', staffId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', academicYearId)
      .eq('day_of_week', dayOfWeek)
      .eq('slot_type', 'class');
    throwIfDbError(error);
    return (data as TimetableSlotRow[]) ?? [];
  }

  private async hasActiveSubstitution(slotId: string, date: string): Promise<boolean> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('teacher_substitutions')
      .select('id')
      .eq('timetable_slot_id', slotId)
      .eq('absence_date', date)
      .neq('status', 'cancelled')
      .limit(1);
    throwIfDbError(error);
    return ((data as { id: string }[]) ?? []).length > 0;
  }

  private async isStaffAbsentOnDate(
    staffId: string,
    branchId: string,
    date: string,
  ): Promise<boolean> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('teacher_substitutions')
      .select('id')
      .eq('branch_id', branchId)
      .eq('absent_teacher_id', staffId)
      .eq('absence_date', date)
      .neq('status', 'cancelled')
      .limit(1);
    throwIfDbError(error);
    return ((data as { id: string }[]) ?? []).length > 0;
  }

  private async countSubstitutionsForMonth(
    staffId: string,
    branchId: string,
    date: string,
  ): Promise<number> {
    const month = monthRangeForDate(date);
    const supabase = this.supabaseConfig.getClient();
    const { count, error } = await supabase
      .from('teacher_substitutions')
      .select('id', { count: 'exact', head: true })
      .eq('branch_id', branchId)
      .eq('substitute_teacher_id', staffId)
      .gte('absence_date', month.start)
      .lte('absence_date', month.end)
      .in('status', ['confirmed', 'completed']);
    throwIfDbError(error);
    return count ?? 0;
  }

  private async resolveClassSectionNames(
    classSectionId: string,
  ): Promise<{ className: string; sectionName: string }> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('class_sections')
      .select('id, classes:class_id(name), sections:section_id(name)')
      .eq('id', classSectionId)
      .maybeSingle();
    throwIfDbError(error);
    const row = data as {
      classes?: { name: string } | { name: string }[];
      sections?: { name: string } | { name: string }[];
    } | null;
    const classData = Array.isArray(row?.classes) ? row?.classes[0] : row?.classes;
    const sectionData = Array.isArray(row?.sections) ? row?.sections[0] : row?.sections;
    return {
      className: classData?.name ?? '',
      sectionName: sectionData?.name ?? '',
    };
  }

  private extractSubjectName(slot: TimetableSlotRow): string | undefined {
    const sub = slot.subjects;
    if (!sub) return undefined;
    const item = Array.isArray(sub) ? sub[0] : sub;
    return item?.name;
  }

  private async enrichSubstitutionRows(rows: SubstitutionRow[]): Promise<SubstitutionDto[]> {
    if (rows.length === 0) return [];

    const staffIds = [
      ...new Set(rows.flatMap((r) => [r.absent_teacher_id, r.substitute_teacher_id])),
    ];
    const slotIds = [...new Set(rows.map((r) => r.timetable_slot_id))];
    const branchId = rows[0].branch_id;

    const [nameByStaff, slots] = await Promise.all([
      this.fetchStaffNamesByIds(staffIds, branchId),
      this.fetchSlotsByIds(slotIds, branchId, rows[0].academic_year_id),
    ]);
    const slotById = new Map(slots.map((s) => [s.id, s]));
    const classNames = new Map<string, { className: string; sectionName: string }>();
    for (const slot of slots) {
      if (!classNames.has(slot.class_section_id)) {
        classNames.set(slot.class_section_id, await this.resolveClassSectionNames(slot.class_section_id));
      }
    }

    return rows.map((row) => {
      const slot = slotById.get(row.timetable_slot_id);
      const classInfo = slot ? classNames.get(slot.class_section_id) : undefined;
      return new SubstitutionDto({
        id: row.id,
        branchId: row.branch_id,
        academicYearId: row.academic_year_id,
        absentTeacherId: row.absent_teacher_id,
        absentTeacherName: nameByStaff.get(row.absent_teacher_id) ?? 'Unknown',
        substituteTeacherId: row.substitute_teacher_id,
        substituteTeacherName: nameByStaff.get(row.substitute_teacher_id) ?? 'Unknown',
        absenceDate: row.absence_date,
        absenceReason: row.absence_reason,
        timetableSlotId: row.timetable_slot_id,
        status: row.status as SubstitutionDto['status'],
        periodLabel: slot ? periodLabel(slot) : undefined,
        className: classInfo?.className,
        sectionName: classInfo?.sectionName,
        subjectName: slot ? this.extractSubjectName(slot) : undefined,
        startTime: slot?.start_time,
        endTime: slot ? storedSlotEndToUserDisplay(slot.end_time) : undefined,
        notifiedAt: row.notified_at ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    });
  }

  private canCancelBeforePeriod(absenceDate: string, startTime: string): boolean {
    const periodStart = this.periodStartDate(absenceDate, startTime);
    const deadline = new Date(periodStart.getTime() - 60 * 60 * 1000);
    return new Date() < deadline;
  }

  private periodStartDate(absenceDate: string, startTime: string): Date {
    const [y, m, d] = absenceDate.split('-').map((v) => parseInt(v, 10));
    const mins = clockTimeToMinutes(startTime);
    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;
    return new Date(y, m - 1, d, hours, minutes, 0, 0);
  }
}
