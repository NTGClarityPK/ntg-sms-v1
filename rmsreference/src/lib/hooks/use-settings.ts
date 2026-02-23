import { useState, useEffect, useCallback, useRef } from 'react';
import { settingsApi, Settings } from '@/lib/api/settings';
import { useBranchStore } from '@/lib/store/branch-store';

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Cache per branch
const settingsCache: Map<string, { settings: Settings; timestamp: number }> = new Map();
// Track pending requests to prevent duplicate calls
const pendingRequests: Map<string, Promise<Settings>> = new Map();

// Function to clear cache (useful when settings are updated)
export function clearSettingsCache(branchId?: string) {
  if (branchId) {
    settingsCache.delete(branchId);
    pendingRequests.delete(branchId || 'tenant-level');
  } else {
    settingsCache.clear();
    pendingRequests.clear();
  }
}

export function useSettings() {
  const { selectedBranchId } = useBranchStore();
  const cacheKey = selectedBranchId || 'tenant-level';
  const cached = settingsCache.get(cacheKey);
  const loadingRef = useRef(false);
  
  const [settings, setSettings] = useState<Settings | null>(cached?.settings || null);
  const [loading, setLoading] = useState(!cached);

  const loadSettings = useCallback(async () => {
    const currentCacheKey = selectedBranchId || 'tenant-level';
    
    // Check if there's already a pending request for this cache key
    const pendingRequest = pendingRequests.get(currentCacheKey);
    if (pendingRequest) {
      try {
        const data = await pendingRequest;
        setSettings(data);
        setLoading(false);
        return;
      } catch (error) {
        // If pending request failed, continue to make a new request
      }
    }
    
    // Check cache first
    const cached = settingsCache.get(currentCacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setSettings(cached.settings);
      setLoading(false);
      return;
    }
    
    // Prevent duplicate calls
    if (loadingRef.current) {
      return;
    }
    
    loadingRef.current = true;
    setLoading(true);
    
    try {
      // Create a promise for this request and store it
      const requestPromise = settingsApi.getSettings(selectedBranchId || undefined);
      pendingRequests.set(currentCacheKey, requestPromise);
      
      const data = await requestPromise;
      setSettings(data);
      settingsCache.set(currentCacheKey, { settings: data, timestamp: Date.now() });
      pendingRequests.delete(currentCacheKey);
    } catch (error) {
      console.error('Failed to load settings:', error);
      pendingRequests.delete(currentCacheKey);
      // Use cached settings if available
      const cached = settingsCache.get(currentCacheKey);
      if (cached) {
        setSettings(cached.settings);
      }
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [selectedBranchId]);

  useEffect(() => {
    // Use cache if fresh, otherwise load
    const currentCacheKey = selectedBranchId || 'tenant-level';
    const cached = settingsCache.get(currentCacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setSettings(cached.settings);
      setLoading(false);
    } else {
      loadSettings();
    }

    // Listen for settings update events to refresh
    const handleSettingsUpdate = () => {
      clearSettingsCache(selectedBranchId || undefined);
      loadSettings();
    };
    window.addEventListener('settingsUpdated', handleSettingsUpdate);
    return () => {
      window.removeEventListener('settingsUpdated', handleSettingsUpdate);
    };
  }, [loadSettings, selectedBranchId]);

  return { settings, loading, refresh: loadSettings };
}

