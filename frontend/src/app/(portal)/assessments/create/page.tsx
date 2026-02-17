'use client';

/**
 * Create Assessment Page
 * Submit creates the assessment, then uploads any selected files and redirects to edit.
 */

import { useState, useEffect } from 'react';
import { Title, Paper, Button, Group, Stack } from '@mantine/core';
import { useRouter } from 'next/navigation';
import { AssessmentForm } from '@/components/assessments/AssessmentForm';
import { useCreateAssessment } from '@/hooks/api/useAssessments';
import { useFeaturePermission } from '@/hooks/usePermissions';
import { supabase } from '@/lib/supabase/client';
import { notifications } from '@mantine/notifications';
import type { CreateAssessmentInput, UpdateAssessmentInput } from '@/types/assessment';
import type { Assessment } from '@/types/assessment';

export default function CreateAssessmentPage() {
  const router = useRouter();
  const { canEdit } = useFeaturePermission('assessment');
  const createAssessment = useCreateAssessment();
  const [filesToUpload, setFilesToUpload] = useState<File[]>([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);

  useEffect(() => {
    if (!canEdit) router.replace('/assessments');
  }, [canEdit, router]);

  const handleSubmit = async (values: CreateAssessmentInput | UpdateAssessmentInput) => {
    createAssessment.mutate(values as CreateAssessmentInput, {
      onSuccess: async (response) => {
        // Hook returns response.data from API; API is { data: Assessment }
        const assessment = (response as { data?: Assessment })?.data ?? (response as Assessment);
        const assessmentId = assessment?.id;
        if (!assessmentId) {
          console.error('[CreateAssessmentPage] Missing assessmentId in create response:', response);
          notifications.show({
            title: 'Error',
            message: 'Assessment was created but could not load its ID. Please go to Assessments list.',
            color: 'red',
          });
          router.push('/assessments');
          return;
        }

        if (filesToUpload.length > 0) {
          setIsUploadingFiles(true);
          const { apiClient } = await import('@/lib/api-client');
          let uploaded = 0;
          for (const file of filesToUpload) {
            try {
              const timestamp = Date.now();
              const randomStr = Math.random().toString(36).substring(2, 15);
              const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
              const fileName = `${timestamp}-${randomStr}-${sanitizedFileName}`;
              const filePath = `assessments/${assessmentId}/${fileName}`;

              const { error: uploadError } = await supabase.storage
                .from('assessment-files')
                .upload(filePath, file, {
                  cacheControl: '3600',
                  upsert: false,
                });

              if (uploadError) {
                console.error('Upload error:', uploadError);
                continue;
              }

              const { data: { publicUrl } } = supabase.storage
                .from('assessment-files')
                .getPublicUrl(filePath);

              await apiClient.post(`/api/v1/assessments/${assessmentId}/attachments`, {
                fileName: file.name,
                fileUrl: publicUrl,
                mimeType: file.type || undefined,
              });
              uploaded += 1;
            } catch (error) {
              console.error('Error uploading file:', error);
            }
          }
          setIsUploadingFiles(false);
          if (uploaded > 0) {
            notifications.show({
              title: 'Files uploaded',
              message: `${uploaded} file(s) uploaded.`,
              color: 'green',
            });
          }
        }

        router.push(`/assessments/${assessmentId}/edit`);
      },
    });
  };

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Create Assessment</Title>
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
          <Paper p="md" withBorder>
            <AssessmentForm
              onSubmit={handleSubmit}
              isLoading={createAssessment.isPending || isUploadingFiles}
              filesToUpload={filesToUpload}
              onFilesChange={setFilesToUpload}
            />
          </Paper>

          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => router.back()}>
              Cancel
            </Button>
          </Group>
        </Stack>
      </div>
    </>
  );
}

