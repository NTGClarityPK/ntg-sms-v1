import { useAuth } from '@/hooks/useAuth';

/**
 * True when the user has school_admin for the current branch only.
 * Required for branch-scoped destructive actions.
 */
export function useIsSchoolAdminForCurrentBranch(): boolean {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;
  if (!branchId || !user?.roles?.length) return false;
  return user.roles.some(
    (r) => r.branchId === branchId && (r.roleName ?? '').toLowerCase() === 'school_admin',
  );
}

