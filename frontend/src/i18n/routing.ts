import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'en-US', 'en-GB', 'ar'],
  defaultLocale: 'en-GB',
  localePrefix: 'never',
});
