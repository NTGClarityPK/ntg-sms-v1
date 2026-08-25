import type {
  AccessGate,
  DashboardWidgetDep,
  DatabaseTouchpoint,
  DependencyEdge,
  DependencyGraph,
  ModuleInfo,
  WiringAnomaly,
} from '../types';

function edgeKey(e: DependencyEdge): string {
  return `${e.from}|${e.to}|${e.layer}|${e.via ?? ''}`;
}

function dedupeEdges(edges: DependencyEdge[]): DependencyEdge[] {
  const seen = new Set<string>();
  const result: DependencyEdge[] = [];
  for (const e of edges) {
    const key = edgeKey(e);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(e);
  }
  return result;
}

export function buildGraph(input: {
  modules: Map<string, ModuleInfo>;
  forwardRefEdges: Array<{ from: string; to: string }>;
  backendModuleEdges: DependencyEdge[];
  serviceEdges: DependencyEdge[];
  frontendFeatureEdges: DependencyEdge[];
  frontendHookEdges: DependencyEdge[];
  navEdges: DependencyEdge[];
  gates: AccessGate[];
  tables: DatabaseTouchpoint[];
  widgets: DashboardWidgetDep[];
  anomalies: WiringAnomaly[];
  hookToModules: Map<string, Set<string>>;
  featureToModules: Map<string, Set<string>>;
}): DependencyGraph {
  const edges: DependencyEdge[] = [];

  for (const info of input.modules.values()) {
    for (const imp of info.imports) {
      edges.push({
        from: info.slug,
        to: imp,
        layer: 'backend-module',
        via: `${info.backendModuleFile} imports`,
      });
    }
  }

  for (const fr of input.forwardRefEdges) {
    edges.push({
      from: fr.from,
      to: fr.to,
      layer: 'backend-module',
      via: 'forwardRef',
      special: 'forwardRef',
    });
  }

  edges.push(...input.serviceEdges);
  edges.push(...input.frontendFeatureEdges);
  edges.push(...input.frontendHookEdges);
  edges.push(...input.navEdges);

  // Dashboard feature → widget backend modules
  for (const w of input.widgets) {
    for (const mod of w.backendModules) {
      edges.push({
        from: 'dashboard',
        to: mod,
        layer: 'frontend-feature',
        via: `widget:${w.widgetId}`,
        condition: w.gates.join('; ') || undefined,
      });
    }
  }

  // Attach frontend feature folders to module info
  for (const [feature, mods] of input.featureToModules) {
    const slug = feature;
    let info = input.modules.get(slug);
    if (!info) {
      info = {
        slug,
        name: feature,
        category: 'Frontend Feature',
        frontendFeatureFolder: `frontend/src/components/features/${feature}`,
        exports: [],
        imports: [],
        controllers: [],
        providers: [],
        isGlobal: false,
      };
      input.modules.set(slug, info);
    } else {
      info.frontendFeatureFolder = `frontend/src/components/features/${feature}`;
    }
  }

  return {
    modules: input.modules,
    edges: dedupeEdges(edges),
    gates: input.gates,
    tables: input.tables,
    widgets: input.widgets,
    anomalies: input.anomalies,
    hookToModules: input.hookToModules,
    featureToModules: input.featureToModules,
  };
}

/** Resolve slug-level outbound/inbound for a module (backend + frontend composition). */
export function getModuleEdges(
  graph: DependencyGraph,
  slug: string,
): { outbound: DependencyEdge[]; inbound: DependencyEdge[] } {
  const outbound = graph.edges.filter(
    (e) => e.from === slug || e.from === `feature:${slug}`,
  );
  const inbound = graph.edges.filter((e) => e.to === slug);
  return { outbound, inbound };
}

export function normalizeSlugForMetrics(node: string): string | null {
  if (node.startsWith('hook:')) return null;
  if (node.startsWith('feature:')) return node.replace('feature:', '');
  if (node === 'sidebar') return null;
  return node;
}

export function buildSlugAdjacency(graph: DependencyGraph): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();

  const addEdge = (from: string, to: string) => {
    if (!adj.has(from)) adj.set(from, new Set());
    adj.get(from)!.add(to);
  };

  for (const e of graph.edges) {
    const from = normalizeSlugForMetrics(e.from);
    const to = normalizeSlugForMetrics(e.to);
    if (from && to && from !== to) addEdge(from, to);
  }

  // Feature folder aliases map to backend slugs — also count dashboard → X
  if (graph.featureToModules.has('dashboard')) {
    for (const mod of graph.featureToModules.get('dashboard')!) {
      addEdge('dashboard', mod);
    }
  }

  return adj;
}

export function detectForwardRefCycles(
  forwardRefEdges: Array<{ from: string; to: string }>,
): WiringAnomaly[] {
  const anomalies: WiringAnomaly[] = [];
  const pairs = new Set(forwardRefEdges.map((e) => `${e.from}:${e.to}`));
  for (const e of forwardRefEdges) {
    if (pairs.has(`${e.to}:${e.from}`)) {
      anomalies.push({
        moduleSlug: e.from,
        kind: 'forwardRef-cycle',
        detail: `Circular forwardRef between ${e.from} and ${e.to}`,
      });
    }
  }
  return anomalies;
}
