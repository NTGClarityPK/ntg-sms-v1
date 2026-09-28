'use client';

import { useEffect, useMemo, useState } from 'react';
import { Alert, Anchor, Box, Button, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import Link from 'next/link';
import { IconChecklist, IconChevronRight } from '@tabler/icons-react';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { useSettingsStatus, type SettingsStatus } from '@/hooks/useSettingsStatus';
import { useStudents } from '@/hooks/useStudents';
import { useUsers } from '@/hooks/useUsers';
import { useTeacherAssignments } from '@/hooks/useTeacherAssignments';
import { useSubscriptionFeatures } from '@/hooks/api/useSubscription';

const isSchoolAdmin = (roles: { roleName?: string }[] = []): boolean =>
  roles.some((r) => r.roleName?.toLowerCase() === 'school_admin');

function sessionDismissKey(userId: string, branchId: string): string {
  return `post-setup-checklist-dismissed:${userId}:${branchId}`;
}

export function PostSetupChecklistBanner() {
  const t = useTranslations('postSetupChecklist');
  const locale = useLocale();
  const isRtl = locale === 'ar';
  const { user } = useAuth();
  const statusQuery = useSettingsStatus();
  const status = statusQuery.data?.data as SettingsStatus | undefined;
  const setupReady = status?.tabbedScreenReady ?? status?.isInitialized ?? false;

  const userId = user?.id ?? 'anonymous';
  const branchId = user?.currentBranch?.id ?? 'no-branch';
  const dismissKey = useMemo(() => sessionDismissKey(userId, branchId), [userId, branchId]);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsDismissed(window.sessionStorage.getItem(dismissKey) === '1');
  }, [dismissKey]);

  const canShow = !!user && isSchoolAdmin(user.roles) && setupReady && !isDismissed;
  const probesEnabled = canShow && !statusQuery.isLoading;

  const studentsQuery = useStudents({ page: 1, limit: 1, enabled: probesEnabled });
  const usersQuery = useUsers({ page: 1, limit: 50, enabled: probesEnabled });
  const assignmentsQuery = useTeacherAssignments({ page: 1, limit: 1, enabled: probesEnabled });
  const { data: planFeatures } = useSubscriptionFeatures();

  const hasStudents = (studentsQuery.data?.meta?.total ?? 0) > 0;
  const users = Array.isArray(usersQuery.data?.data) ? usersQuery.data.data : [];
  // School admin is always on Users; treat “set up” as at least one other person.
  const hasOtherUsers =
    users.some((u) => u.id !== user?.id) || (usersQuery.data?.meta?.total ?? 0) > 1;
  const hasTeacherMapping = (assignmentsQuery.data?.meta?.total ?? 0) > 0;
  const showFeeTip = planFeatures?.hasFeeManagement === true;

  const probesLoading =
    probesEnabled &&
    (studentsQuery.isLoading || usersQuery.isLoading || assignmentsQuery.isLoading);

  if (!canShow || statusQuery.isLoading || probesLoading || hasTeacherMapping) {
    return null;
  }

  const showStudentsStep = !hasStudents;
  const showUsersStep = !hasOtherUsers;

  const essentialSteps = [
    showUsersStep
      ? {
          id: 'post-setup-link-users-import',
          href: '/users/bulk-import',
          label: t('linkUsersImport'),
        }
      : null,
    showStudentsStep
      ? {
          id: 'post-setup-link-students-import',
          href: '/students/bulk-import',
          label: t('linkStudentsImport'),
        }
      : null,
    {
      id: 'post-setup-link-teacher-mapping',
      href: '/mapping?tab=teacher-class',
      label: t('linkTeacherMapping'),
    },
  ].filter((step): step is { id: string; href: string; label: string } => step !== null);

  return (
    <Alert
      id="post-setup-checklist-banner"
      icon={<IconChecklist size={16} />}
      color="blue"
      variant="light"
      mt="xs"
      mb="md"
      px="md"
      py="sm"
      mx="md"
      title={
        <Text size="sm" fw={600}>
          {t('title')}
        </Text>
      }
      withCloseButton
      closeButtonLabel={t('dismissLabel')}
      onClose={() => {
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(dismissKey, '1');
        }
        setIsDismissed(true);
      }}
    >
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" verticalSpacing="sm">
        <Stack gap={8}>
          <Text size="xs" c="dimmed">
            {t.rich('intro', {
              bold: (chunks) => (
                <Text span fw={700} inherit>
                  {chunks}
                </Text>
              ),
            })}
          </Text>
          <Group gap="xs" wrap="wrap" align="center">
            {essentialSteps.map((step, index) => (
              <Group key={step.id} gap="xs" wrap="nowrap" align="center">
                {index > 0 && (
                  <IconChevronRight
                    size={14}
                    stroke={1.5}
                    opacity={0.55}
                    aria-hidden
                    style={{ transform: isRtl ? 'scaleX(-1)' : undefined }}
                  />
                )}
                <Button
                  id={step.id}
                  component={Link}
                  href={step.href}
                  size="compact-xs"
                  variant="light"
                >
                  {step.label}
                </Button>
              </Group>
            ))}
          </Group>
        </Stack>

        <Box
          pl={{ sm: 'md' }}
          style={{
            borderInlineStart: '1px solid var(--mantine-color-default-border)',
          }}
        >
          <Stack gap={6}>
            <Text size="xs" c="dimmed">
              {t.rich('optionalHeading', {
                bold: (chunks) => (
                  <Text span fw={700} inherit>
                    {chunks}
                  </Text>
                ),
              })}
            </Text>
            <Text size="xs" c="dimmed" component="div">
              {t('tipRoles')}{' '}
              <Anchor
                id="post-setup-link-permissions"
                component={Link}
                href="/settings?section=permissions"
                size="xs"
                fw={600}
              >
                {t('linkPermissions')}
              </Anchor>
            </Text>
            {showFeeTip && (
              <Text size="xs" c="dimmed" component="div">
                {t('tipFees')}{' '}
                <Anchor
                  id="post-setup-link-fees"
                  component={Link}
                  href="/settings?section=fees"
                  size="xs"
                  fw={600}
                >
                  {t('linkFeeSettings')}
                </Anchor>
              </Text>
            )}
          </Stack>
        </Box>
      </SimpleGrid>
    </Alert>
  );
}
