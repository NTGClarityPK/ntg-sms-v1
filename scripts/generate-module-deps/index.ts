import * as fs from 'fs';
import * as path from 'path';
import { collectBackendModules } from './collectors/backend-modules';
import { collectBackendServiceInjections } from './collectors/backend-services';
import { collectBackendGuards } from './collectors/backend-guards';
import { collectDatabaseTables } from './collectors/database-tables';
import { collectFrontendHooks } from './collectors/frontend-hooks';
import { collectFrontendFeatures } from './collectors/frontend-features';
import { collectFrontendNavGates } from './collectors/frontend-nav-gates';
import {
  collectDashboardWidgets,
  enrichWidgetsWithHookModules,
} from './collectors/dashboard-widgets';
import { buildGraph, detectForwardRefCycles } from './graph/build-graph';
import { computeAllMetrics } from './graph/metrics';
import { renderIndex, renderGraphJson } from './render/render-index';
import { renderModulePage } from './render/render-module';
import { OUTPUT_DIR, ensureDir } from './utils';

function main(): void {
  const start = Date.now();
  console.log('Collecting backend modules...');
  const { modules, forwardRefEdges, anomalies: moduleAnomalies } = collectBackendModules();

  console.log('Collecting service injections...');
  const serviceEdges = collectBackendServiceInjections();

  console.log('Collecting backend guards...');
  const backendGates = collectBackendGuards();

  console.log('Collecting database tables...');
  const tables = collectDatabaseTables();

  console.log('Collecting frontend hooks...');
  const { hookToModules, edges: hookEdges } = collectFrontendHooks();

  console.log('Collecting frontend features...');
  const { featureToModules, edges: featureEdges } = collectFrontendFeatures(hookToModules);

  console.log('Collecting nav gates...');
  const { gates: navGates, navEdges } = collectFrontendNavGates();

  console.log('Collecting dashboard widgets...');
  let widgets = collectDashboardWidgets();
  widgets = enrichWidgetsWithHookModules(widgets, hookToModules);

  const cycleAnomalies = detectForwardRefCycles(forwardRefEdges);
  const allAnomalies = [...moduleAnomalies, ...cycleAnomalies];

  console.log('Building dependency graph...');
  const graph = buildGraph({
    modules,
    forwardRefEdges,
    backendModuleEdges: [],
    serviceEdges,
    frontendFeatureEdges: featureEdges,
    frontendHookEdges: hookEdges,
    navEdges,
    gates: [...backendGates, ...navGates],
    tables,
    widgets,
    anomalies: allAnomalies,
    hookToModules,
    featureToModules,
  });

  console.log('Computing metrics...');
  const metrics = computeAllMetrics(graph);

  const generatedAt = new Date().toISOString();
  const modulesDir = path.join(OUTPUT_DIR, 'modules');
  ensureDir(OUTPUT_DIR);
  ensureDir(modulesDir);

  console.log('Rendering index...');
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'README.md'),
    renderIndex(graph, metrics, generatedAt),
    'utf8',
  );

  console.log('Rendering module pages...');
  const sortedSlugs = [...metrics.keys()].sort();
  for (const slug of sortedSlugs) {
    const m = metrics.get(slug)!;
    fs.writeFileSync(
      path.join(modulesDir, `${slug}.md`),
      renderModulePage(graph, m),
      'utf8',
    );
  }

  console.log('Writing dependency-graph.json...');
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'dependency-graph.json'),
    renderGraphJson(graph, metrics),
    'utf8',
  );

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const topHub = [...metrics.values()].sort((a, b) => b.fanIn - a.fanIn)[0];
  console.log(`Done in ${elapsed}s — ${sortedSlugs.length} modules, top hub: ${topHub?.slug} (fan-in: ${topHub?.fanIn})`);
  console.log(`Output: ${OUTPUT_DIR}`);
}

main();
