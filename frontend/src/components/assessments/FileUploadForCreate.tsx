'use client';

/**
 * File Upload Component for Assessment Creation
 * Allows selecting files before assessment is created
 */

import { Group, Stack, Text, FileButton, Paper, Button } from '@mantine/core';
import { IconUpload, IconFile } from '@tabler/icons-react';

interface FileUploadForCreateProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
}

export function FileUploadForCreate({ files, onFilesChange }: FileUploadForCreateProps) {
  const handleFileSelect = (selectedFiles: File[] | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;
    onFilesChange([...files, ...selectedFiles]);
  };

  const handleRemoveFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    onFilesChange(newFiles);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Paper p="md" withBorder>
      <Stack gap="md">
        <Text size="sm" fw={500}>
          Upload Assignment Materials
        </Text>
        <Group>
          <FileButton
            onChange={handleFileSelect}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.txt"
            multiple
          >
            {(props) => (
              <Button leftSection={<IconUpload size={16} />} {...props}>
                Select Files
              </Button>
            )}
          </FileButton>
        </Group>
        {files.length > 0 && (
          <Stack gap="xs">
            <Text size="sm" fw={500}>
              Selected Files ({files.length})
            </Text>
            {files.map((file, index) => (
              <Group key={index} justify="space-between" p="xs" style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: '4px' }}>
                <Group gap="xs">
                  <IconFile size={20} />
                  <Stack gap={0}>
                    <Text size="sm">{file.name}</Text>
                    <Text size="xs" c="dimmed">
                      {formatFileSize(file.size)}
                    </Text>
                  </Stack>
                </Group>
                <Button
                  variant="subtle"
                  color="red"
                  size="xs"
                  onClick={() => handleRemoveFile(index)}
                >
                  Remove
                </Button>
              </Group>
            ))}
            <Text size="xs" c="dimmed" mt="xs">
              Files will be uploaded after the assessment is created
            </Text>
          </Stack>
        )}
        <Text size="xs" c="dimmed">
          Supported formats: PDF, Word, Excel, PowerPoint, Images, Text files (Max 50MB per file)
        </Text>
      </Stack>
    </Paper>
  );
}

