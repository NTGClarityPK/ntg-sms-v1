'use client';

import {
  Modal,
  TextInput,
  Select,
  Textarea,
  Button,
  Stack,
  Group,
  Switch,
  Image,
  Text,
} from '@mantine/core';
import { IconUpload, IconX } from '@tabler/icons-react';
import { useForm } from '@mantine/form';
import { zodResolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCreateUniform, useUpdateUniform, useUploadUniformImage } from '@/hooks/useInventory';
import { useSystemSetting } from '@/hooks/useSystemSettings';
import type { UniformItem, CreateUniformItemInput } from '@/types/inventory';

const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'unisex', label: 'Unisex' },
];

const itemSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  itemCode: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  gender: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  isActive: z.boolean(),
});

interface UniformItemFormModalProps {
  opened: boolean;
  onClose: () => void;
  item: UniformItem | null;
}

export function UniformItemFormModal({
  opened,
  onClose,
  item,
}: UniformItemFormModalProps) {
  const isEdit = !!item;
  const createMutation = useCreateUniform();
  const updateMutation = useUpdateUniform();
  const uploadMutation = useUploadUniformImage();
  const categoriesSetting = useSystemSetting<string[]>('inventory_categories');
  const categoryOptions = useMemo(() => {
    const raw = categoriesSetting.data?.data?.value;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((s) => ({ value: s.trim(), label: s.trim() }));
    }
    return [];
  }, [categoriesSetting.data?.data?.value]);

  const form = useForm({
    initialValues: {
      name: '',
      itemCode: '',
      category: '',
      gender: '',
      description: '',
      imageUrl: '',
      isActive: true,
    },
    validate: zodResolver(itemSchema),
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (opened) {
      setImageFile(null);
      setUploadPreviewUrl(null);
      if (item) {
        form.setValues({
          name: item.name,
          itemCode: item.itemCode ?? '',
          category: item.category,
          gender: item.gender ?? '',
          description: item.description ?? '',
          imageUrl: item.imageUrl ?? '',
          isActive: item.isActive,
        });
      } else {
        form.reset();
      }
    }
  }, [opened, item]);

  useEffect(() => {
    if (!imageFile) {
      setUploadPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setUploadPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const hasImageUrl = (form.values.imageUrl ?? '').trim().length > 0;
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      form.setFieldValue('imageUrl', '');
    }
    e.target.value = '';
  };
  const clearUpload = () => {
    setImageFile(null);
  };
  const handleImageUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    form.getInputProps('imageUrl').onChange(e);
    setImageFile(null);
  };

  const handleSubmit = async (values: typeof form.values) => {
    let finalImageUrl = values.imageUrl || undefined;
    if (imageFile) {
      const uploaded = await uploadMutation.mutateAsync(imageFile);
      finalImageUrl = uploaded.imageUrl;
    }

    const payload: CreateUniformItemInput = {
      name: values.name,
      itemCode: values.itemCode || undefined,
      category: values.category,
      gender: values.gender || undefined,
      description: values.description || undefined,
      imageUrl: finalImageUrl,
      isActive: values.isActive,
    };

    if (isEdit && item) {
      await updateMutation.mutateAsync({ id: item.id, input: payload });
      onClose();
      return;
    }

    await createMutation.mutateAsync(payload);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEdit ? 'Edit uniform item' : 'Create uniform item'}
      size="md"
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <TextInput
            label="Name"
            placeholder="e.g. Boys Shirt, Girls Skirt"
            required
            {...form.getInputProps('name')}
          />
          <TextInput
            label="Item code"
            placeholder="Optional code"
            {...form.getInputProps('itemCode')}
          />
          <Select
            label="Category"
            data={categoryOptions}
            placeholder={
              categoryOptions.length === 0
                ? 'No categories. Add them in Settings → Inventory Management.'
                : 'Select category'
            }
            required
            {...form.getInputProps('category')}
          />
          <Select
            label="Gender"
            data={GENDERS}
            clearable
            {...form.getInputProps('gender')}
          />
          <Textarea
            label="Description"
            placeholder="Optional description"
            {...form.getInputProps('description')}
          />
          <Stack gap="xs">
            <Text size="sm" fw={500}>
              Upload image
            </Text>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            {uploadPreviewUrl ? (
              <Stack gap="xs">
                <Image
                  src={uploadPreviewUrl}
                  alt="Attached"
                  h={120}
                  w="auto"
                  maw={200}
                  radius="sm"
                  fit="contain"
                />
                <Group gap="xs">
                  <Button
                    type="button"
                    variant="light"
                    size="xs"
                    leftSection={<IconX size={14} />}
                    onClick={clearUpload}
                  >
                    Remove image
                  </Button>
                </Group>
              </Stack>
            ) : (
              <Button
                type="button"
                variant="light"
                leftSection={<IconUpload size={16} />}
                onClick={() => fileInputRef.current?.click()}
                disabled={hasImageUrl}
              >
                Choose image
              </Button>
            )}
          </Stack>
          <TextInput
            label="Image URL"
            placeholder="https://... (optional)"
            {...form.getInputProps('imageUrl')}
            onChange={handleImageUrlChange}
            disabled={!!imageFile}
          />
          <Switch
            label="Active"
            {...form.getInputProps('isActive', { type: 'checkbox' })}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={
                createMutation.isPending ||
                updateMutation.isPending ||
                uploadMutation.isPending
              }
            >
              {isEdit ? 'Update' : 'Create'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
