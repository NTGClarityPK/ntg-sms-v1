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
import { useTranslations } from 'next-intl';
import { useCreateUniform, useUpdateUniform, useUploadUniformImage } from '@/hooks/useInventory';
import { useSystemSetting } from '@/hooks/useSystemSettings';
import type { UniformItem, CreateUniformItemInput } from '@/types/inventory';

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
  const t = useTranslations('inventory');
  const GENDERS = useMemo(
    () => [
      { value: 'male', label: t('male') },
      { value: 'female', label: t('female') },
      { value: 'unisex', label: t('unisex') },
    ],
    [t],
  );
  const itemSchema = useMemo(
    () =>
      z.object({
        name: z.string().min(1, t('nameRequired')),
        itemCode: z.string().optional(),
        category: z.string().min(1, t('categoryRequired')),
        gender: z.string().optional(),
        description: z.string().optional(),
        imageUrl: z.string().optional(),
        isActive: z.boolean(),
      }),
    [t],
  );
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
      title={isEdit ? t('editUniformItem') : t('createUniformItem')}
      size="md"
    >
      <form id="uniform-item-form" onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <TextInput
            id="uniform-item-form-name"
            label={t('name')}
            placeholder={t('namePlaceholder')}
            required
            {...form.getInputProps('name')}
          />
          <TextInput
            id="uniform-item-form-code"
            label={t('itemCode')}
            placeholder={t('itemCodePlaceholder')}
            {...form.getInputProps('itemCode')}
          />
          <Select
            id="uniform-item-form-category"
            label={t('category')}
            data={categoryOptions}
            placeholder={
              categoryOptions.length === 0
                ? t('noCategoriesHint')
                : t('selectCategory')
            }
            required
            {...form.getInputProps('category')}
          />
          <Select
            id="uniform-item-form-gender"
            label={t('gender')}
            data={GENDERS}
            clearable
            {...form.getInputProps('gender')}
          />
          <Textarea
            id="uniform-item-form-description"
            label={t('description')}
            placeholder={t('descriptionPlaceholder')}
            {...form.getInputProps('description')}
          />
          <Stack gap="xs">
            <Text size="sm" fw={500}>
              {t('uploadImage')}
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
                    {t('removeImage')}
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
                {t('chooseImage')}
              </Button>
            )}
          </Stack>
          <TextInput
            label={t('imageUrl')}
            placeholder={t('imageUrlPlaceholder')}
            {...form.getInputProps('imageUrl')}
            onChange={handleImageUrlChange}
            disabled={!!imageFile}
          />
          <Switch
            id="uniform-item-form-active"
            label={t('active')}
            {...form.getInputProps('isActive', { type: 'checkbox' })}
          />
          <Group justify="flex-end" mt="md">
            <Button id="uniform-item-form-cancel" variant="default" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button
              id="uniform-item-form-submit"
              type="submit"
              loading={
                createMutation.isPending ||
                updateMutation.isPending ||
                uploadMutation.isPending
              }
            >
              {isEdit ? t('update') : t('create')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
