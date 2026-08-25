import type { DependencyEdge } from '../types';
import { BACKEND_MODULES, listFiles, readText, relPath } from '../utils';

export function collectBackendServiceInjections(): DependencyEdge[] {
  const edges: DependencyEdge[] = [];
  const serviceFiles = listFiles(BACKEND_MODULES, /\.service\.ts$/);

  for (const filePath of serviceFiles) {
    const fromSlug = filePath.split(/[/\\]modules[/\\]/)[1]?.split(/[/\\]/)[0];
    if (!fromSlug) continue;

    const content = readText(filePath);
    const ctorMatch = content.match(/constructor\s*\(([\s\S]*?)\)\s*\{/);
    if (!ctorMatch) continue;

    const params = ctorMatch[1];
    const typedInjections = [...params.matchAll(/private\s+readonly\s+\w+\s*:\s*(\w+)/g)];
    for (const inj of typedInjections) {
      const typeName = inj[1];
      if (typeName === 'SupabaseConfig') continue;
      if (!typeName.endsWith('Service')) continue;
      const baseName = typeName.replace(/Service$/, '');
      const toSlug = baseName
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
        .toLowerCase();

      if (toSlug && toSlug !== fromSlug) {
        edges.push({
          from: fromSlug,
          to: toSlug,
          layer: 'backend-service',
          via: `${relPath(filePath)} → ${typeName}`,
        });
      }
    }
  }

  return edges;
}
