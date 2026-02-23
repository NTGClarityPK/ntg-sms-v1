'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Paper,
  Stack,
  Title,
  Button,
  Group,
  Text,
  Table,
  Badge,
  Switch,
  MultiSelect,
  Skeleton,
  Alert,
  Tabs,
} from '@mantine/core';
import { IconCheck, IconAlertCircle, IconUsers, IconShield } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { settingsApi, RoleAccessConfiguration, UpdateRoleAccessConfigDto } from '@/lib/api/settings';
import { useLanguageStore } from '@/lib/store/language-store';
import { t } from '@/lib/utils/translations';
import { useThemeColor } from '@/lib/hooks/use-theme-color';
import { getSuccessColor, getErrorColor } from '@/lib/utils/theme';

// Tab configuration - labels will be translated dynamically
const TAB_CONFIGS = [
  { value: '/portal/dashboard', key: 'dashboard' },
  { value: '/portal/menu', key: 'menu' },
  { value: '/portal/pos', key: 'newOrder' },
  { value: '/portal/orders', key: 'orders' },
  { value: '/portal/inventory', key: 'inventory' },
  { value: '/portal/recipes', key: 'recipes' },
  { value: '/portal/employees', key: 'employees' },
  { value: '/portal/customers', key: 'customers' },
  { value: '/portal/delivery', key: 'delivery' },
  { value: '/portal/coupons', key: 'coupons' },
  { value: '/portal/reports', key: 'reports' },
  { value: '/portal/settings', key: 'settings' },
];

// Role configuration - labels will be translated dynamically
// Note: tenant_owner is excluded as they have full access by default
const ROLE_CONFIGS = [
  { value: 'manager', key: 'manager' },
  { value: 'cashier', key: 'cashier' },
  { value: 'kitchen_staff', key: 'kitchenStaff' },
  { value: 'waiter', key: 'waiter' },
  { value: 'delivery', key: 'delivery' },
];

interface RoleAccessConfigTabProps {
  userRole?: string;
}

