import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = cookieStore.get('NEXT_LOCALE')?.value ?? 'en';

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
