'use client';

import { Badge, Tooltip } from '@mantine/core';
import { IconCloudUpload } from '@tabler/icons-react';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

export function SyncStatus() {
  const { pendingCount, isSyncing } = useOfflineSync();
  const colors = useThemeColors();

  if (pendingCount === 0 && !isSyncing) return null;

  return (
    <Tooltip
      label={isSyncing ? 'Syncing changes…' : `${pendingCount} change(s) pending sync`}
      position="bottom"
      withArrow
    >
      <Badge
        variant="light"
        color={colors.primary}
        size="sm"
        leftSection={<IconCloudUpload size={12} style={{ marginRight: 4 }} />}
        style={{ cursor: 'default', fontWeight: 500 }}
      >
        {isSyncing ? 'Syncing…' : `${pendingCount} pending`}
      </Badge>
    </Tooltip>
  );
}
