'use client';

import { useEffect } from 'react';
import { Alert, Button, Container, Stack, Text } from '@mantine/core';
import { useTranslations } from 'next-intl';
import { IconAlertCircle } from '@tabler/icons-react';

export default function PortalErrorBoundary(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('common');

  useEffect(() => {
    // Keep a console trace so we can diagnose blank portal screens in production logs.
    // eslint-disable-next-line no-console
    console.error('Portal route error:', props.error);
  }, [props.error]);

  return (
    <Container size="sm" py="xl">
      <Stack gap="md">
        <Alert
          icon={<IconAlertCircle size={18} />}
          color="red"
          variant="light"
          title={t('errors.generic')}
        >
          <Text size="sm">
            {props.error?.message || t('errors.generic')}
          </Text>
        </Alert>

        <Button id="portal-error-try-again" onClick={props.reset}>
          {t('retry')}
        </Button>
      </Stack>
    </Container>
  );
}

