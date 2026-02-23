'use client';

import { Text } from '@mantine/core';
import type { DashboardWidget } from '@/types/dashboard';
import { AttendanceWidget } from './AttendanceWidget';
import { ChildAttendanceWidget } from './ChildAttendanceWidget';
import { UpcomingEventsWidget } from './UpcomingEventsWidget';
import { PendingTasksWidget } from './PendingTasksWidget';
import { PendingGradingWidget } from './PendingGradingWidget';
import { ScheduleTodayWidget } from './ScheduleTodayWidget';
import { BranchOverviewWidget } from './BranchOverviewWidget';
import { PendingApprovalsWidget } from './PendingApprovalsWidget';
import { LowStockWidget } from './LowStockWidget';
import { StorageWidget } from './StorageWidget';
import { TodayScheduleWidget } from './TodayScheduleWidget';
import { UpcomingAssessmentsWidget } from './UpcomingAssessmentsWidget';
import { GradesOverviewWidget } from './GradesOverviewWidget';

/** Renders the widget content for a given widget id. */
export function renderDashboardWidgetContent(
  widget: DashboardWidget,
): React.ReactNode {
  switch (widget.id) {
    case 'class_attendance':
      return <AttendanceWidget embedded />;
    case 'child_today':
      return <ChildAttendanceWidget embedded />;
    case 'upcoming_events':
      return <UpcomingEventsWidget />;
    case 'pending_tasks':
      return <PendingTasksWidget />;
    case 'pending_grading':
      return <PendingGradingWidget />;
    case 'schedule_today':
      return <ScheduleTodayWidget />;
    case 'branch_overview':
      return <BranchOverviewWidget />;
    case 'pending_approvals':
      return <PendingApprovalsWidget />;
    case 'low_stock':
      return <LowStockWidget />;
    case 'storage':
      return <StorageWidget />;
    case 'today_schedule':
      return <TodayScheduleWidget />;
    case 'upcoming_assessments':
      return <UpcomingAssessmentsWidget />;
    case 'grades_overview':
      return <GradesOverviewWidget />;
    default:
      return (
        <Text size="sm" c="dimmed">
          Widget coming soon
        </Text>
      );
  }
}

/** Whether this widget id is implemented (has its own loading/error). */
export function isWidgetImplemented(id: string): boolean {
  return [
    'class_attendance',
    'child_today',
    'upcoming_events',
    'pending_tasks',
    'pending_grading',
    'schedule_today',
    'branch_overview',
    'pending_approvals',
    'low_stock',
    'storage',
    'today_schedule',
    'upcoming_assessments',
    'grades_overview',
  ].includes(id);
}
