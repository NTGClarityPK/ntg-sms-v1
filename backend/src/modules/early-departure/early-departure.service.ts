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
import { EarlyDepartureRequestDto } from './dto/early-departure.dto';
import { CreateEarlyDepartureRequestDto } from './dto/create-early-departure.dto';
import { UpdateEarlyDepartureStatusDto } from './dto/update-early-departure-status.dto';
import { QueryEarlyDepartureRequestsDto } from './dto/query-early-departure.dto';
import type { EarlyDepartureStatus } from './dto/early-departure-status.type';

type EarlyDepartureRow = {
  id: string;
  student_id: string;
  requested_by: string;
  date: string;
  departure_time: string;
  reason: string | null;
  attachment_url: string | null;
  status: EarlyDepartureStatus;
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
  // PostgrestError is a plain object with .message, not necessarily an instance of Error
  const message =
    (error as PostgrestError).message ||
    (error instanceof Error ? error.message : null) ||
    'Unknown error';
  throw new BadRequestException(message);
}

@Injectable()
export class EarlyDepartureService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly academicYearsService: AcademicYearsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private mapRowToDto(row: EarlyDepartureRow): EarlyDepartureRequestDto {
    return new EarlyDepartureRequestDto({
      id: row.id,
      studentId: row.student_id,
      requestedBy: row.requested_by,
      date: row.date,
      departureTime: row.departure_time,
      reason: row.reason ?? undefined,
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
        'You are not linked to this student and cannot request early departure',
      );
    }
  }

  async createEarlyDepartureRequest(
    input: CreateEarlyDepartureRequestDto,
    userId: string,
    branchId: string,
  ): Promise<EarlyDepartureRequestDto> {
    const supabase = this.supabaseConfig.getClient();

    await this.ensureParentCanAccessStudent(userId, input.studentId);

    const activeYear =
      await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) {
      throw new BadRequestException('No active academic year found');
    }

    // One early departure per student per day: block if same date already has pending or approved request
    const { data: existing } = await supabase
      .from('early_departure_requests')
      .select('id, status')
      .eq('branch_id', branchId)
      .eq('student_id', input.studentId)
      .eq('date', input.date)
      .in('status', ['pending', 'approved'])
      .maybeSingle();

    if (existing) {
      const message =
        existing.status === 'pending'
          ? 'A request for this day is already pending. Please wait for it to be reviewed before submitting another.'
          : 'An early departure for this day has already been approved. You cannot submit another request for the same day.';
      throw new BadRequestException(message);
    }

    const { data, error } = await supabase
      .from('early_departure_requests')
      .insert({
        student_id: input.studentId,
        requested_by: userId,
        date: input.date,
        departure_time: input.departureTime,
        reason: input.reason ?? null,
        attachment_url: input.attachmentUrl ?? null,
        status: 'pending',
        branch_id: branchId,
        academic_year_id: activeYear.id,
      })
      .select()
      .single();

    throwIfDbError(error);
    if (!data) {
      throw new BadRequestException('Failed to create early departure request');
    }

    const row = data as EarlyDepartureRow;

    // Notify school admin, admin assistant, and class teacher (best-effort)
    try {
      const recipientUserIds = await this.getEarlyDepartureRequestRaisedRecipients(
        input.studentId,
        branchId,
        activeYear.id,
        userId,
      );
      if (recipientUserIds.length > 0) {
        const studentName = await this.getStudentNameForNotification(input.studentId);
        await this.notificationsService.createEarlyDepartureRequestRaisedNotifications({
          recipientUserIds,
          studentName,
          date: row.date,
          time: row.departure_time,
          earlyDepartureRequestId: row.id,
        });
      }
    } catch {
      // ignore notification errors
    }

    return this.mapRowToDto(row);
  }

  async listEarlyDepartureRequests(
    query: QueryEarlyDepartureRequestsDto,
    userId: string,
    branchId: string,
  ): Promise<{
    data: EarlyDepartureRequestDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const supabase = this.supabaseConfig.getClient();

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let dbQuery = supabase
      .from('early_departure_requests')
      .select('*', { count: 'exact' })
      .eq('branch_id', branchId);

    if (query.studentId) {
      dbQuery = dbQuery.eq('student_id', query.studentId);
    }

    if (query.status && query.status.length > 0) {
      dbQuery = dbQuery.in('status', query.status);
    }

    if (query.startDate) {
      dbQuery = dbQuery.gte('date', query.startDate);
    }

    if (query.endDate) {
      dbQuery = dbQuery.lte('date', query.endDate);
    }

    // Let RLS enforce who can see which records; no requested_by filter here

    const sortBy = query.sortBy || 'created_at';
    const sortOrder = query.sortOrder || 'desc';
    const ascending = sortOrder === 'asc';

    dbQuery = dbQuery.order(sortBy, { ascending });

    const { data, error, count } = await dbQuery.range(from, to);
    throwIfDbError(error);

    const rows = (data ?? []) as EarlyDepartureRow[];
    
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
          return new EarlyDepartureRequestDto({
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

  async updateEarlyDepartureStatus(
    id: string,
    input: UpdateEarlyDepartureStatusDto,
    reviewerUserId: string,
    branchId: string,
  ): Promise<EarlyDepartureRequestDto> {
    const supabase = this.supabaseConfig.getClient();

    const { data: existing, error: fetchError } = await supabase
      .from('early_departure_requests')
      .select('*')
      .eq('id', id)
      .eq('branch_id', branchId)
      .single();

    throwIfDbError(fetchError);
    if (!existing) {
      throw new NotFoundException('Early departure request not found');
    }

    const existingRow = existing as EarlyDepartureRow;

    if (existingRow.status !== 'pending') {
      throw new BadRequestException(
        'Only pending early departure requests can be reviewed',
      );
    }

    // Ensure status is provided (controller should set it, but validate for safety)
    if (!input.status) {
      throw new BadRequestException('Status is required');
    }

    const { data, error } = await supabase
      .from('early_departure_requests')
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
      throw new BadRequestException(
        'Failed to update early departure request status',
      );
    }

    const updatedRow = data as EarlyDepartureRow;

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

      await this.notificationsService.createEarlyDepartureNotification({
        userId: existingRow.requested_by,
        studentName,
        status: input.status,
        date: existingRow.date,
        time: existingRow.departure_time,
        earlyDepartureRequestId: existingRow.id,
      });
    } catch {
      // ignore notification errors
    }

    return this.mapRowToDto(updatedRow);
  }

  async cancelEarlyDepartureRequest(
    id: string,
    userId: string,
    branchId: string,
  ): Promise<EarlyDepartureRequestDto> {
    const supabase = this.supabaseConfig.getClient();

    const { data: existing, error: fetchError } = await supabase
      .from('early_departure_requests')
      .select('*')
      .eq('id', id)
      .eq('branch_id', branchId)
      .single();

    throwIfDbError(fetchError);
    if (!existing) {
      throw new NotFoundException('Early departure request not found');
    }

    const existingRow = existing as EarlyDepartureRow;

    if (existingRow.requested_by !== userId) {
      throw new ForbiddenException('You can only cancel your own requests');
    }

    if (existingRow.status !== 'pending') {
      throw new BadRequestException(
        'Only pending early departure requests can be cancelled',
      );
    }

    const { data, error } = await supabase
      .from('early_departure_requests')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    throwIfDbError(error);
    if (!data) {
      throw new BadRequestException('Failed to cancel early departure request');
    }

    const updatedRow = data as EarlyDepartureRow;
    return this.mapRowToDto(updatedRow);
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
   * Get user IDs to notify when an early departure request is raised: school_admin, admin_assistant, and class teacher for the student (same branch). Excludes requester.
   */
  private async getEarlyDepartureRequestRaisedRecipients(
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
}


