'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Title,
  TextInput,
  PasswordInput,
  Button,
  Stack,
  Text,
  Anchor,
  Alert,
  Stepper,
  Group,
  Select,
  Divider,
  Tabs,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertCircle, IconMail, IconLock, IconUser, IconPhone, IconCheck, IconBuilding, IconBrandGoogle } from '@tabler/icons-react';
import { authApi } from '@/lib/api/auth';
import { API_ENDPOINTS } from '@/lib/constants/api';
import { useAuthStore } from '@/lib/store/auth-store';
import { useBranchStore } from '@/lib/store/branch-store';
import { useLanguageStore } from '@/lib/store/language-store';
import { t } from '@/lib/utils/translations';
import { useErrorColor, useInfoColor, useSuccessColor } from '@/lib/hooks/use-theme-colors';
import { DEFAULT_THEME_COLOR } from '@/lib/utils/theme';
import { useTheme } from '@/lib/hooks/use-theme';
import { useThemeColor } from '@/lib/hooks/use-theme-color';
import { generateThemeColors } from '@/lib/utils/themeColors';
import { getUserTimezone, getCurrencyFromTimezone, getCurrencyLabel, getCurrencyOptions } from '@/lib/utils/region-currency';

type SignupMethod = 'google' | 'email' | null;

