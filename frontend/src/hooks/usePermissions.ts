import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { PermissionMatrix, Permission } from '@/types/permissions';
import { useAuth } from './useAuth';

export function usePermissions() {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['permissions', branchId],
    queryFn: async () => {
      if (!branchId) return [];
      // Backend returns { data: PermissionMatrix[] }
      // apiClient.get<PermissionMatrix[]>() expects ApiResponse<PermissionMatrix[]>
      // which is { data: PermissionMatrix[] }
      const response = await apiClient.get<PermissionMatrix[]>('/api/v1/permissions');
      // apiClient.get() returns response.data, which is { data: PermissionMatrix[] }
      // So response.data is PermissionMatrix[]
      return response.data || [];
    },
    enabled: !!branchId,
  });

  const permissions = data || [];

  const canView = (featureCode: string): boolean => {
    if (!user?.roles || !branchId) return false;
    
    // Check if user has any role with view or edit permission for this feature
    return user.roles.some((userRole) => {
      const perm = permissions.find(
        (p) =>
          p.roleId === userRole.roleId &&
          p.featureCode === featureCode &&
          p.branchId === branchId,
      );
      return perm?.permission === 'view' || perm?.permission === 'edit';
    });
  };

  const canEdit = (featureCode: string): boolean => {
    if (!user?.roles || !branchId) return false;
    
    // Check if user has any role with edit permission for this feature
    return user.roles.some((userRole) => {
      const perm = permissions.find(
        (p) =>
          p.roleId === userRole.roleId &&
          p.featureCode === featureCode &&
          p.branchId === branchId,
      );
      return perm?.permission === 'edit';
    });
  };

  return {
    permissions,
    isLoading,
    error,
    refetch,
    canView,
    canEdit,
  };
}

