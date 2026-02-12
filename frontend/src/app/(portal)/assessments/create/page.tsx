'use client';

/**
 * Create Assessment Page
 */

import { useState, useEffect } from 'react';
import { Title, Paper, Button, Group, Stack } from '@mantine/core';
import { useRouter } from 'next/navigation';
import { AssessmentForm } from '@/components/assessments/AssessmentForm';
import { useCreateAssessment } from '@/hooks/api/useAssessments';
import { useFeaturePermission } from '@/hooks/usePermissions';
import { supabase } from '@/lib/supabase/client';
import type { CreateAssessmentInput, UpdateAssessmentInput } from '@/types/assessment';

export default function CreateAssessmentPage() {
  const router = useRouter();
  const { canEdit } = useFeaturePermission('assessment');
  const createAssessment = useCreateAssessment();

  useEffect(() => {
    if (!canEdit) router.replace('/assessments');
  }, [canEdit, router]);
  const [filesToUpload, setFilesToUpload] = useState<File[]>([]);

  const handleSubmit = async (values: CreateAssessmentInput | UpdateAssessmentInput) => {
    createAssessment.mutate(values as CreateAssessmentInput, {
      onSuccess: async (assessment) => {
        // useCreateAssessment mutationFn currently returns ApiResponse<Assessment>
        const assessmentId = assessment?.data?.id;
        if (!assessmentId) {
          console.error('[CreateAssessmentPage] Missing assessmentId in create response:', assessment);
          return;
        }
        
        // Upload files if any were selected during creation
        if (filesToUpload.length > 0) {
          // Import API client to create attachments
          const { apiClient } = await import('@/lib/api-client');
          
          for (const file of filesToUpload) {
            try {
              // Upload file to the correct path
              const timestamp = Date.now();
              const randomStr = Math.random().toString(36).substring(2, 15);
              const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
              const fileName = `${timestamp}-${randomStr}-${sanitizedFileName}`;
              const filePath = `assessments/${assessmentId}/${fileName}`;
              
              // Upload to Supabase Storage
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
              
              // Get public URL
              const { data: { publicUrl } } = supabase.storage
                .from('assessment-files')
                .getPublicUrl(filePath);
              
              // Create attachment record via API
              await apiClient.post(`/api/v1/assessments/${assessmentId}/attachments`, {
                fileName: file.name,
                fileUrl: publicUrl,
                mimeType: file.type || undefined,
              });
            } catch (error) {
              console.error('Error uploading file:', error);
            }
          }
        }
        
        // Redirect to edit page where user can see uploaded files
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
              isLoading={createAssessment.isPending}
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

