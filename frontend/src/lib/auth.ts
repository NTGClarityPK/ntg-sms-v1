import { supabase } from './supabase/client';

const LOCALE_COOKIE = 'NEXT_LOCALE';
const LOCALE_COOKIE_MAX_AGE = 31536000; // 1 year
const SUPPORTED_LOCALES = new Set(['en', 'en-US', 'en-GB', 'ar']);

function setLocaleCookie(locale: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`;
}

function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const parts = document.cookie.split(';').map((p) => p.trim());
  const found = parts.find((p) => p.startsWith(`${name}=`));
  if (!found) return null;
  return found.substring(name.length + 1) || null;
}

function normaliseLocale(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  if (SUPPORTED_LOCALES.has(value)) return value;
  // Backward compatibility: some older places may store `en` or other variants.
  if (value.toLowerCase() === 'en') return 'en';
  if (value.toLowerCase() === 'ar') return 'ar';
  return null;
}

export function syncLocaleCookieFromStorage(): void {
  if (typeof window === 'undefined') return;
  // Prefer the cookie (server source-of-truth). Only fall back to localStorage when cookie is missing.
  const cookieLocale = normaliseLocale(getCookieValue(LOCALE_COOKIE));
  const storedLocale = normaliseLocale(window.localStorage.getItem('locale'));

  if (cookieLocale) {
    if (storedLocale !== cookieLocale) {
      try {
        window.localStorage.setItem('locale', cookieLocale);
      } catch {
        // Non-blocking
      }
    }
    return;
  }

  if (storedLocale) {
    setLocaleCookie(storedLocale);
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

