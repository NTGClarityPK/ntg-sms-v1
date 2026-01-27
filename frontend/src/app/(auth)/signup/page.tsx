'use client';

import { useState } from 'react';
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
} from '@mantine/core';
import { useForm } from '@mantine/form';
import {
  IconAlertCircle,
  IconMail,
  IconLock,
  IconUser,
  IconPhone,
  IconCheck,
  IconSchool,
  IconBuilding,
} from '@tabler/icons-react';
import { apiClient } from '@/lib/api-client';
import { DEFAULT_THEME_COLOR } from '@/lib/utils/theme';
import { useErrorColor, useInfoColor, useSuccessColor } from '@/lib/hooks/use-theme-colors';
import { useTheme } from '@/lib/hooks/use-theme';
import { useThemeColor } from '@/lib/hooks/use-theme-color';
import { generateThemeColors } from '@/lib/utils/themeColors';
import { signIn } from '@/lib/auth';

interface RegisterData {
  // School/Tenant
  schoolName: string;
  schoolCode: string;
  schoolDomain: string;
  // Branch
  branchName: string;
  branchCode: string;
  branchAddress: string;
  branchPhone: string;
  branchEmail: string;
  // Admin User
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  phone: string;
}

export default function SignupPage() {
  const router = useRouter();
  const errorColor = useErrorColor();
  const infoColor = useInfoColor();
  const successColor = useSuccessColor();
  const { isDark } = useTheme();
  const primaryColor = useThemeColor();
  const themeColors = generateThemeColors(primaryColor, isDark);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<RegisterData>({
    initialValues: {
      schoolName: '',
      schoolCode: '',
      schoolDomain: '',
      branchName: '',
      branchCode: '',
      branchAddress: '',
      branchPhone: '',
      branchEmail: '',
      email: '',
      password: '',
      confirmPassword: '',
      fullName: '',
      phone: '',
    },
    validateInputOnBlur: true,
    validateInputOnChange: false,
    validate: {
      schoolName: (value) => (value.length < 2 ? 'School name must be at least 2 characters' : null),
      branchName: (value) => (value.length < 2 ? 'Branch name must be at least 2 characters' : null),
      email: (value) => (/^\S+@\S+$/.test(value) ? null : 'Invalid email'),
      password: (value) => (value.length < 6 ? 'Password must be at least 6 characters' : null),
      confirmPassword: (value, values) =>
        value !== values.password ? 'Passwords do not match' : null,
      fullName: (value) => (value.length < 2 ? 'Full name must be at least 2 characters' : null),
    },
  });

  const nextStep = () => {
    if (active === 0) {
      // Validate step 1: School Information before moving to step 2
      const validation = form.validateField('schoolName');
      if (!validation.hasError) {
        // Clear any errors from other steps when moving forward
        form.clearFieldError('branchName');
        form.clearFieldError('email');
        form.clearFieldError('password');
        form.clearFieldError('confirmPassword');
        form.clearFieldError('fullName');
        setActive((current) => (current < 3 ? current + 1 : current));
      }
    } else if (active === 1) {
      // Validate step 2: Branch Details before moving to step 3
      const validation = form.validateField('branchName');
      if (!validation.hasError) {
        // Clear any errors from other steps when moving forward
        form.clearFieldError('email');
        form.clearFieldError('password');
        form.clearFieldError('confirmPassword');
        form.clearFieldError('fullName');
        setActive((current) => (current < 3 ? current + 1 : current));
      }
    } else if (active === 2) {
      // Validate step 3: Admin Account before moving to step 4
      const emailValidation = form.validateField('email');
      const passwordValidation = form.validateField('password');
      const confirmPasswordValidation = form.validateField('confirmPassword');
      const fullNameValidation = form.validateField('fullName');
      
      if (
        !emailValidation.hasError &&
        !passwordValidation.hasError &&
        !confirmPasswordValidation.hasError &&
        !fullNameValidation.hasError
      ) {
        setActive((current) => (current < 3 ? current + 1 : current));
      }
    }
  };

  const prevStep = () => {
    // Clear errors when going back
    if (active === 1) {
      form.clearFieldError('branchName');
    } else if (active === 2) {
      form.clearFieldError('email');
      form.clearFieldError('password');
      form.clearFieldError('confirmPassword');
      form.clearFieldError('fullName');
    }
    setActive((current) => (current > 0 ? current - 1 : current));
  };

  const handleSubmit = async (values: RegisterData) => {
    setLoading(true);
    setError(null);

    try {
      // Call registration API
      const { confirmPassword, ...registerData } = values;
      const response = await apiClient.post<{
        user: {
          id: string;
          email: string;
          fullName: string;
          tenantId: string;
          branchId: string;
        };
        accessToken: string;
        refreshToken: string;
      }>('/api/v1/auth/register', {
        schoolName: registerData.schoolName,
        schoolCode: registerData.schoolCode || undefined,
        schoolDomain: registerData.schoolDomain || undefined,
        branchName: registerData.branchName,
        branchCode: registerData.branchCode || undefined,
        branchAddress: registerData.branchAddress || undefined,
        branchPhone: registerData.branchPhone || undefined,
        branchEmail: registerData.branchEmail || undefined,
        email: registerData.email,
        password: registerData.password,
        fullName: registerData.fullName,
        phone: registerData.phone || undefined,
      });

      // Auto-login after successful registration
      try {
        await signIn(values.email, values.password);
        // Wait for session to be established
        await new Promise((resolve) => setTimeout(resolve, 500));
        router.push('/dashboard');
      } catch (loginError) {
        // Registration succeeded but auto-login failed - redirect to login page
        router.push('/login?registered=true');
      }
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        'Registration failed. Please try again.';
      setError(errorMsg);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Stack gap="lg">
        <Box>
          <Title order={2} size="1.8rem" fw={700} mb="xs" style={{ color: themeColors.colorTextDark }}>
            Create School Account
          </Title>
          <Text size="sm" style={{ color: themeColors.colorTextMedium }}>
            Register your school and get started with our management system
          </Text>
        </Box>

        <Stepper active={active} onStepClick={setActive} size="sm">
          <Stepper.Step
            label="School Information"
            description="Basic school details"
            icon={<IconSchool size={18} />}
          >
            <Stack gap="md" mt="xl">
              <TextInput
                label="School Name"
                placeholder="Alekaf High School"
                required
                leftSection={<IconSchool size={18} />}
                size="lg"
                radius="md"
                disabled={loading}
                {...form.getInputProps('schoolName')}
              />

              <TextInput
                label="School Code (Optional)"
                placeholder="ALEKAF001"
                description="Unique code for your school. Leave empty to auto-generate."
                leftSection={<IconSchool size={18} />}
                size="lg"
                radius="md"
                disabled={loading}
                {...form.getInputProps('schoolCode')}
              />

              <TextInput
                label="Domain (Optional)"
                placeholder="alekaf.edu"
                description="School website domain"
                leftSection={<IconMail size={18} />}
                size="lg"
                radius="md"
                disabled={loading}
                {...form.getInputProps('schoolDomain')}
              />
            </Stack>
          </Stepper.Step>

          <Stepper.Step
            label="Branch Information"
            description="First branch details"
            icon={<IconBuilding size={18} />}
          >
            <Stack gap="md" mt="xl">
              <TextInput
                label="Branch Name"
                placeholder="Main Branch"
                required
                leftSection={<IconBuilding size={18} />}
                size="lg"
                radius="md"
                disabled={loading}
                {...form.getInputProps('branchName')}
              />

              <TextInput
                label="Branch Code (Optional)"
                placeholder="MAIN001"
                description="Leave empty to auto-generate"
                leftSection={<IconBuilding size={18} />}
                size="lg"
                radius="md"
                disabled={loading}
                {...form.getInputProps('branchCode')}
              />

              <TextInput
                label="Address (Optional)"
                placeholder="123 School Street, City"
                size="lg"
                radius="md"
                disabled={loading}
                {...form.getInputProps('branchAddress')}
              />

              <Group grow>
                <TextInput
                  label="Phone (Optional)"
                  placeholder="+1234567890"
                  leftSection={<IconPhone size={18} />}
                  size="lg"
                  radius="md"
                  disabled={loading}
                  {...form.getInputProps('branchPhone')}
                />

                <TextInput
                  label="Email (Optional)"
                  placeholder="branch@school.com"
                  leftSection={<IconMail size={18} />}
                  size="lg"
                  radius="md"
                  disabled={loading}
                  {...form.getInputProps('branchEmail')}
                />
              </Group>
            </Stack>
          </Stepper.Step>

          <Stepper.Step
            label="Admin Account"
            description="Create administrator account"
            icon={<IconUser size={18} />}
          >
            <Stack gap="md" mt="xl">
              <TextInput
                label="Email"
                placeholder="admin@school.com"
                required
                leftSection={<IconMail size={18} />}
                size="lg"
                radius="md"
                autoComplete="email"
                disabled={loading}
                {...form.getInputProps('email')}
              />

              <TextInput
                label="Full Name"
                placeholder="John Doe"
                required
                leftSection={<IconUser size={18} />}
                size="lg"
                radius="md"
                disabled={loading}
                {...form.getInputProps('fullName')}
              />

              <TextInput
                label="Phone (Optional)"
                placeholder="+1234567890"
                leftSection={<IconPhone size={18} />}
                size="lg"
                radius="md"
                disabled={loading}
                {...form.getInputProps('phone')}
              />

              <PasswordInput
                label="Password"
                placeholder="Enter your password"
                required
                leftSection={<IconLock size={18} />}
                size="lg"
                radius="md"
                autoComplete="new-password"
                disabled={loading}
                {...form.getInputProps('password')}
              />

              <PasswordInput
                label="Confirm Password"
                placeholder="Confirm your password"
                required
                leftSection={<IconLock size={18} />}
                size="lg"
                radius="md"
                autoComplete="new-password"
                disabled={loading}
                {...form.getInputProps('confirmPassword')}
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
                  Password must be at least 6 characters long. Choose a strong password to keep your account secure.
                </Text>
              </Alert>
            </Stack>
          </Stepper.Step>

          <Stepper.Step
            label="Review"
            description="Review your information"
            icon={<IconCheck size={18} />}
          >
            <Stack gap="md" mt="xl">
              <Box>
                <Text size="sm" mb="xs" style={{ color: themeColors.colorTextMedium }}>
                  School Name
                </Text>
                <Text fw={500} style={{ color: themeColors.colorTextDark }}>
                  {form.values.schoolName}
                </Text>
              </Box>

              {form.values.schoolCode && (
                <Box>
                  <Text size="sm" mb="xs" style={{ color: themeColors.colorTextMedium }}>
                    School Code
                  </Text>
                  <Text fw={500} style={{ color: themeColors.colorTextDark }}>
                    {form.values.schoolCode}
                  </Text>
                </Box>
              )}

              <Box>
                <Text size="sm" mb="xs" style={{ color: themeColors.colorTextMedium }}>
                  Branch Name
                </Text>
                <Text fw={500} style={{ color: themeColors.colorTextDark }}>
                  {form.values.branchName}
                </Text>
              </Box>

              <Box>
                <Text size="sm" mb="xs" style={{ color: themeColors.colorTextMedium }}>
                  Admin Email
                </Text>
                <Text fw={500} style={{ color: themeColors.colorTextDark }}>
                  {form.values.email}
                </Text>
              </Box>

              <Box>
                <Text size="sm" mb="xs" style={{ color: themeColors.colorTextMedium }}>
                  Admin Name
                </Text>
                <Text fw={500} style={{ color: themeColors.colorTextDark }}>
                  {form.values.fullName}
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
                  Account created successfully! Redirecting...
                </Text>
              </Alert>
            </Stack>
          </Stepper.Completed>
        </Stepper>

        <Group justify="space-between" mt="xl">
          {active > 0 ? (
            <Button
              type="button"
              variant="default"
              onClick={prevStep}
              disabled={loading}
              style={{
                backgroundColor: isDark ? themeColors.colorMedium : '#f5f5f5',
                color: themeColors.colorTextDark,
                borderColor: themeColors.borderLight,
              }}
            >
              Previous
            </Button>
          ) : (
            <div /> // Spacer
          )}
          {active < 3 ? (
            <Button
              type="button"
              onClick={nextStep}
              disabled={loading}
              style={{
                backgroundColor: DEFAULT_THEME_COLOR,
                color: 'white',
              }}
            >
              Next
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
              Create Account
            </Button>
          )}
        </Group>

        <Text ta="center" size="sm" style={{ color: themeColors.colorTextMedium }}>
          Already have an account?{' '}
          <Anchor href="/login" size="sm" style={{ color: DEFAULT_THEME_COLOR, fontWeight: 500 }}>
            Sign in
          </Anchor>
        </Text>
      </Stack>
    </form>
  );
}

