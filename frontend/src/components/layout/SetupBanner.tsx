'use client';

import { useEffect, useMemo, useState } from 'react';
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
  const status = statusQuery.data?.data as
    | { isInitialized?: boolean; tabbedScreenReady?: boolean }
    | undefined;
  const isSetupReady = status?.tabbedScreenReady ?? status?.isInitialized ?? true;

  const forceShowForDevTesting =
    process.env.NODE_ENV === 'development' &&
    typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).get('forceSetupBanner') === '1' ||
      window.localStorage.getItem('forceSetupBanner') === '1');

  const hideKey = useMemo(() => {
    const userId = user?.id ?? 'anonymous';
    const branchId = user?.currentBranch?.id ?? 'no-branch';
    return `setup-banner-hidden:${userId}:${branchId}`;
  }, [user?.id, user?.currentBranch?.id]);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hidden = window.localStorage.getItem(hideKey) === '1';
    setIsDismissed(hidden);
  }, [hideKey]);

  if (!forceShowForDevTesting) {
    if (!user || !canManageSetup(user.roles)) return null;
    if (statusQuery.isLoading || isSetupReady || isDismissed) return null;
  }

  return (
    <Alert
      icon={<IconRocket size={16} />}
      mt="xs"
      mb="md"
      px="md"
      py="xs"
      title={
        <Text size="sm" fw={600}>
          Complete your setup
        </Text>
      }
      variant="light"
      style={{
        marginLeft: 'var(--mantine-spacing-md)',
        marginRight: 'var(--mantine-spacing-md)',
        borderColor: primaryColor,
        color: primaryColor,
      }}
      withCloseButton
      closeButtonLabel="Dismiss setup banner"
      onClose={() => {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(hideKey, '1');
        }
        setIsDismissed(true);
      }}
    >
      <Text size="xs" component="span">
        Add academic details, schedule, and more in Settings to get the most out of your school.
        {' '}
        <Link href="/settings" style={{ fontWeight: 600, color: primaryColor }}>
          Go to Settings
        </Link>
      </Text>
    </Alert>
  );
}
