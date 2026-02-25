import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = cookieStore.get('NEXT_LOCALE')?.value ?? 'ar';

  const [common, auth, students, navigation, dashboard] = await Promise.all([
    import(`../../messages/${locale}/common.json`).then((m) => m.default as Record<string, unknown>),
    import(`../../messages/${locale}/auth.json`).then((m) => m.default as Record<string, unknown>),
    import(`../../messages/${locale}/students.json`).then((m) => m.default as Record<string, unknown>),
    import(`../../messages/${locale}/navigation.json`).then((m) => m.default as Record<string, unknown>),
    import(`../../messages/${locale}/dashboard.json`).then((m) => m.default as Record<string, unknown>),
  ]);

  return {
    locale,
    messages: { common, auth, students, navigation, dashboard },
  };
});
