'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from '@mantine/form';
import {
  Box,
  Title,
  TextInput,
  PasswordInput,
  Button,
  Stack,
  Text,
  Anchor,
  Divider,
  Alert,
  Modal,
  Group,
} from '@mantine/core';
import { IconAlertCircle, IconBrandGoogle, IconMail, IconLock, IconCheck } from '@tabler/icons-react';
import { signIn, resetPasswordForEmail } from '@/lib/auth';
import { DEFAULT_THEME_COLOR } from '@/lib/utils/theme';
import { useErrorColor } from '@/lib/hooks/use-theme-colors';
import { useTheme } from '@/lib/hooks/use-theme';
import { useThemeColor } from '@/lib/hooks/use-theme-color';
import { generateThemeColors } from '@/lib/utils/themeColors';

export default function LoginPage() {
  const router = useRouter();
  const errorColor = useErrorColor();
  const { isDark } = useTheme();
  const primaryColor = useThemeColor();
  const themeColors = generateThemeColors(primaryColor, isDark);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotPasswordOpened, setForgotPasswordOpened] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const form = useForm({
    initialValues: {
      email: '',
      password: '',
    },
    validate: {
      email: (value: string) => (/^\S+@\S+$/.test(value) ? null : 'Invalid email'),
      password: (value: string) => (value.length < 6 ? 'Password must be at least 6 characters' : null),
    },
  });

  const forgotPasswordForm = useForm({
    initialValues: {
      email: '',
    },
    validate: {
      email: (value: string) => (/^\S+@\S+$/.test(value) ? null : 'Invalid email'),
    },
  });

  const handleSubmit = async (values: typeof form.values) => {
    setLoading(true);
    setError(null);

    try {
      const result = await signIn(values.email, values.password);
      
      // Wait for session to be fully established in cookies
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      // Verify session was created
      if (!result.session) {
        throw new Error('Session not created');
      }
      
      // Redirect to dashboard
      window.location.href = '/dashboard';
    } catch (err: any) {
      // Extract error message from various possible response structures
      let errorMsg = '';
      
      if (err.response?.data?.error?.message) {
        errorMsg = err.response.data.error.message;
      } else if (err.response?.data?.message) {
        errorMsg = err.response.data.message;
      } else if (err.message) {
        errorMsg = err.message;
      } else {
        errorMsg = 'Failed to login. Please check your credentials.';
      }

      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    // Redirect to backend Google OAuth endpoint
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}/auth/google`;
  };

  const handleForgotPassword = async (values: { email: string }) => {
    setResetLoading(true);
    setResetError(null);

    try {
      await resetPasswordForEmail(values.email);
      setResetEmailSent(true);
    } catch (err: any) {
      setResetError(err.message || 'Failed to send reset email. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleCloseForgotPassword = () => {
    setForgotPasswordOpened(false);
    setResetEmailSent(false);
    setResetError(null);
    forgotPasswordForm.reset();
  };

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Stack gap="lg">
        <Box>
          <Title order={2} size="1.8rem" fw={700} mb="xs" style={{ color: themeColors.colorTextDark }}>
            Sign In
          </Title>
          <Text size="sm" style={{ color: themeColors.colorTextMedium }}>
            Sign in to your account to continue
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

        <TextInput
          label="Email"
          placeholder="your@email.com"
          required
          leftSection={<IconMail size={18} />}
          size="lg"
          radius="md"
          autoComplete="email"
          disabled={loading}
          {...form.getInputProps('email')}
        />

        <PasswordInput
          label="Password"
          placeholder="Enter your password"
          required
          leftSection={<IconLock size={18} />}
          size="lg"
          radius="md"
          autoComplete="current-password"
          disabled={loading}
          {...form.getInputProps('password')}
        />

        <Anchor
          component="button"
          type="button"
          size="sm"
          onClick={() => setForgotPasswordOpened(true)}
          style={{ color: DEFAULT_THEME_COLOR, fontWeight: 500 }}
        >
          Forgot password?
        </Anchor>

        <Button
          type="submit"
          fullWidth
          loading={loading}
          size="lg"
          radius="md"
          style={{
            backgroundColor: DEFAULT_THEME_COLOR,
            color: 'white',
          }}
        >
          Sign In
        </Button>

        <Divider label="OR" labelPosition="center" />

        <Button
          variant="outline"
          fullWidth
          leftSection={<IconBrandGoogle size={16} />}
          onClick={handleGoogleLogin}
          size="lg"
          radius="md"
          style={{
            borderColor: DEFAULT_THEME_COLOR,
            color: DEFAULT_THEME_COLOR,
          }}
        >
          Sign in with Google
        </Button>

        <Text ta="center" size="sm" style={{ color: themeColors.colorTextMedium }}>
          Don't have an account?{' '}
          <Anchor href="/signup" size="sm" style={{ color: DEFAULT_THEME_COLOR, fontWeight: 500 }}>
            Sign up
          </Anchor>
        </Text>
      </Stack>

      <Modal
        opened={forgotPasswordOpened}
        onClose={handleCloseForgotPassword}
        title="Reset Password"
        centered
      >
        {resetEmailSent ? (
          <Stack gap="md">
            <Alert
              icon={<IconCheck size={16} />}
              color="green"
              variant="light"
              radius="md"
            >
              <Text size="sm">
                Password reset email has been sent to <strong>{forgotPasswordForm.values.email}</strong>.
                Please check your inbox and click the link to reset your password.
              </Text>
            </Alert>
            <Button
              onClick={handleCloseForgotPassword}
              fullWidth
              style={{
                backgroundColor: DEFAULT_THEME_COLOR,
                color: 'white',
              }}
            >
              Close
            </Button>
          </Stack>
        ) : (
          <form onSubmit={forgotPasswordForm.onSubmit(handleForgotPassword)}>
            <Stack gap="md">
              <Text size="sm" style={{ color: themeColors.colorTextMedium }}>
                Enter your email address and we'll send you a link to reset your password.
              </Text>

              {resetError && (
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
                  {resetError}
                </Alert>
              )}

              <TextInput
                label="Email"
                placeholder="your@email.com"
                required
                leftSection={<IconMail size={18} />}
                size="lg"
                radius="md"
                disabled={resetLoading}
                {...forgotPasswordForm.getInputProps('email')}
              />

              <Group justify="flex-end" mt="md">
                <Button
                  variant="light"
                  onClick={handleCloseForgotPassword}
                  disabled={resetLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={resetLoading}
                  style={{
                    backgroundColor: DEFAULT_THEME_COLOR,
                    color: 'white',
                  }}
                >
                  Send Reset Link
                </Button>
              </Group>
            </Stack>
          </form>
        )}
      </Modal>
    </form>
  );
}
