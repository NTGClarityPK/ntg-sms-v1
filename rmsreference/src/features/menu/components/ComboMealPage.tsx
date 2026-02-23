'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useForm } from '@mantine/form';
import {
  Container,
  Title,
  Button,
  Stack,
  Modal,
  TextInput,
  NumberInput,
  Group,
  ActionIcon,
  Badge,
  Text,
  Paper,
  Skeleton,
  Alert,
  Grid,
  FileButton,
  Image,
  Box,
  MultiSelect,
  Table,
  Textarea,
  Card,
} from '@mantine/core';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconUpload,
  IconToolsKitchen2,
  IconAlertCircle,
  IconFileSpreadsheet,
  IconDownload,
} from '@tabler/icons-react';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { menuApi, ComboMeal, FoodItem } from '@/lib/api/menu';
import { useLanguageStore } from '@/lib/store/language-store';
import { useAuthStore } from '@/lib/store/auth-store';
import { useBranchStore } from '@/lib/store/branch-store';
import { t } from '@/lib/utils/translations';
import { useNotificationColors, useErrorColor, useSuccessColor } from '@/lib/hooks/use-theme-colors';
import { useThemeColor } from '@/lib/hooks/use-theme-color';
import { getBadgeColorForText } from '@/lib/utils/theme';
import { onMenuDataUpdate, notifyMenuDataUpdate } from '@/lib/utils/menu-events';
import { usePagination } from '@/lib/hooks/use-pagination';
import { PaginationControls } from '@/components/common/PaginationControls';
import { DEFAULT_PAGINATION } from '@/shared/constants/app.constants';
import { isPaginatedResponse } from '@/lib/types/pagination.types';
import { BulkImportModal } from '@/components/common/BulkImportModal';
import { handleApiError } from '@/shared/utils/error-handler';
import { useMenuData } from '@/lib/contexts/menu-data-context';

