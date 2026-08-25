import * as fs from 'fs';
import * as path from 'path';

export const REPO_ROOT = path.resolve(__dirname, '../..');
export const BACKEND_MODULES = path.join(REPO_ROOT, 'backend/src/modules');
export const FRONTEND_SRC = path.join(REPO_ROOT, 'frontend/src');
export const OUTPUT_DIR = path.join(REPO_ROOT, 'docs/internal/module-dependencies');

/** PascalCase Nest module class name → kebab-case slug (folder name). */
export function moduleClassToSlug(className: string): string | null {
  const match = className.match(/^(.+)Module$/);
  if (!match) return null;
  const base = match[1];
  return base
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

export function readText(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

export function listFiles(dir: string, pattern: RegExp): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (pattern.test(entry.name)) results.push(full);
    }
  };
  walk(dir);
  return results;
}

export function relPath(abs: string): string {
  return path.relative(REPO_ROOT, abs).replace(/\\/g, '/');
}

export function titleCase(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function mermaidId(slug: string): string {
  return slug.replace(/[^a-zA-Z0-9_]/g, '_');
}

/** Map API route prefix to backend module slug (handles aliases). */
export function apiPrefixToModuleSlug(prefix: string): string {
  const aliases: Record<string, string> = {
    student: 'student-self',
    'early-departure': 'early-departure',
    'early-departures': 'early-departure',
    'leave-requests': 'leave-requests',
    'class-sections': 'class-sections',
    'teacher-assignments': 'teacher-assignments',
    'subject-templates': 'subject-templates',
    'academic-years': 'academic-years',
    'core-lookups': 'core-lookups',
    'system-settings': 'system-settings',
    'settings-status': 'settings-status',
    'settings-import': 'settings-import',
    'setup-wizard': 'setup-wizard',
    'data-export': 'data-export',
    'id-cards': 'id-cards',
    'google-workspace': 'google-workspace',
    'behavioral-framework': 'behavioral-framework',
    'promotion-placement': 'promotion-placement',
    'uniform-requests': 'uniform-requests',
    'uniform-issuances': 'uniform-issuances',
    'result-report-settings': 'results',
    'result-reports': 'results',
  };
  return aliases[prefix] ?? prefix;
}

export const MODULE_CATEGORIES: Record<string, string> = {
  auth: 'Core System',
  tenants: 'Core System',
  branches: 'Core System',
  users: 'Core System',
  roles: 'Core System',
  registration: 'Core System',
  subscription: 'Core System',
  invitations: 'Core System',
  'academic-years': 'Academic Structure',
  'core-lookups': 'Academic Structure',
  'class-sections': 'Academic Structure',
  'subject-templates': 'Academic Structure',
  schedule: 'Academic Structure',
  timetable: 'Academic Structure',
  'teacher-assignments': 'Academic Structure',
  grades: 'Academic Structure',
  'promotion-placement': 'Academic Structure',
  students: 'Student Management',
  parents: 'Student Management',
  staff: 'Student Management',
  'student-self': 'Student Management',
  assessment: 'Assessment & Grading',
  assessments: 'Assessment & Grading',
  results: 'Assessment & Grading',
  rubrics: 'Assessment & Grading',
  attendance: 'Attendance & Leave',
  'leave-requests': 'Attendance & Leave',
  'early-departure': 'Attendance & Leave',
  messages: 'Communication',
  notifications: 'Communication',
  push: 'Communication',
  events: 'Events & Behaviour',
  behavioral: 'Events & Behaviour',
  'behavioral-framework': 'Events & Behaviour',
  library: 'Library & Resources',
  uniforms: 'Uniforms & Inventory',
  'uniform-requests': 'Uniforms & Inventory',
  'uniform-issuances': 'Uniforms & Inventory',
  fees: 'Finance',
  reports: 'Reporting & Analytics',
  dashboard: 'Reporting & Analytics',
  certificates: 'Documents',
  'id-cards': 'Documents',
  storage: 'Utilities',
  'bulk-import': 'Utilities',
  'settings-import': 'Utilities',
  'system-settings': 'Utilities',
  'settings-status': 'Utilities',
  'setup-wizard': 'Utilities',
  'data-export': 'Utilities',
  substitutions: 'Scheduling',
  'google-workspace': 'Integrations',
  'student-placement': 'Utilities',
};

export function getCategory(slug: string): string {
  return MODULE_CATEGORIES[slug] ?? 'Other';
}
