import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import type { PostgrestError } from '@supabase/supabase-js';
import { NotificationDto } from './dto/notification.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { CreateNotificationDto } from './dto/create-notification.dto';

type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
};

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  throw new BadRequestException(errorMessage);
}

@Injectable()
export class NotificationsService {
  constructor(private readonly supabaseConfig: SupabaseConfig) {}

  async listNotifications(
    userId: string,
    query: QueryNotificationsDto,
  ): Promise<{
    data: NotificationDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const supabase = this.supabaseConfig.getClient();

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let dbQuery = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId);

    if (query.isRead !== undefined) {
      dbQuery = dbQuery.eq('is_read', query.isRead);
    }

    if (query.type) {
      dbQuery = dbQuery.eq('type', query.type);
    }

    // Apply sorting
    const sortBy = query.sortBy || 'created_at';
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

    const notifications = (data as NotificationRow[]).map(
      (row) =>
        new NotificationDto({
          id: row.id,
          userId: row.user_id,
          type: row.type,
          title: row.title,
          body: row.body ?? undefined,
          data: row.data ?? undefined,
          isRead: row.is_read,
          createdAt: row.created_at,
        }),
    );

    return {
      data: notifications,
      meta: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    };
  }

  async getNotificationById(id: string, userId: string): Promise<NotificationDto> {
    const supabase = this.supabaseConfig.getClient();

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    throwIfDbError(error);
    if (!data) {
      throw new NotFoundException('Notification not found');
    }

    const row = data as NotificationRow;
    return new NotificationDto({
      id: row.id,
      userId: row.user_id,
      type: row.type,
      title: row.title,
      body: row.body ?? undefined,
      data: row.data ?? undefined,
      isRead: row.is_read,
      createdAt: row.created_at,
    });
  }

  async markAsRead(id: string, userId: string): Promise<NotificationDto> {
    const supabase = this.supabaseConfig.getClient();

    // Verify notification exists and belongs to user
    const { data: existing, error: fetchError } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    throwIfDbError(fetchError);
    if (!existing) {
      throw new NotFoundException('Notification not found');
    }

    const { data: updated, error: updateError } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .select()
      .single();

    throwIfDbError(updateError);
    if (!updated) {
      throw new NotFoundException('Failed to update notification');
    }

    const row = updated as NotificationRow;
    return new NotificationDto({
      id: row.id,
      userId: row.user_id,
      type: row.type,
      title: row.title,
      body: row.body ?? undefined,
      data: row.data ?? undefined,
      isRead: row.is_read,
      createdAt: row.created_at,
    });
  }

  async markAllAsRead(userId: string): Promise<void> {
    const supabase = this.supabaseConfig.getClient();

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    throwIfDbError(error);
  }

  async createNotification(input: CreateNotificationDto): Promise<NotificationDto> {
    const supabase = this.supabaseConfig.getClient();

    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: input.userId,
        type: input.type,
        title: input.title,
        body: input.body || null,
        data: input.data || null,
        is_read: false,
      })
      .select()
      .single();

    throwIfDbError(error);
    if (!data) {
      throw new NotFoundException('Failed to create notification');
    }

    const row = data as NotificationRow;
    return new NotificationDto({
      id: row.id,
      userId: row.user_id,
      type: row.type,
      title: row.title,
      body: row.body ?? undefined,
      data: row.data ?? undefined,
      isRead: row.is_read,
      createdAt: row.created_at,
    });
  }

  async createAttendanceNotification(
    studentId: string,
    attendanceData: { date: string; status: string; attendanceId?: string },
    branchId: string,
  ): Promise<void> {
    const supabase = this.supabaseConfig.getClient();

    // Fetch parents from parent_students table
    const { data: parentStudents, error: parentError } = await supabase
      .from('parent_students')
      .select('parent_user_id')
      .eq('student_id', studentId);

    throwIfDbError(parentError);

    if (!parentStudents || parentStudents.length === 0) {
      // No parents found, skip notification
      return;
    }

    // Fetch student name for notification
    const { data: studentData, error: studentError } = await supabase
      .from('students')
      .select('user_id')
      .eq('id', studentId)
      .single();

    throwIfDbError(studentError);
    if (!studentData) {
      return;
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', studentData.user_id)
      .single();

    const studentName = profileData?.full_name || 'Student';

    // Create notification for each parent
    const notifications = parentStudents.map((ps) => ({
      user_id: ps.parent_user_id,
      type: 'attendance',
      title: 'Attendance Marked',
      body: `${studentName} was marked ${attendanceData.status} on ${new Date(attendanceData.date).toLocaleDateString()}`,
      data: {
        studentId,
        date: attendanceData.date,
        attendanceId: attendanceData.attendanceId,
        status: attendanceData.status,
      },
      is_read: false,
    }));

    // Insert all notifications
    const { error: insertError } = await supabase
      .from('notifications')
      .insert(notifications);

    // Don't throw error if notification creation fails - log and continue
    if (insertError) {
      const errorMessage =
        insertError instanceof Error
          ? insertError.message
          : 'Unknown error';
      console.error('Failed to create attendance notifications:', errorMessage);
    }
  }
}



