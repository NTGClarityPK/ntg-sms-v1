import { supabase } from './supabase/client';

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
    window.location.href = '/login';
  }
}

/** Clear Supabase session in this browser only; does not redirect (for login flows that must show an error first). */
export async function clearLocalSupabaseSession(): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) {
    throw error;
  }
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

