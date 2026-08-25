import type { DashboardWidgetDep } from '../types';
import { FRONTEND_SRC, listFiles, readText, relPath, apiPrefixToModuleSlug } from '../utils';

const WIDGET_FILES: Record<string, string> = {
  class_attendance: 'AttendanceWidget.tsx',
  child_today: 'ChildAttendanceWidget.tsx',
  upcoming_events: 'UpcomingEventsWidget.tsx',
  pending_tasks: 'PendingTasksWidget.tsx',
  pending_grading: 'PendingGradingWidget.tsx',
  schedule_today: 'ScheduleTodayWidget.tsx',
  branch_overview: 'BranchOverviewWidget.tsx',
  pending_approvals: 'PendingApprovalsWidget.tsx',
  low_stock: 'LowStockWidget.tsx',
  storage: 'StorageWidget.tsx',
  today_schedule: 'TodayScheduleWidget.tsx',
  upcoming_assessments: 'UpcomingAssessmentsWidget.tsx',
  grades_overview: 'GradesOverviewWidget.tsx',
};

export function collectDashboardWidgets(): DashboardWidgetDep[] {
  const dashboardDir = `${FRONTEND_SRC}/components/features/dashboard`;
  const widgets: DashboardWidgetDep[] = [];

  for (const [widgetId, fileName] of Object.entries(WIDGET_FILES)) {
    const files = listFiles(dashboardDir, new RegExp(fileName.replace('.', '\\.')));
    if (!files[0]) continue;

    const content = readText(files[0]);
    const hooks = [...content.matchAll(/from\s+['"]@\/hooks(?:\/api)?\/(use[A-Za-z]+)['"]/g)].map(
      (m) => m[1],
    );

    const backendModules = new Set<string>();
    const apiDirect = [...content.matchAll(/['"]\/api\/v1\/([^/'"]+)/g)];
    for (const m of apiDirect) {
      backendModules.add(apiPrefixToModuleSlug(m[1].split('/')[0]));
    }

    const gates: string[] = [];
    if (content.includes('useSubscriptionFeatures') || content.includes('hasInventoryManagement')) {
      gates.push('plan: hasInventoryManagement');
    }
    if (content.includes('hasFeeManagement')) {
      gates.push('plan: hasFeeManagement');
    }

    widgets.push({
      widgetId,
      componentFile: relPath(files[0]),
      hooks,
      backendModules: [...backendModules],
      gates,
    });
  }

  return widgets;
}

export function enrichWidgetsWithHookModules(
  widgets: DashboardWidgetDep[],
  hookToModules: Map<string, Set<string>>,
): DashboardWidgetDep[] {
  return widgets.map((w) => {
    const mods = new Set(w.backendModules);
    for (const hook of w.hooks) {
      const hookMods = hookToModules.get(hook);
      if (hookMods) {
        for (const m of hookMods) mods.add(m);
      }
    }
    return { ...w, backendModules: [...mods].sort() };
  });
}
