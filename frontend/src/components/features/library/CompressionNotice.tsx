'use client';

import { Alert, Text } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';

/**
 * Informs users that images are automatically compressed on upload
 * to save storage (max width 1920px, 85% quality).
 */
export function CompressionNotice() {
  return (
    <Alert color="blue" icon={<IconInfoCircle size={16} />} title="Image compression">
      <Text size="sm">
        Image files (JPG, PNG, WebP) are automatically compressed when uploaded to save storage:
        max width 1920px, 85% quality. PDFs and documents are stored as-is.
      </Text>
    </Alert>
  );
}
