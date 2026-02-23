'use client';

import { Select } from '@mantine/core';
import type { User } from '@/types/auth';

function formatRoleLabel(roleName: string): string {
  const formatted = roleName
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
  return formatted;
}

interface RoleSwitcherProps {
  user: User | undefined;
  selectedRoleId: string | undefined;
  onRoleChange: (roleId: string) => void;
  disabled?: boolean;
}

export function RoleSwitcher({
  user,
  selectedRoleId,
  onRoleChange,
  disabled,
}: RoleSwitcherProps) {
  const roles = user?.roles ?? [];
  if (roles.length <= 1) return null;

  const options = roles.map((r) => ({
    value: r.roleId,
    label: formatRoleLabel(r.roleName),
  }));

  const value = selectedRoleId && options.some((o) => o.value === selectedRoleId)
    ? selectedRoleId
    : options[0]?.value ?? null;

  return (
    <Select
      size="sm"
      w={180}
      data={options}
      value={value}
      onChange={(v) => v && onRoleChange(v)}
      disabled={disabled}
      allowDeselect={false}
    />
  );
}
