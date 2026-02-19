'use client';

import { useState, useEffect } from 'react';
import { Paper, Stack, Switch, TextInput, Button, Text, Alert, Anchor, Title } from '@mantine/core';
import { useBranchById, useUpdatePublicStats } from '@/hooks/useBranches';
import { useAuth } from '@/hooks/useAuth';

export function PublicStatsSettings() {
  const { user } = useAuth();
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
          setSuccessMessage('Public statistics settings saved.');
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
        <Text size="sm" c="dimmed">
          Select a branch to configure public statistics.
        </Text>
      </Paper>
    );
  }

  return (
    <Paper p="md" withBorder>
      <Title order={4} mb="md">
        Public statistics
      </Title>
      <Text size="sm" c="dimmed" mb="md">
        Allow anyone with the password to view anonymised student counts per class (no login, no individual data).
      </Text>

      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <Switch
            label="Enable public statistics page"
            description="When enabled, users can view class-wise student counts at a public URL after entering the password."
            checked={localEnabled}
            onChange={(e) => setLocalEnabled(e.currentTarget.checked)}
          />

          <TextInput
            label="Password (optional)"
            description="Leave blank to keep the existing password. Set a new value to change it."
            type="password"
            placeholder="Set or change password"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            autoComplete="new-password"
          />

          {successMessage && (
            <Alert color="green" title="Saved">
              {successMessage}
            </Alert>
          )}

          {updatePublicStats.isError && (
            <Alert color="red" title="Error">
              {updatePublicStats.error instanceof Error
                ? updatePublicStats.error.message
                : 'Failed to save settings'}
            </Alert>
          )}

          <Button type="submit" loading={updatePublicStats.isPending}>
            Save changes
          </Button>

          {localEnabled && branchCode && publicUrl && (
            <Stack gap="xs">
              <Text size="sm" fw={500}>
                Public page link
              </Text>
              <Anchor href={publicUrl} target="_blank" rel="noopener noreferrer" size="sm">
                {publicUrl}
              </Anchor>
            </Stack>
          )}
        </Stack>
      </form>
    </Paper>
  );
}
