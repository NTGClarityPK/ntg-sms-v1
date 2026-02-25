'use client';

import { Alert } from '@mantine/core';
import { IconWifiOff } from '@tabler/icons-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export function ConnectionIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <Alert
      color="red"
      icon={<IconWifiOff size={18} />}
      variant="filled"
      styles={{
        root: {
          position: 'fixed',
          top: 60,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          zIndex: 1000,
          borderRadius: 0,
        },
      }}
    >
      You are currently offline. Some features may not work.
    </Alert>
  );
}
