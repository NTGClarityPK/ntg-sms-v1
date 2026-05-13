import type { ComponentType } from 'react';
import type { IconProps } from '@tabler/icons-react';

/** Sidebar navigation entry (shared by Sidebar + collapsed flyouts). */
export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: ComponentType<IconProps>;
  showCondition?: () => boolean;
}
