 'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  PasswordInput,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconAlertCircle, IconKey, IconUser, IconUsersGroup } from '@tabler/icons-react';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api-client';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { getSession } from '@/lib/auth';
import { pinAuth } from '@/lib/pin-auth';
import { supabase } from '@/lib/supabase/client';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/supabase/types';

interface ParentChild {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  branchId: string | null;
  isCurrent: boolean;
}

type ModalMode = 'parent-set' | 'parent-change' | 'parent-remove' | 'child-set' | 'child-change' | 'child-remove';

interface ModalState {
  mode: ModalMode;
  child?: ParentChild;
}

interface ChildPinState {
  email?: string;
  hasPin: boolean;
  checking: boolean;
}

function getStoredChildEmail(childId: string): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(`pin_child_email_${childId}`);
}

function setStoredChildEmail(childId: string, email: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(`pin_child_email_${childId}`, email.toLowerCase().trim());
}

/** In-memory storage so the ephemeral client never touches the main app session. */
function createEphemeralStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    key: (index: number) => (index < map.size ? [...map.keys()][index] ?? null : null),
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
  };
}

/** No-op cookies so the ephemeral client never reads or writes the real session cookies. */
function createEphemeralCookies() {
  return {
    getAll: () => [] as { name: string; value: string }[],
    setAll: () => {},
  };
}

function createEphemeralSupabaseClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        storage: createEphemeralStorage(),
      },
      cookies: createEphemeralCookies(),
    },
  );
}

