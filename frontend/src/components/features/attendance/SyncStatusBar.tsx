'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Group, Text, Button, Loader, Box } from '@mantine/core';
import { IconCloudCheck, IconAlertTriangle, IconWifiOff, IconCloudUpload } from '@tabler/icons-react';
import type { AttendanceSyncState } from '@/hooks/useOfflineAttendance';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

interface SyncStatusBarProps {
  isOnline: boolean;
  syncState: AttendanceSyncState;
  isFlushing: boolean;
  onRetry: () => void;
  dbAvailable: boolean;
  lastErrorMessage?: string | null;
}

export function SyncStatusBar({
  isOnline,
  syncState,
  isFlushing,
  onRetry,
  dbAvailable,
  lastErrorMessage,
}: SyncStatusBarProps) {
  const t = useTranslations('attendance');
  const colors = useThemeColors();
  const [showAllSaved, setShowAllSaved] = useState(false);
  const [hadActivity, setHadActivity] = useState(false);

  const { pending, syncing, errors } = syncState;
  const activelySyncing = isFlushing || syncing > 0;

  useEffect(() => {
    if (pending > 0 || syncing > 0 || errors > 0 || isFlushing) {
      setHadActivity(true);
      setShowAllSaved(false);
      return;
    }
    if (hadActivity && isOnline) {
      setShowAllSaved(true);
      const timer = setTimeout(() => {
        setShowAllSaved(false);
        setHadActivity(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [pending, syncing, errors, isFlushing, isOnline, hadActivity]);

  if (!dbAvailable) {
    return (
      <Box
        px="sm"
        py={4}
        style={{
          minHeight: 32,
          borderRadius: 'var(--mantine-radius-sm)',
          background: 'var(--mantine-color-yellow-light)',
        }}
      >
        <Text size="xs" c="dimmed">
          {t('offlineDbUnavailable')}
        </Text>
      </Box>
    );
  }

  if (!isOnline) {
    return (
      <Box
        px="sm"
        py={4}
        style={{
          minHeight: 32,
          borderRadius: 'var(--mantine-radius-sm)',
          background: 'var(--mantine-color-yellow-light)',
        }}
      >
        <Group gap="xs" wrap="nowrap" h={24}>
          <IconWifiOff size={14} color={colors.warning} />
          <Text size="xs">
            {pending > 0
              ? t('offlinePendingCount', { count: pending })
              : t('offlineSavingLocally')}
          </Text>
        </Group>
      </Box>
    );
  }

  if (errors > 0) {
    return (
      <Box
        px="sm"
        py={6}
        style={{
          minHeight: 32,
          borderRadius: 'var(--mantine-radius-sm)',
          background: 'var(--mantine-color-red-light)',
        }}
      >
        <Group gap="xs" wrap="nowrap" justify="space-between" align="flex-start">
          <Group gap="xs" wrap="nowrap" align="flex-start" style={{ flex: 1, minWidth: 0 }}>
            <IconAlertTriangle size={14} color={colors.error} style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <Text size="xs">{t('syncFailedCount', { count: errors })}</Text>
              {lastErrorMessage ? (
                <Text size="xs" c="dimmed" lineClamp={2} title={lastErrorMessage}>
                  {lastErrorMessage}
                </Text>
              ) : null}
            </div>
          </Group>
          <Button
            id="attendance-sync-retry"
            size="compact-xs"
            variant="light"
            color="red"
            onClick={onRetry}
            loading={isFlushing}
            style={{ flexShrink: 0 }}
          >
            {t('syncRetry')}
          </Button>
        </Group>
      </Box>
    );
  }

  // Only spin while a flush is actually in flight — not merely because rows are pending.
  if (activelySyncing) {
    const count = Math.max(syncing, pending, 1);
    return (
      <Box
        px="sm"
        py={4}
        style={{
          minHeight: 32,
          borderRadius: 'var(--mantine-radius-sm)',
          background: 'var(--mantine-color-blue-light)',
        }}
      >
        <Group gap="xs" wrap="nowrap" h={24}>
          <Loader size={12} />
          <Text size="xs">{t('syncingCount', { count })}</Text>
        </Group>
      </Box>
    );
  }

  if (pending > 0) {
    return (
      <Box
        px="sm"
        py={4}
        style={{
          minHeight: 32,
          borderRadius: 'var(--mantine-radius-sm)',
          background: 'var(--mantine-color-blue-light)',
        }}
      >
        <Group gap="xs" wrap="nowrap" justify="space-between" h={24}>
          <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
            <IconCloudUpload size={14} color={colors.info} style={{ flexShrink: 0 }} />
            <Text size="xs" lineClamp={1}>
              {t('pendingSyncCount', { count: pending })}
            </Text>
          </Group>
          <Button
            id="attendance-sync-now"
            size="compact-xs"
            variant="light"
            onClick={onRetry}
            loading={isFlushing}
            style={{ flexShrink: 0 }}
          >
            {t('syncNow')}
          </Button>
        </Group>
      </Box>
    );
  }

  if (showAllSaved) {
    return (
      <Box
        px="sm"
        py={4}
        style={{
          minHeight: 32,
          borderRadius: 'var(--mantine-radius-sm)',
          background: 'var(--mantine-color-green-light)',
        }}
      >
        <Group gap="xs" wrap="nowrap" h={24}>
          <IconCloudCheck size={14} color={colors.success} />
          <Text size="xs">{t('allSaved')}</Text>
        </Group>
      </Box>
    );
  }

  return null;
}
