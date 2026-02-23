export interface DashboardWidget {
  id: string;
  title: string;
  description?: string;
  role: string;
}

export interface DashboardPreferences {
  widgetIds?: string[];
  selectedRoleId?: string;
  layout?: Record<string, unknown>;
}

export interface DashboardData {
  quickStats?: Record<string, number>;
  recentActivity?: unknown[];
}
