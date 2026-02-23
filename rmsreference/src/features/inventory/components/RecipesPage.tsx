'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useForm } from '@mantine/form';
import {
  Title,
  Button,
  Stack,
  Modal,
  TextInput,
  Select,
  NumberInput,
  Table,
  Group,
  ActionIcon,
  Text,
  Paper,
  Skeleton,
  Alert,
  Grid,
  Badge,
} from '@mantine/core';
import {
  IconPlus,
  IconTrash,
  IconAlertCircle,
  IconSearch,
  IconLink,
} from '@tabler/icons-react';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  inventoryApi,
  Ingredient,
  Recipe,
  CreateRecipeDto,
} from '@/lib/api/inventory';
import { menuApi, FoodItem } from '@/lib/api/menu';
import { useLanguageStore } from '@/lib/store/language-store';
import { useAuthStore } from '@/lib/store/auth-store';
import { useBranchStore } from '@/lib/store/branch-store';
import { t } from '@/lib/utils/translations';
import { useNotificationColors, useErrorColor, useSuccessColor } from '@/lib/hooks/use-theme-colors';
import { useThemeColor } from '@/lib/hooks/use-theme-color';
import { getBadgeColorForText } from '@/lib/utils/theme';
import { useInventoryRefresh } from '@/lib/contexts/inventory-refresh-context';
import { isPaginatedResponse } from '@/lib/types/pagination.types';
import { usePagination } from '@/lib/hooks/use-pagination';
import { PaginationControls } from '@/components/common/PaginationControls';
import { DEFAULT_PAGINATION } from '@/shared/constants/app.constants';

interface RecipeIngredient {
  ingredientId: string;
  quantity: number;
  unit: string;
}

