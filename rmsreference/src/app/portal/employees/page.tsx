'use client';

import { useState, useEffect } from 'react';
import { Title, Button, Group, Center, Paper, Stack, Text, Alert } from '@mantine/core';
import { IconPlus, IconWifiOff, IconAlertCircle } from '@tabler/icons-react';
import { EmployeesPage } from '@/features/employees';
import { useLanguageStore } from '@/lib/store/language-store';
import { useSubscription } from '@/lib/hooks/use-subscription';
import { PLAN_CONFIGS } from '@/lib/utils/subscription';
import { t } from '@/lib/utils/translations';
import { useSyncStatus } from '@/lib/hooks/use-sync-status';
import { useRouter } from 'next/navigation';
import { getErrorColor } from '@/lib/utils/theme';
import { useErrorColor } from '@/lib/hooks/use-theme-colors';

export default function Employees() {
  const { language } = useLanguageStore();
  const { isOnline } = useSyncStatus();
  const { subscription, usage } = useSubscription();
  const router = useRouter();
  const [addTrigger, setAddTrigger] = useState(0);
  const errorColor = useErrorColor();

  // Redirect if offline
  useEffect(() => {
    if (!isOnline) {
      router.push('/portal/orders');
    }
  }, [isOnline, router]);

  if (!isOnline) {
    return (
      <Center h="100vh">
        <Paper p="xl" radius="md" withBorder>
          <Stack align="center" gap="md">
            <IconWifiOff size={48} color={getErrorColor()} />
            <Text size="lg" fw={500}>
              {t('navigation.offlineDisabled' as any, language) || 'Employees section is not available offline'}
            </Text>
            <Text size="sm" c="dimmed">
              {t('navigation.offlineRedirect' as any, language) || 'Redirecting to Orders...'}
            </Text>
          </Stack>
        </Paper>
      </Center>
    );
  }

  // Check if user limit is reached
  const currentUserCount = usage?.usersUsed || 0;
  const planConfig = subscription ? PLAN_CONFIGS[subscription.planId as keyof typeof PLAN_CONFIGS] : null;
  const userLimit = planConfig?.users === 'unlimited' ? Infinity : (planConfig?.users || 2);
  const canCreateEmployee = !planConfig || userLimit === Infinity || currentUserCount < userLimit;
  const limitReached = planConfig && userLimit !== Infinity && currentUserCount >= userLimit;

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" align="center" style={{ width: '100%', height: '100%' }}>
          <Title order={1} style={{ margin: 0, textAlign: 'left' }}>
            {t('navigation.employees', language)}
          </Title>
          <Button 
            leftSection={<IconPlus size={16} />} 
            onClick={() => setAddTrigger(prev => prev + 1)}
            disabled={limitReached || !canCreateEmployee}
            title={limitReached || !canCreateEmployee ? `You have reached your plan limit of ${userLimit} user(s). Please upgrade to add more users.` : undefined}
          >
            {t('employees.addEmployee', language)}
          </Button>
        </Group>
      </div>

      <div className="page-sub-title-bar"></div>

      <div style={{ marginTop: '60px', paddingLeft: 'var(--mantine-spacing-md)', paddingRight: 'var(--mantine-spacing-md)', paddingTop: 'var(--mantine-spacing-sm)', paddingBottom: 'var(--mantine-spacing-xl)' }}>
        {limitReached && (
          <Alert 
            icon={<IconAlertCircle size={16} />} 
            color={errorColor}
            title="User Limit Reached"
            mb="md"
          >
            You have reached your {planConfig?.name} plan limit of {userLimit} user(s). 
            Please upgrade your plan to add more users.
          </Alert>
        )}
        <EmployeesPage addTrigger={addTrigger} />
      </div>
    </>
  );
}
