'use client';

import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Group,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { useTranslations } from 'next-intl';
import {
  useAdminSubscriptions,
  useAdminSyncSubscriptionUsage,
  useAdminUpdateSubscription,
} from '@/hooks/api/useSubscription';
import { planDisplayName } from '@/lib/subscription/plan-transition';
import type { PlanId, BillingCycle } from '@/types/subscription';

const PLAN_OPTIONS: { value: PlanId; label: string }[] = [
  { value: 'free', label: 'Free' },
  { value: 'starter', label: 'Starter' },
  { value: 'pro', label: 'Pro' },
  { value: 'enterprise', label: 'Enterprise' },
];

const CYCLE_OPTIONS: { value: BillingCycle; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

export default function PaymentModelsPage() {
  const t = useTranslations('billing');
  const { data, isLoading, error } = useAdminSubscriptions();
  const updateMutation = useAdminUpdateSubscription();
  const syncMutation = useAdminSyncSubscriptionUsage();
  const [editingTenantId, setEditingTenantId] = useState<string | null>(null);
  const [draftPlan, setDraftPlan] = useState<PlanId>('free');
  const [draftCycle, setDraftCycle] = useState<BillingCycle>('monthly');
  const [draftNotes, setDraftNotes] = useState('');

  const rows = useMemo(() => data ?? [], [data]);

  const startEdit = (tenantId: string, planId: PlanId, cycle: BillingCycle, notes?: string) => {
    setEditingTenantId(tenantId);
    setDraftPlan(planId);
    setDraftCycle(cycle);
    setDraftNotes(notes ?? '');
  };

  return (
    <>
      <AdminTitleBar />
      <div
        style={{
          marginTop: '60px',
          paddingLeft: 'var(--mantine-spacing-md)',
          paddingRight: 'var(--mantine-spacing-md)',
          paddingBottom: 'var(--mantine-spacing-xl)',
        }}
      >
        <Paper withBorder p="md">
          {isLoading ? (
            <Stack gap="sm">
              <Skeleton height={32} />
              <Skeleton height={200} />
            </Stack>
          ) : error ? (
            <Text c="red">{(error as Error).message}</Text>
          ) : (
            <Table.ScrollContainer minWidth={900}>
              <Table striped highlightOnHover id="admin-subscriptions-table">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>School</Table.Th>
                    <Table.Th>Plan</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Students</Table.Th>
                    <Table.Th>Branches</Table.Th>
                    <Table.Th>Period end</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rows.map((row) => (
                    <Table.Tr key={row.tenantId}>
                      <Table.Td>
                        <Stack gap={0}>
                          <Text fw={500}>{row.tenantName}</Text>
                          <Text size="xs" c="dimmed">
                            {row.tenantCode}
                          </Text>
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light">
                          {planDisplayName(row.subscription.planId)}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{row.subscription.status}</Table.Td>
                      <Table.Td>
                        {row.usage.studentsUsed}
                      </Table.Td>
                      <Table.Td>{row.usage.branchesUsed}</Table.Td>
                      <Table.Td>
                        {new Date(row.subscription.currentPeriodEnd).toLocaleDateString()}
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <Button
                            id={`admin-subscription-edit-${row.tenantId}`}
                            size="xs"
                            variant="light"
                            onClick={() =>
                              startEdit(
                                row.tenantId,
                                row.subscription.planId,
                                row.subscription.billingCycle,
                                row.subscription.notes,
                              )
                            }
                          >
                            Edit
                          </Button>
                          <Button
                            id={`admin-subscription-sync-${row.tenantId}`}
                            size="xs"
                            variant="subtle"
                            loading={
                              syncMutation.isPending &&
                              syncMutation.variables === row.tenantId
                            }
                            disabled={syncMutation.isPending}
                            onClick={() => syncMutation.mutate(row.tenantId)}
                          >
                            Sync usage
                          </Button>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}

          {editingTenantId && (
            <Paper withBorder p="md" mt="lg" id="admin-subscription-edit-panel">
              <Title order={4} mb="md">
                Update subscription
              </Title>
              <Stack gap="sm">
                <Select
                  id="admin-subscription-plan"
                  label="Plan"
                  data={PLAN_OPTIONS}
                  value={draftPlan}
                  onChange={(v) => v && setDraftPlan(v as PlanId)}
                />
                <Select
                  id="admin-subscription-cycle"
                  label={t('billingCycle')}
                  data={CYCLE_OPTIONS}
                  value={draftCycle}
                  onChange={(v) => v && setDraftCycle(v as BillingCycle)}
                />
                <Textarea
                  id="admin-subscription-notes"
                  label="Notes"
                  value={draftNotes}
                  onChange={(e) => setDraftNotes(e.currentTarget.value)}
                  minRows={2}
                />
                <Group>
                  <Button
                    id="admin-subscription-save"
                    loading={updateMutation.isPending}
                    disabled={updateMutation.isPending}
                    onClick={() => {
                      updateMutation.mutate(
                        {
                          tenantId: editingTenantId,
                          planId: draftPlan,
                          billingCycle: draftCycle,
                          notes: draftNotes,
                          clearPending: true,
                        },
                        { onSuccess: () => setEditingTenantId(null) },
                      );
                    }}
                  >
                    Save
                  </Button>
                  <Button
                    id="admin-subscription-cancel-edit"
                    variant="default"
                    onClick={() => setEditingTenantId(null)}
                  >
                    Cancel
                  </Button>
                </Group>
              </Stack>
            </Paper>
          )}
        </Paper>
      </div>
    </>
  );
}

function AdminTitleBar() {
  return (
    <div
      className="page-title-bar"
      style={{
        borderTopLeftRadius: '12px',
        overflow: 'hidden',
      }}
    >
      <Group justify="space-between" w="100%">
        <Title order={1}>Payment models</Title>
      </Group>
    </div>
  );
}
