import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { notifications } from '@mantine/notifications';
import { ApiResponse } from '@/types/api';
import { supabase } from './supabase/client';
import { clearLocalSupabaseSession } from '@/lib/auth';

declare module 'axios' {
  export interface AxiosRequestConfig {
    /** When true, connection/offline snackbars are not shown for this request. */
    suppressErrorNotification?: boolean;
  }
}

/** Alias for requests that may suppress global error snackbars. */
export type ApiRequestConfig = AxiosRequestConfig;

const STUDENT_TOKEN_STORAGE_KEY = 'studentToken';

const LOCAL_API = 'http://localhost:3001';

const API_OFFLINE_NOTIFICATION_ID = 'ntg-api-offline';
const API_CONNECTION_NOTIFICATION_ID = 'ntg-api-connection-error';
const API_ERROR_TOAST_COOLDOWN_MS = 20_000;

let lastOfflineToastAt = 0;
let lastConnectionToastAt = 0;

function shouldShowGlobalErrorToast(config?: InternalAxiosRequestConfig): boolean {
  return !config?.suppressErrorNotification;
}

function showOfflineToastOnce(): void {
  const now = Date.now();
  if (now - lastOfflineToastAt < API_ERROR_TOAST_COOLDOWN_MS) return;
  lastOfflineToastAt = now;
  notifications.show({
    id: API_OFFLINE_NOTIFICATION_ID,
    title: 'No Internet Connection',
    message: 'Please check your connection and try again.',
    color: 'red',
    autoClose: 8000,
  });
}

function showConnectionToastOnce(): void {
  const now = Date.now();
  if (now - lastConnectionToastAt < API_ERROR_TOAST_COOLDOWN_MS) return;
  lastConnectionToastAt = now;
  notifications.show({
    id: API_CONNECTION_NOTIFICATION_ID,
    title: 'Connection Error',
    message: 'Could not reach the server. Please check your internet connection.',
    color: 'red',
    autoClose: 8000,
  });
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

type RefreshLock = Promise<string | null> | null;
let refreshLock: RefreshLock = null;

async function refreshSupabaseSessionOnce(): Promise<string | null> {
  if (refreshLock) return refreshLock;

  refreshLock = (async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) return null;
      const token = data.session?.access_token ?? null;
      return token;
    } catch {
      return null;
    } finally {
      refreshLock = null;
    }
  })();

  return refreshLock;
}

