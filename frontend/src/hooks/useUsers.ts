import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { User, CreateUserInput, UpdateUserInput, UpdateUserRolesInput } from '@/types/users';
import { useAuth } from './useAuth';
import { notifications } from '@mantine/notifications';
import axios from 'axios';

/** Extract backend error message from Axios response. Nest HttpExceptionFilter returns { error: { code, message } }. */
function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as unknown;
    if (data && typeof data === 'object') {
      const obj = data as {
        error?: { message?: string | string[] };
        message?: string | string[];
      };
      const msg = obj.error?.message ?? obj.message;
      if (msg) return Array.isArray(msg) ? msg.join(', ') : msg;
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

interface QueryUsersParams {
  page?: number;
  limit?: number;
  role?: string; // Deprecated: use roles instead
  roles?: string[]; // Array of role IDs
  isActive?: boolean;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  /** When `false`, the query does not run (e.g. modal closed). Defaults to true. */
  enabled?: boolean;
}

export function useUsers(params?: QueryUsersParams) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['users', branchId, params],
    queryFn: async () => {
      if (!branchId) return null;
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      // Support both single role (backward compatibility) and multiple roles
      if (params?.roles && params.roles.length > 0) {
        params.roles.forEach((roleId) => queryParams.append('roles', roleId));
      } else if (params?.role) {
        queryParams.append('role', params.role);
      }
      // Send explicit 'true'/'false' so backend always receives a string (avoids boolean/query param issues)
      if (params?.isActive === true) queryParams.append('isActive', 'true');
      else if (params?.isActive === false) queryParams.append('isActive', 'false');
      if (params?.search) queryParams.append('search', params.search);
      if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
      if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);

      // Backend service returns { data: UserDto[], meta: {...} }
      // Controller returns it directly: { data: UserDto[], meta: {...} }
      // ResponseInterceptor sees it has 'data' property and returns as-is: { data: UserDto[], meta: {...} }
      // apiClient.get() returns response.data, which is { data: UserDto[], meta: {...} }
      const response = await apiClient.get<User[]>(`/api/v1/users?${queryParams.toString()}`);
      // response is ApiResponse<User[]>, which is { data: User[], meta?: {...}, error?: {...} }
      // But the actual HTTP response is { data: UserDto[], meta: {...} }, so response = { data: UserDto[], meta: {...} }
      return response;
    },
    enabled: !!branchId && params?.enabled !== false,
  });
}

export function useUser(id: string | null) {
  return useQuery({
    queryKey: ['user', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await apiClient.get<{ data: User }>(`/api/v1/users/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useMutation({
    mutationFn: async (input: CreateUserInput) => {
      const response = await apiClient.post<{ data: User }>('/api/v1/users', input);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', branchId] });
      notifications.show({
        title: 'Success',
        message: 'User created successfully',
        color: 'green',
      });
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message: getApiErrorMessage(error, 'Failed to create user'),
        color: 'red',
      });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateUserInput }) => {
      const response = await apiClient.put<{ data: User }>(`/api/v1/users/${id}`, input);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users', branchId] });
      queryClient.invalidateQueries({ queryKey: ['user', variables.id] });
      notifications.show({
        title: 'Success',
        message: 'User updated successfully',
        color: 'green',
      });
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message: getApiErrorMessage(error, 'Failed to update user'),
        color: 'red',
      });
    },
  });
}

export function useUpdateUserRoles() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateUserRolesInput }) => {
      const response = await apiClient.put<{ data: User }>(`/api/v1/users/${id}/roles`, input);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users', branchId] });
      queryClient.invalidateQueries({ queryKey: ['user', variables.id] });
      notifications.show({
        title: 'Success',
        message: 'User roles updated successfully',
        color: 'green',
      });
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message: getApiErrorMessage(error, 'Failed to update user roles'),
        color: 'red',
      });
    },
  });
}

/**
 * Update user profile fields + roles in one go (single refresh + single toast).
 * This avoids duplicate notifications and double query invalidation when saving the edit user modal.
 */
export function useUpdateUserWithRoles() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useMutation({
    mutationFn: async ({
      id,
      input,
      roles,
    }: {
      id: string;
      input: UpdateUserInput;
      roles: UpdateUserRolesInput;
    }) => {
      await apiClient.put<{ data: User }>(`/api/v1/users/${id}`, input);
      const rolesResponse = await apiClient.put<{ data: User }>(`/api/v1/users/${id}/roles`, roles);
      return rolesResponse.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users', branchId] });
      queryClient.invalidateQueries({ queryKey: ['user', variables.id] });
      notifications.show({
        title: 'Success',
        message: 'User updated successfully',
        color: 'green',
      });
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message: getApiErrorMessage(error, 'Failed to update user'),
        color: 'red',
      });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/v1/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', branchId] });
      // Deactivating a user can affect staff pickers (teacher mapping, timetable, etc.)
      // which read from `useStaff()` and are cached for a while.
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      notifications.show({
        title: 'Success',
        message: 'User deactivated successfully',
        color: 'green',
      });
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message: getApiErrorMessage(error, 'Failed to deactivate user'),
        color: 'red',
      });
    },
  });
}

