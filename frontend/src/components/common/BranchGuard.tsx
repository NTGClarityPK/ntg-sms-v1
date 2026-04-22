'use client';

import { useEffect, useState } from 'react';
import { Skeleton, Container, Stack } from '@mantine/core';
import { useAuth } from '@/hooks/useAuth';
import type { User } from '@/types/auth';
import { apiClient } from '@/lib/api-client';
import { getSession } from '@/lib/auth';
import { useQueryClient } from '@tanstack/react-query';

interface BranchGuardProps {
  children: React.ReactNode;
}

export function BranchGuard({ children }: BranchGuardProps) {
  const qc = useQueryClient();
  const { user, isLoading, refetch, error } = useAuth();
  const userTyped = user as User | undefined;
  const [isSelectingBranch, setIsSelectingBranch] = useState(false);
  const [isRecoveringAuth, setIsRecoveringAuth] = useState(false);

  // Occasionally (especially right after signup redirect), React Query can be between states where
  // `isLoading` is false but `user` is still undefined and `error` is not yet populated.
  // Rendering the portal shell in this window can lead to a blank page if any child assumes user exists.
  const isAuthIndeterminate =
    !isLoading &&
    !isSelectingBranch &&
    !isRecoveringAuth &&
    !userTyped &&
    !error;

  const needsAuthRecovery =
    !isLoading &&
    !isSelectingBranch &&
    !userTyped &&
    !!error;

  // If we have a Supabase session but `auth/me` is still missing (common right after signup),
  // force a refetch so branch-gated queries (dashboard) can unblock without a hard refresh.
  useEffect(() => {
    const recoverAuth = async () => {
      if (isLoading || isSelectingBranch || isRecoveringAuth) return;
      if (userTyped) return;
      if (!error) return;

      try {
        setIsRecoveringAuth(true);
        const session = await getSession();
        if (!session?.access_token) return;

        // Drop potentially-cached error response for auth/me before refetching.
        qc.removeQueries({ queryKey: ['auth', 'me'] });
        await refetch();
      } finally {
        setIsRecoveringAuth(false);
      }
    };

    void recoverAuth();
  }, [error, isLoading, isSelectingBranch, isRecoveringAuth, userTyped, qc, refetch]);

  // Auto-select first branch if user has branches but no current branch selected
  useEffect(() => {
    const autoSelectBranch = async () => {
      if (
        !isLoading &&
        !isSelectingBranch &&
        !isRecoveringAuth &&
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
          qc.removeQueries({ queryKey: ['auth', 'me'] });
          await refetch();
        } catch {
          // Non-blocking: user may still select a branch from the header picker.
        } finally {
          setIsSelectingBranch(false);
        }
      }
    };

    autoSelectBranch();
  }, [user, isLoading, isSelectingBranch, isRecoveringAuth, refetch, qc]);

  // Show loading while checking or auto-selecting branch
  // Also hold render if auth is currently errored/missing (prevents blank screen during signup redirect).
  if (isLoading || isRecoveringAuth || isSelectingBranch || needsAuthRecovery || isAuthIndeterminate) {
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

