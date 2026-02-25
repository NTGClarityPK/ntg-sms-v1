'use client';

import { useState } from 'react';
import { Paper, Stack, Text, TextInput, Button, Alert } from '@mantine/core';

export interface PasswordGateProps {
  onSubmit: (password: string) => Promise<void>;
  error?: string | null;
  loading?: boolean;
}

export function PasswordGate({ onSubmit, error, loading }: PasswordGateProps) {
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(password);
  };

  return (
    <Paper p="xl" withBorder shadow="sm" maw={400} mx="auto" mt="xl">
      <form id="password-gate-form" onSubmit={handleSubmit}>
        <Stack gap="md">
          <Text fw={600} size="lg">
            Enter password to view statistics
          </Text>
          <Text size="sm" c="dimmed">
            This page shows anonymised student counts per class. No individual data is shown.
          </Text>
          {error && (
            <Alert color="red" title="Error">
              {error}
            </Alert>
          )}
          <TextInput
            id="password-gate-password"
            label="Password"
            type="password"
            placeholder="Enter branch password"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            required
            autoComplete="current-password"
          />
          <Button id="password-gate-submit" type="submit" loading={loading} fullWidth>
            View statistics
          </Button>
        </Stack>
      </form>
    </Paper>
  );
}
