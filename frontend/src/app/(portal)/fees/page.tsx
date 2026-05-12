'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Tabs, Title, Text } from '@mantine/core';
import { PaymentsTab } from '@/components/fees/PaymentsTab';
import { ChallansTab } from '@/components/fees/ChallansTab';
import { MyFeesTab } from '@/components/fees/MyFeesTab';
import { useAuth } from '@/hooks/useAuth';
import { useStudentSessionStore } from '@/lib/store/student-session-store';

export default function FeesPage() {
  const t = useTranslations('fees');
  const { user } = useAuth();
  const { studentToken } = useStudentSessionStore();
  const roles = user?.roles ?? [];
  const hasParentRole = useMemo(() => {
    return roles.some((r) => (r.roleName ?? '').toLowerCase() === 'parent');
  }, [roles]);

  // Student tokens are stored in localStorage and can survive login/logout.
  // Parents should never be forced into student mode due to a stale token.
  const isActingAsStudent = !!studentToken && !hasParentRole;

  const isAdmin = useMemo(() => {
    return roles.some((r) => {
      const name = (r.roleName ?? '').toLowerCase();
      return name === 'school_admin' || name === 'principal' || name === 'super_admin';
    });
  }, [roles]);

  const isStudent = useMemo(() => {
    if (isActingAsStudent) return true;
    return roles.some((r) => (r.roleName ?? '').toLowerCase() === 'student');
  }, [isActingAsStudent, roles]);

  const isParent = useMemo(() => {
    if (isActingAsStudent) return false;
    return roles.some((r) => (r.roleName ?? '').toLowerCase() === 'parent');
  }, [isActingAsStudent, roles]);

  return (
    <>
      <div className="page-title-bar">
        <Title order={1}>{t('title')}</Title>
      </div>
      <div style={{ marginTop: '60px', padding: 'var(--mantine-spacing-md)' }}>
        {isAdmin ? (
          <Tabs defaultValue="challans">
            <Tabs.List>
              <Tabs.Tab value="challans" id="fees-tab-challans">
                {t('tabs.challans')}
              </Tabs.Tab>
              <Tabs.Tab value="payments" id="fees-tab-payments">
                {t('tabs.payments')}
              </Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="challans" pt="md">
              <ChallansTab />
            </Tabs.Panel>
            <Tabs.Panel value="payments" pt="md">
              <PaymentsTab />
            </Tabs.Panel>
          </Tabs>
        ) : isStudent ? (
          <MyFeesTab mode="student" />
        ) : isParent ? (
          <MyFeesTab mode="parent" />
        ) : (
          <Text c="dimmed">{t('myFees.noAccess')}</Text>
        )}
      </div>
    </>
  );
}

