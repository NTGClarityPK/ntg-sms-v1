import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { ApiResponse } from '@/types/api';
import { supabase } from './supabase/client';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    console.log('ApiClient - Base URL:', baseURL);
    
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000, // 10 second timeout
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
          // Unauthorized:
          // - If we *don't* have a Supabase session, force logout + redirect to login.
          // - If we *do* have a session, do NOT auto-logout (prevents redirect loops during startup/race conditions).
          if (typeof window !== 'undefined') {
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

