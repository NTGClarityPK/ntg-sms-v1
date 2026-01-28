import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import type { PostgrestError } from '@supabase/supabase-js';
import { AttendanceDto } from './dto/attendance.dto';
import { QueryAttendanceDto } from './dto/query-attendance.dto';
import { BulkMarkAttendanceDto } from './dto/bulk-mark-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { AttendanceSummaryDto } from './dto/attendance-summary.dto';
import { AttendanceReportDto } from './dto/attendance-report.dto';
import { AcademicYearsService } from '../academic-years/academic-years.service';
import { NotificationsService } from '../notifications/notifications.service';

type AttendanceRow = {
  id: string;
  student_id: string;
  class_section_id: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  entry_time: string | null;
  exit_time: string | null;
  notes: string | null;
  marked_by: string | null;
  branch_id: string;
  academic_year_id: string;
  created_at: string;
  updated_at: string;
};

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  throw new BadRequestException(errorMessage);
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly academicYearsService: AcademicYearsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async listAttendance(
    query: QueryAttendanceDto,
    branchId: string,
    academicYearId?: string,
  ): Promise<{
    data: AttendanceDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
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

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let dbQuery = supabase
      .from('attendance')
      .select('*', { count: 'exact' })
      .eq('branch_id', branchId)
      .eq('academic_year_id', activeYearId);

    if (query.date) {
      dbQuery = dbQuery.eq('date', query.date);
    }

    // Support both single and multiple filters
    if (query.classSectionIds && query.classSectionIds.length > 0) {
      dbQuery = dbQuery.in('class_section_id', query.classSectionIds);
    } else if (query.classSectionId) {
      dbQuery = dbQuery.eq('class_section_id', query.classSectionId);
    }

    if (query.studentId) {
      dbQuery = dbQuery.eq('student_id', query.studentId);
    }

    if (query.statuses && query.statuses.length > 0) {
      dbQuery = dbQuery.in('status', query.statuses);
    } else if (query.status) {
      dbQuery = dbQuery.eq('status', query.status);
    }

    // Apply sorting
    const sortBy = query.sortBy || 'date';
    const sortOrder = query.sortOrder || 'desc';
    const ascending = sortOrder === 'asc';
    dbQuery = dbQuery.order(sortBy, { ascending });

    const { data, error, count } = await dbQuery.range(from, to);
    throwIfDbError(error);

    if (!data || data.length === 0) {
      return {
        data: [],
        meta: {
          total: count || 0,
          page,
          limit,
          totalPages: Math.ceil((count || 0) / limit),
        },
      };
    }

    // Fetch related data separately
    const attendanceRows = data as AttendanceRow[];
    const studentIds = [...new Set(attendanceRows.map((a) => a.student_id))];
    const classSectionIds = [
      ...new Set(attendanceRows.map((a) => a.class_section_id)),
    ];
    const markedByIds = attendanceRows
      .map((a) => a.marked_by)
      .filter((id): id is string => !!id);

    // Fetch students
    const { data: studentsData } = await supabase
      .from('students')
      .select('id, user_id, student_id')
      .in('id', studentIds);

    const studentUserIds = (studentsData || [])
      .map((s) => s.user_id)
      .filter((id): id is string => !!id);

    // Fetch profiles for student names
    const { data: profilesData } =
      studentUserIds.length > 0
        ? await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', studentUserIds)
        : { data: [] };

    const profileMap = new Map(
      (profilesData || []).map((p) => [p.id, p.full_name]),
    );

    // Fetch class sections
    const { data: classSectionsData } = await supabase
      .from('class_sections')
      .select('id, class_id, section_id')
      .in('id', classSectionIds);

    const classIds = [
      ...new Set(
        (classSectionsData || [])
          .map((cs) => cs.class_id)
          .filter((id): id is string => !!id),
      ),
    ];
    const sectionIds = [
      ...new Set(
        (classSectionsData || [])
          .map((cs) => cs.section_id)
          .filter((id): id is string => !!id),
      ),
    ];

    // Fetch classes and sections
    const { data: classesData } =
      classIds.length > 0
        ? await supabase
            .from('classes')
            .select('id, name, display_name')
            .in('id', classIds)
        : { data: [] };

    const { data: sectionsData } =
      sectionIds.length > 0
        ? await supabase
            .from('sections')
            .select('id, name')
            .in('id', sectionIds)
        : { data: [] };

    const classMap = new Map(
      (classesData || []).map((c) => [c.id, c.display_name || c.name]),
    );
    const sectionMap = new Map(
      (sectionsData || []).map((s) => [s.id, s.name]),
    );

    const classSectionMap = new Map(
      (classSectionsData || []).map((cs) => [
        cs.id,
        {
          classId: cs.class_id,
          sectionId: cs.section_id,
        },
      ]),
    );

    // Fetch marked by profiles
    const { data: markedByProfiles } =
      markedByIds.length > 0
        ? await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', markedByIds)
        : { data: [] };

    const markedByMap = new Map(
      (markedByProfiles || []).map((p) => [p.id, p.full_name]),
    );

    // Combine data
    const studentMap = new Map(
      (studentsData || []).map((s) => [s.id, s.user_id]),
    );

    const attendanceList = attendanceRows.map((row) => {
      const studentUserId = studentMap.get(row.student_id);
      const studentName = studentUserId
        ? profileMap.get(studentUserId)
        : undefined;
      const classSection = classSectionMap.get(row.class_section_id);
      const className = classSection
        ? classMap.get(classSection.classId)
        : undefined;
      const sectionName = classSection
        ? sectionMap.get(classSection.sectionId)
        : undefined;
      const markedByName = row.marked_by
        ? markedByMap.get(row.marked_by)
        : undefined;

      return new AttendanceDto({
        id: row.id,
        studentId: row.student_id,
        studentName: studentName || 'Unknown',
        classSectionId: row.class_section_id,
        className: className || 'Unknown',
        sectionName: sectionName || 'Unknown',
        date: row.date,
        status: row.status,
        entryTime: row.entry_time ?? undefined,
        exitTime: row.exit_time ?? undefined,
        notes: row.notes ?? undefined,
        markedById: row.marked_by ?? undefined,
        markedByName: markedByName ?? undefined,
        branchId: row.branch_id,
        academicYearId: row.academic_year_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    });

    return {
      data: attendanceList,
      meta: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    };
  }

  async getAttendanceByClassAndDate(
    classSectionId: string,
    date: string,
    branchId: string,
    academicYearId?: string,
  ): Promise<AttendanceDto[]> {
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

    // Fetch existing attendance
    const { data: attendanceData, error: attendanceError } = await supabase
      .from('attendance')
      .select('*')
      .eq('class_section_id', classSectionId)
      .eq('date', date)
      .eq('branch_id', branchId)
      .eq('academic_year_id', activeYearId);

    throwIfDbError(attendanceError);

    // Fetch class-section details to get class_id and section_id
    const { data: classSectionDetails, error: classSectionDetailsError } =
      await supabase
        .from('class_sections')
        .select('class_id, section_id')
        .eq('id', classSectionId)
        .eq('branch_id', branchId)
        .single();

    throwIfDbError(classSectionDetailsError);
    if (!classSectionDetails) {
      throw new NotFoundException('Class section not found');
    }

    // Fetch all students in the class-section (using class_id and section_id)
    const { data: studentsData, error: studentsError } = await supabase
      .from('students')
      .select('id, user_id, student_id')
      .eq('class_id', classSectionDetails.class_id)
      .eq('section_id', classSectionDetails.section_id)
      .eq('branch_id', branchId)
      .eq('is_active', true);

    const studentIdNumberMap = new Map(
      (studentsData || []).map((s) => [s.id, s.student_id]),
    );

    throwIfDbError(studentsError);

    // Fetch related data
    const studentUserIds = (studentsData || [])
      .map((s) => s.user_id)
      .filter((id): id is string => !!id);

    const { data: profilesData } =
      studentUserIds.length > 0
        ? await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', studentUserIds)
        : { data: [] };

    const profileMap = new Map(
      (profilesData || []).map((p) => [p.id, p.full_name]),
    );

    const { data: classData } = await supabase
      .from('classes')
      .select('id, name, display_name')
      .eq('id', classSectionDetails.class_id)
      .single();

    const { data: sectionData } = await supabase
      .from('sections')
      .select('id, name')
      .eq('id', classSectionDetails.section_id)
      .single();

    const attendanceMap = new Map(
      (attendanceData || []).map((a) => [a.student_id, a as AttendanceRow]),
    );

    const className = classData?.display_name || classData?.name || 'Unknown';
    const sectionName = sectionData?.name || 'Unknown';

    // Return all students with their attendance (or null if not marked)
    const result = (studentsData || []).map((student) => {
      const attendance = attendanceMap.get(student.id);
      const studentUserId = student.user_id;
      const studentName = studentUserId
        ? profileMap.get(studentUserId)
        : undefined;

      const studentIdNumber = studentIdNumberMap.get(student.id);

      if (attendance) {
        return new AttendanceDto({
          id: attendance.id,
          studentId: student.id,
          studentIdNumber: studentIdNumber ?? undefined,
          studentName: studentName || 'Unknown',
          classSectionId: classSectionId,
          className,
          sectionName,
          date: attendance.date,
          status: attendance.status,
          entryTime: attendance.entry_time ?? undefined,
          exitTime: attendance.exit_time ?? undefined,
          notes: attendance.notes ?? undefined,
          markedById: attendance.marked_by ?? undefined,
          branchId: attendance.branch_id,
          academicYearId: attendance.academic_year_id,
          createdAt: attendance.created_at,
          updatedAt: attendance.updated_at,
        });
      } else {
        // Return unmarked attendance record
        return new AttendanceDto({
          id: '',
          studentId: student.id,
          studentIdNumber: studentIdNumber ?? undefined,
          studentName: studentName || 'Unknown',
          classSectionId: classSectionId,
          className,
          sectionName,
          date,
          status: 'present', // Default
          entryTime: undefined,
          exitTime: undefined,
          notes: undefined,
          markedById: undefined,
          branchId,
          academicYearId: activeYearId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    });

    return result;
  }

  async getAttendanceByStudent(
    studentId: string,
    branchId: string,
    academicYearId?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<AttendanceDto[]> {
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

    // Verify student exists and belongs to branch
    const { data: studentData, error: studentError } = await supabase
      .from('students')
      .select('id, user_id')
      .eq('id', studentId)
      .eq('branch_id', branchId)
      .single();

    throwIfDbError(studentError);
    if (!studentData) {
      throw new NotFoundException('Student not found');
    }

    let dbQuery = supabase
      .from('attendance')
      .select('*')
      .eq('student_id', studentId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', activeYearId)
      .order('date', { ascending: false });

    if (startDate) {
      dbQuery = dbQuery.gte('date', startDate);
    }
    if (endDate) {
      dbQuery = dbQuery.lte('date', endDate);
    }

    const { data, error } = await dbQuery;
    throwIfDbError(error);

    if (!data || data.length === 0) {
      return [];
    }

    // Fetch related data
    const attendanceRows = data as AttendanceRow[];
    const classSectionIds = [
      ...new Set(attendanceRows.map((a) => a.class_section_id)),
    ];

    const { data: classSectionsData } = await supabase
      .from('class_sections')
      .select('id, class_id, section_id')
      .in('id', classSectionIds);

    const classIds = [
      ...new Set(
        (classSectionsData || [])
          .map((cs) => cs.class_id)
          .filter((id): id is string => !!id),
      ),
    ];
    const sectionIds = [
      ...new Set(
        (classSectionsData || [])
          .map((cs) => cs.section_id)
          .filter((id): id is string => !!id),
      ),
    ];

    const { data: classesData } =
      classIds.length > 0
        ? await supabase
            .from('classes')
            .select('id, name, display_name')
            .in('id', classIds)
        : { data: [] };

    const { data: sectionsData } =
      sectionIds.length > 0
        ? await supabase
            .from('sections')
            .select('id, name')
            .in('id', sectionIds)
        : { data: [] };

    const classMap = new Map(
      (classesData || []).map((c) => [c.id, c.display_name || c.name]),
    );
    const sectionMap = new Map(
      (sectionsData || []).map((s) => [s.id, s.name]),
    );

    const classSectionMap = new Map(
      (classSectionsData || []).map((cs) => [
        cs.id,
        {
          classId: cs.class_id,
          sectionId: cs.section_id,
        },
      ]),
    );

    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('id', studentData.user_id)
      .single();

    const studentName = profileData?.full_name || 'Unknown';

    return attendanceRows.map((row) => {
      const classSection = classSectionMap.get(row.class_section_id);
      const className = classSection
        ? classMap.get(classSection.classId)
        : undefined;
      const sectionName = classSection
        ? sectionMap.get(classSection.sectionId)
        : undefined;

      return new AttendanceDto({
        id: row.id,
        studentId: row.student_id,
        studentName,
        classSectionId: row.class_section_id,
        className: className || 'Unknown',
        sectionName: sectionName || 'Unknown',
        date: row.date,
        status: row.status,
        entryTime: row.entry_time ?? undefined,
        exitTime: row.exit_time ?? undefined,
        notes: row.notes ?? undefined,
        markedById: row.marked_by ?? undefined,
        branchId: row.branch_id,
        academicYearId: row.academic_year_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    });
  }

  async bulkMarkAttendance(
    input: BulkMarkAttendanceDto,
    branchId: string,
    academicYearId: string,
    userId: string,
  ): Promise<AttendanceDto[]> {
    const supabase = this.supabaseConfig.getClient();

    // Verify class-section exists and belongs to branch
    const { data: classSectionData, error: classSectionError } = await supabase
      .from('class_sections')
      .select('id, class_id, section_id')
      .eq('id', input.classSectionId)
      .eq('branch_id', branchId)
      .single();

    throwIfDbError(classSectionError);
    if (!classSectionData) {
      throw new NotFoundException('Class section not found');
    }

    // Verify all students belong to the class-section
    const studentIds = input.records.map((r) => r.studentId);
    const { data: studentsData, error: studentsError } = await supabase
      .from('students')
      .select('id, class_id, section_id')
      .in('id', studentIds)
      .eq('branch_id', branchId);

    throwIfDbError(studentsError);

    // Note: We're checking class_id and section_id separately since students table
    // has separate columns, not class_section_id. This is a limitation we need to work with.
    // For now, we'll just verify students belong to the branch.

    // PERF: avoid N+1 queries by upserting all records in one request
    const nowIso = new Date().toISOString();
    const upsertRows = input.records.map((record) => ({
      student_id: record.studentId,
      class_section_id: input.classSectionId,
      date: input.date,
      status: record.status,
      entry_time: record.entryTime || null,
      exit_time: record.exitTime || null,
      notes: record.notes || null,
      marked_by: userId,
      branch_id: branchId,
      academic_year_id: academicYearId,
      updated_at: nowIso,
    }));

    const { data: upserted, error: upsertError } = await supabase
      .from('attendance')
      .upsert(upsertRows, { onConflict: 'student_id,date,academic_year_id' })
      .select(
        'id, student_id, class_section_id, date, status, entry_time, exit_time, notes, marked_by, branch_id, academic_year_id, created_at, updated_at',
      );

    throwIfDbError(upsertError);

    const upsertedRows = (upserted || []) as AttendanceRow[];
    if (upsertedRows.length === 0) {
      return [];
    }

    const classSection = classSectionData as { class_id: string; section_id: string };

    const { data: classRows, error: classError } = await supabase
      .from('classes')
      .select('id, name, display_name')
      .eq('id', classSection.class_id)
      .maybeSingle();
    throwIfDbError(classError);

    const { data: sectionRows, error: sectionError } = await supabase
      .from('sections')
      .select('id, name')
      .eq('id', classSection.section_id)
      .maybeSingle();
    throwIfDbError(sectionError);

    const className = (classRows as { display_name?: string | null; name?: string | null } | null)
      ? (classRows as { display_name?: string | null; name?: string | null }).display_name ||
        (classRows as { display_name?: string | null; name?: string | null }).name ||
        'Unknown'
      : 'Unknown';
    const sectionName = (sectionRows as { name?: string | null } | null)
      ? (sectionRows as { name?: string | null }).name || 'Unknown'
      : 'Unknown';

    // Best-effort notifications: do not block API response
    for (const row of upsertedRows) {
      void this.notificationsService
        .createAttendanceNotification(
          row.student_id,
          {
            date: row.date,
            status: row.status,
            attendanceId: row.id,
          },
          branchId,
        )
        .catch(() => {
          // intentionally swallow (notifications are non-critical)
        });
    }

    // Return hydrated DTOs in one go (no per-student listAttendance calls)
    const attendanceMap = new Map(upsertedRows.map((r) => [r.student_id, r]));
    const uniqueStudentIds = [...new Set(upsertedRows.map((r) => r.student_id))];

    const { data: studentRows, error: studentFetchError } = await supabase
      .from('students')
      .select('id, user_id, student_id')
      .in('id', uniqueStudentIds);
    throwIfDbError(studentFetchError);

    const studentUserIds = (studentRows || [])
      .map((s) => (s as { user_id: string | null }).user_id)
      .filter((id): id is string => !!id);

    const { data: profileRows, error: profileError } =
      studentUserIds.length > 0
        ? await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', studentUserIds)
        : { data: [], error: null };
    throwIfDbError(profileError);

    const profileNameById = new Map(
      (profileRows || []).map((p) => [
        (p as { id: string }).id,
        (p as { full_name: string }).full_name,
      ]),
    );

    const studentById = new Map(
      (studentRows || []).map((s) => [(s as { id: string }).id, s as { id: string; user_id: string | null; student_id: string }]),
    );

    return uniqueStudentIds
      .map((studentId) => {
        const row = attendanceMap.get(studentId);
        if (!row) return null;
        const student = studentById.get(studentId);
        const studentName = student?.user_id
          ? profileNameById.get(student.user_id) || 'Unknown'
          : 'Unknown';

        return new AttendanceDto({
          id: row.id,
          studentId: row.student_id,
          studentIdNumber: student?.student_id,
          studentName,
          classSectionId: row.class_section_id,
          className,
          sectionName,
          date: row.date,
          status: row.status,
          entryTime: row.entry_time ?? undefined,
          exitTime: row.exit_time ?? undefined,
          notes: row.notes ?? undefined,
          markedById: row.marked_by ?? undefined,
          branchId: row.branch_id,
          academicYearId: row.academic_year_id,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      })
      .filter((x): x is AttendanceDto => !!x);
  }

  async updateAttendance(
    id: string,
    input: UpdateAttendanceDto,
    branchId: string,
    userId: string,
  ): Promise<AttendanceDto> {
    const supabase = this.supabaseConfig.getClient();

    // Verify attendance exists and belongs to branch
    const { data: existing, error: fetchError } = await supabase
      .from('attendance')
      .select('*')
      .eq('id', id)
      .eq('branch_id', branchId)
      .single();

    throwIfDbError(fetchError);
    if (!existing) {
      throw new NotFoundException('Attendance record not found');
    }

    const updateData: Partial<AttendanceRow> = {
      updated_at: new Date().toISOString(),
      marked_by: userId,
    };

    if (input.status !== undefined) {
      updateData.status = input.status;
    }
    if (input.entryTime !== undefined) {
      updateData.entry_time = input.entryTime || null;
    }
    if (input.exitTime !== undefined) {
      updateData.exit_time = input.exitTime || null;
    }
    if (input.notes !== undefined) {
      updateData.notes = input.notes || null;
    }

    const { data: updated, error: updateError } = await supabase
      .from('attendance')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    throwIfDbError(updateError);
    if (!updated) {
      throw new NotFoundException('Failed to update attendance');
    }

    // Fetch full attendance record with relations
    const attendanceList = await this.listAttendance(
      {
        page: 1,
        limit: 1,
      } as QueryAttendanceDto,
      branchId,
      existing.academic_year_id,
    );
    const found = attendanceList.data.find((a) => a.id === updated.id);
    if (!found) {
      throw new NotFoundException('Failed to fetch updated attendance');
    }

    return found;
  }

  async getAttendanceSummaryByStudent(
    studentId: string,
    branchId: string,
    academicYearId?: string,
  ): Promise<AttendanceSummaryDto> {
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

    // Verify student exists
    const { data: studentData, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('id', studentId)
      .eq('branch_id', branchId)
      .single();

    throwIfDbError(studentError);
    if (!studentData) {
      throw new NotFoundException('Student not found');
    }

    // Get academic year dates
    const { data: academicYear, error: yearError } = await supabase
      .from('academic_years')
      .select('start_date, end_date')
      .eq('id', activeYearId)
      .single();

    throwIfDbError(yearError);
    if (!academicYear) {
      throw new NotFoundException('Academic year not found');
    }

    // Count attendance by status
    const { data: attendanceData, error: attendanceError } = await supabase
      .from('attendance')
      .select('status')
      .eq('student_id', studentId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', activeYearId)
      .gte('date', academicYear.start_date)
      .lte('date', academicYear.end_date);

    throwIfDbError(attendanceError);

    const presentDays = (attendanceData || []).filter(
      (a) => a.status === 'present',
    ).length;
    const absentDays = (attendanceData || []).filter(
      (a) => a.status === 'absent',
    ).length;
    const lateDays = (attendanceData || []).filter(
      (a) => a.status === 'late',
    ).length;
    const excusedDays = (attendanceData || []).filter(
      (a) => a.status === 'excused',
    ).length;
    const totalDays = (attendanceData || []).length;
    const percentage =
      totalDays > 0
        ? Math.round(
            ((presentDays + lateDays) / totalDays) * 100,
          )
        : 0;

    return new AttendanceSummaryDto({
      totalDays,
      presentDays,
      absentDays,
      lateDays,
      excusedDays,
      percentage,
    });
  }

  async getAttendanceSummaryByClass(
    classSectionId: string,
    branchId: string,
    academicYearId?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<AttendanceSummaryDto> {
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

    // Verify class-section exists
    const { data: classSectionData, error: classSectionError } = await supabase
      .from('class_sections')
      .select('id')
      .eq('id', classSectionId)
      .eq('branch_id', branchId)
      .single();

    throwIfDbError(classSectionError);
    if (!classSectionData) {
      throw new NotFoundException('Class section not found');
    }

    let dbQuery = supabase
      .from('attendance')
      .select('status')
      .eq('class_section_id', classSectionId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', activeYearId);

    if (startDate) {
      dbQuery = dbQuery.gte('date', startDate);
    }
    if (endDate) {
      dbQuery = dbQuery.lte('date', endDate);
    }

    const { data: attendanceData, error: attendanceError } = await dbQuery;
    throwIfDbError(attendanceError);

    const presentDays = (attendanceData || []).filter(
      (a) => a.status === 'present',
    ).length;
    const absentDays = (attendanceData || []).filter(
      (a) => a.status === 'absent',
    ).length;
    const lateDays = (attendanceData || []).filter(
      (a) => a.status === 'late',
    ).length;
    const excusedDays = (attendanceData || []).filter(
      (a) => a.status === 'excused',
    ).length;
    const totalDays = (attendanceData || []).length;
    const percentage =
      totalDays > 0
        ? Math.round(
            ((presentDays + lateDays) / totalDays) * 100,
          )
        : 0;

    return new AttendanceSummaryDto({
      totalDays,
      presentDays,
      absentDays,
      lateDays,
      excusedDays,
      percentage,
    });
  }

  async generateAttendanceReport(
    query: QueryAttendanceDto,
    branchId: string,
    academicYearId?: string,
  ): Promise<AttendanceReportDto> {
    // Get all attendance records (no pagination for reports)
    const attendanceList = await this.listAttendance(
      { ...query, page: 1, limit: 10000 } as QueryAttendanceDto,
      branchId,
      academicYearId,
    );

    // Calculate summary
    const summary = new AttendanceSummaryDto({
      totalDays: attendanceList.data.length,
      presentDays: attendanceList.data.filter((a) => a.status === 'present')
        .length,
      absentDays: attendanceList.data.filter((a) => a.status === 'absent')
        .length,
      lateDays: attendanceList.data.filter((a) => a.status === 'late').length,
      excusedDays: attendanceList.data.filter((a) => a.status === 'excused')
        .length,
      percentage: 0,
    });

    summary.percentage =
      summary.totalDays > 0
        ? Math.round(
            ((summary.presentDays + summary.lateDays) / summary.totalDays) *
              100,
          )
        : 0;

    // Get date range
    const dates = attendanceList.data.map((a) => a.date).sort();
    const startDate = dates[0] || '';
    const endDate = dates[dates.length - 1] || '';

    // Get class-section info if filtered
    let className: string | undefined;
    let sectionName: string | undefined;
    if (query.classSectionId) {
      const firstRecord = attendanceList.data[0];
      if (firstRecord) {
        className = firstRecord.className;
        sectionName = firstRecord.sectionName;
      }
    }

    return new AttendanceReportDto({
      startDate,
      endDate,
      classSectionId: query.classSectionId,
      className,
      sectionName,
      summary,
      records: attendanceList.data,
    });
  }
}

