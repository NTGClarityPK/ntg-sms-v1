import type { AccessGate } from '../types';
import { BACKEND_MODULES, listFiles, readText, relPath } from '../utils';

function extractControllerSlug(filePath: string): string {
  return filePath.split(/[/\\]modules[/\\]/)[1]?.split(/[/\\]/)[0] ?? 'unknown';
}

export function collectBackendGuards(): AccessGate[] {
  const gates: AccessGate[] = [];
  const controllerFiles = listFiles(BACKEND_MODULES, /\.controller\.ts$/);

  for (const filePath of controllerFiles) {
    const slug = extractControllerSlug(filePath);
    const content = readText(filePath);
    const rel = relPath(filePath);

    if (content.includes('JwtAuthGuard')) {
      gates.push({
        gateType: 'jwt',
        condition: 'JwtAuthGuard',
        appliesTo: `${slug} API`,
        sourceFile: rel,
      });
    }
    if (content.includes('BranchGuard')) {
      gates.push({
        gateType: 'branch',
        condition: 'BranchGuard (X-Branch-Id)',
        appliesTo: `${slug} API`,
        sourceFile: rel,
      });
    }
    if (content.includes('StudentJwtGuard')) {
      gates.push({
        gateType: 'student-jwt',
        condition: 'StudentJwtGuard',
        appliesTo: `${slug} student portal API`,
        sourceFile: rel,
      });
    }
    if (content.includes('SchoolAdminGuard')) {
      gates.push({
        gateType: 'role',
        condition: 'school_admin only',
        appliesTo: `${slug} API`,
        sourceFile: rel,
      });
    }

    const requiresFeatures = [...content.matchAll(/@RequiresFeature\(['"](\w+)['"]\)/g)];
    for (const m of requiresFeatures) {
      gates.push({
        gateType: 'plan',
        condition: `RequiresFeature('${m[1]}')`,
        appliesTo: `${slug} API`,
        sourceFile: rel,
      });
    }

    const rbacWithCode = [...content.matchAll(/ensureFeatureEditAccess\([^,]+,[^,]+,\s*['"]([\w_]+)['"]\)/g)];
    const seenRbac = new Set<string>();
    for (const m of rbacWithCode) {
      const key = `${slug}:${m[1]}`;
      if (seenRbac.has(key)) continue;
      seenRbac.add(key);
      gates.push({
        gateType: 'rbac',
        condition: `ensureFeatureEditAccess('${m[1]}')`,
        appliesTo: `${slug} write endpoints`,
        sourceFile: rel,
      });
    }

    if (content.includes('ensureFeatureEditAccess') && rbacWithCode.length === 0) {
      gates.push({
        gateType: 'rbac',
        condition: 'ensureFeatureEditAccess()',
        appliesTo: `${slug} write endpoints`,
        sourceFile: rel,
      });
    }
  }

  const dashPaths = listFiles(BACKEND_MODULES, /dashboard\.service\.ts$/);
  if (dashPaths[0]) {
    const content = readText(dashPaths[0]);
    const roles = [
      'parent', 'class_teacher', 'subject_teacher', 'school_admin', 'principal',
      'academic_coordinator', 'admin_assistant', 'guidance_counselor', 'student',
    ];
    for (const role of roles) {
      if (content.includes(`${role}:`)) {
        gates.push({
          gateType: 'widget-role',
          condition: `ROLE_WIDGETS.${role}`,
          appliesTo: `dashboard widgets for ${role} role`,
          sourceFile: relPath(dashPaths[0]),
        });
      }
    }
  }

  return gates;
}
