'use client';

import {
  Badge,
  Button,
  Card,
  Group,
  Skeleton,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { IconCreditCard, IconDownload } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import {
  useCreateInvoiceCheckout,
  useCustomerPortal,
  usePaymentConfig,
  useSubscriptionInvoices,
  useSubscriptionInvoiceDownload,
} from '@/hooks/api/useSubscription';
import type { InvoiceStatus, SubscriptionInvoice } from '@/types/subscription';
import { getSubscriptionApiErrorMessage } from '@/lib/subscription/subscription-api-errors';

function formatAmount(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

function statusColor(status: InvoiceStatus): string {
  switch (status) {
    case 'paid':
      return 'green';
    case 'open':
      return 'yellow';
    case 'void':
      return 'gray';
    case 'uncollectible':
      return 'red';
    default:
      return 'blue';
  }
}

function InvoicePayNowButton({
  invoice,
  stripeEnabled,
}: {
  invoice: SubscriptionInvoice;
  stripeEnabled: boolean;
}) {
  const t = useTranslations('billing');
  const checkout = useCreateInvoiceCheckout();
  const isPaying =
    checkout.isPending && checkout.variables === invoice.id;

  if (
    !stripeEnabled ||
    invoice.status !== 'open' ||
    invoice.amountCents <= 0 ||
    invoice.pendingUpgradePlanId
  ) {
    return null;
  }

  return (
    <Button
      id={`billing-invoice-pay-${invoice.id}`}
      size="xs"
      leftSection={<IconCreditCard size={14} />}
      loading={isPaying}
      disabled={isPaying}
      onClick={async () => {
        try {
          const res = await checkout.mutateAsync(invoice.id);
          if (res.checkoutUrl) {
            window.location.href = res.checkoutUrl;
          }
        } catch (error) {
          notifications.show({
            message: getSubscriptionApiErrorMessage(error, t('paymentError'), t),
            color: 'red',
          });
        }
      }}
    >
      {t('payNow')}
    </Button>
  );
}

function InvoiceDownloadButton({ invoice }: { invoice: SubscriptionInvoice }) {
  const t = useTranslations('billing');
  const download = useSubscriptionInvoiceDownload();
  const [loading, setLoading] = useState(false);

  if (!invoice.hasPdf && !invoice.hostedInvoiceUrl) {
    return (
      <Text size="xs" c="dimmed">
        {t('noPdf')}
      </Text>
    );
  }

  return (
    <Button
      id={`billing-invoice-download-${invoice.id}`}
      size="xs"
      leftSection={<IconDownload size={14} />}
      loading={loading}
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          const res = await download.mutateAsync(invoice.id);
          if (res.url) {
            window.open(res.url, '_blank', 'noopener,noreferrer');
          }
        } catch {
          notifications.show({ message: t('downloadFailed'), color: 'red' });
        } finally {
          setLoading(false);
        }
      }}
    >
      {t('download')}
    </Button>
  );
}

export function BillingHistoryTable() {
  const t = useTranslations('billing');
  const { data, isLoading, error } = useSubscriptionInvoices();
  const { data: paymentConfig } = usePaymentConfig();
  const customerPortal = useCustomerPortal();
  const invoices = data?.data ?? [];
  const stripeEnabled = paymentConfig?.stripeEnabled ?? false;

  return (
    <Card withBorder padding={0} id="billing-history-card">
      <Group
        px="md"
        py="sm"
        style={{ background: 'var(--mantine-color-gray-1)' }}
        justify="space-between"
      >
        <Title order={4}>{t('billingHistory')}</Title>
        {stripeEnabled ? (
          <Button
            id="billing-manage-payment-methods"
            variant="light"
            size="xs"
            loading={customerPortal.isPending}
            disabled={customerPortal.isPending}
            onClick={async () => {
              try {
                const res = await customerPortal.mutateAsync();
                if (res.url) {
                  window.location.href = res.url;
                }
              } catch (error) {
                notifications.show({
                  message: getSubscriptionApiErrorMessage(error, t('paymentError'), t),
                  color: 'red',
                });
              }
            }}
          >
            {t('managePaymentMethods')}
          </Button>
        ) : null}
      </Group>

      {isLoading ? (
        <Skeleton height={160} m="md" />
      ) : error ? (
        <Text c="red" size="sm" p="md">
          {(error as Error).message}
        </Text>
      ) : invoices.length === 0 ? (
        <Text size="sm" c="dimmed" p="md">
          {t('billingHistoryEmpty')}
        </Text>
      ) : (
        <Table striped highlightOnHover horizontalSpacing="md" verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('invoiceNumber')}</Table.Th>
              <Table.Th>{t('invoiceDate')}</Table.Th>
              <Table.Th>{t('invoiceAmount')}</Table.Th>
              <Table.Th>{t('invoiceStatus')}</Table.Th>
              <Table.Th>{t('invoicePeriod')}</Table.Th>
              <Table.Th>{t('invoiceActions')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {invoices.map((inv) => (
              <Table.Tr key={inv.id} id={`billing-invoice-row-${inv.id}`}>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {inv.invoiceNumber}
                  </Text>
                </Table.Td>
                <Table.Td>{formatDate(inv.issuedAt)}</Table.Td>
                <Table.Td>{formatAmount(inv.amountCents, inv.currency)}</Table.Td>
                <Table.Td>
                  <Badge color={statusColor(inv.status)} variant="filled" size="sm">
                    {t(`invoiceStatus_${inv.status}`)}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)}
                </Table.Td>
                <Table.Td>
                  <Group gap="xs" wrap="nowrap">
                    <InvoicePayNowButton invoice={inv} stripeEnabled={stripeEnabled} />
                    <InvoiceDownloadButton invoice={inv} />
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Card>
  );
}
