'use client';

import { Modal, Textarea, Button, Stack, Group } from '@mantine/core';
import { useState } from 'react';
import type { UniformRequest } from '@/types/inventory';

interface ApprovalModalProps {
  opened: boolean;
  onClose: () => void;
  request: UniformRequest | null;
  mode: 'approve' | 'reject';
  onConfirm: (id: string, notes?: string) => void;
  isPending?: boolean;
}

export function ApprovalModal({
  opened,
  onClose,
  request,
  mode,
  onConfirm,
  isPending,
}: ApprovalModalProps) {
  const [notes, setNotes] = useState('');

  const handleConfirm = () => {
    if (!request) return;
    onConfirm(request.id, notes.trim() || undefined);
    setNotes('');
  };

  const handleClose = () => {
    setNotes('');
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={mode === 'approve' ? 'Approve request' : 'Reject request'}
    >
      {request && (
        <Stack gap="md">
          <Textarea
            label="Notes (optional)"
            placeholder={
              mode === 'approve'
                ? 'Add a note for the parent...'
                : 'Reason for rejection...'
            }
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              color={mode === 'approve' ? 'green' : 'red'}
              loading={isPending}
              onClick={handleConfirm}
            >
              {mode === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
