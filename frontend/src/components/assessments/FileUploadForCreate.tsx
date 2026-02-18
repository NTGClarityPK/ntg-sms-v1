'use client';

/**
 * File Upload for Assessment Creation
 * Uploads and compresses each file to draft as the user adds them. Total materials limit 10MB (post-compression).
 */

import { Group, Stack, Text, FileButton, Paper, Button, Alert, Loader } from '@mantine/core';
import { IconUpload, IconFile, IconInfoCircle } from '@tabler/icons-react';
import { useUploadDraftFile, useDeleteDraftFile } from '@/hooks/api/useAssessmentAttachments';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import type { StagedDraftFile } from '@/types/assessment';

const MATERIALS_LIMIT_BYTES = 10 * 1024 * 1024; // 10MB

interface FileUploadForCreateProps {
  draftId: string;
  stagedFiles: StagedDraftFile[];
  onStagedFilesChange: (files: StagedDraftFile[]) => void;
}

export function FileUploadForCreate({
  draftId,
  stagedFiles,
  onStagedFilesChange,
}: FileUploadForCreateProps) {
  const colors = useThemeColors();
  const uploadDraft = useUploadDraftFile(draftId);
  const deleteDraft = useDeleteDraftFile(draftId);

  const handleFileSelect = async (selectedFiles: File[] | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;
    for (const file of selectedFiles) {
      try {
        const result = await uploadDraft.mutateAsync(file);
        onStagedFilesChange([
          ...stagedFiles,
          {
            draftFileId: result.draftFileId,
            fileName: result.fileName,
            fileSizeBytes: result.fileSizeBytes,
            fileUrl: result.fileUrl,
            mimeType: result.mimeType,
          },
        ]);
      } catch {
        // Error already shown by hook
      }
    }
  };

  const handleRemoveFile = async (index: number) => {
    const file = stagedFiles[index];
    if (!file) return;
    try {
      await deleteDraft.mutateAsync(file.draftFileId);
      onStagedFilesChange(stagedFiles.filter((_, i) => i !== index));
    } catch {
      // Error already shown by hook
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const totalBytes = stagedFiles.reduce((s, f) => s + f.fileSizeBytes, 0);
  const totalExceeds = totalBytes > MATERIALS_LIMIT_BYTES;

  return (
    <Paper p="md" withBorder>
      <Stack gap="md">
        <Text size="sm" fw={500}>
          Upload Assignment Materials
        </Text>
        <Alert variant="light" color={colors.info} icon={<IconInfoCircle size={16} />} title="Compression and limit">
          When you press Create Assessment, images and videos are compressed (images: max 1920px, 85% quality; videos: compressed).
          Total size after compression must be 10MB or less. PDFs and documents are stored as-is.
        </Alert>
        <Group>
          <FileButton
            onChange={handleFileSelect}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.txt,.mp4,.webm,.mov,.avi,.mkv"
            multiple
            disabled={uploadDraft.isPending}
          >
            {(props) => (
              <Button
                leftSection={uploadDraft.isPending ? <Loader size={16} /> : <IconUpload size={16} />}
                {...props}
              >
                Select Files
              </Button>
            )}
          </FileButton>
        </Group>
        {stagedFiles.length > 0 && (
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm" fw={500}>
                Materials ({stagedFiles.length})
              </Text>
              <Text size="sm" c={totalExceeds ? 'red' : 'dimmed'}>
                Total: {formatFileSize(totalBytes)} / 10 MB
                {totalExceeds && ' — exceeds limit'}
              </Text>
            </Group>
            {stagedFiles.map((file, index) => (
              <Group
                key={file.draftFileId}
                justify="space-between"
                p="xs"
                style={{
                  border: '1px solid var(--mantine-color-gray-3)',
                  borderRadius: '4px',
                }}
              >
                <Group gap="xs">
                  <IconFile size={20} />
                  <Stack gap={0}>
                    <Text size="sm">{file.fileName}</Text>
                    <Text size="xs" c="dimmed">
                      {formatFileSize(file.fileSizeBytes)}
                    </Text>
                  </Stack>
                </Group>
                <Button
                  variant="subtle"
                  color="red"
                  size="xs"
                  onClick={() => handleRemoveFile(index)}
                  loading={deleteDraft.isPending}
                >
                  Remove
                </Button>
              </Group>
            ))}
          </Stack>
        )}
        <Text size="xs" c="dimmed">
          Supported: PDF, Word, Excel, PowerPoint, images, video (MP4, WebM, etc.), text. Total after compression must be ≤10MB.
        </Text>
      </Stack>
    </Paper>
  );
}
