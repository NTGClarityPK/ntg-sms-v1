'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { menuApi, Category, AddOnGroup, VariationGroup, FoodItem } from '@/lib/api/menu';
import { useAuthStore } from '@/lib/store/auth-store';
import { useBranchStore } from '@/lib/store/branch-store';
import { useLanguageStore } from '@/lib/store/language-store';
import { onMenuDataUpdate } from '@/lib/utils/menu-events';

interface MenuDataContextType {
  // Data
  categories: Category[];
  addOnGroups: AddOnGroup[];
  variationGroups: VariationGroup[];
  menus: any[];
  foodItems: FoodItem[];
  
  // Loading states
  loadingCategories: boolean;
  loadingAddOnGroups: boolean;
  loadingVariationGroups: boolean;
  loadingMenus: boolean;
  loadingFoodItems: boolean;
  
  // Refresh functions
  refreshCategories: () => Promise<void>;
  refreshAddOnGroups: () => Promise<void>;
  refreshVariationGroups: () => Promise<void>;
  refreshMenus: () => Promise<void>;
  refreshFoodItems: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

const MenuDataContext = createContext<MenuDataContextType | undefined>(undefined);

export function MenuDataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const { selectedBranchId } = useBranchStore();
  const { language } = useLanguageStore();

  // Data state
  const [categories, setCategories] = useState<Category[]>([]);
  const [addOnGroups, setAddOnGroups] = useState<AddOnGroup[]>([]);
  const [variationGroups, setVariationGroups] = useState<VariationGroup[]>([]);
  const [menus, setMenus] = useState<any[]>([]);
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);

  // Loading states
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingAddOnGroups, setLoadingAddOnGroups] = useState(false);
  const [loadingVariationGroups, setLoadingVariationGroups] = useState(false);
  const [loadingMenus, setLoadingMenus] = useState(false);
  const [loadingFoodItems, setLoadingFoodItems] = useState(false);

  // Refs to prevent duplicate calls
  const loadingCategoriesRef = useRef(false);
  const loadingAddOnGroupsRef = useRef(false);
  const loadingVariationGroupsRef = useRef(false);
  const loadingMenusRef = useRef(false);
  const loadingFoodItemsRef = useRef(false);
  const lastCategoriesLoadRef = useRef<string>('');
  const lastAddOnGroupsLoadRef = useRef<string>('');
  const lastVariationGroupsLoadRef = useRef<string>('');
  const lastMenusLoadRef = useRef<string>('');
  const lastFoodItemsLoadRef = useRef<string>('');
  const foodItemsRequestIdRef = useRef(0);

  // Load categories
  const refreshCategories = useCallback(async () => {
    if (!user?.tenantId || loadingCategoriesRef.current) return;

    const loadKey = `${user?.tenantId}-${selectedBranchId}-${language}`;
    if (lastCategoriesLoadRef.current === loadKey && loadingCategoriesRef.current) {
      return;
    }

    loadingCategoriesRef.current = true;
    lastCategoriesLoadRef.current = loadKey;

    try {
      setLoadingCategories(true);
      const response = await menuApi.getCategories(undefined, selectedBranchId || undefined, language);
      const data = Array.isArray(response) ? response : (response?.data || []);
      setCategories(data);
    } catch (err) {
      console.error('Failed to load categories:', err);
    } finally {
      setLoadingCategories(false);
      loadingCategoriesRef.current = false;
    }
  }, [user?.tenantId, selectedBranchId, language]);

  // Load add-on groups
  const refreshAddOnGroups = useCallback(async () => {
    if (!user?.tenantId || loadingAddOnGroupsRef.current) return;

    const loadKey = `${user?.tenantId}-${selectedBranchId}-${language}`;
    if (lastAddOnGroupsLoadRef.current === loadKey && loadingAddOnGroupsRef.current) {
      return;
    }

    loadingAddOnGroupsRef.current = true;
    lastAddOnGroupsLoadRef.current = loadKey;

    try {
      setLoadingAddOnGroups(true);
      const response = await menuApi.getAddOnGroups(undefined, selectedBranchId || undefined, language);
      const data = Array.isArray(response) ? response : (response?.data || []);
      setAddOnGroups(data);
    } catch (err) {
      console.error('Failed to load add-on groups:', err);
    } finally {
      setLoadingAddOnGroups(false);
      loadingAddOnGroupsRef.current = false;
    }
  }, [user?.tenantId, selectedBranchId, language]);

  // Load variation groups
  const refreshVariationGroups = useCallback(async () => {
    if (!user?.tenantId || loadingVariationGroupsRef.current) return;

    const loadKey = `${user?.tenantId}-${selectedBranchId}-${language}`;
    if (lastVariationGroupsLoadRef.current === loadKey && loadingVariationGroupsRef.current) {
      return;
    }

    loadingVariationGroupsRef.current = true;
    lastVariationGroupsLoadRef.current = loadKey;

    try {
      setLoadingVariationGroups(true);
      const response = await menuApi.getVariationGroups(undefined, selectedBranchId || undefined, language);
      const data = Array.isArray(response) ? response : (response?.data || []);
      setVariationGroups(data);
    } catch (err) {
      console.error('Failed to load variation groups:', err);
    } finally {
      setLoadingVariationGroups(false);
      loadingVariationGroupsRef.current = false;
    }
  }, [user?.tenantId, selectedBranchId, language]);

  // Load menus
  const refreshMenus = useCallback(async () => {
    if (!user?.tenantId || loadingMenusRef.current) return;

    const loadKey = `${user?.tenantId}-${selectedBranchId}-${language}`;
    if (lastMenusLoadRef.current === loadKey && loadingMenusRef.current) {
      return;
    }

    loadingMenusRef.current = true;
    lastMenusLoadRef.current = loadKey;

    try {
      setLoadingMenus(true);
      const response = await menuApi.getMenus(undefined, selectedBranchId || undefined, language);
      const data = Array.isArray(response) ? response : (response?.data || []);
      setMenus(data);
    } catch (err) {
      console.error('Failed to load menus:', err);
    } finally {
      setLoadingMenus(false);
      loadingMenusRef.current = false;
    }
  }, [user?.tenantId, selectedBranchId, language]);

  // Load food items (all pages)
  const refreshFoodItems = useCallback(async () => {
    if (!user?.tenantId) return;

    const loadKey = `${user?.tenantId}-${selectedBranchId}-${language}`;
    
    // Skip if already loading with same parameters
    if (loadingFoodItemsRef.current && lastFoodItemsLoadRef.current === loadKey) {
      return;
    }

    // Mark as loading and track this request
    loadingFoodItemsRef.current = true;
    lastFoodItemsLoadRef.current = loadKey;
    const currentRequestId = ++foodItemsRequestIdRef.current;

    try {
      setLoadingFoodItems(true);
      let allFoodItems: FoodItem[] = [];
      let page = 1;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        // Only continue if this is still the latest request
        if (currentRequestId !== foodItemsRequestIdRef.current) {
          return;
        }
        
        const response = await menuApi.getFoodItems(
          undefined,
          { page, limit },
          undefined,
          false,
          selectedBranchId || undefined,
          language
        );
        
        // Only continue if this is still the latest request
        if (currentRequestId !== foodItemsRequestIdRef.current) {
          return;
        }
        
        const items = Array.isArray(response) ? response : (response?.data || []);
        allFoodItems = [...allFoodItems, ...items];
        
        if (Array.isArray(response)) {
          hasMore = false;
        } else if (response?.pagination) {
          hasMore = response.pagination.hasNext;
          page++;
        } else {
          hasMore = false;
        }
      }

      // Only update state if this is still the latest request
      if (currentRequestId === foodItemsRequestIdRef.current) {
        setFoodItems(allFoodItems);
      }
    } catch (err) {
      // Only log error if this is still the latest request
      if (currentRequestId === foodItemsRequestIdRef.current) {
        console.error('Failed to load food items:', err);
      }
    } finally {
      // Only clear loading if this is still the latest request
      if (currentRequestId === foodItemsRequestIdRef.current) {
        setLoadingFoodItems(false);
        loadingFoodItemsRef.current = false;
      }
    }
  }, [user?.tenantId, selectedBranchId, language]);

  // Refresh all data
  const refreshAll = useCallback(async () => {
    await Promise.all([
      refreshCategories(),
      refreshAddOnGroups(),
      refreshVariationGroups(),
      refreshMenus(),
      refreshFoodItems(),
    ]);
  }, [refreshCategories, refreshAddOnGroups, refreshVariationGroups, refreshMenus, refreshFoodItems]);

  // Initial load - use refs to prevent duplicate calls
  const initialLoadRef = useRef(false);
  const lastInitialLoadRef = useRef<string>('');
  
  useEffect(() => {
    if (!user?.tenantId) return;
    
    const loadKey = `${user?.tenantId}-${selectedBranchId}-${language}`;
    
    // Skip if already loaded with same parameters
    if (initialLoadRef.current && lastInitialLoadRef.current === loadKey) {
      return;
    }
    
    initialLoadRef.current = true;
    lastInitialLoadRef.current = loadKey;
    refreshAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.tenantId, selectedBranchId, language]);

  // Listen for data updates
  useEffect(() => {
    const unsubscribe1 = onMenuDataUpdate('categories-updated', () => {
      refreshCategories();
    });
    const unsubscribe2 = onMenuDataUpdate('add-on-groups-updated', () => {
      refreshAddOnGroups();
    });
    const unsubscribe3 = onMenuDataUpdate('variation-groups-updated', () => {
      refreshVariationGroups();
    });
    const unsubscribe4 = onMenuDataUpdate('menus-updated', () => {
      refreshMenus();
    });
    const unsubscribe5 = onMenuDataUpdate('food-items-updated', () => {
      refreshFoodItems();
    });

    return () => {
      unsubscribe1();
      unsubscribe2();
      unsubscribe3();
      unsubscribe4();
      unsubscribe5();
    };
  }, [refreshCategories, refreshAddOnGroups, refreshVariationGroups, refreshMenus, refreshFoodItems]);

  const value: MenuDataContextType = {
    categories,
    addOnGroups,
    variationGroups,
    menus,
    foodItems,
    loadingCategories,
    loadingAddOnGroups,
    loadingVariationGroups,
    loadingMenus,
    loadingFoodItems,
    refreshCategories,
    refreshAddOnGroups,
    refreshVariationGroups,
    refreshMenus,
    refreshFoodItems,
    refreshAll,
  };

  return <MenuDataContext.Provider value={value}>{children}</MenuDataContext.Provider>;
}

export function useMenuData() {
  const context = useContext(MenuDataContext);
  if (context === undefined) {
    throw new Error('useMenuData must be used within a MenuDataProvider');
  }
  return context;
}

