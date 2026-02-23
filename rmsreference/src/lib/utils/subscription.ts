import { PlanId } from '../api/subscription';

export const PLAN_CONFIGS = {
  [PlanId.FREE]: {
    name: 'Free',
    price: 0,
    locations: 1,
    users: 2,
    menuItems: 10,
    ordersMonth: 50,
    features: [
      'Point of Sale',
      'Menu & Categories',
      'Order Management',
      'Cash & Card Payments',
      'Customer Records',
      'Dashboard',
      'Multi-language Interface (Arabic, English)',
    ],
    languages: ['ar', 'en'],
    hasReports: false,
  },
  [PlanId.STARTER]: {
    name: 'Starter',
    price: 30,
    locations: 1,
    users: 5,
    menuItems: 25,
    ordersMonth: 3000,
    features: [
      'All Free features',
      'Report & Analytics',
    ],
    languages: ['ar', 'en', 'ku', 'fr'],
    hasReports: true,
  },
  [PlanId.PRO]: {
    name: 'Pro',
    price: 100,
    locations: 5,
    users: 30,
    menuItems: 'unlimited' as const,
    ordersMonth: 15000,
    features: [
      'All Starter features',
      'Multi-location',
      'Inventory',
      'AI Features',
    ],
    languages: ['ar', 'en', 'ku', 'fr'],
    hasReports: true,
  },
  [PlanId.ENTERPRISE]: {
    name: 'Enterprise',
    price: 0, // Custom pricing
    locations: 'unlimited' as const,
    users: 'unlimited' as const,
    menuItems: 'unlimited' as const,
    ordersMonth: 'unlimited' as const,
    features: [
      'All Pro features',
      'White-label',
      'SLA',
      'API Integrations',
      'Phone support',
    ],
    languages: ['ar', 'en', 'ku', 'fr'],
    hasReports: true,
  },
};

/**
 * Check if a plan has access to Reports
 */
export function planHasReports(planId: PlanId): boolean {
  return PLAN_CONFIGS[planId]?.hasReports || false;
}

/**
 * Check if a plan supports a language
 */
export function planSupportsLanguage(planId: PlanId, language: string): boolean {
  const config = PLAN_CONFIGS[planId];
  if (!config) return false;
  return config.languages.includes(language.toLowerCase());
}

/**
 * Get plan order for comparison
 */
export function getPlanOrder(planId: PlanId): number {
  const order = {
    [PlanId.FREE]: 0,
    [PlanId.STARTER]: 1,
    [PlanId.PRO]: 2,
    [PlanId.ENTERPRISE]: 3,
  };
  return order[planId] ?? -1;
}

/**
 * Check if current usage exceeds plan limit
 */
export function exceedsLimit(
  planId: PlanId,
  limitType: 'locations' | 'users' | 'menuItems' | 'ordersMonth',
  currentValue: number,
): boolean {
  const config = PLAN_CONFIGS[planId];
  if (!config) return true;

  const limit = config[limitType];
  if (limit === 'unlimited') {
    return false;
  }

  return currentValue > limit;
}

/**
 * Check if route should be restricted for Free plan
 */
export function isRestrictedRoute(route: string): boolean {
  const restrictedRoutes = [
    '/portal/reports',
    '/portal/analytics',
  ];
  return restrictedRoutes.some((r) => route.startsWith(r));
}

