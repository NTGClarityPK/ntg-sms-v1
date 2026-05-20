'use client';

import { Alert, Button, Group } from '@mantine/core';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

export function UpgradePrompt() {
  const t = useTranslations('billing');
  const router = useRouter();

  return (
    <Alert
      id="subscription-upgrade-prompt"
      title={t('upgradePromptTitle')}
      color="yellow"
      variant="light"
    >
      <Group justify="space-between" wrap="wrap" gap="sm">
        <span>{t('upgradePromptMessage')}</span>
        <Button
          id="subscription-upgrade-prompt-action"
          size="xs"
          variant="light"
          onClick={() => router.push('/billing')}
        >
          {t('upgradePromptAction')}
        </Button>
      </Group>
    </Alert>
  );
}
