import type { DatabaseTouchpoint } from '../types';
import { BACKEND_MODULES, listFiles, readText, relPath } from '../utils';

export function collectDatabaseTables(): DatabaseTouchpoint[] {
  const touchpoints: DatabaseTouchpoint[] = [];
  const seen = new Set<string>();
  const tsFiles = listFiles(BACKEND_MODULES, /\.(service|controller)\.ts$/);

  for (const filePath of tsFiles) {
    const moduleSlug = filePath.split(/[/\\]modules[/\\]/)[1]?.split(/[/\\]/)[0];
    if (!moduleSlug) continue;

    const content = readText(filePath);
    const matches = [...content.matchAll(/\.from\(\s*['"]([\w_]+)['"]\s*\)/g)];
    for (const m of matches) {
      const table = m[1];
      const key = `${moduleSlug}:${table}`;
      if (seen.has(key)) continue;
      seen.add(key);
      touchpoints.push({
        table,
        moduleSlug,
        sourceFile: relPath(filePath),
      });
    }
  }

  return touchpoints.sort((a, b) => a.table.localeCompare(b.table));
}
