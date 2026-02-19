import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false, // Offline sync handles mutations; we invalidate after sync to avoid full "refresh" feel
    },
    mutations: {
      retry: false,
    },
  },
});

