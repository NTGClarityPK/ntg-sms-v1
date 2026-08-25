import * as fs from 'fs';
import * as path from 'path';
import type { ModuleInfo, WiringAnomaly } from '../types';
import {
  BACKEND_MODULES,
  listFiles,
  moduleClassToSlug,
  readText,
  relPath,
  getCategory,
} from '../utils';

function extractArrayItems(block: string, key: string): string[] {
  const regex = new RegExp(`${key}\\s*:\\s*\\[([^\\]]*)\\]`, 's');
  const match = block.match(regex);
  if (!match) return [];
  const inner = match[1];
  const items: string[] = [];
  const identRegex = /([A-Za-z0-9_]+(?:Module|Controller|Service|Guard|Config))/g;
  let m: RegExpExecArray | null;
  while ((m = identRegex.exec(inner)) !== null) {
    const name = m[1];
    if (name === 'Module' || name === 'forwardRef') continue;
    items.push(name);
  }
  return items;
}

function parseModuleFile(filePath: string): ModuleInfo | null {
  const content = readText(filePath);
  const classMatch = content.match(/export class (\w+Module)/);
  if (!classMatch) return null;

  const slug = path.basename(path.dirname(filePath));
  const decoratorMatch = content.match(/@Module\s*\(\s*\{([\s\S]*?)\}\s*\)/);
  const block = decoratorMatch?.[1] ?? '';

  const isGlobal = /@Global\s*\(\s*\)/.test(content);
  const imports = extractArrayItems(block, 'imports');
  const exports = extractArrayItems(block, 'exports');
  const providers = extractArrayItems(block, 'providers');
  const controllers = extractArrayItems(block, 'controllers');

  const importSlugs = imports
    .map((i) => moduleClassToSlug(i))
    .filter((s): s is string => s !== null);

  return {
    slug,
    name: classMatch[1].replace(/Module$/, ''),
    category: getCategory(slug),
    backendModuleFile: relPath(filePath),
    exports,
    imports: importSlugs,
    controllers,
    providers,
    isGlobal,
  };
}

export function collectBackendModules(): {
  modules: Map<string, ModuleInfo>;
  forwardRefEdges: Array<{ from: string; to: string }>;
  anomalies: WiringAnomaly[];
} {
  const modules = new Map<string, ModuleInfo>();
  const forwardRefEdges: Array<{ from: string; to: string }> = [];
  const anomalies: WiringAnomaly[] = [];

  const moduleFiles = listFiles(BACKEND_MODULES, /\.module\.ts$/);

  for (const filePath of moduleFiles) {
    const info = parseModuleFile(filePath);
    if (!info) continue;
    modules.set(info.slug, info);

    if (info.isGlobal) {
      anomalies.push({
        moduleSlug: info.slug,
        kind: 'global-module',
        detail: `@Global() module — services injectable without explicit import`,
        sourceFile: info.backendModuleFile,
      });
    }

    const content = readText(filePath);
    const forwardRefs = [...content.matchAll(/forwardRef\(\s*\(\)\s*=>\s*(\w+Module)\s*\)/g)];
    for (const m of forwardRefs) {
      const toSlug = moduleClassToSlug(m[1]);
      if (toSlug) {
        forwardRefEdges.push({ from: info.slug, to: toSlug });
      }
    }
  }

  for (const info of modules.values()) {
    const foreignServices = info.providers.filter(
      (p) => p.endsWith('Service') && !p.toLowerCase().startsWith(info.slug.replace(/-/g, '')),
    );
    for (const svc of foreignServices) {
      const ownerModule = [...modules.values()].find(
        (m) => m.exports.includes(svc) || m.providers.some((p) => p === svc),
      );
      if (ownerModule && ownerModule.slug !== info.slug && !info.imports.includes(ownerModule.slug)) {
        anomalies.push({
          moduleSlug: info.slug,
          kind: 'duplicate-provider',
          detail: `Re-provides ${svc} without importing ${ownerModule.slug} module`,
          sourceFile: info.backendModuleFile,
        });
      }
    }
  }

  return { modules, forwardRefEdges, anomalies };
}

export function listBackendModuleSlugs(): string[] {
  if (!fs.existsSync(BACKEND_MODULES)) return [];
  return fs
    .readdirSync(BACKEND_MODULES, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}
