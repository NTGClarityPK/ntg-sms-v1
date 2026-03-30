'use client';

import { useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Alert,
  Button,
  Group,
  Paper,
  PasswordInput,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useInvitationInfo, useSetInvitationPassword } from '@/hooks/useInvitationSetup';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

function isStrongPassword(pw: string): boolean {
  if (pw.length < 8) return false;
  const hasLetter = /[A-Za-z]/.test(pw);
  const hasNumber = /\d/.test(pw);
  return hasLetter && hasNumber;
}

export default function SetupPage() {
  const colors = useThemeColors();
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const infoQuery = useInvitationInfo(token);
  const setPassword = useSetInvitationPassword(token);

  const [password, setPasswordValue] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [done, setDone] = useState(false);

  const validation = useMemo(() => {
    if (!password && !confirmPassword) return null;
    if (!isStrongPassword(password)) {
      return 'Password must be at least 8 characters and include at least one letter and one number.';
    }
    if (password !== confirmPassword) {
      return 'Passwords do not match.';
    }
    return null;
  }, [password, confirmPassword]);

  const onSubmit = async () => {
    if (!token) return;
    if (validation) {
      notifications.show({
        title: 'Invalid password',
        message: validation,
        color: colors.error,
      });
      return;
    }

    try {
      await setPassword.mutateAsync({ password });
      setDone(true);
      notifications.show({
        title: 'Success',
        message: 'Password set successfully.',
        color: colors.success,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to set password';
      notifications.show({
        title: 'Error',
        message,
        color: colors.error,
      });
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--mantine-spacing-md)',
      }}
    >
      <Paper withBorder p="xl" radius="md" style={{ width: 520, maxWidth: '100%' }}>
        <Stack gap="md">
          <div>
            <Title order={2}>Set up your account</Title>
            <Text c="dimmed" size="sm">
              Create a password to access NTG SMS.
            </Text>
          </div>

          {!token ? (
            <Alert color={colors.error} title="Missing token">
              <Text size="sm">This setup link is invalid. Please request a new invitation.</Text>
            </Alert>
          ) : infoQuery.isLoading || !infoQuery.data ? (
            <Stack gap="sm">
              <Skeleton height={18} width="60%" />
              <Skeleton height={14} width="80%" />
              <Skeleton height={120} />
            </Stack>
          ) : done ? (
            <Alert color={colors.success} title="Account ready">
              <Text size="sm" mb="sm">
                You can now sign in using:
              </Text>
              <Text size="sm">
                <strong>Email:</strong> {infoQuery.data.loginEmail}
              </Text>
              <Group justify="flex-end" mt="md">
                <Button onClick={() => router.push('/login')}>Go to login</Button>
              </Group>
            </Alert>
          ) : (
            <>
              <Alert color={colors.info} title="Account information">
                <Text size="sm">
                  <strong>Name:</strong> {infoQuery.data.name}
                </Text>
                <Text size="sm">
                  <strong>Login email:</strong> {infoQuery.data.loginEmail}
                </Text>
              </Alert>

              {infoQuery.isError && (
                <Alert color={colors.error} title="Unable to validate invitation">
                  <Text size="sm">This invitation may be expired or already used.</Text>
                </Alert>
              )}

              <PasswordInput
                id="setup-password"
                label="New password"
                value={password}
                onChange={(e) => setPasswordValue(e.currentTarget.value)}
              />
              <PasswordInput
                id="setup-confirm-password"
                label="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.currentTarget.value)}
              />

              {validation && (
                <Alert color={colors.error} title="Check your password">
                  <Text size="sm">{validation}</Text>
                </Alert>
              )}

              <Group justify="flex-end">
                <Button
                  id="setup-submit"
                  onClick={onSubmit}
                  loading={setPassword.isPending}
                  disabled={!password || !confirmPassword}
                >
                  Set password
                </Button>
              </Group>
            </>
          )}
        </Stack>
      </Paper>
    </div>
  );
}

