'use client';

import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Paper, Stack, Text } from '@mantine/core';
import { CertificateLivePreviewSkeleton } from '@/components/features/certificates/CertificateSkeletons';

/** A4 dimensions at 96dpi for scaled iframe preview. */
const LANDSCAPE_W = 1123;
const LANDSCAPE_H = 794;
const PORTRAIT_W = 794;
const PORTRAIT_H = 1123;

type Props = {
  html: string;
  loading: boolean;
  isLandscape: boolean;
  title: string;
  emptyLabel: string;
  errorMessage?: string | null;
};

export function CertificateLivePreview({
  html,
  loading,
  isLandscape,
  title,
  emptyLabel,
  errorMessage,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const baseW = isLandscape ? LANDSCAPE_W : PORTRAIT_W;
  const baseH = isLandscape ? LANDSCAPE_H : PORTRAIT_H;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(w / baseW);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [baseW]);

  const frameHeight = Math.ceil(baseH * scale);

  if (loading) {
    return <CertificateLivePreviewSkeleton isLandscape={isLandscape} />;
  }

  return (
    <Stack gap="xs" id="cert-issue-preview">
      <Text size="sm" fw={600}>
        {title}
      </Text>
      {errorMessage ? (
        <Alert color="red" variant="light">
          {errorMessage}
        </Alert>
      ) : null}
      <Paper withBorder radius="md" p="xs">
        <Box ref={containerRef} w="100%" style={{ height: frameHeight, overflow: 'hidden' }}>
          {html ? (
            <Box
              component="iframe"
              title={title}
              srcDoc={html}
              style={{
                width: baseW,
                height: baseH,
                border: 0,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                display: 'block',
              }}
            />
          ) : (
            <Text p="md" c="dimmed">
              {emptyLabel}
            </Text>
          )}
        </Box>
      </Paper>
    </Stack>
  );
}
