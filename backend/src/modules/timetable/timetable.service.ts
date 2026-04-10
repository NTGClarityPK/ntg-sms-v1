import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AuditLogService } from '../../common/services/audit-log.service';
import { AcademicYearsService } from '../academic-years/academic-years.service';
import { ScheduleService } from '../schedule/schedule.service';
import { TeacherAssignmentsService } from '../teacher-assignments/teacher-assignments.service';
import { TimetableSlotDto } from './dto/timetable-slot.dto';
import { CreateTimetableSlotDto } from './dto/create-timetable-slot.dto';
import { ClassTimetableDto } from './dto/class-timetable.dto';
import { TeacherTimetableDto, FreePeriod } from './dto/teacher-timetable.dto';
import { ConflictDto, ConflictType, ConflictingSlot } from './dto/conflict.dto';
import { TimingTemplateInfoDto } from './dto/timing-template-info.dto';
import { ReplicateDayDto } from './dto/replicate-day.dto';
import { ReplicateAcrossSectionsDto } from './dto/replicate-across-sections.dto';
import { ReplicateFromSectionDto } from './dto/replicate-from-section.dto';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type TimetableSlotRow = {
  id: string;
  class_section_id: string;
  day_of_week: number;
  period_number: number | null; // Optional label - time range is primary identifier
  start_time: string;
  end_time: string;
  subject_id: string | null;
  staff_id: string | null;
  room: string | null;
  slot_type: 'class' | 'assembly' | 'break' | 'free';
  branch_id: string;
  academic_year_id: string;
  subject_template_id: string | null;
  created_at: string;
  updated_at: string;
};

type TimetableSlotWithRelations = TimetableSlotRow & {
  subjects?: { name: string } | { name: string }[] | null;
  staff?: { id: string; user_id: string } | { id: string; user_id: string }[] | null;
  class_sections?: {
    id: string;
    class_id: string;
    section_id: string;
  } | {
    id: string;
    class_id: string;
    section_id: string;
  }[] | null;
};

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

function parseTime(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

function timesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  const s1 = parseTime(start1);
  const e1 = parseTime(end1);
  const s2 = parseTime(start2);
  const e2 = parseTime(end2);
  return s1 < e2 && s2 < e1;
}