export default function ParentPinManagementPage() {
  const colors = useThemeColors();
  const { user } = useAuth();

  const [parentHasPin, setParentHasPin] = useState(false);
  const [parentChecking, setParentChecking] = useState(false);
  const [parentError, setParentError] = useState<string | null>(null);

  const [childPinState, setChildPinState] = useState<Record<string, ChildPinState>>({});

  const [modalState, setModalState] = useState<ModalState | null>(null);
  const [modalStep, setModalStep] = useState<'login' | 'pin'>('login');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [childEmailInput, setChildEmailInput] = useState('');
  const [childPasswordInput, setChildPasswordInput] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  /** Holds child refresh token + email after login step so PIN step uses current state, not a stale closure. */
  const childPinFlowRef = useRef<{ refreshToken: string; email: string } | null>(null);

  const {
    data: childrenData,
    isLoading: childrenLoading,
    error: childrenError,
    refetch: refetchChildren,
  } = useQuery({
    queryKey: ['auth', 'my-children'],
    queryFn: async () => {
      const response = await apiClient.get<ParentChild[]>('/api/v1/auth/my-children');
      return response.data || [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const children = Array.isArray(childrenData) ? childrenData : [];

  useEffect(() => {
    let cancelled = false;
    async function checkParent() {
      if (!user?.email) return;
      setParentChecking(true);
      setParentError(null);
      try {
        const available = await pinAuth.isPinAuthAvailable(user.email);
        if (!cancelled) {
          setParentHasPin(available);
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : 'Failed to check parent PIN status on this device.';
          setParentError(message);
        }
      } finally {
        if (!cancelled) {
          setParentChecking(false);
        }
      }
    }
    checkParent();
    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  useEffect(() => {
    let cancelled = false;
    async function initChildStates() {
      const next: Record<string, ChildPinState> = {};
      for (const child of children) {
        const storedEmail = getStoredChildEmail(child.id);
        if (!storedEmail) {
          next[child.id] = { email: undefined, hasPin: false, checking: false };
          continue;
        }
        next[child.id] = { email: storedEmail, hasPin: false, checking: true };
      }
      if (!cancelled) {
        setChildPinState(next);
      }

      const entries = Object.entries(next).filter(([, state]) => state.email);
      await Promise.all(
        entries.map(async ([childId, state]) => {
          try {
            const available = await pinAuth.isPinAuthAvailable(state.email);
            if (!cancelled) {
              setChildPinState((prev) => ({
                ...prev,
                [childId]: { ...prev[childId], hasPin: available, checking: false },
              }));
            }
          } catch {
            if (!cancelled) {
              setChildPinState((prev) => ({
                ...prev,
                [childId]: { ...prev[childId], hasPin: false, checking: false },
              }));
            }
          }
        }),
      );
    }

    if (children.length > 0) {
      initChildStates();
    } else {
      setChildPinState({});
    }

    return () => {
      cancelled = true;
    };
  }, [children]);

  const resetModalState = () => {
    setModalState(null);
    setModalStep('login');
    setPin('');
    setConfirmPin('');
    setChildEmailInput('');
    setChildPasswordInput('');
    setModalError(null);
    setModalLoading(false);
    childPinFlowRef.current = null;
  };

  const openParentSetModal = () => {
    setModalState({ mode: 'parent-set' });
    setModalStep('pin');
  };

  const openParentChangeModal = () => {
    setModalState({ mode: 'parent-change' });
    setModalStep('pin');
  };

  const openParentRemoveModal = () => {
    setModalState({ mode: 'parent-remove' });
    setModalStep('pin');
  };

  const openChildSetModal = (child: ParentChild) => {
    setModalState({ mode: 'child-set', child });
    setModalStep('login');
  };

  const openChildChangeModal = (child: ParentChild) => {
    setModalState({ mode: 'child-change', child });
    setModalStep('login');
  };

  const openChildRemoveModal = (child: ParentChild) => {
    setModalState({ mode: 'child-remove', child });
    setModalStep('pin');
  };

  const handleParentPinSave = async () => {
    if (!user?.email) return;
    if (pin.length < 4 || pin.length > 6 || !/^\d{4,6}$/.test(pin)) {
      setModalError('PIN must be a 4–6 digit number.');
      return;
    }
    if (pin !== confirmPin) {
      setModalError('PIN confirmation does not match.');
      return;
    }

    setModalLoading(true);
    setModalError(null);
    try {
      const { getSession } = await import('@/lib/auth');
      const session = await getSession();
      const refreshToken = session?.refresh_token;
      if (!refreshToken) {
        throw new Error('No active session. Please sign in again as the parent.');
      }
      await pinAuth.setupPinAuth(pin, refreshToken, user.email);
      const available = await pinAuth.isPinAuthAvailable(user.email);
      setParentHasPin(available);
      resetModalState();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to set parent PIN on this device.';
      setModalError(message);
    } finally {
      setModalLoading(false);
    }
  };

  const handleParentPinRemove = () => {
    if (!user?.email) return;
    try {
      pinAuth.clearPinAuth(user.email);
      setParentHasPin(false);
      resetModalState();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to remove parent PIN on this device.';
      setModalError(message);
    }
  };

  const handleChildPinRemove = () => {
    if (!modalState?.child) return;
    const childId = modalState.child.id;
    const storedEmail = getStoredChildEmail(childId);
    if (!storedEmail) {
      setModalError('No PIN is set on this device for this child.');
      return;
    }
    try {
      pinAuth.clearPinAuth(storedEmail);
      setChildPinState((prev) => ({
        ...prev,
        [childId]: { email: storedEmail, hasPin: false, checking: false },
      }));
      resetModalState();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to remove child PIN on this device.';
      setModalError(message);
    }
  };

  const handleChildPinFlow = async () => {
    if (!modalState?.child) return;
    const child = modalState.child;

    if (modalStep === 'login') {
      if (!childEmailInput || !childPasswordInput) {
        setModalError('Please enter the child email and password.');
        return;
      }
      setModalLoading(true);
      setModalError(null);
      try {
        const parentSession = await getSession();
        if (!parentSession?.access_token || !parentSession?.refresh_token) {
          throw new Error('Your session has expired. Please sign in again as the parent.');
        }
        const client = createEphemeralSupabaseClient();
        const { data, error } = await client.auth.signInWithPassword({
          email: childEmailInput,
          password: childPasswordInput,
        });
        if (error || !data.session?.refresh_token) {
          throw new Error('Invalid child credentials. Please check email and password.');
        }
        // Ensure the email belongs to the selected child
        await apiClient.post('/api/v1/auth/verify-child-email', {
          studentId: child.id,
          email: childEmailInput,
        });
        const refreshToken = data.session.refresh_token;
        const email = childEmailInput.toLowerCase().trim();
        childPinFlowRef.current = { refreshToken, email };
        setModalStep('pin');
        await supabase.auth.setSession({
          access_token: parentSession.access_token,
          refresh_token: parentSession.refresh_token,
        });
      } catch (err) {
        let message = 'Failed to verify child credentials.';
        if (err && typeof err === 'object' && 'response' in err) {
          const resp = (err as any).response;
          const data = resp?.data as { message?: string; error?: { message?: string } } | undefined;
          const backendMessage = data?.error?.message ?? data?.message;
          if (backendMessage && typeof backendMessage === 'string') {
            message = backendMessage;
          }
        } else if (err instanceof Error && err.message) {
          message = err.message;
        }
        setModalError(message);
      } finally {
        setModalLoading(false);
      }
      return;
    }

    if (modalStep === 'pin') {
      const flowData = childPinFlowRef.current;
      if (!flowData) {
        setModalError('Session expired. Please close this dialog and try again from the login step.');
        return;
      }
      if (pin.length < 4 || pin.length > 6 || !/^\d{4,6}$/.test(pin)) {
        setModalError('PIN must be a 4–6 digit number.');
        return;
      }
      if (pin !== confirmPin) {
        setModalError('PIN confirmation does not match.');
        return;
      }
      setModalLoading(true);
      setModalError(null);
      try {
        await pinAuth.setupPinAuth(pin, flowData.refreshToken, flowData.email);
        setStoredChildEmail(child.id, flowData.email);
        const available = await pinAuth.isPinAuthAvailable(flowData.email);
        setChildPinState((prev) => ({
          ...prev,
          [child.id]: { email: flowData.email, hasPin: available, checking: false },
        }));
        resetModalState();
        refetchChildren().catch(() => {});
      } catch (errInner) {
        const message =
          errInner instanceof Error
            ? errInner.message
            : 'Failed to set PIN for this child on this device.';
        setModalError(message);
      } finally {
        setModalLoading(false);
      }
    }
  };

  const renderParentRow = () => {
    const label = user?.email || 'Parent';
    return (
      <Paper withBorder p="md">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Group gap="xs">
              <IconUser size={18} />
              <Text fw={600} size="lg">
                {label}
              </Text>
            </Group>
            <Text size="sm" c="dimmed">
              This is your own account PIN for this device.
            </Text>
          </Stack>
          <Group gap="xs">
            <Badge
              variant={parentHasPin ? 'filled' : 'light'}
              color={parentHasPin ? 'green' : 'gray'}
              leftSection={<IconKey size={14} />}
            >
              {parentChecking ? 'Checking…' : parentHasPin ? 'PIN set on this device' : 'No PIN on this device'}
            </Badge>
            <Group gap="xs">
              {!parentHasPin ? (
                <Button id="parent-pin-set" size="xs" onClick={openParentSetModal}>
                  Set PIN
                </Button>
              ) : (
                <>
                  <Button id="parent-pin-change" size="xs" variant="light" onClick={openParentChangeModal}>
                    Change PIN
                  </Button>
                  <Button
                    id="parent-pin-remove"
                    size="xs"
                    variant="subtle"
                    color="red"
                    onClick={openParentRemoveModal}
                  >
                    Remove PIN
                  </Button>
                </>
              )}
            </Group>
          </Group>
        </Group>
        {parentError && (
          <Alert
            mt="sm"
            icon={<IconAlertCircle size={16} />}
            color={colors.error}
            variant="light"
            radius="md"
          >
            {parentError}
          </Alert>
        )}
      </Paper>
    );
  };

  const renderChildRow = (child: ParentChild) => {
    const state = childPinState[child.id] || { hasPin: false, checking: false };
    return (
      <Paper key={child.id} withBorder p="md">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Group gap="xs">
              <IconUsersGroup size={18} />
              <Text fw={600} size="lg">
                {child.firstName} {child.lastName}
              </Text>
            </Group>
            <Text size="sm" c="dimmed">
              Roll number: {child.studentId}
            </Text>
          </Stack>
          <Group gap="xs">
            <Badge
              variant={state.hasPin ? 'filled' : 'light'}
              color={state.hasPin ? 'green' : 'gray'}
              leftSection={<IconKey size={14} />}
            >
              {state.checking
                ? 'Checking…'
                : state.hasPin
                ? 'PIN set on this device'
                : 'No PIN on this device'}
            </Badge>
            <Group gap="xs">
              {!state.hasPin ? (
                <Button
                  id={`child-pin-set-${child.id}`}
                  size="xs"
                  onClick={() => openChildSetModal(child)}
                >
                  Set PIN
                </Button>
              ) : (
                <>
                  <Button
                    id={`child-pin-change-${child.id}`}
                    size="xs"
                    variant="light"
                    onClick={() => openChildChangeModal(child)}
                  >
                    Change PIN
                  </Button>
                  <Button
                    id={`child-pin-remove-${child.id}`}
                    size="xs"
                    variant="subtle"
                    color="red"
                    onClick={() => openChildRemoveModal(child)}
                  >
                    Remove PIN
                  </Button>
                </>
              )}
            </Group>
          </Group>
        </Group>
      </Paper>
    );
  };

  const isChildMode =
    modalState?.mode === 'child-set' ||
    modalState?.mode === 'child-change' ||
    modalState?.mode === 'child-remove';

  const modalTitle = (() => {
    if (!modalState) return '';
    if (modalState.mode === 'parent-set') return 'Set parent PIN';
    if (modalState.mode === 'parent-change') return 'Change parent PIN';
    if (modalState.mode === 'parent-remove') return 'Remove parent PIN';
    if (modalState.mode === 'child-set') return 'Set child PIN';
    if (modalState.mode === 'child-change') return 'Change child PIN';
    return 'Remove child PIN';
  })();

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>PIN Management</Title>
        </Group>
      </div>

      <div
        style={{
          marginTop: '60px',
          paddingLeft: 'var(--mantine-spacing-md)',
          paddingRight: 'var(--mantine-spacing-md)',
          paddingTop: 'var(--mantine-spacing-sm)',
          paddingBottom: 'var(--mantine-spacing-xl)',
        }}
      >
        <Stack gap="md">
          {renderParentRow()}

          <Title order={3} mt="md">
            Children
          </Title>

          {childrenLoading ? (
            <Stack gap="md">
              <Skeleton height={120} />
              <Skeleton height={120} />
            </Stack>
          ) : childrenError ? (
            <Alert
              icon={<IconAlertCircle size={16} />}
              color={colors.error}
              title="Failed to load children"
            >
              <Text size="sm">Please try again.</Text>
            </Alert>
          ) : children.length === 0 ? (
            <Alert
              icon={<IconUsersGroup size={16} />}
              color={colors.info}
              title="No children linked"
            >
              <Text size="sm">
                No children are linked to your account yet. Please contact the school
                administrator.
              </Text>
            </Alert>
          ) : (
            children.map((child) => renderChildRow(child))
          )}
        </Stack>
      </div>

      <Modal opened={!!modalState} onClose={resetModalState} title={modalTitle} centered>
        {modalState && (
          <Stack gap="md">
            {modalError && (
              <Alert
                icon={<IconAlertCircle size={16} />}
                color={colors.error}
                variant="light"
                radius="md"
              >
                {modalError}
              </Alert>
            )}

            {modalState.mode === 'parent-remove' && (
              <>
                <Text size="sm">
                  Remove PIN for your own account on this device? You will no longer be able to log
                  in with PIN here until you set a new one.
                </Text>
                <Group justify="flex-end">
                  <Button variant="light" onClick={resetModalState}>
                    Cancel
                  </Button>
                  <Button
                    id="parent-pin-confirm-remove"
                    color="red"
                    loading={modalLoading}
                    onClick={handleParentPinRemove}
                  >
                    Remove PIN
                  </Button>
                </Group>
              </>
            )}

            {(modalState.mode === 'parent-set' || modalState.mode === 'parent-change') && (
              <>
                <Text size="sm">
                  Choose a 4–6 digit PIN for your own account on this device. This will encrypt your
                  current session so you can log in with PIN next time.
                </Text>
                <PasswordInput
                  id="parent-pin-input"
                  label="PIN"
                  placeholder="4–6 digits"
                  value={pin}
                  onChange={(e) => setPin(e.currentTarget.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  disabled={modalLoading}
                />
                <PasswordInput
                  id="parent-pin-confirm-input"
                  label="Confirm PIN"
                  placeholder="Re-enter PIN"
                  value={confirmPin}
                  onChange={(e) =>
                    setConfirmPin(e.currentTarget.value.replace(/\D/g, '').slice(0, 6))
                  }
                  maxLength={6}
                  disabled={modalLoading}
                />
                <Group justify="flex-end">
                  <Button variant="light" onClick={resetModalState} disabled={modalLoading}>
                    Cancel
                  </Button>
                  <Button
                    id="parent-pin-confirm-save"
                    loading={modalLoading}
                    onClick={handleParentPinSave}
                  >
                    Save PIN
                  </Button>
                </Group>
              </>
            )}

            {isChildMode && modalState.mode !== 'child-remove' && modalStep === 'login' && (
              <>
                <Text size="sm">
                  To set up PIN for{' '}
                  <strong>
                    {modalState.child?.firstName} {modalState.child?.lastName}
                  </strong>
                  , please enter their school login credentials.
                </Text>
                <TextInput
                  id="child-email-input"
                  label="Child email"
                  placeholder="student email"
                  value={childEmailInput}
                  onChange={(e) => setChildEmailInput(e.currentTarget.value)}
                  disabled={modalLoading}
                />
                <PasswordInput
                  id="child-password-input"
                  label="Child password"
                  placeholder="Enter child password"
                  value={childPasswordInput}
                  onChange={(e) => setChildPasswordInput(e.currentTarget.value)}
                  disabled={modalLoading}
                />
                <Group justify="flex-end">
                  <Button variant="light" onClick={resetModalState} disabled={modalLoading}>
                    Cancel
                  </Button>
                  <Button
                    id="child-pin-continue"
                    loading={modalLoading}
                    onClick={handleChildPinFlow}
                  >
                    Continue
                  </Button>
                </Group>
              </>
            )}

            {isChildMode && modalState.mode !== 'child-remove' && modalStep === 'pin' && (
              <>
                <Text size="sm">
                  Choose a 4–6 digit PIN for{' '}
                  <strong>
                    {modalState.child?.firstName} {modalState.child?.lastName}
                  </strong>{' '}
                  on this device.
                </Text>
                <PasswordInput
                  id="child-pin-input"
                  label="PIN"
                  placeholder="4–6 digits"
                  value={pin}
                  onChange={(e) => setPin(e.currentTarget.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  disabled={modalLoading}
                />
                <PasswordInput
                  id="child-pin-confirm-input"
                  label="Confirm PIN"
                  placeholder="Re-enter PIN"
                  value={confirmPin}
                  onChange={(e) =>
                    setConfirmPin(e.currentTarget.value.replace(/\D/g, '').slice(0, 6))
                  }
                  maxLength={6}
                  disabled={modalLoading}
                />
                <Group justify="flex-end">
                  <Button variant="light" onClick={resetModalState} disabled={modalLoading}>
                    Cancel
                  </Button>
                  <Button
                    id="child-pin-confirm-save"
                    loading={modalLoading}
                    onClick={handleChildPinFlow}
                  >
                    Save PIN
                  </Button>
                </Group>
              </>
            )}

            {modalState?.mode === 'child-remove' && (
              <>
                <Text size="sm">
                  Remove PIN on this device for{' '}
                  <strong>
                    {modalState.child?.firstName} {modalState.child?.lastName}
                  </strong>
                  ? They will no longer be able to log in with PIN here until you set a new one.
                </Text>
                <Group justify="flex-end">
                  <Button variant="light" onClick={resetModalState} disabled={modalLoading}>
                    Cancel
                  </Button>
                  <Button
                    id="child-pin-confirm-remove"
                    color="red"
                    loading={modalLoading}
                    onClick={handleChildPinRemove}
                  >
                    Remove PIN
                  </Button>
                </Group>
              </>
            )}
          </Stack>
        )}
      </Modal>
    </>
  );
}


