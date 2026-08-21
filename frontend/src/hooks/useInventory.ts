import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from './useAuth';
import { notifications } from '@mantine/notifications';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import type {
  UniformItem,
  StockEntry,
  CreateUniformItemInput,
  UpdateUniformItemInput,
  AddOrUpdateStockInput,
  QueryUniformsParams,
} from '@/types/inventory';

export function useUniforms(params: QueryUniformsParams = {}) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['uniforms', branchId, params],
    queryFn: async () => {
      if (!branchId) return null;
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.limit) queryParams.append('limit', params.limit.toString());
      if (params.category) queryParams.append('category', params.category);
      if (params.gender) queryParams.append('gender', params.gender);
      if (params.search) queryParams.append('search', params.search);
      if (params.sortBy) queryParams.append('sortBy', params.sortBy);
      if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);

      const response = await apiClient.get<UniformItem[]>(
        `/api/v1/uniforms?${queryParams.toString()}`,
      );
      return response;
    },
    enabled: !!branchId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useUniform(id: string | null) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['uniforms', id, branchId],
    queryFn: async () => {
      if (!id || !branchId) return null;
      const response = await apiClient.get<UniformItem>(
        `/api/v1/uniforms/${id}`,
      );
      return response.data;
    },
    enabled: !!id && !!branchId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useLowStock(enabled = true) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['uniforms', 'low-stock', branchId],
    queryFn: async () => {
      if (!branchId) return [];
      const response = await apiClient.get<UniformItem[]>(
        '/api/v1/uniforms/low-stock',
      );
      return response.data ?? [];
    },
    enabled: enabled && !!branchId,
    staleTime: 1 * 60 * 1000,
  });
}

export function useCreateUniform() {
  const queryClient = useQueryClient();
  const { success: successColor, error: errorColor } = useThemeColors();

  return useMutation({
    mutationFn: async (input: CreateUniformItemInput) => {
      const response = await apiClient.post<UniformItem>(
        '/api/v1/uniforms',
        input,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uniforms'] });
      notifications.show({ title: 'Item created', message: '', color: successColor });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Failed to create item',
        message: error.message,
        color: errorColor,
      });
    },
  });
}

export function useUpdateUniform() {
  const queryClient = useQueryClient();
  const { success: successColor, error: errorColor } = useThemeColors();

  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: { id: string; input: UpdateUniformItemInput }) => {
      const response = await apiClient.put<UniformItem>(
        `/api/v1/uniforms/${id}`,
        input,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['uniforms'] });
      queryClient.invalidateQueries({
        queryKey: ['uniforms', variables.id],
      });
      notifications.show({ title: 'Item updated', message: '', color: successColor });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Failed to update item',
        message: error.message,
        color: errorColor,
      });
    },
  });
}

export function useAddOrUpdateStock() {
  const queryClient = useQueryClient();
  const { success: successColor, error: errorColor } = useThemeColors();

  return useMutation({
    mutationFn: async ({
      itemId,
      input,
    }: { itemId: string; input: AddOrUpdateStockInput }) => {
      const response = await apiClient.post<StockEntry>(
        `/api/v1/uniforms/${itemId}/stock`,
        input,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['uniforms'] });
      queryClient.invalidateQueries({
        queryKey: ['uniforms', variables.itemId],
      });
      queryClient.invalidateQueries({ queryKey: ['uniforms', 'low-stock'] });
      notifications.show({ title: 'Stock updated', message: '', color: successColor });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Failed to update stock',
        message: error.message,
        color: errorColor,
      });
    },
  });
}

export function useUpdateStockQuantity() {
  const queryClient = useQueryClient();
  const { success: successColor, error: errorColor } = useThemeColors();

  return useMutation({
    mutationFn: async ({
      stockId,
      quantity,
    }: { stockId: string; quantity: number }) => {
      const response = await apiClient.put<StockEntry>(
        `/api/v1/uniforms/stock/${stockId}`,
        { quantity },
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uniforms'] });
      queryClient.invalidateQueries({ queryKey: ['uniforms', 'low-stock'] });
      notifications.show({ title: 'Stock updated', message: '', color: successColor });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Failed to update stock',
        message: error.message,
        color: errorColor,
      });
    },
  });
}

export function useDeleteUniform() {
  const queryClient = useQueryClient();
  const { success: successColor, error: errorColor } = useThemeColors();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/v1/uniforms/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uniforms'] });
      queryClient.invalidateQueries({ queryKey: ['uniforms', 'low-stock'] });
      notifications.show({ title: 'Item deleted', message: '', color: successColor });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Failed to delete item',
        message: error.message,
        color: errorColor,
      });
    },
  });
}

export function useUploadUniformImage() {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;
  const queryClient = useQueryClient();
  const { error: errorColor } = useThemeColors();

  return useMutation({
    mutationFn: async (file: File): Promise<{ imageUrl: string }> => {
      if (!branchId) throw new Error('Branch not selected');
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiClient.post<{ imageUrl: string }>(
        '/api/v1/uniforms/upload-image',
        formData,
      );
      return response.data;
    },
    onSuccess: () => {
      if (branchId) {
        queryClient.invalidateQueries({ queryKey: ['branches', 'byId', branchId] });
      }
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Upload failed',
        message: error.message,
        color: errorColor,
      });
    },
  });
}
