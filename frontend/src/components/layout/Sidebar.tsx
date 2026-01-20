'use client';

import { usePathname, useRouter } from 'next/navigation';
import { NavLink, Stack } from '@mantine/core';
import {
  IconHome,
  IconUsers,
  IconCalendar,
  IconChartBar,
  IconSettings,
  type IconProps,
} from '@tabler/icons-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<IconProps>;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: IconHome },
  { label: 'Students', href: '/dashboard/students', icon: IconUsers },
  { label: 'Attendance', href: '/dashboard/attendance', icon: IconCalendar },
  { label: 'Reports', href: '/dashboard/reports', icon: IconChartBar },
  { label: 'Settings', href: '/settings', icon: IconSettings },
];

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <Stack gap="xs">
      {navItems.map((item) => (
        <NavLink
          key={item.href}
          label={item.label}
          leftSection={<item.icon size={20} />}
          active={pathname === item.href}
          onClick={() => router.push(item.href)}
        />
      ))}
    </Stack>
  );
}

