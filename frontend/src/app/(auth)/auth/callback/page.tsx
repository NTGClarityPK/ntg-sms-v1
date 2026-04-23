'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Stack, Text, Loader, Stepper, Button, Alert, Group, useMantineTheme } from '@mantine/core';
import { IconAlertCircle, IconCheck, IconBrandGoogle, IconLayoutDashboard } from '@tabler/icons-react';
import { supabase } from '@/lib/supabase/client';
import { apiClient } from '@/lib/api-client';
import { clearLocalSupabaseSession } from '@/lib/auth';
import { normalizeUiLocale, setUiLocaleCookieOnDocument } from '@/lib/ui-locale';
import { DEFAULT_THEME_COLOR } from '@/lib/utils/theme';
import { BranchSelectionModal } from '@/components/common/BranchSelectionModal';
import { selectBranchAndGoDashboard } from '@/lib/auth/complete-session-routing';

interface Branch {
  id: string;
  name: string;
  code: string;
  tenantId?: string | null;
}

interface UserResponseDto {
  preferredLocale?: string;
  preferred_locale?: string;
  roles?: Array<{ roleName?: string }>;
  branches?: Branch[];
  currentBranch?: Branch | null;
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const theme = useMantineTheme();
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState('Authenticating...');
  const [error, setError] = useState<string | null>(null);
  const [showBranchSelection, setShowBranchSelection] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchSelectionLoading, setBranchSelectionLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.location.hash?.includes('access_token=')) {
      router.replace('/login');
      return;
    }

    let cancelled = false;

    const setStepMsg = (s: number, msg: string) => {
      if (!cancelled) {
        setStep(s);
        setMessage(msg);
      }
    };

    async function runOAuthFlow() {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const rawGstate = searchParams.get('gstate');
        let googleSignupPayload: {
          schoolName?: string;
          branchName?: string;
          fullName?: string;
          phone?: string;
          isSignup?: boolean;
        } | null = null;

        if (rawGstate) {
          try {
            const decoded = atob(rawGstate);
            googleSignupPayload = JSON.parse(decoded);
          } catch {
            googleSignupPayload = null;
          }
        }

        const hash = window.location.hash.startsWith('#')
          ? window.location.hash.substring(1)
          : window.location.hash;
        const hashParams = new URLSearchParams(hash);
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (!accessToken || !refreshToken) {
          setError('Invalid OAuth response. Please try again.');
          return;
        }

        setStepMsg(0, 'Authenticating...');
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });

        if (cancelled) return;

        // Give Supabase time to propagate session (helps with incognito / storage)
        await new Promise((r) => setTimeout(r, 150));

        let session = (await supabase.auth.getSession()).data.session;
        for (let i = 0; i < 10 && !session?.access_token; i++) {
          await new Promise((r) => setTimeout(r, 100));
          session = (await supabase.auth.getSession()).data.session;
        }

        if (!session?.access_token) {
          setError('Failed to establish session. Please try again.');
          return;
        }

        // Clean URL early so tokens are not in address bar
        const cleanUrl = new URL(window.location.href);
        cleanUrl.hash = '';
        cleanUrl.searchParams.delete('gstate');
        window.history.replaceState(null, document.title, cleanUrl.pathname + cleanUrl.search);

        if (cancelled) return;

        let userData: UserResponseDto | null = null;

        if (googleSignupPayload?.isSignup) {
          setStepMsg(1, 'Setting up your account...');
          const signupRes = await apiClient.post<UserResponseDto>(
            '/api/v1/auth/google-signup',
            {
              schoolName: googleSignupPayload.schoolName,
              branchName: googleSignupPayload.branchName,
              fullName: googleSignupPayload.fullName,
              phone: googleSignupPayload.phone,
            },
          );
          userData = signupRes?.data ?? null;
        } else {
          setStepMsg(1, 'Loading your workspace...');
          const meRes = await apiClient.get<UserResponseDto>('/api/v1/auth/me');
          userData = meRes?.data ?? null;
        }

        if (cancelled) return;
        if (!userData) {
          setError('Could not load your account. Please try again.');
          return;
        }

        const roles = userData.roles ?? [];
        const roleNames = roles
          .map((r) => r.roleName?.toLowerCase())
          .filter((name): name is string => !!name);
        const userBranches = userData.branches ?? [];

        // Sign In with Google: user must exist (have at least one branch). Otherwise redirect to signup.
        if (userBranches.length === 0 && !roleNames.includes('super_admin')) {
          router.replace('/signup?google=not_found');
          return;
        }

        const rawPreferred =
          userData.preferredLocale ?? userData.preferred_locale ?? 'en-US';
        setUiLocaleCookieOnDocument(normalizeUiLocale(rawPreferred));

        if (roleNames.includes('super_admin')) {
          setStepMsg(2, 'Taking you to admin portal...');
          if (typeof window !== 'undefined') {
            window.sessionStorage.setItem('ntg_alma_show_tours_modal', '1');
          }
          router.push('/adminportal');
          return;
        }

        if (!roleNames.includes('school_admin')) {
          const branchId = userData.currentBranch?.id ?? userBranches[0]?.id;
          setStepMsg(2, 'Taking you to dashboard...');
          if (typeof window !== 'undefined') {
            window.sessionStorage.setItem('ntg_alma_show_tours_modal', '1');
          }
          if (branchId) {
            await selectBranchAndGoDashboard(branchId, router);
          } else {
            router.push('/dashboard');
          }
          return;
        }

        if (userBranches.length === 0) {
          setError('No branches assigned to your account. Please contact your administrator.');
          return;
        }

        if (userBranches.length === 1) {
          const branchId = userBranches[0].id;
          setStepMsg(2, 'Taking you to dashboard...');
          if (typeof window !== 'undefined') {
            window.sessionStorage.setItem('ntg_alma_show_tours_modal', '1');
          }
          await selectBranchAndGoDashboard(branchId, router);
          return;
        }

        setBranches(
          Array.from(new Map(userBranches.map((b) => [b.id, b])).values()),
        );
        setShowBranchSelection(true);
        setStepMsg(2, 'Select a branch to continue');
      } catch (err) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        const data = (err as { response?: { data?: { error?: { message?: string }; message?: string } } })
          ?.response?.data;
        const msg =
          data?.error?.message ?? data?.message ?? (err instanceof Error ? err.message : 'Unknown error');
        const msgLower = typeof msg === 'string' ? msg.toLowerCase() : '';

        if (status === 403) {
          try {
            await clearLocalSupabaseSession();
          } catch {
            // ignore
          }
          if (typeof window !== 'undefined' && typeof msg === 'string') {
            window.sessionStorage.setItem('ntg_auth_inactive_message', msg);
          }
          router.replace('/login');
          return;
        }

        if (status === 404 || msgLower.includes('user not found')) {
          router.replace('/signup?google=not_found');
          return;
        }

        setError(msg);
      }
    }

    void runOAuthFlow();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleBranchSelection = async (branchId: string) => {
    setBranchSelectionLoading(true);
    try {
      setShowBranchSelection(false);
      setMessage('Taking you to dashboard...');
      await selectBranchAndGoDashboard(branchId, router);
    } catch (err) {
      setError('Failed to select branch. Please try again.');
    } finally {
      setBranchSelectionLoading(false);
    }
  };

  if (error) {
    return (
      <Stack gap="lg" align="stretch">
        <Alert
          icon={<IconAlertCircle size={20} />}
          color="red"
          variant="light"
          title="Sign-in failed"
          styles={{
            root: { width: '100%', fontFamily: theme.fontFamily },
            title: { fontFamily: theme.fontFamily },
            message: { fontFamily: theme.fontFamily },
          }}
        >
          {error}
        </Alert>
        <Group justify="center" gap="md">
          <Button
            variant="filled"
            onClick={() => router.push('/dashboard')}
            leftSection={<IconLayoutDashboard size={16} />}
            style={{ fontFamily: theme.fontFamily }}
          >
            Try dashboard
          </Button>
          <Button
            variant="outline"
            onClick={() => router.replace('/login')}
            leftSection={<IconBrandGoogle size={16} />}
            style={{ fontFamily: theme.fontFamily }}
          >
            Back to login
          </Button>
        </Group>
      </Stack>
    );
  }

  const steps = [
    'Authenticating',
    step === 0 ? 'Next...' : message.includes('Setting up') ? 'Setting up' : 'Loading',
    'Redirecting',
  ];

  return (
    <Stack gap="xl" align="center">
      <Box
        ta="center"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
        }}
      >
        <Box style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <Loader size="xl" type="dots" color={DEFAULT_THEME_COLOR} />
        </Box>
        <Text fw={600} size="lg" style={{ fontFamily: theme.fontFamily }}>
          {message}
        </Text>
        <Text size="sm" c="dimmed" mt="xs" style={{ fontFamily: theme.fontFamily }}>
          Please wait, this will only take a moment.
        </Text>
      </Box>

      <Stepper
        size="xs"
        active={step}
        color="teal"
        completedIcon={<IconCheck size={16} />}
        styles={{
          stepLabel: { fontSize: 12, fontFamily: theme.fontFamily },
          stepDescription: { fontFamily: theme.fontFamily },
        }}
      >
        {steps.map((label, i) => (
          <Stepper.Step key={i} label={label} />
        ))}
      </Stepper>

      <BranchSelectionModal
        opened={showBranchSelection}
        branches={branches}
        onSelect={handleBranchSelection}
        loading={branchSelectionLoading}
        allowClose={false}
      />
    </Stack>
  );
}
