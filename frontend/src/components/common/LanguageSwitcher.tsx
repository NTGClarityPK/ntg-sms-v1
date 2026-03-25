'use client';

import { useRouter } from 'next/navigation';
import { Menu, Button, Stack, Text } from '@mantine/core';
import { IconLanguage, IconCheck } from '@tabler/icons-react';
import { useLocale } from 'next-intl';
import { useMediaQuery } from '@mantine/hooks';
import { useMantineTheme } from '@mantine/core';
import { apiClient } from '@/lib/api-client';
import { DEFAULT_THEME_COLOR } from '@/lib/utils/theme';
const LOCALE_COOKIE = 'NEXT_LOCALE';
const COOKIE_MAX_AGE = 31536000; // 1 year

const LANGUAGES = [
  { code: 'en-US', nativeName: 'English (US)', name: 'English (US)' },
  { code: 'en-GB', nativeName: 'English (UK)', name: 'English (UK)' },
  { code: 'ar', nativeName: 'العربية', name: 'Arabic' },
];

function setLocaleCookie(locale: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function LanguageSwitcher() {
  const router = useRouter();
  const locale = useLocale();
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);

  // Backward compatibility: older profiles/cookies may still store `en`.
  const normalizedLocale = locale === 'en' ? 'en-US' : locale;
  const currentLanguage =
    LANGUAGES.find((l) => l.code === normalizedLocale) ?? LANGUAGES[0];

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
    <Menu
      shadow="md"
      width={isMobile ? 160 : 200}
      position={isMobile ? 'bottom' : 'bottom-end'}
      zIndex={2000}
    >
      <Menu.Target>
        {isMobile ? (
          <Button
            size="sm"
            px="xs"
            aria-label="Change language"
            style={{
              backgroundColor: DEFAULT_THEME_COLOR,
              color: 'white',
            }}
          >
            <IconLanguage size={16} />
          </Button>
        ) : (
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
        )}
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>Select Language</Menu.Label>
        {LANGUAGES.map((lang) => (
          <Menu.Item
            key={lang.code}
            leftSection={
              <IconCheck
                size={16}
                style={{ visibility: normalizedLocale === lang.code ? 'visible' : 'hidden' }}
              />
            }
            onClick={() => handleChange(lang.code)}
            style={{ fontWeight: normalizedLocale === lang.code ? 600 : 400 }}
          >
            <Stack gap={2}>
              <Text size="sm" fw={normalizedLocale === lang.code ? 600 : 400}>
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
