'use client';

import { Alert, Text } from '@mantine/core';
import Link from 'next/link';
import { IconRocket } from '@tabler/icons-react';
import { useSettingsStatus } from '@/hooks/useSettingsStatus';
import { useAuth } from '@/hooks/useAuth';
import { useThemeColor } from '@/lib/hooks/use-theme-color';

const canManageSetup = (roles: { roleName?: string }[] = []): boolean =>
  roles.some((r) => {
    const n = r.roleName?.toLowerCase();
    return n === 'school_admin' || n === 'principal' || n === 'super_admin';
  });

export function SetupBanner() {
  const { user } = useAuth();
  const primaryColor = useThemeColor();
  const statusQuery = useSettingsStatus();
  const status = statusQuery.data?.data as { isInitialized?: boolean } | undefined;
  const isInitialized = status?.isInitialized ?? true;

  if (!user || !canManageSetup(user.roles)) return null;
  if (statusQuery.isLoading || isInitialized) return null;

  return (
    <Alert
      icon={<IconRocket size={20} />}
      mb="md"
      title="Complete your setup"
      variant="light"
      style={{
        borderColor: primaryColor,
        color: primaryColor,
      }}
    >
      <Text size="sm" component="span">
        Add academic details, schedule, and more in Settings to get the most out of your school.
        {' '}
        <Link href="/settings" style={{ fontWeight: 600, color: primaryColor }}>
          Go to Settings
        </Link>
      </Text>
    </Alert>
  );
}