export default function SignupPage() {
  const router = useRouter();
  const { language } = useLanguageStore();
  const { setUser } = useAuthStore();
  const { setSelectedBranchId: setBranchStoreId } = useBranchStore();
  const errorColor = useErrorColor();
  const infoColor = useInfoColor();
  const successColor = useSuccessColor();
  const { isDark } = useTheme();
  const primaryColor = useThemeColor();
  const themeColors = useMemo(() => generateThemeColors(primaryColor, isDark), [primaryColor, isDark]);
  const [signupMethod, setSignupMethod] = useState<SignupMethod>(null);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Detect timezone and currency on mount (before form initialization)
  const [detectedTimezone, setDetectedTimezone] = useState<string | null>(null);
  const [initialCurrency] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const timezone = getUserTimezone();
      return getCurrencyFromTimezone(timezone);
    }
    return 'IQD';
  });

  // Set detected timezone after initial render (only once)
  useEffect(() => {
    if (typeof window !== 'undefined' && detectedTimezone === null) {
      const timezone = getUserTimezone();
      setDetectedTimezone(timezone);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Google signup form (only restaurant name and currency)
  const googleForm = useForm({
    initialValues: {
      restaurantName: '',
      defaultCurrency: initialCurrency,
    },
    validate: {
      restaurantName: (value) => (value.length < 2 ? t('auth.restaurantNameMinLength', language) : null),
    },
  });

  // Email signup form
  const emailForm = useForm({
    initialValues: {
      email: '',
      password: '',
      confirmPassword: '',
      name: '',
      phone: '',
      restaurantName: '',
      defaultCurrency: initialCurrency,
    },
    validate: {
      email: (value) => (/^\S+@\S+$/.test(value) ? null : t('auth.invalidEmail', language)),
      password: (value) => (value.length < 6 ? t('auth.passwordMinLength', language) : null),
      confirmPassword: (value, values) =>
        value !== values.password ? t('auth.passwordsDoNotMatch', language) : null,
      name: (value) => (value.length < 2 ? t('auth.nameMinLength', language) : null),
      restaurantName: (value) => (value.length < 2 ? t('auth.restaurantNameMinLength', language) : null),
      phone: (value) => {
        if (!value || value.trim() === '') return null; // Phone is optional
        // Remove common formatting characters
        const cleaned = value.replace(/[\s\-\(\)\+]/g, '');
        // Check if it's all digits
        if (!/^\d+$/.test(cleaned)) {
          return t('auth.phoneNumberDigitsOnly', language);
        }
        // Check length (7-15 digits)
        if (cleaned.length < 7 || cleaned.length > 15) {
          return t('auth.phoneNumberLength', language);
        }
        // Reject if all digits are the same
        if (/^(\d)\1+$/.test(cleaned)) {
          return t('auth.phoneNumberInvalid', language);
        }
        // Reject sequential patterns
        const isSequential = (str: string) => {
          const digits = str.split('').map(Number);
          let ascending = true;
          let descending = true;
          for (let i = 1; i < digits.length; i++) {
            if (digits[i] !== digits[i - 1] + 1) ascending = false;
            if (digits[i] !== digits[i - 1] - 1) descending = false;
          }
          return ascending || descending;
        };
        if (isSequential(cleaned)) {
          return t('auth.phoneNumberInvalid', language);
        }
        return null;
      },
    },
  });

  const nextStep = () => {
    if (signupMethod === 'email') {
      if (active === 0) {
        // Validate step 1: Basic Information
        emailForm.validateField('email');
        emailForm.validateField('name');
        emailForm.validateField('restaurantName');
        emailForm.validateField('phone');
        const step1Valid = emailForm.validateField('email').hasError === false &&
          emailForm.validateField('name').hasError === false &&
          emailForm.validateField('restaurantName').hasError === false &&
          emailForm.validateField('phone').hasError === false;
        if (step1Valid) {
          setActive((current) => (current < 2 ? current + 1 : current));
        }
      } else if (active === 1) {
        // Validate step 2: Password
        const step2Valid = emailForm.validateField('password').hasError === false &&
          emailForm.validateField('confirmPassword').hasError === false;
        if (step2Valid) {
          setActive((current) => (current < 2 ? current + 1 : current));
        }
      }
    }
  };

  const prevStep = () => setActive((current) => (current > 0 ? current - 1 : current));

  // Memoize currency options to prevent re-renders
  const currencyOptions = useMemo(() => getCurrencyOptions(language), [language]);
  
  // Memoize currency label for review step
  const emailCurrencyLabel = useMemo(
    () => getCurrencyLabel(emailForm.values.defaultCurrency, language),
    [emailForm.values.defaultCurrency, language]
  );

  const googleCurrencyLabel = useMemo(
    () => getCurrencyLabel(googleForm.values.defaultCurrency, language),
    [googleForm.values.defaultCurrency, language]
  );

  // Validate phone and restaurant name when entering review step
  useEffect(() => {
    if (active === 2 && signupMethod === 'email') {
      emailForm.validateField('phone');
      emailForm.validateField('restaurantName');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, signupMethod]);

  const handleGoogleSignup = async (values: typeof googleForm.values) => {
    setLoading(true);
    setError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
      
      // Encode restaurant info in state parameter (same as backend does)
      const state = btoa(JSON.stringify({
        restaurantName: values.restaurantName,
        defaultCurrency: values.defaultCurrency,
        isSignup: true,
      }));
      
      // Redirect to Google OAuth with state
      window.location.href = `${apiUrl}${API_ENDPOINTS.AUTH.GOOGLE}?state=${encodeURIComponent(state)}`;
    } catch (err: any) {
      console.log("Error", err);
      const errorMsg = err.message || t('auth.failedToInitiateGoogleSignup', language);
      setError(errorMsg);
      setLoading(false);
    }
  };

  const handleEmailSignup = async (values: typeof emailForm.values) => {
    setLoading(true);
    setError(null);

    try {
      const { confirmPassword, ...signupData } = values;
      const response = await authApi.signup(signupData);
      // Map response to User type (handle both old and new API formats)
      const user = {
        ...response.user,
        name: response.user.name || (response.user as any).nameEn || (response.user as any).nameAr || 'User',
      };
      setUser(user);
      
      // If branchId is in the response (meaning there's exactly one branch), set it
      if (response.branchId) {
        setBranchStoreId(response.branchId);
      }

      router.push('/portal/dashboard');
    } catch (err: any) {
      console.log("Error", err);
      const errorMsg = err.response?.data?.error?.message || t('auth.signupFailed', language);
      setError(errorMsg);
      setLoading(false);
    }
  };

  // Show method selection if no method is selected
  if (!signupMethod) {
    return (
      <Stack gap="lg">
        <Box>
          <Title order={2} size="1.8rem" fw={700} mb="xs" style={{ color: themeColors.colorTextDark }}>
            {t('auth.signupTitle', language)}
          </Title>
          <Text size="sm" style={{ color: themeColors.colorTextMedium }}>
            {t('auth.createAccountToStart', language)}
          </Text>
        </Box>

        <Stack gap="md">
          <Button
            size="lg"
            radius="md"
            leftSection={<IconBrandGoogle size={20} />}
            onClick={() => setSignupMethod('google')}
            style={{
              backgroundColor: '#4285F4',
              color: 'white',
            }}
            fullWidth
          >
            {t('auth.signUpWithGoogle', language)}
          </Button>

          <Divider 
            label={t('auth.or', language)} 
            labelPosition="center" 
            my="md"
          />

          <Button
            size="lg"
            radius="md"
            leftSection={<IconMail size={20} />}
            onClick={() => setSignupMethod('email')}
            style={{
              backgroundColor: DEFAULT_THEME_COLOR,
              color: 'white',
            }}
            fullWidth
          >
            {t('auth.signUpWithEmail', language)}
          </Button>
        </Stack>

        <Text ta="center" size="sm" style={{ color: themeColors.colorTextMedium }}>
          {t('auth.hasAccount', language)}{' '}
          <Anchor href="/login" size="sm" style={{ color: DEFAULT_THEME_COLOR, fontWeight: 500 }}>
            {t('common.login' as any, language)}
          </Anchor>
        </Text>
      </Stack>
    );
  }

  // Google signup form
  if (signupMethod === 'google') {
    return (
      <form onSubmit={googleForm.onSubmit(handleGoogleSignup)}>
        <Stack gap="lg">
          <Box>
            <Button
              variant="subtle"
              size="sm"
              onClick={() => setSignupMethod(null)}
              style={{ marginBottom: '1rem',      color: DEFAULT_THEME_COLOR }}
            >
              {t('auth.back', language)}
            </Button>
            <Title order={2} size="1.8rem" fw={700} mb="xs" style={{ color: themeColors.colorTextDark }}>
              {t('auth.signUpWithGoogle', language)}
            </Title>
            <Text size="sm" style={{ color: themeColors.colorTextMedium }}>
              {t('auth.googleSignupDescription', language)}
            </Text>
          </Box>

          <Stack gap="md">
            <TextInput
              label={t('auth.restaurantName', language)}
              placeholder={t('auth.restaurantNamePlaceholder', language)}
              required
              leftSection={<IconBuilding size={18} />}
              size="lg"
              radius="md"
              disabled={loading}
              {...googleForm.getInputProps('restaurantName')}
            />

            <Select
              label={t('auth.currency', language)}
              description={t('auth.currencyAutoDetected', language).replace('{timezone}', detectedTimezone || t('auth.unknown', language))}
              required
              data={currencyOptions}
              size="lg"
              radius="md"
              disabled={loading}
              {...googleForm.getInputProps('defaultCurrency')}
            />

            <Alert 
              icon={<IconAlertCircle size={16} />}
              style={{
                backgroundColor: `${infoColor}15`,
                borderColor: infoColor,
                color: infoColor,
              }}
              variant="light" 
              radius="md"
            >
              <Text size="sm">
                {t('auth.currencyCannotChange', language)}
              </Text>
            </Alert>

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
              type="submit"
              loading={loading}
              size="lg"
              radius="md"
              leftSection={<IconBrandGoogle size={20} />}
              style={{
                backgroundColor: '#4285F4',
                color: 'white',
              }}
              fullWidth
            >
              {t('auth.continueWithGoogle', language)}
            </Button>
          </Stack>

          <Text ta="center" size="sm" style={{ color: themeColors.colorTextMedium }}>
            {t('auth.hasAccount', language)}{' '}
            <Anchor href="/login" size="sm" style={{ color: DEFAULT_THEME_COLOR, fontWeight: 500 }}>
              {t('common.login' as any, language)}
            </Anchor>
          </Text>
        </Stack>
      </form>
    );
  }

  // Email signup form (existing stepper-based form)
  return (
    <form onSubmit={emailForm.onSubmit(handleEmailSignup)}>
      <Stack gap="lg">
        <Box>
          <Button
            variant="subtle"
            size="sm"
            onClick={() => {
              setSignupMethod(null);
              setActive(0);
            }}
            style={{ marginBottom: '1rem', color: DEFAULT_THEME_COLOR }}
          >
            {t('auth.back', language)}
          </Button>
          <Title order={2} size="1.8rem" fw={700} mb="xs" style={{ color: themeColors.colorTextDark }}>
            {t('auth.signupTitle', language)}
          </Title>
          <Text size="sm" style={{ color: themeColors.colorTextMedium }}>
            {t('auth.createAccountToStart', language)}
          </Text>
        </Box>

        <Stepper active={active} onStepClick={setActive} size="sm">
          <Stepper.Step
            label={t('auth.basicInfo', language)}
            description={t('auth.personalDetails', language)}
            icon={<IconUser size={18} />}
          >
            <Stack gap="md" mt="xl">
              <TextInput
                label={t('common.email' as any, language)}
                placeholder="your@email.com"
                required
                leftSection={<IconMail size={18} />}
                size="lg"
                radius="md"
                autoComplete="email"
                disabled={loading}
                {...emailForm.getInputProps('email')}
              />

              <TextInput
                label={t('common.name' as any, language) || 'Name'}
                placeholder={t('auth.namePlaceholder', language)}
                required
                leftSection={<IconUser size={18} />}
                size="lg"
                radius="md"
                disabled={loading}
                {...emailForm.getInputProps('name')}
              />

              <TextInput
                label={t('common.phone' as any, language)}
                placeholder="+9647501234567"
                leftSection={<IconPhone size={18} />}
                size="lg"
                radius="md"
                disabled={loading}
                {...emailForm.getInputProps('phone')}
              />

              <TextInput
                label={t('auth.restaurantName', language)}
                placeholder={t('auth.restaurantNamePlaceholder', language)}
                required
                leftSection={<IconBuilding size={18} />}
                size="lg"
                radius="md"
                disabled={loading}
                {...emailForm.getInputProps('restaurantName')}
              />

              <Select
                label={t('auth.currency', language)}
                description={t('auth.currencyAutoDetected', language).replace('{timezone}', detectedTimezone || t('auth.unknown', language))}
                required
                data={currencyOptions}
                size="lg"
                radius="md"
                disabled={loading}
                {...emailForm.getInputProps('defaultCurrency')}
              />

              <Alert 
                icon={<IconAlertCircle size={16} />}
                style={{
                  backgroundColor: `${infoColor}15`,
                  borderColor: infoColor,
                  color: infoColor,
                }}
                variant="light" 
                radius="md"
              >
                <Text size="sm">
                  {t('auth.currencyCannotChange', language)}
                </Text>
              </Alert>
            </Stack>
          </Stepper.Step>

          <Stepper.Step
            label={t('auth.password', language)}
            description={t('auth.secureAccount', language)}
            icon={<IconLock size={18} />}
          >
            <Stack gap="md" mt="xl">
              <PasswordInput
                label={t('common.password' as any, language)}
                placeholder={t('auth.enterPassword', language)}
                required
                leftSection={<IconLock size={18} />}
                size="lg"
                radius="md"
                autoComplete="new-password"
                disabled={loading}
                {...emailForm.getInputProps('password')}
              />

              <PasswordInput
                label={t('auth.confirmPassword', language)}
                placeholder={t('auth.confirmPasswordPlaceholder', language)}
                required
                leftSection={<IconLock size={18} />}
                size="lg"
                radius="md"
                autoComplete="new-password"
                disabled={loading}
                {...emailForm.getInputProps('confirmPassword')}
              />

              <Alert 
                style={{
                  backgroundColor: `${infoColor}15`,
                  borderColor: infoColor,
                  color: infoColor,
                }}
                variant="light" 
                radius="md"
              >
                <Text size="sm">
                  {t('auth.passwordSecurityInfo', language)}
                </Text>
              </Alert>
            </Stack>
          </Stepper.Step>

          <Stepper.Step
            label={t('auth.review', language)}
            description={t('auth.reviewInfo', language)}
            icon={<IconCheck size={18} />}
          >
            <Stack gap="md" mt="xl">
              <Box>
                <Text size="sm" mb="xs" style={{ color: themeColors.colorTextMedium }}>{t('common.email' as any, language)}</Text>
                <Text fw={500} style={{ color: themeColors.colorTextDark }}>{emailForm.values.email}</Text>
              </Box>

              <Box>
                <Text size="sm" mb="xs" style={{ color: themeColors.colorTextMedium }}>{t('common.name' as any, language) || 'Name'}</Text>
                <Text fw={500} style={{ color: themeColors.colorTextDark }}>{emailForm.values.name}</Text>
              </Box>

              <Box>
                <Text size="sm" mb="xs" style={{ color: themeColors.colorTextMedium }}>{t('auth.restaurantName', language)}</Text>
                <Text fw={500} style={{ color: themeColors.colorTextDark }}>{emailForm.values.restaurantName}</Text>
              </Box>

              {emailForm.values.phone && (
                <Box>
                  <Text size="sm" mb="xs" style={{ color: themeColors.colorTextMedium }}>{t('common.phone' as any, language)}</Text>
                  <Text fw={500} style={{ color: themeColors.colorTextDark }}>{emailForm.values.phone}</Text>
                </Box>
              )}
              {emailForm.errors.phone && (
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
                  {emailForm.errors.phone}
                </Alert>
              )}

              <Box>
                <Text size="sm" mb="xs" style={{ color: themeColors.colorTextMedium }}>{t('auth.currency', language)}</Text>
                <Text fw={500} style={{ color: themeColors.colorTextDark }}>
                  {emailCurrencyLabel}
                </Text>
                {detectedTimezone && (
                  <Text size="xs" style={{ color: themeColors.colorTextMedium, marginTop: '4px' }}>
                    {t('auth.currencyDetectedFrom', language).replace('{timezone}', detectedTimezone)}
                  </Text>
                )}
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
            </Stack>
          </Stepper.Step>

          <Stepper.Completed>
            <Stack gap="md" mt="xl">
              <Alert 
                style={{
                  backgroundColor: `${successColor}15`,
                  borderColor: successColor,
                  color: successColor,
                }}
                variant="light" 
                radius="md"
              >
                <Text size="sm" fw={500}>
                  {t('auth.accountCreatedSuccess', language)}
                </Text>
              </Alert>
            </Stack>
          </Stepper.Completed>
        </Stepper>

        <Group justify="space-between" mt="xl">
          {active > 0 && (
            <Button 
              variant="default" 
              onClick={prevStep} 
              disabled={loading}
              style={{
                backgroundColor: isDark ? themeColors.colorMedium : '#f5f5f5',
                color: themeColors.colorTextDark,
                borderColor: themeColors.borderLight,
              }}
            >
              {t('common.previousStep' as any, language)}
            </Button>
          )}
          {active === 0 && (
            <div /> // Spacer
          )}
          {active < 2 ? (
            <Button 
              onClick={nextStep} 
              disabled={loading}
              style={{
                backgroundColor: DEFAULT_THEME_COLOR,
                color: 'white',
              }}
            >
              {t('common.nextStep' as any, language)}
            </Button>
          ) : (
            <Button
              type="submit"
              loading={loading}
              size="lg"
              radius="md"
              leftSection={<IconCheck size={16} />}
              style={{
                backgroundColor: DEFAULT_THEME_COLOR,
                color: 'white',
              }}
            >
              {t('common.signup' as any, language)}
            </Button>
          )}
        </Group>

        <Text ta="center" size="sm" style={{ color: themeColors.colorTextMedium }}>
          {t('auth.hasAccount', language)}{' '}
          <Anchor href="/login" size="sm" style={{ color: DEFAULT_THEME_COLOR, fontWeight: 500 }}>
            {t('common.login' as any, language)}
          </Anchor>
        </Text>
      </Stack>
    </form>
  );
}
