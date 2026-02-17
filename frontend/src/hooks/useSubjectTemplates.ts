import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { SubjectTemplate, CreateSubjectTemplateInput, UpdateSubjectTemplateInput } from '@/types/subject-templates';

type SubjectTemplatesResponse = {
  data: SubjectTemplate[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

type SubjectTemplateResponse = {
  data: SubjectTemplate;
};

type SubjectTemplateListResponse = {
  data: SubjectTemplate[];
};

export function useSubjectTemplates(
  branchId: string | null,
  page: number = 1,
  limit: number = 20,
  search?: string,
) {
  return useQuery<SubjectTemplatesResponse>({
    queryKey: ['subject-templates', branchId, page, limit, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (search) {
        params.append('search', search);
      }
      const response = await apiClient.get<SubjectTemplatesResponse>(`/api/v1/subject-templates?${params.toString()}`);
      // Backend returns { data: SubjectTemplateDto[], meta: {...} }
      // apiClient.get returns ApiResponse<SubjectTemplatesResponse> = { data: SubjectTemplatesResponse }
      // So response = { data: { data: SubjectTemplate[], meta: {...} } }
      // But if the HTTP response is actually just { data: SubjectTemplate[], meta: {...} }, then response = { data: SubjectTemplate[], meta: {...} }
      // Check if response.data is an array (meaning the backend returned just the array)
      if (Array.isArray(response.data)) {
        // Backend returned array directly, wrap it
        return {
          data: response.data as SubjectTemplate[],
          meta: response.meta || { total: response.data.length, page: 1, limit: response.data.length, totalPages: 1 },
        };
      }
      // Backend returned { data: [...], meta: {...} }, so response.data is already SubjectTemplatesResponse
      return response.data;
    },
    enabled: !!branchId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useSubjectTemplate(id: string | null, branchId: string | null) {
  return useQuery<SubjectTemplate>({
    queryKey: ['subject-templates', id, branchId],
    queryFn: async () => {
      const response = await apiClient.get<SubjectTemplateResponse>(`/api/v1/subject-templates/${id}`);
      // API returns { data: SubjectTemplate }; unwrap so query data is SubjectTemplate
      const body = response.data as SubjectTemplateResponse | SubjectTemplate;
      return (body && typeof body === 'object' && 'data' in body
        ? (body as SubjectTemplateResponse).data
        : body) as SubjectTemplate;
    },
    enabled: !!id && !!branchId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCreateSubjectTemplate() {
  const queryClient = useQueryClient();

  return useMutation<SubjectTemplateResponse, Error, CreateSubjectTemplateInput>({
    mutationFn: async (input) => {
      const response = await apiClient.post<SubjectTemplateResponse>('/api/v1/subject-templates', input);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subject-templates'] });
    },
  });
}

export function useUpdateSubjectTemplate() {
  const queryClient = useQueryClient();

  return useMutation<
    SubjectTemplateResponse,
    Error,
    { id: string; input: UpdateSubjectTemplateInput }
  >({
    mutationFn: async ({ id, input }) => {
      const response = await apiClient.put<SubjectTemplateResponse>(`/api/v1/subject-templates/${id}`, input);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['subject-templates'] });
      queryClient.invalidateQueries({ queryKey: ['subject-templates', variables.id] });
    },
  });
}

export function useDeleteSubjectTemplate() {
  const queryClient = useQueryClient();

  return useMutation<{ data: { id: string } }, Error, string>({
    mutationFn: async (id) => {
      const response = await apiClient.delete<{ data: { id: string } }>(`/api/v1/subject-templates/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subject-templates'] });
    },
  });
}

export function useAssignClassesToTemplate() {
  const queryClient = useQueryClient();

  return useMutation<
    { data: string[] },
    Error,
    { templateId: string; classIds: string[] }
  >({
    mutationFn: async ({ templateId, classIds }) => {
      const response = await apiClient.post<{ data: string[] }>(`/api/v1/subject-templates/${templateId}/assign-classes`, {
        classIds,
      });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['subject-templates', variables.templateId] });
      queryClient.invalidateQueries({ queryKey: ['subject-templates', 'class'] });
      queryClient.invalidateQueries({ queryKey: ['subject-templates'] }); // Invalidate list to refresh cards
    },
  });
}

export function useAssignLevelsToTemplate() {
  const queryClient = useQueryClient();

  return useMutation<
    { data: string[] },
    Error,
    { templateId: string; levelIds: string[] }
  >({
    mutationFn: async ({ templateId, levelIds }) => {
      const response = await apiClient.post<{ data: string[] }>(`/api/v1/subject-templates/${templateId}/assign-levels`, {
        levelIds,
      });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['subject-templates', variables.templateId] });
      queryClient.invalidateQueries({ queryKey: ['subject-templates', 'level'] });
      queryClient.invalidateQueries({ queryKey: ['subject-templates'] }); // Invalidate list to refresh cards
    },
  });
}

export function useClassesWithTemplates(
  branchId: string | null,
  options?: { enabled?: boolean },
) {
  return useQuery<string[]>({
    queryKey: ['subject-templates', 'classes-with-templates', branchId],
    queryFn: async () => {
      const response = await apiClient.get<{ data: string[] }>(`/api/v1/subject-templates/classes-with-templates`);
      const data = response?.data;
      return Array.isArray(data) ? data : [];
    },
    enabled: !!branchId && (options?.enabled !== false),
    staleTime: 2 * 60 * 1000,
  });
}

export function useTemplatesForClass(classId: string | null, branchId: string | null) {
  return useQuery<SubjectTemplateListResponse>({
    queryKey: ['subject-templates', 'class', classId, branchId],
    queryFn: async () => {
      if (!classId) return { data: [] };
      // Backend controller returns { data: SubjectTemplateDto[] }
      // ResponseInterceptor sees it has 'data' property, returns as-is: { data: SubjectTemplateDto[] }
      // HTTP response body: { data: SubjectTemplateDto[] }
      // Axios response.data: { data: SubjectTemplateDto[] }
      // apiClient.get() returns response.data: { data: SubjectTemplateDto[] }
      // So response = { data: SubjectTemplateDto[] }
      // response.data = SubjectTemplateDto[] (the array)
      const response = await apiClient.get<SubjectTemplate[]>(`/api/v1/subject-templates/class/${classId}`);
      
      // response is { data: SubjectTemplateDto[] }
      // response.data is SubjectTemplateDto[] (the array)
      if (Array.isArray(response.data)) {
        return { data: response.data as SubjectTemplate[] };
      }
      
      return { data: [] };
    },
    enabled: !!classId && !!branchId,
    staleTime: 2 * 60 * 1000, // 2 minutes - templates rarely change mid-session
  });
}

export function useTemplatesForLevel(levelId: string | null, branchId: string | null) {
  return useQuery<SubjectTemplateListResponse>({
    queryKey: ['subject-templates', 'level', levelId, branchId],
    queryFn: async () => {
      if (!levelId) return { data: [] };
      // Backend returns { data: SubjectTemplateDto[] }
      // apiClient.get<SubjectTemplate[]> returns ApiResponse<SubjectTemplate[]> = { data: SubjectTemplate[] }
      // But actual HTTP response is { data: SubjectTemplateDto[] }
      // So response.data = SubjectTemplateDto[] (the array)
      const response = await apiClient.get<SubjectTemplate[]>(`/api/v1/subject-templates/level/${levelId}`);
      // If response.data is an array, wrap it in { data: [...] }
      if (Array.isArray(response.data)) {
        return { data: response.data as SubjectTemplate[] };
      }
      // If response.data is already { data: [...] }, return as-is
      return response as unknown as SubjectTemplateListResponse;
    },
    enabled: !!levelId && !!branchId,
    staleTime: 2 * 60 * 1000, // 2 minutes - templates rarely change mid-session
  });
}

export function useStudentTemplate(
  studentId: string | null,
  academicYearId: string | null,
  branchId: string | null,
) {
  return useQuery({
    queryKey: ['subject-templates', 'student', studentId, academicYearId, branchId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (academicYearId) {
        params.append('academicYearId', academicYearId);
      }
      const response = await apiClient.get<SubjectTemplate | null>(
        `/api/v1/subject-templates/students/${studentId}?${params.toString()}`,
      );
      return response;
    },
    enabled: !!studentId && !!branchId && !!academicYearId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useAssignStudentToTemplate() {
  const queryClient = useQueryClient();

  return useMutation<
    SubjectTemplateResponse,
    Error,
    { studentId: string; subjectTemplateId: string; academicYearId: string }
  >({
    mutationFn: async ({ studentId, subjectTemplateId, academicYearId }) => {
      const response = await apiClient.post<{ data: SubjectTemplate }>(`/api/v1/subject-templates/students/${studentId}/assign`, {
        subjectTemplateId,
        academicYearId,
      });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['subject-templates', 'student', variables.studentId],
      });
    },
  });
}


