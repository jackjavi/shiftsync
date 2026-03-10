import { QueryClient } from '@tanstack/react-query';
import { parseApiError } from './api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,           // 30s before refetch
      gcTime: 5 * 60 * 1000,      // 5min cache
      retry: (failureCount, error) => {
        const apiErr = parseApiError(error);
        // Don't retry 401/403/404
        if ([401, 403, 404].includes(apiErr.statusCode ?? 0)) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: false,
    },
  },
});
