'use client';

import { ActionIcon, Tooltip, useMantineTheme } from '@mantine/core';
import { IconMoon, IconSun } from '@tabler/icons-react';
import { useMediaQuery } from '@mantine/hooks';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/hooks/use-theme';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

/**
 * Compact light/dark toggle for the portal header.
 * Preference is persisted via useTheme / localStorage.
 */
export function ThemeModeToggle() {
  const t = useTranslations('common');
  const { isDark, toggleTheme, mounted } = useTheme();
  const colors = useThemeColors();
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);

  const label = isDark ? t('switchToLightMode') : t('switchToDarkMode');

  return (
    <Tooltip label={label} position="bottom" withArrow disabled={!mounted}>
      <ActionIcon
        id="header-theme-mode-toggle"
        variant="light"
        color={colors.primary}
        size={isMobile ? 'md' : 'lg'}
        radius="md"
        onClick={toggleTheme}
        aria-label={label}
        aria-pressed={isDark}
      >
        {isDark ? <IconSun size={18} stroke={1.75} /> : <IconMoon size={18} stroke={1.75} />}
      </ActionIcon>
    </Tooltip>
  );
}
