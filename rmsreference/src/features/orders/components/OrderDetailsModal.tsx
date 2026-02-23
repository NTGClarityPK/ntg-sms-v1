'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Modal,
  Stack,
  Group,
  Text,
  Badge,
  Divider,
  Button,
  Select,
  Table,
  Paper,
  Grid,
  Skeleton,
  useMantineTheme,
} from '@mantine/core';
import { IconCheck, IconEdit, IconPrinter } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useLanguageStore } from '@/lib/store/language-store';
import { t } from '@/lib/utils/translations';
import { ordersApi, Order, OrderStatus, PaymentStatus, BillSplit, BillSplitPayment } from '@/lib/api/orders';
import { notifications } from '@mantine/notifications';
import { useThemeColor } from '@/lib/hooks/use-theme-color';
import { getStatusColor, getPaymentStatusColor, getSuccessColor, getErrorColor } from '@/lib/utils/theme';
import { useCurrency } from '@/lib/hooks/use-currency';
import { formatCurrency } from '@/lib/utils/currency-formatter';
import { InvoiceGenerator } from '@/lib/utils/invoice-generator';
import { restaurantApi } from '@/lib/api/restaurant';
import { useDateFormat } from '@/lib/hooks/use-date-format';
import { useSettings } from '@/lib/hooks/use-settings';
import { menuApi } from '@/lib/api/menu';
import type { ThemeConfig } from '@/lib/theme/themeConfig';
import { useRoleAccessConfig } from '@/lib/hooks/use-role-access-config';
import { UnifiedPaymentModal } from './UnifiedPaymentModal';
import { IconCreditCard, IconUsers } from '@tabler/icons-react';

interface OrderDetailsModalProps {
  opened: boolean;
  onClose: () => void;
  order: Order | null;
  onStatusUpdate?: () => void;
}

