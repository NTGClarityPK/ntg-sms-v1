import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { ApiResponse } from '@/types/api';
import { supabase } from './supabase/client';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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
    // Request interceptor - inject auth token and branch header
    this.client.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.access_token) {
          config.headers.Authorization = `Bearer ${session.access_token}`;
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
      async (error: AxiosError<ApiResponse<unknown>>) => {
        if (error.response?.status === 401) {
          const body = error.response.data as { error?: { message?: string } } | undefined;
          const message = body?.error?.message ?? (body as { message?: string })?.message ?? '';

            // Only force logout when the token was sent but invalid/expired.
            // "No token provided" means the request went out without a token (e.g. session not
            // ready yet or race on page load) – do NOT logout so the user isn’t kicked out unnecessarily.
          const isNoToken = typeof message === 'string' && message.toLowerCase().includes('no token provided');
          if (!isNoToken && typeof window !== 'undefined') {
            const {
              data: { session },
            } = await supabase.auth.getSession();

            const hasSession = Boolean(session?.access_token);
            if (!hasSession) {
              await supabase.auth.signOut();
              if (window.location.pathname !== '/login') {
                window.location.href = '/login';
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
   */
  async getBlob(url: string, config?: AxiosRequestConfig): Promise<Blob> {
    const response = await this.client.get<Blob>(url, {
      ...config,
      responseType: 'blob',
    });
    return response.data;
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

