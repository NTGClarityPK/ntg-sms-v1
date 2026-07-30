import { apiClient } from '@/lib/api-client';
import type { Tenant } from '@/types/tenant';
import { clearLocalSupabaseSession } from '@/lib/auth';
import {
  normalizeUiLocale,
  readResolvedUiLocaleFromBrowser,
  setUiLocaleCookieOnDocument,
} from '@/lib/ui-locale';
import { queryClient } from '@/lib/query-client';
import { useAuthStore } from '@/lib/store/auth-store';
import type { User } from '@/types/auth';

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
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('currentBranchId', branchId);
  }

  // Keep Zustand + React Query in sync with the selected branch.
  // Without this, useAuth rewrites localStorage from a stale `user.currentBranch`
  // (often Main) left over from the pre-modal /auth/me response.
  useAuthStore.getState().setBranchId(branchId);
  const cachedUser =
    queryClient.getQueryData<User>(['auth', 'me']) ?? useAuthStore.getState().user;
  if (cachedUser) {
    const selectedBranch =
      (cachedUser.branches || []).find((b) => b.id === branchId) ??
      (cachedUser.currentBranch?.id === branchId ? cachedUser.currentBranch : null) ??
      ({ id: branchId, name: 'Selected branch' } satisfies NonNullable<User['currentBranch']>);
    const updatedUser: User = {
      ...cachedUser,
      currentBranch: selectedBranch,
    };
    useAuthStore.getState().setUser(updatedUser);
    queryClient.setQueryData<User>(['auth', 'me'], updatedUser);
  }

  // Navigate ASAP; do not block on cache-warming/theme.
  pushPortalRoute(router, '/dashboard');

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
    const userResponse = await apiClient.get<User>('/api/v1/auth/me');

    const userData = userResponse.data ?? {};

    // Persist immediately so guards/dashboard can render without waiting for React Query refetch.
    useAuthStore.getState().setUser(userData);

    // Cookie is the source of truth for UI locale.
    // Only use DB preference as an initial default when the cookie is absent (first-time device / cleared cookies).
    if (typeof window !== 'undefined') {
      const existing = readResolvedUiLocaleFromBrowser();
      if (!existing) {
        const rawPreferred =
          userData.preferredLocale ??
          (userData as { preferred_locale?: string }).preferred_locale ??
          'en-US';
        setUiLocaleCookieOnDocument(normalizeUiLocale(rawPreferred));
      }
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
        // Update local caches instead of evicting (eviction forces a slow refetch during redirect).
        useAuthStore.getState().setBranchId(desiredBranchId);
        queryClient.setQueryData<User>(['auth', 'me'], {
          ...userData,
          currentBranch:
            userBranches.find((b) => b.id === desiredBranchId) ?? userData.currentBranch ?? null,
        });
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
