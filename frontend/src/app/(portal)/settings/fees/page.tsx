'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Center, Loader, Text, Stack } from '@mantine/core';
import { useTranslations } from 'next-intl';

/**
 * Legacy route — canonical Fee settings lives under Settings → Fee settings.
 * Keep this path so old bookmarks still work.
 */
export default function LegacyFeeSettingsRedirectPage() {
  const router = useRouter();
  const t = useTranslations('fees');

  useEffect(() => {
    router.replace('/settings?section=fees');
  }, [router]);

  return (
    <Center mih={240} p="md">
      <Stack align="center" gap="sm">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">
          {t('settings.redirecting')}
        </Text>
      </Stack>
    </Center>
  );
}
