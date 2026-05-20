/**
 * Public / unauthenticated routes where portal-wide theme injection must not apply.
 * Keep in sync with ThemeWrapper auth handling in `app/providers.tsx`.
 */
export function isAuthPathname(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return (
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/select-child') ||
    pathname.startsWith('/auth/')
  );
}
