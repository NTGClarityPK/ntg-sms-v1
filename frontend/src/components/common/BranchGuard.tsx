'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton, Container, Stack } from '@mantine/core';
import { useAuth } from '@/hooks/useAuth';
import type { User } from '@/types/auth';
import { apiClient } from '@/lib/api-client';

interface BranchGuardProps {
  children: React.ReactNode;
}

export function BranchGuard({ children }: BranchGuardProps) {
  const router = useRouter();
  const { user, isLoading, refetch } = useAuth();
  const userTyped = user as User | undefined;
  const [isSelectingBranch, setIsSelectingBranch] = useState(false);

  // Auto-select first branch if user has branches but no current branch selected
  useEffect(() => {
    const autoSelectBranch = async () => {
      if (
        !isLoading &&
        !isSelectingBranch &&
        userTyped &&
        !userTyped.currentBranch &&
        userTyped.branches &&
        userTyped.branches.length > 0
      ) {
        setIsSelectingBranch(true);
        try {
          // Auto-select the first available branch
          const firstBranch = userTyped.branches[0];
          await apiClient.post('/api/v1/auth/select-branch', {
            branchId: firstBranch.id,
          });
          
          // Store in localStorage
          localStorage.setItem('currentBranchId', firstBranch.id);
          
          // Refetch user data to get updated current branch
          await refetch();
        } catch (error) {
          console.error('Failed to auto-select branch:', error);
        } finally {
          setIsSelectingBranch(false);
        }
      }
    };

    autoSelectBranch();
  }, [user, isLoading, isSelectingBranch, refetch]);

  // Show loading while checking or auto-selecting branch
  if (isLoading || isSelectingBranch) {
    return (
      <Container size="sm" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Stack gap="md" align="center">
          <Skeleton height={40} width="60%" />
          <Skeleton height={200} width="100%" />
        </Stack>
      </Container>
    );
  }

  // Allow access even if no branch is selected - user can select from header

  // If user has no branches at all, show error
  if (userTyped && (!userTyped.branches || userTyped.branches.length === 0)) {
    return (
      <Container size="sm" py="xl">
        <div>
          <h2>No Branches Assigned</h2>
          <p>You don't have access to any branches. Please contact your administrator.</p>
        </div>
      </Container>
    );
  }

  return <>{children}</>;
}

