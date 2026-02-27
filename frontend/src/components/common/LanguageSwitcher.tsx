'use client';

import { useRouter } from 'next/navigation';
import { Menu, Button, Stack, Text } from '@mantine/core';
import { IconLanguage, IconCheck } from '@tabler/icons-react';
import { useLocale } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import { DEFAULT_THEME_COLOR } from '@/lib/utils/theme';
const LOCALE_COOKIE = 'NEXT_LOCALE';
const COOKIE_MAX_AGE = 31536000; // 1 year

const LANGUAGES = [
  { code: 'en', nativeName: 'English', name: 'English' },
  { code: 'ar', nativeName: 'العربية', name: 'Arabic' },
];

function setLocaleCookie(locale: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function LanguageSwitcher() {
  const router = useRouter();
  const locale = useLocale();

  const currentLanguage = LANGUAGES.find((l) => l.code === locale) ?? LANGUAGES[0];

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
    <Menu shadow="md" width={200} position="bottom-end" zIndex={2000}>
      <Menu.Target>
        <Button
          leftSection={<IconLanguage size={16} />}
          size="sm"
          style={{
            backgroundColor: DEFAULT_THEME_COLOR,
            color: 'white',
          }}
        >
          {currentLanguage.nativeName}
        </Button>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>Select Language</Menu.Label>
        {LANGUAGES.map((lang) => (
          <Menu.Item
            key={lang.code}
            leftSection={
              <IconCheck
                size={16}
                style={{ visibility: locale === lang.code ? 'visible' : 'hidden' }}
              />
            }
            onClick={() => handleChange(lang.code)}
            style={{ fontWeight: locale === lang.code ? 600 : 400 }}
          >
            <Stack gap={2}>
              <Text size="sm" fw={locale === lang.code ? 600 : 400}>
                {lang.nativeName}
              </Text>
              <Text size="xs" c="dimmed">
                {lang.name}
              </Text>
            </Stack>
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