export function RecipesPage() {
  const { language } = useLanguageStore();
  const { user } = useAuthStore();
  const { selectedBranchId } = useBranchStore();
  const { refreshKey, triggerRefresh } = useInventoryRefresh();
  const notificationColors = useNotificationColors();
  const errorColor = useErrorColor();
  const successColor = useSuccessColor();
  const primaryColor = useThemeColor();
  const foodItemsPagination = usePagination<FoodItem>({ 
    initialPage: DEFAULT_PAGINATION.page, 
    initialLimit: DEFAULT_PAGINATION.limit 
  });
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [allFoodItems, setAllFoodItems] = useState<FoodItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [opened, setOpened] = useState(false);
  const [selectedFoodItem, setSelectedFoodItem] = useState<FoodItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Loading guards to prevent duplicate API calls
  const loadingFoodItemsRef = useRef(false);
  const loadingAllFoodItemsRef = useRef(false);
  const loadingIngredientsRef = useRef(false);
  const loadingRecipesRef = useRef(false);
  const foodItemsRequestIdRef = useRef(0);
  const ingredientsRequestIdRef = useRef(0);
  // Track completion state separately
  const foodItemsLoadedRef = useRef(false);
  const ingredientsLoadedRef = useRef(false);
  const recipesLoadedRef = useRef(false);

  const form = useForm({
    initialValues: {
      foodItemId: '',
      ingredients: [] as RecipeIngredient[],
    },
  });

  // Helper to update loading state based on food items, ingredients, and recipes
  const updateLoadingState = useCallback(() => {
    // Only set loading to false when ALL three (food items, ingredients, and recipes) have finished loading
    if (!loadingFoodItemsRef.current && !loadingIngredientsRef.current && !loadingRecipesRef.current) {
      // All are done loading, but check if they've actually loaded
      if (foodItemsLoadedRef.current && ingredientsLoadedRef.current && recipesLoadedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const loadFoodItems = useCallback(async () => {
    if (!user?.tenantId) {
      // Reset loading state if user is not available
      loadingFoodItemsRef.current = false;
      foodItemsLoadedRef.current = true;
      return;
    }

    const loadKey = `${user?.tenantId}-${foodItemsPagination.page}-${foodItemsPagination.limit}-${selectedBranchId}-${language}`;
    
    // Double-check: skip if already loading with same parameters
    // This is a safety check in case the function is called directly
    if (loadingFoodItemsRef.current && lastFoodItemsLoadRef.current === loadKey) {
      return; // Already loading with same params
    }

    // Mark as loading and track this request immediately
    // Note: loadingFoodItemsRef is already set in useEffect, but we ensure it's set here too
    loadingFoodItemsRef.current = true;
    foodItemsLoadedRef.current = false;
    lastFoodItemsLoadRef.current = loadKey;
    const currentRequestId = ++foodItemsRequestIdRef.current;
    
    try {
      const serverFoodItemsResponse = await menuApi.getFoodItems(undefined, foodItemsPagination.paginationParams, undefined, false, selectedBranchId || undefined, language);
      
      // Only update state if this is still the latest request
      if (currentRequestId === foodItemsRequestIdRef.current) {
        const serverFoodItems = foodItemsPagination.extractData(serverFoodItemsResponse);
        foodItemsPagination.extractPagination(serverFoodItemsResponse);
        setFoodItems(serverFoodItems);
        foodItemsLoadedRef.current = true;
        
        // Update loading state - will only set to false if ingredients are also done
        updateLoadingState();
      }
    } catch (err: any) {
      // Only set error if this is still the latest request
      if (currentRequestId === foodItemsRequestIdRef.current) {
        console.error('Failed to load food items:', err);
        foodItemsLoadedRef.current = true; // Mark as loaded even on error to prevent infinite loading
        updateLoadingState();
      }
    } finally {
      // Only clear loading if this is still the latest request
      if (currentRequestId === foodItemsRequestIdRef.current) {
        loadingFoodItemsRef.current = false;
        updateLoadingState();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.tenantId, foodItemsPagination.paginationParams, foodItemsPagination.extractData, foodItemsPagination.extractPagination, selectedBranchId, language, updateLoadingState]);

  const loadAllFoodItems = useCallback(async () => {
    if (!user?.tenantId || loadingAllFoodItemsRef.current) return;

    try {
      loadingAllFoodItemsRef.current = true;
      const allFoodItems: FoodItem[] = [];
      let page = 1;
      const limit = 100; // Fetch in larger batches
      let hasMore = true;

      // Fetch all pages sequentially
      while (hasMore) {
        const response = await menuApi.getFoodItems(undefined, { page, limit }, undefined, false, selectedBranchId || undefined, language);
        
        if (isPaginatedResponse(response)) {
          allFoodItems.push(...response.data);
          hasMore = response.pagination.hasNext;
          page++;
        } else {
          // Non-paginated response - treat as single page
          allFoodItems.push(...(Array.isArray(response) ? response : []));
          hasMore = false;
        }
      }

      setAllFoodItems(allFoodItems);
    } catch (err: any) {
      console.error('Failed to load all food items:', err);
    } finally {
      loadingAllFoodItemsRef.current = false;
    }
  }, [user?.tenantId, selectedBranchId, language]);

  const loadIngredients = useCallback(async () => {
    if (!user?.tenantId) {
      // Reset loading state if user is not available
      loadingIngredientsRef.current = false;
      ingredientsLoadedRef.current = true;
      return;
    }

    const loadKey = `${user?.tenantId}-${selectedBranchId}-${language}-${refreshKey}`;
    
    // Double-check: skip if already loading with same parameters
    // This is a safety check in case the function is called directly
    if (loadingIngredientsRef.current && lastIngredientsLoadRef.current === loadKey) {
      return; // Already loading with same params
    }

    // Mark as loading and track this request immediately
    // Note: loadingIngredientsRef is already set in useEffect, but we ensure it's set here too
    loadingIngredientsRef.current = true;
    ingredientsLoadedRef.current = false;
    lastIngredientsLoadRef.current = loadKey;
    const currentRequestId = ++ingredientsRequestIdRef.current;

    try {
      const allServerIngredients: Ingredient[] = [];
      let page = 1;
      const limit = 100; // Fetch in larger batches
      let hasMore = true;

      // Fetch all pages sequentially
      while (hasMore) {
        const response = await inventoryApi.getIngredients({ isActive: true }, { page, limit }, selectedBranchId || undefined, language);
        
        // Only continue if this is still the latest request
        if (currentRequestId !== ingredientsRequestIdRef.current) {
          return;
        }
        
        if (isPaginatedResponse(response)) {
          allServerIngredients.push(...response.data);
          hasMore = response.pagination.hasNext;
          page++;
        } else {
          // Non-paginated response - treat as single page
          allServerIngredients.push(...(Array.isArray(response) ? response : []));
          hasMore = false;
        }
      }
      
      // Only update state if this is still the latest request
      if (currentRequestId === ingredientsRequestIdRef.current) {
        // Deduplicate server ingredients
        const serverById = new Map(allServerIngredients.map((ing: Ingredient) => [ing.id, ing]));
        const serverByName = new Map<string, Ingredient>();
        
        for (const ing of Array.from(serverById.values())) {
          const key = ing.name?.toLowerCase().trim() || '';
          if (key) {
            const existing = serverByName.get(key);
            if (!existing || new Date(ing.updatedAt) > new Date(existing.updatedAt)) {
              serverByName.set(key, ing);
            }
          }
        }
        
        const uniqueServerIngredients = serverByName.size < serverById.size 
          ? Array.from(serverByName.values())
          : Array.from(serverById.values());
        
        setIngredients(uniqueServerIngredients);
        ingredientsLoadedRef.current = true;
        
        // Update loading state - will only set to false if food items are also done
        updateLoadingState();
      }
    } catch (err: any) {
      // Only set error if this is still the latest request
      if (currentRequestId === ingredientsRequestIdRef.current) {
        console.error('Failed to load ingredients:', err);
        ingredientsLoadedRef.current = true; // Mark as loaded even on error to prevent infinite loading
        updateLoadingState();
      }
    } finally {
      // Only clear loading if this is still the latest request
      if (currentRequestId === ingredientsRequestIdRef.current) {
        loadingIngredientsRef.current = false;
        updateLoadingState();
      }
    }
  }, [user?.tenantId, selectedBranchId, language, refreshKey, updateLoadingState]);

  const loadRecipes = useCallback(async () => {
    if (!user?.tenantId) {
      // Reset loading state if user is not available
      loadingRecipesRef.current = false;
      recipesLoadedRef.current = true;
      return;
    }

    const loadKey = `${user?.tenantId}-${selectedBranchId}-${refreshKey}`;
    
    // Double-check: skip if already loading with same parameters
    // This is a safety check in case the function is called directly
    if (loadingRecipesRef.current && lastRecipesLoadRef.current === loadKey) {
      return; // Already loading with same params
    }

    // Mark as loading and track this request immediately
    // Note: loadingRecipesRef is already set in useEffect, but we ensure it's set here too
    loadingRecipesRef.current = true;
    recipesLoadedRef.current = false;
    lastRecipesLoadRef.current = loadKey;

    try {
      const serverRecipesResponse = await inventoryApi.getRecipes(undefined, undefined, undefined, selectedBranchId || undefined);
      const serverRecipes = Array.isArray(serverRecipesResponse) 
        ? serverRecipesResponse 
        : (serverRecipesResponse?.data || []);
      setRecipes(serverRecipes);
      recipesLoadedRef.current = true;
      
      // Update loading state - will only set to false if food items and ingredients are also done
      updateLoadingState();
    } catch (err: any) {
      console.error('Failed to load recipes:', err);
      recipesLoadedRef.current = true; // Mark as loaded even on error to prevent infinite loading
      updateLoadingState();
    } finally {
      loadingRecipesRef.current = false;
      updateLoadingState();
    }
  }, [user?.tenantId, selectedBranchId, refreshKey, updateLoadingState]);

  // Track load parameters separately for each resource
  const lastFoodItemsLoadRef = useRef<string>('');
  const lastIngredientsLoadRef = useRef<string>('');
  const lastRecipesLoadRef = useRef<string>('');


  // Load food items (depends on pagination)
  useEffect(() => {
    if (!user?.tenantId) {
      setLoading(false);
      foodItemsLoadedRef.current = true;
      ingredientsLoadedRef.current = true;
      recipesLoadedRef.current = true;
      return;
    }
    
    const loadParams = `${foodItemsPagination.page}-${foodItemsPagination.limit}-${refreshKey}-${selectedBranchId}-${language}`;
    
    // Atomic check: skip if already loaded/loading with same parameters OR currently loading
    // This prevents race conditions in React StrictMode
    if (lastFoodItemsLoadRef.current === loadParams || loadingFoodItemsRef.current) {
      return;
    }
    
    // Set refs immediately and atomically to prevent duplicate calls
    lastFoodItemsLoadRef.current = loadParams;
    loadingFoodItemsRef.current = true;
    foodItemsLoadedRef.current = false;
    setLoading(true);
    
    // Call the load function
    loadFoodItems();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foodItemsPagination.page, foodItemsPagination.limit, refreshKey, selectedBranchId, language, user?.tenantId, loadFoodItems]);

  // Load ingredients (independent of food items pagination)
  useEffect(() => {
    if (!user?.tenantId) {
      setLoading(false);
      foodItemsLoadedRef.current = true;
      ingredientsLoadedRef.current = true;
      recipesLoadedRef.current = true;
      return;
    }
    
    const loadParams = `${refreshKey}-${selectedBranchId}-${language}`;
    
    // Atomic check: skip if already loaded/loading with same parameters OR currently loading
    // This prevents race conditions in React StrictMode
    if (lastIngredientsLoadRef.current === loadParams || loadingIngredientsRef.current) {
      return;
    }
    
    // Set refs immediately and atomically to prevent duplicate calls
    lastIngredientsLoadRef.current = loadParams;
    loadingIngredientsRef.current = true;
    ingredientsLoadedRef.current = false;
    setLoading(true);
    
    // Call the load function
    loadIngredients();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, selectedBranchId, language, user?.tenantId, loadIngredients]);

  // Load recipes (loads along with food items and ingredients)
  useEffect(() => {
    if (!user?.tenantId) {
      recipesLoadedRef.current = true;
      return;
    }
    
    const loadParams = `${refreshKey}-${selectedBranchId}`;
    
    // Atomic check: skip if already loaded/loading with same parameters OR currently loading
    // This prevents race conditions in React StrictMode
    if (lastRecipesLoadRef.current === loadParams || loadingRecipesRef.current) {
      return;
    }
    
    // Set refs immediately and atomically to prevent duplicate calls
    lastRecipesLoadRef.current = loadParams;
    loadingRecipesRef.current = true;
    recipesLoadedRef.current = false;
    setLoading(true);
    
    // Call the load function
    loadRecipes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, selectedBranchId, user?.tenantId, loadRecipes]);


  // Helper function to translate unit of measurement
  const getTranslatedUnit = useCallback((unit: string | undefined | null): string => {
    if (!unit) return '';
    
    // Try exact match first
    let translated = t(`inventory.${unit}` as any, language);
    // Check if translation was found (not the key itself)
    if (translated && translated !== `inventory.${unit}`) {
      // Check if it's a non-ASCII translation (Arabic, Kurdish) or different from original
      const hasNonAscii = /[^\x00-\x7F]/.test(translated);
      if (hasNonAscii || translated.toLowerCase() !== unit.toLowerCase()) {
        return translated;
      }
    }
    
    // Try uppercase version
    const upperUnit = unit.toUpperCase();
    if (upperUnit !== unit) {
      translated = t(`inventory.${upperUnit}` as any, language);
      if (translated && translated !== `inventory.${upperUnit}`) {
        const hasNonAscii = /[^\x00-\x7F]/.test(translated);
        if (hasNonAscii || translated.toLowerCase() !== upperUnit.toLowerCase()) {
          return translated;
        }
      }
    }
    
    // Try lowercase version
    const lowerUnit = unit.toLowerCase();
    if (lowerUnit !== unit && lowerUnit !== upperUnit) {
      translated = t(`inventory.${lowerUnit}` as any, language);
      if (translated && translated !== `inventory.${lowerUnit}`) {
        const hasNonAscii = /[^\x00-\x7F]/.test(translated);
        if (hasNonAscii || translated.toLowerCase() !== lowerUnit.toLowerCase()) {
          return translated;
        }
      }
    }
    
    // If no translation found, return original
    return unit;
  }, [language]);

  // Helper function to get deduplicated ingredient options for Select dropdowns
  // Excludes already selected ingredients (except the one at currentIndex)
  const getIngredientOptions = useCallback((currentIndex?: number) => {
    // Deduplicate by ID first
    const byId = new Map(ingredients.map(ing => [ing.id, ing]));
    const uniqueIngredients = Array.from(byId.values());
    
    // Get currently selected ingredient IDs (excluding the current index)
    const selectedIngredientIds = new Set(
      form.values.ingredients
        .map((ing, idx) => idx !== currentIndex && ing.ingredientId ? ing.ingredientId : null)
        .filter((id): id is string => id !== null)
    );
    
    return uniqueIngredients
      .filter((ing) => ing.name && !selectedIngredientIds.has(ing.id))
      .map((ing) => ({
        value: ing.id,
        label: ing.unitOfMeasurement 
          ? `${ing.name || ''} (${getTranslatedUnit(ing.unitOfMeasurement)})`
          : ing.name || '',
      }));
  }, [ingredients, getTranslatedUnit, form.values.ingredients]);

  const handleOpenModal = (foodItem?: FoodItem) => {
    // Open modal immediately
    if (foodItem) {
      setSelectedFoodItem(foodItem);
      
      // Load existing recipe for this food item
      const existingRecipe = recipes.filter((r) => r.foodItemId === foodItem.id);
      
      form.setValues({
        foodItemId: foodItem.id,
        ingredients: existingRecipe.map((r) => {
          // Use the ingredient's current unitOfMeasurement instead of stored unit
          const ingredient = ingredients.find((ing) => ing.id === r.ingredientId);
          return {
            ingredientId: r.ingredientId,
            quantity: r.quantity,
            unit: ingredient?.unitOfMeasurement || r.unit,
          };
        }),
      });
    } else {
      setSelectedFoodItem(null);
      form.reset();
    }
    setOpened(true);
    
    // Load all food items for dropdown if not already loaded or loading
    // Only load if we don't have data yet or if it's been a while
    if (allFoodItems.length === 0 && !loadingAllFoodItemsRef.current) {
      loadAllFoodItems().catch((err) => {
        console.warn('Failed to refresh food items:', err);
      });
    }
  };

  const handleCloseModal = () => {
    if (submitting) return;
    setOpened(false);
    setSelectedFoodItem(null);
    form.reset();
    setSubmitting(false);
  };

  const handleAddIngredient = () => {
    form.insertListItem('ingredients', {
      ingredientId: '',
      quantity: 0,
      unit: '',
    });
  };

  const handleIngredientChange = (index: number, ingredientId: string) => {
    // Check if this ingredient is already selected in another row
    const isDuplicate = form.values.ingredients.some(
      (ing, idx) => idx !== index && ing.ingredientId === ingredientId
    );
    
    if (isDuplicate) {
      notifications.show({
        title: t('common.error' as any, language) || 'Error',
        message: t('inventory.ingredientAlreadySelected' as any, language) || 'This ingredient is already selected. Please use the quantity field to adjust the amount.',
        color: errorColor,
      });
      return; // Don't update if duplicate
    }
    
    const ingredient = ingredients.find((ing) => ing.id === ingredientId);
    if (ingredient) {
      form.setFieldValue(`ingredients.${index}.unit`, ingredient.unitOfMeasurement);
    }
    form.setFieldValue(`ingredients.${index}.ingredientId`, ingredientId);
  };

  const handleRemoveIngredient = (index: number) => {
    form.removeListItem('ingredients', index);
  };

  const handleSubmit = async (values: typeof form.values) => {
    if (!user?.tenantId) return;

    try {
      setSubmitting(true);
      setError(null);

      if (values.ingredients.length === 0) {
        throw new Error('At least one ingredient is required');
      }

      // Validate that all ingredients have ingredientId
      const invalidIngredients = values.ingredients.filter(ing => !ing.ingredientId);
      if (invalidIngredients.length > 0) {
        throw new Error('Please select an ingredient for all entries');
      }

      // Deduplicate ingredients by merging quantities of the same ingredient
      const ingredientMap = new Map<string, { ingredientId: string; quantity: number; unit: string }>();
      
      for (const ing of values.ingredients) {
        if (!ing.ingredientId) continue; // Skip invalid entries
        
        const existing = ingredientMap.get(ing.ingredientId);
        if (existing) {
          // Merge: add quantities together
          existing.quantity += ing.quantity;
        } else {
          // First occurrence: add to map
          ingredientMap.set(ing.ingredientId, {
            ingredientId: ing.ingredientId,
            quantity: ing.quantity,
            unit: ing.unit,
          });
        }
      }

      // Convert map back to array
      const deduplicatedIngredients = Array.from(ingredientMap.values());

      const recipeData: CreateRecipeDto = {
        foodItemId: values.foodItemId,
        ingredients: deduplicatedIngredients,
      };

      await inventoryApi.createOrUpdateRecipe(recipeData, selectedBranchId || undefined);

      notifications.show({
        title: t('common.success' as any, language) || 'Success',
        message: selectedFoodItem
          ? t('inventory.recipeUpdated', language)
          : t('inventory.recipeCreated', language),
        color: successColor,
      });

      handleCloseModal();
      loadRecipes();
      triggerRefresh(); // Trigger refresh for all tabs
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || t('inventory.recipeError', language);
      setError(errorMsg);
      notifications.show({
        title: t('common.error' as any, language) || 'Error',
        message: errorMsg,
        color: errorColor,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (foodItem: FoodItem) => {
    modals.openConfirmModal({
      title: t('common.delete' as any, language) || 'Delete',
      children: (
        <Text size="sm">
          {t('inventory.deleteRecipe', language) || 'Delete recipe'} for {foodItem.name}?
        </Text>
      ),
      labels: { confirm: t('common.delete' as any, language) || 'Delete', cancel: t('common.cancel' as any, language) || 'Cancel' },
      confirmProps: { color: errorColor },
      onConfirm: async () => {
        try {
          await inventoryApi.deleteRecipe(foodItem.id);

          notifications.show({
            title: t('common.success' as any, language) || 'Success',
            message: t('inventory.recipeDeleted', language),
            color: successColor,
          });

          loadRecipes();
          triggerRefresh(); // Trigger refresh for all tabs
        } catch (err: any) {
          notifications.show({
            title: t('common.error' as any, language) || 'Error',
            message: err.message || t('inventory.recipeError', language),
            color: errorColor,
          });
        }
      },
    });
  };

  // Filter food items
  const filteredFoodItems = foodItems.filter((item) => {
    const matchesSearch =
      item.name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Get recipes for a food item
  const getRecipesForFoodItem = (foodItemId: string) => {
    return recipes.filter((r) => r.foodItemId === foodItemId);
  };

  // Calculate total cost for a recipe
  const calculateRecipeCost = (foodItemId: string) => {
    const itemRecipes = getRecipesForFoodItem(foodItemId);
    return itemRecipes.reduce((total, rec) => {
      const ingredient = ingredients.find((ing) => ing.id === rec.ingredientId);
      if (ingredient) {
        return total + rec.quantity * ingredient.costPerUnit;
      }
      return total;
    }, 0);
  };

  return (
    <Stack gap="md">
      <Group justify="flex-end">
        <Button
          leftSection={<IconLink size={16} />}
          onClick={() => handleOpenModal()}
          style={{ backgroundColor: primaryColor }}
        >
          {t('inventory.linkIngredients', language)}
        </Button>
      </Group>

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color={errorColor} mb="md">
          {error}
        </Alert>
      )}

      {/* Search */}
      <Paper p="md" withBorder mb="md">
        <TextInput
          placeholder={(t('common.search' as any, language) || 'Search') + ' ' + (t('inventory.foodItem', language) || 'food items')}
          leftSection={<IconSearch size={16} />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.currentTarget.value)}
        />
      </Paper>

      {loading ? (
        <Stack gap="md">
          {[1, 2, 3, 4, 5].map((i) => (
            <Paper key={i} p="md" withBorder>
              <Skeleton height={20} width="100%" mb="xs" />
              <Skeleton height={16} width="60%" />
            </Paper>
          ))}
        </Stack>
      ) : filteredFoodItems.length === 0 ? (
        <Paper p="xl" withBorder>
          <Text ta="center" c="dimmed">
            {t('menu.noFoodItems', language)}
          </Text>
        </Paper>
      ) : (
        <>
          <Table.ScrollContainer minWidth={800}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('inventory.foodItem', language)}</Table.Th>
                  <Table.Th>{t('inventory.ingredients', language)}</Table.Th>
                  <Table.Th>{t('inventory.recipeCost', language) || 'Recipe Cost'}</Table.Th>
                  <Table.Th>{t('common.actions' as any, language) || 'Actions'}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredFoodItems.map((item) => {
                  const itemRecipes = getRecipesForFoodItem(item.id);
                  const recipeCost = calculateRecipeCost(item.id);
                  return (
                    <Table.Tr key={item.id}>
                      <Table.Td>
                        <Text fw={500}>
                          {item.name}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        {itemRecipes.length > 0 ? (
                          <Stack gap="xs">
                            {itemRecipes.map((rec) => {
                              const ingredient = ingredients.find((ing) => ing.id === rec.ingredientId);
                              return (
                                <Group key={rec.id} gap="xs">
                                  <Text size="sm">
                                    {ingredient
                                      ? ingredient.name
                                      : 'Unknown'}
                                  </Text>
                                  <Badge variant="light" color={getBadgeColorForText(`${rec.quantity} ${getTranslatedUnit(rec.unit)}`)} size="sm">
                                    {rec.quantity} {getTranslatedUnit(rec.unit)}
                                  </Badge>
                                </Group>
                              );
                            })}
                          </Stack>
                        ) : (
                          <Text size="sm" c="dimmed">
                            {t('inventory.noRecipe', language)}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {recipeCost > 0 ? (
                          <Text fw={500}>{recipeCost.toFixed(2)}</Text>
                        ) : (
                          <Text size="sm" c="dimmed">-</Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <ActionIcon
                            variant="light"
                            color={primaryColor}
                            onClick={() => handleOpenModal(item)}
                          >
                            <IconPlus size={16} />
                          </ActionIcon>
                          {itemRecipes.length > 0 && (
                            <ActionIcon
                              variant="light"
                              color={errorColor}
                              onClick={() => handleDelete(item)}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          )}
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
          
          {/* Pagination Controls */}
          {foodItemsPagination.total > 0 && (
            <PaginationControls
              page={foodItemsPagination.page}
              totalPages={foodItemsPagination.totalPages}
              limit={foodItemsPagination.limit}
              total={foodItemsPagination.total}
              onPageChange={(page) => {
                foodItemsPagination.setPage(page);
              }}
              onLimitChange={(newLimit) => {
                foodItemsPagination.setLimit(newLimit);
                foodItemsPagination.setPage(1);
              }}
            />
          )}
        </>
      )}

      {/* Create/Edit Recipe Modal */}
      <Modal
        opened={opened}
        onClose={handleCloseModal}
        closeOnClickOutside={!submitting}
        closeOnEscape={!submitting}
        withCloseButton={!submitting}
        title={
          selectedFoodItem
            ? `${t('inventory.linkIngredients', language)} - ${selectedFoodItem.name}`
            : t('inventory.linkIngredients', language)
        }
        size="lg"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            {!selectedFoodItem && (
              <Select
                label={t('inventory.foodItem', language)}
                placeholder={t('inventory.selectFoodItem', language)}
                required
                data={allFoodItems
                  .filter((item) => item.name)
                  .map((item) => ({
                    value: item.id,
                    label: item.name || '',
                  }))}
                searchable
                {...form.getInputProps('foodItemId')}
              />
            )}
            {selectedFoodItem && (
              <Text size="sm" c="dimmed">
                {t('inventory.foodItem', language)}: {selectedFoodItem.name}
              </Text>
            )}

            <Group justify="space-between" align="center">
              <Text fw={500}>{t('inventory.ingredients', language)}</Text>
              <Button
                size="xs"
                leftSection={<IconPlus size={14} />}
                onClick={handleAddIngredient}
                variant="light"
                style={{ backgroundColor: `${primaryColor}20` }}
              >
                {t('common.add' as any, language) || 'Add'}
              </Button>
            </Group>

            {form.values.ingredients.length === 0 ? (
              <Paper p="md" withBorder>
                <Text ta="center" c="dimmed" size="sm">
                  {t('inventory.noIngredients', language)}. {(t('common.add' as any, language) || 'Add')} {t('inventory.ingredients', language).toLowerCase()} {t('inventory.toCreateARecipe', language)}.
                </Text>
              </Paper>
            ) : (
              <Stack gap="md">
                {form.values.ingredients.map((ingredient, index) => (
                  <Paper key={index} p="md" withBorder>
                    <Grid>
                      <Grid.Col span={7}>
                        <Select
                          key={`ingredient-select-${index}-${language}-${form.values.ingredients.map(ing => ing.ingredientId).join('-')}`}
                          label={t('inventory.ingredient', language)}
                          placeholder={t('inventory.selectIngredient', language)}
                          required
                          data={getIngredientOptions(index)}
                          searchable
                          value={form.values.ingredients[index].ingredientId}
                          onChange={(value) => {
                            if (value) {
                              handleIngredientChange(index, value);
                            }
                          }}
                        />
                      </Grid.Col>
                      <Grid.Col span={4}>
                        <NumberInput
                          label={t('inventory.quantity', language)}
                          required
                          min={0.001}
                          decimalScale={3}
                          {...form.getInputProps(`ingredients.${index}.quantity`)}
                        />
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <ActionIcon
                          color={errorColor}
                          variant="light"
                          onClick={() => handleRemoveIngredient(index)}
                          mt="xl"
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Grid.Col>
                    </Grid>
                  </Paper>
                ))}
              </Stack>
            )}

            <Group justify="flex-end" mt="md">
              <Button variant="subtle" onClick={handleCloseModal} disabled={submitting}>
                {t('common.cancel' as any, language) || 'Cancel'}
              </Button>
              <Button type="submit" style={{ backgroundColor: primaryColor }} loading={submitting}>
                {t('common.save' as any, language) || 'Save'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}

