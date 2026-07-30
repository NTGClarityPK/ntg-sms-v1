import { useEffect } from 'react';
import {
  reconcileUiLocaleCookie,
  resolveEffectiveLocale,
  SYSTEM_DEFAULT_LOCALE,
} from '@/lib/ui-locale';
import type { User } from '@/types/auth';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

function getUserPreferredLocaleRaw(user: User): string | null | undefined {
  if (user.preferredLocale === null) return null;
  if (typeof user.preferredLocale === 'string' && user.preferredLocale.trim()) {
    return user.preferredLocale;
  }
  const legacy = (user as unknown as { preferred_locale?: unknown }).preferred_locale;
  if (legacy === null) return null;
  return typeof legacy === 'string' && legacy.trim() ? legacy : undefined;
}

/**
 * Keep the UI cookie aligned with the server-resolved effective locale.
 * Reconciles on login and when auth user / branch tenant changes.
 */
export function useLocaleSync(): void {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user || typeof window === 'undefined') return;

    const effective =
      user.effectiveLocale ??
      resolveEffectiveLocale(
        getUserPreferredLocaleRaw(user),
        user.tenantDefaultLocale ??
          user.currentBranch?.tenantDefaultLocale ??
          SYSTEM_DEFAULT_LOCALE,
      );

    const changed = reconcileUiLocaleCookie(effective);
    if (changed) {
      router.refresh();
    }
  }, [
    user?.id,
    user?.preferredLocale,
    user?.tenantDefaultLocale,
    user?.effectiveLocale,
    user?.currentBranch?.id,
    user?.currentBranch?.tenantDefaultLocale,
    router,
  ]);
}
