'use client';

import { useEffect, useState } from 'react';
import { Group, Text, Badge, Tooltip, Box, Image, Skeleton } from '@mantine/core';
import { IconCircle } from '@tabler/icons-react';
import { UserMenu } from './UserMenu';
import { CurrentBranchBadge } from '@/components/features/branches/CurrentBranchBadge';
import { NotificationBell } from './NotificationBell';
import { useSuccessColor, useErrorColor } from '@/lib/hooks/use-theme-colors';
import { useTenantMe } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { useMyStudent } from '@/hooks/useStudents';

export function Header() {
  const successColor = useSuccessColor();
  const errorColor = useErrorColor();
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const tenantQuery = useTenantMe();
  const tenantName = tenantQuery.data?.data?.name;
  const { user } = useAuth();
  
  // Check if user is a student and get class name
  const isStudent = user?.roles?.some((r) => r.roleName?.toLowerCase() === 'student') || false;
  const { data: myStudentData } = useMyStudent();
  const studentClassName = myStudentData?.data?.className && myStudentData?.data?.sectionName
    ? `${myStudentData.data.className} - ${myStudentData.data.sectionName}`
    : null;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateStatus = () => {
      setIsOnline(window.navigator.onLine);
    };

    updateStatus();
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  return (
    <Group justify="space-between" style={{ flex: 1 }}>
      <Group gap="sm" align="center">
        {tenantQuery.isLoading ? (
          <Skeleton height={22} width={220} />
        ) : (
          <Text fw={600} size="lg">
            {tenantName || 'School Management System'}
          </Text>
        )}
        {isStudent && studentClassName && (
          <Badge variant="light" color="blue" size="lg">
            {studentClassName}
          </Badge>
        )}
      </Group>

      <Group gap="md" align="center">
        {/* NTG Logo */}
        <Box
          style={{
            width: '64px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            opacity: 0.9,
          }}
          component="a"
          href="https://ntgclarity.com/"
          target="_blank"
          rel="noopener noreferrer"
          title="NTG Clarity"
        >
          <Image
            src="/ntg-logo.svg"
            alt="NTG Clarity"
            width="100%"
            height="100%"
            fit="contain"
            style={{ objectFit: 'contain' }}
          />
        </Box>

        {/* Online/Offline Status Badge (RMS-style) */}
        <Tooltip
          label={isOnline ? 'Connected to server' : 'No internet connection'}
          position="bottom"
          withArrow
        >
          <Badge
            variant="light"
            color={isOnline ? successColor : errorColor}
            size="sm"
            leftSection={
              <IconCircle
                size={8}
                fill="currentColor"
                style={{ marginRight: 4 }}
              />
            }
            style={{
              cursor: 'default',
              fontWeight: 500,
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              padding: '0 12px',
            }}
          >
            {isOnline ? 'Online' : 'Offline'}
          </Badge>
        </Tooltip>

        <CurrentBranchBadge />
        <NotificationBell />
        <UserMenu />
      </Group>
    </Group>
  );
}

