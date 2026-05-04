'use client';

import type { CSSProperties } from 'react';
import { Modal, Image, Box } from '@mantine/core';
import { useState } from 'react';
import { IconX } from '@tabler/icons-react';

interface ImageLightboxProps {
  src: string;
  alt: string;
  children: React.ReactNode;
  /** Merged onto the clickable wrapper so children can fill grid/flex parents (e.g. height: '100%'). */
  wrapperStyle?: CSSProperties;
}

export function ImageLightbox({ src, alt, children, wrapperStyle }: ImageLightboxProps) {
  const [opened, setOpened] = useState(false);

  return (
    <>
      <Box
        onClick={() => setOpened(true)}
        style={{
          cursor: 'pointer',
          transition: 'transform 0.2s ease',
          ...wrapperStyle,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.02)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        {children}
      </Box>

      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        size="auto"
        centered
        padding={0}
        withCloseButton={false}
        closeOnClickOutside={true}
        closeOnEscape={true}
        overlayProps={{
          backgroundOpacity: 0.85,
          blur: 3,
        }}
        styles={{
          body: {
            padding: 0,
          },
          content: {
            backgroundColor: 'transparent',
            boxShadow: 'none',
          },
        }}
      >
        <Box
          style={{
            position: 'relative',
            maxWidth: '95vw',
            maxHeight: '95vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Image
            src={src}
            alt={alt}
            fit="contain"
            style={{
              maxWidth: '100%',
              maxHeight: '95vh',
              objectFit: 'contain',
            }}
          />
          <Box
            onClick={() => setOpened(false)}
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              width: 40,
              height: 40,
              borderRadius: '50%',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'white',
              transition: 'background-color 0.2s ease',
              zIndex: 1000,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            }}
          >
            <IconX size={24} />
          </Box>
        </Box>
      </Modal>
    </>
  );
}
