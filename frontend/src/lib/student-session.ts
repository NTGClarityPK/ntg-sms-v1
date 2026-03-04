/**
 * Thin wrappers around the Zustand student-session store.
 * Use the store hook (useStudentSessionStore) in React components for reactivity.
 * Use these helpers in non-component code (api-client, etc.).
 */

const STUDENT_TOKEN_KEY = 'studentToken';

export function setStudentToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (!token) {
    window.localStorage.removeItem(STUDENT_TOKEN_KEY);
  } else {
    window.localStorage.setItem(STUDENT_TOKEN_KEY, token);
  }
  // Sync the Zustand store so React components re-render immediately
  import('./store/student-session-store').then(({ useStudentSessionStore }) => {
    if (!token) {
      useStudentSessionStore.getState().clearStudentToken();
    } else {
      useStudentSessionStore.getState().setStudentToken(token);
    }
  });
}

export function getStudentToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(STUDENT_TOKEN_KEY);
}

export function clearStudentToken(): void {
  setStudentToken(null);
}
