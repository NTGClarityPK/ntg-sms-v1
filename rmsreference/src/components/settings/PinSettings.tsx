'use client';

import { useState, useEffect } from 'react';
import { Button, Stack, Text, Alert, Paper, Title, PasswordInput, Group } from '@mantine/core';
import { IconKey, IconCheck, IconAlertCircle, IconTrash } from '@tabler/icons-react';
import { pinAuth } from '@/lib/utils/pin-auth';
import { useLanguageStore } from '@/lib/store/language-store';
import { t } from '@/lib/utils/translations';
import { notifications } from '@mantine/notifications';
import { getSuccessColor, getErrorColor } from '@/lib/utils/theme';
import { useThemeColor } from '@/lib/hooks/use-theme-color';
import { useAuthStore } from '@/lib/store/auth-store';
import { tokenStorage } from '@/lib/api/client';

export function PinSettings() {
  const language = useLanguageStore((state) => state.language);
  const themeColor = useThemeColor();
  const user = useAuthStore((state) => state.user);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [checkingPin, setCheckingPin] = useState(true);

  // Check if PIN is set up for current user
  const checkPinAvailability = async () => {
    try {
      // Get fresh user email from store to avoid stale closures
      const currentUser = useAuthStore.getState().user;
      const userEmail = currentUser?.email;
      
      if (!userEmail) {
        setHasPin(false);
        setCheckingPin(false);
        return false;
      }
      
      // Always check with specific user email to ensure we only show PIN for current user
      // Normalize email to match how it's stored
      const normalizedEmail = userEmail.toLowerCase().trim();
      const available = await pinAuth.isPinAuthAvailable(normalizedEmail);
      
      // Double-check: verify the user hasn't changed while we were checking
      const latestUser = useAuthStore.getState().user;
      if (latestUser?.email?.toLowerCase().trim() !== normalizedEmail) {
        // User changed during check, don't update state
        console.log('User changed during PIN check, ignoring result');
        return false;
      }
      
      setHasPin(available);
      return available;
    } catch (err) {
      console.error('Failed to check PIN availability:', err);
      setHasPin(false);
      return false;
    } finally {
      setCheckingPin(false);
    }
  };

  useEffect(() => {
    // Reset PIN state immediately when user changes
    setHasPin(false);
    setCheckingPin(true);
    // Then check PIN availability for the new user
    checkPinAvailability();
  }, [user?.email]); // Re-check when user email changes

  const handleSetupPin = async () => {
    if (pin.length < 4) {
      setError(t('auth.pinTooShort', language));
      return;
    }
    if (pin !== confirmPin) {
      setError(t('auth.pinsDoNotMatch', language));
      return;
    }
    if (!/^\d{4,6}$/.test(pin)) {
      setError(t('auth.pinMustBeDigits', language));
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Verify user is logged in
      if (!user?.email) {
        throw new Error('User not logged in. Please login again.');
      }
      
      // Get current refresh token using token storage utility
      const refreshToken = tokenStorage.getRefreshToken();
      if (!refreshToken) {
        throw new Error('No active session found. Please login again.');
      }

      // Pass user email directly since we have it - pinAuth can also get it automatically if not provided
      await pinAuth.setupPinAuth(pin, refreshToken, user.email, language);
      
      // Verify PIN was saved correctly
      const pinSaved = await checkPinAvailability();
      if (!pinSaved) {
        throw new Error('PIN was set up but could not be verified. Please try again.');
      }
      
      setSuccess(true);
      setPin('');
      setConfirmPin('');
      setHasPin(true);
      
      notifications.show({
        title: t('common.success' as any, language),
        message: t('auth.pinSetupSuccess', language),
        color: getSuccessColor(),
        icon: <IconCheck size={16} />,
      });
    } catch (err: any) {
      const errorMsg = err.message || t('auth.pinSetupFailed' as any, language) || 'Failed to setup PIN';
      setError(errorMsg);
      notifications.show({
        title: t('common.error' as any, language),
        message: errorMsg,
        color: getErrorColor(),
        icon: <IconAlertCircle size={16} />,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemovePin = async () => {
    if (!window.confirm(t('auth.removePinConfirm' as any, language) || 'Are you sure you want to remove PIN authentication?')) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Clear PIN for current user
      if (user?.email) {
        pinAuth.clearPinAuth(user.email);
      } else {
        pinAuth.clearPinAuth();
      }
      
      // Verify PIN was removed
      const pinRemoved = !(await checkPinAvailability());
      if (!pinRemoved) {
        throw new Error('Failed to remove PIN. Please try again.');
      }
      
      setHasPin(false);
      setSuccess(true);
      
      notifications.show({
        title: t('common.success' as any, language),
        message: t('auth.pinRemovedSuccess', language),
        color: getSuccessColor(),
        icon: <IconCheck size={16} />,
      });
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to remove PIN';
      setError(errorMsg);
      notifications.show({
        title: t('common.error' as any, language),
        message: errorMsg,
        color: getErrorColor(),
        icon: <IconAlertCircle size={16} />,
      });
    } finally {
      setLoading(false);
    }
  };

  if (checkingPin) {
    return (
      <Paper p="md" withBorder>
        <Stack gap="md">
          <Text>{t('common.loading' as any, language)}</Text>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper p="md" withBorder>
      <Stack gap="md">
        <Group gap="xs">
          <IconKey size={20} />
          <Title order={3}>{t('auth.pinSettings', language)}</Title>
        </Group>
        
        <Text size="sm" c="dimmed">
          {t('auth.pinSetupDescription', language)}
        </Text>

        {success && (
          <Alert
            color="green"
            icon={<IconCheck size={16} />}
            onClose={() => setSuccess(false)}
            withCloseButton
          >
            {hasPin ? t('auth.pinSetupSuccess', language) : t('auth.pinRemovedSuccess', language)}
          </Alert>
        )}

        {error && (
          <Alert
            color="red"
            icon={<IconAlertCircle size={16} />}
            onClose={() => setError(null)}
            withCloseButton
          >
            {error}
          </Alert>
        )}

        {!hasPin ? (
          <>
            <PasswordInput
              label={t('auth.pinLabel', language)}
              placeholder={t('auth.pinPlaceholder', language)}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              disabled={loading}
              leftSection={<IconKey size={18} />}
            />
            <PasswordInput
              label={t('auth.pinConfirmPlaceholder', language)}
              placeholder={t('auth.pinConfirmPlaceholder', language)}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              disabled={loading}
              leftSection={<IconKey size={18} />}
            />
            <Button
              onClick={handleSetupPin}
              loading={loading}
              leftSection={<IconKey size={16} />}
              style={{ backgroundColor: themeColor }}
            >
              {t('auth.setupPin', language)}
            </Button>
          </>
        ) : (
          <Button
            color="red"
            onClick={handleRemovePin}
            loading={loading}
            leftSection={<IconTrash size={16} />}
            variant="outline"
          >
            {t('auth.removePin', language)}
          </Button>
        )}

        <Alert
          color="blue"
          variant="light"
          icon={<IconAlertCircle size={16} />}
        >
          <Text size="xs" style={{ whiteSpace: 'pre-line' }}>
            {t('auth.pinPrivacyNotice', language)}
          </Text>
        </Alert>
      </Stack>
    </Paper>
  );
}
