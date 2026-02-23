import apiClient from './client';
import { API_ENDPOINTS } from '../constants/api';
import { tokenStorage } from './client';
import { useRestaurantStore } from '../store/restaurant-store';
import { useThemeStore } from '../store/theme-store';
import { DEFAULT_THEME_COLOR } from '../utils/theme';

// Cache for getCurrentUser to prevent duplicate API calls
// Use a map to cache by language (normalize undefined to empty string)
const currentUserCacheMap = new Map<string, { data: any; timestamp: number }>();
const pendingCurrentUserRequests = new Map<string, Promise<any>>();
const CURRENT_USER_CACHE_DURATION = 30 * 1000; // 30 seconds

// Normalize language parameter for consistent caching
const normalizeLanguage = (language?: string): string => {
  return language || '';
};

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role?: string;
  defaultCurrency?: string;
  restaurantName?: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    tenantId: string;
  };
  accessToken: string;
  refreshToken: string;
  branchId?: string; // Optional: included when there's exactly one branch for the tenant
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileDto {
  name?: string;
  phone?: string;
  email?: string;
}

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>(
      API_ENDPOINTS.AUTH.LOGIN,
      credentials
    );
    const { accessToken, refreshToken, user } = response.data;
    
    // Note: We keep all users' PINs - each user can have their own PIN
    // The PIN check always verifies the email matches, so users only see their own PINs
    
    tokenStorage.setTokens(accessToken, refreshToken);
    // Clear caches on login to ensure fresh data
    currentUserCacheMap.clear();
    pendingCurrentUserRequests.clear();
    return response.data;
  },

  signup: async (data: SignupData): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>(
      API_ENDPOINTS.AUTH.SIGNUP,
      data
    );
    const { accessToken, refreshToken, user } = response.data;
    tokenStorage.setTokens(accessToken, refreshToken);
    return response.data;
  },

  pinLogin: async (pin: string, language?: string): Promise<AuthResponse> => {
    // Import pinAuth utility dynamically to avoid circular dependencies
    const { pinAuth } = await import('@/lib/utils/pin-auth');
    const { getTranslation } = await import('@/lib/utils/translations');
    
    // Get language for error messages
    const lang = (language as any) || 'en';
    
    // Authenticate with PIN - this will search all PINs and find the matching one
    // Don't specify email, let it find the PIN that matches
    const refreshToken = await pinAuth.authenticateWithPin(pin, undefined, lang);
    
    // Use refresh token to get new access token
    const refreshResponse = await authApi.refreshToken(refreshToken);
    
    // Get user data to verify which user this PIN belongs to
    const userData = await authApi.getCurrentUser();
    
    // Verify the PIN belongs to this user by checking if PIN exists for this user's email
    const normalizedUserEmail = userData.email.toLowerCase().trim();
    const pinExistsForUser = await pinAuth.isPinAuthAvailable(normalizedUserEmail);
    
    if (!pinExistsForUser) {
      // PIN was found but doesn't belong to the logged-in user
      // This shouldn't happen in normal flow, but could occur if there's a mismatch
      // The refresh token should have authenticated us as the correct user, so if PIN
      // doesn't exist for this user, there might be stale data - clear this user's PIN
      pinAuth.clearPinAuth(normalizedUserEmail);
      throw new Error(getTranslation('auth.pinAuthenticationFailed', lang));
    }
    
    // Clear caches on login to ensure fresh data
    currentUserCacheMap.clear();
    pendingCurrentUserRequests.clear();
    
    return {
      user: userData,
      accessToken: refreshResponse.accessToken,
      refreshToken: refreshResponse.refreshToken || refreshToken,
      branchId: refreshResponse.branchId,
    };
  },

  getCurrentUser: async (language?: string) => {
    const normalizedLang = normalizeLanguage(language);
    const now = Date.now();
    
    // Check cache first
    const cached = currentUserCacheMap.get(normalizedLang);
    if (cached && (now - cached.timestamp) < CURRENT_USER_CACHE_DURATION) {
      return cached.data;
    }

    // If there's a pending request for the same language, return it
    const pendingRequest = pendingCurrentUserRequests.get(normalizedLang);
    if (pendingRequest) {
      return pendingRequest;
    }

    // Make new request
    const params = language ? `?language=${language}` : '';
    const requestPromise = apiClient.get(`${API_ENDPOINTS.AUTH.ME}${params}`)
      .then((response) => {
        // Cache the response
        currentUserCacheMap.set(normalizedLang, {
          data: response.data,
          timestamp: Date.now(),
        });
        pendingCurrentUserRequests.delete(normalizedLang);
        return response.data;
      })
      .catch((error) => {
        pendingCurrentUserRequests.delete(normalizedLang);
        // Clear cache for this language on error
        currentUserCacheMap.delete(normalizedLang);
        throw error;
      });

    pendingCurrentUserRequests.set(normalizedLang, requestPromise);
    return requestPromise;
  },

  logout: () => {
    tokenStorage.clearTokens();
    // Clear caches on logout
    currentUserCacheMap.clear();
    pendingCurrentUserRequests.clear();
    // NOTE: We do NOT clear PIN auth data on logout - it should persist
    // so users can use PIN to login again on the same device
    if (typeof window !== 'undefined') {
      import('../store/restaurant-store').then(({ useRestaurantStore }) => {
        useRestaurantStore.getState().setRestaurant(null);
      });
      // Clear branch store on logout
      import('../store/branch-store').then(({ useBranchStore }) => {
        useBranchStore.getState().setSelectedBranchId(null);
      });
      // Reset theme to default on logout
      import('../store/theme-store').then(({ useThemeStore }) => {
        import('../utils/theme').then(({ DEFAULT_THEME_COLOR }) => {
          useThemeStore.getState().setPrimaryColor(DEFAULT_THEME_COLOR);
        });
      });
      window.location.href = '/login';
    }
  },

  refreshToken: async (refreshToken: string) => {
    const response = await apiClient.post(API_ENDPOINTS.AUTH.REFRESH, {
      refreshToken,
    });
    const { accessToken, refreshToken: newRefreshToken } = response.data;
    tokenStorage.setTokens(accessToken, newRefreshToken || refreshToken);
    return response.data;
  },

  getProfile: async (language?: string): Promise<UserProfile> => {
    const params = language ? `?language=${language}` : '';
    const response = await apiClient.get<UserProfile>(`${API_ENDPOINTS.AUTH.PROFILE}${params}`);
    return response.data;
  },

  updateProfile: async (data: UpdateProfileDto): Promise<UserProfile> => {
    const response = await apiClient.put<UserProfile>(API_ENDPOINTS.AUTH.PROFILE, data);
    return response.data;
  },

  getAssignedBranches: async (): Promise<Array<{ id: string; name: string; code: string }>> => {
    const response = await apiClient.get(API_ENDPOINTS.AUTH.ASSIGNED_BRANCHES);
    return response.data;
  },
};

