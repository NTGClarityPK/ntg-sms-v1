import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { notifications } from '@mantine/notifications';
import { ApiResponse } from '@/types/api';
import { supabase } from './supabase/client';
import { clearLocalSupabaseSession } from '@/lib/auth';

const STUDENT_TOKEN_STORAGE_KEY = 'studentToken';

const LOCAL_API = 'http://localhost:3001';

/**
 * Effective API base URL for this request. Use this so old builds/cache don't keep hitting a previous URL (e.g. Cloudflare tunnel).
 * - On localhost/127.0.0.1 → always local API.
 * - On trycloudflare.com (tunnel) → local API so tunnel frontend still talks to local backend when tunnel is down.
 * Export for use in pages that build API URLs manually (e.g. fetch, redirects).
 */
export function getEffectiveApiBaseURL(): string {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || LOCAL_API;
  }
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return LOCAL_API;
  if (host.endsWith('trycloudflare.com')) return LOCAL_API;
  return process.env.NEXT_PUBLIC_API_URL || LOCAL_API;
}

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    const baseURL = getEffectiveApiBaseURL();

    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 second timeout (supports bulk operations)
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor - inject auth token and branch header.
    // Set baseURL on every request so we always use current effective URL (avoids stale baked-in or cached env).
    // Never let getSession() fail the request: on refresh Supabase can be slow; proceed without token if it throws.
    this.client.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        if (typeof window !== 'undefined' && !window.navigator.onLine) {
          notifications.show({
            title: 'No Internet Connection',
            message: 'Please check your connection and try again.',
            color: 'red',
          });
          const offlineError = new Error('No internet connection') as Error & { isOfflineError?: boolean };
          offlineError.isOfflineError = true;
          return Promise.reject(offlineError);
        }

        config.baseURL = getEffectiveApiBaseURL();

        // Remove Content-Type header for FormData to let axios set it with boundary
        if (config.data instanceof FormData) {
          delete config.headers['Content-Type'];
        }

        try {
          const url = config.url || '';
          // Must match /api/v1/student/ (with trailing slash) to avoid catching /api/v1/students/...
          const isStudentApi =
            typeof url === 'string' && url.startsWith('/api/v1/student/');

          const studentToken =
            typeof window !== 'undefined'
              ? window.localStorage.getItem(STUDENT_TOKEN_STORAGE_KEY)
              : null;

          if (isStudentApi && studentToken) {
            // Student-only APIs: use custom student JWT
            config.headers.Authorization = `Bearer ${studentToken}`;
          } else {
            // All other APIs: use Supabase session (multi-role auth)
            const {
              data: { session },
            } = await supabase.auth.getSession();
            if (session?.access_token) {
              config.headers.Authorization = `Bearer ${session.access_token}`;
            }
          }
        } catch {
          // Supabase slow/unavailable on first load; send request without auth (backend will 401 if needed)
        }

        // Get branch ID from localStorage (set by auth flow) or from query cache
        if (typeof window !== 'undefined') {
          const branchId = localStorage.getItem('currentBranchId');
          if (branchId) {
            config.headers['X-Branch-Id'] = branchId;
          }
        }

        return config;
      },
      (error) => {
        return Promise.reject(error);
      },
    );

    // Response interceptor - handle errors
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError<ApiResponse<unknown>> & { isOfflineError?: boolean }) => {
        if (error.isOfflineError) {
          return Promise.reject(error);
        }

        // Network/timeout errors - show connection message
        const isNetworkError =
          error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED' || error.message === 'Network Error';
        if (isNetworkError && typeof window !== 'undefined') {
          notifications.show({
            title: 'Connection Error',
            message: 'Could not reach the server. Please check your internet connection.',
            color: 'red',
          });
        }

        const isUnreachable = error.code === 'ERR_NETWORK' || error.message === 'Network Error';
        if (isUnreachable) {
          const baseURL = getEffectiveApiBaseURL();
          const friendly = new Error(
            `Unable to reach the API at ${baseURL}. Ensure the backend is running (e.g. \`npm run start:dev\` in the backend folder).`,
          ) as AxiosError<ApiResponse<unknown>>;
          friendly.code = error.code;
          friendly.name = error.name;
          return Promise.reject(friendly);
        }

        if (error.response?.status === 401) {
          const body = error.response.data as { error?: { message?: string } } | undefined;
          const message = body?.error?.message ?? (body as { message?: string })?.message ?? '';

            // Only force logout when the token was sent but invalid/expired.
            // "No token provided" means the request went out without a token (e.g. session not
            // ready yet or race on page load) – do NOT logout so the user isn’t kicked out unnecessarily.
          const isNoToken = typeof message === 'string' && message.toLowerCase().includes('no token provided');
          if (!isNoToken && typeof window !== 'undefined') {
            try {
              const {
                data: { session },
              } = await supabase.auth.getSession();

              const hasSession = Boolean(session?.access_token);
              if (!hasSession) {
                await clearLocalSupabaseSession();
                if (window.location.pathname !== '/login') {
                  window.location.href = '/login';
                }
              }
            } catch {
              // Supabase getSession/signOut can throw (e.g. network). Don't override the API error.
            }
          }
        }

        // Student (or other) account blocked while session still exists locally — clear session and return to login.
        if (error.response?.status === 403 && typeof window !== 'undefined') {
          const reqUrl = error.config?.url ?? '';
          const isAuthMe =
            reqUrl.includes('/api/v1/auth/me') && !reqUrl.includes('/api/v1/auth/me/');
          if (isAuthMe) {
            const body = error.response.data as {
              error?: { message?: string | string[] };
              message?: string | string[];
            };
            const raw = body?.error?.message ?? body?.message;
            const text = Array.isArray(raw) ? raw.join(', ') : typeof raw === 'string' ? raw : '';
            if (text.toLowerCase().includes('inactive')) {
              try {
                await clearLocalSupabaseSession();
                window.sessionStorage.setItem('ntg_auth_inactive_message', text);
                const path = window.location.pathname;
                const stayPut =
                  path === '/login' ||
                  path.startsWith('/auth/callback') ||
                  path === '/signup' ||
                  path.startsWith('/signup/');
                if (!stayPut) {
                  window.location.href = '/login';
                }
              } catch {
                // Non-blocking — still reject so callers can handle.
              }
            }
          }
        }

        return Promise.reject(error);
      },
    );
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.get<ApiResponse<T>>(url, config);
    return response.data;
  }

  /**
   * Fetch a URL as binary (e.g. PDF/Excel export). Uses auth and branch headers.
   * Returns the blob for download; does not parse as JSON.
   * Uses 60s timeout for exports (overrides default if not provided).
   */
  async getBlob(url: string, config?: AxiosRequestConfig): Promise<Blob> {
    const response = await this.client.get<Blob>(url, {
      ...config,
      responseType: 'blob',
      timeout: config?.timeout ?? 60000,
    });
    return response.data;
  }

  async getBlobWithFilename(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<{ blob: Blob; filename?: string }> {
    const response = await this.client.get<Blob>(url, {
      ...config,
      responseType: 'blob',
      timeout: config?.timeout ?? 60000,
    });

    const cd = (response.headers?.['content-disposition'] as string | undefined) ?? undefined;
    const filename = (() => {
      if (!cd) return undefined;
      // Handles: filename="x.pdf" and RFC5987: filename*=UTF-8''x.pdf
      const matchStar = cd.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
      if (matchStar?.[1]) return decodeURIComponent(matchStar[1].trim().replace(/^\"|\"$/g, ''));
      const match = cd.match(/filename\s*=\s*\"?([^\";]+)\"?/i);
      return match?.[1]?.trim();
    })();

    return { blob: response.data, filename };
  }

  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.post<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.put<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  async patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.patch<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.delete<ApiResponse<T>>(url, config);
    return response.data;
  }
}

export const apiClient = new ApiClient();

