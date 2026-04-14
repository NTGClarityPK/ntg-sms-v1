import { apiClient } from '@/lib/api-client';
import type { Tenant } from '@/types/tenant';
import { clearLocalSupabaseSession } from '@/lib/auth';
import { normalizeUiLocale, setUiLocaleCookieOnDocument } from '@/lib/ui-locale';

function formatApiErrorBodyMessage(
  data: { error?: { message?: string | string[] }; message?: string | string[] } | undefined,
  fallback: string,
): string {
  if (!data) return fallback;
  const raw = data.error?.message ?? data.message;
  if (Array.isArray(raw)) return raw.join(', ');
  if (typeof raw === 'string' && raw.trim()) return raw;
  return fallback;
}

export interface BranchForSelection {
  id: string;
  name: string;
  code: string;
  tenantId?: string | null;
}

export type AppRouterForAuth = {
  push: (href: string) => void;
};

export type CompleteSessionRoutingParams = {
  router: AppRouterForAuth;
  setError: (message: string | null) => void;
  setLoading?: (loading: boolean) => void;
  setPrimaryColor?: (color: string) => void;
  onMultiBranch: (branches: BranchForSelection[]) => void;
};

export async function selectBranchAndGoDashboard(
  branchId: string,
  router: AppRouterForAuth,
  setPrimaryColor?: (color: string) => void,
): Promise<void> {
  await apiClient.post('/api/v1/auth/select-branch', { branchId });
  localStorage.setItem('currentBranchId', branchId);

  try {
    const tenantResponse = await apiClient.get<Tenant>('/api/v1/tenants/me');
    const tenantTheme = tenantResponse.data?.primaryColor;
    if (tenantTheme && setPrimaryColor) {
      setPrimaryColor(tenantTheme);
    }
  } catch {
    // Non-blocking: dashboard will still bootstrap theme via AuthGuard/Header
  }

  router.push('/dashboard');
}

/**
 * After Supabase session exists (sign-in or OAuth), sync locale, route by role, and handle branch selection.
 */
export async function completeSessionRouting(params: CompleteSessionRoutingParams): Promise<void> {
  const { router, setError, setLoading, setPrimaryColor, onMultiBranch } = params;

  try {
    const userResponse = await apiClient.get<{
      preferredLocale?: string;
      preferred_locale?: string;
      roles?: Array<{ roleName?: string }>;
      branches?: BranchForSelection[];
    }>('/api/v1/auth/me');

    const userData = userResponse.data ?? {};

    const rawPreferred =
      userData.preferredLocale ??
      (userData as { preferred_locale?: string }).preferred_locale ??
      'en-US';
    const locale = normalizeUiLocale(rawPreferred);
    setUiLocaleCookieOnDocument(locale);
    try {
      localStorage.setItem('locale', locale);
    } catch {
      // Non-blocking
    }

    const roles = userData.roles ?? [];
    const normalisedRoleNames = roles
      .map((r) => r.roleName?.toLowerCase())
      .filter((name): name is string => !!name);

    const isSuperAdmin = normalisedRoleNames.includes('super_admin');
    if (isSuperAdmin) {
      router.push('/adminportal');
      setLoading?.(false);
      return;
    }

    const isSchoolAdmin = normalisedRoleNames.includes('school_admin');

    if (!isSchoolAdmin) {
      router.push('/dashboard');
      setLoading?.(false);
      return;
    }
    const userBranches = (userData.branches || []) as BranchForSelection[];

    if (userBranches.length === 0) {
      setError('No branches assigned to your account. Please contact your administrator.');
      setLoading?.(false);
      return;
    }

    if (userBranches.length === 1) {
      await selectBranchAndGoDashboard(userBranches[0].id, router, setPrimaryColor);
      setLoading?.(false);
      return;
    }

    onMultiBranch(Array.from(new Map(userBranches.map((b) => [b.id, b])).values()));
    setLoading?.(false);
    return;
  } catch (branchError: unknown) {
    const err = branchError as {
      response?: { status?: number; data?: { error?: { message?: string }; message?: string } };
      message?: string;
    };
    if (err.response?.status === 403) {
      try {
        await clearLocalSupabaseSession();
      } catch {
        // ignore
      }
      setError(formatApiErrorBodyMessage(err.response?.data, 'Access denied.'));
      setLoading?.(false);
      return;
    }
    const status = err.response?.status;
    const message =
      err.response?.data?.error?.message ||
      err.response?.data?.message ||
      err.message ||
      '';
    const msg = typeof message === 'string' ? message.toLowerCase() : '';

    if (status === 404 || msg.includes('user not found')) {
      router.push('/signup?google=not_found');
      setLoading?.(false);
      return;
    }

    console.error('Failed to fetch user session context:', branchError);
    setError('Failed to complete login. Please try again.');
    setLoading?.(false);
  }
}
