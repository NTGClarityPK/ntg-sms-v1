import { apiClient } from '@/lib/api-client';
import { queryClient } from '@/lib/query-client';
import { normalizeUiLocale } from '@/lib/ui-locale';

/**
 * Keep `profiles.preferred_locale` aligned with the active `NEXT_LOCALE` cookie (cookie wins for SSR).
 * Called after `/auth/me` so login/OAuth/new-tab flows do not leave DB and cookie out of sync.
 */
export async function syncProfilePreferredLocaleWithCookie(params: {
  cookieNorm: string | null;
  profilePreferredRaw: string | null | undefined;
}): Promise<void> {
  const { cookieNorm, profilePreferredRaw } = params;
  if (cookieNorm == null) return;

  const profileNorm = normalizeUiLocale(profilePreferredRaw ?? 'en-US');
  if (profileNorm === cookieNorm) return;

  try {
    await apiClient.patch('/api/v1/users/me/preferences', {
      preferred_locale: cookieNorm,
    });
    await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
  } catch {
    // Non-blocking: cookie still drives UI until the next successful save
  }
}