export function ComboMealPage() {
  const { language } = useLanguageStore();
  const { user } = useAuthStore();
  const { selectedBranchId } = useBranchStore();
  const notificationColors = useNotificationColors();
  const errorColor = useErrorColor();
  const successColor = useSuccessColor();
  const primaryColor = useThemeColor();
  const pagination = usePagination<ComboMeal>({ 
    initialPage: DEFAULT_PAGINATION.page, 
    initialLimit: DEFAULT_PAGINATION.limit 
  });
  const { menus: sharedMenus, foodItems: sharedFoodItems, refreshMenus, refreshFoodItems } = useMenuData();
  const [comboMeals, setComboMeals] = useState<ComboMeal[]>([]);
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [menus, setMenus] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [opened, setOpened] = useState(false);
  const [editingComboMeal, setEditingComboMeal] = useState<ComboMeal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [bulkImportOpened, setBulkImportOpened] = useState(false);

  // Refs to prevent duplicate API calls
  const loadingDataRef = useRef(false);
  const lastDataLoadRef = useRef<string>('');
  const dataRequestIdRef = useRef(0);

  const form = useForm({
    initialValues: {
      name: '',
      description: '',
      basePrice: 0,
      foodItemIds: [] as string[],
      menuTypes: [] as string[],
      imageUrl: '',
    },
    validate: {
      name: (value) => (!value ? (t('common.nameRequired', language) || 'Name is required') : null),
      basePrice: (value) => (value <= 0 ? (t('menu.basePriceRequired', language) || 'Base price must be greater than 0') : null),
      foodItemIds: (value) => (value.length === 0 ? (t('menu.foodItemsRequired', language) || 'At least one food item is required') : null),
    },
  });

  const loadData = useCallback(async () => {
    if (!user?.tenantId) return;

    const loadKey = `${user?.tenantId}-${pagination.page}-${pagination.limit}-${selectedBranchId}-${language}`;
    
    // Skip if already loading with same parameters
    if (loadingDataRef.current && lastDataLoadRef.current === loadKey) {
      return;
    }

    // Mark as loading and track this request
    loadingDataRef.current = true;
    lastDataLoadRef.current = loadKey;
    const currentRequestId = ++dataRequestIdRef.current;

    try {
      setLoading(true);

      const pageLimit = 100; // Fetch 100 items per page

      // Start loading combo meals (menus and food items are already loaded by MenuDataProvider)
      const promises: Promise<any>[] = [];

      // Add combo meals promise if online
      if (navigator.onLine) {
        promises.push(
          menuApi.getComboMeals(pagination.paginationParams, selectedBranchId || undefined, language)
            .catch((err) => {
              console.warn('Failed to load combo meals from server:', err);
              return null; // Return null on error, we'll handle it below
            })
        );
      }

      // Wait for combo meals
      const results = await Promise.all(promises);
      const comboMealsResponse = results[0];

      // Only update state if this is still the latest request
      if (currentRequestId === dataRequestIdRef.current) {
        // Use shared data from context
        setMenus(sharedMenus);
        setFoodItems(sharedFoodItems);

        // Process combo meals response
        if (comboMealsResponse) {
          const serverComboMeals = pagination.extractData(comboMealsResponse);
          pagination.extractPagination(comboMealsResponse);
          setComboMeals(serverComboMeals);
        } else {
          setComboMeals([]);
        }
      }
    } catch (err: any) {
      // Only set error if this is still the latest request
      if (currentRequestId === dataRequestIdRef.current) {
        setError(err.message || 'Failed to load data');
      }
    } finally {
      // Only clear loading if this is still the latest request
      if (currentRequestId === dataRequestIdRef.current) {
        setLoading(false);
        loadingDataRef.current = false;
      }
    }
    //eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.tenantId, selectedBranchId, language, pagination.page, pagination.limit]);

  // Sync shared data from context
  useEffect(() => {
    setMenus(sharedMenus);
  }, [sharedMenus]);

  useEffect(() => {
    setFoodItems(sharedFoodItems);
  }, [sharedFoodItems]);

  useEffect(() => {
    loadData();

    const unsubscribe1 = onMenuDataUpdate('combo-meals-updated', () => {
      loadData();
    });

    // Also listen for food items updates so new items appear in combo selection
    const unsubscribe2 = onMenuDataUpdate('food-items-updated', () => {
      loadData();
    });

    return () => {
      unsubscribe1();
      unsubscribe2();
    };
  }, [loadData, pagination.page, pagination.limit]);

  const getMenuName = (menuType: string): string => {
    // Try case-insensitive match first
    const menuTypeLower = menuType.toLowerCase();
    const menu = menus.find((m) => m.menuType?.toLowerCase() === menuTypeLower);
    // Always use the menu name from backend if available
    if (menu && menu.name) {
      return menu.name;
    }
    // Fallback to translation mapping (same as FoodItemsPage)
    if (menuTypeLower === 'all_day') return t('menu.allDay', language);
    if (menuTypeLower === 'breakfast') return t('menu.breakfast', language);
    if (menuTypeLower === 'lunch') return t('menu.lunch', language);
    if (menuTypeLower === 'dinner') return t('menu.dinner', language);
    if (menuTypeLower === 'kids_special') return t('menu.kidsSpecial', language);
    // Only fallback to menuType if no translation available
    return menuType;
  };

  const calculateIndividualPrice = (foodItemIds: string[]): number => {
    return foodItemIds.reduce((total, itemId) => {
      const item = foodItems.find((f) => f.id === itemId);
      return total + (item?.basePrice || 0);
    }, 0);
  };

  const handleOpenModal = async (comboMeal?: ComboMeal) => {
    // Ensure menus and food items are loaded before opening modal
    if (menus.length === 0 && sharedMenus.length > 0) {
      setMenus(sharedMenus);
    }
    if (foodItems.length === 0 && sharedFoodItems.length > 0) {
      setFoodItems(sharedFoodItems);
    }
    
    if (comboMeal) {
      setEditingComboMeal(comboMeal);
      form.setValues({
        name: comboMeal.name,
        description: comboMeal.description || '',
        basePrice: comboMeal.basePrice,
        foodItemIds: comboMeal.foodItemIds || [],
        menuTypes: comboMeal.menuTypes || [],
        imageUrl: comboMeal.imageUrl || '',
      });
      setImagePreview(comboMeal.imageUrl || null);
    } else {
      setEditingComboMeal(null);
      form.reset();
      setImagePreview(null);
    }
    setOpened(true);
  };

  const handleCloseModal = () => {
    setOpened(false);
    setEditingComboMeal(null);
    form.reset();
    setImagePreview(null);
    setImageFile(null);
  };

  const handleImageUpload = async (file: File | null) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      setImagePreview(dataUrl);
    };
    reader.readAsDataURL(file);
    setImageFile(file);

    if (editingComboMeal) {
      try {
        setUploadingImage(true);
        const updated = await menuApi.uploadComboMealImage(editingComboMeal.id, file);
        form.setFieldValue('imageUrl', updated.imageUrl || '');
        setImagePreview(updated.imageUrl || null);
        notifications.show({
          title: t('common.success' as any, language) || 'Success',
          message: 'Image uploaded successfully',
          color: successColor,
        });
        loadData();
        notifyMenuDataUpdate('combo-meals-updated');
      } catch (err: any) {
        notifications.show({
          title: t('common.error' as any, language) || 'Error',
          message: err.message || 'Failed to upload image',
          color: errorColor,
        });
      } finally {
        setUploadingImage(false);
      }
    }
  };

  const handleSubmit = async (values: typeof form.values) => {
    if (!user?.tenantId) return;

    const wasEditing = !!editingComboMeal;
    const currentEditingComboMeal = editingComboMeal;
    const currentImageFile = imageFile;
    handleCloseModal();

    (async () => {
      try {
        // Auto-calculate discount percentage based on individual items total vs combo price
        const individualPrice = calculateIndividualPrice(values.foodItemIds);
        const basePriceNum = Number(values.basePrice || 0);
        const discountPercentage = individualPrice > 0
          ? ((individualPrice - basePriceNum) / individualPrice) * 100
          : 0;

        const comboMealData = {
          name: values.name,
          description: values.description || undefined,
          basePrice: basePriceNum,
          foodItemIds: values.foodItemIds,
          menuTypes: values.menuTypes || [],
          discountPercentage: discountPercentage > 0 ? discountPercentage : undefined,
          imageUrl: values.imageUrl || undefined,
        };

        let savedComboMeal: ComboMeal;

        if (wasEditing && currentEditingComboMeal) {
          savedComboMeal = await menuApi.updateComboMeal(currentEditingComboMeal.id, comboMealData);
        } else {
          savedComboMeal = await menuApi.createComboMeal(comboMealData, selectedBranchId || undefined);

          if (currentImageFile) {
            try {
              const updated = await menuApi.uploadComboMealImage(savedComboMeal.id, currentImageFile);
              savedComboMeal = updated;
            } catch (err) {
              console.warn('Failed to upload image after combo meal creation:', err);
            }
          }
        }

        notifications.show({
          title: t('common.success' as any, language) || 'Success',
          message: t('menu.saveSuccess', language),
          color: successColor,
        });

        loadData();
        notifyMenuDataUpdate('combo-meals-updated');
      } catch (err: any) {
        handleApiError(err, {
          defaultMessage: 'Failed to save combo meal',
          language,
          errorColor,
          showNotification: true,
        });
      }
    })();
  };

  const handleDelete = (comboMeal: ComboMeal) => {
    modals.openConfirmModal({
      title: t('common.delete' as any, language) || 'Delete',
      children: <Text size="sm">{t('menu.deleteComboMealConfirm', language)}</Text>,
      labels: {
        confirm: t('common.delete' as any, language) || 'Delete',
        cancel: t('common.cancel' as any, language) || 'Cancel',
      },
      confirmProps: { color: errorColor },
      onConfirm: async () => {
        try {
          await menuApi.deleteComboMeal(comboMeal.id);
        notifications.show({
          title: t('common.success' as any, language) || 'Success',
          message: t('menu.deleteSuccess', language),
          color: successColor,
        });
          loadData();
          notifyMenuDataUpdate('combo-meals-updated');
        } catch (err: any) {
          handleApiError(err, {
            defaultMessage: 'Failed to delete combo meal',
            language,
            errorColor,
            showNotification: true,
          });
        }
      },
    });
  };

  // Calculate savings when food items change
  const selectedFoodItems = form.values.foodItemIds
    .map((id) => foodItems.find((item) => item.id === id))
    .filter(Boolean) as FoodItem[];
  const individualTotal = selectedFoodItems.reduce((sum, item) => sum + item.basePrice, 0);
  const basePriceNum = Number(form.values.basePrice || 0);
  const savings = individualTotal > 0 ? individualTotal - basePriceNum : 0;
  const calculatedDiscount = individualTotal > 0 ? (savings / individualTotal) * 100 : 0;

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" mb="xl">
        <Title order={2}>{t('menu.comboMealManagement', language)}</Title>
        <Group gap="xs">
          <Button
            leftSection={<IconDownload size={16} />}
            onClick={async () => {
              try {
                setExportLoading(true);
                const blob = await menuApi.exportEntities('comboMeal', selectedBranchId || undefined, language);
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `combo-meals-export-${new Date().toISOString().split('T')[0]}.xlsx`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                notifications.show({
                  title: t('common.success' as any, language) || 'Success',
                  message: t('bulkImport.exportSuccess', language) || 'Data exported successfully',
                  color: notificationColors.success,
                });
              } catch (error: any) {
                handleApiError(error, {
                  defaultMessage: 'Failed to export combo meals',
                  language,
                  errorColor: notificationColors.error,
                });
              } finally {
                setExportLoading(false);
              }
            }}
            loading={exportLoading}
            variant="light"
          >
            {t('bulkImport.export', language) || 'Export'}
          </Button>
          <Button
            leftSection={<IconFileSpreadsheet size={16} />}
            onClick={() => setBulkImportOpened(true)}
            variant="light"
          >
            {t('bulkImport.bulkImport', language) || 'Bulk Import'}
          </Button>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => handleOpenModal()}
            style={{ backgroundColor: primaryColor }}
          >
            {t('menu.createComboMeal', language)}
          </Button>
        </Group>
      </Group>

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color={errorColor} mb="md">
          {error}
        </Alert>
      )}

      {loading ? (
        <Paper withBorder>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Price</Table.Th>
                <Table.Th>Items</Table.Th>
                <Table.Th>Discount</Table.Th>
                <Table.Th>Menu Types</Table.Th>
                <Table.Th>Active</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {[1, 2, 3, 4, 5].map((i) => (
                <Table.Tr key={i}>
                  <Table.Td>
                    <Group gap="sm">
                      <Skeleton height={40} width={40} radius="md" />
                      <Skeleton height={16} width={150} />
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Skeleton height={16} width={80} />
                  </Table.Td>
                  <Table.Td>
                    <Skeleton height={16} width={60} />
                  </Table.Td>
                  <Table.Td>
                    <Skeleton height={16} width={60} />
                  </Table.Td>
                  <Table.Td>
                    <Skeleton height={24} width={80} radius="xl" />
                  </Table.Td>
                  <Table.Td>
                    <Skeleton height={24} width={60} radius="xl" />
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Skeleton height={32} width={32} radius="md" />
                      <Skeleton height={32} width={32} radius="md" />
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      ) : comboMeals.length === 0 ? (
        <Paper p="xl" withBorder>
          <Text ta="center" c="dimmed">
            {t('menu.noComboMealsFound', language)}
          </Text>
        </Paper>
      ) : (
        <>
          <Paper withBorder>
            <Table.ScrollContainer minWidth={1000}>
              <Table highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                      <Table.Th style={{ minWidth: 250 }}>{t('common.name', language)}</Table.Th>
                    <Table.Th style={{ minWidth: 100 }}>{t('menu.price', language)}</Table.Th>
                    <Table.Th style={{ minWidth: 80 }}>{t('menu.items', language)}</Table.Th>
                    <Table.Th style={{ minWidth: 100 }}>{t('menu.discounts', language)}</Table.Th>
                    <Table.Th style={{ minWidth: 180 }}>{t('menu.menuTypes', language)}</Table.Th>
                    <Table.Th style={{ minWidth: 90 }}>{t('menu.active', language)}</Table.Th>
                    <Table.Th style={{ minWidth: 100 }}>{t('menu.actions', language)}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {comboMeals.map((comboMeal) => (
                    <Table.Tr key={comboMeal.id}>
                      <Table.Td style={{ maxWidth: 300 }}>
                        <Group gap="sm" wrap="nowrap">
                          {comboMeal.imageUrl ? (
                            <Box
                          w={40}
                          h={40}
                          style={{
                            flexShrink: 0,
                            borderRadius: 'var(--mantine-radius-sm)',
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Image
                            src={comboMeal.imageUrl}
                            alt={comboMeal.name}
                            width={40}
                            height={40}
                            fit="cover"
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              objectPosition: 'center',
                            }}
                          />
                        </Box>
                          ) : (
                            <Box
                              w={40}
                              h={40}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: `${primaryColor}15`,
                                borderRadius: '4px',
                                flexShrink: 0,
                              }}
                            >
                              <IconToolsKitchen2 size={20} color={primaryColor} />
                            </Box>
                          )}
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <Text fw={500} truncate>
                              {comboMeal.name}
                            </Text>
                            {comboMeal.description && (
                              <Text size="xs" c="dimmed" lineClamp={1}>
                                {comboMeal.description}
                              </Text>
                            )}
                          </div>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Text fw={500}>{comboMeal.basePrice.toFixed(2)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{comboMeal.foodItemIds?.length || 0} {t('menu.items', language)}</Text>
                      </Table.Td>
                      <Table.Td>
                        {comboMeal.discountPercentage ? (
                          <Badge color={successColor} variant="light" size="sm">
                            {comboMeal.discountPercentage.toFixed(0)}% {t('menu.off', language)}
                          </Badge>
                        ) : (
                          <Text c="dimmed" size="sm">
                            -
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {(() => {
                          const menuTypeNames = comboMeal.menuTypeNames || comboMeal.menuTypes;
                          const menuTypes = comboMeal.menuTypes;
                          if (menuTypeNames && menuTypeNames.length > 0) {
                            return (
                              <Group gap={4} wrap="wrap" style={{ maxWidth: 200 }}>
                                {menuTypeNames.map((menuTypeName: string, index: number) => {
                                  // Use menuTypeNames if available (translated from API), otherwise fallback to translating menuTypes
                                  const displayName = menuTypeName || (menuTypes && menuTypes[index] ? getMenuName(menuTypes[index]) : menuTypeName);
                                  return (
                                    <Badge 
                                      key={menuTypes && menuTypes[index] ? menuTypes[index] : index} 
                                      variant="light" 
                                      size="sm"
                                      color={getBadgeColorForText(displayName)}
                                    >
                                      {displayName}
                                    </Badge>
                                  );
                                })}
                              </Group>
                            );
                          }
                          return (
                            <Text c="dimmed" size="sm">
                              -
                            </Text>
                          );
                        })()}
                      </Table.Td>
                      <Table.Td>
                        <Badge 
                          variant="light" 
                          color={comboMeal.isActive ? successColor : getBadgeColorForText(t('menu.inactive', language) || 'Inactive')} 
                          size="sm"
                        >
                          {comboMeal.isActive ? t('menu.active', language) : t('menu.inactive', language)}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs" wrap="nowrap">
                          <ActionIcon
                            variant="light"
                            onClick={() => handleOpenModal(comboMeal)}
                            style={{ color: primaryColor }}
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                          <ActionIcon variant="light" color={errorColor} onClick={() => handleDelete(comboMeal)}>
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Paper>
          {pagination.total > 0 && (
            <PaginationControls
              page={pagination.page}
              totalPages={pagination.totalPages}
              limit={pagination.limit}
              total={pagination.total}
              onPageChange={(page) => {
                pagination.setPage(page);
              }}
              onLimitChange={(newLimit) => {
                pagination.setLimit(newLimit);
                pagination.setPage(1);
              }}
            />
          )}
        </>
      )}

      <Modal
        opened={opened}
        onClose={handleCloseModal}
        title={editingComboMeal ? t('menu.editComboMeal', language) : t('menu.createComboMeal', language)}
        size="xl"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <Grid>
              <Grid.Col span={12}>
                <TextInput label={t('menu.comboMealName', language)} required {...form.getInputProps('name')} />
              </Grid.Col>
              <Grid.Col span={12}>
                <Textarea label={t('menu.description', language)} {...form.getInputProps('description')} />
              </Grid.Col>
              <Grid.Col span={12}>
                <MultiSelect
                  label={t('menu.foodItems', language)}
                  required
                  placeholder={t('menu.selectFoodItemsForCombo', language) || 'Select food items included in this combo'}
                  data={(foodItems.length > 0 ? foodItems : sharedFoodItems).map((item) => ({
                    value: item.id,
                    label: `${item.name} - ${item.basePrice.toFixed(2)}`,
                  }))}
                  {...form.getInputProps('foodItemIds')}
                  searchable
                />
              </Grid.Col>
              {form.values.foodItemIds.length > 0 && (
                <Grid.Col span={12}>
                  <Card withBorder p="sm">
                    <Stack gap="xs">
                      <Text size="sm" fw={500}>
                        {t('menu.priceCalculation', language)}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {t('menu.individualItemsTotal', language)}: {individualTotal.toFixed(2)}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {t('menu.comboPrice', language)}: {basePriceNum.toFixed(2)}
                      </Text>
                      {savings > 0 && (
                        <Text size="sm" c={successColor} fw={500}>
                          {t('menu.savings', language)}: {savings.toFixed(2)} ({calculatedDiscount.toFixed(0)}% {t('menu.off', language)})
                        </Text>
                      )}
                    </Stack>
                  </Card>
                </Grid.Col>
              )}
              <Grid.Col span={12}>
                <NumberInput
                  label={t('menu.comboPrice', language)}
                  required
                  min={0.01}
                  decimalScale={2}
                  {...form.getInputProps('basePrice')}
                />
              </Grid.Col>
              <Grid.Col span={12}>
                <MultiSelect
                  label={t('menu.menuTypes', language)}
                  placeholder={t('menu.selectMenuTypes', language)}
                  data={(menus.length > 0 ? menus : sharedMenus).map((menu) => ({
                    value: menu.menuType,
                    label: menu.name || menu.menuType,
                  }))}
                  {...form.getInputProps('menuTypes')}
                  searchable
                />
              </Grid.Col>
              <Grid.Col span={12}>
                <Stack gap="xs">
                  <Text size="sm" fw={500}>
                    {t('menu.image', language)}
                  </Text>
                  <Box
                    w={150}
                    h={150}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: `${primaryColor}10`,
                      borderRadius: '8px',
                      overflow: 'hidden',
                      border: `1px solid ${primaryColor}20`,
                    }}
                  >
                    {imagePreview ? (
                      <Image
                        src={imagePreview}
                        alt="Preview"
                        width={150}
                        height={150}
                        fit="cover"
                        style={{ objectFit: 'cover' }}
                      />
                    ) : (
                      <IconToolsKitchen2 size={48} color={primaryColor} opacity={0.5} />
                    )}
                  </Box>
                  <FileButton onChange={handleImageUpload} accept="image/png,image/jpeg,image/jpg,image/webp">
                    {(props) => (
                      <Button
                        {...props}
                        leftSection={<IconUpload size={16} />}
                        loading={uploadingImage && !!editingComboMeal}
                        variant="outline"
                        style={{ color: primaryColor }}
                      >
                        {t('menu.uploadImage', language)}
                      </Button>
                    )}
                  </FileButton>
                </Stack>
              </Grid.Col>
            </Grid>

            <Group justify="flex-end" mt="md">
              <Button variant="subtle" onClick={handleCloseModal}>
                {t('common.cancel' as any, language) || 'Cancel'}
              </Button>
              <Button type="submit" style={{ backgroundColor: primaryColor }}>
                {t('common.save' as any, language) || 'Save'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <BulkImportModal
        opened={bulkImportOpened}
        onClose={() => setBulkImportOpened(false)}
        onSuccess={() => {
          loadData();
          notifyMenuDataUpdate('combo-meals-updated');
        }}
        entityType="comboMeal"
        entityName={t('menu.comboMeals', language) || 'Combo Meals'}
        downloadSample={async () => {
          return await menuApi.downloadBulkImportSample('comboMeal', language);
        }}
        uploadFile={async (file: File) => {
          return await menuApi.bulkImportComboMeals(file, selectedBranchId || undefined);
        }}
      />
    </Container>
  );
}

