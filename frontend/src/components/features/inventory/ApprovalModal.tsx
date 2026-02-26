'use client';

import { Modal, Textarea, Button, Stack, Group } from '@mantine/core';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('inventory');
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
      title={mode === 'approve' ? t('approveRequest') : t('rejectRequest')}
    >
      {request && (
        <Stack gap="md">
          <Textarea
            id="approval-modal-notes"
            label={t('notesOptional')}
            placeholder={
              mode === 'approve'
                ? t('notesPlaceholderApprove')
                : t('notesPlaceholderReject')
            }
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button id="approval-modal-cancel" variant="default" onClick={handleClose}>
              {t('cancel')}
            </Button>
            <Button
              id={mode === 'approve' ? 'approval-modal-approve' : 'approval-modal-reject'}
              color={mode === 'approve' ? 'green' : 'red'}
              loading={isPending}
              onClick={handleConfirm}
            >
              {mode === 'approve' ? t('approve') : t('reject')}
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
