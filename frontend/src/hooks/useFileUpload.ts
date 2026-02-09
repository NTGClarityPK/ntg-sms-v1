'use client';

/**
 * Hook for uploading files to Supabase Storage
 */

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { notifications } from '@mantine/notifications';

export interface FileUploadResult {
  url: string;
  path: string;
  fileName: string;
}

export interface UseFileUploadOptions {
  bucket: string;
  folder?: string;
  maxSizeMB?: number;
  allowedTypes?: string[];
}

export function useFileUpload(options: UseFileUploadOptions) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const uploadFile = async (file: File): Promise<FileUploadResult | null> => {
    // Validate file size
    const maxSizeBytes = (options.maxSizeMB || 10) * 1024 * 1024; // Default 10MB
    if (file.size > maxSizeBytes) {
      notifications.show({
        title: 'File too large',
        message: `File size must be less than ${options.maxSizeMB || 10}MB`,
        color: 'red',
      });
      return null;
    }

    // Validate file type
    if (options.allowedTypes && options.allowedTypes.length > 0) {
      const fileType = file.type || '';
      const isValidType = options.allowedTypes.some(
        (type) => fileType.includes(type) || file.name.toLowerCase().endsWith(type.toLowerCase()),
      );
      if (!isValidType) {
        notifications.show({
          title: 'Invalid file type',
          message: `Allowed types: ${options.allowedTypes.join(', ')}`,
          color: 'red',
        });
        return null;
      }
    }

    setUploading(true);
    setProgress(0);

    try {
      // Check if user is authenticated
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('You must be logged in to upload files');
      }
      console.log('[useFileUpload] User authenticated:', session.user.id);
      console.log('[useFileUpload] Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
      
      // Note: We skip bucket existence check because listBuckets() may fail due to permissions
      // even if the bucket exists. We'll try to upload directly and handle errors accordingly.

      // Generate unique file name
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 15);
      const fileExtension = file.name.split('.').pop();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${timestamp}-${randomStr}-${sanitizedFileName}`;
      const filePath = options.folder ? `${options.folder}/${fileName}` : fileName;

      // Upload file to Supabase Storage
      console.log('[useFileUpload] Uploading to bucket:', options.bucket, 'path:', filePath, 'file size:', file.size);
      const { data, error } = await supabase.storage.from(options.bucket).upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

      if (error) {
        console.error('[useFileUpload] Upload error details:', {
          message: error.message,
          error: error,
        });
        throw new Error(`Upload failed: ${error.message}`);
      }

      if (!data) {
        throw new Error('Upload returned no data');
      }

      console.log('[useFileUpload] Upload successful, data:', data);

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from(options.bucket).getPublicUrl(filePath);
      console.log('[useFileUpload] Public URL:', publicUrl);

      setProgress(100);
      setUploading(false);

      return {
        url: publicUrl,
        path: filePath,
        fileName: file.name,
      };
    } catch (error: any) {
      setUploading(false);
      setProgress(0);
      const errorMessage = error.message || 'Failed to upload file';
      console.error('[useFileUpload] Final error:', errorMessage, error);
      notifications.show({
        title: 'Upload failed',
        message: errorMessage,
        color: 'red',
      });
      return null;
    }
  };

  const deleteFile = async (filePath: string): Promise<boolean> => {
    try {
      const { error } = await supabase.storage.from(options.bucket).remove([filePath]);
      if (error) {
        throw error;
      }
      return true;
    } catch (error: any) {
      notifications.show({
        title: 'Delete failed',
        message: error.message || 'Failed to delete file',
        color: 'red',
      });
      return false;
    }
  };

  return {
    uploadFile,
    deleteFile,
    uploading,
    progress,
  };
}

