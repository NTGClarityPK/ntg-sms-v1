import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { DashboardWidgetDto } from './dto/dashboard-widget.dto';

/** Widget IDs and which roles can see them */
const ROLE_WIDGETS: Record<string, DashboardWidgetDto[]> = {
  parent: [
    new DashboardWidgetDto({ id: 'child_today', title: "Today's attendance", description: "Your child's attendance for today", role: 'parent' }),
    new DashboardWidgetDto({ id: 'upcoming_events', title: 'Upcoming events', description: 'Events requiring consent or coming up', role: 'parent' }),
    new DashboardWidgetDto({ id: 'pending_tasks', title: 'Pending tasks', description: 'Leaves and early departures pending', role: 'parent' }),
  ],
  class_teacher: [
    new DashboardWidgetDto({ id: 'class_attendance', title: "Today's class attendance", description: 'Attendance for your class', role: 'class_teacher' }),
    new DashboardWidgetDto({ id: 'pending_grading', title: 'Pending grading', description: 'Assessments needing grades', role: 'class_teacher' }),
    new DashboardWidgetDto({ id: 'schedule_today', title: "Today's schedule", description: 'Your timetable for today', role: 'class_teacher' }),
  ],
  subject_teacher: [
    new DashboardWidgetDto({ id: 'class_attendance', title: "Today's class attendance", description: 'Attendance for your classes', role: 'subject_teacher' }),
    new DashboardWidgetDto({ id: 'pending_grading', title: 'Pending grading', description: 'Assessments needing grades', role: 'subject_teacher' }),
    new DashboardWidgetDto({ id: 'schedule_today', title: "Today's schedule", description: 'Your timetable for today', role: 'subject_teacher' }),
  ],
  school_admin: [
    new DashboardWidgetDto({ id: 'branch_overview', title: 'Branch overview', description: 'Key statistics', role: 'school_admin' }),
    new DashboardWidgetDto({ id: 'pending_approvals', title: 'Pending approvals', description: 'Leaves and early departures to review', role: 'school_admin' }),
    new DashboardWidgetDto({ id: 'low_stock', title: 'Low stock', description: 'Inventory alerts', role: 'school_admin' }),
    new DashboardWidgetDto({ id: 'storage', title: 'Storage', description: 'Storage usage', role: 'school_admin' }),
  ],
  principal: [
    new DashboardWidgetDto({ id: 'branch_overview', title: 'Branch overview', description: 'Key statistics', role: 'principal' }),
    new DashboardWidgetDto({ id: 'pending_approvals', title: 'Pending approvals', description: 'Leaves and early departures to review', role: 'principal' }),
    new DashboardWidgetDto({ id: 'low_stock', title: 'Low stock', description: 'Inventory alerts', role: 'principal' }),
    new DashboardWidgetDto({ id: 'storage', title: 'Storage', description: 'Storage usage', role: 'principal' }),
  ],
  academic_coordinator: [
    new DashboardWidgetDto({ id: 'branch_overview', title: 'Branch overview', description: 'Key statistics', role: 'academic_coordinator' }),
    new DashboardWidgetDto({ id: 'pending_approvals', title: 'Pending approvals', description: 'Leaves and early departures to review', role: 'academic_coordinator' }),
  ],
  admin_assistant: [
    new DashboardWidgetDto({ id: 'branch_overview', title: 'Branch overview', description: 'Key statistics', role: 'admin_assistant' }),
    new DashboardWidgetDto({ id: 'pending_approvals', title: 'Pending approvals', description: 'Leaves and early departures to review', role: 'admin_assistant' }),
  ],
  guidance_counselor: [
    new DashboardWidgetDto({ id: 'schedule_today', title: "Today's schedule", description: 'Your timetable for today', role: 'guidance_counselor' }),
  ],
  super_admin: [
    new DashboardWidgetDto({ id: 'branch_overview', title: 'Branch overview', description: 'Key statistics', role: 'super_admin' }),
    new DashboardWidgetDto({ id: 'pending_approvals', title: 'Pending approvals', description: 'Leaves and early departures to review', role: 'super_admin' }),
    new DashboardWidgetDto({ id: 'storage', title: 'Storage', description: 'Storage usage', role: 'super_admin' }),
  ],
  student: [
    new DashboardWidgetDto({ id: 'today_schedule', title: "Today's schedule", description: 'Your classes today', role: 'student' }),
    new DashboardWidgetDto({ id: 'upcoming_assessments', title: 'Upcoming assessments', description: 'Due dates', role: 'student' }),
    new DashboardWidgetDto({ id: 'grades_overview', title: 'Grades overview', description: 'Recent grades', role: 'student' }),
  ],
};

