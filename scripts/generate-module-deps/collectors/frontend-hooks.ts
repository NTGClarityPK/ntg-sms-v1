import type { DependencyEdge } from '../types';
import { FRONTEND_SRC, listFiles, readText, apiPrefixToModuleSlug } from '../utils';

const HOOK_DIRS = [
  `${FRONTEND_SRC}/hooks`,
  `${FRONTEND_SRC}/hooks/api`,
];

export function collectFrontendHooks(): {
  hookToModules: Map<string, Set<string>>;
  edges: DependencyEdge[];
} {
  const hookToModules = new Map<string, Set<string>>();
  const edges: DependencyEdge[] = [];

  for (const dir of HOOK_DIRS) {
    const files = listFiles(dir, /\.ts$/);
    for (const filePath of files) {
      const hookName = filePath.replace(/\.ts$/, '').split(/[/\\]/).pop() ?? '';
      const content = readText(filePath);
      const apiMatches = [...content.matchAll(/['"]\/api\/v1\/([^/'"]+)/g)];
      const modules = new Set<string>();

      for (const m of apiMatches) {
        const prefix = m[1].split('/')[0];
        const slug = apiPrefixToModuleSlug(prefix);
        modules.add(slug);
        edges.push({
          from: `hook:${hookName}`,
          to: slug,
          layer: 'frontend-hook',
          via: `/api/v1/${prefix}`,
        });
      }

      if (modules.size > 0) {
        hookToModules.set(hookName, modules);
      }
    }
  }

  return { hookToModules, edges };
}

/** Map hook file base name (useStudents) from import path. */
export function hookImportToName(importPath: string): string | null {
  const match = importPath.match(/\/hooks(?:\/api)?\/(use[A-Za-z]+)/);
  return match?.[1] ?? null;
}

export function modulesFromFileImports(content: string): Set<string> {
  const modules = new Set<string>();
  const hookImports = [...content.matchAll(/from\s+['"]@\/hooks(?:\/api)?\/(use[A-Za-z]+)['"]/g)];
  for (const m of hookImports) {
    modules.add(`hook:${m[1]}`);
  }
  return modules;
}
