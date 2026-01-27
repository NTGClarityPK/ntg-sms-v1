'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from '@mantine/form';
import {
  Box,
  Title,
  TextInput,
  PasswordInput,
  Button,
  Stack,
  Text,
  Alert,
  Loader,
} from '@mantine/core';
import { IconAlertCircle, IconLock, IconCheck } from '@tabler/icons-react';
import { updatePassword, getSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase/client';
import { DEFAULT_THEME_COLOR } from '@/lib/utils/theme';
import { useErrorColor, useSuccessColor } from '@/lib/hooks/use-theme-colors';
import { useTheme } from '@/lib/hooks/use-theme';
import { useThemeColor } from '@/lib/hooks/use-theme-color';
import { generateThemeColors } from '@/lib/utils/themeColors';

export default function ResetPasswordPage() {
  const router = useRouter();
  const errorColor = useErrorColor();
  const successColor = useSuccessColor();
  const { isDark } = useTheme();
  const primaryColor = useThemeColor();
  const themeColors = generateThemeColors(primaryColor, isDark);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);

  useEffect(() => {
    // Supabase automatically handles the token from URL hash and creates a session
    // We need to check if we have a valid session
    const checkSession = async () => {
      try {
        // Wait a bit for Supabase to process the hash token
        await new Promise((resolve) => setTimeout(resolve, 500));
        
        const session = await getSession();
        if (session) {
          setHasValidSession(true);
        } else {
          // Check if there's a token in the URL hash
          const hash = window.location.hash;
          if (hash && hash.includes('access_token')) {
            // Token is present, wait a bit more for Supabase to process it
            await new Promise((resolve) => setTimeout(resolve, 1000));
            const newSession = await getSession();
            if (newSession) {
              setHasValidSession(true);
            } else {
              setError('Invalid or expired reset token. Please request a new password reset link.');
            }
          } else {
            setError('Invalid or missing reset token. Please request a new password reset link.');
          }
        }
      } catch (err: any) {
        setError(err.message || 'Failed to verify reset token. Please request a new password reset link.');
      } finally {
        setCheckingSession(false);
      }
    };

    checkSession();
  }, []);

  const form = useForm({
    initialValues: {
      password: '',
      confirmPassword: '',
    },
    validate: {
      password: (value: string) => (value.length < 6 ? 'Password must be at least 6 characters' : null),
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
      
      // Sign out after password reset
      await supabase.auth.signOut();
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <Box style={{ maxWidth: 400, margin: '0 auto', paddingTop: '5rem' }}>
        <Stack gap="md" align="center">
          <Loader size="lg" color={DEFAULT_THEME_COLOR} />
          <Text size="sm" style={{ color: themeColors.colorTextMedium }}>
            Verifying reset token...
          </Text>
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
            <Text size="sm">
              Redirecting to login page...
            </Text>
          </Alert>
        </Stack>
      </Box>
    );
  }

  return (
    <Box style={{ maxWidth: 400, margin: '0 auto', paddingTop: '5rem' }}>
      <form onSubmit={form.onSubmit(handleSubmit)}>
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

