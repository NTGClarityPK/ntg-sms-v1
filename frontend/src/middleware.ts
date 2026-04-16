import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
  normalizeUiLocale,
  resolveLocaleFromCookieHeader,
  resolveLocaleFromServerCookieValues,
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
    const all = request.cookies.getAll(UI_LOCALE_COOKIE).map((c) => c.value);
    if (all.length > 0) {
      const resolved =
        resolveLocaleFromCookieHeader(request.headers.get('cookie')) ??
        resolveLocaleFromServerCookieValues(all);
      const hasDuplicates = all.length > 1;
      const anyInvalid = all.some((v) => normalizeUiLocale(v) !== v.trim());
      if (hasDuplicates || anyInvalid) {
        response.cookies.set(UI_LOCALE_COOKIE, resolved, {
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

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // Run middleware for app routes only; exclude static assets so they are served from public/ or _next/
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|workbox-.*\\.js|manifest\\.json|worker-.*\\.js|\\.well-known|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|map)$).*)',
  ],
};
