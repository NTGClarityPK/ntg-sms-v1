import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface StudentSelf {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  className: string | null;
  sectionName: string | null;
}

export function useStudentSelf() {
  return useQuery({
    queryKey: ['student', 'me'],
    queryFn: async () => {
      const response = await apiClient.get<StudentSelf>('/api/v1/student/me');
      return response.data;
    },
    staleTime: 2 * 60 * 1000,
  });
}

