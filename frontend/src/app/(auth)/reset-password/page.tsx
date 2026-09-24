'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from '@mantine/form';
import {
  Box,
  Title,
  PasswordInput,
  Button,
  Stack,
  Text,
  Alert,
  Skeleton,
} from '@mantine/core';
import { IconAlertCircle, IconLock, IconCheck } from '@tabler/icons-react';
import { updatePassword } from '@/lib/auth';
import { supabase } from '@/lib/supabase/client';
import { DEFAULT_THEME_COLOR } from '@/lib/utils/theme';
import { useErrorColor, useSuccessColor } from '@/lib/hooks/use-theme-colors';
import { useTheme } from '@/lib/hooks/use-theme';
import { useThemeColor } from '@/lib/hooks/use-theme-color';
import { generateThemeColors } from '@/lib/utils/themeColors';

type RecoveryType = 'recovery' | 'email';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorColor = useErrorColor();
  const successColor = useSuccessColor();
  const { isDark } = useTheme();
  const primaryColor = useThemeColor();
  const themeColors = generateThemeColors(primaryColor, isDark);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);
  /** Present when email used our app-owned token_hash link (preferred). */
  const [pendingTokenHash, setPendingTokenHash] = useState<string | null>(null);
  const [pendingType, setPendingType] = useState<RecoveryType>('recovery');

  const clearHashFromUrl = useCallback(() => {
    if (typeof window === 'undefined') return;
    const { pathname, search } = window.location;
    window.history.replaceState(null, '', `${pathname}${search}`);
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const tokenHash = searchParams?.get('token_hash');
        const typeParam = (searchParams?.get('type') || 'recovery').toLowerCase();
        const recoveryType: RecoveryType =
          typeParam === 'email' ? 'email' : 'recovery';

        if (tokenHash) {
          // Do not auto-verify: mail scanners that prefetch URLs would burn the OTP.
          setPendingTokenHash(tokenHash);
          setPendingType(recoveryType);
          setCheckingSession(false);
          return;
        }

        // Legacy Supabase action_link flow: tokens arrive in the URL hash.
        await new Promise((resolve) => setTimeout(resolve, 400));
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) {
          setHasValidSession(true);
          clearHashFromUrl();
          setCheckingSession(false);
          return;
        }

        const hash = typeof window !== 'undefined' ? window.location.hash : '';
        if (hash.includes('error=')) {
          const params = new URLSearchParams(hash.replace(/^#/, ''));
          const desc =
            params.get('error_description')?.replace(/\+/g, ' ') ||
            params.get('error_code') ||
            'Invalid or expired reset link';
          setError(
            `${desc}. Please request a new password reset link from the sign-in page.`,
          );
          setCheckingSession(false);
          return;
        }

        if (hash.includes('access_token')) {
          await new Promise((resolve) => setTimeout(resolve, 800));
          const { data: retry } = await supabase.auth.getSession();
          if (retry.session) {
            setHasValidSession(true);
            clearHashFromUrl();
          } else {
            setError(
              'Invalid or expired reset token. Please request a new password reset link.',
            );
          }
        } else {
          setError(
            'Invalid or missing reset token. Please request a new password reset link from the sign-in page.',
          );
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to verify reset token. Please request a new password reset link.';
        setError(message);
      } finally {
        setCheckingSession(false);
      }
    };

    void bootstrap();
  }, [searchParams, clearHashFromUrl]);

  const handleContinueWithToken = async () => {
    if (!pendingTokenHash) return;
    setVerifying(true);
    setError(null);
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: pendingTokenHash,
        type: pendingType,
      });
      if (verifyError) {
        throw verifyError;
      }
      if (!data.session) {
        throw new Error('Could not establish a reset session. Please request a new link.');
      }
      setHasValidSession(true);
      setPendingTokenHash(null);
      // Drop token from the address bar so refresh does not re-use it.
      router.replace('/reset-password');
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Invalid or expired reset link. Please request a new one from the sign-in page.';
      setError(message);
    } finally {
      setVerifying(false);
    }
  };

  const form = useForm({
    initialValues: {
      password: '',
      confirmPassword: '',
    },
    validate: {
      password: (value: string) =>
        value.length < 6 ? 'Password must be at least 6 characters' : null,
      confirmPassword: (value: string, values) =>
        value !== values.password ? 'Passwords do not match' : null,
    },
  });

  const handleSubmit = async (values: typeof form.values) => {
    if (!hasValidSession) {
      setError('Invalid reset token. Please request a new password reset link.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await updatePassword(values.password);
      setSuccess(true);
      await supabase.auth.signOut();
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to reset password. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <Box style={{ maxWidth: 400, margin: '0 auto', paddingTop: '5rem' }}>
        <Stack gap="md">
          <Skeleton height={40} width="60%" />
          <Skeleton height={200} />
          <Skeleton height={50} />
        </Stack>
      </Box>
    );
  }

  if (success) {
    return (
      <Box style={{ maxWidth: 400, margin: '0 auto', paddingTop: '5rem' }}>
        <Stack gap="lg">
          <Box>
            <Title order={2} size="1.8rem" fw={700} mb="xs" style={{ color: themeColors.colorTextDark }}>
              Password Reset Successful
            </Title>
            <Text size="sm" style={{ color: themeColors.colorTextMedium }}>
              Your password has been reset successfully.
            </Text>
          </Box>

          <Alert
            icon={<IconCheck size={16} />}
            style={{
              backgroundColor: `${successColor}15`,
              borderColor: successColor,
              color: successColor,
            }}
            variant="light"
            radius="md"
          >
            <Text size="sm">Redirecting to login page...</Text>
          </Alert>
        </Stack>
      </Box>
    );
  }

  if (pendingTokenHash && !hasValidSession) {
    return (
      <Box style={{ maxWidth: 400, margin: '0 auto', paddingTop: '5rem' }}>
        <Stack gap="lg">
          <Box>
            <Title order={2} size="1.8rem" fw={700} mb="xs" style={{ color: themeColors.colorTextDark }}>
              Reset Password
            </Title>
            <Text size="sm" style={{ color: themeColors.colorTextMedium }}>
              Click continue to verify your reset link, then choose a new password.
            </Text>
          </Box>

          {error && (
            <Alert
              icon={<IconAlertCircle size={16} />}
              style={{
                backgroundColor: `${errorColor}15`,
                borderColor: errorColor,
                color: errorColor,
              }}
              variant="light"
              radius="md"
            >
              {error}
            </Alert>
          )}

          <Button
            id="reset-password-continue"
            fullWidth
            size="lg"
            radius="md"
            loading={verifying}
            onClick={() => void handleContinueWithToken()}
            style={{
              backgroundColor: DEFAULT_THEME_COLOR,
              color: 'white',
            }}
          >
            Continue
          </Button>

          <Text ta="center" size="sm" style={{ color: themeColors.colorTextMedium }}>
            Link expired?{' '}
            <a
              id="reset-password-request-new"
              href="/login"
              style={{ color: DEFAULT_THEME_COLOR, fontWeight: 500, textDecoration: 'none' }}
            >
              Request a new one
            </a>
          </Text>
        </Stack>
      </Box>
    );
  }

  return (
    <Box style={{ maxWidth: 400, margin: '0 auto', paddingTop: '5rem' }}>
      <form id="reset-password-form" onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="lg">
          <Box>
            <Title order={2} size="1.8rem" fw={700} mb="xs" style={{ color: themeColors.colorTextDark }}>
              Reset Password
            </Title>
            <Text size="sm" style={{ color: themeColors.colorTextMedium }}>
              Enter your new password below
            </Text>
          </Box>

          {error && (
            <Alert
              icon={<IconAlertCircle size={16} />}
              style={{
                backgroundColor: `${errorColor}15`,
                borderColor: errorColor,
                color: errorColor,
              }}
              variant="light"
              radius="md"
            >
              {error}
            </Alert>
          )}

          <PasswordInput
            id="reset-password-new"
            label="New Password"
            placeholder="Enter your new password"
            required
            leftSection={<IconLock size={18} />}
            size="lg"
            radius="md"
            autoComplete="new-password"
            disabled={loading || !hasValidSession}
            {...form.getInputProps('password')}
          />

          <PasswordInput
            id="reset-password-confirm"
            label="Confirm Password"
            placeholder="Confirm your new password"
            required
            leftSection={<IconLock size={18} />}
            size="lg"
            radius="md"
            autoComplete="new-password"
            disabled={loading || !hasValidSession}
            {...form.getInputProps('confirmPassword')}
          />

          <Button
            id="reset-password-submit"
            type="submit"
            fullWidth
            loading={loading}
            disabled={!hasValidSession}
            size="lg"
            radius="md"
            style={{
              backgroundColor: DEFAULT_THEME_COLOR,
              color: 'white',
            }}
          >
            Reset Password
          </Button>

          <Text ta="center" size="sm" style={{ color: themeColors.colorTextMedium }}>
            Remember your password?{' '}
            <a
              id="reset-password-signin-link"
              href="/login"
              style={{ color: DEFAULT_THEME_COLOR, fontWeight: 500, textDecoration: 'none' }}
            >
              Sign in
            </a>
          </Text>
        </Stack>
      </form>
    </Box>
  );
}
