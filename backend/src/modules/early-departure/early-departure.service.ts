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
  throw new BadRequestException(
    error instanceof Error ? error.message : 'Unknown error',
  );
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

    return this.mapRowToDto(data as EarlyDepartureRow);
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
    const items = rows.map((row) => this.mapRowToDto(row));

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
}


