'use client';

import { useRouter } from 'next/navigation';
import { Menu, Button, Stack, Text } from '@mantine/core';
import { IconLanguage, IconCheck } from '@tabler/icons-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMediaQuery } from '@mantine/hooks';
import { useMantineTheme } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { DEFAULT_THEME_COLOR } from '@/lib/utils/theme';
import { supabase } from '@/lib/supabase/client';
import {
  normalizeUiLocale,
  reconcileUiLocaleCookie,
  resolveEffectiveLocale,
  setUiLocaleCookieOnDocument,
  SYSTEM_DEFAULT_LOCALE,
} from '@/lib/ui-locale';
import { useAuth } from '@/hooks/useAuth';

const LANGUAGES = [
  { code: 'en-US', nativeName: 'English (US)', nameKey: 'languageEnglishUs' as const },
  { code: 'en-GB', nativeName: 'English (UK)', nameKey: 'languageEnglishUk' as const },
  { code: 'ar', nativeName: 'العربية', nameKey: 'languageArabic' as const },
];

export function LanguageSwitcher() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('common');
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const hasPersonalOverride =
    typeof user?.preferredLocale === 'string' && user.preferredLocale.trim() !== '';
  const schoolDefault = normalizeUiLocale(
    user?.tenantDefaultLocale ?? SYSTEM_DEFAULT_LOCALE,
  );

  // Backward compatibility: older profiles/cookies may still store `en`.
  const normalizedLocale = locale === 'en' ? SYSTEM_DEFAULT_LOCALE : locale;
  const currentLanguage =
    LANGUAGES.find((l) => l.code === normalizedLocale) ?? LANGUAGES[1];

  const applyLocale = async (next: string | null) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        const cookieLocale = next ?? SYSTEM_DEFAULT_LOCALE;
        setUiLocaleCookieOnDocument(cookieLocale);
        router.refresh();
        return;
      }

      await apiClient.patch('/api/v1/users/me/preferences', {
        preferred_locale: next,
      });

      const effective = resolveEffectiveLocale(
        next,
        user?.tenantDefaultLocale ?? schoolDefault,
      );
      reconcileUiLocaleCookie(effective);
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      router.refresh();
    } catch {
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }
  };

  return (
    <Menu
      shadow="md"
      width={isMobile ? 180 : 220}
      position={isMobile ? 'bottom' : 'bottom-end'}
      zIndex={2000}
    >
      <Menu.Target>
        {isMobile ? (
          <Button
            id="language-switcher-trigger"
            size="sm"
            px="xs"
            aria-label={t('changeLanguage')}
            style={{
              backgroundColor: DEFAULT_THEME_COLOR,
              color: 'white',
            }}
          >
            <IconLanguage size={16} />
          </Button>
        ) : (
          <Button
            id="language-switcher-trigger"
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
        <Menu.Label>{t('selectLanguage')}</Menu.Label>
        <Menu.Item
          id="language-option-school-default"
          leftSection={
            <IconCheck
              size={16}
              style={{ visibility: !hasPersonalOverride ? 'visible' : 'hidden' }}
            />
          }
          onClick={() => applyLocale(null)}
          style={{ fontWeight: !hasPersonalOverride ? 600 : 400 }}
        >
          <Stack gap={2}>
            <Text size="sm" fw={!hasPersonalOverride ? 600 : 400}>
              {t('useSchoolDefault')}
            </Text>
            <Text size="xs" c="dimmed">
              {t('useSchoolDefaultHint', {
                language:
                  LANGUAGES.find((l) => l.code === schoolDefault)?.nativeName ?? schoolDefault,
              })}
            </Text>
          </Stack>
        </Menu.Item>
        {LANGUAGES.map((lang) => {
          const selected = hasPersonalOverride && normalizedLocale === lang.code;
          return (
            <Menu.Item
              id={`language-option-${lang.code}`}
              key={lang.code}
              leftSection={
                <IconCheck
                  size={16}
                  style={{ visibility: selected ? 'visible' : 'hidden' }}
                />
              }
              onClick={() => applyLocale(lang.code)}
              style={{ fontWeight: selected ? 600 : 400 }}
            >
              <Stack gap={2}>
                <Text size="sm" fw={selected ? 600 : 400}>
                  {lang.nativeName}
                </Text>
                <Text size="xs" c="dimmed">
                  {t(lang.nameKey)}
                </Text>
              </Stack>
            </Menu.Item>
          );
        })}
      </Menu.Dropdown>
    </Menu>
  );
}
