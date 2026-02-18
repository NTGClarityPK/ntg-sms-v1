'use client';

import { Modal, TextInput, Select, Button, Stack, Textarea, Group, FileButton, Progress, Text, Alert } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zodResolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import { useState, useEffect } from 'react';
import { useUploadLibraryFile, useCreateLibraryItem, useUpdateLibraryItem, useLibraryItem, useLibraryCategories } from '@/hooks/useLibrary';
import { useCoreLookups } from '@/hooks/useCoreLookups';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { IconUpload, IconFile } from '@tabler/icons-react';
import { StorageQuotaBar } from './StorageQuotaBar';
import type { LibraryItem } from '@/hooks/useLibrary';
import type { ClassEntity } from '@/types/settings';

const libraryItemSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  author: z.string().optional(),
  description: z.string().optional(),
  subjectId: z.string().optional(),
  classId: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
});

interface UploadModalProps {
  opened: boolean;
  onClose: () => void;
  itemId?: string | null;
}

export function UploadModal({ opened, onClose, itemId }: UploadModalProps) {
  const colors = useThemeColors();
  const isEdit = !!itemId;
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

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
        form.setFieldError('file', 'Please select a file to upload');
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
          title: 'Upload Error',
          message: error instanceof Error ? error.message : 'Failed to upload file',
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
      title={isEdit ? 'Edit Library Item' : 'Upload Library Item'}
      size="lg"
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          {!isEdit && (
            <>
              <StorageQuotaBar />
              <FileButton onChange={setSelectedFile} accept="application/pdf,image/*,.doc,.docx,.txt">
                {(props) => (
                  <Button {...props} leftSection={<IconUpload size={16} />} variant="light" fullWidth>
                    {selectedFile ? `Selected: ${selectedFile.name}` : 'Select File'}
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
            label="Title"
            placeholder="Enter title"
            required
            {...form.getInputProps('title')}
          />

          <TextInput
            label="Author"
            placeholder="Enter author name"
            {...form.getInputProps('author')}
          />

          <Textarea
            label="Description"
            placeholder="Enter description"
            rows={3}
            {...form.getInputProps('description')}
          />

          <Select
            label="Category"
            placeholder="Select category"
            required
            data={categories.map((cat) => ({ value: cat, label: cat }))}
            searchable
            {...form.getInputProps('category')}
          />

          <Select
            label="Subject"
            placeholder="Select subject (optional)"
            data={subjects.map((s) => ({ value: s.id, label: s.name }))}
            searchable
            clearable
            {...form.getInputProps('subjectId')}
          />

          <Select
            label="Class"
            placeholder="Select class (optional)"
            data={classes.map((c) => {
              const classEntity = c as ClassEntity;
              return { value: classEntity.id, label: classEntity.displayName || classEntity.name };
            })}
            searchable
            clearable
            {...form.getInputProps('classId')}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending || uploading}>
              {isEdit ? 'Update' : 'Upload'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
