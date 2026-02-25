'use client';

import { Alert, Text } from '@mantine/core';
import Link from 'next/link';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useStorageAlerts } from '@/hooks/useStorage';
import { useAuth } from '@/hooks/useAuth';

const canManageStorage = (roles: { roleName?: string }[] = []): boolean =>
  roles.some((r) => {
    const n = r.roleName?.toLowerCase();
    return n === 'school_admin' || n === 'principal' || n === 'super_admin';
  });

export function StorageWarningBanner() {
  const { user } = useAuth();
  const { data: alerts, isLoading } = useStorageAlerts('unacknowledged');

  if (!user || !canManageStorage(user.roles)) return null;
  if (isLoading || !alerts || alerts.length === 0) return null;

  const critical = alerts.some((a) => a.alertType === 'exceeded' || a.alertType === 'critical');
  const color = critical ? 'red' : 'yellow';

  return (
    <Alert
      color={color}
      icon={<IconAlertTriangle size={20} />}
      mb="md"
      title={critical ? 'Storage quota critical' : 'Storage quota warning'}
    >
      <Text size="sm" component="span">
        Branch storage usage is high.{' '}
        <Link id="storage-warning-link-dashboard" href="/admin/storage" style={{ fontWeight: 600 }}>
          View storage dashboard
        </Link>
      </Text>
    </Alert>
  );
}
