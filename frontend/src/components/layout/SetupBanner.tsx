'use client';

import { Alert, Text } from '@mantine/core';
import Link from 'next/link';
import { IconRocket } from '@tabler/icons-react';
import { useSettingsStatus } from '@/hooks/useSettingsStatus';
import { useAuth } from '@/hooks/useAuth';

const canManageSetup = (roles: { roleName?: string }[] = []): boolean =>
  roles.some((r) => {
    const n = r.roleName?.toLowerCase();
    return n === 'school_admin' || n === 'principal' || n === 'super_admin';
  });

export function SetupBanner() {
  const { user } = useAuth();
  const statusQuery = useSettingsStatus();
  const status = statusQuery.data?.data as { isInitialized?: boolean } | undefined;
  const isInitialized = status?.isInitialized ?? true;

  if (!user || !canManageSetup(user.roles)) return null;
  if (statusQuery.isLoading || isInitialized) return null;

  return (
    <Alert
      color="blue"
      icon={<IconRocket size={20} />}
      mb="md"
      title="Complete your setup"
    >
      <Text size="sm" component="span">
        Add academic details, schedule, and more in Settings to get the most out of your school.
        {' '}
        <Link href="/settings" style={{ fontWeight: 600 }}>
          Go to Settings
        </Link>
      </Text>
    </Alert>
  );
}
