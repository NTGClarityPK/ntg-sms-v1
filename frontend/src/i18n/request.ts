import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { resolveUiLocaleForRequest, UI_LOCALE_COOKIE } from '@/lib/ui-locale';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const cookieHeader = headerStore.get('cookie');
  const localeValues = cookieStore.getAll(UI_LOCALE_COOKIE).map((c) => c.value);
  const locale = resolveUiLocaleForRequest({
    cookieHeader,
    cookieJarValues: localeValues,
  });

  const loadLocaleMessages = async (requestedLocale: string) => {
    try {
      const mod = await import(`../../messages/${requestedLocale}.json`);
      return mod.default as Record<string, unknown>;
    } catch {
      return null;
    }
  };

  const messages = (await loadLocaleMessages(locale)) ?? (await loadLocaleMessages('en')) ?? {};

  return {
    locale,
    messages,
  };
});
