'use client';

import { useEffect, useState } from 'react';
import { Group, Badge, Tooltip, Box, Image, Text, Stack, useMantineTheme, useMantineColorScheme } from '@mantine/core';
import { IconCircle, IconCrown } from '@tabler/icons-react';
import Link from 'next/link';
import { UserMenu } from './UserMenu';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import type { ThemeConfig } from '@/lib/theme/themeConfig';
import { useAuth } from '@/hooks/useAuth';

const headerBadgeStyle = {
  cursor: 'default' as const,
  fontWeight: 500,
  height: '28px',
  display: 'flex' as const,
  alignItems: 'center' as const,
  padding: '0 10px',
};

export function AdminHeader() {
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const themeConfig = (theme.other ?? {}) as ThemeConfig | undefined;
  const onlineBadgeColor = themeConfig?.components?.statusOnline?.badgeColor ?? '#22c55e';
  const offlineBadgeColor = themeConfig?.components?.statusOffline?.badgeColor ?? '#868e96';

  const [isOnline, setIsOnline] = useState<boolean>(true);
  const { user } = useAuth();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateStatus = () => {
      setIsOnline(window.navigator.onLine);
    };

    updateStatus();
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  return (
    <Group justify="space-between" style={{ flex: 1 }}>
      <Stack gap={4}>
        <Text fw={700} size="lg" style={{ lineHeight: 1 }}>
          School Management System
        </Text>
        <Badge
          variant="filled"
          color="red"
          size="sm"
          style={{
            fontWeight: 700,
            width: 'fit-content',
          }}
        >
          FULL CONTROL
        </Badge>
      </Stack>

      <Group gap="md" align="center">
        <LanguageSwitcher />
        {/* Super Admin Badge */}
        <Badge
          variant="filled"
          color="yellow"
          size="lg"
          leftSection={<IconCrown size={14} />}
          style={{
            cursor: 'default',
            fontWeight: 700,
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
            color: '#000',
            border: '1px solid #FFD700',
          }}
        >
          SUPER USER
        </Badge>

        {/* NTG Alma brand */}
        <Box
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            opacity: 0.95,
            textDecoration: 'none',
            color: '#537d5d',
          }}
          component={Link}
          href="/home"
          id="admin-header-link-ntg"
          title="NTG Alma"
        >
          <Group gap={10} align="center" wrap="nowrap">
            <Box style={{ width: 48, height: 48, display: 'flex', alignItems: 'center' }}>
              <Image
                src="/alma-logo-darkgreen.svg"
                alt="NTG Alma"
                width="100%"
                height="100%"
                fit="contain"
                style={{ objectFit: 'contain' }}
              />
            </Box>
            <Box
              component="span"
              style={{
                fontFamily: 'var(--font-audiowide)',
                lineHeight: 1,
                fontSize: 'var(--mantine-font-size-xl)',
                fontWeight: 400,
                whiteSpace: 'nowrap',
              }}
            >
              NTG Alma
            </Box>
          </Group>
        </Box>

        {/* Online/Offline Status Badge (green when online, gray when offline) */}
        <Tooltip
          label={isOnline ? 'Connected to server' : 'No internet connection'}
          position="bottom"
          withArrow
        >
          <Badge
            variant="light"
            size="md"
            leftSection={
              <IconCircle
                size={8}
                fill="currentColor"
                style={{ marginRight: 4 }}
              />
            }
            style={{
              ...headerBadgeStyle,
              backgroundColor: isOnline ? `${onlineBadgeColor}20` : `${offlineBadgeColor}20`,
              color: isOnline ? onlineBadgeColor : offlineBadgeColor,
            }}
          >
            {isOnline ? 'Online' : 'Offline'}
          </Badge>
        </Tooltip>

        <UserMenu />
      </Group>
    </Group>
  );
}
