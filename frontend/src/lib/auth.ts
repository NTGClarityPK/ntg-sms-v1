import { supabase } from './supabase/client';
import { queryClient } from '@/lib/query-client';
import {
  getUiLocaleCookieFromDocument,
  normalizeUiLocale,
  setUiLocaleCookieOnDocument,
} from './ui-locale';

const LOGOUT_IN_PROGRESS_KEY = 'ntg_logout_in_progress';

export function isLogoutInProgress(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(LOGOUT_IN_PROGRESS_KEY) === '1';
  } catch {
    return false;
  }
}

function setLogoutInProgress(value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (value) {
      window.sessionStorage.setItem(LOGOUT_IN_PROGRESS_KEY, '1');
    } else {
      window.sessionStorage.removeItem(LOGOUT_IN_PROGRESS_KEY);
    }
  } catch {
    // Non-blocking
  }
}

/** Clears the logout-in-progress flag (call when the login screen mounts). */
export function clearLogoutInProgress(): void {
  setLogoutInProgress(false);
}

export function syncLocaleCookieFromStorage(): void {
  if (typeof window === 'undefined') return;

  const cookieRaw = getUiLocaleCookieFromDocument();
  if (cookieRaw != null && cookieRaw.trim() !== '') {
    const normalized = normalizeUiLocale(cookieRaw);
    if (normalized !== cookieRaw.trim()) {
      setUiLocaleCookieOnDocument(normalized);
    }
  }

  // Locale is stored in the NEXT_LOCALE cookie only.
  // We intentionally do not read/write locale from localStorage because it can get stale and
  // cause non-deterministic language flips on refresh.
  try {
    window.localStorage.removeItem('locale');
  } catch {
    // Non-blocking
  }

  // Ensure a sane default exists for server rendering when cookie is missing.
  if (cookieRaw == null || cookieRaw.trim() === '') {
    setUiLocaleCookieOnDocument('en-US');
  }
}

function clearAuthClientState(): void {
  if (typeof window === 'undefined') return;
  try {
    // Prevent stale branch/student-mode state from leaking into login screen.
    window.localStorage.removeItem('currentBranchId');
    window.localStorage.removeItem('studentToken');

    // Prevent showing an old "inactive/deactivated" flash on logout.
    window.sessionStorage.removeItem('ntg_auth_inactive_message');
  } catch {
    // Non-blocking: storage can throw in some privacy modes.
  }
}

export async function signIn(email: string, password: string) {
  setLogoutInProgress(false);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function signOut() {
  setLogoutInProgress(true);

  // Use local sign-out so refresh tokens remain valid for PIN-based login.
  // This clears auth state from this browser without revoking tokens server-side.
  const { error } = await supabase.auth.signOut({ scope: 'local' });

  if (error) {
    setLogoutInProgress(false);
    throw error;
  }

  if (typeof window !== 'undefined') {
    // Prevent stale `auth/me` (and branch-gated queries) from keeping the dashboard on skeletons after re-login.
    queryClient.removeQueries({ queryKey: ['auth'] });
    queryClient.removeQueries({ queryKey: ['permissions'] });
    queryClient.removeQueries({ queryKey: ['settingsStatus'] });

    // Keep the currently active language on the login screen.
    syncLocaleCookieFromStorage();
    clearAuthClientState();

    // Redirect immediately — do not await SW/cache cleanup (that delay left portal pages blank).
    window.location.replace('/login');

    // Best-effort cleanup after navigation starts; AuthRouteServiceWorkerCleanup also runs on /login.
    void (async () => {
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
      } catch {
        // Non-blocking
      }
      try {
        if ('caches' in window) {
          const names = await caches.keys();
          await Promise.all(names.map((n) => caches.delete(n)));
        }
      } catch {
        // Non-blocking
      }
    })();
  }
}

/** Clear Supabase session in this browser only; does not redirect (for login flows that must show an error first). */
export async function clearLocalSupabaseSession(): Promise<void> {
  setLogoutInProgress(true);
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) {
    throw error;
  }
  syncLocaleCookieFromStorage();
  clearAuthClientState();
}

export async function getSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * Supabase can briefly return `null` session immediately after redirects (OAuth) or on first mount.
 * This helper makes guards resilient without forcing a full refresh.
 */
export async function getSessionWithRetry(input?: {
  attempts?: number;
  delayMs?: number;
}) {
  const attempts = Math.max(1, input?.attempts ?? 10);
  const delayMs = Math.max(0, input?.delayMs ?? 100);

  for (let i = 0; i < attempts; i++) {
    const session = await getSession();
    if (session?.access_token) return session;
    if (i < attempts - 1) await sleep(delayMs);
  }

  return null;
}

export async function resetPasswordForEmail(email: string) {
  const normalized = email.normalize('NFKC').trim().toLowerCase();
  const { data, error } = await supabase.auth.resetPasswordForEmail(normalized, {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function updatePassword(newPassword: string) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    throw error;
  }

  return data;
}
