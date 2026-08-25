import type { DependencyGraph, ModuleMetrics, ModuleType } from '../types';
import { buildSlugAdjacency } from './build-graph';
import { listBackendModuleSlugs } from '../collectors/backend-modules';

export function computeAllMetrics(graph: DependencyGraph): Map<string, ModuleMetrics> {
  const adj = buildSlugAdjacency(graph);
  const reverseAdj = new Map<string, Set<string>>();

  for (const [from, tos] of adj) {
    for (const to of tos) {
      if (!reverseAdj.has(to)) reverseAdj.set(to, new Set());
      reverseAdj.get(to)!.add(from);
    }
  }

  const backendSlugs = new Set(listBackendModuleSlugs());
  const featureSlugs = new Set(graph.featureToModules.keys());
  const allSlugs = new Set<string>([...backendSlugs, ...featureSlugs]);
  // Include global modules referenced in graph
  for (const slug of graph.modules.keys()) {
    if (backendSlugs.has(slug) || featureSlugs.has(slug)) allSlugs.add(slug);
  }

  const totalModules = allSlugs.size;
  const fanInMap = new Map<string, number>();
  const fanOutMap = new Map<string, number>();

  for (const slug of allSlugs) {
    fanOutMap.set(slug, adj.get(slug)?.size ?? 0);
    fanInMap.set(slug, reverseAdj.get(slug)?.size ?? 0);
  }

  const sortedByFanIn = [...allSlugs].sort(
    (a, b) => (fanInMap.get(b) ?? 0) - (fanInMap.get(a) ?? 0),
  );
  const hubRankMap = new Map<string, number>();
  sortedByFanIn.forEach((slug, i) => hubRankMap.set(slug, i + 1));

  const metrics = new Map<string, ModuleMetrics>();

  for (const slug of allSlugs) {
    const fanOut = fanOutMap.get(slug) ?? 0;
    const fanIn = fanInMap.get(slug) ?? 0;
    const blastRadius = computeBlastRadius(reverseAdj, slug, 3);

    const backendFanOut = new Set(
      graph.edges
        .filter(
          (e) =>
            e.from === slug &&
            (e.layer === 'backend-module' || e.layer === 'backend-service'),
        )
        .map((e) => e.to),
    ).size;

    const frontendFanOut = new Set(
      graph.edges
        .filter((e) => e.from === slug && e.layer.startsWith('frontend'))
        .map((e) => e.to),
    ).size;

    const moduleType = classifyModule(fanIn, fanOut, backendFanOut, frontendFanOut);
    const dependencyRate = Math.round(((fanIn + fanOut) / totalModules) * 100);

    metrics.set(slug, {
      slug,
      fanOut,
      fanIn,
      hubRank: hubRankMap.get(slug) ?? totalModules,
      totalModules,
      blastRadius,
      dependencyRate,
      moduleType,
      backendFanOut,
      frontendFanOut,
    });
  }

  return metrics;
}

function computeBlastRadius(
  reverseAdj: Map<string, Set<string>>,
  slug: string,
  maxDepth: number,
): number {
  const visited = new Set<string>();
  const queue: Array<{ node: string; depth: number }> = [{ node: slug, depth: 0 }];

  while (queue.length > 0) {
    const { node, depth } = queue.shift()!;
    if (visited.has(node)) continue;
    visited.add(node);
    if (depth >= maxDepth) continue;
    for (const parent of reverseAdj.get(node) ?? []) {
      if (!visited.has(parent)) queue.push({ node: parent, depth: depth + 1 });
    }
  }

  visited.delete(slug);
  return visited.size;
}

function classifyModule(
  fanIn: number,
  fanOut: number,
  backendFanOut: number,
  frontendFanOut: number,
): ModuleType {
  if (fanOut === 0 && backendFanOut === 0) return 'leaf';
  if (fanIn >= 10) return 'hub';
  if (frontendFanOut >= 5 && backendFanOut <= 2) return 'aggregator';
  return 'standard';
}

export function getTopHubs(metrics: Map<string, ModuleMetrics>, n = 10): ModuleMetrics[] {
  return [...metrics.values()]
    .sort((a, b) => b.fanIn - a.fanIn || a.hubRank - b.hubRank)
    .slice(0, n);
}

export function getTopAggregators(metrics: Map<string, ModuleMetrics>, n = 10): ModuleMetrics[] {
  return [...metrics.values()]
    .filter((m) => m.moduleType === 'aggregator' || m.frontendFanOut >= 4)
    .sort((a, b) => b.fanOut - a.fanOut)
    .slice(0, n);
}

export function getPlanGatedModules(graph: DependencyGraph): string[] {
  const planModules = new Set<string>();
  for (const g of graph.gates) {
    if (g.gateType === 'plan') {
      const mod = g.sourceFile.match(/modules\/([^/]+)/)?.[1];
      if (mod) planModules.add(mod);
    }
  }
  for (const g of graph.gates) {
    if (g.gateType === 'nav-plan') {
      const path = g.appliesTo.match(/nav path (\S+)/)?.[1];
      if (path === '/fees') planModules.add('fees');
      if (path === '/library') planModules.add('library');
      if (path?.includes('inventory') || path === '/uniform-request') planModules.add('uniforms');
      if (path === '/behavioral') planModules.add('behavioral');
    }
  }
  return [...planModules].sort();
}
