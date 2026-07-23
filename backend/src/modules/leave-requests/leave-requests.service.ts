import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AuditLogService } from '../../common/services/audit-log.service';
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
    private readonly auditLogService: AuditLogService,
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
   * Check if parent has approval permission for a student
   */
  private async ensureParentCanApprove(
    parentUserId: string,
    studentId: string,
  ): Promise<void> {
    const supabase = this.supabaseConfig.getClient();

    const { data, error } = await supabase
      .from('parent_students')
      .select('can_approve')
      .eq('parent_user_id', parentUserId)
      .eq('student_id', studentId)
      .maybeSingle();

    throwIfDbError(error);

    if (!data) {
      throw new ForbiddenException(
        'You are not linked to this student',
      );
    }

    if (!(data as { can_approve: boolean }).can_approve) {
      throw new ForbiddenException(
        'You do not have approval permission for this student. Please contact the school administrator.',
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
    userEmail: string,
    tenantId?: string | null,
    requester?: { isParent?: boolean; isStudent?: boolean },
  ): Promise<LeaveRequestDto> {
    const supabase = this.supabaseConfig.getClient();

    const isParent = requester?.isParent === true;
    const isStudent = requester?.isStudent === true;

    if (isStudent && !isParent) {
      // Students can request leave only for themselves, and only if their class is enabled.
      const { data: meStudent, error: studentError } = await supabase
        .from('students')
        .select('id, class_id')
        .eq('user_id', userId)
        .eq('branch_id', branchId)
        .maybeSingle();
      throwIfDbError(studentError);
      if (!meStudent) {
        throw new ForbiddenException('No student record found for current user');
      }
      const meStudentRow = meStudent as { id: string; class_id: string | null };
      if (input.studentId !== meStudentRow.id) {
        throw new ForbiddenException('Students can only request leave for themselves');
      }

      const settingKey = `student_leave_request_class_ids:${branchId}`;
      const { data: allowedSetting, error: allowedError } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', settingKey)
        .maybeSingle();
      throwIfDbError(allowedError);
      const allowedClassIds = Array.isArray((allowedSetting as { value?: unknown } | null)?.value)
        ? (((allowedSetting as { value: unknown }).value as unknown[]) || []).filter(
            (v): v is string => typeof v === 'string' && v.length > 0,
          )
        : [];

      const classId = meStudentRow.class_id;
      if (!classId || allowedClassIds.length === 0 || !allowedClassIds.includes(classId)) {
        throw new ForbiddenException('Leave requests are not enabled for your class');
      }
    } else {
      // Default: parent flow (and staff creating for a student via UI uses parent link check)
      await this.ensureParentCanAccessStudent(userId, input.studentId);
    }

    const activeYear =
      await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) {
      throw new BadRequestException('No active academic year found');
    }
    await this.academicYearsService.assertNotLockedForBranch(branchId, activeYear.id);

    if (input.endDate < input.startDate) {
      throw new BadRequestException('End date cannot be before start date');
    }

    const { data: existing, error: conflictError } = await supabase
      .from('leave_requests')
      .select('id, start_date, end_date, status')
      .eq('student_id', input.studentId)
      .eq('academic_year_id', activeYear.id)
      .in('status', ['pending', 'approved', 'absent']);

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
        'A leave request for this student already exists for the same or overlapping dates (pending, approved, or an attendance absence record). Please cancel or use the existing request.',
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

    this.auditLogService
      .logCreate(
        'leave_requests',
        row.id,
        userEmail,
        { ...row } as Record<string, unknown>,
        { branchId, tenantId: tenantId ?? null },
      )
      .catch(() => {});

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
    requester?: { isParent?: boolean; isStudent?: boolean },
  ): Promise<{
    data: LeaveRequestDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const supabase = this.supabaseConfig.getClient();

    const isParent = requester?.isParent === true;
    const isStudent = requester?.isStudent === true;

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) {
      return { data: [], meta: { total: 0, page, limit, totalPages: 1 } };
    }

    let dbQuery = supabase
      .from('leave_requests')
      .select(
        'id, student_id, requested_by, start_date, end_date, reason, attachment_url, status, reviewed_by, reviewed_at, review_notes, branch_id, academic_year_id, created_at, updated_at',
        { count: 'exact' },
      )
      .eq('branch_id', branchId);

    // Always scope to the active academic year for operational views.
    dbQuery = dbQuery.eq('academic_year_id', activeYear.id);

    if (isStudent && !isParent) {
      // Students can only see leave requests related to themselves (their student record).
      const { data: meStudent, error: studentError } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', userId)
        .eq('branch_id', branchId)
        .maybeSingle();
      throwIfDbError(studentError);
      if (!meStudent) {
        return { data: [], meta: { total: 0, page, limit, totalPages: 1 } };
      }
      const myStudentId = (meStudent as { id: string }).id;
      dbQuery = dbQuery.eq('student_id', myStudentId);
    } else if (isParent) {
      // Parents: any leave row for their linked children (includes attendance-created rows
      // where requested_by may be another guardian on the same student).
      const { data: linkRows, error: linkError } = await supabase
        .from('parent_students')
        .select('student_id')
        .eq('parent_user_id', userId);
      throwIfDbError(linkError);
      const linkedIds = Array.from(
        new Set(
          (linkRows ?? []).map((r) => (r as { student_id: string }).student_id),
        ),
      );
      if (linkedIds.length === 0) {
        return { data: [], meta: { total: 0, page, limit, totalPages: 1 } };
      }

      const { data: branchStudents, error: branchErr } = await supabase
        .from('students')
        .select('id')
        .eq('branch_id', branchId)
        .in('id', linkedIds);
      throwIfDbError(branchErr);
      const allowedStudentIds = new Set(
        (branchStudents ?? []).map((s) => (s as { id: string }).id),
      );
      if (allowedStudentIds.size === 0) {
        return { data: [], meta: { total: 0, page, limit, totalPages: 1 } };
      }

      if (query.studentId) {
        if (!allowedStudentIds.has(query.studentId)) {
          return { data: [], meta: { total: 0, page, limit, totalPages: 1 } };
        }
        dbQuery = dbQuery.eq('student_id', query.studentId);
      } else {
        dbQuery = dbQuery.in(
          'student_id',
          [...allowedStudentIds],
        );
      }
    }

    if (query.studentId && !isParent) {
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

    // Quota usage per student — shared calendar/settings once; one leaves query for the page (Nano-safe).
    const distinctStudentIds = Array.from(new Set(rows.map((r) => r.student_id)));
    const quotaMap = new Map<string, { usedDays: number; totalQuota: number }>();
    if (distinctStudentIds.length > 0) {
      try {
        const ctx = await this.loadLeaveQuotaContext(branchId);
        const leaveRowsByStudent = await this.fetchQuotaLeaveRowsForStudents(
          distinctStudentIds,
          ctx.academicYearId,
        );
        for (const sid of distinctStudentIds) {
          const usage = this.computeQuotaUsageFromLeaveRows(
            leaveRowsByStudent.get(sid) ?? [],
            ctx,
          );
          quotaMap.set(sid, {
            usedDays: usage.usedDays,
            totalQuota: usage.totalQuota,
          });
        }
      } catch {
        // omit quota on page if shared context fails (same as previous per-student catch)
      }
    }

    const items = rows.map((row) => {
      const baseDto = this.mapRowToDto(row);
      const quotaUsage = quotaMap.get(row.student_id);

      // Add reviewer information if available
      if (row.reviewed_by) {
        const reviewerName = reviewerProfileMap.get(row.reviewed_by);
        const reviewerRole = reviewerRoleMap.get(row.reviewed_by);

        return new LeaveRequestDto({
          ...baseDto,
          quotaUsage,
          reviewerName: reviewerName || undefined,
          reviewerRole: reviewerRole || undefined,
        });
      }

      return new LeaveRequestDto({ ...baseDto, quotaUsage });
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
    userId?: string,
    requester?: { isParent?: boolean; isStudent?: boolean },
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

    const isParent = requester?.isParent === true;
    const isStudent = requester?.isStudent === true;

    if (isStudent && !isParent && userId) {
      const { data: meStudent, error: studentError } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', userId)
        .eq('branch_id', branchId)
        .maybeSingle();
      throwIfDbError(studentError);
      const myStudentId = (meStudent as { id: string } | null)?.id ?? null;
      if (!myStudentId || row.student_id !== myStudentId) {
        throw new ForbiddenException('You do not have access to this leave request');
      }
    } else if (isParent && userId) {
      await this.ensureParentCanAccessStudent(userId, row.student_id);
    }

    return this.mapRowToDto(row);
  }

  async updateLeaveStatus(
    id: string,
    input: UpdateLeaveStatusDto,
    reviewerUserId: string,
    branchId: string,
    userEmail: string,
    tenantId?: string | null,
    isParent: boolean = false,
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
    await this.academicYearsService.assertNotLockedForBranch(branchId, existingRow.academic_year_id);

    if (existingRow.status !== 'pending') {
      throw new BadRequestException(
        'Only pending leave requests can be reviewed',
      );
    }

    // Ensure status is provided (controller should always set it)
    if (!input.status) {
      throw new BadRequestException('Status is required');
    }

    // If reviewer is a parent and trying to approve, check canApprove permission
    if (isParent && input.status === 'approved') {
      await this.ensureParentCanApprove(reviewerUserId, existingRow.student_id);
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

    this.auditLogService
      .logUpdate(
        'leave_requests',
        id,
        userEmail,
        { ...existingRow } as Record<string, unknown>,
        { ...updatedRow } as Record<string, unknown>,
        ['status', 'review_notes', 'reviewed_by', 'reviewed_at', 'updated_at'],
        { branchId, tenantId: tenantId ?? null },
      )
      .catch(() => {});

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
    userEmail: string,
    tenantId?: string | null,
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
    await this.academicYearsService.assertNotLockedForBranch(branchId, existingRow.academic_year_id);

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

    const updatedRow = data as LeaveRequestRow;
    this.auditLogService
      .logUpdate(
        'leave_requests',
        id,
        userEmail,
        { ...existingRow } as Record<string, unknown>,
        { ...updatedRow } as Record<string, unknown>,
        ['status', 'updated_at'],
        { branchId, tenantId: tenantId ?? null },
      )
      .catch(() => {});

    return this.mapRowToDto(updatedRow);
  }

  /**
   * Get leave request stats for a student using database aggregation
   * OPTIMISED: Uses COUNT with GROUP BY instead of fetching all records
   */
  async getLeaveStats(
    studentId: string,
    branchId: string,
  ): Promise<{
    pending: number;
    approved: number;
    rejected: number;
    cancelled: number;
    absent: number;
  }> {
    const supabase = this.supabaseConfig.getClient();

    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) {
      return { pending: 0, approved: 0, rejected: 0, cancelled: 0, absent: 0 };
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
    const counts = {
      pending: 0,
      approved: 0,
      rejected: 0,
      cancelled: 0,
      absent: 0,
    };
    (data || []).forEach((row) => {
      const status = row.status as keyof typeof counts;
      if (status in counts) {
        counts[status]++;
      }
    });

    return counts;
  }

  private static readonly UNREQUESTED_ABSENCE_REASON =
    'Unrequested absence - automatically created from attendance record';

  /**
   * Shared inputs for quota maths (active year, annual quota, school days, holiday/vacation exclusions).
   * Loaded once per list page instead of once per student.
   */
  private async loadLeaveQuotaContext(branchId: string): Promise<{
    academicYearId: string;
    totalQuota: number;
    activeDaySet: number[];
    excludedDates: Set<string>;
  }> {
    const supabase = this.supabaseConfig.getClient();

    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
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
      quotaRow && typeof quotaRow.annual_quota === 'number' ? quotaRow.annual_quota : 0;

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

    return {
      academicYearId: activeYear.id,
      totalQuota,
      activeDaySet,
      excludedDates,
    };
  }

  private computeQuotaUsageFromLeaveRows(
    leaveRows: Array<{ start_date: string; end_date: string; reason?: string | null }>,
    ctx: {
      totalQuota: number;
      activeDaySet: number[];
      excludedDates: Set<string>;
    },
  ): LeaveQuotaDto {
    let usedDays = 0;
    let daysFromAbsences = 0;
    leaveRows.forEach((row) => {
      const days = countActiveSchoolDaysInRangeExcluding(
        row.start_date,
        row.end_date,
        ctx.activeDaySet,
        ctx.excludedDates,
      );
      usedDays += days;
      if (row.reason === LeaveRequestsService.UNREQUESTED_ABSENCE_REASON) {
        daysFromAbsences += days;
      }
    });

    return new LeaveQuotaDto({
      totalQuota: ctx.totalQuota,
      usedDays,
      remainingDays: Math.max(ctx.totalQuota - usedDays, 0),
      daysFromAbsences,
    });
  }

  private async fetchQuotaLeaveRowsForStudents(
    studentIds: string[],
    academicYearId: string,
  ): Promise<Map<string, Array<{ start_date: string; end_date: string; reason?: string | null }>>> {
    const byStudent = new Map<
      string,
      Array<{ start_date: string; end_date: string; reason?: string | null }>
    >();
    if (studentIds.length === 0) return byStudent;

    const supabase = this.supabaseConfig.getClient();
    const { data: approvedLeaves, error: leavesError } = await supabase
      .from('leave_requests')
      .select('student_id, start_date, end_date, reason')
      .in('student_id', studentIds)
      .eq('academic_year_id', academicYearId)
      .in('status', ['approved', 'absent']);

    throwIfDbError(leavesError);

    for (const row of (approvedLeaves ?? []) as Array<{
      student_id: string;
      start_date: string;
      end_date: string;
      reason?: string | null;
    }>) {
      const list = byStudent.get(row.student_id) ?? [];
      list.push({
        start_date: row.start_date,
        end_date: row.end_date,
        reason: row.reason,
      });
      byStudent.set(row.student_id, list);
    }

    return byStudent;
  }

  async getStudentQuotaUsage(
    studentId: string,
    branchId: string,
  ): Promise<LeaveQuotaDto> {
    const ctx = await this.loadLeaveQuotaContext(branchId);
    const leaveRowsByStudent = await this.fetchQuotaLeaveRowsForStudents(
      [studentId],
      ctx.academicYearId,
    );
    return this.computeQuotaUsageFromLeaveRows(
      leaveRowsByStudent.get(studentId) ?? [],
      ctx,
    );
  }
}


