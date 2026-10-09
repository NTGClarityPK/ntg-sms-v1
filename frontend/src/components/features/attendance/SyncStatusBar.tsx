'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Group, Text, Button, Loader, Box } from '@mantine/core';
import { IconCloudCheck, IconAlertTriangle, IconWifiOff } from '@tabler/icons-react';
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
  const [hadPending, setHadPending] = useState(false);

  const { pending, syncing, errors } = syncState;
  const isBusy = isFlushing || syncing > 0 || pending > 0;

  useEffect(() => {
    if (pending > 0 || syncing > 0 || errors > 0) {
      setHadPending(true);
      setShowAllSaved(false);
      return;
    }
    if (hadPending && isOnline && errors === 0 && pending === 0 && syncing === 0) {
      setShowAllSaved(true);
      const timer = setTimeout(() => {
        setShowAllSaved(false);
        setHadPending(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [pending, syncing, errors, isOnline, hadPending]);

  if (!dbAvailable) {
    return (
      <Box
        px="sm"
        py={4}
        style={{
          minHeight: 32,
          maxHeight: 40,
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
          maxHeight: 40,
          borderRadius: 'var(--mantine-radius-sm)',
          background: 'var(--mantine-color-yellow-light)',
        }}
      >
        <Group gap="xs" wrap="nowrap" h={24}>
          <IconWifiOff size={14} color={colors.warning} />
          <Text size="xs">{t('offlineSavingLocally')}</Text>
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

  if (isBusy) {
    const count = pending + syncing;
    return (
      <Box
        px="sm"
        py={4}
        style={{
          minHeight: 32,
          maxHeight: 40,
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

  if (showAllSaved) {
    return (
      <Box
        px="sm"
        py={4}
        style={{
          minHeight: 32,
          maxHeight: 40,
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
