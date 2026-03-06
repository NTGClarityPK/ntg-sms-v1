'use client';

import { useEffect, useState } from 'react';
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
import { clearStudentToken } from '@/lib/student-session';
import { pinAuth, PinAuthError } from '@/lib/pin-auth';
import { supabase } from '@/lib/supabase/client';

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
  const [hasAnyPin, setHasAnyPin] = useState(false);
  const [pinMode, setPinMode] = useState<'none' | 'pin'>('none');
  const [pinIdentifier, setPinIdentifier] = useState('');
  const [pinValue, setPinValue] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinLoading, setPinLoading] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    async function checkAnyPin() {
      try {
        const available = await pinAuth.isPinAuthAvailable();
        if (!cancelled) {
          setHasAnyPin(available);
        }
      } catch {
        if (!cancelled) {
          setHasAnyPin(false);
        }
      }
    }
    checkAnyPin();
    return () => {
      cancelled = true;
    };
  }, []);

  const completeLoginAfterSupabaseSession = async () => {
    // Get user (for locale sync and role-based redirects)
    try {
      const userResponse = await apiClient.get<{
        preferredLocale?: string;
        roles?: Array<{ roleName?: string }>;
      }>('/api/v1/auth/me');
      const locale = userResponse.data?.preferredLocale ?? 'en';
      document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000; SameSite=Lax`;
      localStorage.setItem('locale', locale);

      const roles = userResponse.data?.roles ?? [];
      const normalisedRoleNames = roles
        .map((r) => r.roleName?.toLowerCase())
        .filter((name): name is string => !!name);

      const isSuperAdmin = normalisedRoleNames.includes('super_admin');
      if (isSuperAdmin) {
        window.location.href = '/adminportal';
        return;
      }

      const isSchoolAdmin = normalisedRoleNames.includes('school_admin');

      // Only school admins should be prompted to select a branch.
      // All other users (students, parents, etc.) skip branch selection and go straight to dashboard.
      if (!isSchoolAdmin) {
        window.location.href = '/dashboard';
        return;
      }
    } catch (userError: unknown) {
      console.error('Failed to check user role:', userError);
      // If we cannot determine the role, fall back to branch selection behaviour
      // so school admins are still able to choose a branch.
    }

    // Fetch user's branches for school admins
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

      // If user has multiple branches, show selection modal (deduplicate by id for Mantine Select)
      setBranches(
        Array.from(new Map((userBranches as Branch[]).map((b) => [b.id, b])).values()),
      );
      setShowBranchSelection(true);
      setLoading(false);
    } catch (branchError: any) {
      console.error('Failed to fetch branches:', branchError);
      setError('Failed to fetch branches. Please try again.');
      setLoading(false);
    }
  };

  const handleSubmit = async (values: typeof form.values) => {
    setLoading(true);
    setError(null);

    try {
      clearStudentToken();
      const result = await signIn(values.email, values.password);
      
      // Wait for session to be fully established in cookies
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      // Verify session was created
      if (!result.session) {
        throw new Error('Session not created');
      }

      await completeLoginAfterSupabaseSession();
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

  const handlePinLogin = async () => {
    const identifier = pinIdentifier.trim();
    if (!identifier) {
      setPinError('Please enter your email or roll number.');
      return;
    }
    if (!pinValue || pinValue.length < 4 || pinValue.length > 6 || !/^\d{4,6}$/.test(pinValue)) {
      setPinError('PIN must be a 4–6 digit number.');
      return;
    }
    setPinLoading(true);
    setPinError(null);
    setError(null);

    try {
      let email: string;
      if (identifier.includes('@')) {
        email = identifier.toLowerCase().trim();
      } else {
        const response = await apiClient.post<{ email: string }>(
          '/api/v1/public/resolve-student-roll',
          { rollNumber: identifier },
        );
        const resolved = response.data?.email;
        if (!resolved) {
          throw new Error('We could not find a student with that roll number.');
        }
        email = resolved;
      }

      const available = await pinAuth.isPinAuthAvailable(email);
      if (!available) {
        throw new PinAuthError(
          'NOT_SETUP',
          identifier.includes('@')
            ? 'PIN is not set up on this device. Please log in with email and password, then set up PIN.'
            : 'PIN not set up on this device. Please ask your parent to log in with your email and password first.',
        );
      }

      const { refreshToken, userEmail } = await pinAuth.authenticateWithPin(pinValue, email);

      const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
      if (error || !data.session) {
        pinAuth.clearPinAuth(userEmail);
        throw new Error(
          'Your PIN session is no longer valid. Please log in with your email and password and set up PIN again.',
        );
      }

      clearStudentToken();
      setPinIdentifier('');
      setPinValue('');
      setPinMode('none');
      await completeLoginAfterSupabaseSession();
    } catch (err) {
      let message =
        err instanceof Error ? err.message : 'Failed to login with PIN. Please try again.';
      if (err instanceof PinAuthError) {
        if (err.code === 'INVALID_PIN') {
          message = 'Incorrect PIN. Please try again.';
        } else if (err.code === 'PIN_LOCKED') {
          message = err.message;
        } else if (err.code === 'NOT_SETUP' || err.code === 'CORRUPTED') {
          message = err.message;
        }
      }
      setPinError(message);
    } finally {
      setPinLoading(false);
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
    <>
      <Stack gap="lg">
        <Box>
          <Title order={2} size="1.8rem" fw={700} mb="xs" style={{ color: themeColors.colorTextDark }}>
            {t('signInTitle')}
          </Title>
          <Text size="sm" style={{ color: themeColors.colorTextMedium }}>
            {t('signInSubtitle')}
          </Text>
        </Box>

        <Box component="form" id="login-form" onSubmit={form.onSubmit(handleSubmit)}>
            <Stack gap="md">
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

              {hasAnyPin && (
                <>
                  <Divider label={t('orSeparator')} labelPosition="center" />
                  <Group justify="center" gap="sm">
                    <Button
                      id="login-pin-toggle"
                      variant={pinMode === 'pin' ? 'filled' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setPinMode((prev) => (prev === 'pin' ? 'none' : 'pin'));
                        setPinError(null);
                      }}
                    >
                      Login with PIN
                    </Button>
                  </Group>
                </>
              )}

              {hasAnyPin && pinMode === 'pin' && (
                <Stack gap="sm">
                  <TextInput
                    id="login-pin-identifier"
                    label="Email or roll number"
                    placeholder="Enter your email or roll number"
                    value={pinIdentifier}
                    onChange={(e) => setPinIdentifier(e.currentTarget.value)}
                    disabled={pinLoading}
                  />
                  <PasswordInput
                    id="login-pin-value"
                    label={t('pinLoginPin')}
                    placeholder={t('pinLoginPinPlaceholder')}
                    value={pinValue}
                    onChange={(e) =>
                      setPinValue(e.currentTarget.value.replace(/\D/g, '').slice(0, 6))
                    }
                    maxLength={6}
                    disabled={pinLoading}
                  />
                  {pinError && (
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
                      {pinError}
                    </Alert>
                  )}
                  <Button
                    id="login-pin-submit"
                    fullWidth
                    size="lg"
                    radius="md"
                    loading={pinLoading}
                    onClick={handlePinLogin}
                    style={{
                      backgroundColor: DEFAULT_THEME_COLOR,
                      color: 'white',
                    }}
                  >
                    Login with PIN
                  </Button>
                </Stack>
              )}
            </Stack>
          </Box>
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
    </>
  );
}
