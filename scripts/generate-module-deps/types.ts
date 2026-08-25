export type DependencyLayer =
  | 'backend-module'
  | 'backend-service'
  | 'frontend-hook'
  | 'frontend-feature'
  | 'frontend-nav'
  | 'database';

export type ModuleType = 'leaf' | 'hub' | 'aggregator' | 'standard';

export interface DependencyEdge {
  from: string;
  to: string;
  layer: DependencyLayer;
  via?: string;
  condition?: string;
  special?: 'forwardRef' | 'global';
}

export interface AccessGate {
  gateType: 'jwt' | 'branch' | 'rbac' | 'plan' | 'role' | 'student-jwt' | 'widget-role' | 'nav-rbac' | 'nav-plan' | 'settings-gate';
  condition: string;
  appliesTo: string;
  sourceFile: string;
}

export interface DatabaseTouchpoint {
  table: string;
  moduleSlug: string;
  sourceFile: string;
}

export interface WiringAnomaly {
  moduleSlug: string;
  kind: 'duplicate-provider' | 'forwardRef-cycle' | 'global-module';
  detail: string;
  sourceFile?: string;
}

export interface DashboardWidgetDep {
  widgetId: string;
  componentFile: string;
  hooks: string[];
  backendModules: string[];
  gates: string[];
}

export interface ModuleInfo {
  slug: string;
  name: string;
  category: string;
  backendModuleFile?: string;
  frontendFeatureFolder?: string;
  exports: string[];
  imports: string[];
  controllers: string[];
  providers: string[];
  isGlobal: boolean;
  description?: string;
}

export interface ModuleMetrics {
  slug: string;
  fanOut: number;
  fanIn: number;
  hubRank: number;
  totalModules: number;
  blastRadius: number;
  dependencyRate: number;
  moduleType: ModuleType;
  backendFanOut: number;
  frontendFanOut: number;
}

export interface ModuleReportData {
  info: ModuleInfo;
  metrics: ModuleMetrics;
  outbound: DependencyEdge[];
  inbound: DependencyEdge[];
  gates: AccessGate[];
  tables: DatabaseTouchpoint[];
  widgets: DashboardWidgetDep[];
  anomalies: WiringAnomaly[];
}

export interface DependencyGraph {
  modules: Map<string, ModuleInfo>;
  edges: DependencyEdge[];
  gates: AccessGate[];
  tables: DatabaseTouchpoint[];
  widgets: DashboardWidgetDep[];
  anomalies: WiringAnomaly[];
  hookToModules: Map<string, Set<string>>;
  featureToModules: Map<string, Set<string>>;
}
