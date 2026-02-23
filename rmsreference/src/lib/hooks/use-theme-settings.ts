import { useState, useEffect } from 'react';
import { useRestaurantInfo } from './use-restaurant-info';
import { useRestaurantStore } from '@/lib/store/restaurant-store';

export interface ThemeSettings {
  primary_color?: string;
}

/**
 * Hook to fetch theme settings from the backend
 * Uses the restaurant API to get primary color
 */
export function useThemeSettings() {
  const { restaurant } = useRestaurantStore();
  const { restaurantInfo, loading: restaurantInfoLoading } = useRestaurantInfo();
  const [data, setData] = useState<ThemeSettings | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!restaurant?.id) {
      setData(undefined);
      setIsLoading(false);
      return;
    }

    if (restaurantInfoLoading) {
      setIsLoading(true);
      return;
    }

    if (restaurantInfo) {
      setData({
        primary_color: restaurantInfo.primaryColor,
      });
      setError(null);
      setIsLoading(false);
    } else {
      setData(undefined);
      setIsLoading(false);
    }
  }, [restaurant?.id, restaurantInfo, restaurantInfoLoading]);

  return { data, isLoading, error };
}

/**
 * Hook to fetch public theme settings (works without authentication)
 */
export function usePublicThemeSettings() {
  const { restaurant } = useRestaurantStore();
  const { restaurantInfo, loading: restaurantInfoLoading } = useRestaurantInfo();
  const [data, setData] = useState<ThemeSettings | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!restaurant?.id) {
      setData(undefined);
      setIsLoading(false);
      return;
    }

    if (restaurantInfoLoading) {
      setIsLoading(true);
      return;
    }

    if (restaurantInfo) {
      setData({
        primary_color: restaurantInfo.primaryColor,
      });
      setError(null);
      setIsLoading(false);
    } else {
      setData(undefined);
      setIsLoading(false);
    }
  }, [restaurant?.id, restaurantInfo, restaurantInfoLoading]);

  return { data, isLoading, error };
}

