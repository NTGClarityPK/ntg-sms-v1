import { useState, useEffect, useCallback, useRef } from 'react';
import { authApi } from '@/lib/api/auth';
import { restaurantApi } from '@/lib/api/restaurant';
import { useLanguageStore } from '@/lib/store/language-store';
import { useAuthStore } from '@/lib/store/auth-store';

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface AssignedBranch {
  id: string;
  name: string;
  code: string;
}

interface Branch {
  id: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  email?: string;
  isActive?: boolean;
}

interface BranchOption {
  value: string;
  label: string;
}

interface CachedBranches {
  assignedBranches: AssignedBranch[];
  allBranches: Branch[];
  branchOptions: BranchOption[];
  timestamp: number;
  language: string;
}

let branchesCache: CachedBranches | null = null;
let fetchPromise: Promise<CachedBranches> | null = null;
let isFetchingRef = false;

export function useBranches() {
  const { user } = useAuthStore();
  const { language } = useLanguageStore();
  const [branches, setBranches] = useState<BranchOption[]>(branchesCache?.branchOptions || []);
  const [assignedBranches, setAssignedBranches] = useState<AssignedBranch[]>(branchesCache?.assignedBranches || []);
  const [allBranches, setAllBranches] = useState<Branch[]>(branchesCache?.allBranches || []);
  const [loading, setLoading] = useState(false);

  const fetchBranches = useCallback(async (lang: string = 'en'): Promise<CachedBranches> => {
    // If already fetching, return the existing promise
    if (isFetchingRef && fetchPromise) {
      return fetchPromise;
    }

    // Check cache first
    if (branchesCache && (Date.now() - branchesCache.timestamp < CACHE_DURATION) && branchesCache.language === lang) {
      setBranches(branchesCache.branchOptions);
      setAssignedBranches(branchesCache.assignedBranches);
      setAllBranches(branchesCache.allBranches);
      return branchesCache;
    }

    isFetchingRef = true;
    fetchPromise = (async () => {
      try {
        setLoading(true);

        // Fetch both in parallel
        const [assignedData, branchesWithLang] = await Promise.all([
          authApi.getAssignedBranches(),
          restaurantApi.getBranches(lang),
        ]);

        // Create a map of branch IDs to translated names
        const branchNameMap = new Map<string, string>();
        branchesWithLang.forEach(b => {
          branchNameMap.set(b.id, b.name);
        });

        // Create branch options from assigned branches
        const branchOptions: BranchOption[] = assignedData.map((b) => ({
          value: b.id,
          label: `${branchNameMap.get(b.id) || b.name} (${b.code})`,
        }));

        // Show "All Branches" option if user has access to multiple branches
        if (branchOptions.length > 1) {
          branchOptions.unshift({
            value: 'all',
            label: lang === 'ar' ? 'جميع الفروع' : lang === 'ku' ? 'هه موو لقه كان' : 'All Branches',
          });
        }

        const cached: CachedBranches = {
          assignedBranches: assignedData,
          allBranches: branchesWithLang,
          branchOptions,
          timestamp: Date.now(),
          language: lang,
        };

        branchesCache = cached;
        setBranches(cached.branchOptions);
        setAssignedBranches(cached.assignedBranches);
        setAllBranches(cached.allBranches);

        return cached;
      } catch (error) {
        console.error('Failed to fetch branches:', error);
        branchesCache = null; // Clear cache on error
        throw error;
      } finally {
        setLoading(false);
        isFetchingRef = false;
        fetchPromise = null;
      }
    })();

    return fetchPromise;
  }, []);

  useEffect(() => {
    if (user?.tenantId) {
      fetchBranches(language);
    }
  }, [user?.tenantId, language, fetchBranches]);

  const refreshBranches = useCallback(async (lang: string = language) => {
    branchesCache = null; // Invalidate cache
    return fetchBranches(lang);
  }, [language, fetchBranches]);

  return {
    branches,
    assignedBranches,
    allBranches,
    loading,
    refreshBranches,
  };
}












