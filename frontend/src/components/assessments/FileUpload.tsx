'use client';

/**
 * File Upload Component for Assessments (images compressed on backend: 1920px max, 85% quality)
 */

import { useState } from 'react';
import { Button, Group, Stack, Text, FileButton, Paper, Progress, ActionIcon, Tooltip, Alert } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconUpload, IconX, IconFile, IconDownload, IconInfoCircle } from '@tabler/icons-react';
import { useUploadAssessmentFile, useCreateAssessmentAttachment, useDeleteAssessmentAttachment, useAssessmentAttachments } from '@/hooks/api/useAssessmentAttachments';
import type { AssessmentAttachment } from '@/hooks/api/useAssessmentAttachments';

interface FileUploadProps {
  assessmentId: string;
  readonly?: boolean;
}

export function FileUpload({ assessmentId, readonly = false }: FileUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  
  const { data: attachments = [], isLoading } = useAssessmentAttachments(assessmentId);
  const createAttachment = useCreateAssessmentAttachment(assessmentId);
  const deleteAttachment = useDeleteAssessmentAttachment();
  const uploadFileMutation = useUploadAssessmentFile(assessmentId);

  const uploading = uploadFileMutation.isPending;
  const progress = uploading ? 50 : 0; // Backend upload has no progress events; show indeterminate-style

  const handleFileSelect = (files: File[] | null) => {
    if (!files || files.length === 0) return;
    setSelectedFiles((prev) => [...prev, ...files]);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    try {
      for (const file of selectedFiles) {
        const result = await uploadFileMutation.mutateAsync(file);
        if (result) {
          await createAttachment.mutateAsync({
            fileName: result.fileName,
            fileUrl: result.fileUrl,
            mimeType: result.mimeType || undefined,
            fileSizeBytes: result.fileSizeBytes,
          });
        }
      }
      setSelectedFiles([]);
    } catch {
      // Error already shown by upload mutation
    }
  };

  const handleDelete = async (attachmentId: string) => {
    if (confirm('Are you sure you want to delete this file?')) {
      await deleteAttachment.mutateAsync(attachmentId);
    }
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType?: string) => {
    if (!mimeType) return <IconFile size={20} />;
    if (mimeType.includes('pdf')) return <IconFile size={20} color="red" />;
    if (mimeType.includes('word') || mimeType.includes('document')) return <IconFile size={20} color="blue" />;
    if (mimeType.includes('image')) return <IconFile size={20} color="green" />;
    return <IconFile size={20} />;
  };

  return (
    <Stack gap="md">
      {!readonly && (
        <Paper p="md" withBorder>
          <Stack gap="md">
            <Text size="sm" fw={500}>
              Upload Assignment Materials
            </Text>
            <Alert variant="light" color="blue" icon={<IconInfoCircle size={16} />} title="Compression and limit">
              Images and videos are compressed when uploaded (images: max 1920px, 85% quality; videos: compressed). Total materials must be 10MB or less.
            </Alert>
            <Group>
              <FileButton
                onChange={handleFileSelect}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.txt,.mp4,.webm,.mov,.avi,.mkv"
                multiple
              >
                {(props) => (
                  <Button leftSection={<IconUpload size={16} />} {...props}>
                    Select Files
                  </Button>
                )}
              </FileButton>
              {selectedFiles.length > 0 && (
                <Button
                  onClick={handleUpload}
                  loading={uploading}
                  disabled={uploading}
                >
                  Upload {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}
                </Button>
              )}
            </Group>
            {selectedFiles.length > 0 && (
              <Stack gap="xs">
                {selectedFiles.map((file, index) => (
                  <Text key={index} size="xs" c="dimmed">
                    • {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </Text>
                ))}
              </Stack>
            )}
            {uploading && (
              <Stack gap="xs">
                <Progress value={progress} size="sm" />
                <Text size="xs" c="dimmed" ta="center">
                  {progress}% uploaded
                </Text>
              </Stack>
            )}
            <Text size="xs" c="dimmed">
              Supported: PDF, Word, Excel, PowerPoint, images, video (MP4, WebM, etc.), text. Total materials limit 10MB.
            </Text>
          </Stack>
        </Paper>
      )}

      {/* Existing Attachments */}
      {isLoading ? (
        <Text size="sm" c="dimmed">Loading attachments...</Text>
      ) : attachments.length > 0 ? (
        <Paper p="md" withBorder>
          <Text size="sm" fw={500} mb="md">
            Attached Files ({attachments.length})
          </Text>
          <Stack gap="xs">
            {attachments.map((attachment: AssessmentAttachment) => (
              <Group key={attachment.id} justify="space-between" p="xs" style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: '4px' }}>
                <Group gap="xs">
                  {getFileIcon(attachment.mimeType)}
                  <Stack gap={0}>
                    <Text size="sm">{attachment.fileName}</Text>
                    <Text size="xs" c="dimmed">
                      {formatFileSize(attachment.fileSizeBytes)}
                    </Text>
                  </Stack>
                </Group>
                <Group gap="xs">
                  <Tooltip label="Download">
                    <ActionIcon
                      variant="subtle"
                      onClick={() => window.open(attachment.fileUrl, '_blank')}
                    >
                      <IconDownload size={16} />
                    </ActionIcon>
                  </Tooltip>
                  {!readonly && (
                    <Tooltip label="Delete">
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => handleDelete(attachment.id)}
                        loading={deleteAttachment.isPending}
                      >
                        <IconX size={16} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Group>
              </Group>
            ))}
          </Stack>
        </Paper>
      ) : (
        <Text size="sm" c="dimmed">
          No files attached
        </Text>
      )}
    </Stack>
  );
}