export function RoleAccessConfigTab({ userRole }: RoleAccessConfigTabProps) {
  const language = useLanguageStore((state) => state.language);
  const themeColor = useThemeColor();
  const loadingRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configurations, setConfigurations] = useState<RoleAccessConfiguration[]>([]);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [editingConfig, setEditingConfig] = useState<Partial<RoleAccessConfiguration>>({});

  // Get translated tabs - memoized to avoid recalculation on every render
  const AVAILABLE_TABS = useMemo(() => TAB_CONFIGS.map(tab => ({
    value: tab.value,
    label: t(`navigation.${tab.key}` as any, language) || tab.key,
  })), [language]);

  // Get translated roles - memoized to avoid recalculation on every render
  const AVAILABLE_ROLES = useMemo(() => ROLE_CONFIGS.map(role => ({
    value: role.value,
    label: t(`roles.${role.key}` as any, language) || role.value,
  })), [language]);

  const loadConfigurations = useCallback(async () => {
    if (loadingRef.current) return; // Prevent duplicate calls
    
    try {
      loadingRef.current = true;
      setLoading(true);
      const configs = await settingsApi.getRoleAccessConfigurations();
      
      // Ensure we have an array
      const configsArray = Array.isArray(configs) ? configs : [];
      
      setConfigurations(configsArray);
      
      // Set first role as selected if none selected
      const currentSelectedRole = selectedRole;
      if (!currentSelectedRole) {
        // Always use first available role, even if no configs exist
        const firstRole = AVAILABLE_ROLES[0]?.value || null;
        
        if (firstRole) {
          setSelectedRole(firstRole);
          const config = configsArray.find(c => c.roleName === firstRole);
          if (config) {
            setEditingConfig(config);
          } else {
            // Create default config for this role (will be saved when user clicks save)
            const allTabPaths = AVAILABLE_TABS.map(tab => tab.value);
            setEditingConfig({
              roleName: firstRole,
              accessibleTabs: [],
              blockedPaths: allTabPaths,
              kitchenDisplayEnabled: false,
              markAsPaidEnabled: false,
            });
          }
        }
      } else {
        // Update editing config if role is already selected
        const config = configsArray.find(c => c.roleName === currentSelectedRole);
        if (config) {
          setEditingConfig(config);
        } else {
          // Create default config for selected role if not found
          // All tabs are blocked by default (empty accessible tabs means all are blocked)
          const allTabPaths = AVAILABLE_TABS.map(tab => tab.value);
          setEditingConfig({
            roleName: currentSelectedRole,
            accessibleTabs: [],
            blockedPaths: allTabPaths,
            kitchenDisplayEnabled: false,
            markAsPaidEnabled: false,
          });
        }
      }
    } catch (error: any) {
      console.error('Failed to load role access configurations:', error);
      notifications.show({
        title: t('common.error' as any, language),
        message: error?.message || t('settings.roleAccessConfigLoadError' as any, language) || 'Failed to load role access configurations',
        color: getErrorColor(),
        icon: <IconAlertCircle size={16} />,
      });
      // Set default role even on error
      if (!selectedRole && AVAILABLE_ROLES.length > 0) {
        const allTabPaths = AVAILABLE_TABS.map(tab => tab.value);
        setSelectedRole(AVAILABLE_ROLES[0].value);
        setEditingConfig({
          roleName: AVAILABLE_ROLES[0].value,
          accessibleTabs: [],
          blockedPaths: allTabPaths,
          kitchenDisplayEnabled: false,
          markAsPaidEnabled: false,
        });
      }
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, AVAILABLE_TABS, AVAILABLE_ROLES]); // Removed selectedRole from dependencies

  useEffect(() => {
    loadConfigurations();
  }, [loadConfigurations]);

  const handleRoleSelect = (roleName: string) => {
    setSelectedRole(roleName);
    const config = configurations.find(c => c.roleName === roleName);
    if (config) {
      setEditingConfig(config);
    } else {
      // Create new config for this role
      // All tabs are blocked by default (empty accessible tabs means all are blocked)
      const allTabPaths = AVAILABLE_TABS.map(tab => tab.value);
      setEditingConfig({
        roleName,
        accessibleTabs: [],
        blockedPaths: allTabPaths,
        kitchenDisplayEnabled: false,
        markAsPaidEnabled: false,
      });
    }
  };

  const handleSave = async () => {
    if (!selectedRole) return;

    try {
      setSaving(true);
      // Automatically calculate blocked paths from accessible tabs
      const accessibleTabs = editingConfig.accessibleTabs || [];
      const allTabPaths = AVAILABLE_TABS.map(tab => tab.value);
      const blockedPaths = allTabPaths.filter(path => !accessibleTabs.includes(path));
      
      const updateDto: UpdateRoleAccessConfigDto = {
        roleName: selectedRole,
        accessibleTabs: accessibleTabs,
        blockedPaths: blockedPaths,
        kitchenDisplayEnabled: editingConfig.kitchenDisplayEnabled || false,
        markAsPaidEnabled: editingConfig.markAsPaidEnabled || false,
      };

      await settingsApi.updateRoleAccessConfiguration(updateDto);
      
      notifications.show({
        title: t('common.success' as any, language),
        message: t('settings.roleAccessConfigSaveSuccess' as any, language) || 'Role access configuration saved successfully',
        color: getSuccessColor(),
        icon: <IconCheck size={16} />,
      });

      await loadConfigurations();
      
      // Update editing config after save
      const updatedConfig = await settingsApi.getRoleAccessConfiguration(selectedRole);
      setEditingConfig(updatedConfig);
    } catch (error: any) {
      notifications.show({
        title: t('common.error' as any, language),
        message: error?.message || t('settings.roleAccessConfigSaveError' as any, language) || 'Failed to save role access configuration',
        color: getErrorColor(),
        icon: <IconAlertCircle size={16} />,
      });
    } finally {
      setSaving(false);
    }
  };

  const getRoleDisplayName = (roleName: string) => {
    const role = AVAILABLE_ROLES.find(r => r.value === roleName);
    return role?.label || roleName;
  };

  if (loading) {
    return (
      <Stack gap="md">
        <Skeleton height={40} width="30%" />
        <Skeleton height={400} />
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Paper p="md" withBorder>
        <Stack gap="md">
          <Title order={4}>
            {t('settings.roleAccessConfig' as any, language) || 'Role Access Configuration'}
          </Title>
          <Text c="dimmed" size="sm">
            {t('settings.roleAccessConfigDescription' as any, language) || 
              'Configure which tabs are accessible to each role. Tabs not selected will be automatically blocked. Tenant owners and managers have full access by default.'}
          </Text>

          {configurations.length === 0 && !loading ? (
            <Alert 
              icon={<IconAlertCircle size={16} />} 
              color="blue" 
              title={t('settings.roleAccessConfigNoConfigsTitle' as any, language) || 'No Configurations Yet'}
            >
              <Text size="sm" mb="md">
                {t('settings.roleAccessConfigNoConfigsMessage' as any, language) || 
                  'Default configurations will be created automatically when you save settings for a role.'}
              </Text>
              <Text size="sm" c="dimmed">
                {t('settings.roleAccessConfigNoConfigsHint' as any, language) || 
                  'Select a role tab below to configure its access settings. All roles are shown even if not yet configured.'}
              </Text>
            </Alert>
          ) : null}

          <Tabs value={selectedRole || undefined} onChange={(value) => value && handleRoleSelect(value)}>
            <Tabs.List>
              {/* Show all available roles, not just ones with configs */}
              {AVAILABLE_ROLES.map((role) => {
                const config = configurations.find(c => c.roleName === role.value);
                return (
                  <Tabs.Tab key={role.value} value={role.value}>
                    {role.label}
                  </Tabs.Tab>
                );
              })}
            </Tabs.List>

            {/* Render panels for all available roles */}
            {AVAILABLE_ROLES.map((role) => {
              const config = configurations.find(c => c.roleName === role.value);
              const isSelected = selectedRole === role.value;
              // Calculate blocked paths automatically from accessible tabs
              const accessibleTabs = isSelected 
                ? (editingConfig.accessibleTabs || [])
                : (config?.accessibleTabs || []);
              const allTabPaths = AVAILABLE_TABS.map(tab => tab.value);
              const blockedPaths = allTabPaths.filter(path => !accessibleTabs.includes(path));
              
              const currentConfig = isSelected 
                ? { ...editingConfig, blockedPaths }
                : (config || {
                    roleName: role.value,
                    accessibleTabs: [],
                    blockedPaths: allTabPaths,
                    kitchenDisplayEnabled: false,
                    markAsPaidEnabled: false,
                  });

              return (
                <Tabs.Panel key={role.value} value={role.value} pt="md">
                  <Stack gap="md">
                    <Paper p="md" withBorder>
                      <Stack gap="md">
                        <Group justify="space-between">
                          <Title order={5} c="dark">
                            {role.label} - {t('settings.roleAccessConfigAccessConfig' as any, language) || 'Access Configuration'}
                          </Title>
                          <Badge variant="light" color={config ? "blue" : "gray"}>
                            {role.value} {!config && `(${t('settings.roleAccessConfigNotConfigured' as any, language) || 'Not Configured'})`}
                          </Badge>
                        </Group>

                        <MultiSelect
                          label={t('settings.roleAccessConfigAccessibleTabs' as any, language) || 'Accessible Tabs'}
                          description={t('settings.roleAccessConfigAccessibleTabsDescription' as any, language) || 
                            'Select which tabs/pages are visible to this role. Tabs not in this list will be automatically blocked.'}
                          data={AVAILABLE_TABS}
                          value={currentConfig.accessibleTabs || []}
                          onChange={(value) => {
                            if (isSelected) {
                              // Automatically calculate blocked paths as all tabs not in accessible list
                              const allTabPaths = AVAILABLE_TABS.map(tab => tab.value);
                              const blockedPaths = allTabPaths.filter(path => !value.includes(path));
                              setEditingConfig({ 
                                ...editingConfig, 
                                accessibleTabs: value,
                                blockedPaths: blockedPaths,
                              });
                            }
                          }}
                          searchable
                          clearable
                        />

                        <Switch
                          label={t('settings.roleAccessConfigKitchenDisplayButton' as any, language) || 'Kitchen Display Button'}
                          description={t('settings.roleAccessConfigKitchenDisplayButtonDescription' as any, language) || 
                            'Show kitchen display button for this role'}
                          checked={currentConfig.kitchenDisplayEnabled || false}
                          onChange={(event) => {
                            if (isSelected) {
                              setEditingConfig({
                                ...editingConfig,
                                kitchenDisplayEnabled: event.currentTarget.checked,
                              });
                            }
                          }}
                        />

                        <Switch
                          label={t('settings.roleAccessConfigMarkAsPaidButton' as any, language) || 'Mark as Paid Button'}
                          description={t('settings.roleAccessConfigMarkAsPaidButtonDescription' as any, language) || 
                            'Show mark as paid button for this role'}
                          checked={currentConfig.markAsPaidEnabled || false}
                          onChange={(event) => {
                            if (isSelected) {
                              setEditingConfig({
                                ...editingConfig,
                                markAsPaidEnabled: event.currentTarget.checked,
                              });
                            }
                          }}
                        />

                        {/* Always show save button for selected role */}
                        {isSelected ? (
                          <Group justify="flex-end" mt="md">
                            <Button
                              onClick={handleSave}
                              loading={saving}
                              leftSection={<IconCheck size={16} />}
                              style={{ backgroundColor: themeColor }}
                            >
                              {t('common.save' as any, language) || 'Save'}
                            </Button>
                          </Group>
                        ) : (
                          <Text size="sm" c="dimmed" mt="md">
                            {t('settings.roleAccessConfigSelectRoleHint' as any, language) || 
                              'Select this role to configure its access settings.'}
                          </Text>
                        )}
                      </Stack>
                    </Paper>
                  </Stack>
                </Tabs.Panel>
              );
            })}
          </Tabs>
        </Stack>
      </Paper>
    </Stack>
  );
}