const statusOptions: { value: OrderStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'ready', label: 'Ready' },
  { value: 'served', label: 'Served' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function OrderDetailsModal({
  opened,
  onClose,
  order,
  onStatusUpdate,
}: OrderDetailsModalProps) {
  const { language } = useLanguageStore();
  const theme = useMantineTheme();
  const themeConfig = (theme.other as any) as ThemeConfig | undefined;
  const primary = useThemeColor();
  const currency = useCurrency();
  const { formatDateTime } = useDateFormat();
  const { settings } = useSettings();
  const router = useRouter();
  const { isMarkAsPaidEnabledForUser } = useRoleAccessConfig();
  const [orderDetails, setOrderDetails] = useState<Order | null>(order);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState<OrderStatus | null>(null);
  const [printing, setPrinting] = useState(false);
  const [tenant, setTenant] = useState<any>(null);
  const [branch, setBranch] = useState<any>(null);
  const [unifiedPaymentModalOpened, setUnifiedPaymentModalOpened] = useState(false);
  const [billSplit, setBillSplit] = useState<BillSplit | null>(null);

  const handleEditOrder = () => {
    if (orderDetails) {
      router.push(`/portal/pos?editOrder=${orderDetails.id}`);
      onClose();
    }
  };

  const loadOrderDetails = useCallback(async () => {
    if (!order) return;
    setLoading(true);
    try {
      // Pass language parameter to get translations in the main API call
      const data = await ordersApi.getOrderById(order.id, language);
      
      // Load bill split if order is split
      if (data.isSplitBill && data.billSplitId) {
        try {
          const split = await ordersApi.getBillSplit(order.id);
          setBillSplit(split);
        } catch (error) {
          console.error('Failed to load bill split:', error);
        }
      } else {
        setBillSplit(null);
      }
      
      // Fetch missing buffet and combo meal names if needed
      if (data.items) {
        const itemsWithNames = await Promise.all(
          data.items.map(async (item) => {
            // If buffetId exists but buffet object is missing or has no name, fetch it
            if (item.buffetId && (!item.buffet || !item.buffet.name)) {
              try {
                const buffet = await menuApi.getBuffetById(item.buffetId);
                return {
                  ...item,
                  buffet: {
                    id: buffet.id,
                    name: buffet.name,
                    imageUrl: buffet.imageUrl,
                  },
                };
              } catch (error) {
                console.error('Failed to fetch buffet:', error);
                return item;
              }
            }
            // If comboMealId exists but comboMeal object is missing or has no name, fetch it
            if (item.comboMealId && (!item.comboMeal || !item.comboMeal.name)) {
              try {
                const comboMeal = await menuApi.getComboMealById(item.comboMealId);
                return {
                  ...item,
                  comboMeal: {
                    id: comboMeal.id,
                    name: comboMeal.name,
                    imageUrl: comboMeal.imageUrl,
                    foodItemIds: comboMeal.foodItemIds || [],
                  },
                };
              } catch (error) {
                console.error('Failed to fetch combo meal:', error);
                return item;
              }
            }
            return item;
          })
        );
        data.items = itemsWithNames;
      }
      
      setOrderDetails(data);
      setNewStatus(data.status);
    } catch (error: any) {
      notifications.show({
        title: t('common.error' as any, language) || 'Error',
        message: error?.response?.data?.message || t('orders.loadError', language),
        color: getErrorColor(),
      });
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id, language]); // Use order?.id instead of order to prevent unnecessary re-renders

  const loadInvoiceData = useCallback(async () => {
    try {
      const tenantData = await restaurantApi.getInfo();
      setTenant(tenantData);
      const branchId = order?.branchId;
      if (branchId) {
        const branches = await restaurantApi.getBranches(language);
        const branchData = branches.find(b => b.id === branchId);
        setBranch(branchData);
      }
    } catch (error) {
      console.error('Failed to load invoice data:', error);
    }
  }, [order?.branchId, language]); // Use order.branchId to prevent duplicate calls when orderDetails changes

  // Use ref to track if we've already loaded data for this order/language combination
  const loadedRef = useRef<{ orderId?: string; language?: string }>({});
  
  useEffect(() => {
    if (opened && order) {
      const orderId = order.id;
      const currentKey = `${orderId}-${language}`;
      const lastKey = loadedRef.current.orderId && loadedRef.current.language 
        ? `${loadedRef.current.orderId}-${loadedRef.current.language}` 
        : null;
      
      // Only reload if order ID or language changed
      if (currentKey !== lastKey) {
        setOrderDetails(order);
        setNewStatus(order.status);
        // Always reload order details to ensure we have latest data including translations
        loadOrderDetails();
        // Load tenant and branch info for invoice
        loadInvoiceData();
        loadedRef.current = { orderId, language };
      } else if (!orderDetails) {
        // If orderDetails is null but we have order, set it
        setOrderDetails(order);
        setNewStatus(order.status);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, order?.id, language]); // Only depend on order.id and language, not the callback functions

  const handleStatusUpdate = async () => {
    if (!orderDetails || !newStatus || newStatus === orderDetails.status) return;

    setUpdating(true);
    try {
      await ordersApi.updateOrderStatus(orderDetails.id, { status: newStatus });
      notifications.show({
        title: t('common.success' as any, language) || 'Success',
        message: t('orders.statusUpdated', language),
        color: getSuccessColor(),
      });
      
      // Notify other screens about the status change
      const { notifyOrderUpdate } = await import('@/lib/utils/order-events');
      notifyOrderUpdate('order-status-changed', orderDetails.id);
      
      if (onStatusUpdate) {
        onStatusUpdate();
      } else {
        // Reload order details
        await loadOrderDetails();
      }
    } catch (error: any) {
      notifications.show({
        title: t('common.error' as any, language) || 'Error',
        message: error?.response?.data?.message || t('orders.updateError', language),
        color: getErrorColor(),
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleMarkAsPaidSuccess = async () => {
    await loadOrderDetails();
    if (onStatusUpdate) {
      onStatusUpdate();
    }
  };

  const handlePrintSplitInvoice = async (splitPayment: BillSplitPayment, template: 'thermal' | 'a4' = 'thermal') => {
    if (!orderDetails || !tenant) return;

    // Load bill split if not already loaded
    let currentBillSplit = billSplit;
    if (!currentBillSplit && orderDetails.isSplitBill && orderDetails.billSplitId) {
      try {
        currentBillSplit = await ordersApi.getBillSplit(orderDetails.id);
        setBillSplit(currentBillSplit);
      } catch (error) {
        console.error('Failed to load bill split for invoice:', error);
      }
    }

    setPrinting(true);
    try {
      const isEqualSplit = currentBillSplit?.splitType === 'equal';
      const splitItems = splitPayment.items || [];
      
      // For equal splits, show all items with proportional amounts
      // For per-person splits, show only items assigned to this split
      let orderItemsForSplit: any[] = [];
      let splitSubtotal: number;
      let splitTax: number;
      let splitDiscount: number;
      let splitDelivery: number;
      let adjustmentRatio = 1; // Adjustment ratio for normalizing totals (used for per-person splits)
      
      if (isEqualSplit) {
        // Equal split: show all order items with proportional amounts
        orderItemsForSplit = orderDetails.items || [];
        
        // Calculate proportional ratio based on split amount vs order total
        const orderTotal = orderDetails.totalAmount || 0;
        const splitAmount = splitPayment.amount || 0;
        const ratio = orderTotal > 0 ? splitAmount / orderTotal : 0;
        
        // Calculate proportional breakdown
        splitSubtotal = (orderDetails.subtotal || 0) * ratio;
        splitTax = (orderDetails.taxAmount || 0) * ratio;
        splitDiscount = (orderDetails.discountAmount || 0) * ratio;
        splitDelivery = (orderDetails.deliveryCharge || 0) * ratio;
      } else {
        // Per-person split: use items assigned to this split
        orderItemsForSplit = orderDetails.items?.filter(item => 
          splitItems.some((si: any) => si.orderItemId === item.id)
        ) || [];
        
        // Calculate from split items
        let baseSubtotal = 0;
        orderItemsForSplit.forEach(item => {
          const splitItem = splitItems.find((si: any) => si.orderItemId === item.id);
          if (splitItem) {
            const unitPrice = item.unitPrice || 0;
            baseSubtotal += unitPrice * splitItem.quantity;
          }
        });
        
        // Calculate proportional tax, discount, delivery
        const orderSubtotal = orderDetails.subtotal || 0;
        const ratio = orderSubtotal > 0 ? baseSubtotal / orderSubtotal : 0;
        splitSubtotal = baseSubtotal;
        splitTax = (orderDetails.taxAmount || 0) * ratio;
        splitDiscount = (orderDetails.discountAmount || 0) * ratio;
        splitDelivery = (orderDetails.deliveryCharge || 0) * ratio;
        
        // Normalize totals to match the actual split payment amount
        // The splitPayment.amount is the source of truth (amount WITHOUT tip)
        // Use the same normalization logic as getPersonTotals to match UI display
        const actualTotalWithoutTip = splitPayment.amount;
        const calculatedTotalWithoutTip = splitSubtotal + splitTax + splitDelivery - splitDiscount;
        
        // If there's a rounding difference, normalize using the same logic as getPersonTotals
        // This ensures tax and discount match what's shown in the UI
        if (Math.abs(actualTotalWithoutTip - calculatedTotalWithoutTip) > 0.001 && calculatedTotalWithoutTip > 0) {
          const difference = actualTotalWithoutTip - calculatedTotalWithoutTip;
          
          // For small differences (typically rounding), adjust tax
          // For larger differences, adjust discount instead to preserve tax accuracy
          if (Math.abs(difference) <= 1.0) {
            // Small rounding difference - adjust tax (matches getPersonTotals logic)
            splitTax = Math.max(0, splitTax + difference); // Ensure tax doesn't go negative
            // Preserve subtotal, discount, and delivery
            adjustmentRatio = 1; // No adjustment needed for items since subtotal is preserved
          } else {
            // Larger difference - adjust discount to preserve tax accuracy (matches getPersonTotals logic)
            splitDiscount = Math.max(0, splitDiscount - difference); // Subtract because discount reduces total
            // Preserve subtotal, tax, and delivery
            adjustmentRatio = 1; // No adjustment needed for items since subtotal is preserved
          }
        } else {
          // No normalization needed
          adjustmentRatio = 1;
        }
      }
      
      const splitTip = splitPayment.tipAmount || 0;
      const splitTotal = splitPayment.amount + splitTip; // Amount (without tip) + tip = total

      // Prepare invoice data for this split
      const invoiceData = {
        order: {
          ...orderDetails,
          orderType: orderDetails.orderType,
          paymentMethod: splitPayment.paymentMethod,
          paymentStatus: splitPayment.status === 'paid' ? 'paid' : 'unpaid',
          totalAmount: splitTotal,
          subtotal: splitSubtotal,
          taxAmount: splitTax,
          discountAmount: splitDiscount,
          deliveryCharge: splitDelivery,
          tipAmount: splitTip,
          items: orderItemsForSplit.map(item => {
            // For equal splits, calculate proportional subtotal
            // For per-person splits, use the quantity from splitItems
            let itemSubtotal = item.subtotal || 0;
            let itemQuantity = item.quantity || 0;
            
            if (isEqualSplit) {
              // Calculate proportional amount for this item
              const orderTotal = orderDetails.totalAmount || 0;
              const splitAmount = splitPayment.amount || 0;
              const ratio = orderTotal > 0 ? splitAmount / orderTotal : 0;
              itemSubtotal = itemSubtotal * ratio;
              // Keep original quantity for display
            } else {
              // Per-person split: use quantity from splitItems
              const splitItem = splitItems.find((si: any) => si.orderItemId === item.id);
              if (splitItem) {
                itemQuantity = splitItem.quantity;
                // Recalculate subtotal based on split quantity
                const unitPrice = item.unitPrice || 0;
                itemSubtotal = unitPrice * itemQuantity;
                
                // Apply the same adjustment ratio that was applied to totals
                // This ensures item subtotals match the normalized breakdown
                if (adjustmentRatio !== 1) {
                  itemSubtotal = itemSubtotal * adjustmentRatio;
                }
              }
            }
            
            return {
              ...item,
              quantity: itemQuantity,
              subtotal: itemSubtotal,
              foodItemName: (item.buffetId || item.buffet) 
                ? (item.buffet?.name?.trim() || (item.buffetId ? `Buffet #${item.buffetId.substring(0, 8)}...` : 'Buffet'))
                : (item.comboMealId || item.comboMeal)
                ? (item.comboMeal?.name?.trim() || (item.comboMealId ? `Combo Meal #${item.comboMealId.substring(0, 8)}...` : 'Combo Meal'))
                : (item.foodItem?.name || ''),
              variationName: (() => {
                // Support both old single variation format and new multiple variations format
                if (item.variations && Array.isArray(item.variations) && item.variations.length > 0) {
                  // New format: multiple variations - group by variation group
                  const groupedByGroup: Record<string, string[]> = {};
                  item.variations.forEach((v: { variationGroupName?: string; variationGroup?: string; variationName?: string }) => {
                    const groupName = v.variationGroupName || v.variationGroup || '';
                    if (!groupedByGroup[groupName]) {
                      groupedByGroup[groupName] = [];
                    }
                    groupedByGroup[groupName].push(v.variationName || '');
                  });
                  
                  return Object.entries(groupedByGroup)
                    .map(([groupName, variationNames]) => `${groupName}: ${variationNames.join(', ')}`)
                    .join('; ');
                } else if (item.variation?.variationName) {
                  // Old format: single variation (backward compatibility)
                  const groupName = item.variation.variationGroupName || item.variation.variationGroup || '';
                  return groupName ? `${groupName}: ${item.variation.variationName}` : item.variation.variationName;
                }
                return '';
              })(),
              addOns: item.addOns?.map((a: any) => ({
                addOnName: a.addOn?.name || '',
              })) || [],
            };
          }),
        } as any,
        tenant: {
          ...tenant,
          footerText: settings?.invoice?.footerText || '',
          termsAndConditions: settings?.invoice?.termsAndConditions || '',
        },
        branch: branch || undefined,
        invoiceSettings: {
          headerText: settings?.invoice?.headerText,
          footerText: settings?.invoice?.footerText,
          termsAndConditions: settings?.invoice?.termsAndConditions,
          showLogo: settings?.invoice?.showLogo,
          showVatNumber: settings?.invoice?.showVatNumber,
          showQrCode: settings?.invoice?.showQrCode,
        },
        customerName: splitPayment.personName || orderDetails.customer?.name || undefined,
        customerPhone: orderDetails.customer?.phone,
        customerAddress: undefined,
        splitInfo: {
          splitNumber: splitPayment.personIndex,
          totalSplits: currentBillSplit?.payments?.length || 1,
        },
      };

      const html = template === 'thermal'
        ? InvoiceGenerator.generateThermal(invoiceData, language, themeConfig)
        : InvoiceGenerator.generateA4(invoiceData, language, themeConfig);

      InvoiceGenerator.printInvoice(html);
    } catch (error: any) {
      notifications.show({
        title: t('common.error' as any, language),
        message: error?.message || 'Failed to generate invoice',
        color: getErrorColor(),
      });
    } finally {
      setPrinting(false);
    }
  };

  const handleDiscardSplit = async () => {
    if (!orderDetails) return;

    try {
      await ordersApi.deleteBillSplit(orderDetails.id);
      notifications.show({
        title: t('common.success' as any, language) || 'Success',
        message: t('orders.splitDiscarded', language) || 'Bill split discarded successfully',
        color: getSuccessColor(),
        icon: <IconCheck size={16} />,
      });
      await loadOrderDetails();
      if (onStatusUpdate) {
        onStatusUpdate();
      }
      setUnifiedPaymentModalOpened(false);
    } catch (error: any) {
      notifications.show({
        title: t('common.error' as any, language) || 'Error',
        message: error?.response?.data?.message || error?.message || 'Failed to discard bill split',
        color: getErrorColor(),
      });
    }
  };

  const getStatusColorForBadge = (status: OrderStatus): string => {
    return getStatusColor(status);
  };

  const getOrderTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      dine_in: t('pos.dineIn', language),
      takeaway: t('pos.takeaway', language),
      delivery: t('pos.delivery', language),
    };
    return labels[type] || type;
  };

  const handlePrintInvoice = async (template: 'thermal' | 'a4' = 'thermal') => {
    if (!orderDetails || !tenant) return;

    setPrinting(true);
    try {
      // Load bill split if order is split and not already loaded
      let currentBillSplit = billSplit;
      if (!currentBillSplit && orderDetails.isSplitBill && orderDetails.billSplitId) {
        try {
          currentBillSplit = await ordersApi.getBillSplit(orderDetails.id);
          setBillSplit(currentBillSplit);
        } catch (error) {
          console.error('Failed to load bill split for invoice:', error);
        }
      }
      
      // Extract payment method from payments array if available
      const payments = (orderDetails as any).payments || [];
      const paymentMethod = (orderDetails as any).paymentMethod || 
        (payments.length > 0 ? payments[payments.length - 1]?.paymentMethod || payments[0]?.payment_method : undefined);
      
      // Calculate total tip: if split, sum all payment tips; otherwise use order tip or sum from payments
      let totalTip = 0;
      if (currentBillSplit) {
        // Split order: sum all split payment tips
        totalTip = currentBillSplit.payments.reduce((sum, payment) => sum + (payment.tipAmount || 0), 0);
      } else {
        // Non-split order: check order tipAmount first, then sum from payments array
        totalTip = orderDetails.tipAmount || 0;
        if (totalTip === 0 && payments.length > 0) {
          // Sum tips from payments array if order tipAmount is not set
          totalTip = payments.reduce((sum: number, payment: any) => {
            return sum + (payment.tipAmount || payment.tip_amount || 0);
          }, 0);
        }
      }
      
      // Prepare invoice data
      const invoiceData = {
        order: {
          ...orderDetails,
          orderType: orderDetails.orderType,
          paymentMethod: paymentMethod,
          tipAmount: totalTip, // Use total tip for split orders
          items: orderDetails.items?.map(item => ({
            ...item,
            foodItemName: (item.buffetId || item.buffet) 
              ? (item.buffet?.name?.trim() || (item.buffetId ? `Buffet #${item.buffetId.substring(0, 8)}...` : 'Buffet'))
              : (item.comboMealId || item.comboMeal)
              ? (item.comboMeal?.name?.trim() || (item.comboMealId ? `Combo Meal #${item.comboMealId.substring(0, 8)}...` : 'Combo Meal'))
              : (item.foodItem?.name || ''),
            variationName: (() => {
              // Support both old single variation format and new multiple variations format
              if (item.variations && Array.isArray(item.variations) && item.variations.length > 0) {
                // New format: multiple variations - group by variation group
                const groupedByGroup: Record<string, string[]> = {};
                item.variations.forEach((v) => {
                  const groupName = v.variationGroupName || v.variationGroup || '';
                  if (!groupedByGroup[groupName]) {
                    groupedByGroup[groupName] = [];
                  }
                  groupedByGroup[groupName].push(v.variationName || '');
                });
                
                return Object.entries(groupedByGroup)
                  .map(([groupName, variationNames]) => `${groupName}: ${variationNames.join(', ')}`)
                  .join('; ');
              } else if (item.variation?.variationName) {
                // Old format: single variation (backward compatibility)
                const groupName = item.variation.variationGroupName || item.variation.variationGroup || '';
                return groupName ? `${groupName}: ${item.variation.variationName}` : item.variation.variationName;
              }
              return '';
            })(),
            addOns: item.addOns?.map(a => ({
              addOnName: a.addOn?.name || '',
            })) || [],
          })) || [],
        } as any,
        tenant: {
          ...tenant,
          footerText: settings?.invoice?.footerText || '',
          termsAndConditions: settings?.invoice?.termsAndConditions || '',
        },
        branch: branch || undefined,
        invoiceSettings: {
          headerText: settings?.invoice?.headerText,
          footerText: settings?.invoice?.footerText,
          termsAndConditions: settings?.invoice?.termsAndConditions,
          showLogo: settings?.invoice?.showLogo,
          showVatNumber: settings?.invoice?.showVatNumber,
          showQrCode: settings?.invoice?.showQrCode,
        },
        customerName: orderDetails.customer
          ? (orderDetails.customer.name || '')
          : undefined,
        customerPhone: orderDetails.customer?.phone,
        customerAddress: undefined, // Can be added from delivery address if needed
      };

      const html = template === 'thermal'
        ? InvoiceGenerator.generateThermal(invoiceData, language, themeConfig)
        : InvoiceGenerator.generateA4(invoiceData, language, themeConfig);

      InvoiceGenerator.printInvoice(html);
    } catch (error: any) {
      notifications.show({
        title: t('common.error' as any, language),
        message: error?.message || 'Failed to generate invoice',
        color: getErrorColor(),
      });
    } finally {
      setPrinting(false);
    }
  };

  if (!orderDetails) return null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('orders.orderDetails', language)}
      size="lg"
      centered
    >
      {loading ? (
        <Stack gap="md">
          {/* Order Header Skeleton */}
          <Paper p="md" withBorder>
            <Grid>
              <Grid.Col span={6}>
                <Skeleton height={12} width="40%" mb="xs" />
                <Skeleton height={20} width="60%" />
              </Grid.Col>
              <Grid.Col span={6}>
                <Skeleton height={12} width="40%" mb="xs" />
                <Skeleton height={24} width="50%" />
              </Grid.Col>
              <Grid.Col span={6}>
                <Skeleton height={12} width="40%" mb="xs" />
                <Skeleton height={16} width="50%" />
              </Grid.Col>
              <Grid.Col span={6}>
                <Skeleton height={12} width="40%" mb="xs" />
                <Skeleton height={16} width="60%" />
              </Grid.Col>
              <Grid.Col span={6}>
                <Skeleton height={12} width="40%" mb="xs" />
                <Skeleton height={16} width="50%" />
              </Grid.Col>
              <Grid.Col span={6}>
                <Skeleton height={12} width="40%" mb="xs" />
                <Skeleton height={24} width="40%" />
              </Grid.Col>
            </Grid>
          </Paper>

          {/* Customer Info Skeleton */}
          <Paper p="md" withBorder>
            <Skeleton height={16} width="30%" mb="sm" />
            <Grid>
              <Grid.Col span={6}>
                <Skeleton height={12} width="40%" mb="xs" />
                <Skeleton height={16} width="60%" />
              </Grid.Col>
              <Grid.Col span={6}>
                <Skeleton height={12} width="40%" mb="xs" />
                <Skeleton height={16} width="50%" />
              </Grid.Col>
              <Grid.Col span={6}>
                <Skeleton height={12} width="40%" mb="xs" />
                <Skeleton height={16} width="70%" />
              </Grid.Col>
              <Grid.Col span={6}>
                <Skeleton height={12} width="40%" mb="xs" />
                <Skeleton height={16} width="60%" />
              </Grid.Col>
            </Grid>
          </Paper>

          {/* Order Items Skeleton */}
          <Paper p="md" withBorder>
            <Skeleton height={16} width="30%" mb="sm" />
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th><Skeleton height={14} width="60%" /></Table.Th>
                  <Table.Th><Skeleton height={14} width="40%" /></Table.Th>
                  <Table.Th><Skeleton height={14} width="50%" /></Table.Th>
                  <Table.Th><Skeleton height={14} width="50%" /></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {[1, 2, 3].map((i) => (
                  <Table.Tr key={i}>
                    <Table.Td>
                      <Skeleton height={16} width="70%" mb="xs" />
                      <Skeleton height={12} width="50%" />
                    </Table.Td>
                    <Table.Td><Skeleton height={16} width="30%" /></Table.Td>
                    <Table.Td><Skeleton height={16} width="50%" /></Table.Td>
                    <Table.Td><Skeleton height={16} width="50%" /></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>

          {/* Billing Summary Skeleton */}
          <Paper p="md" withBorder>
            <Skeleton height={16} width="30%" mb="sm" />
            <Stack gap="xs">
              <Group justify="space-between">
                <Skeleton height={14} width="30%" />
                <Skeleton height={14} width="20%" />
              </Group>
              <Group justify="space-between">
                <Skeleton height={14} width="30%" />
                <Skeleton height={14} width="20%" />
              </Group>
              <Divider />
              <Group justify="space-between">
                <Skeleton height={18} width="40%" />
                <Skeleton height={18} width="25%" />
              </Group>
            </Stack>
          </Paper>

          {/* Status Update Skeleton */}
          <Paper p="md" withBorder>
            <Skeleton height={16} width="30%" mb="sm" />
            <Group>
              <Skeleton height={36} style={{ flex: 1 }} />
              <Skeleton height={36} width={100} />
            </Group>
          </Paper>
        </Stack>
      ) : (
        <Stack gap="md">
          {/* Order Header */}
          <Paper p="md" withBorder>
            <Grid>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed" mb={4}>
                  {t('pos.orderNumber', language)}
                </Text>
                <Text fw={600} size="lg">
                  {orderDetails.orderNumber}
                </Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed" mb={4}>
                  {t('orders.status', language)}
                </Text>
                <Badge variant="light" color={getStatusColorForBadge(orderDetails.status)} size="lg">
                  {t(`orders.status.${orderDetails.status}`, language) || orderDetails.status}
                </Badge>
              </Grid.Col>
              {orderDetails.tokenNumber && (
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed" mb={4}>
                    {t('pos.tokenNumber', language)}
                  </Text>
                  <Text fw={500}>{orderDetails.tokenNumber}</Text>
                </Grid.Col>
              )}
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed" mb={4}>
                  {t('pos.orderDate', language)}
                </Text>
                <Text style={{ lineHeight: '1.5' }}>
                  {formatDateTime(orderDetails.orderDate)}
                </Text>
              </Grid.Col>
              {!orderDetails.tokenNumber && (
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed" mb={4}>
                    {t('pos.orderType', language)}
                  </Text>
                  <Text>{getOrderTypeLabel(orderDetails.orderType)}</Text>
                </Grid.Col>
              )}
              {orderDetails.tokenNumber && (
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed" mb={4}>
                    {t('pos.orderType', language)}
                  </Text>
                  <Text>{getOrderTypeLabel(orderDetails.orderType)}</Text>
                </Grid.Col>
              )}
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed" mb={4}>
                  {t('orders.paymentStatus', language)}
                </Text>
                <Group gap="xs" align="center">
                  <Badge
                    color={getPaymentStatusColor(orderDetails.paymentStatus)}
                    variant="light"
                  >
                    {t(`orders.payment.${orderDetails.paymentStatus}`, language) || orderDetails.paymentStatus}
                  </Badge>
                  {orderDetails.paymentStatus !== 'paid' && isMarkAsPaidEnabledForUser() && (
                    <Button
                      size="xs"
                      variant="light"
                      color={getSuccessColor()}
                      onClick={() => setUnifiedPaymentModalOpened(true)}
                      leftSection={<IconCheck size={14} />}
                    >
                      {t('orders.markAsPaid', language)}
                    </Button>
                  )}
                </Group>
              </Grid.Col>
            </Grid>
          </Paper>

          {/* Customer & Branch Info */}
          {((orderDetails.customer && orderDetails.customer.name) ||
            (orderDetails.branch && orderDetails.branch.name) ||
            (orderDetails.table && orderDetails.table.table_number)) && (
            <Paper p="md" withBorder>
              <Text fw={600} mb="sm">
                {t('orders.customerInfo', language)}
              </Text>
              <Grid>
                {orderDetails.branch && orderDetails.branch.name && (
                  <Grid.Col span={6}>
                    <Text size="sm" c="dimmed">
                      {t('restaurant.branch', language)}
                    </Text>
                    <Text>
                      {branch?.name || orderDetails.branch.name || '-'}
                    </Text>
                  </Grid.Col>
                )}
                {(((orderDetails as any).tables && (orderDetails as any).tables.length > 0) || (orderDetails.table && orderDetails.table.table_number)) && (
                  <Grid.Col span={6}>
                    <Text size="sm" c="dimmed">
                      {t('pos.tableNo', language)}
                    </Text>
                    <Text>
                      {(orderDetails as any).tables && (orderDetails as any).tables.length > 0
                        ? (orderDetails as any).tables.map((t: any) => t.table_number).join(', ')
                        : (orderDetails.table?.table_number || '')}
                    </Text>
                  </Grid.Col>
                )}
                {orderDetails.customer && orderDetails.customer.name && (
                  <>
                    <Grid.Col span={6}>
                      <Text size="sm" c="dimmed">
                        {t('pos.customerName', language)}
                      </Text>
                      <Text>
                        {orderDetails.customer.name || '-'}
                      </Text>
                    </Grid.Col>
                    {orderDetails.customer.phone && (
                      <Grid.Col span={6}>
                        <Text size="sm" c="dimmed">
                          {t('pos.customerPhone', language)}
                        </Text>
                        <Text>{orderDetails.customer.phone}</Text>
                      </Grid.Col>
                    )}
                  </>
                )}
              </Grid>
            </Paper>
          )}

          {/* Order Items */}
          {orderDetails.items && orderDetails.items.length > 0 && (
            <Paper p="md" withBorder>
              <Text fw={600} mb="sm">
                {t('pos.cartItems', language)}
              </Text>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('pos.item', language)}</Table.Th>
                    <Table.Th>{t('pos.quantity', language)}</Table.Th>
                    <Table.Th>{t('pos.price', language)}</Table.Th>
                    <Table.Th>{t('pos.subtotal', language)}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {orderDetails.items.map((item) => (
                    <Table.Tr key={item.id}>
                      <Table.Td>
                        <Stack gap={4}>
                          <Text fw={500}>
                            {(item.buffetId || item.buffet)
                              ? (item.buffet?.name?.trim() || (item.buffetId ? `Buffet #${item.buffetId.substring(0, 8)}...` : 'Buffet'))
                              : (item.comboMealId || item.comboMeal)
                              ? (item.comboMeal?.name?.trim() || (item.comboMealId ? `Combo Meal #${item.comboMealId.substring(0, 8)}...` : 'Combo Meal'))
                              : (item.foodItemId || item.foodItem)
                              ? (item.foodItem?.name || t('pos.item', language))
                              : t('pos.item', language) + ` #${item.foodItemId || item.id}`}
                          </Text>
                          {/* Display variations grouped by variation group */}
                          {(() => {
                            // Support both old single variation format and new multiple variations format
                            const variationsToDisplay: Array<{ groupName: string; variationName: string }> = [];
                            
                            if (item.variations && Array.isArray(item.variations) && item.variations.length > 0) {
                              // New format: multiple variations
                              const groupedByGroup: Record<string, string[]> = {};
                              item.variations.forEach((v) => {
                                const groupName = v.variationGroupName || v.variationGroup || '';
                                if (!groupedByGroup[groupName]) {
                                  groupedByGroup[groupName] = [];
                                }
                                groupedByGroup[groupName].push(v.variationName || '');
                              });
                              
                              Object.entries(groupedByGroup).forEach(([groupName, variationNames]) => {
                                variationsToDisplay.push({
                                  groupName,
                                  variationName: variationNames.join(', '),
                                });
                              });
                            } else if (item.variation && item.variation.variationName) {
                              // Old format: single variation (backward compatibility)
                              variationsToDisplay.push({
                                groupName: item.variation.variationGroupName || item.variation.variationGroup || '',
                                variationName: item.variation.variationName,
                              });
                            }
                            
                            return variationsToDisplay.length > 0 ? (
                              <Stack gap={4}>
                                {variationsToDisplay.map((variation, idx) => (
                                  <Text key={idx} size="xs" c="dimmed">
                                    {variation.groupName}: {variation.variationName}
                                  </Text>
                                ))}
                              </Stack>
                            ) : null;
                          })()}
                          {item.addOns && item.addOns.length > 0 && item.addOns.some(a => a.addOn) && (
                            <Text size="xs" c="dimmed">
                              {t('pos.addOns', language)}:{' '}
                              {item.addOns
                                .filter(addOn => addOn.addOn)
                                .map(
                                  (addOn) =>
                                    addOn.addOn?.name || ''
                                )
                                .filter(Boolean)
                                .join(', ') || '-'}
                            </Text>
                          )}
                          {item.specialInstructions && (
                            <Text size="xs" c="dimmed" fs="italic">
                              {item.specialInstructions}
                            </Text>
                          )}
                        </Stack>
                      </Table.Td>
                      <Table.Td>{item.quantity}</Table.Td>
                      <Table.Td>{formatCurrency(item.unitPrice || 0, currency)}</Table.Td>
                      <Table.Td>{formatCurrency(item.subtotal || 0, currency)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>
          )}

          {/* Billing Summary */}
          <Paper p="md" withBorder>
            <Text fw={600} mb="sm">
              {t('pos.billingSummary', language)}
            </Text>
            <Stack gap="xs">
              <Group justify="space-between">
                <Text>{t('pos.subtotal', language)}</Text>
                <Text>{(orderDetails.subtotal || 0).toFixed(2)} {currency}</Text>
              </Group>
              {(orderDetails.discountAmount || 0) > 0 && (
                <Group justify="space-between">
                  <Text c={getSuccessColor()}>{t('pos.discount', language)}</Text>
                  <Text c={getSuccessColor()}>-{formatCurrency(orderDetails.discountAmount || 0, currency)}</Text>
                </Group>
              )}
              {(orderDetails.taxAmount || 0) > 0 && (
                <Group justify="space-between">
                  <Text>{t('pos.tax', language)}</Text>
                  <Text>{formatCurrency(orderDetails.taxAmount || 0, currency)}</Text>
                </Group>
              )}
              {(orderDetails.deliveryCharge || 0) > 0 && (
                <Group justify="space-between">
                  <Text>{t('pos.deliveryCharge', language)}</Text>
                  <Text>{formatCurrency(orderDetails.deliveryCharge || 0, currency)}</Text>
                </Group>
              )}
              {(() => {
                // Calculate total tip: if split, sum all payment tips; otherwise use order tip or sum from payments
                let totalTip = 0;
                if (billSplit) {
                  // Split order: sum all split payment tips
                  totalTip = billSplit.payments.reduce((sum, payment) => sum + (payment.tipAmount || 0), 0);
                } else {
                  // Non-split order: check order tipAmount first, then sum from payments array
                  totalTip = orderDetails.tipAmount || 0;
                  if (totalTip === 0 && (orderDetails as any).payments) {
                    // Sum tips from payments array if order tipAmount is not set
                    totalTip = (orderDetails as any).payments.reduce((sum: number, payment: any) => {
                      return sum + (payment.tipAmount || payment.tip_amount || 0);
                    }, 0);
                  }
                }
                
                return totalTip > 0 ? (
                  <Group justify="space-between">
                    <Text>{billSplit ? (t('orders.totalTip' as any, language) || 'Total Tip') : (t('orders.tip', language) || 'Tip')}</Text>
                    <Text>{formatCurrency(totalTip, currency)}</Text>
                  </Group>
                ) : null;
              })()}
              <Divider />
              <Group justify="space-between">
                <Text fw={700} size="lg">
                  {t('pos.grandTotal', language)}
                </Text>
                <Text fw={700} size="lg">
                  {(() => {
                    // Calculate total including tip
                    let totalTip = 0;
                    if (billSplit) {
                      totalTip = billSplit.payments.reduce((sum, payment) => sum + (payment.tipAmount || 0), 0);
                    } else {
                      totalTip = orderDetails.tipAmount || 0;
                      if (totalTip === 0 && (orderDetails as any).payments) {
                        totalTip = (orderDetails as any).payments.reduce((sum: number, payment: any) => {
                          return sum + (payment.tipAmount || payment.tip_amount || 0);
                        }, 0);
                      }
                    }
                    return formatCurrency((orderDetails.totalAmount || 0) + totalTip, currency);
                  })()}
                </Text>
              </Group>
            </Stack>
          </Paper>

          {/* Bill Split Information */}
          {billSplit && (
            <Paper p="md" withBorder>
              <Group justify="space-between" mb="md">
                <Text fw={600}>
                  {t('orders.billSplit', language) || 'Bill Split'} ({billSplit.splitType === 'equal' ? t('orders.equalSplit', language) : t('orders.perPersonSplit', language)})
                </Text>
                <Badge color="blue" variant="light">
                  {billSplit.payments.filter(p => p.status === 'paid').length} / {billSplit.payments.length} {t('orders.paid', language) || 'Paid'}
                </Badge>
              </Group>
              <Stack gap="sm">
                {billSplit.payments.map((payment, index) => (
                  <Paper key={payment.id || index} p="sm" withBorder>
                    <Group justify="space-between">
                      <Stack gap="xs">
                        <Text fw={500}>
                          {payment.personName || `${t('orders.person', language) || 'Person'} ${payment.personIndex}`}
                        </Text>
                        <Group gap="xs">
                          <Text size="sm" c="dimmed">
                            {t('orders.amount', language) || 'Amount'}: {formatCurrency(payment.amount, currency)}
                          </Text>
                          {payment.tipAmount > 0 && (
                            <Text size="sm" c="dimmed">
                              {t('orders.tip', language) || 'Tip'}: {formatCurrency(payment.tipAmount, currency)}
                            </Text>
                          )}
                          <Badge color={payment.status === 'paid' ? 'green' : 'gray'} variant="light">
                            {payment.status === 'paid' ? t('orders.paid', language) || 'Paid' : t('orders.pending', language) || 'Pending'}
                          </Badge>
                        </Group>
                      </Stack>
                      {payment.status === 'pending' && (
                        <Button
                          size="xs"
                          variant="light"
                          color="blue"
                          onClick={() => {
                            setUnifiedPaymentModalOpened(true);
                          }}
                          leftSection={<IconCreditCard size={14} />}
                        >
                          {t('orders.paySplit', language) || 'Pay'}
                        </Button>
                      )}
                    </Group>
                  </Paper>
                ))}
              </Stack>
            </Paper>
          )}

          {/* Status Update */}
          <Paper p="md" withBorder>
            <Text fw={600} mb="sm">
              {t('orders.updateStatus', language)}
            </Text>
            <Group>
              <Select
                data={statusOptions.map((opt) => ({
                  value: opt.value,
                  label: t(`orders.status.${opt.value}`, language),
                }))}
                value={newStatus || orderDetails.status}
                onChange={(value) => setNewStatus(value as OrderStatus)}
                style={{ flex: 1 }}
              />
              <Button
                onClick={handleStatusUpdate}
                loading={updating}
                disabled={!newStatus || newStatus === orderDetails.status}
                leftSection={<IconCheck size={16} />}
              >
                {t('common.save' as any, language) || 'Save'}
              </Button>
            </Group>
          </Paper>

          {/* Actions */}
          <Group justify="flex-end">
            <Button
              leftSection={<IconPrinter size={16} />}
              onClick={() => handlePrintInvoice('thermal')}
              loading={printing}
              variant="light"
            >
              {t('orders.printThermal' as any, language) || 'Print (Thermal)'}
            </Button>
            <Button
              leftSection={<IconPrinter size={16} />}
              onClick={() => handlePrintInvoice('a4')}
              loading={printing}
              variant="light"
            >
              {t('orders.printA4' as any, language) || 'Print (A4)'}
            </Button>
            {orderDetails.paymentStatus !== 'paid' && (
              <Button
                leftSection={<IconEdit size={16} />}
                onClick={handleEditOrder}
                variant="light"
              >
                {t('orders.editOrder', language) || 'Edit Order'}
              </Button>
            )}
            <Button variant="subtle" onClick={onClose}>
              {t('common.cancel' as any, language) || 'Cancel'}
            </Button>
          </Group>
        </Stack>
      )}

      {/* Unified Payment Modal */}
      {orderDetails && (
        <UnifiedPaymentModal
          opened={unifiedPaymentModalOpened}
          onClose={() => {
            setUnifiedPaymentModalOpened(false);
            loadOrderDetails();
          }}
          order={orderDetails}
          onSuccess={async () => {
            await loadOrderDetails();
            if (onStatusUpdate) {
              onStatusUpdate();
            }
          }}
          onPrintSplitInvoice={(splitPayment) => handlePrintSplitInvoice(splitPayment, 'thermal')}
        />
      )}
    </Modal>
  );
}

