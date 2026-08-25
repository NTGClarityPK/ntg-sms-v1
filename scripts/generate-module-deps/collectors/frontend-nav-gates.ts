import type { AccessGate, DependencyEdge } from '../types';
import { FRONTEND_SRC, readText, relPath } from '../utils';

/** Map RBAC nav feature codes to primary backend module slug. */
const NAV_FEATURE_TO_MODULE: Record<string, string> = {
  dashboard: 'dashboard',
  students: 'students',
  user_management: 'users',
  class_sections: 'class-sections',
  teacher_mapping: 'teacher-assignments',
  parent_associations: 'parents',
  timetable_personal: 'timetable',
  timetable_management: 'timetable',
  conflict_management: 'timetable',
  teacher_substitution: 'substitutions',
  attendance: 'attendance',
  assessment: 'assessments',
  my_assessments: 'assessments',
  results: 'results',
  behavioral: 'behavioral',
  leaves: 'leave-requests',
  early_departure: 'early-departure',
  communication: 'messages',
  library: 'library',
  inventory: 'uniforms',
  events_personal: 'events',
  events_management: 'events',
  reports: 'reports',
  settings: 'settings',
  id_cards: 'id-cards',
  certificates: 'certificates',
  fees: 'fees',
};

export function collectFrontendNavGates(): {
  gates: AccessGate[];
  navEdges: DependencyEdge[];
} {
  const gates: AccessGate[] = [];
  const navEdges: DependencyEdge[] = [];

  const navMapPath = `${FRONTEND_SRC}/lib/permission/navFeatureMap.ts`;
  const navContent = readText(navMapPath);
  const navEntries = [...navContent.matchAll(/['"]([/\w-]+)['"]\s*:\s*['"]([\w_]+)['"]/g)];
  for (const m of navEntries) {
    gates.push({
      gateType: 'nav-rbac',
      condition: `canView('${m[2]}')`,
      appliesTo: `nav path ${m[1]}`,
      sourceFile: relPath(navMapPath),
    });
    const moduleSlug = NAV_FEATURE_TO_MODULE[m[2]];
    if (moduleSlug) {
      navEdges.push({
        from: 'sidebar',
        to: moduleSlug,
        layer: 'frontend-nav',
        via: m[1],
        condition: `RBAC feature ${m[2]}`,
      });
    }
  }

  const sidebarPath = `${FRONTEND_SRC}/components/layout/Sidebar.tsx`;
  const sidebarContent = readText(sidebarPath);
  const planEntries = [...sidebarContent.matchAll(/['"]([/\w-]+)['"]\s*:\s*['"](has\w+)['"]/g)];
  for (const m of planEntries) {
    gates.push({
      gateType: 'nav-plan',
      condition: m[2],
      appliesTo: `nav path ${m[1]} (planLocked when false)`,
      sourceFile: relPath(sidebarPath),
    });
  }

  const settingsNavPath = `${FRONTEND_SRC}/components/features/settings/SettingsSectionNav.tsx`;
  const settingsContent = readText(settingsNavPath);
  const gateTypes = [...settingsContent.matchAll(/gate:\s*['"](\w+)['"]/g)];
  for (const m of gateTypes) {
    if (m[1] === 'always') continue;
    gates.push({
      gateType: 'settings-gate',
      condition: m[1],
      appliesTo: 'settings tab visibility',
      sourceFile: relPath(settingsNavPath),
    });
  }

  return { gates, navEdges };
}
