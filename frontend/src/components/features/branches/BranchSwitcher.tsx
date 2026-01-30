'use client';

import { useEffect } from 'react';
import { Select, Loader } from '@mantine/core';
import { IconBuilding } from '@tabler/icons-react';
import { useAuth } from '@/hooks/useAuth';
import type { User } from '@/types/auth';
import { useBranchSwitcher } from '@/hooks/useBranchSwitcher';

export function BranchSwitcher() {
  const { user, isLoading, error, refetch } = useAuth();
  const { switchBranch, isSwitching } = useBranchSwitcher();

  // Calculate derived values (before any returns)
  const userTyped = user as User | undefined;
  const isSchoolAdmin = userTyped?.roles?.some((r) => r.roleName === 'school_admin');
  const branches = userTyped?.branches || [];
  const currentBranch = userTyped?.currentBranch;

  // Auto-select first branch if user has branches but no current branch selected
  // This hook must be called unconditionally, before any returns
  useEffect(() => {
    if (branches.length > 0 && !currentBranch && !isSwitching && isSchoolAdmin) {
      switchBranch(branches[0].id);
    }
  }, [branches, currentBranch, isSwitching, switchBranch, isSchoolAdmin]);

  // Show loading state while user data is loading
  if (isLoading) {
    return null;
  }

  // If there's an error, try to refetch once
  if (error && !user) {
    // Don't refetch here to avoid infinite loops - let user manually refresh
  }

  // Branch selection is now handled at login via modal
  // Hide branch switcher for all users (including admins)
  // Users with multiple branches select at login and can re-login to switch
  return null;
}

