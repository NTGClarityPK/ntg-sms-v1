'use client';

import { useEffect } from 'react';
import { Select, Loader } from '@mantine/core';
import { IconBuilding } from '@tabler/icons-react';
import { useAuth } from '@/hooks/useAuth';
import { useBranchSwitcher } from '@/hooks/useBranchSwitcher';

export function BranchSwitcher() {
  const { user, isLoading, error, refetch } = useAuth();
  const { switchBranch, isSwitching } = useBranchSwitcher();

  // Calculate derived values (before any returns)
  const isSchoolAdmin = user?.roles?.some((r) => r.roleName === 'school_admin');
  const branches = user?.branches || [];
  const currentBranch = user?.currentBranch;

  // Auto-select first branch if user has branches but no current branch selected
  // This hook must be called unconditionally, before any returns
  useEffect(() => {
    if (branches.length > 0 && !currentBranch && !isSwitching && isSchoolAdmin) {
      switchBranch(branches[0].id);
    }
  }, [branches, currentBranch, isSwitching, switchBranch, isSchoolAdmin]);

  // Debug logging
  console.log('BranchSwitcher - user:', user);
  console.log('BranchSwitcher - isSchoolAdmin:', isSchoolAdmin);
  console.log('BranchSwitcher - roles:', user?.roles);
  console.log('BranchSwitcher - branches:', branches);
  console.log('BranchSwitcher - currentBranch:', currentBranch);

  // Show loading state while user data is loading
  if (isLoading) {
    console.log('BranchSwitcher - Still loading user data');
    return null;
  }

  // If there's an error, try to refetch once
  if (error && !user) {
    console.log('BranchSwitcher - Error loading user, attempting refetch:', error);
    // Don't refetch here to avoid infinite loops - let user manually refresh
  }

  // Only show for school_admin users
  if (!isSchoolAdmin) {
    console.log('BranchSwitcher - Not showing: user is not school_admin');
    return null;
  }

  // Don't show if user has no branches
  if (branches.length === 0) {
    console.log('BranchSwitcher - Not showing: no branches available');
    return null;
  }

  // If only one branch, show it but make it read-only
  if (branches.length === 1) {
    return (
      <Select
        leftSection={<IconBuilding size={16} />}
        value={branches[0].id}
        data={[
          {
            value: branches[0].id,
            label: branches[0].name || branches[0].code || branches[0].id,
          },
        ]}
        disabled
        style={{ minWidth: 180 }}
        size="sm"
      />
    );
  }

  return (
    <Select
      leftSection={<IconBuilding size={16} />}
      placeholder="Select branch"
      value={currentBranch?.id || null}
      data={branches.map((branch) => ({
        value: branch.id,
        label: branch.name || branch.code || branch.id,
      }))}
      onChange={(value) => {
        if (value && value !== currentBranch?.id) {
          switchBranch(value);
        }
      }}
      disabled={isSwitching}
      rightSection={isSwitching ? <Loader size={14} /> : undefined}
      style={{ minWidth: 180 }}
      size="sm"
    />
  );
}

