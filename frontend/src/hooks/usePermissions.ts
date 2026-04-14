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

  const hasPermissionForCodes = (
    roleId: string,
    candidateCodes: string[],
    required: 'view' | 'edit',
  ): boolean => {
    const matches = permissions.filter(
      (p) =>
        p.roleId === roleId &&
        p.branchId === branchId &&
        candidateCodes.includes(p.featureCode),
    );
    if (matches.length === 0) return false;
    return required === 'edit'
      ? matches.some((m) => m.permission === 'edit')
      : matches.some((m) => m.permission === 'view' || m.permission === 'edit');
  };

  // Backward-safe fallback while old feature codes may still exist in DB.
  const resolveFeatureCandidates = (featureCode: string): string[] => {
    switch (featureCode) {
      case 'events_management':
        return ['events_management', 'events'];
      case 'events_personal':
      case 'my_events':
        return ['events_personal', 'my_events', 'events'];
      case 'timetable_management':
        return ['timetable_management', 'timetable'];
      case 'timetable_personal':
      case 'my_timetable':
      case 'my_schedule':
        return ['timetable_personal', 'my_timetable', 'my_schedule', 'timetable'];
      case 'user_management':
        return ['user_management', 'staff'];
      default:
        return [featureCode];
    }
  };

  const canView = (featureCode: string): boolean => {
    if (!user?.roles) return false;

    // Super admin has access to everything (even without branch)
    const isSuperAdmin = user.roles.some(
      (r) => r.roleName?.toLowerCase() === 'super_admin',
    );
    if (isSuperAdmin) return true;

    if (!branchId) return false;

    const isSchoolAdmin = user.roles.some(
      (r) => r.roleName?.toLowerCase() === 'school_admin',
    );
    if (isSchoolAdmin) return true;

    const candidateCodes = resolveFeatureCandidates(featureCode);

    // Check if user has any role with view or edit permission for this feature
    return user.roles.some((userRole) =>
      hasPermissionForCodes(userRole.roleId, candidateCodes, 'view'),
    );
  };

  const canEdit = (featureCode: string): boolean => {
    if (!user?.roles) return false;

    // Super admin has access to everything (even without branch)
    const isSuperAdmin = user.roles.some(
      (r) => r.roleName?.toLowerCase() === 'super_admin',
    );
    if (isSuperAdmin) return true;

    if (!branchId) return false;

    const isSchoolAdmin = user.roles.some(
      (r) => r.roleName?.toLowerCase() === 'school_admin',
    );
    if (isSchoolAdmin) return true;

    const candidateCodes = resolveFeatureCandidates(featureCode);

    // Check if user has any role with edit permission for this feature
    return user.roles.some((userRole) =>
      hasPermissionForCodes(userRole.roleId, candidateCodes, 'edit'),
    );
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

export function useFeaturePermission(featureCode: string) {
  const { canView, canEdit } = usePermissions();
  return {
    canView: canView(featureCode),
    canEdit: canEdit(featureCode),
  };
}
