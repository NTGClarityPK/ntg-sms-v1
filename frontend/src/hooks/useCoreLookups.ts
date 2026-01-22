import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { ClassEntity, Level, Section, Subject } from '@/types/settings';

const coreKeys = {
  subjects: ['subjects'] as const,
  classes: ['classes'] as const,
  sections: ['sections'] as const,
  levels: ['levels'] as const,
};

export function useSubjects() {
  return useQuery({
    queryKey: coreKeys.subjects,
    queryFn: async () => apiClient.get<Subject[]>('/api/v1/subjects', { params: { page: 1, limit: 100 } }),
  });
}

export function useCreateSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; nameAr?: string; code?: string; sortOrder?: number; isActive?: boolean }) =>
      apiClient.post<Subject>('/api/v1/subjects', payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: coreKeys.subjects });
    },
  });
}

export function useClasses(params?: { levelId?: string }) {
  return useQuery({
    queryKey: [...coreKeys.classes, params ?? {}],
    queryFn: async () =>
      apiClient.get<ClassEntity[]>('/api/v1/classes', {
        params: { page: 1, limit: 100, levelId: params?.levelId },
      }),
  });
}

export function useCreateClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; displayName: string; sortOrder: number; isActive?: boolean }) =>
      apiClient.post<ClassEntity>('/api/v1/classes', payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: coreKeys.classes });
      await qc.invalidateQueries({ queryKey: coreKeys.levels });
    },
  });
}

export function useSections() {
  return useQuery({
    queryKey: coreKeys.sections,
    queryFn: async () => apiClient.get<Section[]>('/api/v1/sections', { params: { page: 1, limit: 100 } }),
  });
}

export function useCreateSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; sortOrder?: number; isActive?: boolean }) =>
      apiClient.post<Section>('/api/v1/sections', payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: coreKeys.sections });
    },
  });
}

export function useLevels() {
  return useQuery({
    queryKey: coreKeys.levels,
    queryFn: async () => apiClient.get<Level[]>('/api/v1/levels', { params: { page: 1, limit: 100 } }),
  });
}

export function useCreateLevel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; nameAr?: string; sortOrder?: number; classIds?: string[] }) =>
      apiClient.post<Level>('/api/v1/levels', payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: coreKeys.levels });
    },
  });
}

// Helper hook for generic core lookups
export function useCoreLookups(type: 'subjects' | 'classes' | 'sections' | 'levels') {
  switch (type) {
    case 'subjects':
      return useSubjects();
    case 'classes':
      return useClasses();
    case 'sections':
      return useSections();
    case 'levels':
      return useLevels();
  }
}

