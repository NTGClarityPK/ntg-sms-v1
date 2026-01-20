'use client';

import { Button } from '@mantine/core';
import { IconLanguage } from '@tabler/icons-react';

interface LanguageSelectorProps {
  size?: string;
}

export function LanguageSelector({ size = 'sm' }: LanguageSelectorProps) {
  return (
    <Button
      variant="subtle"
      leftSection={<IconLanguage size={16} />}
      size={size as any}
      style={{
        fontWeight: 500,
      }}
    >
      EN
    </Button>
  );
}