@Injectable()
export class TimetableService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly auditLogService: AuditLogService,
    private readonly academicYearsService: AcademicYearsService,
    private readonly scheduleService: ScheduleService,
    private readonly teacherAssignmentsService: TeacherAssignmentsService,
  ) {}

  async getClassTimetable(
    classSectionId: string,
    branchId: string,
    academicYearId?: string,
    subjectTemplateId?: string | null,
  ): Promise<ClassTimetableDto> {
    const supabase = this.supabaseConfig.getClient();

    // First verify class-section belongs to branch (without academic year filter)
    const { data: classSection, error: csError } = await supabase
      .from('class_sections')
      .select('id, class_id, section_id, academic_year_id')
      .eq('id', classSectionId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(csError);
    if (!classSection) {
      throw new NotFoundException('Class-section not found');
    }

    // Use provided academicYearId, or class-section's academic year, or active year
    let activeYearId = academicYearId;
    if (!activeYearId) {
      // Use the class-section's academic year (preferred) or fall back to active year
      activeYearId = classSection.academic_year_id;
      if (!activeYearId) {
        const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
        if (!activeYear) {
          throw new BadRequestException('No active academic year found');
        }
        activeYearId = activeYear.id;
      }
    }

    // Fetch class and section names
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('name')
      .eq('id', classSection.class_id)
      .single();
    throwIfDbError(classError);

    const { data: sectionData, error: sectionError } = await supabase
      .from('sections')
      .select('name')
      .eq('id', classSection.section_id)
      .single();
    throwIfDbError(sectionError);

    // Fetch timetable slots with relations
    let slotsQuery = supabase
      .from('timetable_slots')
      .select(
        '*, subjects:subject_id(name), staff:staff_id(id, user_id), class_sections:class_section_id(id, class_id, section_id)',
      )
      .eq('class_section_id', classSectionId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', activeYearId);

    // Filter by subject template when explicitly specified.
    // - string: return slots for that template
    // - null: return generic (null-template) slots only
    // - undefined: return all slots (no filtering)
    if (subjectTemplateId !== undefined) {
      slotsQuery =
        subjectTemplateId === null
          ? slotsQuery.is('subject_template_id', null)
          : slotsQuery.eq('subject_template_id', subjectTemplateId);
    }

    const { data: slotsData, error: slotsError } = await slotsQuery
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true }); // Sort by time, not period_number
    throwIfDbError(slotsError);

    const slots = ((slotsData as TimetableSlotWithRelations[]) ?? []).map((row) => {
      const subjectData = Array.isArray(row.subjects) ? row.subjects[0] : row.subjects;
      const staffData = Array.isArray(row.staff) ? row.staff[0] : row.staff;

      // Fetch staff name if staff_id exists
      let staffName: string | undefined;
      if (staffData?.user_id) {
        // We'll fetch this separately if needed, or include in the select
      }

      return new TimetableSlotDto({
        id: row.id,
        classSectionId: row.class_section_id,
        dayOfWeek: row.day_of_week,
        periodNumber: row.period_number ?? undefined, // Optional
        startTime: row.start_time,
        endTime: row.end_time,
        subjectId: row.subject_id ?? undefined,
        staffId: row.staff_id ?? undefined,
        room: row.room ?? undefined,
        slotType: row.slot_type,
        branchId: row.branch_id,
        academicYearId: row.academic_year_id,
        subjectTemplateId: (row as any).subject_template_id ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        subjectName: subjectData?.name,
        staffName,
        className: classData?.name,
        sectionName: sectionData?.name,
      });
    });

    // Fetch staff names for slots that have staff_id
    const staffUserIds = slots
      .filter((s) => s.staffId)
      .map((s) => {
        const staffData = (slotsData as TimetableSlotWithRelations[]).find(
          (r) => r.id === s.id,
        )?.staff;
        return Array.isArray(staffData) ? staffData[0] : staffData;
      })
      .filter((s): s is { id: string; user_id: string } => !!s && !!s.user_id)
      .map((s) => s.user_id);

    if (staffUserIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', staffUserIds);
      throwIfDbError(profilesError);

      const profileMap = new Map(
        ((profiles as Array<{ id: string; full_name: string }>) ?? []).map((p) => [p.id, p.full_name]),
      );

      slots.forEach((slot) => {
        if (slot.staffId) {
          const staffData = (slotsData as TimetableSlotWithRelations[]).find(
            (r) => r.id === slot.id,
          )?.staff;
          const staff = Array.isArray(staffData) ? staffData[0] : staffData;
          if (staff?.user_id) {
            slot.staffName = profileMap.get(staff.user_id);
          }
        }
      });
    }

    return new ClassTimetableDto({
      classSectionId,
      className: classData?.name ?? '',
      sectionName: sectionData?.name ?? '',
      slots,
    });
  }

  /**
   * Batch variant of getClassTimetable.
   * Fetches timetables for multiple class-sections in one go to avoid N+1 HTTP/database calls.
   */
  async getClassTimetablesBatch(
    classSectionIds: string[],
    branchId: string,
    academicYearId?: string,
    subjectTemplateId?: string,
  ): Promise<ClassTimetableDto[]> {
    if (!classSectionIds || classSectionIds.length === 0) {
      return [];
    }

    const supabase = this.supabaseConfig.getClient();

    // Deduplicate IDs
    const uniqueIds = Array.from(new Set(classSectionIds));

    // Verify class-sections belong to branch and get their class/section IDs
    const { data: classSectionRows, error: csError } = await supabase
      .from('class_sections')
      .select('id, class_id, section_id')
      .in('id', uniqueIds)
      .eq('branch_id', branchId);
    throwIfDbError(csError);
    const classSections =
      (classSectionRows as Array<{ id: string; class_id: string; section_id: string }>) ?? [];
    if (classSections.length === 0) {
      return [];
    }

    const classIds = Array.from(new Set(classSections.map((cs) => cs.class_id)));
    const sectionIds = Array.from(new Set(classSections.map((cs) => cs.section_id)));

    // Resolve academic year once for the branch (batch endpoint focuses on current/active year)
    let activeYearId = academicYearId;
    if (!activeYearId) {
      const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
      if (!activeYear) {
        throw new BadRequestException('No active academic year found');
      }
      activeYearId = activeYear.id;
    }

    // Fetch class and section names in parallel
    const [classesResult, sectionsResult] = await Promise.all([
      supabase.from('classes').select('id, name').in('id', classIds),
      supabase.from('sections').select('id, name').in('id', sectionIds),
    ]);
    throwIfDbError(classesResult.error);
    throwIfDbError(sectionsResult.error);

    const classNameById = new Map<string, string>(
      ((classesResult.data as Array<{ id: string; name: string }>) ?? []).map((c) => [
        c.id,
        c.name,
      ]),
    );
    const sectionNameById = new Map<string, string>(
      ((sectionsResult.data as Array<{ id: string; name: string }>) ?? []).map((s) => [
        s.id,
        s.name,
      ]),
    );

    // Fetch all timetable slots for these class-sections in one query
    let slotsQuery = supabase
      .from('timetable_slots')
      .select(
        '*, subjects:subject_id(name), staff:staff_id(id, user_id)',
      )
      .in('class_section_id', uniqueIds)
      .eq('branch_id', branchId)
      .eq('academic_year_id', activeYearId)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });

    // Filter by subject template when explicitly specified.
    // - string: return slots for that template
    // - null: return generic (null-template) slots only
    // - undefined: return all slots (no filtering)
    if (subjectTemplateId !== undefined) {
      slotsQuery =
        subjectTemplateId === null
          ? slotsQuery.is('subject_template_id', null)
          : slotsQuery.eq('subject_template_id', subjectTemplateId);
    }

    const { data: slotsData, error: slotsError } = await slotsQuery;
    throwIfDbError(slotsError);
    const slotRows = (slotsData as TimetableSlotWithRelations[]) ?? [];

    const slotsBySectionId = new Map<string, TimetableSlotDto[]>();
    const staffUserIdBySlotId = new Map<string, string>();
    const allSlots: TimetableSlotDto[] = [];

    // Map rows to DTOs and group by class-section
    for (const row of slotRows) {
      const subjectData = Array.isArray(row.subjects) ? row.subjects[0] : row.subjects;
      const staffData = Array.isArray(row.staff) ? row.staff[0] : row.staff;

      if (staffData?.user_id) {
        staffUserIdBySlotId.set(row.id, staffData.user_id);
      }

      const slotDto = new TimetableSlotDto({
        id: row.id,
        classSectionId: row.class_section_id,
        dayOfWeek: row.day_of_week,
        periodNumber: row.period_number ?? undefined,
        startTime: row.start_time,
        endTime: row.end_time,
        subjectId: row.subject_id ?? undefined,
        staffId: row.staff_id ?? undefined,
        room: row.room ?? undefined,
        slotType: row.slot_type,
        branchId: row.branch_id,
        academicYearId: row.academic_year_id,
        subjectTemplateId: (row as any).subject_template_id ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        subjectName: subjectData?.name,
        staffName: undefined,
        className: '', // set at container level
        sectionName: '', // set at container level
      });

      allSlots.push(slotDto);
      const existing = slotsBySectionId.get(row.class_section_id) ?? [];
      existing.push(slotDto);
      slotsBySectionId.set(row.class_section_id, existing);
    }

    // Fetch staff names once for all slots that have staff assignments
    const staffUserIds = Array.from(new Set(staffUserIdBySlotId.values()));
    if (staffUserIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', staffUserIds);
      throwIfDbError(profilesError);

      const profileMap = new Map(
        ((profiles as Array<{ id: string; full_name: string }>) ?? []).map((p) => [
          p.id,
          p.full_name,
        ]),
      );

      allSlots.forEach((slot) => {
        const userId = staffUserIdBySlotId.get(slot.id);
        if (userId) {
          slot.staffName = profileMap.get(userId);
        }
      });
    }

    const classSectionById = new Map<
      string,
      { id: string; class_id: string; section_id: string }
    >(classSections.map((cs) => [cs.id, cs]));

    // Build result array in the same order as input classSectionIds (skipping missing ones)
    const results: ClassTimetableDto[] = [];
    for (const id of classSectionIds) {
      const cs = classSectionById.get(id);
      if (!cs) continue;
      const className = classNameById.get(cs.class_id) ?? '';
      const sectionName = sectionNameById.get(cs.section_id) ?? '';
      const slotsForSection = slotsBySectionId.get(id) ?? [];

      results.push(
        new ClassTimetableDto({
          classSectionId: id,
          className,
          sectionName,
          slots: slotsForSection,
        }),
      );
    }

    return results;
  }

  async getTeacherTimetable(
    staffId: string,
    branchId: string,
    academicYearId?: string,
  ): Promise<TeacherTimetableDto> {
    const supabase = this.supabaseConfig.getClient();

    // Use provided academicYearId or get active year
    let activeYearId = academicYearId;
    if (!activeYearId) {
      const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
      if (!activeYear) {
        throw new BadRequestException('No active academic year found');
      }
      activeYearId = activeYear.id;
    }

    // Verify staff exists
    const { data: staffData, error: staffError } = await supabase
      .from('staff')
      .select('id, user_id')
      .eq('id', staffId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(staffError);
    if (!staffData) {
      throw new NotFoundException('Staff member not found');
    }

    // Fetch staff name
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', staffData.user_id)
      .single();
    throwIfDbError(profileError);

    // Fetch timetable slots
    const { data: slotsData, error: slotsError } = await supabase
      .from('timetable_slots')
      .select(
        '*, subjects:subject_id(name), class_sections:class_section_id(id, class_id, section_id)',
      )
      .eq('staff_id', staffId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', activeYearId)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true }); // Sort by time, not period_number
    throwIfDbError(slotsError);

    // Fetch class and section names
    const classSectionIds = [
      ...new Set(
        ((slotsData as TimetableSlotWithRelations[]) ?? []).map((s) => s.class_section_id),
      ),
    ];
    const classSectionMap = new Map<string, { className: string; sectionName: string }>();

    if (classSectionIds.length > 0) {
      const { data: classSections, error: csError } = await supabase
        .from('class_sections')
        .select('id, class_id, section_id, classes:class_id(name), sections:section_id(name)')
        .in('id', classSectionIds);
      throwIfDbError(csError);

      for (const cs of (classSections as any[]) ?? []) {
        const classData = Array.isArray(cs.classes) ? cs.classes[0] : cs.classes;
        const sectionData = Array.isArray(cs.sections) ? cs.sections[0] : cs.sections;
        classSectionMap.set(cs.id, {
          className: classData?.name ?? '',
          sectionName: sectionData?.name ?? '',
        });
      }
    }

    const slots = ((slotsData as TimetableSlotWithRelations[]) ?? []).map((row) => {
      const subjectData = Array.isArray(row.subjects) ? row.subjects[0] : row.subjects;
      const csInfo = classSectionMap.get(row.class_section_id);

      return new TimetableSlotDto({
        id: row.id,
        classSectionId: row.class_section_id,
        dayOfWeek: row.day_of_week,
        periodNumber: row.period_number ?? undefined, // Optional
        startTime: row.start_time,
        endTime: row.end_time,
        subjectId: row.subject_id ?? undefined,
        staffId: row.staff_id ?? undefined,
        room: row.room ?? undefined,
        slotType: row.slot_type,
        branchId: row.branch_id,
        academicYearId: row.academic_year_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        subjectName: subjectData?.name,
        staffName: profile?.full_name,
        className: csInfo?.className,
        sectionName: csInfo?.sectionName,
      });
    });

    // Calculate free periods (time gaps in schedule)
    // Note: With time-range primary approach, free periods are less meaningful
    // We'll calculate based on time gaps instead of period numbers
    const schoolDays = await this.scheduleService.getSchoolDays();
    const activeDays = schoolDays.data;
    const freePeriods: FreePeriod[] = [];

    // For backward compatibility, we'll still calculate free periods
    // but only for slots that have periodNumber labels
    const slotsWithPeriods = slots.filter((s) => s.periodNumber !== undefined);
    if (slotsWithPeriods.length > 0) {
      const maxPeriod = Math.max(...slotsWithPeriods.map((s) => s.periodNumber!));

      for (const day of activeDays) {
        const daySlots = slotsWithPeriods.filter((s) => s.dayOfWeek === day);
        const occupiedPeriods = new Set(daySlots.map((s) => s.periodNumber!));

        // Find gaps (periods 1 to maxPeriod that are not occupied)
        for (let period = 1; period <= maxPeriod; period++) {
          if (!occupiedPeriods.has(period)) {
            freePeriods.push({ dayOfWeek: day, periodNumber: period });
          }
        }
      }
    }

    return new TeacherTimetableDto({
      staffId,
      staffName: profile?.full_name ?? '',
      slots,
      freePeriods,
    });
  }

  async createOrUpdateSlot(
    input: CreateTimetableSlotDto,
    branchId: string,
    userEmail: string,
    tenantId?: string | null,
  ): Promise<TimetableSlotDto> {
    const supabase = this.supabaseConfig.getClient();

    // Validate times
    if (parseTime(input.startTime) >= parseTime(input.endTime)) {
      throw new BadRequestException('startTime must be before endTime');
    }

    // Get active academic year
    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) {
      throw new BadRequestException('No active academic year found');
    }
    const academicYearId = input.academicYearId ?? activeYear.id;

    await this.academicYearsService.assertNotLockedForBranch(branchId, academicYearId);

    // Validate class-section belongs to branch
    const { data: classSection, error: csError } = await supabase
      .from('class_sections')
      .select('id')
      .eq('id', input.classSectionId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', academicYearId)
      .maybeSingle();
    throwIfDbError(csError);
    if (!classSection) {
      throw new NotFoundException('Class-section not found');
    }

    // Validate school day is active
    const schoolDays = await this.scheduleService.getSchoolDays();
    if (!schoolDays.data.includes(input.dayOfWeek)) {
      throw new BadRequestException(`Day ${input.dayOfWeek} is not an active school day`);
    }

    // Validate subject-template if provided
    if (input.subjectTemplateId) {
      const { data: template, error: templateError } = await supabase
        .from('subject_templates')
        .select('id')
        .eq('id', input.subjectTemplateId)
        .eq('branch_id', branchId)
        .maybeSingle();
      throwIfDbError(templateError);
      if (!template) {
        throw new NotFoundException('Subject template not found');
      }

      // If subject is provided, validate it belongs to the template
      if (input.subjectId) {
        const { data: templateSubject, error: tsError } = await supabase
          .from('subject_template_subjects')
          .select('subject_id')
          .eq('subject_template_id', input.subjectTemplateId)
          .eq('subject_id', input.subjectId)
          .maybeSingle();
        throwIfDbError(tsError);
        if (!templateSubject) {
          throw new BadRequestException('Subject does not belong to the selected template');
        }
      }
    }

    // Validate subject-teacher assignment if both provided
    if (input.subjectId && input.staffId) {
      const assignments = await this.teacherAssignmentsService.listTeacherAssignments(
        {
          page: 1,
          limit: 100,
          sortOrder: 'desc',
          staffId: input.staffId,
          subjectId: input.subjectId,
          classSectionId: input.classSectionId,
        },
        branchId,
        academicYearId,
      );
      if (assignments.data.length === 0) {
        throw new BadRequestException(
          'Teacher is not assigned to this subject for this class-section',
        );
      }
    }

    // If ID is provided, update existing slot by ID (handles time changes)
    // Otherwise, use upsert based on unique constraint
    const updateData: any = {
      class_section_id: input.classSectionId,
      day_of_week: input.dayOfWeek,
      period_number: input.periodNumber ?? null, // Optional label
      start_time: input.startTime,
      end_time: input.endTime,
      subject_id: input.subjectId ?? null,
      staff_id: input.staffId ?? null,
      room: input.room ?? null,
      slot_type: input.slotType,
      branch_id: branchId,
      academic_year_id: academicYearId,
      updated_at: new Date().toISOString(),
    };

    if (input.subjectTemplateId) {
      updateData.subject_template_id = input.subjectTemplateId;
    }

    let row: TimetableSlotRow;

    if (input.id) {
      // Update existing slot by ID – fetch old row for audit
      const { data: oldRow, error: fetchErr } = await supabase
        .from('timetable_slots')
        .select('*')
        .eq('id', input.id)
        .eq('branch_id', branchId)
        .single();
      throwIfDbError(fetchErr);
      if (!oldRow) throw new NotFoundException('Timetable slot not found');

      const { data, error } = await supabase
        .from('timetable_slots')
        .update(updateData)
        .eq('id', input.id)
        .eq('branch_id', branchId)
        .select('*')
        .single();
      throwIfDbError(error);
      if (!data) {
        throw new NotFoundException('Timetable slot not found');
      }
      row = data as TimetableSlotRow;
      const changedFields = Object.keys(updateData).filter(
        (k) => (oldRow as Record<string, unknown>)[k] !== (row as Record<string, unknown>)[k],
      );
      this.auditLogService
        .logUpdate(
          'timetable_slots',
          row.id,
          userEmail,
          oldRow as Record<string, unknown>,
          row as Record<string, unknown>,
          changedFields,
          { branchId, tenantId },
        )
        .catch(() => {});
    } else {
      // Upsert using unique constraint (with subject_template_id)
      const { data, error } = await supabase
        .from('timetable_slots')
        .upsert(updateData, {
          onConflict: 'class_section_id,day_of_week,start_time,end_time,academic_year_id,subject_template_id',
        })
        .select('*')
        .single();
      throwIfDbError(error);
      row = data as TimetableSlotRow;
      this.auditLogService
        .logCreate('timetable_slots', row.id, userEmail, { ...row } as Record<string, unknown>, {
          branchId,
          tenantId,
        })
        .catch(() => {});
    }
    
    // Automatically renumber periods based on chronological order
    await this.renumberPeriodsForClassSection(
      input.classSectionId,
      branchId,
      academicYearId,
      input.subjectTemplateId,
    );
    
    return this.getClassTimetable(input.classSectionId, branchId, academicYearId).then(
      (timetable) => timetable.slots.find((s) => s.id === row.id)!,
    );
  }

  /**
   * Automatically renumbers period numbers for a class-section based on chronological order.
   * Periods are numbered 1, 2, 3... based on start_time within each day_of_week.
   * This is done separately for each day_of_week and subject_template_id combination.
   * 
   * Rules:
   * - If there's only 1 slot for a day+template, it gets period 1
   * - If there are multiple slots, they get numbered 1, 2, 3... based on start_time order
   * - Period numbers are assigned per day_of_week and per subject_template_id
   */
  private async renumberPeriodsForClassSection(
    classSectionId: string,
    branchId: string,
    academicYearId: string,
    subjectTemplateId?: string | null,
  ): Promise<void> {
    const supabase = this.supabaseConfig.getClient();

    // Fetch all slots for this class-section, filtered by template if provided
    let slotsQuery = supabase
      .from('timetable_slots')
      .select('id, day_of_week, start_time, subject_template_id')
      .eq('class_section_id', classSectionId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', academicYearId);

    // Filter by subject_template_id if provided
    if (subjectTemplateId) {
      slotsQuery = slotsQuery.eq('subject_template_id', subjectTemplateId);
    } else {
      // If no template specified, only renumber slots without templates (null)
      slotsQuery = slotsQuery.is('subject_template_id', null);
    }

    const { data: allSlots, error: slotsError } = await slotsQuery
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });
    throwIfDbError(slotsError);

    if (!allSlots || allSlots.length === 0) {
      return; // No slots to renumber
    }

    // Group slots by day_of_week and subject_template_id
    const slotsByDayAndTemplate = new Map<string, Array<{ id: string; start_time: string }>>();
    
    for (const slot of allSlots) {
      const key = `${slot.day_of_week}_${slot.subject_template_id || 'null'}`;
      if (!slotsByDayAndTemplate.has(key)) {
        slotsByDayAndTemplate.set(key, []);
      }
      slotsByDayAndTemplate.get(key)!.push({
        id: slot.id,
        start_time: slot.start_time,
      });
    }

    // Renumber periods for each day+template combination
    const updates: Array<{ id: string; period_number: number }> = [];
    
    for (const [key, slots] of slotsByDayAndTemplate.entries()) {
      // Slots are already sorted by start_time from the query
      // Assign period numbers 1, 2, 3... based on chronological order
      slots.forEach((slot, index) => {
        updates.push({
          id: slot.id,
          period_number: index + 1, // 1-indexed
        });
      });
    }

    // Batch update all slots
    if (updates.length > 0) {
      // Use Promise.all to update all slots in parallel
      const updatePromises = updates.map((update) =>
        supabase
          .from('timetable_slots')
          .update({ period_number: update.period_number })
          .eq('id', update.id),
      );

      const results = await Promise.all(updatePromises);
      
      // Check for errors
      for (const result of results) {
        if (result.error) {
          throwIfDbError(result.error);
        }
      }
    }
  }

  async deleteSlot(
    id: string,
    branchId: string,
    userEmail: string,
    tenantId?: string | null,
  ): Promise<{ success: boolean }> {
    const supabase = this.supabaseConfig.getClient();

    // Get full slot row for audit and renumbering
    const { data: slotToDelete, error: getError } = await supabase
      .from('timetable_slots')
      .select('*')
      .eq('id', id)
      .eq('branch_id', branchId)
      .single();
    throwIfDbError(getError);
    if (!slotToDelete) {
      throw new NotFoundException('Timetable slot not found');
    }

    await this.academicYearsService.assertNotLockedForBranch(branchId, slotToDelete.academic_year_id);

    const { error } = await supabase.from('timetable_slots').delete().eq('id', id);
    throwIfDbError(error);

    this.auditLogService
      .logDelete(
        'timetable_slots',
        id,
        userEmail,
        slotToDelete as Record<string, unknown>,
        { branchId, tenantId },
      )
      .catch(() => {});

    await this.renumberPeriodsForClassSection(
      slotToDelete.class_section_id,
      branchId,
      slotToDelete.academic_year_id,
      slotToDelete.subject_template_id,
    );

    return { success: true };
  }

  /**
   * Replicates all slots from a source day to one or more target days.
   * Only replicates slots that match the subject_template_id if provided.
   * Existing slots on target days with the same time range will be replaced.
   */
  async replicateDay(
    input: ReplicateDayDto,
    branchId: string,
    userEmail: string,
    tenantId?: string | null,
  ): Promise<{ slotsReplicated: number }> {
    const supabase = this.supabaseConfig.getClient();

    // Validate source day is not in target days
    if (input.targetDaysOfWeek.includes(input.sourceDayOfWeek)) {
      throw new BadRequestException('Source day cannot be in target days');
    }

    // Get active academic year if not provided
    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) {
      throw new BadRequestException('No active academic year found');
    }
    const activeYearId = input.academicYearId ?? activeYear.id;

    await this.academicYearsService.assertNotLockedForBranch(branchId, activeYearId);

    await this.academicYearsService.assertNotLockedForBranch(branchId, activeYearId);

    // Fetch all slots from source day
    let sourceSlotsQuery = supabase
      .from('timetable_slots')
      .select('*')
      .eq('class_section_id', input.classSectionId)
      .eq('day_of_week', input.sourceDayOfWeek)
      .eq('branch_id', branchId)
      .eq('academic_year_id', activeYearId);

    // Filter by subject_template_id if provided
    if (input.subjectTemplateId) {
      sourceSlotsQuery = sourceSlotsQuery.eq('subject_template_id', input.subjectTemplateId);
    } else {
      sourceSlotsQuery = sourceSlotsQuery.is('subject_template_id', null);
    }

    const { data: sourceSlots, error: sourceError } = await sourceSlotsQuery;
    throwIfDbError(sourceError);

    if (!sourceSlots || sourceSlots.length === 0) {
      return { slotsReplicated: 0 };
    }

    // Prepare slots to insert for each target day
    const slotsToInsert: Array<{
      class_section_id: string;
      day_of_week: number;
      period_number: number | null;
      start_time: string;
      end_time: string;
      subject_id: string | null;
      staff_id: string | null;
      room: string | null;
      slot_type: 'class' | 'assembly' | 'break' | 'free';
      branch_id: string;
      academic_year_id: string;
      subject_template_id: string | null;
    }> = [];

    for (const targetDay of input.targetDaysOfWeek) {
      for (const sourceSlot of sourceSlots) {
        slotsToInsert.push({
          class_section_id: input.classSectionId,
          day_of_week: targetDay,
          period_number: sourceSlot.period_number,
          start_time: sourceSlot.start_time,
          end_time: sourceSlot.end_time,
          subject_id: sourceSlot.subject_id,
          staff_id: sourceSlot.staff_id,
          room: sourceSlot.room,
          slot_type: sourceSlot.slot_type,
          branch_id: branchId,
          academic_year_id: activeYearId,
          subject_template_id: sourceSlot.subject_template_id,
        });
      }
    }

    if (slotsToInsert.length === 0) {
      return { slotsReplicated: 0 };
    }

    // Upsert slots (will replace existing ones due to unique constraint)
    const { data: insertedRows, error: insertError } = await supabase
      .from('timetable_slots')
      .upsert(slotsToInsert, {
        onConflict: 'class_section_id,day_of_week,start_time,end_time,academic_year_id,subject_template_id',
      })
      .select('*');
    throwIfDbError(insertError);
    if (insertedRows) {
      for (const row of insertedRows) {
        this.auditLogService
          .logCreate(
            'timetable_slots',
            (row as TimetableSlotRow).id,
            userEmail,
            row as Record<string, unknown>,
            { branchId, tenantId },
          )
          .catch(() => {});
      }
    }

    // Renumber periods for all affected days
    const allAffectedDays = [...new Set([input.sourceDayOfWeek, ...input.targetDaysOfWeek])];
    for (const day of allAffectedDays) {
      await this.renumberPeriodsForClassSection(
        input.classSectionId,
        branchId,
        activeYearId,
        input.subjectTemplateId,
      );
    }

    return { slotsReplicated: slotsToInsert.length };
  }

  /**
   * Replicates all timetable slots from a source class section to one or more target class sections.
   * Only replicates slots that match the subject_template_id if provided.
   * Existing slots in target sections with the same day, time range, and template will be replaced.
   */
  async replicateAcrossSections(
    input: ReplicateAcrossSectionsDto,
    branchId: string,
    userEmail: string,
    tenantId?: string | null,
  ): Promise<{ slotsReplicated: number }> {
    const supabase = this.supabaseConfig.getClient();

    // Validate source is not in targets
    if (input.targetClassSectionIds.includes(input.sourceClassSectionId)) {
      throw new BadRequestException('Source class section cannot be in target sections');
    }

    if (input.targetClassSectionIds.length === 0) {
      throw new BadRequestException('At least one target class section must be specified');
    }

    // Get active academic year if not provided
    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) {
      throw new BadRequestException('No active academic year found');
    }
    const activeYearId = input.academicYearId ?? activeYear.id;

    await this.academicYearsService.assertNotLockedForBranch(branchId, activeYearId);

    // Fetch all slots from source class section
    let sourceSlotsQuery = supabase
      .from('timetable_slots')
      .select('*')
      .eq('class_section_id', input.sourceClassSectionId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', activeYearId);

    // Filter by subject_template_id if provided
    if (input.subjectTemplateId) {
      sourceSlotsQuery = sourceSlotsQuery.eq('subject_template_id', input.subjectTemplateId);
    } else {
      sourceSlotsQuery = sourceSlotsQuery.is('subject_template_id', null);
    }

    const { data: sourceSlots, error: sourceError } = await sourceSlotsQuery;
    throwIfDbError(sourceError);

    if (!sourceSlots || sourceSlots.length === 0) {
      return { slotsReplicated: 0 };
    }

    // Prepare slots to insert for each target class section
    const slotsToInsert: Array<{
      class_section_id: string;
      day_of_week: number;
      period_number: number | null;
      start_time: string;
      end_time: string;
      subject_id: string | null;
      staff_id: string | null;
      room: string | null;
      slot_type: 'class' | 'assembly' | 'break' | 'free';
      branch_id: string;
      academic_year_id: string;
      subject_template_id: string | null;
    }> = [];

    for (const targetClassSectionId of input.targetClassSectionIds) {
      for (const sourceSlot of sourceSlots) {
        slotsToInsert.push({
          class_section_id: targetClassSectionId,
          day_of_week: sourceSlot.day_of_week,
          period_number: sourceSlot.period_number,
          start_time: sourceSlot.start_time,
          end_time: sourceSlot.end_time,
          subject_id: sourceSlot.subject_id,
          staff_id: sourceSlot.staff_id,
          room: sourceSlot.room,
          slot_type: sourceSlot.slot_type,
          branch_id: branchId,
          academic_year_id: activeYearId,
          subject_template_id: sourceSlot.subject_template_id,
        });
      }
    }

    if (slotsToInsert.length === 0) {
      return { slotsReplicated: 0 };
    }

    // Upsert slots (will replace existing ones due to unique constraint)
    const { data: insertedRows, error: insertError } = await supabase
      .from('timetable_slots')
      .upsert(slotsToInsert, {
        onConflict: 'class_section_id,day_of_week,start_time,end_time,academic_year_id,subject_template_id',
      })
      .select('*');
    throwIfDbError(insertError);
    if (insertedRows) {
      for (const row of insertedRows) {
        this.auditLogService
          .logCreate(
            'timetable_slots',
            (row as TimetableSlotRow).id,
            userEmail,
            row as Record<string, unknown>,
            { branchId, tenantId },
          )
          .catch(() => {});
      }
    }

    // Renumber periods for all affected class sections
    const allAffectedSections = [
      input.sourceClassSectionId,
      ...input.targetClassSectionIds,
    ];
    for (const sectionId of allAffectedSections) {
      await this.renumberPeriodsForClassSection(
        sectionId,
        branchId,
        activeYearId,
        input.subjectTemplateId,
      );
    }

    return { slotsReplicated: slotsToInsert.length };
  }

  /**
   * Replicates all timetable slots from a source class section to a target class section.
   * Only replicates slots that match the subject_template_id if provided.
   * Existing slots in target section with the same day, time range, and template will be replaced.
   */
  async replicateFromSection(
    input: ReplicateFromSectionDto,
    branchId: string,
    userEmail: string,
    tenantId?: string | null,
  ): Promise<{ slotsReplicated: number }> {
    const supabase = this.supabaseConfig.getClient();

    // Validate source is not the same as target
    if (input.sourceClassSectionId === input.targetClassSectionId) {
      throw new BadRequestException('Source and target class sections cannot be the same');
    }

    // Get active academic year if not provided
    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) {
      throw new BadRequestException('No active academic year found');
    }
    const activeYearId = input.academicYearId ?? activeYear.id;

    // Fetch all slots from source class section
    let sourceSlotsQuery = supabase
      .from('timetable_slots')
      .select('*')
      .eq('class_section_id', input.sourceClassSectionId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', activeYearId);

    // Filter by subject_template_id if provided
    if (input.subjectTemplateId) {
      sourceSlotsQuery = sourceSlotsQuery.eq('subject_template_id', input.subjectTemplateId);
    } else {
      sourceSlotsQuery = sourceSlotsQuery.is('subject_template_id', null);
    }

    const { data: sourceSlots, error: sourceError } = await sourceSlotsQuery;
    throwIfDbError(sourceError);

    if (!sourceSlots || sourceSlots.length === 0) {
      return { slotsReplicated: 0 };
    }

    // Prepare slots to insert for target class section
    const slotsToInsert: Array<{
      class_section_id: string;
      day_of_week: number;
      period_number: number | null;
      start_time: string;
      end_time: string;
      subject_id: string | null;
      staff_id: string | null;
      room: string | null;
      slot_type: 'class' | 'assembly' | 'break' | 'free';
      branch_id: string;
      academic_year_id: string;
      subject_template_id: string | null;
    }> = [];

    for (const sourceSlot of sourceSlots) {
      slotsToInsert.push({
        class_section_id: input.targetClassSectionId,
        day_of_week: sourceSlot.day_of_week,
        period_number: sourceSlot.period_number,
        start_time: sourceSlot.start_time,
        end_time: sourceSlot.end_time,
        subject_id: sourceSlot.subject_id,
        staff_id: sourceSlot.staff_id,
        room: sourceSlot.room,
        slot_type: sourceSlot.slot_type,
        branch_id: branchId,
        academic_year_id: activeYearId,
        subject_template_id: sourceSlot.subject_template_id,
      });
    }

    if (slotsToInsert.length === 0) {
      return { slotsReplicated: 0 };
    }

    // Upsert slots (will replace existing ones due to unique constraint)
    const { data: insertedRows, error: insertError } = await supabase
      .from('timetable_slots')
      .upsert(slotsToInsert, {
        onConflict: 'class_section_id,day_of_week,start_time,end_time,academic_year_id,subject_template_id',
      })
      .select('*');
    throwIfDbError(insertError);
    if (insertedRows) {
      for (const row of insertedRows) {
        this.auditLogService
          .logCreate(
            'timetable_slots',
            (row as TimetableSlotRow).id,
            userEmail,
            row as Record<string, unknown>,
            { branchId, tenantId },
          )
          .catch(() => {});
      }
    }

    // Renumber periods for both affected class sections
    await this.renumberPeriodsForClassSection(
      input.targetClassSectionId,
      branchId,
      activeYearId,
      input.subjectTemplateId,
    );
    await this.renumberPeriodsForClassSection(
      input.sourceClassSectionId,
      branchId,
      activeYearId,
      input.subjectTemplateId,
    );

    return { slotsReplicated: slotsToInsert.length };
  }

  /**
   * Derives slot_type from template slot name.
   * Matches common names (case-insensitive) to determine type.
   */
  private deriveSlotType(slotName: string): 'class' | 'assembly' | 'break' | 'free' {
    const nameLower = slotName.toLowerCase().trim();
    
    if (nameLower.includes('break') || nameLower.includes('recess')) {
      return 'break';
    }
    if (nameLower.includes('assembly') || nameLower.includes('assembly')) {
      return 'assembly';
    }
    if (nameLower.includes('free') || nameLower.includes('spare')) {
      return 'free';
    }
    // Default to 'class' for subject periods
    return 'class';
  }

  /**
   * Validates that a time string is within template bounds.
   * Returns true if time is within [templateStart, templateEnd].
   */
  private isTimeWithinBounds(
    time: string,
    templateStart: string,
    templateEnd: string,
  ): boolean {
    // Simple string comparison works for HH:MM:SS format
    return time >= templateStart && time <= templateEnd;
  }

  async getTimingTemplateInfo(
    classSectionId: string,
    branchId: string,
  ) {
    const supabase = this.supabaseConfig.getClient();

    // Get class-section to find class_id
    const { data: classSection, error: csError } = await supabase
      .from('class_sections')
      .select('class_id')
      .eq('id', classSectionId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(csError);
    if (!classSection) {
      return null; // No template info if class-section not found
    }

    // Get timing template assignment
    const { data: timingAssignment, error: taError } = await supabase
      .from('class_timing_assignments')
      .select('timing_template_id')
      .eq('class_id', classSection.class_id)
      .maybeSingle();
    throwIfDbError(taError);
    if (!timingAssignment) {
      return null; // No template assigned
    }

    // Get timing template
    const { data: timingTemplate, error: ttError } = await supabase
      .from('timing_templates')
      .select('id, name, start_time, end_time, period_duration_minutes')
      .eq('id', timingAssignment.timing_template_id)
      .maybeSingle();
    throwIfDbError(ttError);
    if (!timingTemplate) {
      return null;
    }

    // Get template slots
    const { data: templateSlots, error: tsError } = await supabase
      .from('timing_template_slots')
      .select('name, start_time, end_time, sort_order')
      .eq('timing_template_id', timingTemplate.id)
      .order('sort_order', { ascending: true });
    throwIfDbError(tsError);

    return {
      templateId: timingTemplate.id,
      templateName: timingTemplate.name,
      startTime: timingTemplate.start_time,
      endTime: timingTemplate.end_time,
      periodDurationMinutes: timingTemplate.period_duration_minutes,
      slots: (templateSlots ?? []).map((slot) => ({
        name: slot.name,
        startTime: slot.start_time,
        endTime: slot.end_time,
        sortOrder: slot.sort_order,
      })),
    };
  }

  async generateFromTimingTemplate(
    classSectionId: string,
    branchId: string,
    userEmail: string,
    tenantId?: string | null,
    academicYearId?: string,
    subjectTemplateId?: string,
  ): Promise<{ slotsCreated: number }> {
    const supabase = this.supabaseConfig.getClient();

    // Get class-section first to determine its academic year
    const { data: classSection, error: csError } = await supabase
      .from('class_sections')
      .select('id, class_id, academic_year_id')
      .eq('id', classSectionId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(csError);
    if (!classSection) {
      throw new NotFoundException('Class-section not found');
    }

    // Use provided academicYearId, or class-section's academic year, or active year
    let activeYearId: string;
    if (academicYearId) {
      activeYearId = academicYearId;
    } else if (classSection.academic_year_id) {
      activeYearId = classSection.academic_year_id;
    } else {
      const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
      if (!activeYear) {
        throw new BadRequestException('No active academic year found');
      }
      activeYearId = activeYear.id;
    }

    // Get timing template assignment for this class
    const { data: timingAssignment, error: taError } = await supabase
      .from('class_timing_assignments')
      .select('timing_template_id')
      .eq('class_id', classSection.class_id)
      .maybeSingle();
    throwIfDbError(taError);
    if (!timingAssignment) {
      throw new BadRequestException('No timing template assigned to this class');
    }

    // Get the timing template itself (for start/end time bounds)
    const { data: timingTemplate, error: ttError } = await supabase
      .from('timing_templates')
      .select('start_time, end_time')
      .eq('id', timingAssignment.timing_template_id)
      .maybeSingle();
    throwIfDbError(ttError);
    if (!timingTemplate) {
      throw new NotFoundException('Timing template not found');
    }

    // Get timing template slots (ordered by sort_order)
    const { data: templateSlots, error: tsError } = await supabase
      .from('timing_template_slots')
      .select('*')
      .eq('timing_template_id', timingAssignment.timing_template_id)
      .order('sort_order', { ascending: true });
    throwIfDbError(tsError);

    if (!templateSlots || templateSlots.length === 0) {
      throw new BadRequestException('Timing template has no slots defined');
    }

    // Validate that all template slots have times and are within template bounds
    for (const slot of templateSlots) {
      if (!slot.start_time || !slot.end_time) {
        throw new BadRequestException(
          `Template slot "${slot.name}" is missing start_time or end_time`,
        );
      }
      if (
        !this.isTimeWithinBounds(
          slot.start_time,
          timingTemplate.start_time,
          timingTemplate.end_time,
        ) ||
        !this.isTimeWithinBounds(
          slot.end_time,
          timingTemplate.start_time,
          timingTemplate.end_time,
        )
      ) {
        throw new BadRequestException(
          `Template slot "${slot.name}" (${slot.start_time} - ${slot.end_time}) is outside template bounds (${timingTemplate.start_time} - ${timingTemplate.end_time})`,
        );
      }
      if (slot.start_time >= slot.end_time) {
        throw new BadRequestException(
          `Template slot "${slot.name}" has invalid time range: start_time must be before end_time`,
        );
      }
    }

    // Get active school days
    const schoolDays = await this.scheduleService.getSchoolDays();
    const activeDays = schoolDays.data;

    if (!activeDays || activeDays.length === 0) {
      throw new BadRequestException('No active school days configured');
    }

    // Generate slots for each active day and each template slot
    // This creates the structure: one timetable slot per template slot per active day
    const slotsToInsert: Array<{
      class_section_id: string;
      day_of_week: number;
      period_number: number | null; // Optional label
      start_time: string;
      end_time: string;
      subject_id: string | null;
      staff_id: string | null;
      slot_type: 'class' | 'assembly' | 'break' | 'free';
      branch_id: string;
      academic_year_id: string;
      subject_template_id: string | null;
    }> = [];

    // Sort template slots by start_time (chronological order)
    const sortedTemplateSlots = [...templateSlots].sort((a, b) => {
      const timeA = a.start_time || '';
      const timeB = b.start_time || '';
      return timeA.localeCompare(timeB);
    });

    for (const day of activeDays) {
      sortedTemplateSlots.forEach((templateSlot, index) => {
        // Optional period number label (1-indexed based on chronological order)
        const periodNumber = index + 1;
        
        // Derive slot_type from template slot name
        const slotType = this.deriveSlotType(templateSlot.name);

        // For 'class' slots, create placeholders (empty subject/teacher)
        // For 'break', 'assembly', 'free' slots, always leave empty
        const subjectId: string | null = slotType === 'class' ? null : null;
        const staffId: string | null = slotType === 'class' ? null : null;

        slotsToInsert.push({
          class_section_id: classSectionId,
          day_of_week: day,
          period_number: periodNumber, // Optional label
          start_time: templateSlot.start_time!,
          end_time: templateSlot.end_time!,
          subject_id: subjectId,
          staff_id: staffId,
          slot_type: slotType,
          branch_id: branchId,
          academic_year_id: activeYearId,
          subject_template_id: subjectTemplateId ?? null,
        });
      });
    }

    if (slotsToInsert.length === 0) {
      return { slotsCreated: 0 };
    }

    // Upsert slots (will replace existing ones due to unique constraint)
    const { data: insertedRows, error: insertError } = await supabase
      .from('timetable_slots')
      .upsert(slotsToInsert, {
        onConflict: 'class_section_id,day_of_week,start_time,end_time,academic_year_id,subject_template_id',
      })
      .select('*');
    throwIfDbError(insertError);
    if (insertedRows) {
      for (const row of insertedRows) {
        this.auditLogService
          .logCreate(
            'timetable_slots',
            (row as TimetableSlotRow).id,
            userEmail,
            row as Record<string, unknown>,
            { branchId, tenantId },
          )
          .catch(() => {});
      }
    }

    await this.renumberPeriodsForClassSection(
      classSectionId,
      branchId,
      activeYearId,
      subjectTemplateId,
    );

    return { slotsCreated: slotsToInsert.length };
  }

  async getStudentTimetable(
    studentId: string,
    branchId: string,
    academicYearId?: string,
  ): Promise<ClassTimetableDto> {
    const supabase = this.supabaseConfig.getClient();

    // Get student record
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, class_id, section_id, academic_year_id')
      .eq('id', studentId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(studentError);
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // Use provided academicYearId or student's academic year or active year
    let activeYearId = academicYearId;
    if (!activeYearId) {
      activeYearId = student.academic_year_id;
      if (!activeYearId) {
        const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
        if (!activeYear) {
          throw new BadRequestException('No active academic year found');
        }
        activeYearId = activeYear.id;
      }
    }

    // Get student's assigned template for this academic year
    const { data: templateAssignment, error: templateError } = await supabase
      .from('student_subject_template_assignments')
      .select('subject_template_id')
      .eq('student_id', studentId)
      .eq('academic_year_id', activeYearId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(templateError);

    // Get class-section for this student
    const { data: classSection, error: csError } = await supabase
      .from('class_sections')
      .select('id')
      .eq('class_id', student.class_id)
      .eq('section_id', student.section_id)
      .eq('branch_id', branchId)
      .eq('academic_year_id', activeYearId)
      .maybeSingle();
    throwIfDbError(csError);
    if (!classSection) {
      throw new NotFoundException('Class-section not found for this student');
    }

    const assignedTemplateId = templateAssignment
      ? (templateAssignment as { subject_template_id: string | null }).subject_template_id
      : null;

    // Templates are optional. If student has no assignment OR the assignment isn't available for their class/level,
    // fall back to the generic (null-template) timetable.
    let effectiveTemplateId: string | null = null;
    if (assignedTemplateId) {
      const isValid = await this.isTemplateAvailableForClass(
        assignedTemplateId,
        student.class_id,
        branchId,
      );
      effectiveTemplateId = isValid ? assignedTemplateId : null;
    }

    return this.getClassTimetable(classSection.id, branchId, activeYearId, effectiveTemplateId);
  }

  private async isTemplateAvailableForClass(
    subjectTemplateId: string,
    classId: string,
    branchId: string,
  ): Promise<boolean> {
    const supabase = this.supabaseConfig.getClient();

    const [classAssignment, levelClass] = await Promise.all([
      supabase
        .from('class_subject_template_assignments')
        .select('subject_template_id')
        .eq('class_id', classId)
        .eq('branch_id', branchId)
        .eq('subject_template_id', subjectTemplateId)
        .maybeSingle(),
      // Keep consistent with existing codebase usage: level_classes is queried without branch filter.
      supabase.from('level_classes').select('level_id').eq('class_id', classId).maybeSingle(),
    ]);

    throwIfDbError(classAssignment.error);
    throwIfDbError(levelClass.error);

    if (classAssignment.data) return true;

    const levelId = (levelClass.data as { level_id?: string } | null)?.level_id;
    if (!levelId) return false;

    const { data: levelAssignment, error: levelError } = await supabase
      .from('level_subject_template_assignments')
      .select('subject_template_id')
      .eq('level_id', levelId)
      .eq('branch_id', branchId)
      .eq('subject_template_id', subjectTemplateId)
      .maybeSingle();

    throwIfDbError(levelError);
    return !!levelAssignment;
  }

  async checkConflicts(
    branchId: string,
    academicYearId?: string,
    filters?: {
      classSectionId?: string;
      staffId?: string;
    },
  ): Promise<ConflictDto[]> {
    const supabase = this.supabaseConfig.getClient();

    // Get active academic year
    let activeYearId = academicYearId;
    if (!activeYearId) {
      const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
      if (!activeYear) {
        throw new BadRequestException('No active academic year found');
      }
      activeYearId = activeYear.id;
    }

    // Build query
    let query = supabase
      .from('timetable_slots')
      .select(
        '*, subjects:subject_id(name), staff:staff_id(id, user_id), class_sections:class_section_id(id, class_id, section_id)',
      )
      .eq('branch_id', branchId)
      .eq('academic_year_id', activeYearId);

    if (filters?.classSectionId) {
      query = query.eq('class_section_id', filters.classSectionId);
    }
    if (filters?.staffId) {
      query = query.eq('staff_id', filters.staffId);
    }

    const { data: slots, error } = await query;
    throwIfDbError(error);

    const slotsArray = (slots as TimetableSlotWithRelations[]) ?? [];
    const conflicts: ConflictDto[] = [];

    // Fetch class-section names for better conflict messages (used by multiple conflict types)
    const classSectionIds = [
      ...new Set(slotsArray.map((s) => s.class_section_id)),
    ];
    const classSectionMap = new Map<string, { className: string; sectionName: string }>();

    if (classSectionIds.length > 0) {
      const { data: classSections, error: csError } = await supabase
        .from('class_sections')
        .select('id, class_id, section_id, classes:class_id(name), sections:section_id(name)')
        .in('id', classSectionIds);
      throwIfDbError(csError);

      for (const cs of (classSections as any[]) ?? []) {
        const classData = Array.isArray(cs.classes) ? cs.classes[0] : cs.classes;
        const sectionData = Array.isArray(cs.sections) ? cs.sections[0] : cs.sections;
        classSectionMap.set(cs.id, {
          className: classData?.name ?? '',
          sectionName: sectionData?.name ?? '',
        });
      }
    }

    // Fetch subject template names for better conflict messages
    const subjectTemplateIds = [
      ...new Set(
        slotsArray
          .map((s) => (s as any).subject_template_id)
          .filter((id): id is string => !!id),
      ),
    ];
    const subjectTemplateMap = new Map<string, string>();

    if (subjectTemplateIds.length > 0) {
      const { data: templates, error: templateError } = await supabase
        .from('subject_templates')
        .select('id, name')
        .in('id', subjectTemplateIds);
      throwIfDbError(templateError);

      for (const template of (templates as Array<{ id: string; name: string }>) ?? []) {
        subjectTemplateMap.set(template.id, template.name);
      }
    }

    // Fetch staff names for better conflict messages
    const staffUserIds = [
      ...new Set(
        slotsArray
          .filter((s) => s.staff_id)
          .map((s) => {
            const staffData = Array.isArray(s.staff) ? s.staff[0] : s.staff;
            return staffData?.user_id;
          })
          .filter((id): id is string => !!id),
      ),
    ];
    const staffNameMap = new Map<string, string>();

    if (staffUserIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', staffUserIds);
      throwIfDbError(profilesError);

      for (const profile of (profiles as Array<{ id: string; full_name: string }>) ?? []) {
        staffNameMap.set(profile.id, profile.full_name);
      }
    }

    // Helper function to get staff name
    const getStaffName = (staffId: string | null | undefined): string | undefined => {
      if (!staffId) return undefined;
      const staffData = slotsArray.find((s) => s.staff_id === staffId);
      if (!staffData) return undefined;
      const staff = Array.isArray(staffData.staff) ? staffData.staff[0] : staffData.staff;
      if (!staff?.user_id) return undefined;
      return staffNameMap.get(staff.user_id);
    };

    // Helper function to get class-section info
    const getClassSectionInfo = (classSectionId: string) => {
      return classSectionMap.get(classSectionId) || { className: '', sectionName: '' };
    };

    // Helper function to get subject template info
    const getSubjectTemplateInfo = (subjectTemplateId: string | null | undefined) => {
      if (!subjectTemplateId) return { id: undefined, name: undefined };
      return {
        id: subjectTemplateId,
        name: subjectTemplateMap.get(subjectTemplateId) || 'Unknown Template',
      };
    };

    // Get active school days
    const schoolDays = await this.scheduleService.getSchoolDays();
    const activeDays = schoolDays.data;

    // Check for invalid school days
    for (const slot of slotsArray) {
      if (!activeDays.includes(slot.day_of_week)) {
        const csInfo = getClassSectionInfo(slot.class_section_id);
        conflicts.push(
          new ConflictDto({
            type: 'invalid_school_day',
            message: `Slot scheduled on inactive school day (day ${slot.day_of_week})`,
            dayOfWeek: slot.day_of_week,
            slotIds: [slot.id],
            conflictingSlots: [
              {
                id: slot.id,
                classSectionId: slot.class_section_id,
                className: csInfo.className,
                sectionName: csInfo.sectionName,
                startTime: slot.start_time,
                endTime: slot.end_time,
              },
            ],
          }),
        );
      }
    }

    // Check for teacher double-booking (same staff, same day, overlapping times)
    const staffSlotsMap = new Map<string, TimetableSlotWithRelations[]>();
    for (const slot of slotsArray) {
      if (slot.staff_id) {
        const key = `${slot.staff_id}-${slot.day_of_week}`;
        const existing = staffSlotsMap.get(key) ?? [];
        existing.push(slot);
        staffSlotsMap.set(key, existing);
      }
    }

    for (const [key, daySlots] of staffSlotsMap.entries()) {
      if (daySlots.length < 2) continue;

      // Group overlapping slots together to avoid duplicate conflicts
      const slotGroups: TimetableSlotWithRelations[][] = daySlots.map((slot) => [slot]);

      // Merge groups that have overlapping slots
      let changed = true;
      while (changed) {
        changed = false;
        for (let i = 0; i < slotGroups.length; i++) {
          for (let j = i + 1; j < slotGroups.length; j++) {
            const group1 = slotGroups[i];
            const group2 = slotGroups[j];

            // Check if any slot in group1 overlaps with any slot in group2
            let hasOverlap = false;
            for (const slot1 of group1) {
              for (const slot2 of group2) {
                if (timesOverlap(slot1.start_time, slot1.end_time, slot2.start_time, slot2.end_time)) {
                  hasOverlap = true;
                  break;
                }
              }
              if (hasOverlap) break;
            }

            // If groups overlap, merge them
            if (hasOverlap) {
              slotGroups[i] = [...group1, ...group2];
              slotGroups.splice(j, 1);
              changed = true;
              break;
            }
          }
          if (changed) break;
        }
      }

      // Create one conflict per group of overlapping slots (groups with 2+ slots)
      for (const group of slotGroups) {
        if (group.length >= 2) {
          const slotIds = group.map((s) => s.id);
          const staffId = group[0].staff_id ?? undefined;
          const staffName = getStaffName(staffId);
          const conflictingSlots = group.map((slot) => {
            const csInfo = getClassSectionInfo(slot.class_section_id);
            return {
              id: slot.id,
              classSectionId: slot.class_section_id,
              className: csInfo.className,
              sectionName: csInfo.sectionName,
              startTime: slot.start_time,
              endTime: slot.end_time,
            };
          });

          // Build a more descriptive message
          const classSectionNames = conflictingSlots
            .map((cs) => `${cs.className} ${cs.sectionName}`)
            .filter((name, index, arr) => arr.indexOf(name) === index); // Remove duplicates
          const classSectionText =
            classSectionNames.length === 1
              ? classSectionNames[0]
              : `${classSectionNames.length} different class-sections`;
          const teacherText = staffName ? `Teacher ${staffName}` : 'A teacher';

          conflicts.push(
            new ConflictDto({
              type: 'teacher_double_booking',
              message: `${teacherText} is assigned to ${group.length} overlapping slot${group.length > 1 ? 's' : ''} on ${DAY_NAMES[group[0].day_of_week] || `day ${group[0].day_of_week}`} across ${classSectionText}`,
              staffId,
              dayOfWeek: group[0].day_of_week,
              slotIds,
              conflictingSlots,
            }),
          );
        }
      }
    }

    // Check for class-section slot overlaps (same class-section, same day, same subject template, overlapping times)
    // This detects when a class-section has multiple slots scheduled at the same time for the same subject template
    // Different subject templates can have slots at the same time (they represent different student groups/course tracks)
    // Group overlapping slots together to avoid duplicate conflicts
    const classSectionSlotsMap = new Map<string, TimetableSlotWithRelations[]>();
    for (const slot of slotsArray) {
      // Include subject_template_id in the key - slots with different templates don't conflict
      const templateId = (slot as any).subject_template_id || 'null';
      const key = `${slot.class_section_id}-${slot.day_of_week}-${templateId}`;
      const existing = classSectionSlotsMap.get(key) ?? [];
      existing.push(slot);
      classSectionSlotsMap.set(key, existing);
    }

    for (const [key, daySlots] of classSectionSlotsMap.entries()) {
      if (daySlots.length < 2) continue;

      // Group overlapping slots using union-find approach
      // Each slot starts in its own group
      const slotGroups: TimetableSlotWithRelations[][] = daySlots.map((slot) => [slot]);

      // Merge groups that have overlapping slots
      let changed = true;
      while (changed) {
        changed = false;
        for (let i = 0; i < slotGroups.length; i++) {
          for (let j = i + 1; j < slotGroups.length; j++) {
            const group1 = slotGroups[i];
            const group2 = slotGroups[j];

            // Check if any slot in group1 overlaps with any slot in group2
            let hasOverlap = false;
            for (const slot1 of group1) {
              for (const slot2 of group2) {
                if (timesOverlap(slot1.start_time, slot1.end_time, slot2.start_time, slot2.end_time)) {
                  hasOverlap = true;
                  break;
                }
              }
              if (hasOverlap) break;
            }

            // If groups overlap, merge them
            if (hasOverlap) {
              slotGroups[i] = [...group1, ...group2];
              slotGroups.splice(j, 1);
              changed = true;
              break;
            }
          }
          if (changed) break;
        }
      }

      // Create one conflict per group of overlapping slots (groups with 2+ slots)
      for (const group of slotGroups) {
        if (group.length >= 2) {
          const csInfo = getClassSectionInfo(group[0].class_section_id);
          const templateInfo = getSubjectTemplateInfo((group[0] as any).subject_template_id);
          const slotIds = group.map((s) => s.id);
          const conflictingSlots = group.map((slot) => ({
            id: slot.id,
            classSectionId: slot.class_section_id,
            className: csInfo.className,
            sectionName: csInfo.sectionName,
            startTime: slot.start_time,
            endTime: slot.end_time,
          }));

          const templateText = templateInfo.name
            ? ` (Subject Template: ${templateInfo.name})`
            : '';

          conflicts.push(
            new ConflictDto({
              type: 'class_section_slot_overlap',
              message: `Class-section ${csInfo.className} ${csInfo.sectionName} has ${group.length} overlapping slot${group.length > 1 ? 's' : ''} on day ${group[0].day_of_week}${templateText}`,
              dayOfWeek: group[0].day_of_week,
              slotIds,
              conflictingSlots,
              subjectTemplateId: templateInfo.id,
              subjectTemplateName: templateInfo.name,
            }),
          );
        }
      }
    }

    return conflicts;
  }
}

