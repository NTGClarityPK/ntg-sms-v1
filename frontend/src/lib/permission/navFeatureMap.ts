/**
 * Central mapping: nav path → feature code for permission-controlled tabs.
 * Single source of truth for "which tab is which feature" (like themeConfig for styling).
 * Routes not in this map keep existing role-based Sidebar logic only.
 */

export const NAV_FEATURE_MAP: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/students': 'students',
  '/users': 'user_management',
  '/academic/class-sections': 'class_sections',
  '/academic/teacher-mapping': 'teacher_mapping',
  '/parent-associations': 'parent_associations',
  '/my-children': 'parent_associations',
  '/children-timetable': 'timetable_personal',
  '/attendance': 'attendance',
  '/assessments': 'assessment',
  '/my-assessments': 'my_assessments',
  '/behavioral': 'behavioral',
  '/leaves': 'leaves',
  '/early-departure': 'early_departure',
  '/notifications': 'communication',
  '/messages': 'communication',
  '/library': 'library',
  '/offline-documents': 'library',
  '/inventory': 'inventory',
  '/inventory/items': 'inventory',
  '/inventory/requests': 'inventory',
  '/inventory/history': 'inventory',
  '/uniform-request': 'inventory',
  // Split personal vs management features
  '/my-events': 'events_personal',
  '/events': 'events_management',
  '/my-schedule': 'timetable_personal',
  '/my-timetable': 'timetable_personal',
  '/timetable': 'timetable_management',
  '/conflict-management': 'timetable_management',
  '/promotion-placement': 'students',
  '/reports': 'reports',
  '/results': 'reports',
  '/reports/public': 'reports',
  '/reports/administrative': 'reports',
  '/settings': 'settings',
};

/**
 * Get the feature code for a nav path, if permission-controlled.
 * Use exact match first; then check path prefix for nested routes (e.g. /settings/permissions → settings).
 */
export function getFeatureCodeForPath(path: string): string | undefined {
  if (!path) return undefined;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  // Exact match
  if (NAV_FEATURE_MAP[normalized]) return NAV_FEATURE_MAP[normalized];
  // Prefix match for nested routes (e.g. /settings/permissions → settings)
  const segments = normalized.split('/').filter(Boolean);
  for (let i = segments.length; i >= 1; i--) {
    const prefix = '/' + segments.slice(0, i).join('/');
    if (NAV_FEATURE_MAP[prefix]) return NAV_FEATURE_MAP[prefix];
  }
  return undefined;
}
