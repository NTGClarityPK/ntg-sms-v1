import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from './useAuth';
import { notifications } from '@mantine/notifications';
import { useDebouncedValue } from '@mantine/hooks';
import { useState } from 'react';

export interface LibraryItem {
  id: string;
  title: string;
  author?: string;
  description?: string;
  subjectId?: string;
  classId?: string;
  category: string;
  fileUrl: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  thumbnailUrl?: string;
  isActive: boolean;
  viewCount: number;
  downloadCount: number;
  uploadedBy?: string;
  branchId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLibraryItemInput {
  title: string;
  author?: string;
  description?: string;
  subjectId?: string;
  classId?: string;
  category: string;
  fileUrl: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  thumbnailUrl?: string;
}

export interface UpdateLibraryItemInput {
  title?: string;
  author?: string;
  description?: string;
  subjectId?: string;
  classId?: string;
  category?: string;
  isActive?: boolean;
}

export interface QueryLibraryItemsInput {
  page?: number;
  limit?: number;
  category?: string;
  subjectId?: string;
  classId?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface UploadFileResponse {
  fileUrl: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  thumbnailUrl?: string;
}

export function useLibraryItems(params: QueryLibraryItemsInput = {}) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['library', branchId, params],
    queryFn: async () => {
      if (!branchId) return null;
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.limit) queryParams.append('limit', params.limit.toString());
      if (params.category) queryParams.append('category', params.category);
      if (params.subjectId) queryParams.append('subjectId', params.subjectId);
      if (params.classId) queryParams.append('classId', params.classId);
      if (params.search) queryParams.append('search', params.search);
      if (params.sortBy) queryParams.append('sortBy', params.sortBy);
      if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);

      const response = await apiClient.get<LibraryItem[]>(`/api/v1/library?${queryParams.toString()}`);
      return response;
    },
    enabled: !!branchId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useLibraryItem(id: string | null) {
  return useQuery({
    queryKey: ['library', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await apiClient.get<LibraryItem>(`/api/v1/library/${id}`);
      return response.data;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSearchLibraryItems(params: QueryLibraryItemsInput = {}) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['library', 'search', branchId, params],
    queryFn: async () => {
      if (!branchId) return null;
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.limit) queryParams.append('limit', params.limit.toString());
      if (params.category) queryParams.append('category', params.category);
      if (params.subjectId) queryParams.append('subjectId', params.subjectId);
      if (params.classId) queryParams.append('classId', params.classId);
      if (params.search) queryParams.append('search', params.search);
      if (params.sortBy) queryParams.append('sortBy', params.sortBy);
      if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);

      const response = await apiClient.get<LibraryItem[]>(`/api/v1/library/search?${queryParams.toString()}`);
      return response;
    },
    enabled: !!branchId && !!params.search && params.search.length >= 2,
    staleTime: 2 * 60 * 1000,
  });
}

export function useLibraryCategories() {
  return useQuery({
    queryKey: ['library', 'categories'],
    queryFn: async () => {
      const response = await apiClient.get<string[]>('/api/v1/library/categories');
      return response.data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUploadLibraryFile() {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File): Promise<UploadFileResponse> => {
      if (!branchId) {
        throw new Error('Branch not selected');
      }

      const formData = new FormData();
      formData.append('file', file);

      const response = await apiClient.post<UploadFileResponse>(
        '/api/v1/library/upload',
        formData,
      );
      return response.data;
    },
    onSuccess: () => {
      // Invalidate branch query to refresh storage quota
      if (branchId) {
        queryClient.invalidateQueries({ queryKey: ['branches', 'byId', branchId] });
      }
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Upload Error',
        message: error.message || 'Failed to upload file',
        color: 'red',
      });
    },
  });
}

export function useCreateLibraryItem() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useMutation({
    mutationFn: async (input: CreateLibraryItemInput) => {
      const response = await apiClient.post<{ data: LibraryItem }>('/api/v1/library', input);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library', branchId] });
      notifications.show({
        title: 'Success',
        message: 'Library item created successfully',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to create library item',
        color: 'red',
      });
    },
  });
}

export function useUpdateLibraryItem() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateLibraryItemInput }) => {
      const response = await apiClient.put<{ data: LibraryItem }>(`/api/v1/library/${id}`, input);
      return response.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['library', branchId] });
      queryClient.invalidateQueries({ queryKey: ['library', variables.id] });
      notifications.show({
        title: 'Success',
        message: 'Library item updated successfully',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to update library item',
        color: 'red',
      });
    },
  });
}

export function useDeleteLibraryItem() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/v1/library/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library', branchId] });
      // Invalidate branch query to refresh storage quota
      if (branchId) {
        queryClient.invalidateQueries({ queryKey: ['branches', 'byId', branchId] });
      }
      notifications.show({
        title: 'Success',
        message: 'Library item deleted successfully',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to delete library item',
        color: 'red',
      });
    },
  });
}

export function useIncrementLibraryViewCount() {
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(`/api/v1/library/${id}/view`);
    },
  });
}

export function useDownloadLibraryItem() {
  return useMutation({
    mutationFn: async (id: string): Promise<string> => {
      const response = await apiClient.post<{ url: string } | { data: { url: string } }>(
        `/api/v1/library/${id}/download`,
      );
      // Handle both { data: { url } } and { url } shapes
      const url =
        (response as { data?: { url?: string } })?.data?.url ??
        (response as { url?: string })?.url;
      if (!url) {
        throw new Error('Download URL not returned');
      }
      return url;
    },
  });
}