@Injectable()
export class DashboardService {
  constructor(private readonly supabaseConfig: SupabaseConfig) {}

  /**
   * Returns minimal dashboard data. Widgets fetch their own data via existing APIs.
   */
  async getDashboardData(
    _userId: string,
    _branchId: string,
    _roles: string[],
  ): Promise<{ quickStats?: Record<string, number>; recentActivity?: unknown[] }> {
    return {};
  }

  /**
   * Returns available widgets for the user's roles. If role filter is provided, only widgets for that role.
   */
  getWidgetsForRoles(userRoles: string[], filterRole?: string): DashboardWidgetDto[] {
    const rolesToUse = filterRole
      ? (userRoles.includes(filterRole) ? [filterRole] : [])
      : userRoles;

    const seen = new Set<string>();
    const result: DashboardWidgetDto[] = [];

    for (const role of rolesToUse) {
      const normalizedRole = role?.toLowerCase?.();
      const widgets = ROLE_WIDGETS[normalizedRole];
      if (!widgets) continue;
      for (const w of widgets) {
        if (!seen.has(w.id)) {
          seen.add(w.id);
          result.push(w);
        }
      }
    }

    return result;
  }

  async getPreferences(userId: string, branchId: string): Promise<{
    widgetIds?: string[];
    selectedRoleId?: string;
    layout?: Record<string, unknown>;
  }> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('dashboard_preferences')
      .select('preferences')
      .eq('user_id', userId)
      .eq('branch_id', branchId)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to load dashboard preferences',
      );
    }

    const prefs = (data as { preferences?: Record<string, unknown> } | null)?.preferences ?? {};
    return {
      widgetIds: Array.isArray(prefs.widgetIds) ? prefs.widgetIds : undefined,
      selectedRoleId:
        typeof prefs.selectedRoleId === 'string' ? prefs.selectedRoleId : undefined,
      layout:
        prefs.layout && typeof prefs.layout === 'object' && !Array.isArray(prefs.layout)
          ? (prefs.layout as Record<string, unknown>)
          : undefined,
    };
  }

  async savePreferences(
    userId: string,
    branchId: string,
    preferences: {
      widgetIds?: string[];
      selectedRoleId?: string;
      layout?: Record<string, unknown>;
    },
  ): Promise<{ widgetIds?: string[]; selectedRoleId?: string; layout?: Record<string, unknown> }> {
    const supabase = this.supabaseConfig.getClient();
    const existing = await this.getPreferences(userId, branchId);
    const merged: Record<string, unknown> = {
      ...(existing.widgetIds !== undefined && { widgetIds: existing.widgetIds }),
      ...(existing.selectedRoleId !== undefined && { selectedRoleId: existing.selectedRoleId }),
      ...(existing.layout !== undefined && { layout: existing.layout }),
      ...(preferences.widgetIds !== undefined && { widgetIds: preferences.widgetIds }),
      ...(preferences.selectedRoleId !== undefined && {
        selectedRoleId: preferences.selectedRoleId,
      }),
      ...(preferences.layout !== undefined && { layout: preferences.layout }),
    };

    const { error } = await supabase
      .from('dashboard_preferences')
      .upsert(
        {
          user_id: userId,
          branch_id: branchId,
          preferences: merged,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,branch_id' },
      );

    if (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to save dashboard preferences',
      );
    }

    return this.getPreferences(userId, branchId);
  }
}
