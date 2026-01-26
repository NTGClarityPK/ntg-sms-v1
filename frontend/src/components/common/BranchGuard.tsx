'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader, Container } from '@mantine/core';
import { useAuth } from '@/hooks/useAuth';

interface BranchGuardProps {
  children: React.ReactNode;
}

export function BranchGuard({ children }: BranchGuardProps) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  // Auto-select first branch if user has branches but no current branch selected
  useEffect(() => {
    if (!isLoading && user && !user.currentBranch && user.branches && user.branches.length > 0) {
      // Auto-select the first available branch
      // This will be handled by the branch switcher or can be done via API call
      // For now, we'll just let the user select from the header switcher
    }
  }, [user, isLoading]);

  // Show loading while checking
  if (isLoading) {
    return (
      <Container size="sm" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Loader size="lg" />
      </Container>
    );
  }

  // Allow access even if no branch is selected - user can select from header

  // If user has no branches at all, show error
  if (user && (!user.branches || user.branches.length === 0)) {
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

