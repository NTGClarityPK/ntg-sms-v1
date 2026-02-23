import apiClient from './client';
import { API_BASE_URL } from '../constants/api';

// Cache for getUserPermissions to prevent duplicate API calls
const userPermissionsCache = new Map<string, { data: Permission[]; timestamp: number }>();
const pendingPermissionsRequests = new Map<string, Promise<Permission[]>>();
const PERMISSIONS_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export interface Role {
  id: string;
  name: string;
  displayNameEn: string;
  displayNameAr?: string;
  description?: string;
  isSystemRole: boolean;
  isActive: boolean;
  permissions?: Permission[];
}

export interface Permission {
  id: string;
  resource: string;
  action: string;
  description?: string;
}

export interface UserRole {
  id: string;
  userId: string;
  roleId: string;
  role?: Role;
  assignedAt: string;
  assignedBy?: string;
}

export const rolesApi = {
  getRoles: async (): Promise<Role[]> => {
    const response = await apiClient.get<Role[]>(`${API_BASE_URL}/roles`);
    return response.data;
  },

  getRoleById: async (id: string): Promise<Role> => {
    const response = await apiClient.get<Role>(`${API_BASE_URL}/roles/${id}`);
    return response.data;
  },

  getPermissions: async (): Promise<Permission[]> => {
    const response = await apiClient.get<Permission[]>(`${API_BASE_URL}/roles/permissions`);
    return response.data;
  },

  getUserRoles: async (userId: string): Promise<UserRole[]> => {
    const response = await apiClient.get<UserRole[]>(`${API_BASE_URL}/roles/user/${userId}`);
    return response.data;
  },

  getUserPermissions: async (userId: string): Promise<Permission[]> => {
    // Check cache first
    const cached = userPermissionsCache.get(userId);
    const now = Date.now();
    if (cached && (now - cached.timestamp) < PERMISSIONS_CACHE_DURATION) {
      return cached.data;
    }

    // If there's a pending request for this user, return it
    const pendingRequest = pendingPermissionsRequests.get(userId);
    if (pendingRequest) {
      return pendingRequest;
    }

    // Make new request
    const requestPromise = apiClient.get<Permission[]>(`${API_BASE_URL}/roles/user/${userId}/permissions`)
      .then((response) => {
        userPermissionsCache.set(userId, {
          data: response.data,
          timestamp: Date.now(),
        });
        pendingPermissionsRequests.delete(userId);
        return response.data;
      })
      .catch((error) => {
        pendingPermissionsRequests.delete(userId);
        throw error;
      });

    pendingPermissionsRequests.set(userId, requestPromise);
    return requestPromise;
  },
};








