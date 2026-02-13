/**
 * React Query hooks for events
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type {
  Event,
  CreateEventInput,
  UpdateEventInput,
  QueryEventsInput,
  EventConsent,
  EventConsentStats,
  EventConflict,
  SubmitConsentInput,
} from '@/types/events';
import type { ApiResponse, PaginatedApiResponse } from '@/types/api';
import { notifications } from '@mantine/notifications';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

/**
 * Hook to list events with filters and pagination
 */
export function useEvents(params: QueryEventsInput = {}) {
  return useQuery({
    queryKey: ['events', params],
    queryFn: async () => {
      const response = await apiClient.get<Event[]>('/api/v1/events', {
        params,
      });
      // apiClient.get() returns ApiResponse<Event[]> = { data: Event[], meta: {...} }
      return response;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Hook to get events for current user (role-aware)
 */
export function useMyEvents() {
  return useQuery({
    queryKey: ['events', 'my-events'],
    queryFn: async () => {
      const response = await apiClient.get<Event[]>('/api/v1/events/my-events');
      // apiClient.get() returns ApiResponse<Event[]> = { data: Event[], meta?: {...} }
      return response;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Hook to get a single event by ID
 */
export function useEvent(id: string | undefined) {
  return useQuery({
    queryKey: ['events', id],
    queryFn: async () => {
      const response = await apiClient.get<Event>(`/api/v1/events/${id}`);
      // apiClient.get() returns ApiResponse<Event> = { data: Event }
      return response;
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Hook to get consents for an event (admin only)
 */
export function useEventConsents(eventId: string | undefined) {
  return useQuery({
    queryKey: ['events', eventId, 'consents'],
    queryFn: async () => {
      const response = await apiClient.get<EventConsent[]>(
        `/api/v1/events/${eventId}/consents`,
      );
      // apiClient.get() returns ApiResponse<EventConsent[]> = { data: EventConsent[] }
      return response;
    },
    enabled: !!eventId,
    staleTime: 1000 * 60 * 1, // 1 minute
  });
}

/**
 * Hook to get conflicts for an event
 */
export function useEventConflicts(eventId: string | undefined) {
  return useQuery({
    queryKey: ['events', eventId, 'conflicts'],
    queryFn: async () => {
      const response = await apiClient.get<EventConflict>(
        `/api/v1/events/${eventId}/conflicts`,
      );
      // apiClient.get() returns ApiResponse<EventConflict> = { data: EventConflict }
      return response;
    },
    enabled: !!eventId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to check conflicts before creating an event
 */
export function useCheckEventConflicts(
  startDate: string | null,
  endDate: string | null,
  classSectionIds: string[],
) {
  return useQuery({
    queryKey: ['events', 'check-conflicts', startDate, endDate, classSectionIds.sort().join(',')],
    queryFn: async () => {
      if (!startDate || !endDate || classSectionIds.length === 0) {
        return { data: { assessmentConflicts: [], eventConflicts: [] } };
      }

      const params = new URLSearchParams({
        startDate,
        endDate,
      });
      classSectionIds.forEach((id) => {
        params.append('classSectionIds', id);
      });

      const response = await apiClient.get<EventConflict>(
        `/api/v1/events/conflicts?${params.toString()}`,
      );
      // apiClient.get() returns ApiResponse<EventConflict> = { data: EventConflict }
      return response;
    },
    enabled: !!startDate && !!endDate && classSectionIds.length > 0,
    staleTime: 1000 * 60 * 1, // 1 minute - shorter since it's for real-time checking
  });
}

/**
 * Hook to create a new event
 */
export function useCreateEvent() {
  const queryClient = useQueryClient();
  const { success: successColor, error: errorColor } = useThemeColors();

  return useMutation({
    mutationFn: async (data: CreateEventInput) => {
      const response = await apiClient.post<Event>('/api/v1/events', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      notifications.show({
        title: 'Success',
        message: 'Event created successfully',
        color: successColor,
      });
    },
    onError: (error: unknown) => {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to create event';
      notifications.show({
        title: 'Error',
        message: errorMessage,
        color: errorColor,
      });
    },
  });
}

/**
 * Hook to update an existing event
 */
export function useUpdateEvent(id: string) {
  const queryClient = useQueryClient();
  const { success: successColor, error: errorColor } = useThemeColors();

  return useMutation({
    mutationFn: async (data: UpdateEventInput) => {
      const response = await apiClient.put<Event>(`/api/v1/events/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['events', id] });
      notifications.show({
        title: 'Success',
        message: 'Event updated successfully',
        color: successColor,
      });
    },
    onError: (error: unknown) => {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to update event';
      notifications.show({
        title: 'Error',
        message: errorMessage,
        color: errorColor,
      });
    },
  });
}

/**
 * Hook to delete an event
 */
export function useDeleteEvent() {
  const queryClient = useQueryClient();
  const { success: successColor, error: errorColor } = useThemeColors();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete<{ id: string }>(`/api/v1/events/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      notifications.show({
        title: 'Success',
        message: 'Event deleted successfully',
        color: successColor,
      });
    },
    onError: (error: unknown) => {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to delete event';
      notifications.show({
        title: 'Error',
        message: errorMessage,
        color: errorColor,
      });
    },
  });
}

/**
 * Hook to submit parent consent
 */
export function useSubmitConsent(eventId: string) {
  const queryClient = useQueryClient();
  const { success: successColor, error: errorColor } = useThemeColors();

  return useMutation({
    mutationFn: async (data: SubmitConsentInput) => {
      const response = await apiClient.post<EventConsent>(
        `/api/v1/events/${eventId}/consent`,
        data,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', eventId] });
      queryClient.invalidateQueries({ queryKey: ['events', eventId, 'consents'] });
      queryClient.invalidateQueries({ queryKey: ['events', 'my-events'] });
      notifications.show({
        title: 'Success',
        message: 'Consent submitted successfully',
        color: successColor,
      });
    },
    onError: (error: unknown) => {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to submit consent';
      notifications.show({
        title: 'Error',
        message: errorMessage,
        color: errorColor,
      });
    },
  });
}

