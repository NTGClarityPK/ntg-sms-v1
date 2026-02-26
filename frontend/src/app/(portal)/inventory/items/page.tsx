'use client';

import { useState, useMemo } from 'react';
import {
  Group,
  Title,
  Button,
  Stack,
  Skeleton,
  TextInput,
  Select,
  Paper,
  SimpleGrid,
  Text,
  Tooltip,
  ActionIcon,
} from '@mantine/core';
import { IconPlus, IconRefresh, IconSearch } from '@tabler/icons-react';
import { useDisclosure, useDebouncedValue } from '@mantine/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { modals } from '@mantine/modals';
import { useTranslations } from 'next-intl';
import { useUniforms, useLowStock, useDeleteUniform } from '@/hooks/useInventory';
import { useFeaturePermission } from '@/hooks/usePermissions';
import { useSystemSetting } from '@/hooks/useSystemSettings';
import { LowStockAlert } from '@/components/features/inventory/LowStockAlert';
import { UniformItemCard } from '@/components/features/inventory/UniformItemCard';
import { UniformItemFormModal } from '@/components/features/inventory/UniformItemFormModal';
import { AddStockModal } from '@/components/features/inventory/AddStockModal';
import type { UniformItem, StockEntry } from '@/types/inventory';

export default function InventoryItemsPage() {
  const t = useTranslations('inventory');
  const GENDERS = useMemo(
    () => [
      { value: 'male', label: t('male') },
      { value: 'female', label: t('female') },
      { value: 'unisex', label: t('unisex') },
    ],
    [t],
  );
  const queryClient = useQueryClient();
  const { canEdit } = useFeaturePermission('inventory');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [genderFilter, setGenderFilter] = useState<string | null>(null);
  const [formOpened, { open: openForm, close: closeForm }] = useDisclosure(false);
  const [stockOpened, { open: openStock, close: closeStock }] =
    useDisclosure(false);
  const [selectedItem, setSelectedItem] = useState<UniformItem | null>(null);
  const [stockEditEntry, setStockEditEntry] = useState<StockEntry | null>(null);

  const categoriesSetting = useSystemSetting<string[]>('inventory_categories');
  const categoryFilterOptions =
    Array.isArray(categoriesSetting.data?.data?.value) &&
    categoriesSetting.data.data.value.length > 0
      ? categoriesSetting.data.data.value.map((s) => ({
          value: s.trim(),
          label: s.trim(),
        }))
      : [];

  const uniformsQuery = useUniforms({
    page,
    limit: 20,
    category: categoryFilter ?? undefined,
    gender: genderFilter ?? undefined,
    search: debouncedSearch || undefined,
    sortBy: 'created_at',
    sortOrder: 'desc',
  });
  const lowStockQuery = useLowStock();
  const deleteMutation = useDeleteUniform();
  const lowStockItems = lowStockQuery.data ?? [];

  const response = uniformsQuery.data as
    | {
        data?: UniformItem[];
        meta?: { total: number; page: number; limit: number; totalPages: number };
      }
    | null
    | undefined;
  const items = response?.data ?? [];
  const meta = response?.meta;
  const isLoading = uniformsQuery.isLoading || uniformsQuery.isRefetching || !uniformsQuery.data;
  const isEmpty = !isLoading && items.length === 0;

  const handleEdit = (item: UniformItem) => {
    setSelectedItem(item);
    openForm();
  };

  const handleAddStock = (item: UniformItem) => {
    setSelectedItem(item);
    setStockEditEntry(null);
    openStock();
  };

  const handleEditStockQuantity = (item: UniformItem, entry: StockEntry) => {
    setSelectedItem(item);
    setStockEditEntry(entry);
    openStock();
  };

  const handleCloseForm = () => {
    setSelectedItem(null);
    closeForm();
  };

  const handleCloseStock = () => {
    setSelectedItem(null);
    setStockEditEntry(null);
    closeStock();
  };

  const handleDelete = (item: UniformItem) => {
    modals.openConfirmModal({
      title: t('deleteUniformItem'),
      children: (
        <Text size="sm">
          {t('deleteUniformConfirm', { name: item.name })}
        </Text>
      ),
      labels: { confirm: t('delete'), cancel: t('cancel') },
      confirmProps: { color: 'red' },
      onConfirm: () => deleteMutation.mutate(item.id),
    });
  };

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>{t('uniformItemsTitle')}</Title>
          <Group gap="sm">
            <Tooltip label={t('refresh')}>
              <ActionIcon
                variant="light"
                size="lg"
                loading={uniformsQuery.isRefetching}
                onClick={() => queryClient.invalidateQueries({ queryKey: ['uniforms'] })}
              >
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
            {canEdit && (
              <Button
                id="inventory-items-btn-add"
                leftSection={<IconPlus size={16} />}
                onClick={() => {
                  setSelectedItem(null);
                  openForm();
                }}
              >
                {t('addItem')}
              </Button>
            )}
          </Group>
        </Group>
      </div>

      <div
        style={{
          marginTop: '60px',
          paddingLeft: 'var(--mantine-spacing-md)',
          paddingRight: 'var(--mantine-spacing-md)',
          paddingTop: 'var(--mantine-spacing-sm)',
          paddingBottom: 'var(--mantine-spacing-xl)',
        }}
      >
        <Stack gap="md">
          <LowStockAlert
            items={lowStockItems}
            isLoading={lowStockQuery.isLoading || !lowStockQuery.data}
          />
          <Paper p="md" withBorder>
            <Stack gap="md">
              <Group grow>
                <TextInput
                  id="inventory-items-search"
                  placeholder={t('searchPlaceholder')}
                  leftSection={<IconSearch size={16} />}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.currentTarget.value);
                    setPage(1);
                  }}
                />
                <Select
                  id="inventory-items-filter-category"
                  placeholder={t('category')}
                  data={categoryFilterOptions}
                  value={categoryFilter}
                  onChange={(v) => {
                    setCategoryFilter(v);
                    setPage(1);
                  }}
                  clearable
                />
                <Select
                  id="inventory-items-filter-gender"
                  placeholder={t('gender')}
                  data={GENDERS}
                  value={genderFilter}
                  onChange={(v) => {
                    setGenderFilter(v);
                    setPage(1);
                  }}
                  clearable
                />
              </Group>
            </Stack>
          </Paper>

          {isLoading ? (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} height={180} />
              ))}
            </SimpleGrid>
          ) : isEmpty ? (
            <Paper p="xl" withBorder>
              <Text c="dimmed" ta="center">
                {t('noItemsFound')} {canEdit && t('createOneHint')}
              </Text>
            </Paper>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
              {items.map((item) => (
                <UniformItemCard
                  key={item.id}
                  item={item}
                  onEdit={canEdit ? handleEdit : undefined}
                  onDelete={canEdit ? handleDelete : undefined}
                  onAddStock={canEdit ? handleAddStock : undefined}
                  onEditStockQuantity={
                    canEdit ? handleEditStockQuantity : undefined
                  }
                  canEdit={canEdit}
                />
              ))}
            </SimpleGrid>
          )}

          {meta && meta.totalPages > 1 && (
            <Group justify="center" gap="xs">
              <Button
                variant="default"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t('previous')}
              </Button>
              <Text size="sm" c="dimmed">
                {t('pageOf', { page: meta.page, total: meta.totalPages })}
              </Text>
              <Button
                variant="default"
                size="sm"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('next')}
              </Button>
            </Group>
          )}
        </Stack>
      </div>

      <UniformItemFormModal
        opened={formOpened}
        onClose={handleCloseForm}
        item={selectedItem}
      />
      <AddStockModal
        opened={stockOpened}
        onClose={handleCloseStock}
        item={selectedItem}
        editEntry={stockEditEntry}
      />
    </>
  );
}
