import apiClient from './client';
import { API_ENDPOINTS } from '../constants/api';
import { createCrudApi } from '@/shared/services/api/factory';
import { getApiLanguage } from '../hooks/use-api-language';

export interface DayTiming {
  isOpen?: boolean;
  openTime?: string;
  breakStartTime?: string;
  breakEndTime?: string;
  closeTime?: string;
}

export interface BusinessTimings {
  monday?: DayTiming;
  tuesday?: DayTiming;
  wednesday?: DayTiming;
  thursday?: DayTiming;
  friday?: DayTiming;
  saturday?: DayTiming;
  sunday?: DayTiming;
}

export interface RestaurantInfo {
  id: string;
  name: string;
  subdomain: string;
  email: string;
  phone?: string;
  logoUrl?: string;
  primaryColor?: string;
  defaultCurrency: string;
  timezone: string;
  fiscalYearStart?: string;
  vatNumber?: string;
  isActive: boolean;
  businessTimings?: BusinessTimings | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateRestaurantInfoDto {
  name?: string;
  email?: string;
  phone?: string;
  logoUrl?: string;
  primaryColor?: string;
  defaultCurrency?: string;
  timezone?: string;
  fiscalYearStart?: string;
  vatNumber?: string;
  isActive?: boolean;
  businessTimings?: BusinessTimings;
}

export interface Branch {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
  email?: string;
  latitude?: number;
  longitude?: number;
  managerId?: string;
  manager?: {
    id: string;
    name: string;
    email: string;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBranchDto {
  name: string;
  code: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
  email?: string;
  latitude?: number;
  longitude?: number;
  managerId?: string;
}

export interface UpdateBranchDto {
  name?: string;
  code?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
  email?: string;
  latitude?: number;
  longitude?: number;
  managerId?: string;
  isActive?: boolean;
}

export interface Counter {
  id: string;
  branchId: string;
  branch?: {
    id: string;
    name: string;
    code: string;
  };
  name: string;
  code: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCounterDto {
  name: string;
  code: string;
  branchId: string;
}

export interface UpdateCounterDto {
  name?: string;
  code?: string;
  isActive?: boolean;
}

export interface Table {
  id: string;
  branchId: string;
  branch?: {
    id: string;
    name: string;
    code: string;
  };
  tableNumber: string;
  seatingCapacity: number;
  tableType: 'regular' | 'vip' | 'outdoor';
  qrCode?: string;
  status: 'available' | 'occupied' | 'reserved' | 'out_of_service';
  createdAt: string;
  updatedAt: string;
}

export interface CreateTableDto {
  tableNumber: string;
  branchId: string;
  seatingCapacity?: number;
  tableType?: 'regular' | 'vip' | 'outdoor';
}

export interface UpdateTableDto {
  tableNumber?: string;
  seatingCapacity?: number;
  tableType?: 'regular' | 'vip' | 'outdoor';
  status?: 'available' | 'occupied' | 'reserved' | 'out_of_service';
  qrCode?: string;
}

// Use factory for base CRUD operations on branches
const baseBranchesApi = createCrudApi<Branch>(API_ENDPOINTS.RESTAURANT.BRANCHES);

// Cache for getInfo to prevent duplicate API calls
let restaurantInfoCache: RestaurantInfo | null = null;
let restaurantInfoCacheTimestamp: number = 0;
let restaurantInfoCacheLanguage: string | undefined = undefined;
let pendingRestaurantInfoRequest: Promise<RestaurantInfo> | null = null;
const RESTAURANT_INFO_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const restaurantApi = {
  // Business Information
  async getInfo(language?: string): Promise<RestaurantInfo> {
    const lang = language || getApiLanguage();
    
    // Check cache first
    const now = Date.now();
    if (
      restaurantInfoCache &&
      restaurantInfoCacheLanguage === lang &&
      (now - restaurantInfoCacheTimestamp) < RESTAURANT_INFO_CACHE_DURATION
    ) {
      return restaurantInfoCache;
    }

    // If there's a pending request for the same language, return it
    if (pendingRestaurantInfoRequest && restaurantInfoCacheLanguage === lang) {
      return pendingRestaurantInfoRequest;
    }

    // Make new request
    const requestPromise = apiClient.get(`${API_ENDPOINTS.RESTAURANT.INFO}?language=${lang}`)
      .then((response) => {
        restaurantInfoCache = response.data;
        restaurantInfoCacheTimestamp = Date.now();
        restaurantInfoCacheLanguage = lang;
        pendingRestaurantInfoRequest = null;
        return response.data;
      })
      .catch((error) => {
        pendingRestaurantInfoRequest = null;
        // Clear cache on error
        restaurantInfoCache = null;
        restaurantInfoCacheTimestamp = 0;
        restaurantInfoCacheLanguage = undefined;
        throw error;
      });

    pendingRestaurantInfoRequest = requestPromise;
    return requestPromise;
  },

  async updateInfo(data: UpdateRestaurantInfoDto, language?: string): Promise<RestaurantInfo> {
    const lang = language || getApiLanguage();
    const response = await apiClient.put(`${API_ENDPOINTS.RESTAURANT.INFO}?language=${lang}`, data);
    // Clear cache on update to ensure fresh data
    restaurantInfoCache = null;
    restaurantInfoCacheTimestamp = 0;
    restaurantInfoCacheLanguage = undefined;
    pendingRestaurantInfoRequest = null;
    return response.data;
  },

  async uploadLogo(file: File): Promise<RestaurantInfo> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post(`${API_ENDPOINTS.RESTAURANT.INFO}/upload-logo`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    // Clear cache on logo upload to ensure fresh data
    restaurantInfoCache = null;
    restaurantInfoCacheTimestamp = 0;
    restaurantInfoCacheLanguage = undefined;
    pendingRestaurantInfoRequest = null;
    return response.data;
  },

  // Branches - Using factory for CRUD operations
  async getBranches(language?: string): Promise<Branch[]> {
    const lang = language || getApiLanguage();
    const response = await apiClient.get(`${API_ENDPOINTS.RESTAURANT.BRANCHES}?language=${lang}`);
    return Array.isArray(response.data) ? response.data : [];
  },

  getBranch: async (id: string, language?: string): Promise<Branch> => {
    const lang = language || getApiLanguage();
    const response = await apiClient.get(`${API_ENDPOINTS.RESTAURANT.BRANCHES}/${id}?language=${lang}`);
    return response.data;
  },
  createBranch: baseBranchesApi.create,
  updateBranch: async (id: string, data: UpdateBranchDto, language?: string): Promise<Branch> => {
    const lang = language || getApiLanguage();
    const response = await apiClient.put(`${API_ENDPOINTS.RESTAURANT.BRANCHES}/${id}?language=${lang}`, data);
    return response.data;
  },
  deleteBranch: baseBranchesApi.delete,

  // Counters
  async getCounters(branchId?: string): Promise<Counter[]> {
    const params = branchId ? { branchId } : {};
    const response = await apiClient.get(API_ENDPOINTS.RESTAURANT.COUNTERS, { params });
    return response.data;
  },

  async getCounter(id: string): Promise<Counter> {
    const response = await apiClient.get(`${API_ENDPOINTS.RESTAURANT.COUNTERS}/${id}`);
    return response.data;
  },

  async createCounter(data: CreateCounterDto): Promise<Counter> {
    const response = await apiClient.post(API_ENDPOINTS.RESTAURANT.COUNTERS, data);
    return response.data;
  },

  async updateCounter(id: string, data: UpdateCounterDto): Promise<Counter> {
    const response = await apiClient.put(`${API_ENDPOINTS.RESTAURANT.COUNTERS}/${id}`, data);
    return response.data;
  },

  async deleteCounter(id: string): Promise<void> {
    await apiClient.delete(`${API_ENDPOINTS.RESTAURANT.COUNTERS}/${id}`);
  },

  // Tables
  async getTables(branchId?: string): Promise<Table[]> {
    const params = branchId ? { branchId } : {};
    const response = await apiClient.get(API_ENDPOINTS.RESTAURANT.TABLES, { params });
    return response.data;
  },

  async getAvailableTables(branchId?: string): Promise<Table[]> {
    const params = branchId ? { branchId } : {};
    const response = await apiClient.get(`${API_ENDPOINTS.RESTAURANT.TABLES}/available`, { params });
    return response.data;
  },

  async getTable(id: string): Promise<Table> {
    const response = await apiClient.get(`${API_ENDPOINTS.RESTAURANT.TABLES}/${id}`);
    return response.data;
  },

  async createTable(data: CreateTableDto): Promise<Table> {
    const response = await apiClient.post(API_ENDPOINTS.RESTAURANT.TABLES, data);
    return response.data;
  },

  async updateTable(id: string, data: UpdateTableDto): Promise<Table> {
    const response = await apiClient.put(`${API_ENDPOINTS.RESTAURANT.TABLES}/${id}`, data);
    return response.data;
  },

  async deleteTable(id: string): Promise<void> {
    await apiClient.delete(`${API_ENDPOINTS.RESTAURANT.TABLES}/${id}`);
  },
};
