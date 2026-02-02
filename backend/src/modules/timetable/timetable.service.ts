import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AcademicYearsService } from '../academic-years/academic-years.service';
import { ScheduleService } from '../schedule/schedule.service';
import { TeacherAssignmentsService } from '../teacher-assignments/teacher-assignments.service';
import { TimetableSlotDto } from './dto/timetable-slot.dto';
import { CreateTimetableSlotDto } from './dto/create-timetable-slot.dto';
import { ClassTimetableDto } from './dto/class-timetable.dto';
import { TeacherTimetableDto, FreePeriod } from './dto/teacher-timetable.dto';
import { ConflictDto, ConflictType, ConflictingSlot } from './dto/conflict.dto';
import { TimingTemplateInfoDto } from './dto/timing-template-info.dto';

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
    private readonly academicYearsService: AcademicYearsService,
    private readonly scheduleService: ScheduleService,
    private readonly teacherAssignmentsService: TeacherAssignmentsService,
  ) {}

  async getClassTimetable(
    classSectionId: string,
    branchId: string,
    academicYearId?: string,
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
    const { data: slotsData, error: slotsError } = await supabase
      .from('timetable_slots')
      .select(
        '*, subjects:subject_id(name), staff:staff_id(id, user_id), class_sections:class_section_id(id, class_id, section_id)',
      )
      .eq('class_section_id', classSectionId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', activeYearId)
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

    // Upsert using unique constraint
    const { data, error } = await supabase
      .from('timetable_slots')
      .upsert(
        {
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
        },
        {
          onConflict: 'class_section_id,day_of_week,start_time,end_time,academic_year_id',
        },
      )
      .select('*')
      .single();
    throwIfDbError(error);

    const row = data as TimetableSlotRow;
    return this.getClassTimetable(input.classSectionId, branchId, academicYearId).then(
      (timetable) => timetable.slots.find((s) => s.id === row.id)!,
    );
  }

  async deleteSlot(id: string, branchId: string): Promise<{ success: boolean }> {
    const supabase = this.supabaseConfig.getClient();

    // Verify slot belongs to branch
    const { data: slot, error: slotError } = await supabase
      .from('timetable_slots')
      .select('id')
      .eq('id', id)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(slotError);
    if (!slot) {
      throw new NotFoundException('Timetable slot not found');
    }

    const { error } = await supabase.from('timetable_slots').delete().eq('id', id);
    throwIfDbError(error);

    return { success: true };
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
    academicYearId?: string,
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
        });
      });
    }

    if (slotsToInsert.length === 0) {
      return { slotsCreated: 0 };
    }

    // Upsert slots (will replace existing ones due to unique constraint)
    const { error: insertError } = await supabase
      .from('timetable_slots')
      .upsert(slotsToInsert, {
        onConflict: 'class_section_id,day_of_week,start_time,end_time,academic_year_id',
      });
    throwIfDbError(insertError);

    return { slotsCreated: slotsToInsert.length };
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

    // Get active school days
    const schoolDays = await this.scheduleService.getSchoolDays();
    const activeDays = schoolDays.data;

    // Check for invalid school days
    for (const slot of slotsArray) {
      if (!activeDays.includes(slot.day_of_week)) {
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

      for (let i = 0; i < daySlots.length; i++) {
        for (let j = i + 1; j < daySlots.length; j++) {
          const slot1 = daySlots[i];
          const slot2 = daySlots[j];

          if (timesOverlap(slot1.start_time, slot1.end_time, slot2.start_time, slot2.end_time)) {
            const classSection1 = Array.isArray(slot1.class_sections)
              ? slot1.class_sections[0]
              : slot1.class_sections;
            const classSection2 = Array.isArray(slot2.class_sections)
              ? slot2.class_sections[0]
              : slot2.class_sections;

            conflicts.push(
              new ConflictDto({
                type: 'teacher_double_booking',
                message: `Teacher has overlapping slots on day ${slot1.day_of_week}`,
                staffId: slot1.staff_id ?? undefined,
                dayOfWeek: slot1.day_of_week,
                slotIds: [slot1.id, slot2.id],
                conflictingSlots: [
                  {
                    id: slot1.id,
                    classSectionId: slot1.class_section_id,
                    startTime: slot1.start_time,
                    endTime: slot1.end_time,
                  },
                  {
                    id: slot2.id,
                    classSectionId: slot2.class_section_id,
                    startTime: slot2.start_time,
                    endTime: slot2.end_time,
                  },
                ],
              }),
            );
          }
        }
      }
    }

    return conflicts;
  }
}

