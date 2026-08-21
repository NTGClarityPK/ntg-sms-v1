import {
  IconAdjustments,
  IconBuilding,
  IconCash,
  IconChartBar,
  IconClock,
  IconDownload,
  IconMessage,
  IconPackage,
  IconPalette,
  IconPlugConnected,
  IconSchool,
  IconShield,
  type Icon,
} from '@tabler/icons-react';

export type SettingsSectionId =
  | 'business-information'
  | 'academic-years'
  | 'permissions'
  | 'schedule'
  | 'communication'
  | 'general'
  | 'inventory-management'
  | 'fees'
  | 'integrations'
  | 'theme-settings'
  | 'public-statistics'
  | 'data-export';

type SettingsLabelKey =
  | 'tabBusinessInformation'
  | 'tabAcademic'
  | 'tabPermissions'
  | 'tabSchedule'
  | 'tabCommunication'
  | 'tabGeneral'
  | 'tabInventoryManagement'
  | 'tabFees'
  | 'tabIntegrations'
  | 'tabThemeSettings'
  | 'tabPublicStatistics'
  | 'tabDataExport'
  | 'categorySchoolSetup'
  | 'categoryAcademic'
  | 'categoryOperations'
  | 'categoryFinance'
  | 'categoryAppearance'
  | 'categoryAccessControl';

export type SettingsCategoryId =
  | 'school-setup'
  | 'academic'
  | 'operations'
  | 'finance'
  | 'appearance'
  | 'access-control';

type VisibilityGate = 'always' | 'schoolAdmin' | 'dataExport' | 'feeManagement' | 'inventoryManagement';

export interface SettingsNavItem {
  value: SettingsSectionId;
  labelKey: SettingsLabelKey;
  icon: Icon;
  gate: VisibilityGate;
}

export interface SettingsNavCategory {
  id: SettingsCategoryId;
  labelKey: SettingsLabelKey;
  icon: Icon;
  items: SettingsNavItem[];
}

export interface SettingsVisibilityFlags {
  isSchoolAdmin: boolean;
  canDataExport: boolean;
  hasFeeManagement: boolean;
  hasInventoryManagement: boolean;
}

const SETTINGS_CATEGORIES: SettingsNavCategory[] = [
  {
    id: 'school-setup',
    labelKey: 'categorySchoolSetup',
    icon: IconBuilding,
    items: [
      { value: 'business-information', labelKey: 'tabBusinessInformation', icon: IconBuilding, gate: 'always' },
      { value: 'communication', labelKey: 'tabCommunication', icon: IconMessage, gate: 'always' },
      { value: 'general', labelKey: 'tabGeneral', icon: IconAdjustments, gate: 'always' },
    ],
  },
  {
    id: 'academic',
    labelKey: 'categoryAcademic',
    icon: IconSchool,
    items: [
      { value: 'academic-years', labelKey: 'tabAcademic', icon: IconSchool, gate: 'always' },
      { value: 'schedule', labelKey: 'tabSchedule', icon: IconClock, gate: 'always' },
    ],
  },
  {
    id: 'operations',
    labelKey: 'categoryOperations',
    icon: IconPackage,
    items: [
      { value: 'inventory-management', labelKey: 'tabInventoryManagement', icon: IconPackage, gate: 'inventoryManagement' },
      { value: 'integrations', labelKey: 'tabIntegrations', icon: IconPlugConnected, gate: 'always' },
      { value: 'data-export', labelKey: 'tabDataExport', icon: IconDownload, gate: 'dataExport' },
    ],
  },
  {
    id: 'finance',
    labelKey: 'categoryFinance',
    icon: IconCash,
    items: [
      { value: 'fees', labelKey: 'tabFees', icon: IconCash, gate: 'feeManagement' },
    ],
  },
  {
    id: 'appearance',
    labelKey: 'categoryAppearance',
    icon: IconPalette,
    items: [
      { value: 'theme-settings', labelKey: 'tabThemeSettings', icon: IconPalette, gate: 'always' },
      { value: 'public-statistics', labelKey: 'tabPublicStatistics', icon: IconChartBar, gate: 'schoolAdmin' },
    ],
  },
  {
    id: 'access-control',
    labelKey: 'categoryAccessControl',
    icon: IconShield,
    items: [
      { value: 'permissions', labelKey: 'tabPermissions', icon: IconShield, gate: 'always' },
    ],
  },
];

export const ALL_SETTINGS_SECTION_IDS: SettingsSectionId[] = SETTINGS_CATEGORIES.flatMap((g) =>
  g.items.map((i) => i.value),
);

export const DEFAULT_SETTINGS_SECTION: SettingsSectionId = 'business-information';

const SECTION_LABEL_KEYS: Record<SettingsSectionId, SettingsLabelKey> = Object.fromEntries(
  SETTINGS_CATEGORIES.flatMap((g) => g.items.map((i) => [i.value, i.labelKey])),
) as Record<SettingsSectionId, SettingsLabelKey>;

const SECTION_CATEGORY_MAP: Record<SettingsSectionId, SettingsCategoryId> = Object.fromEntries(
  SETTINGS_CATEGORIES.flatMap((category) => category.items.map((item) => [item.value, category.id])),
) as Record<SettingsSectionId, SettingsCategoryId>;

export function getSettingsSectionLabelKey(section: SettingsSectionId): SettingsLabelKey {
  return SECTION_LABEL_KEYS[section];
}

export function getSettingsCategoryForSection(section: SettingsSectionId): SettingsCategoryId {
  return SECTION_CATEGORY_MAP[section];
}

export function isSettingsSectionId(value: string | null | undefined): value is SettingsSectionId {
  return !!value && ALL_SETTINGS_SECTION_IDS.includes(value as SettingsSectionId);
}

function isItemVisible(
  gate: VisibilityGate,
  flags: SettingsVisibilityFlags,
): boolean {
  switch (gate) {
    case 'schoolAdmin':
      return flags.isSchoolAdmin;
    case 'dataExport':
      return flags.canDataExport;
    case 'feeManagement':
      return flags.hasFeeManagement;
    case 'inventoryManagement':
      return flags.hasInventoryManagement;
    default:
      return true;
  }
}

export function getVisibleSettingsCategories(
  flags: SettingsVisibilityFlags,
): SettingsNavCategory[] {
  return SETTINGS_CATEGORIES.map((category) => ({
    ...category,
    items: category.items.filter((item) => isItemVisible(item.gate, flags)),
  })).filter((category) => category.items.length > 0);
}

export function isSettingsSectionVisible(
  section: SettingsSectionId,
  flags: SettingsVisibilityFlags,
): boolean {
  const category = SETTINGS_CATEGORIES.find((item) =>
    item.items.some((navItem) => navItem.value === section),
  );
  const navItem = category?.items.find((item) => item.value === section);
  return navItem ? isItemVisible(navItem.gate, flags) : false;
}

export function getFirstVisibleSectionForCategory(
  categoryId: SettingsCategoryId,
  flags: SettingsVisibilityFlags,
): SettingsSectionId | null {
  const category = getVisibleSettingsCategories(flags).find((item) => item.id === categoryId);
  return category?.items[0]?.value ?? null;
}
