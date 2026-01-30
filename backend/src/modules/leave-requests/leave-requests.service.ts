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

@Injectable()
export class LeaveRequestsService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly academicYearsService: AcademicYearsService,
    private readonly notificationsService: NotificationsService,
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

    return this.mapRowToDto(data as LeaveRequestRow);
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

    const { data: approvedLeaves, error: leavesError } = await supabase
      .from('leave_requests')
      .select('start_date, end_date')
      .eq('student_id', studentId)
      .eq('academic_year_id', activeYear.id)
      .eq('status', 'approved');

    throwIfDbError(leavesError);

    let usedDays = 0;
    (approvedLeaves ?? []).forEach((row) => {
      const start = new Date(row.start_date);
      const end = new Date(row.end_date);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return;
      }
      const diffMs = end.getTime() - start.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      usedDays += diffDays >= 0 ? diffDays + 1 : 0;
    });

    const remainingDays = Math.max(totalQuota - usedDays, 0);

    return new LeaveQuotaDto({
      totalQuota,
      usedDays,
      remainingDays,
    });
  }
}


