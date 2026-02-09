'use client';

/**
 * File Upload Component for Assessments
 */

import { useState } from 'react';
import { Button, Group, Stack, Text, FileButton, Paper, Progress, ActionIcon, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconUpload, IconX, IconFile, IconDownload } from '@tabler/icons-react';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useCreateAssessmentAttachment, useDeleteAssessmentAttachment, useAssessmentAttachments } from '@/hooks/api/useAssessmentAttachments';
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

  const { uploadFile, uploading, progress } = useFileUpload({
    bucket: 'assessment-files',
    folder: `assessments/${assessmentId}`,
    maxSizeMB: 50, // 50MB max
    allowedTypes: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'gif', 'txt'],
  });

  const handleFileSelect = (files: File[] | null) => {
    if (!files || files.length === 0) return;
    setSelectedFiles((prev) => [...prev, ...files]);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    try {
      for (const file of selectedFiles) {
        console.log('[FileUpload] Uploading file:', file.name);
        const result = await uploadFile(file);
        console.log('[FileUpload] Upload result:', result);
        
        if (result) {
          console.log('[FileUpload] Creating attachment record...');
          await createAttachment.mutateAsync({
            fileName: result.fileName,
            fileUrl: result.url,
            mimeType: file.type || undefined,
          });
          console.log('[FileUpload] Attachment created successfully');
        } else {
          console.error('[FileUpload] Upload failed for file:', file.name);
        }
      }
      setSelectedFiles([]);
    } catch (error: any) {
      console.error('[FileUpload] Error during upload:', error);
      notifications.show({
        title: 'Upload Error',
        message: error.message || 'Failed to upload files. Please check console for details.',
        color: 'red',
      });
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
              Supported formats: PDF, Word, Excel, PowerPoint, Images, Text files (Max 50MB per file)
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

