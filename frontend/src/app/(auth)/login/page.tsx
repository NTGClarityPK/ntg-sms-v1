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
import { clearLogoutInProgress, signIn } from '@/lib/auth';
import { useErrorColor } from '@/lib/hooks/use-theme-colors';
import { useTheme } from '@/lib/hooks/use-theme';
import { useThemeColor } from '@/lib/hooks/use-theme-color';
import { generateThemeColors } from '@/lib/utils/themeColors';
import { apiClient, getEffectiveApiBaseURL } from '@/lib/api-client';
import { DEFAULT_THEME_COLOR } from '@/lib/utils/theme';
import {
  completeSessionRouting,
  selectBranchAndGoDashboard,
} from '@/lib/auth/complete-session-routing';
import { BranchSelectionModal } from '@/components/common/BranchSelectionModal';
import { useThemeStore } from '@/lib/store/theme-store';
import { clearStudentToken } from '@/lib/student-session';
import { pinAuth, PinAuthError } from '@/lib/pin-auth';
import { supabase } from '@/lib/supabase/client';

interface Branch {
  id: string;
  name: string;
  code: string;
  tenantId: string;
}

const LOGIN_PRIMARY_COLOR = '#4A7C59';

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
  const [isInactiveFlashError, setIsInactiveFlashError] = useState(false);
  const [forgotPasswordOpened, setForgotPasswordOpened] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [resetDeliveredToEmail, setResetDeliveredToEmail] = useState<string | null>(null);
  const [resetNeedsConfirm, setResetNeedsConfirm] = useState(false);
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
    clearLogoutInProgress();
    const flash = typeof window !== 'undefined'
      ? window.sessionStorage.getItem('ntg_auth_inactive_message')
      : null;
    if (flash) {
      window.sessionStorage.removeItem('ntg_auth_inactive_message');
      setError(flash);
      setIsInactiveFlashError(true);
    }
  }, []);

  useEffect(() => {
    if (!isInactiveFlashError || !error) return;
    const t = window.setTimeout(() => {
      setError(null);
      setIsInactiveFlashError(false);
    }, 5000);
    return () => window.clearTimeout(t);
  }, [isInactiveFlashError, error]);

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
    await completeSessionRouting({
      router,
      setError,
      setLoading,
      setPrimaryColor,
      onMultiBranch: (branchList) => {
        setBranches(
          branchList.map((b) => ({
            id: b.id,
            name: b.name,
            code: b.code ?? '',
            tenantId: b.tenantId ?? '',
          })),
        );
        setShowBranchSelection(true);
      },
    });
  };

  // OAuth callbacks are handled by /auth/callback. Redirect there if user lands on /login with hash.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.location.hash?.includes('access_token=')) return;
    const u = new URL(window.location.href);
    u.pathname = '/auth/callback';
    window.location.replace(u.toString());
  }, []);

  const handleSubmit = async (values: typeof form.values) => {
    setLoading(true);
    setError(null);

    try {
      clearStudentToken();
      const result = await signIn(values.email, values.password);

      // Verify session was created
      if (!result.session) {
        throw new Error('Session not created');
      }

      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('ntg_alma_show_tours_modal', '1');
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

      // Supabase often returns the same message for wrong password and blocked users.
      // If credentials look invalid, do a server-side inactive-status probe to improve UX.
      if (
        typeof errorMsg === 'string' &&
        errorMsg.toLowerCase().includes('invalid login credentials')
      ) {
        try {
          const statusRes = await apiClient.post<{ inactive: boolean; message?: string }>(
            '/api/v1/public/login-status',
            { email: values.email },
          );
          if (statusRes.data?.inactive) {
            errorMsg =
              statusRes.data.message ||
              'Your account has been marked as inactive. Please contact your administrator.';
          }
        } catch {
          // Keep original login error if status probe fails.
        }
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
      // PIN login is temporarily restricted to students only.
      // Staff/parents should use email + password login.
      if (identifier.includes('@')) {
        throw new Error('PIN login is currently available for students only. Please use email and password.');
      }

      const response = await apiClient.post<{ email: string }>(
        '/api/v1/public/resolve-student-roll',
        { rollNumber: identifier },
      );
      const resolved = response.data?.email;
      if (!resolved) {
        throw new Error('We could not find a student with that roll number.');
      }
      const email = resolved;

      // Student PIN must be tied to this student email (no global fallback).
      const { refreshToken, userEmail } = await pinAuth.authenticateWithPin(pinValue, email);

      const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
      if (error || !data.session) {
        pinAuth.clearPinAuth(userEmail);
        throw new Error(
          'Your PIN session is no longer valid. Please log in with your email and password and set up PIN again.',
        );
      }

      // Supabase refresh tokens can rotate. Persist the latest refresh token so PIN keeps working
      // after logout/login cycles and future session refreshes.
      try {
        const rotatedRefreshToken = data.session.refresh_token || refreshToken;
        await pinAuth.setupPinAuth(pinValue, rotatedRefreshToken, userEmail);
      } catch {
        // Non-blocking: user is logged in; PIN persistence will still work in most cases.
      }

      clearStudentToken();
      setPinIdentifier('');
      setPinValue('');
      setPinMode('none');

      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('ntg_alma_show_tours_modal', '1');
      }

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
      setShowBranchSelection(false);
      await selectBranchAndGoDashboard(branchId, router, setPrimaryColor);
    } catch (err: unknown) {
      console.error('Failed to select branch:', err);
      setError('Failed to select branch. Please try again.');
    } finally {
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
      const email = values.email.normalize('NFKC').trim().toLowerCase();
      const res = await apiClient.post<{
        ok: true;
        deliveredToEmail?: string;
        usedAssociatedEmail?: boolean;
        requiresConfirmation?: boolean;
      }>('/api/v1/public/request-password-reset', { email });
      forgotPasswordForm.setFieldValue('email', email);
      const deliveredTo = res.data?.deliveredToEmail ?? null;
      const needsConfirm = res.data?.requiresConfirmation === true;
      setResetDeliveredToEmail(deliveredTo);
      setResetNeedsConfirm(needsConfirm);
      if (!needsConfirm) {
        setResetEmailSent(true);
      }
    } catch (err: unknown) {
      const ax = err as {
        response?: { data?: { error?: { message?: string } } };
        message?: string;
      };
      setResetError(
        ax.response?.data?.error?.message ||
          (typeof ax.message === 'string' ? ax.message : '') ||
          'Failed to send reset email. Please try again.',
      );
    } finally {
      setResetLoading(false);
    }
  };

  const handleConfirmSendResetToProvided = async () => {
    setResetLoading(true);
    setResetError(null);
    try {
      const email = forgotPasswordForm.values.email.normalize('NFKC').trim().toLowerCase();
      const res = await apiClient.post<{
        ok: true;
        deliveredToEmail?: string;
        usedAssociatedEmail?: boolean;
        requiresConfirmation?: boolean;
      }>('/api/v1/public/request-password-reset', { email, confirmSendToProvided: true });
      setResetDeliveredToEmail(res.data?.deliveredToEmail ?? email);
      setResetNeedsConfirm(false);
      setResetEmailSent(true);
    } catch (err: unknown) {
      const ax = err as {
        response?: { data?: { error?: { message?: string } } };
        message?: string;
      };
      setResetError(
        ax.response?.data?.error?.message ||
          (typeof ax.message === 'string' ? ax.message : '') ||
          'Failed to send reset email. Please try again.',
      );
    } finally {
      setResetLoading(false);
    }
  };

  const handleCloseForgotPassword = () => {
    setForgotPasswordOpened(false);
    setResetEmailSent(false);
    setResetDeliveredToEmail(null);
    setResetNeedsConfirm(false);
    setResetError(null);
    forgotPasswordForm.reset();
  };

  return (
    <>
      <Box pos="relative">
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
                style={{ color: LOGIN_PRIMARY_COLOR, fontWeight: 500 }}
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
                  backgroundColor: LOGIN_PRIMARY_COLOR,
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
                  borderColor: LOGIN_PRIMARY_COLOR,
                  color: LOGIN_PRIMARY_COLOR,
                }}
              >
                {t('signInWithGoogle')}
              </Button>

              <Text ta="center" size="sm" style={{ color: themeColors.colorTextMedium }}>
                {t('noAccount')}{' '}
                <Anchor id="login-signup-link" href="/signup" size="sm" style={{ color: LOGIN_PRIMARY_COLOR, fontWeight: 500 }}>
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
                    label="Student roll number"
                    placeholder="Enter student roll number"
                    value={pinIdentifier}
                    onChange={(e) =>
                      setPinIdentifier(e.currentTarget.value.replace(/[^0-9A-Za-z_-]/g, ''))
                    }
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
                      backgroundColor: LOGIN_PRIMARY_COLOR,
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
      </Box>

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
                {t('resetEmailSent', { email: resetDeliveredToEmail || forgotPasswordForm.values.email })}
              </Text>
            </Alert>
            <Button
              onClick={handleCloseForgotPassword}
              fullWidth
              style={{
                backgroundColor: LOGIN_PRIMARY_COLOR,
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

              {resetNeedsConfirm && (
                <Alert
                  icon={<IconAlertCircle size={16} />}
                  variant="light"
                  radius="md"
                  color="yellow"
                >
                  <Text size="sm">
                    {t('resetNoAssociatedEmailConfirm')}
                  </Text>
                </Alert>
              )}

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
                    backgroundColor: LOGIN_PRIMARY_COLOR,
                    color: 'white',
                  }}
                >
                  {t('sendResetLink')}
                </Button>
                {resetNeedsConfirm && (
                  <Button
                    id="login-reset-confirm-send"
                    variant="outline"
                    loading={resetLoading}
                    onClick={() => void handleConfirmSendResetToProvided()}
                  >
                    {t('confirmSend')}
                  </Button>
                )}
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
        continueButtonColor={DEFAULT_THEME_COLOR}
      />
    </>
  );
}
