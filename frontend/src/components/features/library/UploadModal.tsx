'use client';

import { Modal, TextInput, Select, Button, Stack, Textarea, Group, FileButton, Progress, Text, Alert } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useForm } from '@mantine/form';
import { zodResolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useUploadLibraryFile, useCreateLibraryItem, useUpdateLibraryItem, useLibraryItem, useLibraryCategories } from '@/hooks/useLibrary';
import { useCoreLookups } from '@/hooks/useCoreLookups';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { IconUpload, IconFile } from '@tabler/icons-react';
import { StorageQuotaBar } from './StorageQuotaBar';
import type { LibraryItem } from '@/hooks/useLibrary';
import type { ClassEntity } from '@/types/settings';

interface UploadModalProps {
  opened: boolean;
  onClose: () => void;
  itemId?: string | null;
}

const MAX_LIBRARY_UPLOAD_BYTES = 100 * 1024 * 1024; // 100MB

export function UploadModal({ opened, onClose, itemId }: UploadModalProps) {
  const t = useTranslations('library');
  const colors = useThemeColors();
  const isEdit = !!itemId;
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  const libraryItemSchema = useMemo(
    () =>
      z.object({
        title: z.string().min(1, t('titleRequired')),
        author: z.string().optional(),
        description: z.string().optional(),
        subjectId: z.string().nullable().optional(),
        classId: z.string().nullable().optional(),
        category: z.string().min(1, t('categoryRequired')),
      }),
    [t],
  );

  const { data: categoriesData } = useLibraryCategories();
  const categories = categoriesData || [];
  const { data: subjectsData } = useCoreLookups('subjects');
  const subjects = subjectsData?.data || [];
  const { data: classesData } = useCoreLookups('classes');
  const classes = classesData?.data || [];

  const { data: existingItem } = useLibraryItem(itemId || null);
  const uploadMutation = useUploadLibraryFile();
  const createMutation = useCreateLibraryItem();
  const updateMutation = useUpdateLibraryItem();

  const form = useForm({
    initialValues: {
      title: '',
      author: '',
      description: '',
      subjectId: '',
      classId: '',
      category: '',
    },
    validate: zodResolver(libraryItemSchema),
  });

  useEffect(() => {
    if (isEdit && existingItem) {
      form.setValues({
        title: existingItem.title,
        author: existingItem.author || '',
        description: existingItem.description || '',
        subjectId: existingItem.subjectId || '',
        classId: existingItem.classId || '',
        category: existingItem.category,
      });
    } else if (!isEdit) {
      form.reset();
      setSelectedFile(null);
      setUploadProgress(0);
    }
  }, [isEdit, existingItem, opened]);

  const handleFileChange = (file: File | null) => {
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (file.size > MAX_LIBRARY_UPLOAD_BYTES) {
      setSelectedFile(null);
      notifications.show({
        title: t('uploadError'),
        message: t('fileTooLarge100mb'),
        color: 'red',
      });
      return;
    }
    setSelectedFile(file);
  };

  const handleSubmit = async (values: typeof form.values) => {
    if (isEdit) {
      await updateMutation.mutateAsync({
        id: itemId!,
        input: {
          title: values.title,
          author: values.author || undefined,
          description: values.description || undefined,
          subjectId: values.subjectId || undefined,
          classId: values.classId || undefined,
          category: values.category,
        },
      });
      onClose();
    } else {
      if (!selectedFile) {
        form.setFieldError('file', t('pleaseSelectFile'));
        return;
      }

      try {
        setUploading(true);
        setUploadProgress(0);

        // Upload file first
        const uploadResult = await uploadMutation.mutateAsync(selectedFile);
        
        if (!uploadResult) {
          throw new Error('Upload failed - no response received');
        }

        setUploadProgress(100);

        // Then create library item
        await createMutation.mutateAsync({
          title: values.title,
          author: values.author || undefined,
          description: values.description || undefined,
          subjectId: values.subjectId || undefined,
          classId: values.classId || undefined,
          category: values.category,
          fileUrl: uploadResult.fileUrl,
          fileName: uploadResult.fileName,
          fileSizeBytes: uploadResult.fileSizeBytes,
          mimeType: uploadResult.mimeType,
          thumbnailUrl: uploadResult.thumbnailUrl,
        });

        onClose();
        form.reset();
        setSelectedFile(null);
        setUploadProgress(0);
      } catch (error) {
        console.error('Upload error:', error);
        notifications.show({
          title: t('uploadError'),
          message: error instanceof Error ? error.message : t('uploadError'),
          color: 'red',
        });
      } finally {
        setUploading(false);
      }
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEdit ? t('editLibraryItem') : t('uploadLibraryItem')}
      size="lg"
    >
      <form id="library-upload-form" onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          {!isEdit && (
            <>
              <StorageQuotaBar />
              <FileButton onChange={handleFileChange} accept=".pdf,.doc,.docx,.txt,application/pdf">
                {(props) => (
                  <Button id="library-upload-select-file" {...props} leftSection={<IconUpload size={16} />} variant="light" fullWidth>
                    {selectedFile ? t('selectedFile', { name: selectedFile.name }) : t('selectFile')}
                  </Button>
                )}
              </FileButton>
            </>
          )}

          {selectedFile && (
            <Alert color={colors.info} icon={<IconFile size={16} />}>
              <Text size="sm">
                <strong>{selectedFile.name}</strong> ({formatFileSize(selectedFile.size)})
              </Text>
            </Alert>
          )}

          {uploading && <Progress value={uploadProgress} animated />}

          <TextInput
            id="library-upload-title"
            label={t('titleLabel')}
            placeholder={t('titlePlaceholder')}
            required
            {...form.getInputProps('title')}
          />

          <TextInput
            id="library-upload-author"
            label={t('author')}
            placeholder={t('authorPlaceholder')}
            {...form.getInputProps('author')}
          />

          <Textarea
            id="library-upload-description"
            label={t('description')}
            placeholder={t('descriptionPlaceholder')}
            rows={3}
            {...form.getInputProps('description')}
          />

          <Select
            id="library-upload-category"
            label={t('category')}
            placeholder={t('selectCategory')}
            required
            data={categories.map((cat) => ({ value: cat, label: cat }))}
            searchable
            {...form.getInputProps('category')}
          />

          <Select
            id="library-upload-subject"
            label={t('subject')}
            placeholder={t('selectSubjectOptional')}
            data={subjects.map((s) => ({ value: s.id, label: s.name }))}
            searchable
            clearable
            {...form.getInputProps('subjectId')}
          />

          <Select
            id="library-upload-class"
            label={t('class')}
            placeholder={t('selectClassOptional')}
            data={classes.map((c) => {
              const classEntity = c as ClassEntity;
              return { value: classEntity.id, label: classEntity.displayName || classEntity.name };
            })}
            searchable
            clearable
            {...form.getInputProps('classId')}
          />

          <Group justify="flex-end" mt="md">
            <Button id="library-upload-cancel" variant="subtle" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button id="library-upload-submit" type="submit" loading={createMutation.isPending || updateMutation.isPending || uploading}>
              {isEdit ? t('update') : t('upload')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
