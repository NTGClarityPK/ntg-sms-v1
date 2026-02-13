import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AcademicYearsService } from '../academic-years/academic-years.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ScheduleService } from '../schedule/schedule.service';
import { LeaveRequestDto } from './dto/leave-request.dto';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { UpdateLeaveStatusDto } from './dto/update-leave-status.dto';
import { QueryLeaveRequestsDto } from './dto/query-leave-requests.dto';
import { LeaveQuotaDto } from './dto/leave-quota.dto';
import type { LeaveStatus } from './dto/leave-status.type';

type LeaveRequestRow = {
  id: string;
  student_id: string;
  requested_by: string;
  start_date: string;
  end_date: string;
  reason: string;
  attachment_url: string | null;
  status: LeaveStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  branch_id: string;
  academic_year_id: string;
  created_at: string;
  updated_at: string;
};

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(
    error instanceof Error ? error.message : 'Unknown error',
  );
}

/** Expand [startDate, endDate] to Set of YYYY-MM-DD strings (inclusive). */
function rangeToDateSet(startDate: string, endDate: string): Set<string> {
  const start = new Date(startDate + 'T12:00:00Z');
  const end = new Date(endDate + 'T12:00:00Z');
  const set = new Set<string>();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return set;
  const cur = new Date(start);
  while (cur <= end) {
    const y = cur.getUTCFullYear();
    const m = String(cur.getUTCMonth() + 1).padStart(2, '0');
    const d = String(cur.getUTCDate()).padStart(2, '0');
    set.add(`${y}-${m}-${d}`);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return set;
}

/** Count days in [startDate, endDate] that are active school days and not in excludedDates. */
function countActiveSchoolDaysInRangeExcluding(
  startDate: string,
  endDate: string,
  activeDayOfWeeks: number[],
  excludedDates: Set<string>,
): number {
  const start = new Date(startDate + 'T12:00:00Z');
  const end = new Date(endDate + 'T12:00:00Z');
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return 0;
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const y = cur.getUTCFullYear();
    const m = String(cur.getUTCMonth() + 1).padStart(2, '0');
    const d = String(cur.getUTCDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    const dayOfWeek = cur.getUTCDay();
    if (activeDayOfWeeks.includes(dayOfWeek) && !excludedDates.has(dateStr)) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

@Injectable()
export class LeaveRequestsService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly academicYearsService: AcademicYearsService,
    private readonly notificationsService: NotificationsService,
    private readonly scheduleService: ScheduleService,
  ) {}

  private mapRowToDto(row: LeaveRequestRow): LeaveRequestDto {
    return new LeaveRequestDto({
      id: row.id,
      studentId: row.student_id,
      requestedBy: row.requested_by,
      startDate: row.start_date,
      endDate: row.end_date,
      reason: row.reason,
      attachmentUrl: row.attachment_url ?? undefined,
      status: row.status,
      reviewedBy: row.reviewed_by ?? undefined,
      reviewedAt: row.reviewed_at ?? undefined,
      reviewNotes: row.review_notes ?? undefined,
      branchId: row.branch_id,
      academicYearId: row.academic_year_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private async ensureParentCanAccessStudent(
    parentUserId: string,
    studentId: string,
  ): Promise<void> {
    const supabase = this.supabaseConfig.getClient();

    const { data, error } = await supabase
      .from('parent_students')
      .select('id')
      .eq('parent_user_id', parentUserId)
      .eq('student_id', studentId)
      .maybeSingle();

    throwIfDbError(error);

    if (!data) {
      throw new ForbiddenException(
        'You are not linked to this student and cannot request leave',
      );
    }
  }

  /**
   * Check if [startA, endA] overlaps with [startB, endB] (inclusive dates).
   */
  private static dateRangesOverlap(
    startA: string,
    endA: string,
    startB: string,
    endB: string,
  ): boolean {
    return startA <= endB && endA >= startB;
  }

  async createLeaveRequest(
    input: CreateLeaveRequestDto,
    userId: string,
    branchId: string,
  ): Promise<LeaveRequestDto> {
    const supabase = this.supabaseConfig.getClient();

    await this.ensureParentCanAccessStudent(userId, input.studentId);

    const activeYear =
      await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) {
      throw new BadRequestException('No active academic year found');
    }

    if (input.endDate < input.startDate) {
      throw new BadRequestException('End date cannot be before start date');
    }

    const { data: existing, error: conflictError } = await supabase
      .from('leave_requests')
      .select('id, start_date, end_date, status')
      .eq('student_id', input.studentId)
      .eq('academic_year_id', activeYear.id)
      .in('status', ['pending', 'approved']);

    throwIfDbError(conflictError);

    const overlaps = (existing ?? []).some(
      (row: { start_date: string; end_date: string }) =>
        LeaveRequestsService.dateRangesOverlap(
          input.startDate,
          input.endDate,
          row.start_date,
          row.end_date,
        ),
    );
    if (overlaps) {
      throw new BadRequestException(
        'A leave request for this student already exists for the same or overlapping dates (pending or approved). Please cancel or use the existing request.',
      );
    }

    const { data, error } = await supabase
      .from('leave_requests')
      .insert({
        student_id: input.studentId,
        requested_by: userId,
        start_date: input.startDate,
        end_date: input.endDate,
        reason: input.reason,
        attachment_url: input.attachmentUrl ?? null,
        status: 'pending',
        branch_id: branchId,
        academic_year_id: activeYear.id,
      })
      .select()
      .single();

    throwIfDbError(error);
    if (!data) {
      throw new BadRequestException('Failed to create leave request');
    }

    const row = data as LeaveRequestRow;

    // Notify school admin, admin assistant, and class teacher (best-effort)
    try {
      const recipientUserIds = await this.getLeaveRequestRaisedRecipients(
        input.studentId,
        branchId,
        activeYear.id,
        userId,
      );
      if (recipientUserIds.length > 0) {
        const studentName = await this.getStudentNameForNotification(input.studentId);
        await this.notificationsService.createLeaveRequestRaisedNotifications({
          recipientUserIds,
          studentName,
          startDate: row.start_date,
          endDate: row.end_date,
          leaveRequestId: row.id,
        });
      }
    } catch {
      // ignore notification errors
    }

    return this.mapRowToDto(row);
  }

  /**
   * Get student display name for notifications (profiles.full_name or 'Student').
   */
  private async getStudentNameForNotification(studentId: string): Promise<string> {
    const supabase = this.supabaseConfig.getClient();
    const { data: studentData } = await supabase
      .from('students')
      .select('user_id')
      .eq('id', studentId)
      .single();
    if (!studentData) return 'Student';
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', (studentData as { user_id: string }).user_id)
      .maybeSingle();
    return (profile as { full_name?: string } | null)?.full_name || 'Student';
  }

  /**
   * Get user IDs to notify when a leave request is raised: school_admin, admin_assistant, and class teacher for the student (same branch). Excludes requester.
   */
  private async getLeaveRequestRaisedRecipients(
    studentId: string,
    branchId: string,
    academicYearId: string,
    requestedByUserId: string,
  ): Promise<string[]> {
    const supabase = this.supabaseConfig.getClient();
    const recipientIds = new Set<string>();

    // School admin and admin assistant: user_roles for this branch with role name in ('school_admin', 'admin_assistant')
    const { data: userRolesData, error: urError } = await supabase
      .from('user_roles')
      .select('user_id, role_id')
      .eq('branch_id', branchId);

    if (urError || !userRolesData || userRolesData.length === 0) {
      // Continue to try class teacher; if no admin/assistant roles, recipientIds stays empty for them
    } else {
      const roleIds = [...new Set((userRolesData as { role_id: string }[]).map((ur) => ur.role_id))];
      const { data: rolesData } = await supabase
        .from('roles')
        .select('id, name')
        .in('id', roleIds);
      const adminRoleNames = new Set(['school_admin', 'admin_assistant']);
      const adminRoleIds = new Set(
        (rolesData ?? [])
          .filter((r: { name: string }) => adminRoleNames.has(r.name))
          .map((r: { id: string }) => r.id),
      );
      for (const ur of userRolesData as { user_id: string; role_id: string }[]) {
        if (adminRoleIds.has(ur.role_id)) recipientIds.add(ur.user_id);
      }
    }


    // Class teacher of the student's class section (for this branch and academic year)
    const { data: studentRow } = await supabase
      .from('students')
      .select('class_id, section_id')
      .eq('id', studentId)
      .eq('branch_id', branchId)
      .single();

    if (studentRow && (studentRow as { class_id: string | null }).class_id && (studentRow as { section_id: string | null }).section_id) {
      const st = studentRow as { class_id: string; section_id: string };
      const { data: classSection } = await supabase
        .from('class_sections')
        .select('class_teacher_id')
        .eq('class_id', st.class_id)
        .eq('section_id', st.section_id)
        .eq('branch_id', branchId)
        .eq('academic_year_id', academicYearId)
        .eq('is_active', true)
        .maybeSingle();

      if (classSection && (classSection as { class_teacher_id: string | null }).class_teacher_id) {
        const ctId = (classSection as { class_teacher_id: string }).class_teacher_id;
        const { data: staffRow } = await supabase
          .from('staff')
          .select('user_id')
          .eq('id', ctId)
          .maybeSingle();
        if (staffRow && (staffRow as { user_id: string }).user_id) {
          recipientIds.add((staffRow as { user_id: string }).user_id);
        }
      }
    }

    recipientIds.delete(requestedByUserId);
    return [...recipientIds];
  }

  async listLeaveRequests(
    query: QueryLeaveRequestsDto,
    userId: string,
    branchId: string,
    isParent: boolean = false,
  ): Promise<{
    data: LeaveRequestDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const supabase = this.supabaseConfig.getClient();

    // Check if user is a parent by querying user_roles and roles
    if (!isParent) {
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role_id')
        .eq('user_id', userId)
        .eq('branch_id', branchId);

      if (userRoles && userRoles.length > 0) {
        const roleIds = userRoles.map((ur) => ur.role_id);
        const { data: roles } = await supabase
          .from('roles')
          .select('name')
          .in('id', roleIds)
          .eq('name', 'parent')
          .limit(1);

        if (roles && roles.length > 0) {
          isParent = true;
        }
      }
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let dbQuery = supabase
      .from('leave_requests')
      .select(
        'id, student_id, requested_by, start_date, end_date, reason, attachment_url, status, reviewed_by, reviewed_at, review_notes, branch_id, academic_year_id, created_at, updated_at',
        { count: 'exact' },
      )
      .eq('branch_id', branchId);

    // For parents, only show their own requests
    if (isParent) {
      dbQuery = dbQuery.eq('requested_by', userId);
    }

    if (query.studentId) {
      dbQuery = dbQuery.eq('student_id', query.studentId);
    }

    if (query.status && query.status.length > 0) {
      dbQuery = dbQuery.in('status', query.status);
    }

    if (query.startDate) {
      dbQuery = dbQuery.gte('start_date', query.startDate);
    }

    if (query.endDate) {
      dbQuery = dbQuery.lte('end_date', query.endDate);
    }

    const sortBy = query.sortBy || 'created_at';
    const sortOrder = query.sortOrder || 'desc';
    const ascending = sortOrder === 'asc';

    dbQuery = dbQuery.order(sortBy, { ascending });

    const { data, error, count } = await dbQuery.range(from, to);
    
    throwIfDbError(error);

    const rows = (data ?? []) as LeaveRequestRow[];
    
    // Fetch reviewer information for requests that have been reviewed
    const reviewerIds = Array.from(
      new Set(
        rows
          .filter((row) => row.reviewed_by)
          .map((row) => row.reviewed_by!)
      )
    );

    const reviewerProfileMap = new Map<string, string>();
    const reviewerRoleMap = new Map<string, string>();

    if (reviewerIds.length > 0) {
      // Fetch reviewer profiles
      const { data: reviewerProfiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', reviewerIds);

      if (reviewerProfiles) {
        reviewerProfiles.forEach((profile) => {
          reviewerProfileMap.set(profile.id, profile.full_name || 'Unknown');
        });
      }

      // Fetch reviewer roles (get primary role for each reviewer)
      const { data: reviewerUserRoles } = await supabase
        .from('user_roles')
        .select('user_id, role_id')
        .in('user_id', reviewerIds)
        .eq('branch_id', branchId);

      if (reviewerUserRoles && reviewerUserRoles.length > 0) {
        const roleIds = Array.from(
          new Set(reviewerUserRoles.map((ur) => ur.role_id))
        );

        const { data: rolesData } = await supabase
          .from('roles')
          .select('id, name, display_name')
          .in('id', roleIds);

        if (rolesData) {
          const roleMap = new Map<string, { name: string; displayName: string }>();
          rolesData.forEach((role) => {
            roleMap.set(role.id, {
              name: role.name,
              displayName: role.display_name || role.name,
            });
          });

          // Get the first role for each reviewer (primary role) - use display_name for display
          reviewerUserRoles.forEach((ur) => {
            const role = roleMap.get(ur.role_id);
            if (role && !reviewerRoleMap.has(ur.user_id)) {
              reviewerRoleMap.set(ur.user_id, role.displayName);
            }
          });
        }
      }
    }

    const items = rows.map((row) => {
      const baseDto = this.mapRowToDto(row);
      
      // Add reviewer information if available
      if (row.reviewed_by) {
        const reviewerName = reviewerProfileMap.get(row.reviewed_by);
        const reviewerRole = reviewerRoleMap.get(row.reviewed_by);
        
        if (reviewerName) {
          return new LeaveRequestDto({
            ...baseDto,
            reviewerName,
            reviewerRole: reviewerRole || undefined,
          });
        }
      }
      
      return baseDto;
    });

    const total = count ?? items.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      data: items,
      meta: { total, page, limit, totalPages },
    };
  }

  async getLeaveRequestById(
    id: string,
    branchId: string,
  ): Promise<LeaveRequestDto> {
    const supabase = this.supabaseConfig.getClient();

    const { data, error } = await supabase
      .from('leave_requests')
      .select('id, student_id, requested_by, start_date, end_date, reason, attachment_url, status, reviewed_by, reviewed_at, review_notes, branch_id, academic_year_id, created_at, updated_at')
      .eq('id', id)
      .eq('branch_id', branchId)
      .single();

    throwIfDbError(error);
    if (!data) {
      throw new NotFoundException('Leave request not found');
    }

    const row = data as LeaveRequestRow;
    return this.mapRowToDto(row);
  }

  async updateLeaveStatus(
    id: string,
    input: UpdateLeaveStatusDto,
    reviewerUserId: string,
    branchId: string,
  ): Promise<LeaveRequestDto> {
    const supabase = this.supabaseConfig.getClient();

    const { data: existing, error: fetchError } = await supabase
      .from('leave_requests')
      .select('id, student_id, requested_by, start_date, end_date, reason, attachment_url, status, reviewed_by, reviewed_at, review_notes, branch_id, academic_year_id, created_at, updated_at')
      .eq('id', id)
      .eq('branch_id', branchId)
      .single();

    throwIfDbError(fetchError);
    if (!existing) {
      throw new NotFoundException('Leave request not found');
    }

    const existingRow = existing as LeaveRequestRow;

    if (existingRow.status !== 'pending') {
      throw new BadRequestException(
        'Only pending leave requests can be reviewed',
      );
    }

    // Ensure status is provided (controller should always set it)
    if (!input.status) {
      throw new BadRequestException('Status is required');
    }

    const { data, error } = await supabase
      .from('leave_requests')
      .update({
        status: input.status,
        review_notes: input.reviewNotes ?? null,
        reviewed_by: reviewerUserId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    throwIfDbError(error);
    if (!data) {
      throw new BadRequestException('Failed to update leave request status');
    }

    const updatedRow = data as LeaveRequestRow;

    // Best-effort notification to parent who requested
    try {
      const { data: studentData } = await this.supabaseConfig
        .getClient()
        .from('students')
        .select('user_id')
        .eq('id', existingRow.student_id)
        .single();

      const { data: profileData } = studentData
        ? await this.supabaseConfig
            .getClient()
            .from('profiles')
            .select('full_name')
            .eq('id', studentData.user_id)
            .single()
        : { data: null };

      const studentName =
        (profileData as { full_name?: string } | null)?.full_name || 'Student';

      await this.notificationsService.createLeaveRequestNotification({
        userId: existingRow.requested_by,
        studentName,
        status: input.status, // Now guaranteed to be defined after the check above
        startDate: existingRow.start_date,
        endDate: existingRow.end_date,
        leaveRequestId: existingRow.id,
      });
    } catch {
      // ignore notification errors
    }

    return this.mapRowToDto(updatedRow);
  }

  async cancelLeaveRequest(
    id: string,
    userId: string,
    branchId: string,
  ): Promise<LeaveRequestDto> {
    const supabase = this.supabaseConfig.getClient();

    const { data: existing, error: fetchError } = await supabase
      .from('leave_requests')
      .select('id, student_id, requested_by, start_date, end_date, reason, attachment_url, status, reviewed_by, reviewed_at, review_notes, branch_id, academic_year_id, created_at, updated_at')
      .eq('id', id)
      .eq('branch_id', branchId)
      .single();

    throwIfDbError(fetchError);
    if (!existing) {
      throw new NotFoundException('Leave request not found');
    }

    const existingRow = existing as LeaveRequestRow;

    if (existingRow.requested_by !== userId) {
      throw new ForbiddenException('You can only cancel your own requests');
    }

    if (existingRow.status !== 'pending') {
      throw new BadRequestException(
        'Only pending leave requests can be cancelled',
      );
    }

    const { data, error } = await supabase
      .from('leave_requests')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    throwIfDbError(error);
    if (!data) {
      throw new BadRequestException('Failed to cancel leave request');
    }

    return this.mapRowToDto(data as LeaveRequestRow);
  }

  /**
   * Get leave request stats for a student using database aggregation
   * OPTIMISED: Uses COUNT with GROUP BY instead of fetching all records
   */
  async getLeaveStats(
    studentId: string,
    branchId: string,
  ): Promise<{ pending: number; approved: number; rejected: number; cancelled: number }> {
    const supabase = this.supabaseConfig.getClient();

    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) {
      return { pending: 0, approved: 0, rejected: 0, cancelled: 0 };
    }

    // Use raw SQL query for efficient COUNT GROUP BY
    const { data, error } = await supabase
      .from('leave_requests')
      .select('status')
      .eq('student_id', studentId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', activeYear.id);

    if (error) {
      throw new BadRequestException(error.message);
    }

    // Count by status client-side (Supabase doesn't support GROUP BY directly)
    const counts = { pending: 0, approved: 0, rejected: 0, cancelled: 0 };
    (data || []).forEach((row) => {
      const status = row.status as keyof typeof counts;
      if (status in counts) {
        counts[status]++;
      }
    });

    return counts;
  }

  async getStudentQuotaUsage(
    studentId: string,
    branchId: string,
  ): Promise<LeaveQuotaDto> {
    const supabase = this.supabaseConfig.getClient();

    const activeYear =
      await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) {
      throw new BadRequestException('No active academic year found');
    }

    const { data: quotaRow, error: quotaError } = await supabase
      .from('leave_settings')
      .select('annual_quota, academic_year_id')
      .eq('academic_year_id', activeYear.id)
      .maybeSingle();

    throwIfDbError(quotaError);

    const totalQuota =
      quotaRow && typeof quotaRow.annual_quota === 'number'
        ? quotaRow.annual_quota
        : 0;

    const UNREQUESTED_ABSENCE_REASON =
      'Unrequested absence - automatically created from attendance record';

    const { data: approvedLeaves, error: leavesError } = await supabase
      .from('leave_requests')
      .select('start_date, end_date, reason')
      .eq('student_id', studentId)
      .eq('academic_year_id', activeYear.id)
      .eq('status', 'approved');

    throwIfDbError(leavesError);

    const { data: activeSchoolDays } = await this.scheduleService.getSchoolDays();
    const activeDaySet = activeSchoolDays ?? [];

    const [holidaysRes, vacationsRes] = await Promise.all([
      this.scheduleService.listPublicHolidays(activeYear.id, branchId),
      this.scheduleService.listVacations(activeYear.id),
    ]);
    const excludedDates = new Set<string>();
    (holidaysRes.data ?? []).forEach((h: { startDate: string; endDate: string }) => {
      rangeToDateSet(h.startDate, h.endDate).forEach((d) => excludedDates.add(d));
    });
    (vacationsRes.data ?? []).forEach((v: { startDate: string; endDate: string }) => {
      rangeToDateSet(v.startDate, v.endDate).forEach((d) => excludedDates.add(d));
    });

    let usedDays = 0;
    let daysFromAbsences = 0;
    (approvedLeaves ?? []).forEach((row: { start_date: string; end_date: string; reason?: string | null }) => {
      const days = countActiveSchoolDaysInRangeExcluding(
        row.start_date,
        row.end_date,
        activeDaySet,
        excludedDates,
      );
      usedDays += days;
      if (row.reason === UNREQUESTED_ABSENCE_REASON) {
        daysFromAbsences += days;
      }
    });

    const remainingDays = Math.max(totalQuota - usedDays, 0);

    return new LeaveQuotaDto({
      totalQuota,
      usedDays,
      remainingDays,
      daysFromAbsences,
    });
  }
}


