'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
import { apiClient, getEffectiveApiBaseURL } from '@/lib/api-client';
import { BranchSelectionModal } from '@/components/common/BranchSelectionModal';
import { useThemeStore } from '@/lib/store/theme-store';
import type { Tenant } from '@/types/tenant';

interface Branch {
  id: string;
  name: string;
  code: string;
  tenantId: string;
}

export default function LoginPage() {
  const t = useTranslations('auth');
  const tCommon = useTranslations('common');
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
  const [showBranchSelection, setShowBranchSelection] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchSelectionLoading, setBranchSelectionLoading] = useState(false);
  const { setPrimaryColor } = useThemeStore();

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

      // Get user (for locale sync and super admin check)
      try {
        const userResponse = await apiClient.get<{
          preferredLocale?: string;
          roles?: Array<{ roleName?: string }>;
        }>('/api/v1/auth/me');
        const locale = userResponse.data?.preferredLocale ?? 'ar';
        document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000; SameSite=Lax`;
        localStorage.setItem('locale', locale);

        const isSuperAdmin = userResponse.data?.roles?.some(
          (r) => r.roleName?.toLowerCase() === 'super_admin'
        );
        if (isSuperAdmin) {
          window.location.href = '/adminportal';
          return;
        }
      } catch (userError: unknown) {
        console.error('Failed to check user role:', userError);
        // Continue with normal flow if check fails
      }

      // Fetch user's branches for regular users
      try {
        const response = await apiClient.get<Branch[]>('/api/v1/auth/my-branches');
        const userBranches = response.data || [];
        
        if (userBranches.length === 0) {
          setError('No branches assigned to your account. Please contact your administrator.');
          setLoading(false);
          return;
        }
        
        // If user has only one branch, auto-select it
        if (userBranches.length === 1) {
          await handleBranchSelection(userBranches[0].id);
          window.location.href = '/dashboard';
          return;
        }
        
        // If user has multiple branches, show selection modal
        setBranches(userBranches);
        setShowBranchSelection(true);
        setLoading(false);
      } catch (branchError: any) {
        console.error('Failed to fetch branches:', branchError);
        setError('Failed to fetch branches. Please try again.');
        setLoading(false);
      }
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
      setLoading(false);
    }
  };

  const handleBranchSelection = async (branchId: string) => {
    setBranchSelectionLoading(true);
    
    try {
      // Set the selected branch on the backend
      await apiClient.post('/api/v1/auth/select-branch', { branchId });
      
      // Store in localStorage for immediate use
      localStorage.setItem('currentBranchId', branchId);

      // Fetch tenant theme before redirect so first dashboard paint uses DB colour
      try {
        const tenantResponse = await apiClient.get<Tenant>('/api/v1/tenants/me');
        const tenantTheme = tenantResponse.data?.primaryColor;
        if (tenantTheme) {
          setPrimaryColor(tenantTheme);
        }
      } catch {
        // Non-blocking: dashboard will still bootstrap theme via AuthGuard/Header
      }
      
      // Close modal and redirect
      setShowBranchSelection(false);
      window.location.href = '/dashboard';
    } catch (err: any) {
      console.error('Failed to select branch:', err);
      setError('Failed to select branch. Please try again.');
      setBranchSelectionLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    // Redirect to backend Google OAuth endpoint
    window.location.href = `${getEffectiveApiBaseURL()}/api/v1/auth/google`;
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
    <form id="login-form" onSubmit={form.onSubmit(handleSubmit)}>
      <Stack gap="lg">
        <Box>
          <Title order={2} size="1.8rem" fw={700} mb="xs" style={{ color: themeColors.colorTextDark }}>
            {t('signInTitle')}
          </Title>
          <Text size="sm" style={{ color: themeColors.colorTextMedium }}>
            {t('signInSubtitle')}
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
          id="login-email"
          label={t('email')}
          placeholder={t('emailPlaceholder')}
          required
          leftSection={<IconMail size={18} />}
          size="lg"
          radius="md"
          autoComplete="email"
          disabled={loading}
          {...form.getInputProps('email')}
        />

        <PasswordInput
          id="login-password"
          label={t('password')}
          placeholder={t('passwordPlaceholder')}
          required
          leftSection={<IconLock size={18} />}
          size="lg"
          radius="md"
          autoComplete="current-password"
          disabled={loading}
          {...form.getInputProps('password')}
        />

        <Anchor
          id="login-forgot-password"
          component="button"
          type="button"
          size="sm"
          onClick={() => setForgotPasswordOpened(true)}
          style={{ color: DEFAULT_THEME_COLOR, fontWeight: 500 }}
        >
          {t('forgotPassword')}
        </Anchor>

        <Button
          id="login-submit"
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
          {t('signIn')}
        </Button>

        <Divider label="OR" labelPosition="center" />

        <Button
          id="login-google"
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
          {t('signInWithGoogle')}
        </Button>

        <Text ta="center" size="sm" style={{ color: themeColors.colorTextMedium }}>
          {t('noAccount')}{' '}
          <Anchor id="login-signup-link" href="/signup" size="sm" style={{ color: DEFAULT_THEME_COLOR, fontWeight: 500 }}>
            {t('signUp')}
          </Anchor>
        </Text>
      </Stack>

      <Modal
        opened={forgotPasswordOpened}
        onClose={handleCloseForgotPassword}
        title={t('resetPassword')}
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
                {t('resetEmailSent', { email: forgotPasswordForm.values.email })}
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
              {tCommon('close')}
            </Button>
          </Stack>
        ) : (
          <form onSubmit={forgotPasswordForm.onSubmit(handleForgotPassword)}>
            <Stack gap="md">
              <Text size="sm" style={{ color: themeColors.colorTextMedium }}>
                {t('resetEmailPrompt')}
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
                id="login-reset-email"
                label={t('email')}
                placeholder={t('emailPlaceholder')}
                required
                leftSection={<IconMail size={18} />}
                size="lg"
                radius="md"
                disabled={resetLoading}
                {...forgotPasswordForm.getInputProps('email')}
              />

              <Group justify="flex-end" mt="md">
                <Button
                  id="login-reset-cancel"
                  variant="light"
                  onClick={handleCloseForgotPassword}
                  disabled={resetLoading}
                >
                  {tCommon('cancel')}
                </Button>
                <Button
                  id="login-reset-submit"
                  type="submit"
                  loading={resetLoading}
                  style={{
                    backgroundColor: DEFAULT_THEME_COLOR,
                    color: 'white',
                  }}
                >
                  {t('sendResetLink')}
                </Button>
              </Group>
            </Stack>
          </form>
        )}
      </Modal>

      <BranchSelectionModal
        opened={showBranchSelection}
        branches={branches}
        onSelect={handleBranchSelection}
        loading={branchSelectionLoading}
      />
    </form>
  );
}
