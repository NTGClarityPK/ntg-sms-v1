import { useState, useEffect, useCallback } from 'react';
import { settingsApi, RoleAccessConfiguration } from '@/lib/api/settings';
import { useAuthStore } from '@/lib/store/auth-store';

interface UseRoleAccessConfigReturn {
  configs: RoleAccessConfiguration[];
  loading: boolean;
  getConfigForRole: (roleName: string) => RoleAccessConfiguration | null;
  isTabAccessible: (roleName: string, path: string) => boolean;
  isPathBlocked: (roleName: string, path: string) => boolean;
  isKitchenDisplayEnabled: (roleName: string) => boolean;
  isMarkAsPaidEnabled: (roleName: string) => boolean;
  // Combined permission checks (checks all user roles)
  isTabAccessibleForUser: (path: string) => boolean;
  isPathBlockedForUser: (path: string) => boolean;
  isKitchenDisplayEnabledForUser: () => boolean;
  isMarkAsPaidEnabledForUser: () => boolean;
  refresh: () => Promise<void>;
}

let configsCache: RoleAccessConfiguration[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useRoleAccessConfig(): UseRoleAccessConfigReturn {
  const [configs, setConfigs] = useState<RoleAccessConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();

  const loadConfigs = useCallback(async () => {
    // Check cache first
    const now = Date.now();
    if (configsCache && Array.isArray(configsCache) && (now - cacheTimestamp) < CACHE_DURATION) {
      setConfigs(configsCache);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const loadedConfigs = await settingsApi.getRoleAccessConfigurations();
      
      // Ensure we have an array
      const configsArray = Array.isArray(loadedConfigs) ? loadedConfigs : [];
      
      configsCache = configsArray;
      cacheTimestamp = now;
      setConfigs(configsArray);
    } catch (error) {
      console.error('Failed to load role access configurations:', error);
      // Use empty array on error - will fall back to defaults
      configsCache = [];
      cacheTimestamp = 0;
      setConfigs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.tenantId) {
      loadConfigs();
    }
  }, [user?.tenantId, loadConfigs]);

  const getConfigForRole = useCallback((roleName: string): RoleAccessConfiguration | null => {
    if (!Array.isArray(configs)) {
      console.warn('configs is not an array:', configs);
      return null;
    }
    return configs.find(c => c.roleName === roleName) || null;
  }, [configs]);

  const isTabAccessible = useCallback((roleName: string, path: string): boolean => {
    const config = getConfigForRole(roleName);
    if (!config) return true; // Default to accessible if no config
    
    // If accessibleTabs is empty, nothing is accessible (all blocked)
    if (!config.accessibleTabs || config.accessibleTabs.length === 0) {
      return false;
    }
    
    // Check if path is in accessible tabs
    // If not in accessible tabs, it's automatically blocked
    return config.accessibleTabs.includes(path);
  }, [getConfigForRole]);

  const isPathBlocked = useCallback((roleName: string, path: string): boolean => {
    const config = getConfigForRole(roleName);
    if (!config) return false;
    
    // If accessibleTabs is empty, all paths are blocked
    if (!config.accessibleTabs || config.accessibleTabs.length === 0) {
      return true;
    }
    
    // Path is blocked if it's not in accessible tabs
    return !config.accessibleTabs.includes(path);
  }, [getConfigForRole]);

  const isKitchenDisplayEnabled = useCallback((roleName: string): boolean => {
    const config = getConfigForRole(roleName);
    if (!config) return false; // Default to false if no config
    return config.kitchenDisplayEnabled;
  }, [getConfigForRole]);

  const isMarkAsPaidEnabled = useCallback((roleName: string): boolean => {
    const config = getConfigForRole(roleName);
    if (!config) return false; // Default to false if no config
    return config.markAsPaidEnabled;
  }, [getConfigForRole]);

  // Helper function to get all role names from user
  const getUserRoleNames = useCallback((): string[] => {
    const { user } = useAuthStore.getState();
    if (!user) return [];
    
    const roleNames: string[] = [];
    
    // Add primary role
    if (user.role) {
      const primaryRole = user.role.toLowerCase();
      if (!roleNames.includes(primaryRole)) {
        roleNames.push(primaryRole);
      }
    }
    
    // Add roles from roles array
    if (user.roles && Array.isArray(user.roles)) {
      user.roles.forEach((role: any) => {
        let roleName: string | null = null;
        if (typeof role === 'string') {
          roleName = role;
        } else if (role && typeof role === 'object') {
          // Role object has 'name' property (from Role interface)
          roleName = (role as any).name || (role as any).display_name_en || null;
        }
        if (roleName) {
          const normalizedRoleName = roleName.toLowerCase();
          if (!roleNames.includes(normalizedRoleName)) {
            roleNames.push(normalizedRoleName);
          }
        }
      });
    }
    
    return roleNames;
  }, []);

  // Combined permission checks - checks if ANY role allows access
  const isTabAccessibleForUser = useCallback((path: string): boolean => {
    const roleNames = getUserRoleNames();
    if (roleNames.length === 0) {
      return true; // Default to accessible if no roles
    }
    
    
    // Check ALL roles - if ANY role allows access, return true
    for (const role of roleNames) {
      const isPrivileged = role === 'manager' || role === 'tenant_owner' || role === 'super_admin';
      const config = getConfigForRole(role);
      
      
      if (isPrivileged) {
        // For privileged roles: if no config exists, they have full access
        if (!config) {
          return true;
        }
        // If config exists, check if path is in accessibleTabs
        if (config.accessibleTabs && config.accessibleTabs.length > 0) {
          if (config.accessibleTabs.includes(path)) {
            return true; // This privileged role allows access
          }
          // Path not in accessibleTabs for this role, continue checking other roles
        } else {
          // Empty accessibleTabs means all blocked for this role, but check other roles
          continue;
        }
      } else {
        // For non-privileged roles, use the standard check
        const isAccessible = isTabAccessible(role, path);
        if (isAccessible) {
          return true; // This role allows access
        }
      }
    }
    
    // If we get here, no role allows access
    return false;
  }, [getUserRoleNames, isTabAccessible, getConfigForRole]);

  const isPathBlockedForUser = useCallback((path: string): boolean => {
    // Path is blocked if it's NOT accessible
    return !isTabAccessibleForUser(path);
  }, [isTabAccessibleForUser]);

  const isKitchenDisplayEnabledForUser = useCallback((): boolean => {
    const roleNames = getUserRoleNames();
    if (roleNames.length === 0) return false;
    
    // Check if ANY role enables kitchen display
    return roleNames.some(role => isKitchenDisplayEnabled(role));
  }, [getUserRoleNames, isKitchenDisplayEnabled]);

  const isMarkAsPaidEnabledForUser = useCallback((): boolean => {
    const roleNames = getUserRoleNames();
    if (roleNames.length === 0) return false;
    
    // Check if ANY role enables mark as paid
    return roleNames.some(role => isMarkAsPaidEnabled(role));
  }, [getUserRoleNames, isMarkAsPaidEnabled]);

  const refresh = useCallback(async () => {
    configsCache = null;
    cacheTimestamp = 0;
    await loadConfigs();
  }, [loadConfigs]);

  // Ensure configs is always an array before returning
  const safeConfigs = Array.isArray(configs) ? configs : [];

  return {
    configs: safeConfigs,
    loading,
    getConfigForRole,
    isTabAccessible,
    isPathBlocked,
    isKitchenDisplayEnabled,
    isMarkAsPaidEnabled,
    isTabAccessibleForUser,
    isPathBlockedForUser,
    isKitchenDisplayEnabledForUser,
    isMarkAsPaidEnabledForUser,
    refresh,
  };
}

