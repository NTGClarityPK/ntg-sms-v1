import { apiClient } from '@/lib/api-client';
import type { Tenant } from '@/types/tenant';
import { clearLocalSupabaseSession } from '@/lib/auth';
import { normalizeUiLocale, setUiLocaleCookieOnDocument } from '@/lib/ui-locale';
import { queryClient } from '@/lib/query-client';

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
  /** Next.js App Router — refresh server component payload for the active route after auth/session changes. */
  refresh?: () => void;
};

/**
 * Client navigation followed by a deferred `refresh()` so the navigated route picks up updated RSC/cookies.
 * `refresh()` targets the **current** route after `push` has applied.
 */
function pushPortalRoute(router: AppRouterForAuth, href: string): void {
  router.push(href);
  if (typeof window === 'undefined') return;
  window.setTimeout(() => {
    router.refresh?.();
  }, 0);
}

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

  // Navigate ASAP; do not block on cache-warming/theme.
  pushPortalRoute(router, '/dashboard');

  // Background: warm the auth cache so dashboard renders with branch context quickly.
  // Never block navigation for this.
  void (async () => {
    try {
      const me = await apiClient.get<{
        id: string;
        currentBranch?: { id: string } | null;
      }>('/api/v1/auth/me');
      queryClient.setQueryData(['auth', 'me'], me.data);
    } catch {
      // If warmup fails, let dashboard refetch normally.
    }
  })();

  // Theme fetch is intentionally NOT done here (login critical path).
  // Portal layout/components handle tenant theme bootstrap.
  void setPrimaryColor;
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
      currentBranch?: BranchForSelection | null;
    }>('/api/v1/auth/me');

    const userData = userResponse.data ?? {};

    // DB is the single source of truth: align NEXT_LOCALE cookie before any navigation/refresh.
    if (typeof window !== 'undefined') {
      const rawPreferred =
        userData.preferredLocale ??
        (userData as { preferred_locale?: string }).preferred_locale ??
        'en-US';
      setUiLocaleCookieOnDocument(normalizeUiLocale(rawPreferred));
    }

    const roles = userData.roles ?? [];
    const normalisedRoleNames = roles
      .map((r) => r.roleName?.toLowerCase())
      .filter((name): name is string => !!name);

    const isSuperAdmin = normalisedRoleNames.includes('super_admin');
    if (isSuperAdmin) {
      pushPortalRoute(router, '/adminportal');
      setLoading?.(false);
      return;
    }

    const isSchoolAdmin = normalisedRoleNames.includes('school_admin');

    // IMPORTANT: Portal routes assume a branch exists (many queries are branch-gated).
    // Ensure a branch is selected before navigating to /dashboard for any non-super-admin user.
    const userBranches = (userData.branches || []) as BranchForSelection[];
    if (userBranches.length === 0) {
      setError('No branches assigned to your account. Please contact your administrator.');
      setLoading?.(false);
      return;
    }

    // Performance: school admins with multiple branches should see the branch modal immediately.
    // Do NOT pre-select a branch here (it adds a blocking network call and delays the modal).
    if (isSchoolAdmin && userBranches.length > 1) {
      onMultiBranch(Array.from(new Map(userBranches.map((b) => [b.id, b])).values()));
      setLoading?.(false);
      return;
    }

    const branchHint = typeof window !== 'undefined' ? window.localStorage.getItem('currentBranchId') : null;
    const desiredBranchId =
      userData.currentBranch?.id ??
      (branchHint && branchHint.trim() !== '' ? branchHint : null) ??
      userBranches[0]?.id ??
      null;

    if (desiredBranchId) {
      try {
        await apiClient.post('/api/v1/auth/select-branch', { branchId: desiredBranchId });
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('currentBranchId', desiredBranchId);
        }
        // Ensure the dashboard doesn't mount with a cached `auth/me` missing currentBranch.
        queryClient.removeQueries({ queryKey: ['auth', 'me'] });
      } catch {
        // Non-blocking: user may still be able to continue (e.g. header branch picker).
      }
    }

    if (!isSchoolAdmin) {
      pushPortalRoute(router, '/dashboard');
      setLoading?.(false);
      return;
    }

    if (userBranches.length === 1) {
      await selectBranchAndGoDashboard(userBranches[0].id, router, setPrimaryColor);
      setLoading?.(false);
      return;
    }
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
