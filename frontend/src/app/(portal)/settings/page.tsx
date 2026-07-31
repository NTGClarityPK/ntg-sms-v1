'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Box, Button, Group, Stack, Text, Title, Skeleton, Alert, Tabs, Paper, TextInput, Grid, Select, Modal, Checkbox } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconRocket, IconCopy, IconSchool, IconPlus, IconRefresh, IconFileImport } from '@tabler/icons-react';
import { useSettingsStatus } from '@/hooks/useSettingsStatus';
import { useTenantBranches } from '@/hooks/useBranches';
import { SetupWizard } from '@/components/features/settings/SetupWizard';
import { CopySettingsModal } from '@/components/features/settings/CopySettingsModal';
import {
  DEFAULT_SETTINGS_SECTION,
  getFirstVisibleSectionForCategory,
  getSettingsCategoryForSection,
  getVisibleSettingsCategories,
  isSettingsSectionId,
  isSettingsSectionVisible,
  type SettingsCategoryId,
  type SettingsSectionId,
} from '@/components/features/settings/SettingsSectionNav';
import { useSaveSetupWizard } from '@/hooks/useSetupWizard';
import { useThemeColors, useNotificationColors } from '@/lib/hooks/use-theme-colors';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { notifications } from '@mantine/notifications';

// Import components for each tab
import { PermissionMatrix } from '@/components/features/settings/PermissionMatrix';
import { RoleAccessSummary } from '@/components/features/settings/RoleAccessSummary';
import { usePermissions } from '@/hooks/usePermissions';
import { useRoles, useFeatures } from '@/hooks/useRoles';

import { AcademicYearForm, type AcademicYearFormValues } from '@/components/features/settings/AcademicYearForm';
import { AcademicYearCard } from '@/components/features/settings/AcademicYearCard';
import { useAcademicYearsList, useActivateAcademicYear, useCreateAcademicYear, useLockAcademicYear, useRolloverAcademicYear } from '@/hooks/useAcademicYears';
import { modals } from '@mantine/modals';
import type { AcademicYear } from '@/types/settings';

import { SubjectList } from '@/components/features/settings/SubjectList';
import { ClassList } from '@/components/features/settings/ClassList';
import { SectionList } from '@/components/features/settings/SectionList';
import { LevelManager } from '@/components/features/settings/LevelManager';

import { SchoolDaysSelector } from '@/components/features/settings/SchoolDaysSelector';
import { TimingTemplateForm, type TimingTemplateFormValues } from '@/components/features/settings/TimingTemplateForm';
import { TimingTemplateCard } from '@/components/features/settings/TimingTemplateCard';
import { HolidayCalendar } from '@/components/features/settings/HolidayCalendar';
import { VacationManager } from '@/components/features/settings/VacationManager';
import { useClasses } from '@/hooks/useCoreLookups';
import { useActiveAcademicYear } from '@/hooks/useAcademicYears';
import {
  useAssignClassesToTimingTemplate,
  useCreatePublicHoliday,
  useCreateTimingTemplate,
  useDeletePublicHoliday,
  usePublicHolidays,
  useSchoolDays,
  useTimingTemplates,
  useUpdatePublicHoliday,
  useUpdateSchoolDays,
} from '@/hooks/useScheduleSettings';

import { AssessmentTypeList } from '@/components/features/settings/AssessmentTypeList';
import { GradeTemplateBuilder } from '@/components/features/settings/GradeTemplateBuilder';
import { LeaveQuotaSetting } from '@/components/features/settings/LeaveQuotaSetting';

import { CommunicationSettings } from '@/components/features/settings/CommunicationSettings';
import { LibraryCategoryEditor } from '@/components/features/settings/LibraryCategoryEditor';
import { InventoryCategoryEditor } from '@/components/features/settings/InventoryCategoryEditor';
import { InventorySizeEditor } from '@/components/features/settings/InventorySizeEditor';

import { BehaviorSettings } from '@/components/features/settings/BehaviorSettings';
import { useTenantMe, useUpdateTenantMe } from '@/hooks/useTenant';
import { useBranchById, useUpdateBranch } from '@/hooks/useBranches';
import { TranslatableInput, type TranslatableValue } from '@/components/common/TranslatableInput';
import { SubjectTemplatesTabContent } from '@/components/features/settings/SubjectTemplatesTabContent';
import { ThemeSettingsPanel } from '@/components/features/settings/ThemeSettingsPanel';
import { PublicStatsSettings } from '@/components/features/settings/PublicStatsSettings';
import { BulkSetupTabContent } from '@/components/features/settings/BulkSetupTabContent';
import { FeeSettingsTabContent } from '@/components/features/settings/FeeSettingsTabContent';
import { ResultReportsSettingsTabContent } from '@/components/features/settings/ResultReportsSettingsTabContent';
import { DataExportTabContent } from '@/components/features/settings/DataExportTabContent';
import { IntegrationsTabContent } from '@/components/features/settings/IntegrationsTabContent';

