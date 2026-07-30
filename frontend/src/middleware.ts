import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
  normalizedUiLocaleFromCookieJarEntry,
  resolveUiLocaleForRequest,
  UI_LOCALE_COOKIE,
  UI_LOCALE_COOKIE_MAX_AGE,
} from '@/lib/ui-locale';

export async function middleware(request: NextRequest) {
  // Let Next.js serve every route; locale is read from NEXT_LOCALE cookie in i18n/request.ts
  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  // Self-heal: if multiple/invalid locale cookies exist, rewrite one canonical cookie.
  // This prevents non-deterministic locale selection on refresh.
  try {
    const cookieHeaderStr = request.headers.get('cookie');
    const all = request.cookies.getAll(UI_LOCALE_COOKIE).map((c) => c.value);
    if (all.length > 0) {
      const normalized = resolveUiLocaleForRequest({
        cookieHeader: cookieHeaderStr,
        cookieJarValues: all,
      });
      const hasDuplicates = all.length > 1;
      const differsFromCanonical = all.some(
        (v) => normalizedUiLocaleFromCookieJarEntry(v) !== normalized,
      );
      if (hasDuplicates || differsFromCanonical) {
        response.cookies.set(UI_LOCALE_COOKIE, normalized, {
          path: '/',
          maxAge: UI_LOCALE_COOKIE_MAX_AGE,
          sameSite: 'lax',
        });
      }
    }
  } catch {
    // Non-blocking
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          request.cookies.set({ name, value, ...options });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: Record<string, unknown>) {
          request.cookies.set({ name, value: '', ...options });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    },
  );

  // Only hit Supabase Auth when a session cookie exists (anonymous landing/marketing
  // traffic must not call getUser on every navigation — Nano-safe).
  const hasSupabaseSessionCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith('sb-') && c.name.includes('auth-token'));
  if (hasSupabaseSessionCookie) {
    await supabase.auth.getUser();
  }

  return response;
}

export const config = {
  matcher: [
    // Run middleware for app routes only; exclude static assets so they are served from public/ or _next/
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|workbox-.*\\.js|manifest\\.json|worker-.*\\.js|\\.well-known|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|map)$).*)',
  ],
};
