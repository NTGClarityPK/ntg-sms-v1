import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Staff, CreateStaffInput, UpdateStaffInput } from '@/types/staff';
import { useAuth } from './useAuth';
import { notifications } from '@mantine/notifications';

interface QueryStaffParams {
  page?: number;
  limit?: number;
  role?: string;
  isActive?: boolean;
  search?: string;
}

export function useStaff(params?: QueryStaffParams) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['staff', branchId, params],
    queryFn: async () => {
      if (!branchId) return null;
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.role) queryParams.append('role', params.role);
      if (params?.isActive !== undefined) queryParams.append('isActive', params.isActive.toString());
      if (params?.search) queryParams.append('search', params.search);

      // Backend service returns { data: StaffDto[], meta: {...} }
      // Controller returns it directly: { data: StaffDto[], meta: {...} }
      // ResponseInterceptor sees it has 'data' property and returns as-is: { data: StaffDto[], meta: {...} }
      // HTTP response body: { data: StaffDto[], meta: {...} }
      // Axios response.data: { data: StaffDto[], meta: {...} }
      // apiClient.get() returns response.data, which is { data: StaffDto[], meta: {...} }
      const response = await apiClient.get<{
        data: Staff[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>(`/api/v1/staff?${queryParams.toString()}`);
      return response;
    },
    enabled: !!branchId,
  });
}

export function useCreateStaff() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useMutation({
    mutationFn: async (input: CreateStaffInput) => {
      const response = await apiClient.post<{ data: Staff }>('/api/v1/staff', input);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', branchId] });
      notifications.show({
        title: 'Success',
        message: 'Staff member created successfully',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to create staff member',
        color: 'red',
      });
    },
  });
}

export function useMyStaff() {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['staff', 'me', branchId],
    queryFn: async () => {
      if (!branchId) return null;
      const response = await apiClient.get<{ data: Staff | null }>('/api/v1/staff/me');
      return response.data;
    },
    enabled: !!branchId,
  });
}

export function useUpdateStaff() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateStaffInput }) => {
      const response = await apiClient.put<{ data: Staff }>(`/api/v1/staff/${id}`, input);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['staff', branchId] });
      notifications.show({
        title: 'Success',
        message: 'Staff member updated successfully',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to update staff member',
        color: 'red',
      });
    },
  });
}

