'use client';

import { Badge, Button, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { useTranslations } from 'next-intl';
import {
  useConnectGoogleWorkspace,
  useDisconnectGoogleWorkspace,
  useGoogleWorkspaceSettings,
  useTestGoogleConnection,
} from '@/hooks/api/useGoogleWorkspace';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

export function ConnectionCard() {
  const t = useTranslations('googleClassroom');
  const colors = useThemeColors();
  const { data: settings, isLoading } = useGoogleWorkspaceSettings();
  const connect = useConnectGoogleWorkspace();
  const disconnect = useDisconnectGoogleWorkspace();
  const testConnection = useTestGoogleConnection();

  const connected = settings?.isConnected ?? false;

  return (
    <Paper p="md" withBorder>
      <Stack gap="md">
        <Group justify="space-between" wrap="wrap">
          <Title order={4}>{t('connectionStatus')}</Title>
          <Badge color={connected ? colors.success : 'gray'} variant="light">
            {connected
              ? t('connectedAs', { email: settings?.connectedEmail ?? '—' })
              : t('notConnected')}
          </Badge>
        </Group>

        {settings?.googleDomain && (
          <Text size="sm" c="dimmed">
            {settings.googleDomain}
          </Text>
        )}

        <Group wrap="wrap">
          {!connected ? (
            <Button
              id="google-classroom-connect"
              onClick={() => connect.mutate()}
              loading={!isLoading && connect.isPending}
              disabled={isLoading}
            >
              {t('connect')}
            </Button>
          ) : (
            <>
              <Button
                id="google-classroom-test"
                variant="light"
                onClick={() => testConnection.mutate()}
                loading={!isLoading && testConnection.isPending}
              >
                {t('testConnection')}
              </Button>
              <Button
                id="google-classroom-disconnect"
                variant="outline"
                color="red"
                onClick={() => disconnect.mutate()}
                loading={!isLoading && disconnect.isPending}
              >
                {t('disconnect')}
              </Button>
            </>
          )}
        </Group>
      </Stack>
    </Paper>
  );
}
