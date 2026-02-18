'use client';

import { Progress, Text, Alert, Group } from '@mantine/core';
import { useBranchById } from '@/hooks/useBranches';
import { useAuth } from '@/hooks/useAuth';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { IconAlertTriangle } from '@tabler/icons-react';

export function StorageQuotaBar() {
  const colors = useThemeColors();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;
  const { data: branchData } = useBranchById(branchId);

  if (!branchData?.data) return null;

  const quotaGb = branchData.data.storageQuotaGb;
  const usedBytes = branchData.data.storageUsedBytes;
  const quotaBytes = quotaGb * 1024 * 1024 * 1024;
  const usedPercentage = quotaBytes > 0 ? Math.min(100, (usedBytes / quotaBytes) * 100) : 0;
  const usedMb = usedBytes / (1024 * 1024);
  const quotaMb = quotaGb * 1024;

  const getColor = () => {
    if (usedPercentage >= 95) return 'red';
    if (usedPercentage >= 80) return 'yellow';
    return 'blue';
  };

  const getAlert = () => {
    if (usedPercentage >= 95) {
      return (
        <Alert color="red" icon={<IconAlertTriangle size={16} />} mt="sm">
          <Text size="sm">Storage quota critical: {usedPercentage.toFixed(1)}% used</Text>
        </Alert>
      );
    }
    if (usedPercentage >= 80) {
      return (
        <Alert color="yellow" icon={<IconAlertTriangle size={16} />} mt="sm">
          <Text size="sm">Storage quota warning: {usedPercentage.toFixed(1)}% used</Text>
        </Alert>
      );
    }
    return null;
  };

  return (
    <div>
      <Group justify="space-between" mb="xs">
        <Text size="sm" fw={500}>
          Storage Usage
        </Text>
        <Text size="sm" c="dimmed">
          {usedMb.toFixed(2)} MB / {quotaMb.toFixed(0)} MB
        </Text>
      </Group>
      <Progress value={usedPercentage} color={getColor()} size="lg" radius="xl" />
      {getAlert()}
    </div>
  );
}
