'use client';

import { useState } from 'react';
import { Modal, Stack, Text, Select, Button } from '@mantine/core';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

interface Branch {
  id: string;
  name: string;
  code: string;
}

interface BranchSelectionModalProps {
  opened: boolean;
  branches: Branch[];
  onSelect: (branchId: string) => void;
  loading?: boolean;
}

export function BranchSelectionModal({
  opened,
  branches,
  onSelect,
  loading = false,
}: BranchSelectionModalProps) {
  const colors = useThemeColors();
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(
    branches.length > 0 ? branches[0].id : null,
  );

  const handleContinue = () => {
    if (selectedBranchId) {
      onSelect(selectedBranchId);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={() => {}} // Cannot close without selection
      title="Select Branch"
      closeOnClickOutside={false}
      closeOnEscape={false}
      withCloseButton={false}
      centered
      size="md"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Please select a branch to continue
        </Text>

        <Select
          label="Branch"
          placeholder="Select a branch"
          data={branches.map((b) => ({
            value: b.id,
            label: `${b.name} (${b.code})`,
          }))}
          value={selectedBranchId}
          onChange={(value) => setSelectedBranchId(value)}
          required
          searchable
          size="md"
        />

        <Button
          fullWidth
          onClick={handleContinue}
          disabled={!selectedBranchId}
          loading={loading}
          size="lg"
          style={{
            backgroundColor: colors.primary,
            color: 'white',
          }}
        >
          Continue
        </Button>
      </Stack>
    </Modal>
  );
}

