import { supabase } from './supabase/client';
import { queryClient } from '@/lib/query-client';
import {
  getUiLocaleCookieFromDocument,
  normalizeUiLocale,
  setUiLocaleCookieOnDocument,
} from './ui-locale';

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
  // Use local sign-out so refresh tokens remain valid for PIN-based login.
  // This clears auth state from this browser without revoking tokens server-side.
  const { error } = await supabase.auth.signOut({ scope: 'local' });

  if (error) {
    throw error;
  }

  if (typeof window !== 'undefined') {
    // Prevent stale `auth/me` (and branch-gated queries) from keeping the dashboard on skeletons after re-login.
    // A hard refresh clears caches; we do it explicitly here so normal login works first time.
    queryClient.removeQueries({ queryKey: ['auth'] });
    queryClient.removeQueries({ queryKey: ['permissions'] });
    queryClient.removeQueries({ queryKey: ['settingsStatus'] });

    // Keep the currently active language on the login screen.
    // Do NOT overwrite NEXT_LOCALE from potentially-stale localStorage during logout.
    syncLocaleCookieFromStorage();
    clearAuthClientState();
    window.location.href = '/login';
  }
}

/** Clear Supabase session in this browser only; does not redirect (for login flows that must show an error first). */
export async function clearLocalSupabaseSession(): Promise<void> {
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
