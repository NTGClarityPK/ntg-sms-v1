'use client';

import { useState } from 'react';
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
} from '@mantine/core';
import { IconPlus, IconSearch } from '@tabler/icons-react';
import { useDisclosure, useDebouncedValue } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { useUniforms, useLowStock, useDeleteUniform } from '@/hooks/useInventory';
import { useFeaturePermission } from '@/hooks/usePermissions';
import { useSystemSetting } from '@/hooks/useSystemSettings';
import { LowStockAlert } from '@/components/features/inventory/LowStockAlert';
import { UniformItemCard } from '@/components/features/inventory/UniformItemCard';
import { UniformItemFormModal } from '@/components/features/inventory/UniformItemFormModal';
import { AddStockModal } from '@/components/features/inventory/AddStockModal';
import type { UniformItem, StockEntry } from '@/types/inventory';

const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'unisex', label: 'Unisex' },
];

export default function InventoryItemsPage() {
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
  const isLoading = uniformsQuery.isLoading || !uniformsQuery.data;
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
      title: 'Delete uniform item',
      children: (
        <Text size="sm">
          Delete &quot;{item.name}&quot;? This will also remove all stock entries for this item. This cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => deleteMutation.mutate(item.id),
    });
  };

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Uniform items</Title>
          {canEdit && (
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => {
                setSelectedItem(null);
                openForm();
              }}
            >
              Add item
            </Button>
          )}
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
                  placeholder="Search by name, code, description..."
                  leftSection={<IconSearch size={16} />}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.currentTarget.value);
                    setPage(1);
                  }}
                />
                <Select
                  placeholder="Category"
                  data={categoryFilterOptions}
                  value={categoryFilter}
                  onChange={(v) => {
                    setCategoryFilter(v);
                    setPage(1);
                  }}
                  clearable
                />
                <Select
                  placeholder="Gender"
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
                No uniform items found. {canEdit && 'Create one to get started.'}
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
                Previous
              </Button>
              <Text size="sm" c="dimmed">
                Page {meta.page} of {meta.totalPages}
              </Text>
              <Button
                variant="default"
                size="sm"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
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
