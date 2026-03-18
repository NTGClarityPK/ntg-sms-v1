'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Alert, Button, Group, Paper, PasswordInput, Stack, Text, Title } from '@mantine/core';
import { IconAlertCircle, IconCheck, IconKey } from '@tabler/icons-react';
import { useAuth } from '@/hooks/useAuth';
import { pinAuth } from '@/lib/pin-auth';
import { getSession } from '@/lib/auth';

export default function ParentPinSection() {
  const tAuth = useTranslations('auth');
  const { user } = useAuth();

  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [checkingPin, setCheckingPin] = useState(true);

  const checkPinAvailability = async () => {
    try {
      if (!user?.email) {
        setHasPin(false);
        setCheckingPin(false);
        return false;
      }

      const normalizedEmail = user.email.toLowerCase().trim();
      const available = await pinAuth.isPinAuthAvailable(normalizedEmail);
      setHasPin(available);
      return available;
    } catch {
      setHasPin(false);
      return false;
    } finally {
      setCheckingPin(false);
    }
  };

  useEffect(() => {
    setHasPin(false);
    setCheckingPin(true);
    void checkPinAvailability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  const handleSetupPin = async () => {
    if (pin.length < 4) {
      setError(tAuth('pinMgmtErrorInvalidPinFormat'));
      return;
    }
    if (pin !== confirmPin) {
      setError(tAuth('pinMgmtErrorPinMismatch'));
      return;
    }
    if (!/^\d{4,6}$/.test(pin)) {
      setError(tAuth('pinMgmtErrorInvalidPinFormat'));
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      if (!user?.email) {
        throw new Error(tAuth('pinMgmtErrorParentNoSession'));
      }

      const session = await getSession();
      const refreshToken = session?.refresh_token;
      if (!refreshToken) {
        throw new Error(tAuth('pinMgmtErrorParentNoSession'));
      }

      await pinAuth.setupPinAuth(pin, refreshToken, user.email);
      const saved = await checkPinAvailability();
      if (!saved) {
        throw new Error('PIN was set up but could not be verified. Please try again.');
      }

      setSuccess(true);
      setPin('');
      setConfirmPin('');
      setHasPin(true);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to setup PIN. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemovePin = async () => {
    // Simple confirm like RMS
    if (
      !window.confirm(
        tAuth('pinMgmtParentRemoveBody'),
      )
    ) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      if (user?.email) {
        pinAuth.clearPinAuth(user.email);
      } else {
        pinAuth.clearPinAuth();
      }

      const removed = !(await checkPinAvailability());
      if (!removed) {
        throw new Error('Failed to remove PIN. Please try again.');
      }

      setHasPin(false);
      setSuccess(true);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to remove PIN. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (checkingPin) {
    return (
      <Paper p="md" withBorder>
        <Stack gap="md">
          <Text>{tAuth('pinMgmtParentStatusChecking')}</Text>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper p="md" withBorder>
      <Stack gap="md">
        <Group gap="xs">
          <IconKey size={20} />
          <Title order={3}>{tAuth('pinMgmtPageTitle')}</Title>
        </Group>

        <Text size="sm" c="dimmed">
          {tAuth('pinMgmtParentRowDescription')}
        </Text>

        {success && (
          <Alert
            color="green"
            icon={<IconCheck size={16} />}
            withCloseButton
            onClose={() => setSuccess(false)}
          >
            {hasPin ? tAuth('pinMgmtParentStatusSet') : tAuth('pinMgmtParentStatusNotSet')}
          </Alert>
        )}

        {error && (
          <Alert
            color="red"
            icon={<IconAlertCircle size={16} />}
            withCloseButton
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        )}

        {!hasPin ? (
          <>
            <PasswordInput
              label={tAuth('pinMgmtParentPinLabel')}
              placeholder={tAuth('pinMgmtParentPinPlaceholder')}
              value={pin}
              onChange={(e) =>
                setPin(e.currentTarget.value.replace(/\D/g, '').slice(0, 6))
              }
              maxLength={6}
              disabled={loading}
              leftSection={<IconKey size={18} />}
            />
            <PasswordInput
              label={tAuth('pinMgmtParentConfirmPinLabel')}
              placeholder={tAuth('pinMgmtParentConfirmPinPlaceholder')}
              value={confirmPin}
              onChange={(e) =>
                setConfirmPin(e.currentTarget.value.replace(/\D/g, '').slice(0, 6))
              }
              maxLength={6}
              disabled={loading}
              leftSection={<IconKey size={18} />}
            />
            <Button
              onClick={handleSetupPin}
              loading={loading}
              leftSection={<IconKey size={16} />}
            >
              {tAuth('pinMgmtParentSet')}
            </Button>
          </>
        ) : (
          <Button
            color="red"
            onClick={handleRemovePin}
            loading={loading}
            leftSection={<IconAlertCircle size={16} />}
            variant="outline"
          >
            {tAuth('pinMgmtParentRemove')}
          </Button>
        )}

        <Alert color="blue" variant="light" icon={<IconAlertCircle size={16} />}>
          <Text size="xs" style={{ whiteSpace: 'pre-line' }}>
            {[
              'PIN Authentication Privacy & Security:',
              '• PIN stored locally on your device only (never sent to servers)',
              '• Encrypted session token stored locally using AES-256 encryption',
              '• Device fingerprint used for additional security',
              '• Your email address is stored locally to ensure PIN is tied to your account',
              '• PIN is hashed (not stored in plaintext)',
              '• No password or other personal data stored',
              '• You can delete PIN anytime from settings',
              '• All data remains on your device and is never transmitted to our servers',
              '• This feature complies with GDPR, SOC-2, and data privacy regulations',
            ].join('\n')}
          </Text>
        </Alert>
      </Stack>
    </Paper>
  );
}


