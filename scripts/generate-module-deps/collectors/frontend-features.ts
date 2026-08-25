import * as fs from 'fs';
import * as path from 'path';
import type { DependencyEdge } from '../types';
import {
  FRONTEND_SRC,
  listFiles,
  readText,
  apiPrefixToModuleSlug,
} from '../utils';

const FEATURE_ALIASES: Record<string, string> = {
  inventory: 'uniforms',
  leaves: 'leave-requests',
  mapping: 'teacher-assignments',
};

export function collectFrontendFeatures(
  hookToModules: Map<string, Set<string>>,
): {
  featureToModules: Map<string, Set<string>>;
  edges: DependencyEdge[];
} {
  const featuresDir = path.join(FRONTEND_SRC, 'components/features');
  const featureToModules = new Map<string, Set<string>>();
  const edges: DependencyEdge[] = [];

  if (!fs.existsSync(featuresDir)) {
    return { featureToModules, edges };
  }

  const featureFolders = fs
    .readdirSync(featuresDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const feature of featureFolders) {
    const featurePath = path.join(featuresDir, feature);
    const files = listFiles(featurePath, /\.(tsx|ts)$/);
    const backendModules = new Set<string>();

    for (const filePath of files) {
      const content = readText(filePath);
      const hookImports = [...content.matchAll(/from\s+['"]@\/hooks(?:\/api)?\/(use[A-Za-z]+)['"]/g)];
      for (const m of hookImports) {
        const hookModules = hookToModules.get(m[1]);
        if (hookModules) {
          for (const mod of hookModules) backendModules.add(mod);
        }
      }

      const directApi = [...content.matchAll(/['"]\/api\/v1\/([^/'"]+)/g)];
      for (const m of directApi) {
        backendModules.add(apiPrefixToModuleSlug(m[1].split('/')[0]));
      }
    }

    featureToModules.set(feature, backendModules);

    for (const mod of backendModules) {
      edges.push({
        from: feature,
        to: mod,
        layer: 'frontend-feature',
        via: `components/features/${feature}`,
      });
    }
  }

  return { featureToModules, edges };
}
