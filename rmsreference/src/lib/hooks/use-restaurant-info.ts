import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/lib/store/auth-store';
import { useLanguageStore } from '@/lib/store/language-store';
import { restaurantApi, RestaurantInfo } from '@/lib/api/restaurant';

// Cache restaurant info to prevent duplicate API calls
let restaurantInfoCache: RestaurantInfo | null = null;
let cacheTimestamp: number = 0;
let cacheLanguage: string = '';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
let pendingRequest: Promise<RestaurantInfo> | null = null;

/**
 * Hook to get restaurant info with caching
 * Prevents duplicate API calls when multiple components need the same data
 */
export function useRestaurantInfo(): {
  restaurantInfo: RestaurantInfo | null;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const { user } = useAuthStore();
  const { language } = useLanguageStore();
  const [restaurantInfo, setRestaurantInfo] = useState<RestaurantInfo | null>(restaurantInfoCache);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);

  const loadRestaurantInfo = useCallback(async (forceRefresh = false) => {
    if (!user?.tenantId) {
      setRestaurantInfo(null);
      return;
    }

    const now = Date.now();
    const cacheValid = 
      restaurantInfoCache && 
      (now - cacheTimestamp) < CACHE_DURATION &&
      cacheLanguage === language;

    // Use cache if valid and not forcing refresh
    if (cacheValid && !forceRefresh) {
      setRestaurantInfo(restaurantInfoCache);
      return;
    }

    // If there's already a pending request for the same language, wait for it
    if (pendingRequest && !forceRefresh) {
      try {
        const data = await pendingRequest;
        setRestaurantInfo(data);
        return;
      } catch (error) {
        // If pending request fails, continue to make a new request
        pendingRequest = null;
      }
    }

    // Prevent concurrent requests
    if (loadingRef.current && !forceRefresh) {
      return;
    }

    try {
      loadingRef.current = true;
      setLoading(true);
      
      // Create a shared promise for concurrent requests
      const requestPromise = restaurantApi.getInfo(language);
      pendingRequest = requestPromise;
      
      const data = await requestPromise;
      
      // Update cache
      restaurantInfoCache = data;
      cacheTimestamp = now;
      cacheLanguage = language;
      
      setRestaurantInfo(data);
      pendingRequest = null; // Clear pending request after success
    } catch (error) {
      console.warn('Failed to load restaurant info:', error);
      pendingRequest = null; // Clear pending request on error
      // Don't clear cache on error, keep stale data
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [user?.tenantId, language]);

  useEffect(() => {
    loadRestaurantInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.tenantId, language]); // Only reload when tenantId or language changes, not when loadRestaurantInfo changes

  const refresh = async () => {
    await loadRestaurantInfo(true);
  };

  return {
    restaurantInfo,
    loading,
    refresh,
  };
}

