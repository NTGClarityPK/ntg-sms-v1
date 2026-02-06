'use client';

import { Badge, Tooltip } from '@mantine/core';
import { IconMapPin } from '@tabler/icons-react';
import { useAuth } from '@/hooks/useAuth';
import type { User } from '@/types/auth';

export function CurrentBranchBadge() {
  const { user, isLoading } = useAuth();
  const userTyped = user as User | undefined;
  const currentBranch = userTyped?.currentBranch;

  // Don't show anything while loading
  if (isLoading) {
    return null;
  }

  // Don't show if no branch selected
  if (!currentBranch) {
    return null;
  }

  const branchName = currentBranch.name || currentBranch.code || 'Unknown Branch';

  return (
    <Tooltip
      label={`Currently viewing ${branchName}`}
      position="bottom"
      withArrow
    >
      <Badge
        leftSection={<IconMapPin size={14} />}
        variant="light"
        size="lg"
        style={{
          cursor: 'default',
          fontWeight: 500,
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
        }}
      >
        {branchName}
      </Badge>
    </Tooltip>
  );
}





