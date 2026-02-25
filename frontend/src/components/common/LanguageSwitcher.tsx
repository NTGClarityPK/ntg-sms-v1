'use client';

import { useRouter } from 'next/navigation';
import { SegmentedControl } from '@mantine/core';
import { useLocale } from 'next-intl';
import { apiClient } from '@/lib/api-client';

const LOCALE_COOKIE = 'NEXT_LOCALE';
const COOKIE_MAX_AGE = 31536000; // 1 year

function setLocaleCookie(locale: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function LanguageSwitcher() {
  const router = useRouter();
  const locale = useLocale();

  const handleChange = async (value: string) => {
    setLocaleCookie(value);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('locale', value);
    }
    try {
      await apiClient.patch('/api/v1/users/me/preferences', {
        preferred_locale: value,
      });
      router.refresh();
    } catch {
      // Not logged in or API failed: full reload so server layout sees new cookie
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }
  };

  return (
    <SegmentedControl
      id="language-switcher"
      value={locale}
      onChange={handleChange}
      data={[
        { value: 'en', label: 'English' },
        { value: 'ar', label: 'العربية' },
      ]}
      size="sm"
    />
  );
}