// Common timezones list with GMT offsets (matching RMS)
const TIMEZONE_DATA = [
  { value: 'Asia/Baghdad', label: 'Asia/Baghdad', country: 'Iraq' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai', country: 'UAE' },
  { value: 'Asia/Riyadh', label: 'Asia/Riyadh', country: 'Saudi Arabia' },
  { value: 'Asia/Kuwait', label: 'Asia/Kuwait', country: 'Kuwait' },
  { value: 'Asia/Qatar', label: 'Asia/Qatar', country: 'Qatar' },
  { value: 'Asia/Tehran', label: 'Asia/Tehran', country: 'Iran' },
  { value: 'Asia/Beirut', label: 'Asia/Beirut', country: 'Lebanon' },
  { value: 'Asia/Amman', label: 'Asia/Amman', country: 'Jordan' },
  { value: 'Asia/Damascus', label: 'Asia/Damascus', country: 'Syria' },
  { value: 'Asia/Jerusalem', label: 'Asia/Jerusalem', country: 'Israel' },
  { value: 'Europe/London', label: 'Europe/London', country: 'UK' },
  { value: 'Europe/Paris', label: 'Europe/Paris', country: 'France' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin', country: 'Germany' },
  { value: 'Europe/Rome', label: 'Europe/Rome', country: 'Italy' },
  { value: 'Europe/Madrid', label: 'Europe/Madrid', country: 'Spain' },
  { value: 'America/New_York', label: 'America/New_York', country: 'US Eastern' },
  { value: 'America/Chicago', label: 'America/Chicago', country: 'US Central' },
  { value: 'America/Denver', label: 'America/Denver', country: 'US Mountain' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles', country: 'US Pacific' },
  { value: 'America/Toronto', label: 'America/Toronto', country: 'Canada' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo', country: 'Japan' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai', country: 'China' },
  { value: 'Asia/Hong_Kong', label: 'Asia/Hong_Kong', country: 'Hong Kong' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore', country: 'Singapore' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata', country: 'India' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney', country: 'Australia' },
  { value: 'Australia/Melbourne', label: 'Australia/Melbourne', country: 'Australia' },
];

// Function to get GMT offset for a timezone
const getGMTOffset = (timezone: string): number => {
  try {
    const now = new Date();
    const utcFormatter = new Intl.DateTimeFormat('en', {
      timeZone: 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const tzFormatter = new Intl.DateTimeFormat('en', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    
    const utcParts = utcFormatter.formatToParts(now);
    const tzParts = tzFormatter.formatToParts(now);
    
    const utcHour = parseInt(utcParts.find(p => p.type === 'hour')?.value || '0', 10);
    const utcMinute = parseInt(utcParts.find(p => p.type === 'minute')?.value || '0', 10);
    const tzHour = parseInt(tzParts.find(p => p.type === 'hour')?.value || '0', 10);
    const tzMinute = parseInt(tzParts.find(p => p.type === 'minute')?.value || '0', 10);
    
    const utcMinutes = utcHour * 60 + utcMinute;
    const tzMinutes = tzHour * 60 + tzMinute;
    let offsetMinutes = tzMinutes - utcMinutes;
    
    if (Math.abs(offsetMinutes) > 12 * 60) {
      if (offsetMinutes > 0) {
        offsetMinutes -= 24 * 60;
      } else {
        offsetMinutes += 24 * 60;
      }
    }
    
    return offsetMinutes / 60;
  } catch {
    return 0;
  }
};

// Function to format GMT offset as string
const formatGMTOffset = (offset: number): string => {
  const sign = offset >= 0 ? '+' : '-';
  const hours = Math.floor(Math.abs(offset));
  const minutes = Math.round((Math.abs(offset) - hours) * 60);
  return `GMT${sign}${hours}:${minutes.toString().padStart(2, '0')}`;
};

// Generate timezones with GMT offsets, sorted by offset
const getTimezones = () => {
  return TIMEZONE_DATA.map(tz => {
    const offset = getGMTOffset(tz.value);
    const offsetStr = formatGMTOffset(offset);
    return {
      value: tz.value,
      label: `${tz.label} (${offsetStr})${tz.country ? ` - ${tz.country}` : ''}`,
      offset,
    };
  }).sort((a, b) => a.offset - b.offset);
};

export default function SettingsPage() {
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();
  const tSettings = useTranslations('settings');
  const { user, isLoading: isLoadingAuth } = useAuth();
  const router = useRouter();
  const pathname = usePathname() ?? '/settings';
  const searchParams = useSearchParams();
  const sectionFromUrl = searchParams?.get('section');
  const [wizardOpened, { open: openWizard, close: closeWizard }] = useDisclosure(false);
  const [copyModalOpened, { open: openCopyModal, close: closeCopyModal }] = useDisclosure(false);
  const [activeTab, setActiveTab] = useState<string | null>(
    isSettingsSectionId(sectionFromUrl) ? sectionFromUrl : DEFAULT_SETTINGS_SECTION,
  );
  const [showBulkImportPanel, setShowBulkImportPanel] = useState(false);
  const statusQuery = useSettingsStatus();
  const branchesQuery = useTenantBranches();
  const saveWizard = useSaveSetupWizard();
  const qc = useQueryClient();

  const hasCurrentBranch = !!user?.currentBranch?.id;
  const isSchoolAdmin = user?.roles?.some((r) => r.roleName?.toLowerCase() === 'school_admin') || false;
  const canDataExport =
    user?.roles?.some((r) =>
      ['school_admin'].includes((r.roleName ?? '').toLowerCase()),
    ) || false;
  const canManageResultReports =
    user?.roles?.some((r) =>
      ['school_admin', 'principal'].includes((r.roleName ?? '').toLowerCase()),
    ) || false;
  const settingsVisibility = useMemo(
    () => ({
      canManageResultReports,
      isSchoolAdmin,
      canDataExport,
    }),
    [canManageResultReports, isSchoolAdmin, canDataExport],
  );
  const visibleCategories = useMemo(
    () => getVisibleSettingsCategories(settingsVisibility),
    [settingsVisibility],
  );
  const activeCategory = isSettingsSectionId(activeTab)
    ? getSettingsCategoryForSection(activeTab)
    : getSettingsCategoryForSection(DEFAULT_SETTINGS_SECTION);

  useEffect(() => {
    if (isSettingsSectionId(sectionFromUrl) && sectionFromUrl !== activeTab) {
      setActiveTab(sectionFromUrl);
    }
  }, [sectionFromUrl]);

  useEffect(() => {
    if (isSettingsSectionId(activeTab) && !isSettingsSectionVisible(activeTab, settingsVisibility)) {
      const fallbackSection =
        getFirstVisibleSectionForCategory(getSettingsCategoryForSection(activeTab), settingsVisibility) ??
        DEFAULT_SETTINGS_SECTION;
      setActiveTab(fallbackSection);
      if (fallbackSection === DEFAULT_SETTINGS_SECTION) {
        router.replace(pathname, { scroll: false });
        return;
      }
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.set('section', fallbackSection);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [activeTab, pathname, router, searchParams, settingsVisibility]);

  const handleSectionChange = (value: SettingsSectionId) => {
    setActiveTab(value);
    if (value === DEFAULT_SETTINGS_SECTION) {
      router.replace(pathname, { scroll: false });
      return;
    }
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('section', value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleCategoryChange = (value: string | null) => {
    const nextCategory = value as SettingsCategoryId | null;
    if (!nextCategory) return;
    const nextSection = getFirstVisibleSectionForCategory(nextCategory, settingsVisibility);
    if (nextSection) {
      handleSectionChange(nextSection);
    }
  };
  const settingsStatusData = statusQuery.data?.data;
  const isInitialized = settingsStatusData?.isInitialized ?? false;
  const tabbedScreenReady = settingsStatusData?.tabbedScreenReady ?? isInitialized;
  const branches = branchesQuery.data?.data ?? [];
  const hasMultipleBranches = branches.length > 1;
  const hasSettingsStatusData = !!settingsStatusData; // Only show buttons when we have actual data

  const handleWizardComplete = async () => {
    await qc.invalidateQueries({ queryKey: ['settingsStatus'] });
    closeWizard();
  };

  const handleCopySuccess = () => {
    void qc.invalidateQueries({ queryKey: ['settingsStatus'] });
  };

  // Show page structure immediately, handle loading/error states inline
  const isLoading = statusQuery.isLoading || branchesQuery.isLoading;
  const hasError = statusQuery.error;

  // Only show "No Branch Selected" when auth is loaded AND no branch is selected
  // Don't show it during initial auth loading to prevent flash
  if (!isLoadingAuth && !hasCurrentBranch) {
    return (
      <>
        <div className="page-title-bar">
          <Group justify="space-between" w="100%">
            <Title order={1}>{tSettings('title')}</Title>
          </Group>
        </div>
        <div className="page-sub-title-bar"></div>
        <div style={{ marginTop: '60px', paddingLeft: 'var(--mantine-spacing-md)', paddingRight: 'var(--mantine-spacing-md)', paddingTop: 'var(--mantine-spacing-sm)', paddingBottom: 'var(--mantine-spacing-xl)' }}>
          <Alert color={colors.warning} title={tSettings('noBranchSelectedTitle')}>
            <Text size="sm">{tSettings('noBranchSelectedMessage')}</Text>
          </Alert>
        </div>
      </>
    );
  }

  // Not initialized: show only "Start school setup" CTA; user must complete setup before seeing full settings
  const showSetupOnly =
    !isLoading && !hasError && hasSettingsStatusData && !tabbedScreenReady;

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>{tSettings('title')}</Title>
        </Group>
      </div>

      <div className="page-sub-title-bar"></div>

      <div
        style={{
          marginTop: '60px',
          paddingLeft: 'clamp(8px, 2vw, 16px)',
          paddingRight: 'clamp(8px, 2vw, 16px)',
          paddingTop: 'clamp(4px, 1vw, 8px)',
          paddingBottom: 'var(--mantine-spacing-xl)',
          overflowX: 'hidden',
        }}
      >
        {hasError && (
          <Alert color={colors.error} title={tSettings('loadStatusErrorTitle')} mb="md">
            <Text size="sm">{tSettings('loadStatusErrorMessage')}</Text>
          </Alert>
        )}

        {isLoading ? (
          <Stack gap="md">
            <Skeleton height={40} width="30%" />
            <Skeleton height={400} />
          </Stack>
        ) : showSetupOnly ? (
          <Stack gap="lg">
            <Grid>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <StartSchoolSetupView
                  onStartSetup={openWizard}
                  onCopyFromBranch={hasMultipleBranches ? openCopyModal : undefined}
                  colors={colors}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <BulkImportSetupView
                  onOpenBulkImport={() => setShowBulkImportPanel((prev) => !prev)}
                  isOpen={showBulkImportPanel}
                  colors={colors}
                />
              </Grid.Col>
            </Grid>
            {showBulkImportPanel && <BulkSetupTabContent />}
          </Stack>
        ) : (
          <>
            <Stack gap={0}>
              <Tabs value={activeCategory} onChange={handleCategoryChange}>
                <Tabs.List
                  grow
                  style={{
                    width: '100%',
                    flexWrap: 'wrap',
                    rowGap: '4px',
                  }}
                >
                  {visibleCategories.map((category) => {
                    const CategoryIcon = category.icon;
                    return (
                      <Tabs.Tab
                        key={category.id}
                        value={category.id}
                        id={`settings-category-${category.id}`}
                        leftSection={<CategoryIcon size={14} />}
                        style={{ minHeight: 'clamp(36px, 5vw, 44px)', flex: '1 1 140px' }}
                      >
                        {tSettings(category.labelKey)}
                      </Tabs.Tab>
                    );
                  })}
                </Tabs.List>
              </Tabs>

              <Tabs value={activeTab} onChange={(value) => {
                  if (isSettingsSectionId(value)) handleSectionChange(value);
                }}>
                <Tabs.List
                  style={{
                    width: '100%',
                    flexWrap: 'wrap',
                    rowGap: '4px',
                  }}
                >
                  {(visibleCategories.find((category) => category.id === activeCategory)?.items ?? []).map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <Tabs.Tab
                        key={item.value}
                        value={item.value}
                        id={`settings-section-${item.value}`}
                        leftSection={<ItemIcon size={14} />}
                        style={{ flex: '1 1 120px' }}
                      >
                        {tSettings(item.labelKey)}
                      </Tabs.Tab>
                    );
                  })}
                </Tabs.List>

              {/* Business Information Tab */}
              <Tabs.Panel value="business-information" pt="md" px="md" pb="md">
                <BusinessInformationTabContent />
              </Tabs.Panel>

              {/* Academic Years Tab */}
              <Tabs.Panel value="academic-years" pt="md" px="md" pb="md">
                <Stack gap="xl">
                  <AcademicYearsTabContent />
                  <AcademicTabContent />
                  <AssessmentTabContent />
                </Stack>
              </Tabs.Panel>

              {/* Permissions Tab */}
              <Tabs.Panel value="permissions" pt="md" px="md" pb="md">
                <PermissionsTabContent />
              </Tabs.Panel>

              {/* Schedule Tab */}
              <Tabs.Panel value="schedule" pt="md" px="md" pb="md">
                <ScheduleTabContent />
              </Tabs.Panel>

              {/* Communication Tab */}
              <Tabs.Panel value="communication" pt="md" px="md" pb="md">
                <CommunicationTabContent />
              </Tabs.Panel>

              {/* General: leave quota, library categories, behaviour */}
              <Tabs.Panel value="general" pt="md" px="md" pb="md">
                <GeneralTabContent />
              </Tabs.Panel>

              {/* Inventory Management Tab */}
              <Tabs.Panel value="inventory-management" pt="md" px="md" pb="md">
                <InventoryManagementTabContent />
              </Tabs.Panel>

              {/* Fee Settings Tab */}
              <Tabs.Panel value="fees" pt="md" px="md" pb="md">
                <FeeSettingsTabContent />
              </Tabs.Panel>

              <Tabs.Panel value="integrations" pt="md" px="md" pb="md">
                <IntegrationsTabContent />
              </Tabs.Panel>

              {canManageResultReports && (
                <Tabs.Panel value="result-reports" pt="md" px="md" pb="md">
                  <ResultReportsSettingsTabContent />
                </Tabs.Panel>
              )}

              {/* Theme Settings Tab - visible to all users with settings access */}
              <Tabs.Panel value="theme-settings" pt="md" px="md" pb="md">
                <ThemeSettingsPanel showTitle={false} />
              </Tabs.Panel>

              {isSchoolAdmin && (
                <Tabs.Panel value="public-statistics" pt="md" px="md" pb="md">
                  <PublicStatsSettings />
                </Tabs.Panel>
              )}

              {canDataExport && (
                <Tabs.Panel value="data-export" pt="md" px="md" pb="md">
                  <DataExportTabContent />
                </Tabs.Panel>
              )}

              </Tabs>
            </Stack>
          </>
        )}
      </div>

      <SetupWizard
        opened={wizardOpened}
        onClose={closeWizard}
        onComplete={handleWizardComplete}
      />

      <CopySettingsModal
        opened={copyModalOpened}
        onClose={closeCopyModal}
        onSuccess={handleCopySuccess}
      />
    </>
  );
}

interface StartSchoolSetupViewProps {
  onStartSetup: () => void;
  onCopyFromBranch?: () => void;
  colors: ReturnType<typeof useThemeColors>;
}

function StartSchoolSetupView({ onStartSetup, onCopyFromBranch, colors }: StartSchoolSetupViewProps) {
  const tSettings = useTranslations('settings');
  return (
    <Paper withBorder shadow="sm" p="xl" radius="md" style={{ width: '100%', textAlign: 'center', height: '100%' }}>
      <Stack align="center" gap="lg" justify="center" h="100%">
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: colors.primary ? `var(--mantine-color-${colors.primary}-light)` : 'var(--mantine-color-blue-1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconSchool size={40} style={{ color: colors.primary ? `var(--mantine-color-${colors.primary}-6)` : 'var(--mantine-color-blue-6)' }} />
        </div>
        <Stack gap="xs" align="center">
          <Title order={2}>{tSettings('setupRequiredTitle')}</Title>
          <Text size="sm" c="dimmed" maw={400}>
            {tSettings('setupRequiredDescription')}
          </Text>
        </Stack>
        <Stack gap="sm" w="100%" maw={320}>
          <Button
            fullWidth
            size="md"
            leftSection={<IconRocket size={18} />}
            onClick={onStartSetup}
            color={colors.primary}
          >
            {tSettings('setupStartButton')}
          </Button>
          {onCopyFromBranch && (
            <Button
              fullWidth
              variant="light"
              size="md"
              leftSection={<IconCopy size={18} />}
              onClick={onCopyFromBranch}
            >
              {tSettings('setupCopyFromBranchButton')}
            </Button>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}

interface BulkImportSetupViewProps {
  onOpenBulkImport: () => void;
  isOpen: boolean;
  colors: ReturnType<typeof useThemeColors>;
}

function BulkImportSetupView({ onOpenBulkImport, isOpen, colors }: BulkImportSetupViewProps) {
  const tSettings = useTranslations('settings');
  return (
    <Paper withBorder shadow="sm" p="xl" radius="md" style={{ width: '100%', textAlign: 'center', height: '100%' }}>
      <Stack align="center" gap="lg" justify="center" h="100%">
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: colors.primary ? `var(--mantine-color-${colors.primary}-light)` : 'var(--mantine-color-blue-1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconFileImport size={40} style={{ color: colors.primary ? `var(--mantine-color-${colors.primary}-6)` : 'var(--mantine-color-blue-6)' }} />
        </div>
        <Stack gap="xs" align="center">
          <Title order={2}>{tSettings('bulkSetupCardTitle')}</Title>
          <Text size="sm" c="dimmed" maw={400}>
            {tSettings('bulkSetupCardDescription')}
          </Text>
        </Stack>
        <Button
          fullWidth
          maw={320}
          size="md"
          leftSection={<IconFileImport size={18} />}
          onClick={onOpenBulkImport}
          color={colors.primary}
          variant={isOpen ? 'light' : 'filled'}
        >
          {isOpen ? tSettings('bulkSetupCardHideButton') : tSettings('bulkSetupCardOpenButton')}
        </Button>
      </Stack>
    </Paper>
  );
}

// Tab Content Components
function PermissionsTabContent() {
  const colors = useThemeColors();
  const tSettings = useTranslations('settings');
  const { permissions, isLoading, error, refetch } = usePermissions();
  const { data: rolesData } = useRoles();
  const { data: featuresData } = useFeatures();

  const roles = rolesData?.data || [];
  const features = featuresData?.data || [];

  if (isLoading) {
    return (
      <Stack gap="md">
        <Skeleton height={40} width="30%" />
        <Skeleton height={400} />
      </Stack>
    );
  }

  if (error) {
    return (
      <Alert color={colors.error} title="Failed to load permissions">
        <Group justify="space-between" mt="sm">
          <Text size="sm">Please try again.</Text>
          <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>
            Retry
          </Button>
        </Group>
      </Alert>
    );
  }

  return (
    <Tabs defaultValue="matrix">
      <Tabs.List>
        <Tabs.Tab value="matrix">{tSettings('permissionsAssignAccessTab')}</Tabs.Tab>
        <Tabs.Tab value="role-access">{tSettings('permissionsRoleAccessTab')}</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="matrix" pt="md">
        <PermissionMatrix roles={roles} features={features} permissions={permissions} />
      </Tabs.Panel>

      <Tabs.Panel value="role-access" pt="md">
        <RoleAccessSummary roles={roles} features={features} permissions={permissions} />
      </Tabs.Panel>
    </Tabs>
  );
}

function AcademicYearsTabContent() {
  const colors = useThemeColors();
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');
  const notifyColors = useNotificationColors();
  const [opened, { open, close }] = useDisclosure(false);

  const listQuery = useAcademicYearsList({ page: 1, limit: 50, search: '' });
  const createMutation = useCreateAcademicYear();
  const activateMutation = useActivateAcademicYear();
  const lockMutation = useLockAcademicYear();
  const rolloverMutation = useRolloverAcademicYear();
  const [lockingYearId, setLockingYearId] = useState<string | null>(null);
  const [activatingYearId, setActivatingYearId] = useState<string | null>(null);

  const [rolloverOpened, rolloverHandlers] = useDisclosure(false);
  const [rolloverSourceYear, setRolloverSourceYear] = useState<AcademicYear | null>(null);
  const [targetYearId, setTargetYearId] = useState<string | null>(null);
  const [carryForward, setCarryForward] = useState({
    teacherAssignments: false,
    timetableSlots: false,
    leaveSettings: true,
  });

  const setCarry = (
    key: 'teacherAssignments' | 'timetableSlots' | 'leaveSettings',
    next: boolean,
  ) => {
    setCarryForward((p) => ({ ...p, [key]: next }));
  };

  const handleCreate = async (values: AcademicYearFormValues) => {
    await createMutation.mutateAsync(values);
  };

  const handleActivate = async (id: string) => {
    try {
      setActivatingYearId(id);
      await activateMutation.mutateAsync(id);
      notifications.show({
        title: tCommon('success'),
        message: tSettings('academicYearActivated'),
        color: notifyColors.success,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : tCommon('errors.generic');
      notifications.show({
        title: tCommon('error'),
        message,
        color: notifyColors.error,
      });
    } finally {
      setActivatingYearId(null);
    }
  };

  const handleLock = async (year: AcademicYear) => {
    // Check if this is the active year
    if (year.isActive) {
      modals.openConfirmModal({
        title: tSettings('academicYearLockActiveTitle'),
        children: (
          <Text size="sm">{tSettings('academicYearLockActiveMessage')}</Text>
        ),
        labels: {
          confirm: tSettings('academicYearLockConfirm'),
          cancel: tCommon('cancel'),
        },
        confirmProps: { color: 'orange' },
        onConfirm: async () => {
          try {
            setLockingYearId(year.id);
            await lockMutation.mutateAsync(year.id);
            notifications.show({
              title: tCommon('success'),
              message: tSettings('academicYearLocked'),
              color: notifyColors.success,
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : tCommon('errors.generic');
            notifications.show({
              title: tCommon('error'),
              message,
              color: notifyColors.error,
            });
          } finally {
            setLockingYearId(null);
          }
        },
      });
    } else {
      // For non-active years, proceed directly
      try {
        setLockingYearId(year.id);
        await lockMutation.mutateAsync(year.id);
        notifications.show({
          title: tCommon('success'),
          message: tSettings('academicYearLocked'),
          color: notifyColors.success,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : tCommon('errors.generic');
        notifications.show({
          title: tCommon('error'),
          message,
          color: notifyColors.error,
        });
      } finally {
        setLockingYearId(null);
      }
    }
  };

  // Rollover copies from a *locked* source year into the currently-selected (active) target year.
  // The "year" passed in is the target year card where the user clicked Rollover.
  const openRollover = (year: AcademicYear) => {
    setRolloverSourceYear(null);
    setTargetYearId(null);
    setCarryForward({
      teacherAssignments: false,
      timetableSlots: false,
      leaveSettings: true,
    });
    setTargetYearId(year.id);
    rolloverHandlers.open();
  };

  const handleRollover = async () => {
    if (!rolloverSourceYear || !targetYearId) return;
    try {
      const res = await rolloverMutation.mutateAsync({
        sourceAcademicYearId: rolloverSourceYear.id,
        targetAcademicYearId: targetYearId,
        carryForward,
      });
      notifications.show({
        title: tCommon('success'),
        message: `Rollover completed. Copied: class sections ${res.data?.classSectionsCopied ?? 0}, teacher assignments ${res.data?.teacherAssignmentsCopied ?? 0}, timetable slots ${res.data?.timetableSlotsCopied ?? 0}, leave settings ${res.data?.leaveSettingsCopied ?? 0}.`,
        color: notifyColors.success,
      });
      rolloverHandlers.close();
    } catch (error) {
      const message = error instanceof Error ? error.message : tCommon('errors.generic');
      notifications.show({ title: tCommon('error'), message, color: notifyColors.error });
    }
  };

  return (
    <>
      <Group justify="space-between" mb="md">
        <Title order={2}>{tSettings('academicYearsHeaderTitle')}</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={open}>
          {tSettings('academicYearsCreateButton')}
        </Button>
      </Group>

      {listQuery.isLoading ? (
        <Stack gap="md">
          <Skeleton height={40} width="30%" />
          <Skeleton height={200} />
          <Skeleton height={200} />
        </Stack>
      ) : listQuery.error ? (
        <Alert color={colors.error} title={tSettings('academicYearsLoadErrorTitle')}>
          <Group justify="space-between" mt="sm">
            <Text size="sm">{tSettings('genericPleaseTryAgain')}</Text>
            <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={() => listQuery.refetch()}>
              {tSettings('retry')}
            </Button>
          </Group>
        </Alert>
      ) : (listQuery.data?.data?.length ?? 0) === 0 ? (
        <Alert color={colors.info} title={tSettings('academicYearsNoDataTitle')}>
          <Text size="sm">{tSettings('academicYearsNoDataMessage')}</Text>
        </Alert>
      ) : (
        <Stack gap="md">
          {listQuery.data?.data.map((year) => (
            <AcademicYearCard
              key={year.id}
              year={year}
              onActivate={handleActivate}
              onLock={handleLock}
              onRollover={openRollover}
              isActivating={activatingYearId === year.id}
              isLocking={lockingYearId === year.id}
            />
          ))}
        </Stack>
      )}

      <AcademicYearForm
        opened={opened}
        onClose={close}
        onSubmit={handleCreate}
        isSubmitting={createMutation.isPending}
      />

      <Modal
        opened={rolloverOpened}
        onClose={rolloverHandlers.close}
        title="Rollover to new academic year"
        size="lg"
      >
        <Stack gap="md">
          <Text size="sm">
            Copy setup from a locked academic year into your current (active) academic year.
            This will be blocked if Promotion is incomplete for the selected source year.
          </Text>

          <Select
            label="Source academic year (locked)"
            data={(listQuery.data?.data ?? [])
              .filter((y) => y.isLocked && y.id !== targetYearId)
              .map((y) => ({ value: y.id, label: y.name }))}
            value={rolloverSourceYear?.id ?? null}
            onChange={(v) => {
              const year = (listQuery.data?.data ?? []).find((y) => y.id === v) ?? null;
              setRolloverSourceYear(year);
            }}
            placeholder="Select locked source year"
            searchable
          />

          <Paper withBorder p="md">
            <Stack gap="xs">
              <Checkbox
                label="Copy teacher assignments"
                checked={carryForward.teacherAssignments}
                onChange={(e) => setCarry('teacherAssignments', Boolean(e?.currentTarget?.checked))}
              />
              <Checkbox
                label="Copy timetable slots"
                checked={carryForward.timetableSlots}
                onChange={(e) => setCarry('timetableSlots', Boolean(e?.currentTarget?.checked))}
              />
              <Checkbox
                label="Copy leave settings"
                checked={carryForward.leaveSettings}
                onChange={(e) => setCarry('leaveSettings', Boolean(e?.currentTarget?.checked))}
              />
            </Stack>
          </Paper>

          <Group justify="flex-end">
            <Button variant="default" onClick={rolloverHandlers.close}>
              {tCommon('cancel')}
            </Button>
            <Button
              onClick={handleRollover}
              loading={rolloverMutation.isPending}
              disabled={!targetYearId || !rolloverSourceYear}
            >
              Run rollover
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

function BusinessInformationTabContent() {
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();
  const tSettings = useTranslations('settings');
  const { user } = useAuth();
  const tenantQuery = useTenantMe();
  const updateTenant = useUpdateTenantMe();
  const currentBranchId = user?.currentBranch?.id;
  const branchQuery = useBranchById(currentBranchId);
  const updateBranch = useUpdateBranch();

  const [name, setName] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [domain, setDomain] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [timezone, setTimezone] = useState<string>('Asia/Baghdad');
  const [fiscalYearStart, setFiscalYearStart] = useState<string>('');
  const [vatNumber, setVatNumber] = useState<string>('');
  const [defaultLocale, setDefaultLocale] = useState<'en-GB' | 'en-US' | 'ar'>('en-GB');

  // Branch fields
  const [branchNameTranslations, setBranchNameTranslations] = useState<TranslatableValue>({ en: '', ar: '' });
  const [branchCode, setBranchCode] = useState<string>('');
  const [branchAddress, setBranchAddress] = useState<string>('');
  const [branchPhone, setBranchPhone] = useState<string>('');
  const [branchEmail, setBranchEmail] = useState<string>('');

  const [hasInitialised, setHasInitialised] = useState(false);
  const [saving, setSaving] = useState(false);

  const applyBranchFields = (branch: {
    name?: string | null;
    nameAr?: string | null;
    nameTranslations?: { en?: string; ar?: string } | null;
    code?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
  }) => {
    const translations = branch.nameTranslations;
    setBranchNameTranslations({
      en: translations?.en ?? branch.name ?? '',
      ar: translations?.ar ?? branch.nameAr ?? '',
    });
    setBranchCode(branch.code || '');
    setBranchAddress(branch.address || '');
    setBranchPhone(branch.phone || '');
    setBranchEmail(branch.email || '');
  };

  // Initialise local state once when tenant and branch load
  useEffect(() => {
    const tenant = tenantQuery.data?.data;
    const branch = branchQuery.data?.data;
    
    if (hasInitialised) return;
    if (!tenant) return;
    
    // Tenant fields
    setName(tenant.name || '');
    setCode(tenant.code || '');
    setDomain(tenant.domain || '');
    setEmail(tenant.email || '');
    setPhone(tenant.phone || '');
    setTimezone(tenant.timezone || 'Asia/Baghdad');
    setFiscalYearStart(tenant.fiscalYearStart || '');
    setVatNumber(tenant.vatNumber || '');
    setDefaultLocale(
      tenant.defaultLocale === 'en-US' || tenant.defaultLocale === 'ar'
        ? tenant.defaultLocale
        : 'en-GB',
    );

    if (branch) {
      applyBranchFields(branch);
    }
    
    setHasInitialised(true);
  }, [hasInitialised, tenantQuery.data?.data, branchQuery.data?.data]);

  // Update branch fields when branch data loads (separate effect to handle late loading)
  useEffect(() => {
    const branch = branchQuery.data?.data;
    if (branch && hasInitialised) {
      applyBranchFields(branch);
    }
  }, [branchQuery.data?.data, hasInitialised]);

  if (tenantQuery.isLoading) {
    return (
      <Stack gap="md">
        <Skeleton height={40} width="30%" />
        <Skeleton height={200} />
        <Skeleton height={200} />
        {currentBranchId && <Skeleton height={200} />}
      </Stack>
    );
  }

  if (tenantQuery.error) {
    return (
      <Alert color={colors.error} title={tSettings('businessLoadSchoolErrorTitle')}>
        <Text size="sm">{tSettings('genericPleaseTryAgain')}</Text>
      </Alert>
    );
  }

  // Show branch error separately if it exists
  const branchError = branchQuery.error;
  const isLoadingBranch = branchQuery.isLoading && currentBranchId;

  const onSave = async () => {
    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      notifications.show({
        title: tSettings('validationErrorTitle'),
        message: tSettings('validationSchoolNameRequired'),
        color: notifyColors.error,
      });
      return;
    }

    if (currentBranchId) {
      const branchNamePrimary =
        (branchNameTranslations.en ?? '').trim() || (branchNameTranslations.ar ?? '').trim();
      if (!branchNamePrimary) {
        notifications.show({
          title: tSettings('validationErrorTitle'),
          message: tSettings('validationBranchNameRequired'),
          color: notifyColors.error,
        });
        return;
      }
    }

    try {
      setSaving(true);
      
      // Update tenant
      await updateTenant.mutateAsync({
        name: trimmedName,
        domain: domain.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        timezone: timezone || undefined,
        fiscalYearStart: fiscalYearStart.trim() || undefined,
        vatNumber: vatNumber.trim() || undefined,
        defaultLocale,
      });

      // Update branch if we have a current branch
      if (currentBranchId) {
        const branchNamePrimary =
          (branchNameTranslations.en ?? '').trim() || (branchNameTranslations.ar ?? '').trim();
        await updateBranch.mutateAsync({
          id: currentBranchId,
          payload: {
            name: branchNamePrimary || undefined,
            name_translations: branchNameTranslations,
            address: branchAddress.trim() || undefined,
            phone: branchPhone.trim() || undefined,
            email: branchEmail.trim() || undefined,
          },
        });
      }

      notifications.show({
        title: tSettings('businessUpdateSuccessTitle'),
        message: tSettings('businessUpdateSuccessMessage'),
        color: notifyColors.success,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : tSettings('businessUpdateUnknownError');
      notifications.show({
        title: 'Error',
        message,
        color: notifyColors.error,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(); }}>
      <Stack gap="lg">
        <Paper withBorder p="md">
          <Title order={3} mb="md">
            {tSettings('businessBasicDetailsTitle')}
          </Title>
          <Grid>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <TextInput
                label={tSettings('businessSchoolNameLabel')}
                placeholder={tSettings('businessSchoolNamePlaceholder')}
                required
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <TextInput
                label={tSettings('businessSchoolCodeLabel')}
                value={code}
                disabled
                readOnly
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <TextInput
                label={tSettings('businessDomainLabel')}
                placeholder={tSettings('businessDomainPlaceholder')}
                value={domain}
                onChange={(e) => setDomain(e.currentTarget.value)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <TextInput
                label={tSettings('businessEmailLabel')}
                type="email"
                placeholder={tSettings('businessEmailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <TextInput
                label={tSettings('businessPhoneLabel')}
                placeholder={tSettings('businessPhonePlaceholder')}
                value={phone}
                onChange={(e) => setPhone(e.currentTarget.value)}
              />
            </Grid.Col>
          </Grid>
        </Paper>

        <Paper withBorder p="md">
          <Title order={3} mb="md">
            {tSettings('businessSettingsTitle')}
          </Title>
          <Grid>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Select
                label={tSettings('businessTimezoneLabel')}
                data={getTimezones().map(tz => ({
                  value: tz.value,
                  label: tz.label
                }))}
                searchable
                value={timezone}
                onChange={(value) => setTimezone(value || 'Asia/Baghdad')}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <TextInput
                label={tSettings('businessFiscalYearStartLabel')}
                type="date"
                value={fiscalYearStart}
                onChange={(e) => setFiscalYearStart(e.currentTarget.value)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <TextInput
                label={tSettings('businessVatNumberLabel')}
                placeholder={tSettings('businessVatNumberPlaceholder')}
                value={vatNumber}
                onChange={(e) => setVatNumber(e.currentTarget.value)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Select
                id="business-default-locale"
                label={tSettings('businessDefaultLanguageLabel')}
                description={tSettings('businessDefaultLanguageDescription')}
                data={[
                  { value: 'en-GB', label: tSettings('localeEnglishUk') },
                  { value: 'en-US', label: tSettings('localeEnglishUs') },
                  { value: 'ar', label: tSettings('localeArabic') },
                ]}
                value={defaultLocale}
                onChange={(value) =>
                  setDefaultLocale(
                    value === 'en-US' || value === 'ar' ? value : 'en-GB',
                  )
                }
              />
            </Grid.Col>
          </Grid>
        </Paper>

        {currentBranchId && (
          <Paper withBorder p="md">
            <Title order={3} mb="md">
              {tSettings('branchDetailsTitle')}
            </Title>
            {branchError && (
              <Alert color={colors.error} mb="md" title={tSettings('branchLoadErrorTitle')}>
                <Text size="sm">
                  {tSettings('branchIdLabel')} {currentBranchId}
                </Text>
                <Text size="sm">
                  {tSettings('branchErrorLabel')}{' '}
                  {branchError instanceof Error ? branchError.message : 'Unknown error'}
                </Text>
              </Alert>
            )}
            {isLoadingBranch ? (
              <Stack gap="md">
                <Skeleton height={40} />
                <Skeleton height={40} />
                <Skeleton height={40} />
              </Stack>
            ) : (
              <Grid>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <TranslatableInput
                    id="settings-branch-name"
                    label={tSettings('branchNameLabel')}
                    value={branchNameTranslations}
                    onChange={setBranchNameTranslations}
                    required
                    placeholder={{ en: tSettings('branchNamePlaceholder'), ar: '' }}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <TextInput
                    label={tSettings('branchCodeLabel')}
                    value={branchCode}
                    disabled
                    readOnly
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <TextInput
                    label={tSettings('branchAddressLabel')}
                    placeholder={tSettings('branchAddressPlaceholder')}
                    value={branchAddress}
                    onChange={(e) => setBranchAddress(e.currentTarget.value)}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <TextInput
                    label={tSettings('branchPhoneLabel')}
                    placeholder={tSettings('branchPhonePlaceholder')}
                    value={branchPhone}
                    onChange={(e) => setBranchPhone(e.currentTarget.value)}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <TextInput
                    label={tSettings('branchEmailLabel')}
                    type="email"
                    placeholder={tSettings('branchEmailPlaceholder')}
                    value={branchEmail}
                    onChange={(e) => setBranchEmail(e.currentTarget.value)}
                  />
                </Grid.Col>
              </Grid>
            )}
          </Paper>
        )}

        <Group justify="flex-end" mt="xl">
          <Button type="submit" loading={saving || updateTenant.isPending || updateBranch.isPending}>
            {tSettings('saveChanges')}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

function AcademicTabContent() {
  const tSettings = useTranslations('settings');
  return (
    <Stack gap="md">
      <Title order={2}>Academic Settings</Title>
      <Tabs defaultValue="subjects">
        <Tabs.List>
          <Tabs.Tab value="subjects">{tSettings('academicTabSubjects')}</Tabs.Tab>
          <Tabs.Tab value="classes">{tSettings('academicTabClasses')}</Tabs.Tab>
          <Tabs.Tab value="sections">{tSettings('academicTabSections')}</Tabs.Tab>
          <Tabs.Tab value="levels">{tSettings('academicTabLevels')}</Tabs.Tab>
          <Tabs.Tab value="subject-templates">{tSettings('academicTabSubjectTemplates')}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="subjects" pt="md">
          <SubjectList />
        </Tabs.Panel>
        <Tabs.Panel value="classes" pt="md">
          <ClassList />
        </Tabs.Panel>
        <Tabs.Panel value="sections" pt="md">
          <SectionList />
        </Tabs.Panel>
        <Tabs.Panel value="levels" pt="md">
          <LevelManager />
        </Tabs.Panel>
        <Tabs.Panel value="subject-templates" pt="md">
          <SubjectTemplatesTabContent />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

function ScheduleTabContent() {
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  const schoolDaysQuery = useSchoolDays();
  const updateSchoolDays = useUpdateSchoolDays();
  const templatesQuery = useTimingTemplates();
  const createTemplate = useCreateTimingTemplate();
  const assignClasses = useAssignClassesToTimingTemplate();
  const classesQuery = useClasses();
  const activeYearQuery = useActiveAcademicYear();
  const activeYearId = activeYearQuery.data?.data?.id;
  const holidaysQuery = usePublicHolidays(activeYearId);
  const createHoliday = useCreatePublicHoliday();
  const updateHoliday = useUpdatePublicHoliday();
  const deleteHoliday = useDeletePublicHoliday();

  const isLoading =
    schoolDaysQuery.isLoading ||
    templatesQuery.isLoading ||
    classesQuery.isLoading ||
    activeYearQuery.isLoading ||
    (activeYearId ? holidaysQuery.isLoading : false);

  const hasError =
    schoolDaysQuery.error ||
    templatesQuery.error ||
    classesQuery.error ||
    activeYearQuery.error ||
    holidaysQuery.error;

  const handleCreateTemplate = async (values: TimingTemplateFormValues) => {
    try {
      await createTemplate.mutateAsync({
        name: values.name,
        startTime: values.startTime,
        endTime: values.endTime,
        periodDurationMinutes: values.periodDurationMinutes,
        slots: values.slots,
      });
      notifications.show({ title: tCommon('success'), message: tSettings('scheduleTimingTemplatesNewButton'), color: notifyColors.success });
      closeCreate();
    } catch (error) {
      const message = error instanceof Error ? error.message : tCommon('errors.generic');
      notifications.show({ title: tCommon('error'), message, color: notifyColors.error });
    }
  };

  const handleAssignClasses = async (templateId: string, classIds: string[]) => {
    try {
      await assignClasses.mutateAsync({ templateId, classIds });
      notifications.show({ title: tCommon('success'), message: tSettings('scheduleTimingSaveAssignments'), color: notifyColors.success });
    } catch (error) {
      const message = error instanceof Error ? error.message : tCommon('errors.generic');
      notifications.show({ title: tCommon('error'), message, color: notifyColors.error });
    }
  };

  const handleCreateHoliday = async (values: { name: string; startDate: string; endDate: string; academicYearId: string }) => {
    try {
      await createHoliday.mutateAsync(values);
      notifications.show({ title: tCommon('success'), message: tSettings('scheduleHolidayModalAdd'), color: notifyColors.success });
    } catch (error) {
      const message = error instanceof Error ? error.message : tCommon('errors.generic');
      notifications.show({ title: tCommon('error'), message, color: notifyColors.error });
    }
  };

  const handleUpdateHoliday = async (
    id: string,
    values: { name: string; startDate: string; endDate: string; academicYearId: string },
  ) => {
    try {
      await updateHoliday.mutateAsync({ id, ...values });
      notifications.show({ title: tCommon('success'), message: tSettings('scheduleHolidayModalEdit'), color: notifyColors.success });
    } catch (error) {
      const message = error instanceof Error ? error.message : tCommon('errors.generic');
      notifications.show({ title: tCommon('error'), message, color: notifyColors.error });
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    if (!activeYearId) return;
    try {
      await deleteHoliday.mutateAsync({ id, academicYearId: activeYearId });
      notifications.show({ title: tCommon('success'), message: tSettings('schedulePublicHolidaysTitle'), color: notifyColors.success });
    } catch (error) {
      const message = error instanceof Error ? error.message : tCommon('errors.generic');
      notifications.show({ title: tCommon('error'), message, color: notifyColors.error });
    }
  };

  const unavailableClassIdsByTemplate = useMemo(() => {
    const templates = templatesQuery.data?.data ?? [];
    const allAssignedClassIds = new Set<string>();

    templates.forEach((template) => {
      template.assignedClassIds.forEach((classId) => {
        allAssignedClassIds.add(classId);
      });
    });

    const map: Record<string, string[]> = {};
    templates.forEach((template) => {
      const unavailable = new Set(allAssignedClassIds);
      template.assignedClassIds.forEach((classId) => unavailable.delete(classId));
      map[template.id] = Array.from(unavailable);
    });

    return map;
  }, [templatesQuery.data?.data]);

  if (isLoading) {
    return (
      <Stack gap="md">
        <Skeleton height={40} width="30%" />
        <Skeleton height={200} />
        <Skeleton height={200} />
        <Skeleton height={200} />
      </Stack>
    );
  }

  if (hasError) {
    return (
      <Alert color={colors.error} title={tSettings('scheduleLoadErrorTitle')}>
        <Group justify="flex-end" mt="sm">
          <Button
            variant="light"
            leftSection={<IconRefresh size={16} />}
            onClick={() => {
              void schoolDaysQuery.refetch();
              void templatesQuery.refetch();
              void classesQuery.refetch();
              void activeYearQuery.refetch();
              void holidaysQuery.refetch();
            }}
          >
            {tCommon('retry')}
          </Button>
        </Group>
      </Alert>
    );
  }

  return (
    <>
      <Stack gap="xl">
        <SchoolDaysSelector
          initialActiveDays={schoolDaysQuery.data?.data ?? []}
          isSaving={updateSchoolDays.isPending}
          onSave={(days) => updateSchoolDays.mutateAsync(days).then(() => Promise.resolve())}
        />

        <Stack gap="md">
          <Group justify="space-between" align="center">
            <Title order={2}>{tSettings('scheduleTimingTemplatesTitle')}</Title>
            <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
              {tSettings('scheduleTimingTemplatesNewButton')}
            </Button>
          </Group>
          <Text size="sm" c="dimmed">
            {tSettings('scheduleTimingTemplatesDescription')}
          </Text>
          {(templatesQuery.data?.data ?? []).length === 0 && (
            <Alert color={colors.warning} title={tSettings('scheduleTimingTemplatesWarningTitle')}>
              {tSettings('scheduleTimingTemplatesWarningMessage')}
            </Alert>
          )}
          <Stack gap="md">
            {(templatesQuery.data?.data ?? []).map((t) => (
              <TimingTemplateCard
                key={t.id}
                template={t}
                classes={classesQuery.data?.data ?? []}
                unavailableClassIds={unavailableClassIdsByTemplate[t.id] ?? []}
                isSavingAssignments={assignClasses.isPending}
                onAssignClasses={handleAssignClasses}
              />
            ))}
          </Stack>
        </Stack>

        <Stack gap="md">
          <Title order={2}>{tSettings('schedulePublicHolidaysTitle')}</Title>
          {!activeYearId ? (
            <Alert color={colors.warning} title={tSettings('scheduleNoActiveYearTitle')}>
              {tSettings('scheduleNoActiveYearMessage')}
            </Alert>
          ) : (
            <HolidayCalendar
              holidays={holidaysQuery.data?.data ?? []}
              academicYearId={activeYearId}
              isCreating={createHoliday.isPending || updateHoliday.isPending || deleteHoliday.isPending}
              onCreate={handleCreateHoliday}
              onUpdate={handleUpdateHoliday}
              onDelete={handleDeleteHoliday}
            />
          )}
        </Stack>

        <Stack gap="md">
          <VacationManager academicYearId={activeYearId} />
        </Stack>
      </Stack>

      <TimingTemplateForm
        opened={createOpened}
        onClose={closeCreate}
        onSubmit={handleCreateTemplate}
        isSubmitting={createTemplate.isPending}
      />
    </>
  );
}

function GeneralTabContent() {
  const activeYearQuery = useActiveAcademicYear();
  const activeYearId = activeYearQuery.data?.data?.id;

  return (
    <Stack gap="xl">
      <LeaveQuotaSetting academicYearId={activeYearId} />
      <LibraryCategoryEditor />
      <BehaviorSettings />
    </Stack>
  );
}

function AssessmentTabContent() {
  const tSettings = useTranslations('settings');

  return (
    <Stack gap="md">
      <Title order={2}>Assessment Settings</Title>
      <Tabs defaultValue="types">
        <Tabs.List>
          <Tabs.Tab value="types">{tSettings('assessmentTabTypes')}</Tabs.Tab>
          <Tabs.Tab value="templates">{tSettings('assessmentTabTemplates')}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="types" pt="md">
          <AssessmentTypeList />
        </Tabs.Panel>
        <Tabs.Panel value="templates" pt="md">
          <GradeTemplateBuilder />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

function CommunicationTabContent() {
  return <CommunicationSettings />;
}

function InventoryManagementTabContent() {
  return (
    <Stack gap="xl">
      <InventoryCategoryEditor />
      <InventorySizeEditor />
    </Stack>
  );
}
