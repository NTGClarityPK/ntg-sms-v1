'use client';

import { usePathname, useRouter } from 'next/navigation';
import { NavLink, Stack } from '@mantine/core';
import {
  IconHome,
  IconUsers,
  IconCalendar,
  IconChartBar,
  IconSettings,
  IconUsersGroup,
  IconUserCheck,
  IconCalendarEvent,
  type IconProps,
} from '@tabler/icons-react';
import { useAuth } from '@/hooks/useAuth';
import type { User } from '@/types/auth';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<IconProps>;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: IconHome },
  { label: 'Users', href: '/users', icon: IconUsers },
  { label: 'Students', href: '/students', icon: IconUsers },
  { label: 'Staff', href: '/staff', icon: IconUsers },
  { label: 'Class Sections', href: '/academic/class-sections', icon: IconUsersGroup },
  { label: 'Teacher Mapping', href: '/academic/teacher-mapping', icon: IconUserCheck },
  { label: 'Attendance', href: '/attendance', icon: IconCalendar },
  { label: 'Reports', href: '/reports', icon: IconChartBar },
  { label: 'Settings', href: '/settings', icon: IconSettings },
];

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const userTyped = user as User | undefined;

  // Check if user has teacher roles (class_teacher or subject_teacher)
  const hasTeacherRole = userTyped?.roles?.some(
    (r) => r.roleName === 'class_teacher' || r.roleName === 'subject_teacher'
  );

  return (
    <Stack gap="xs">
      {navItems.map((item) => {
        // Check if pathname starts with the href for nested routes
        const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
        return (
          <NavLink
            key={item.href}
            label={item.label}
            leftSection={<item.icon size={20} />}
            active={isActive}
            onClick={() => router.push(item.href)}
          />
        );
      })}
      {hasTeacherRole && (
        <NavLink
          label="My Schedule"
          leftSection={<IconCalendarEvent size={20} />}
          active={pathname === '/my-schedule' || pathname?.startsWith('/my-schedule/')}
          onClick={() => router.push('/my-schedule')}
        />
      )}
    </Stack>
  );
}

