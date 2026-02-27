'use client';

import { useState, useEffect } from 'react';
import { Paper, Stack, Switch, TextInput, Button, Text, Alert, Anchor, Title } from '@mantine/core';
import { useBranchById, useUpdatePublicStats } from '@/hooks/useBranches';
import { useAuth } from '@/hooks/useAuth';
import { useTranslations } from 'next-intl';


export function PublicStatsSettings() {
  const { user } = useAuth();
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');
  const currentBranchId = user?.currentBranch?.id ?? null;
  const branchQuery = useBranchById(currentBranchId);
  const updatePublicStats = useUpdatePublicStats();

  const branch = branchQuery.data?.data;
  const enabled = branch?.publicStatsEnabled ?? false;
  const branchCode = branch?.code ?? '';

  const [localEnabled, setLocalEnabled] = useState(enabled);
  const [password, setPassword] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setLocalEnabled(enabled);
  }, [enabled]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    if (!currentBranchId) return;
    updatePublicStats.mutate(
      {
        branchId: currentBranchId,
        payload: {
          enabled: localEnabled,
          password: password.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          setSuccessMessage(tSettings('publicStatsSavedMessage'));
          setPassword('');
        },
        onError: () => {},
      },
    );
  };

  const publicUrl =
    typeof window !== 'undefined' && branchCode
      ? `${window.location.origin}/public/statistics/${encodeURIComponent(branchCode)}`
      : '';

  if (!currentBranchId) {
    return (
      <Paper p="md" withBorder>
        <Text size="sm" c="dimmed">{tSettings('publicStatsNoBranch')}</Text>
      </Paper>
    );
  }

  return (
    <Paper p="md" withBorder>
      <Title order={4} mb="md">
        {tSettings('publicStatsTitle')}
      </Title>
      <Text size="sm" c="dimmed" mb="md">
        {tSettings('publicStatsDescription')}
      </Text>

      <form id="public-stats-settings-form" onSubmit={handleSubmit}>
        <Stack gap="md">
          <Switch
            id="public-stats-settings-enabled"
            label={tSettings('publicStatsEnableLabel')}
            description={tSettings('publicStatsEnableDescription')}
            checked={localEnabled}
            onChange={(e) => setLocalEnabled(e.currentTarget.checked)}
          />

          <TextInput
            id="public-stats-settings-password"
            label={tSettings('publicStatsPasswordLabel')}
            description={tSettings('publicStatsPasswordDescription')}
            type="password"
            placeholder={tSettings('publicStatsPasswordPlaceholder')}
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            autoComplete="new-password"
          />

          {successMessage && (
            <Alert color="green" title={tSettings('publicStatsSavedTitle')}>
              {successMessage}
            </Alert>
          )}

          {updatePublicStats.isError && (
            <Alert color="red" title={tCommon('error')}>
              {updatePublicStats.error instanceof Error
                ? updatePublicStats.error.message
                : tSettings('publicStatsErrorFallback')}
            </Alert>
          )}

          <Button id="public-stats-settings-submit" type="submit" loading={updatePublicStats.isPending}>
            {tSettings('publicStatsSaveButton')}
          </Button>

          {localEnabled && branchCode && publicUrl && (
            <Stack gap="xs">
              <Text size="sm" fw={500}>{tSettings('publicStatsLinkTitle')}</Text>
              <Anchor id="public-stats-settings-link" href={publicUrl} target="_blank" rel="noopener noreferrer" size="sm">
                {publicUrl}
              </Anchor>
            </Stack>
          )}
        </Stack>
      </form>
    </Paper>
  );
}
