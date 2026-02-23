import { useState, useEffect } from 'react';
import { useRestaurantInfo } from './use-restaurant-info';

/**
 * Hook to get the currency from tenant/restaurant data
 * Falls back to 'IQD' if not found
 * Uses cached restaurant info to prevent duplicate API calls
 */
export function useCurrency(): string {
  const { restaurantInfo } = useRestaurantInfo();
  const [currency, setCurrency] = useState<string>('IQD');

  useEffect(() => {
        if (restaurantInfo?.defaultCurrency) {
          setCurrency(restaurantInfo.defaultCurrency);
        } else {
          setCurrency('IQD');
        }
  }, [restaurantInfo]);

  return currency;
}

