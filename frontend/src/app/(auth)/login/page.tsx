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
} from '@mantine/core';
import { IconAlertCircle, IconBrandGoogle, IconMail, IconLock } from '@tabler/icons-react';
import { signIn } from '@/lib/auth';
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
      
      // Use window.location instead of router.push to ensure full page reload
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
          href="/forgot-password"
          size="sm"
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
    </form>
  );
}
