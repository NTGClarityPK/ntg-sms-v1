import { useState, useEffect, useCallback, useRef } from 'react';
import { subscriptionApi, SubscriptionResponse, SubscriptionUsage, PlanId } from '../api/subscription';
import { useAuthStore } from '../store/auth-store';

interface UseSubscriptionReturn {
  subscription: SubscriptionResponse | null;
  usage: SubscriptionUsage | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  refreshUsage: () => Promise<void>;
  hasFeatureAccess: (feature: string) => Promise<boolean>;
  hasReportsAccess: () => Promise<boolean>;
  canUseLanguage: (language: string) => Promise<boolean>;
  isFreePlan: boolean;
  isStarterPlan: boolean;
  isProPlan: boolean;
  isEnterprisePlan: boolean;
}

let subscriptionCache: SubscriptionResponse | null = null;
let usageCache: SubscriptionUsage | null = null;
let subscriptionCacheTimestamp: number = 0;
let usageCacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
let pendingSubscriptionRequest: Promise<SubscriptionResponse> | null = null;
let pendingUsageRequest: Promise<SubscriptionUsage> | null = null;

export function useSubscription(): UseSubscriptionReturn {
  const [subscription, setSubscription] = useState<SubscriptionResponse | null>(subscriptionCache);
  const [usage, setUsage] = useState<SubscriptionUsage | null>(usageCache);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuthStore();
  const loadingSubscriptionRef = useRef(false);
  const loadingUsageRef = useRef(false);

  const loadSubscription = useCallback(async () => {
    if (!user?.tenantId) {
      setLoading(false);
      return;
    }

    // Check cache first
    const now = Date.now();
    if (subscriptionCache && (now - subscriptionCacheTimestamp) < CACHE_DURATION) {
      setSubscription(subscriptionCache);
      setLoading(false);
      return;
    }

    // If there's already a pending request, wait for it
    if (pendingSubscriptionRequest) {
      try {
        const data = await pendingSubscriptionRequest;
        setSubscription(data);
        setLoading(false);
        return;
      } catch (err) {
        // If pending request fails, continue to make a new request
        pendingSubscriptionRequest = null;
      }
    }

    // Prevent concurrent duplicate requests
    if (loadingSubscriptionRef.current) {
      return;
    }

    try {
      loadingSubscriptionRef.current = true;
      setLoading(true);
      setError(null);

      // Create a shared promise for concurrent requests
      const requestPromise = subscriptionApi.getSubscription();
      pendingSubscriptionRequest = requestPromise;
      
      const data = await requestPromise;
      subscriptionCache = data;
      subscriptionCacheTimestamp = now;
      setSubscription(data);
      pendingSubscriptionRequest = null;
    } catch (err: any) {
      console.error('Failed to load subscription:', err);
      setError(err);
      pendingSubscriptionRequest = null;
      // Don't set subscription to null on error - keep cached value if available
    } finally {
      setLoading(false);
      loadingSubscriptionRef.current = false;
    }
  }, [user?.tenantId]);

  const loadUsage = useCallback(async () => {
    if (!user?.tenantId) {
      return;
    }

    // Check cache first
    const now = Date.now();
    if (usageCache && (now - usageCacheTimestamp) < CACHE_DURATION) {
      setUsage(usageCache);
      return;
    }

    // If there's already a pending request, wait for it
    if (pendingUsageRequest) {
      try {
        const data = await pendingUsageRequest;
        setUsage(data);
        return;
      } catch (err) {
        // If pending request fails, continue to make a new request
        pendingUsageRequest = null;
      }
    }

    // Prevent concurrent duplicate requests
    if (loadingUsageRef.current) {
      return;
    }

    try {
      loadingUsageRef.current = true;
      
      // Create a shared promise for concurrent requests
      const requestPromise = subscriptionApi.getUsage();
      pendingUsageRequest = requestPromise;
      
      const data = await requestPromise;
      usageCache = data;
      usageCacheTimestamp = now;
      setUsage(data);
      pendingUsageRequest = null;
    } catch (err: any) {
      console.error('Failed to load usage:', err);
      pendingUsageRequest = null;
    } finally {
      loadingUsageRef.current = false;
    }
  }, [user?.tenantId]);

  useEffect(() => {
    loadSubscription();
    loadUsage();
  }, [loadSubscription, loadUsage]);

  const refresh = useCallback(async () => {
    subscriptionCache = null;
    subscriptionCacheTimestamp = 0;
    pendingSubscriptionRequest = null;
    await loadSubscription();
  }, [loadSubscription]);

  const refreshUsage = useCallback(async () => {
    usageCache = null;
    usageCacheTimestamp = 0;
    pendingUsageRequest = null;
    await loadUsage();
  }, [loadUsage]);

  const hasFeatureAccess = useCallback(async (feature: string): Promise<boolean> => {
    try {
      return await subscriptionApi.hasFeatureAccess(feature);
    } catch (err) {
      console.error('Failed to check feature access:', err);
      return false;
    }
  }, []);

  const hasReportsAccess = useCallback(async (): Promise<boolean> => {
    try {
      return await subscriptionApi.hasReportsAccess();
    } catch (err) {
      console.error('Failed to check reports access:', err);
      return false;
    }
  }, []);

  const canUseLanguage = useCallback(async (language: string): Promise<boolean> => {
    try {
      return await subscriptionApi.canUseLanguage(language);
    } catch (err) {
      console.error('Failed to check language access:', err);
      return false;
    }
  }, []);

  const isFreePlan = subscription?.planId === PlanId.FREE;
  const isStarterPlan = subscription?.planId === PlanId.STARTER;
  const isProPlan = subscription?.planId === PlanId.PRO;
  const isEnterprisePlan = subscription?.planId === PlanId.ENTERPRISE;

  return {
    subscription,
    usage,
    loading,
    error,
    refresh,
    refreshUsage,
    hasFeatureAccess,
    hasReportsAccess,
    canUseLanguage,
    isFreePlan,
    isStarterPlan,
    isProPlan,
    isEnterprisePlan,
  };
}