async function getSupabaseAccessTokenWithRetry(input: {
  attempts: number;
  delayMs: number;
}): Promise<string | null> {
  for (let i = 0; i < input.attempts; i++) {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        // Avoid sending expired tokens (they cause `/auth/me` loops + refresh/retry storms).
        // Supabase `expires_at` is unix seconds.
        const expiresAtMs =
          typeof session.expires_at === 'number' ? session.expires_at * 1000 : null;
        const isExpired =
          expiresAtMs !== null ? expiresAtMs <= Date.now() + 5_000 : false; // 5s skew
        if (!isExpired) return session.access_token;
      }
    } catch {
      // ignore and retry
    }
    if (i < input.attempts - 1) await sleep(input.delayMs);
  }
  return null;
}

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
          if (shouldShowGlobalErrorToast(config)) {
            showOfflineToastOnce();
          }
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
          const isAuthBootstrap =
            typeof url === 'string' &&
            (url.startsWith('/api/v1/auth/me') || url.startsWith('/api/v1/auth/select-branch'));
          // Public invitation setup — no JWT required. Skip getSession() so a slow/hung
          // Supabase client on cold load cannot block the Set up your account page forever.
          const isPublicInvitationSetup =
            typeof url === 'string' && url.startsWith('/api/v1/invitations/setup/');

          const studentToken =
            typeof window !== 'undefined'
              ? window.localStorage.getItem(STUDENT_TOKEN_STORAGE_KEY)
              : null;

          if (isPublicInvitationSetup) {
            // Intentionally no Authorization header.
          } else if (isStudentApi && studentToken) {
            // Student-only APIs: use custom student JWT
            config.headers.Authorization = `Bearer ${studentToken}`;
          } else {
            // All other APIs: use Supabase session (multi-role auth)
            // IMPORTANT: auth bootstrap requests must not go out without a token right after login/logout,
            // otherwise we can cache `/auth/me` without a currentBranch and the dashboard gets stuck until hard refresh.
            // Optimise login→dashboard latency: keep retries, but shorten worst-case wait.
            // If the session isn’t ready, requests may still 401 and be retried via the response interceptor.
            const token = isAuthBootstrap
              ? await getSupabaseAccessTokenWithRetry({ attempts: 6, delayMs: 50 })
              : await getSupabaseAccessTokenWithRetry({ attempts: 1, delayMs: 0 });
            if (token) config.headers.Authorization = `Bearer ${token}`;
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
      (response) => {
        // Keep branch ID in sync with what backend actually used (BranchGuard can fall back).
        try {
          if (typeof window !== 'undefined') {
            const effective =
              (response.headers?.['x-effective-branch-id'] as string | undefined) ?? undefined;
            if (effective && effective.trim() !== '') {
              const current = window.localStorage.getItem('currentBranchId');
              if (!current || current !== effective) {
                window.localStorage.setItem('currentBranchId', effective);
              }
            }
          }
        } catch {
          // Non-blocking
        }
        return response;
      },
      async (error: AxiosError<ApiResponse<unknown>> & { isOfflineError?: boolean }) => {
        if (error.isOfflineError) {
          return Promise.reject(error);
        }

        // Sync branch ID from error responses too (helps recover from stale localStorage).
        try {
          if (typeof window !== 'undefined') {
            const effective =
              (error.response?.headers?.['x-effective-branch-id'] as string | undefined) ?? undefined;
            if (effective && effective.trim() !== '') {
              const current = window.localStorage.getItem('currentBranchId');
              if (!current || current !== effective) {
                window.localStorage.setItem('currentBranchId', effective);
              }
            }
          }
        } catch {
          // Non-blocking
        }

        // Network/timeout errors - show connection message
        const isNetworkError =
          error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED' || error.message === 'Network Error';
        if (
          isNetworkError &&
          typeof window !== 'undefined' &&
          shouldShowGlobalErrorToast(error.config)
        ) {
          showConnectionToastOnce();
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

          // If Supabase has a local session but the backend rejected the access token,
          // attempt a single refresh and retry the original request.
          //
          // This fixes the common "redirect to dashboard → /auth/me 401 invalid/expired → blank shell until manual refresh"
          // race on first mount after login/OAuth.
          const originalConfig = error.config as (InternalAxiosRequestConfig & {
            _ntgRetriedAfterRefresh?: boolean;
            _ntgRefreshAttempted?: boolean;
            _ntgRefreshFailed?: boolean;
          }) | undefined;
          const isRetriable =
            typeof window !== 'undefined' &&
            Boolean(originalConfig) &&
            !originalConfig?._ntgRetriedAfterRefresh;

          const isNoToken =
            typeof message === 'string' && message.toLowerCase().includes('no token provided');

          if (!isNoToken && isRetriable) {
            try {
              const refreshedToken = await refreshSupabaseSessionOnce();
              if (originalConfig) {
                originalConfig._ntgRefreshAttempted = true;
                originalConfig._ntgRefreshFailed = !refreshedToken;
              }
              if (refreshedToken && originalConfig) {
                originalConfig._ntgRetriedAfterRefresh = true;
                originalConfig.headers = originalConfig.headers ?? {};
                originalConfig.headers.Authorization = `Bearer ${refreshedToken}`;
                return await this.client.request(originalConfig);
              }
            } catch {
              // Fall through to normal 401 handling
            }
          }

            // Only force logout when the token was sent but invalid/expired.
            // "No token provided" means the request went out without a token (e.g. session not
            // ready yet or race on page load) – do NOT logout so the user isn’t kicked out unnecessarily.
          if (!isNoToken && typeof window !== 'undefined') {
            try {
              const {
                data: { session },
              } = await supabase.auth.getSession();

              const hasSession = Boolean(session?.access_token);
              // If Supabase doesn't have a usable session, clear local state and go to login.
              // Also clear when the backend rejects the token and refresh didn't yield a new token
              // (prevents repeated `/auth/me` hammering due to stale local sessions).
              const refreshFailed = Boolean(originalConfig?._ntgRefreshAttempted) && Boolean(originalConfig?._ntgRefreshFailed);

              if (!hasSession || refreshFailed) {
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

        // Surface backend error messages (HttpExceptionFilter returns { error: { message } })
        // so UI doesn't just show "Request failed with status code XYZ".
        if (error.response?.data) {
          const body = error.response.data as unknown as {
            error?: { message?: string | string[] };
            message?: string | string[];
          };
          const raw = body?.error?.message ?? body?.message;
          const text = Array.isArray(raw) ? raw.join(', ') : typeof raw === 'string' ? raw : '';
          if (text.trim().length > 0) {
            error.message = text;
          }
        }

        // Inactive account while session still exists locally — clear session and return to login.
        if (error.response?.status === 403 && typeof window !== 'undefined') {
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
    return this.blobResponseWithFilename(response);
  }

  async postBlobWithFilename(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<{ blob: Blob; filename?: string }> {
    const response = await this.client.post<Blob>(url, data, {
      ...config,
      responseType: 'blob',
      timeout: config?.timeout ?? 60000,
    });
    return this.blobResponseWithFilename(response);
  }

  private blobResponseWithFilename(response: { data: Blob; headers?: Record<string, unknown> }): {
    blob: Blob;
    filename?: string;
  } {
    const cd = (response.headers?.['content-disposition'] as string | undefined) ?? undefined;
    const filename = (() => {
      if (!cd) return undefined;
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

