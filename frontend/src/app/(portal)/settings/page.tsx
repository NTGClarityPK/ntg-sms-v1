'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Group, Stack, Text, Title, Skeleton, Alert, Tabs, Paper, TextInput, Grid, Select } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconRocket, IconCopy, IconShield, IconCalendar, IconSchool, IconClock, IconClipboardList, IconMessage, IconMoodHappy, IconPlus, IconRefresh, IconBuilding, IconPalette, IconPackage, IconChartBar } from '@tabler/icons-react';
import { useSettingsStatus } from '@/hooks/useSettingsStatus';
import { useTenantBranches } from '@/hooks/useBranches';
import { SetupWizard } from '@/components/features/settings/SetupWizard';
import { CopySettingsModal } from '@/components/features/settings/CopySettingsModal';
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
import { useAcademicYearsList, useActivateAcademicYear, useCreateAcademicYear, useLockAcademicYear } from '@/hooks/useAcademicYears';
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
  const { user, isLoading: isLoadingAuth } = useAuth();
  const [wizardOpened, { open: openWizard, close: closeWizard }] = useDisclosure(false);
  const [copyModalOpened, { open: openCopyModal, close: closeCopyModal }] = useDisclosure(false);
  const [activeTab, setActiveTab] = useState<string | null>('permissions');
  const statusQuery = useSettingsStatus();
  const branchesQuery = useTenantBranches();
  const saveWizard = useSaveSetupWizard();
  const qc = useQueryClient();

  const hasCurrentBranch = !!user?.currentBranch?.id;
  const isSchoolAdmin = user?.roles?.some((r) => r.roleName?.toLowerCase() === 'school_admin') || false;
  const settingsStatusData = statusQuery.data?.data;
  const isInitialized = settingsStatusData?.isInitialized ?? false;
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
            <Title order={1}>Settings</Title>
          </Group>
        </div>
        <div className="page-sub-title-bar"></div>
        <div style={{ marginTop: '60px', paddingLeft: 'var(--mantine-spacing-md)', paddingRight: 'var(--mantine-spacing-md)', paddingTop: 'var(--mantine-spacing-sm)', paddingBottom: 'var(--mantine-spacing-xl)' }}>
          <Alert color={colors.warning} title="No Branch Selected">
            <Text size="sm">
              Please select a branch from the branch switcher in the header to access settings.
            </Text>
          </Alert>
        </div>
      </>
    );
  }

  // Not initialized: show only "Start school setup" CTA; user must complete setup before seeing full settings
  const showSetupOnly = !isLoading && !hasError && hasSettingsStatusData && !isInitialized;

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Settings</Title>
        </Group>
      </div>

      <div className="page-sub-title-bar"></div>

      <div style={{ marginTop: '60px', paddingLeft: 'var(--mantine-spacing-md)', paddingRight: 'var(--mantine-spacing-md)', paddingTop: 'var(--mantine-spacing-sm)', paddingBottom: 'var(--mantine-spacing-xl)' }}>
        {hasError && (
          <Alert color={colors.error} title="Failed to load settings status" mb="md">
            <Text size="sm">Please try again. If the issue persists, ensure you have access to the selected branch.</Text>
          </Alert>
        )}

        {isLoading ? (
          <Stack gap="md">
            <Skeleton height={40} width="30%" />
            <Skeleton height={400} />
          </Stack>
        ) : showSetupOnly ? (
          <StartSchoolSetupView
            onStartSetup={openWizard}
            onCopyFromBranch={hasMultipleBranches ? openCopyModal : undefined}
            colors={colors}
          />
        ) : (
          <>
            <Tabs value={activeTab} onChange={setActiveTab}>
              <Tabs.List>
                <Tabs.Tab value="permissions" leftSection={<IconShield size={16} />}>
                  Permissions
                </Tabs.Tab>
                <Tabs.Tab value="business-information" leftSection={<IconBuilding size={16} />}>
                  Business Information
                </Tabs.Tab>
                <Tabs.Tab value="academic-years" leftSection={<IconCalendar size={16} />}>
                  Academic Years
                </Tabs.Tab>
                <Tabs.Tab value="academic" leftSection={<IconSchool size={16} />}>
                  Academic
                </Tabs.Tab>
                <Tabs.Tab value="schedule" leftSection={<IconClock size={16} />}>
                  Schedule
                </Tabs.Tab>
                <Tabs.Tab value="assessment" leftSection={<IconClipboardList size={16} />}>
                  Assessment
                </Tabs.Tab>
                <Tabs.Tab value="communication" leftSection={<IconMessage size={16} />}>
                  Communication
                </Tabs.Tab>
                <Tabs.Tab value="behavior" leftSection={<IconMoodHappy size={16} />}>
                  Behavior
                </Tabs.Tab>
                <Tabs.Tab value="inventory-management" leftSection={<IconPackage size={16} />}>
                  Inventory Management
                </Tabs.Tab>
                {isSchoolAdmin && (
                  <>
                    <Tabs.Tab value="public-statistics" leftSection={<IconChartBar size={16} />}>
                      Public statistics
                    </Tabs.Tab>
                    <Tabs.Tab value="theme-settings" leftSection={<IconPalette size={16} />}>
                      Theme Settings
                    </Tabs.Tab>
                  </>
                )}
              </Tabs.List>

              {/* Permissions Tab */}
              <Tabs.Panel value="permissions" pt="md" px="md" pb="md">
                <PermissionsTabContent />
              </Tabs.Panel>

              {/* Business Information Tab */}
              <Tabs.Panel value="business-information" pt="md" px="md" pb="md">
                <BusinessInformationTabContent />
              </Tabs.Panel>

              {/* Academic Years Tab */}
              <Tabs.Panel value="academic-years" pt="md" px="md" pb="md">
                <AcademicYearsTabContent />
              </Tabs.Panel>

              {/* Academic Tab */}
              <Tabs.Panel value="academic" pt="md" px="md" pb="md">
                <AcademicTabContent />
              </Tabs.Panel>

              {/* Schedule Tab */}
              <Tabs.Panel value="schedule" pt="md" px="md" pb="md">
                <ScheduleTabContent />
              </Tabs.Panel>

              {/* Assessment Tab */}
              <Tabs.Panel value="assessment" pt="md" px="md" pb="md">
                <AssessmentTabContent />
              </Tabs.Panel>

              {/* Communication Tab */}
              <Tabs.Panel value="communication" pt="md" px="md" pb="md">
                <CommunicationTabContent />
              </Tabs.Panel>

              {/* Behavior Tab */}
              <Tabs.Panel value="behavior" pt="md" px="md" pb="md">
                <BehaviorTabContent />
              </Tabs.Panel>

              {/* Inventory Management Tab */}
              <Tabs.Panel value="inventory-management" pt="md" px="md" pb="md">
                <InventoryManagementTabContent />
              </Tabs.Panel>

              {isSchoolAdmin && (
                <>
                  <Tabs.Panel value="public-statistics" pt="md" px="md" pb="md">
                    <PublicStatsSettings />
                  </Tabs.Panel>
                  <Tabs.Panel value="theme-settings" pt="md" px="md" pb="md">
                    <ThemeSettingsPanel showTitle={false} />
                  </Tabs.Panel>
                </>
              )}
            </Tabs>
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
  return (
    <Stack align="center" gap="xl" py="xl" maw={520} mx="auto">
      <Paper withBorder shadow="sm" p="xl" radius="md" style={{ width: '100%', textAlign: 'center' }}>
        <Stack align="center" gap="lg">
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
            <Title order={2}>School setup required</Title>
            <Text size="sm" c="dimmed" maw={400}>
              Configure your school settings before using the rest of the system. Run the guided setup once to create academic years, classes, schedule, and more. You can change these later in Settings.
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
              Start school setup
            </Button>
            {onCopyFromBranch && (
              <Button
                fullWidth
                variant="light"
                size="md"
                leftSection={<IconCopy size={18} />}
                onClick={onCopyFromBranch}
              >
                Copy settings from another branch
              </Button>
            )}
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );
}

// Tab Content Components
function PermissionsTabContent() {
  const colors = useThemeColors();
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
        <Tabs.Tab value="matrix">Assign Access</Tabs.Tab>
        <Tabs.Tab value="role-access">Role Access View</Tabs.Tab>
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
  const notifyColors = useNotificationColors();
  const [opened, { open, close }] = useDisclosure(false);

  const listQuery = useAcademicYearsList({ page: 1, limit: 50, search: '' });
  const createMutation = useCreateAcademicYear();
  const activateMutation = useActivateAcademicYear();
  const lockMutation = useLockAcademicYear();

  const handleCreate = async (values: AcademicYearFormValues) => {
    await createMutation.mutateAsync(values);
  };

  const handleActivate = async (id: string) => {
    try {
      await activateMutation.mutateAsync(id);
      notifications.show({ title: 'Success', message: 'Academic year activated', color: notifyColors.success });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      notifications.show({ title: 'Error', message, color: notifyColors.error });
    }
  };

  const handleLock = async (year: AcademicYear) => {
    // Check if this is the active year
    if (year.isActive) {
      modals.openConfirmModal({
        title: 'Lock Active Academic Year',
        children: (
          <Text size="sm">
            You are about to lock the <strong>active</strong> academic year. This will make it read-only and prevent all modifications.
            <br />
            <br />
            <strong>Warning:</strong> Once locked, this action cannot be undone. If you need to revert this change, please contact Super Admin Support.
          </Text>
        ),
        labels: { confirm: 'Lock Year', cancel: 'Cancel' },
        confirmProps: { color: 'orange' },
        onConfirm: async () => {
          try {
            await lockMutation.mutateAsync(year.id);
            notifications.show({ title: 'Success', message: 'Academic year locked', color: notifyColors.success });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            notifications.show({ title: 'Error', message, color: notifyColors.error });
          }
        },
      });
    } else {
      // For non-active years, proceed directly
      try {
        await lockMutation.mutateAsync(year.id);
        notifications.show({ title: 'Success', message: 'Academic year locked', color: notifyColors.success });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        notifications.show({ title: 'Error', message, color: notifyColors.error });
      }
    }
  };

  return (
    <>
      <Group justify="space-between" mb="md">
        <Title order={2}>Academic Years</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={open}>
          Create
        </Button>
      </Group>

      {listQuery.isLoading ? (
        <Stack gap="md">
          <Skeleton height={40} width="30%" />
          <Skeleton height={200} />
          <Skeleton height={200} />
        </Stack>
      ) : listQuery.error ? (
        <Alert color={colors.error} title="Failed to load academic years">
          <Group justify="space-between" mt="sm">
            <Text size="sm">Please try again.</Text>
            <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={() => listQuery.refetch()}>
              Retry
            </Button>
          </Group>
        </Alert>
      ) : (listQuery.data?.data?.length ?? 0) === 0 ? (
        <Alert color={colors.info} title="No academic years yet">
          <Text size="sm">Create your first academic year to start configuring the system.</Text>
        </Alert>
      ) : (
        <Stack gap="md">
          {listQuery.data?.data.map((year) => (
            <AcademicYearCard
              key={year.id}
              year={year}
              onActivate={handleActivate}
              onLock={handleLock}
              isActivating={activateMutation.isPending}
              isLocking={lockMutation.isPending}
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
    </>
  );
}

function BusinessInformationTabContent() {
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();
  const { user } = useAuth();
  const tenantQuery = useTenantMe();
  const updateTenant = useUpdateTenantMe();
  const currentBranchId = user?.currentBranch?.id;
  const branchQuery = useBranchById(currentBranchId);
  const updateBranch = useUpdateBranch();

  // Debug: Log current branch info
  useEffect(() => {
    if (user?.currentBranch) {
      console.log('Current Branch:', user.currentBranch);
      console.log('Current Branch ID:', currentBranchId);
    } else {
      console.log('No current branch found in user object');
      console.log('User object:', user);
    }
  }, [user, currentBranchId]);

  const [name, setName] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [domain, setDomain] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [timezone, setTimezone] = useState<string>('Asia/Baghdad');
  const [fiscalYearStart, setFiscalYearStart] = useState<string>('');
  const [vatNumber, setVatNumber] = useState<string>('');

  // Branch fields
  const [branchNameTranslations, setBranchNameTranslations] = useState<TranslatableValue>({ en: '', ar: '' });
  const [branchCode, setBranchCode] = useState<string>('');
  const [branchAddress, setBranchAddress] = useState<string>('');
  const [branchPhone, setBranchPhone] = useState<string>('');
  const [branchEmail, setBranchEmail] = useState<string>('');

  const [hasInitialised, setHasInitialised] = useState(false);
  const [saving, setSaving] = useState(false);

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

    // Branch fields - only initialize if we have branch data
    // Don't wait for branch to initialize tenant fields
    if (branch) {
      setBranchNameTranslations({ en: branch.name || '', ar: '' });
      setBranchCode(branch.code || '');
      setBranchAddress(branch.address || '');
      setBranchPhone(branch.phone || '');
      setBranchEmail(branch.email || '');
    }
    
    setHasInitialised(true);
  }, [hasInitialised, tenantQuery.data?.data, branchQuery.data?.data]);

  // Update branch fields when branch data loads (separate effect to handle late loading)
  useEffect(() => {
    const branch = branchQuery.data?.data;
    if (branch && hasInitialised) {
      setBranchNameTranslations({ en: branch.name || '', ar: '' });
      setBranchCode(branch.code || '');
      setBranchAddress(branch.address || '');
      setBranchPhone(branch.phone || '');
      setBranchEmail(branch.email || '');
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
      <Alert color={colors.error} title="Failed to load school information">
        <Text size="sm">Please try again.</Text>
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
        title: 'Validation error',
        message: 'School name is required.',
        color: notifyColors.error,
      });
      return;
    }

    if (currentBranchId) {
      const branchNamePrimary =
        (branchNameTranslations.en ?? '').trim() || (branchNameTranslations.ar ?? '').trim();
      if (!branchNamePrimary) {
        notifications.show({
          title: 'Validation error',
          message: 'Branch name (EN or AR) is required.',
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
        title: 'Success',
        message: 'Business information updated successfully.',
        color: notifyColors.success,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
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
            Basic Details
          </Title>
          <Grid>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <TextInput
                label="School Name"
                placeholder="Enter school name"
                required
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <TextInput
                label="School Code"
                value={code}
                disabled
                readOnly
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <TextInput
                label="Domain"
                placeholder="Enter domain (e.g., alekaf.edu)"
                value={domain}
                onChange={(e) => setDomain(e.currentTarget.value)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <TextInput
                label="Email"
                type="email"
                placeholder="Enter contact email"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <TextInput
                label="Phone"
                placeholder="Enter contact phone"
                value={phone}
                onChange={(e) => setPhone(e.currentTarget.value)}
              />
            </Grid.Col>
          </Grid>
        </Paper>

        <Paper withBorder p="md">
          <Title order={3} mb="md">
            Business Settings
          </Title>
          <Grid>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Select
                label="Timezone"
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
                label="Fiscal Year Start"
                type="date"
                value={fiscalYearStart}
                onChange={(e) => setFiscalYearStart(e.currentTarget.value)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <TextInput
                label="VAT Number"
                placeholder="Enter VAT/Tax identification number"
                value={vatNumber}
                onChange={(e) => setVatNumber(e.currentTarget.value)}
              />
            </Grid.Col>
          </Grid>
        </Paper>

        {currentBranchId && (
          <Paper withBorder p="md">
            <Title order={3} mb="md">
              Branch Details
            </Title>
            {branchError && (
              <Alert color={colors.error} mb="md" title="Failed to load branch information">
                <Text size="sm">Branch ID: {currentBranchId}</Text>
                <Text size="sm">Error: {branchError instanceof Error ? branchError.message : 'Unknown error'}</Text>
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
                    label="Branch Name"
                    value={branchNameTranslations}
                    onChange={setBranchNameTranslations}
                    required
                    placeholder={{ en: 'Enter branch name', ar: 'أدخل اسم الفرع' }}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <TextInput
                    label="Branch Code"
                    value={branchCode}
                    disabled
                    readOnly
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <TextInput
                    label="Address"
                    placeholder="Enter branch address"
                    value={branchAddress}
                    onChange={(e) => setBranchAddress(e.currentTarget.value)}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <TextInput
                    label="Phone"
                    placeholder="Enter branch phone"
                    value={branchPhone}
                    onChange={(e) => setBranchPhone(e.currentTarget.value)}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <TextInput
                    label="Email"
                    type="email"
                    placeholder="Enter branch email"
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
            Save Changes
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

function AcademicTabContent() {
  return (
    <Tabs defaultValue="subjects">
      <Tabs.List>
        <Tabs.Tab value="subjects">Subjects</Tabs.Tab>
        <Tabs.Tab value="classes">Classes</Tabs.Tab>
        <Tabs.Tab value="sections">Sections</Tabs.Tab>
        <Tabs.Tab value="levels">Levels</Tabs.Tab>
        <Tabs.Tab value="subject-templates">Subject Templates</Tabs.Tab>
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
  );
}

function ScheduleTabContent() {
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();
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
      notifications.show({ title: 'Success', message: 'Timing template created', color: notifyColors.success });
      closeCreate();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      notifications.show({ title: 'Error', message, color: notifyColors.error });
    }
  };

  const handleAssignClasses = async (templateId: string, classIds: string[]) => {
    try {
      await assignClasses.mutateAsync({ templateId, classIds });
      notifications.show({ title: 'Success', message: 'Assignments updated', color: notifyColors.success });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      notifications.show({ title: 'Error', message, color: notifyColors.error });
    }
  };

  const handleCreateHoliday = async (values: { name: string; startDate: string; endDate: string; academicYearId: string }) => {
    try {
      await createHoliday.mutateAsync(values);
      notifications.show({ title: 'Success', message: 'Holiday created', color: notifyColors.success });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      notifications.show({ title: 'Error', message, color: notifyColors.error });
    }
  };

  const handleUpdateHoliday = async (
    id: string,
    values: { name: string; startDate: string; endDate: string; academicYearId: string },
  ) => {
    try {
      await updateHoliday.mutateAsync({ id, ...values });
      notifications.show({ title: 'Success', message: 'Holiday updated', color: notifyColors.success });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      notifications.show({ title: 'Error', message, color: notifyColors.error });
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    if (!activeYearId) return;
    try {
      await deleteHoliday.mutateAsync({ id, academicYearId: activeYearId });
      notifications.show({ title: 'Success', message: 'Holiday deleted', color: notifyColors.success });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      notifications.show({ title: 'Error', message, color: notifyColors.error });
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
      <Alert color={colors.error} title="Failed to load schedule settings">
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
            Retry
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
            <Title order={2}>Timing templates</Title>
            <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
              New template
            </Button>
          </Group>
          <Text size="sm" c="dimmed">
            Timing templates define the daily schedule structure for your school, including school start and end times, 
            period duration, and special slots like assembly and breaks. Assign templates to classes to establish 
            their timetable framework.
          </Text>
          {(templatesQuery.data?.data ?? []).length === 0 && (
            <Alert color={colors.warning} title="School start and end times are set in timing templates">
              Create at least one timing template and provide <strong>school start time</strong> and{' '}
              <strong>school end time</strong>.
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
          <Title order={2}>Public holidays</Title>
          {!activeYearId ? (
            <Alert color={colors.warning} title="No active academic year">
              Create and activate an academic year to manage holidays.
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

function AssessmentTabContent() {
  const tLeave = useTranslations('leave');
  const activeYearQuery = useActiveAcademicYear();
  const activeYearId = activeYearQuery.data?.data?.id;

  return (
    <Tabs defaultValue="types">
      <Tabs.List>
        <Tabs.Tab value="types">Assessment types</Tabs.Tab>
        <Tabs.Tab value="templates">Grade templates</Tabs.Tab>
        <Tabs.Tab value="leave">{tLeave('tabLeaveQuota')}</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="types" pt="md">
        <AssessmentTypeList />
      </Tabs.Panel>
      <Tabs.Panel value="templates" pt="md">
        <GradeTemplateBuilder />
      </Tabs.Panel>
      <Tabs.Panel value="leave" pt="md">
        <LeaveQuotaSetting academicYearId={activeYearId} />
      </Tabs.Panel>
    </Tabs>
  );
}

function CommunicationTabContent() {
  return (
    <Stack gap="xl">
      <CommunicationSettings />
      <LibraryCategoryEditor />
    </Stack>
  );
}

function BehaviorTabContent() {
  return <BehaviorSettings />;
}

function InventoryManagementTabContent() {
  return (
    <Stack gap="xl">
      <InventoryCategoryEditor />
      <InventorySizeEditor />
    </Stack>
  );
}
