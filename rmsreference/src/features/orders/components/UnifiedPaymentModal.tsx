'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Modal,
  Stack,
  Text,
  Group,
  Button,
  Paper,
  Select,
  Divider,
  SegmentedControl,
  NumberInput,
  TextInput,
  Badge,
  ScrollArea,
  Skeleton,
  useMantineTheme,
  Grid,
  ActionIcon,
  Box,
} from '@mantine/core';
import {
  IconCheck,
  IconUsers,
  IconCreditCard,
  IconUser,
  IconShoppingCart,
  IconX,
  IconPrinter,
  IconTrash,
  IconArrowLeft,
  IconPlus,
  IconMinus,
  IconGripVertical,
} from '@tabler/icons-react';
import { useLanguageStore } from '@/lib/store/language-store';
import { t } from '@/lib/utils/translations';
import { formatCurrency } from '@/lib/utils/currency-formatter';
import { useCurrency } from '@/lib/hooks/use-currency';
import {
  ordersApi,
  Order,
  OrderItem,
  CreateBillSplitDto,
  CreateBillSplitPaymentDto,
  BillSplit,
  BillSplitPayment,
  UpdatePaymentStatusDto,
} from '@/lib/api/orders';
import { notifications } from '@mantine/notifications';
import { getSuccessColor, getErrorColor, getWarningColor, getThemeColor } from '@/lib/utils/theme';
import { TipInput } from './TipInput';
import { useSettings } from '@/lib/hooks/use-settings';
import { ConfirmDialog } from './ConfirmDialog';
import { InvoiceGenerator } from '@/lib/utils/invoice-generator';
import { restaurantApi } from '@/lib/api/restaurant';
import type { ThemeConfig } from '@/lib/theme/themeConfig';

type ViewMode = 'markAsPaid' | 'splitBill' | 'splitPayment' | 'viewSplits';

interface UnifiedPaymentModalProps {
  opened: boolean;
  onClose: () => void;
  order: Order;
  onSuccess: () => void;
  onPrintSplitInvoice?: (splitPayment: BillSplitPayment) => void;
}

export function UnifiedPaymentModal({
  opened,
  onClose,
  order,
  onSuccess,
  onPrintSplitInvoice,
}: UnifiedPaymentModalProps) {
  const { language } = useLanguageStore();
  const currency = useCurrency();
  const { settings } = useSettings();
  const theme = useMantineTheme();
  const themeConfig = (theme.other as any) as ThemeConfig | undefined;
  const [printing, setPrinting] = useState(false);
  const [tenant, setTenant] = useState<any>(null);
  const [branch, setBranch] = useState<any>(null);

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('markAsPaid');
  const [confirmDialogOpened, setConfirmDialogOpened] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);

  // Mark as Paid state
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [tipAmount, setTipAmount] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Bill Split state
  const [splitType, setSplitType] = useState<'equal' | 'per_person'>('equal');
  const [numberOfPeople, setNumberOfPeople] = useState<number>(order.numberOfPersons || 2);
  const [splitPayments, setSplitPayments] = useState<CreateBillSplitPaymentDto[]>([]);
  const [personNames, setPersonNames] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<Map<number, Map<string, number>>>(new Map());
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [existingBillSplit, setExistingBillSplit] = useState<BillSplit | null>(null);
  const [loadingSplit, setLoadingSplit] = useState(false);
  const [isDiscardingSplit, setIsDiscardingSplit] = useState(false);
  const loadedOrderIdRef = useRef<string | null>(null);

  // Split Payment state
  const [selectedSplitPayment, setSelectedSplitPayment] = useState<BillSplitPayment | null>(null);
  const [splitPaymentTipAmount, setSplitPaymentTipAmount] = useState<number>(0);
  const [splitPaymentMethod, setSplitPaymentMethod] = useState<string>('');

  // Get enabled payment methods
  const enabledPaymentMethods = useMemo(() => {
    const methods: Array<{ label: string; value: string }> = [];
    if (settings?.paymentMethods?.enableCash === true) {
      methods.push({ label: t('pos.cash', language), value: 'cash' });
    }
    if (settings?.paymentMethods?.enableCard === true) {
      methods.push({ label: t('pos.card', language), value: 'card' });
    }
    if (methods.length === 0) {
      methods.push({ label: t('pos.cash', language), value: 'cash' });
    }
    return methods;
  }, [settings?.paymentMethods, language]);

  // Initialize order items
  useEffect(() => {
    if (order.items && order.items.length > 0) {
      setOrderItems(order.items);
    } else if (opened && order.id) {
      // If items are not loaded, try to fetch order details
      const loadOrderItems = async () => {
        try {
          const orderDetails = await ordersApi.getOrderById(order.id, language);
          if (orderDetails?.items && orderDetails.items.length > 0) {
            setOrderItems(orderDetails.items);
          }
        } catch (error) {
          console.error('Failed to load order items:', error);
        }
      };
      loadOrderItems();
    }
  }, [order.id, order.items, opened, language]);

  // Load tenant and branch data for invoice printing
  useEffect(() => {
    if (opened) {
      const loadTenantAndBranch = async () => {
        try {
          const tenantData = await restaurantApi.getInfo(language);
          setTenant(tenantData);
          if (order.branchId) {
            const branches = await restaurantApi.getBranches(language);
            const branchData = branches.find(b => b.id === order.branchId);
            setBranch(branchData);
          }
        } catch (error) {
          console.error('Failed to load tenant/branch data:', error);
        }
      };
      loadTenantAndBranch();
    }
  }, [opened, order.branchId, language]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (opened) {
      setViewMode('markAsPaid');
      setPaymentMethod(enabledPaymentMethods[0]?.value || 'cash');
      setTipAmount(0);
      setLoadingSplit(false);
      // Always reload split data when modal opens to get latest state
      // Reset loaded ref to force reload
      loadedOrderIdRef.current = null;
      setExistingBillSplit(null);
      // Load existing split in background without showing loading in markAsPaid view
      // Use forceReload to ensure we get the latest data
      loadExistingSplit(false, true).then((split) => {
        if (split) {
          // Check if all splits are paid when modal opens
          const allPaid = split.payments?.every((p: any) => p.status === 'paid') || false;
          if (allPaid && order.paymentStatus !== 'paid') {
            // All splits are paid but order status not updated - refresh order data
            onSuccess();
          }
        }
      }).catch(() => {
        // Ignore errors, just set to null
        setExistingBillSplit(null);
        loadedOrderIdRef.current = order.id;
      });
    } else {
      // Reset all state when modal closes
      setViewMode('markAsPaid');
      setExistingBillSplit(null);
      setSelectedSplitPayment(null);
      setSplitPaymentTipAmount(0);
      setSplitPaymentMethod('');
      setSplitPayments([]);
      setPersonNames([]);
      setSelectedItems(new Map());
      loadedOrderIdRef.current = null;
      setLoadingSplit(false);
      setIsDiscardingSplit(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, order.id]);

  // Calculate equal split amounts
  useEffect(() => {
    if (viewMode === 'splitBill' && splitType === 'equal') {
      const totalAmount = order.totalAmount || 0;
      const amountPerPerson = totalAmount / numberOfPeople;
      const newPayments: CreateBillSplitPaymentDto[] = [];
      const newNames: string[] = [];

      for (let i = 0; i < numberOfPeople; i++) {
        newPayments.push({
          amount: amountPerPerson,
          tipAmount: 0,
          paymentMethod: 'cash',
        });
        newNames.push('');
      }

      setSplitPayments(newPayments);
      setPersonNames(newNames);
    } else if (viewMode === 'splitBill' && splitType === 'per_person') {
      // Initialize per-person split
      const newPayments: CreateBillSplitPaymentDto[] = [];
      const newNames: string[] = [];
      const newSelectedItems = new Map<number, Map<string, number>>();

      for (let i = 0; i < numberOfPeople; i++) {
        newPayments.push({
          amount: 0,
          tipAmount: 0,
          paymentMethod: 'cash',
          items: [],
        });
        newNames.push('');
        newSelectedItems.set(i, new Map());
      }

      setSplitPayments(newPayments);
      setPersonNames(newNames);
      setSelectedItems(newSelectedItems);
    }
  }, [viewMode, splitType, numberOfPeople, order.totalAmount]);

  // Calculate per-person amounts when items are assigned (with tax and discounts)
  // Use order item-level tax/discount where available to avoid "mixing" across people
  useEffect(() => {
    if (viewMode === 'splitBill' && splitType === 'per_person') {
      const orderSubtotal = order.subtotal || 0;
      const orderTax = order.taxAmount || 0;
      const orderDiscount = order.discountAmount || 0;
      const orderCouponDiscount = order.couponDiscount || 0;
      const orderDeliveryCharge = order.deliveryCharge || 0;

      // Pre-calculate order-level bases from items
      // Use unitPrice * quantity as base (before tax and discount)
      let itemsSubtotalTotal = 0;
      let itemsTaxTotal = 0;
      let itemsDiscountTotal = 0;

      orderItems.forEach((item) => {
        const totalQty = item.quantity || 1;
        // Base subtotal = unitPrice * quantity (before discount and tax)
        const baseSubtotal = (item.unitPrice || 0) * totalQty;
        const storedTax = item.taxAmount || 0;
        const storedDiscount = item.discountAmount || 0;
        
        itemsSubtotalTotal += baseSubtotal;
        itemsTaxTotal += storedTax;
        itemsDiscountTotal += storedDiscount;
      });

      const baseForShare = orderSubtotal > 0 ? orderSubtotal : itemsSubtotalTotal;
      // Check if there's any rounding difference in tax/discount
      const extraOrderTax = Math.max(0, orderTax - itemsTaxTotal);
      // Separate extra discount (manual) from coupon discount
      // orderDiscount = itemDiscounts + extraDiscount + couponDiscount
      // So extraDiscount = orderDiscount - itemsDiscountTotal - couponDiscount
      const extraOrderDiscount = Math.max(0, orderDiscount - itemsDiscountTotal - orderCouponDiscount);

      const newPayments = splitPayments.map((payment, index) => {
        const personItems = selectedItems.get(index);
        if (!personItems || personItems.size === 0) {
          return { ...payment, amount: 0, items: [] };
        }

        let subtotal = 0;
        let itemTaxTotal = 0;
        let itemDiscountTotal = 0;
        const items: Array<{ orderItemId: string; quantity: number; amount: number }> = [];

        personItems.forEach((quantity, orderItemId) => {
          const orderItem = orderItems.find((item) => item.id === orderItemId);
          if (!orderItem || quantity <= 0) return;

          const totalQty = orderItem.quantity || 1;
          // Base subtotal = unitPrice * quantity (before discount and tax)
          const baseSubtotalPerUnit = orderItem.unitPrice || 0;
          const taxPerUnit = (orderItem.taxAmount || 0) / totalQty;
          const discountPerUnit = (orderItem.discountAmount || 0) / totalQty;

          const itemBaseAmount = baseSubtotalPerUnit * quantity;
          const itemTaxAmount = taxPerUnit * quantity;
          const itemDiscountAmount = discountPerUnit * quantity;

          subtotal += itemBaseAmount;
          itemTaxTotal += itemTaxAmount;
          itemDiscountTotal += itemDiscountAmount;

          items.push({
            orderItemId,
            quantity,
            amount: itemBaseAmount,
          });
        });

        if (subtotal === 0) {
          return { ...payment, amount: 0, items: [] };
        }

        // Share any remaining order-level tax/discount proportionally by subtotal
        const share = baseForShare > 0 ? subtotal / baseForShare : 0;
        const sharedTax = Math.max(0, extraOrderTax) * share;
        const sharedExtraDiscount = Math.max(0, extraOrderDiscount) * share;
        const sharedCouponDiscount = Math.max(0, orderCouponDiscount) * share;

        const tax = itemTaxTotal + sharedTax;
        const discount = itemDiscountTotal + sharedExtraDiscount + sharedCouponDiscount;

        // Delivery charge is only order-level – split proportionally by subtotal
        const delivery =
          baseForShare > 0 ? (orderDeliveryCharge * subtotal) / baseForShare : 0;

        const amount = subtotal + tax + delivery - discount;

        return {
          ...payment,
          amount: Math.max(0, amount), // Ensure non-negative
          items,
          // Store breakdown components for normalization
          _breakdown: {
            subtotal,
            tax,
            discount,
            delivery,
          },
        };
      });

      // Normalize amounts to ensure they sum exactly to order total
      const orderTotal = order.totalAmount || 0;
      let calculatedTotal = newPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      let difference = orderTotal - calculatedTotal;

      // Always normalize if there's any difference (even small ones)
      // This ensures splits always match the stored order total exactly
      if (Math.abs(difference) > 0.001) {
        // Find all non-zero split indices
        const nonZeroIndices: number[] = [];
        newPayments.forEach((p, idx) => {
          if ((p.amount || 0) > 0) {
            nonZeroIndices.push(idx);
          }
        });
        
        if (nonZeroIndices.length > 0) {
          // Round all amounts first to avoid floating point issues
          newPayments.forEach(payment => {
            payment.amount = Math.round((payment.amount || 0) * 100) / 100;
          });
          
          // Recalculate total after rounding
          calculatedTotal = newPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
          difference = orderTotal - calculatedTotal;
          
          if (Math.abs(difference) > 0.001) {
            // Distribute the difference using largest remainder method for precision
            const adjustments = nonZeroIndices.map(() => 0);
            const adjustmentPerSplit = difference / nonZeroIndices.length;
            
            // Calculate rounded adjustments
            nonZeroIndices.forEach((idx, arrayIndex) => {
              adjustments[arrayIndex] = Math.floor(adjustmentPerSplit * 100) / 100;
            });
            
            // Calculate remainder and distribute to largest remainders
            const totalRoundedAdjustment = adjustments.reduce((sum, adj) => sum + adj, 0);
            const remainder = difference - totalRoundedAdjustment;
            const remainderInCents = Math.round(remainder * 100);
            
            // Distribute remainder cents to first N splits
            for (let i = 0; i < Math.abs(remainderInCents) && i < nonZeroIndices.length; i++) {
              adjustments[i] += remainderInCents > 0 ? 0.01 : -0.01;
            }
            
          // Apply adjustments to amounts and breakdown components proportionally
          nonZeroIndices.forEach((idx, arrayIndex) => {
            const payment = newPayments[idx];
            const originalAmount = payment.amount || 0;
            const adjustment = adjustments[arrayIndex];
            const newAmount = Math.max(0, originalAmount + adjustment);
            
            // Adjust breakdown components proportionally if they exist
            if ((payment as any)._breakdown && originalAmount > 0) {
              const ratio = newAmount / originalAmount;
              const breakdown = (payment as any)._breakdown;
              breakdown.subtotal = Math.round(breakdown.subtotal * ratio * 100) / 100;
              breakdown.tax = Math.round(breakdown.tax * ratio * 100) / 100;
              breakdown.discount = Math.round(breakdown.discount * ratio * 100) / 100;
              breakdown.delivery = Math.round(breakdown.delivery * ratio * 100) / 100;
            }
            
            payment.amount = Math.round(newAmount * 100) / 100;
          });
          }
        }
      } else {
        // Round all amounts to 2 decimal places
        newPayments.forEach(payment => {
          payment.amount = Math.round((payment.amount || 0) * 100) / 100;
        });
      }
      
      // Final verification: ensure sum matches order total exactly
      const finalTotal = newPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const finalDifference = orderTotal - finalTotal;
      if (Math.abs(finalDifference) > 0.001) {
        // If still not matching, adjust the last non-zero split
        for (let i = newPayments.length - 1; i >= 0; i--) {
          const payment = newPayments[i];
          if ((payment.amount || 0) > 0) {
            const originalAmount = payment.amount || 0;
            const newAmount = Math.max(0, originalAmount + finalDifference);
            
            // Adjust breakdown components proportionally if they exist
            if ((payment as any)._breakdown && originalAmount > 0) {
              const ratio = newAmount / originalAmount;
              const breakdown = (payment as any)._breakdown;
              breakdown.subtotal = Math.round(breakdown.subtotal * ratio * 100) / 100;
              breakdown.tax = Math.round(breakdown.tax * ratio * 100) / 100;
              breakdown.discount = Math.round(breakdown.discount * ratio * 100) / 100;
              breakdown.delivery = Math.round(breakdown.delivery * ratio * 100) / 100;
            }
            
            payment.amount = Math.round(newAmount * 100) / 100;
            break;
          }
        }
      }
      
      // Clean up temporary breakdown data before setting state
      newPayments.forEach(payment => {
        delete (payment as any)._breakdown;
      });

      setSplitPayments(newPayments);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedItems,
    orderItems,
    splitType,
    viewMode,
    order.subtotal,
    order.taxAmount,
    order.discountAmount,
    order.deliveryCharge,
  ]);

  // Load existing bill split
  const loadExistingSplit = async (showLoading = false, forceReload = false): Promise<BillSplit | null> => {
    // If already loaded and not forcing reload, return the existing split
    if (!forceReload && loadedOrderIdRef.current === order.id && existingBillSplit !== null) {
      return existingBillSplit;
    }

    if (showLoading) {
      setLoadingSplit(true);
    }
    try {
      const split = await ordersApi.getBillSplit(order.id, language);
      if (split) {
        // Log the split data to debug payment IDs
        console.log('Loaded bill split:', split);
        console.log('Payments:', split.payments);
        setExistingBillSplit(split);
        loadedOrderIdRef.current = order.id;
        return split;
      } else {
        setExistingBillSplit(null);
        loadedOrderIdRef.current = order.id; // Mark as checked even if no split
        return null;
      }
    } catch (error: any) {
      // No split exists or error - that's fine
      setExistingBillSplit(null);
      loadedOrderIdRef.current = order.id; // Mark as checked even on error
      return null;
    } finally {
      if (showLoading) {
        setLoadingSplit(false);
      }
    }
  };

  // Handle mark as paid
  const handleMarkAsPaid = async () => {
    setIsSubmitting(true);
    try {
      const updateDto: UpdatePaymentStatusDto = {
        paymentStatus: 'paid',
        amountPaid: order.totalAmount,
        paymentMethod: paymentMethod as any,
        tipAmount: tipAmount > 0 ? tipAmount : undefined,
      };

      await ordersApi.updatePaymentStatus(order.id, updateDto);

      notifications.show({
        title: t('common.success' as any, language) || 'Success',
        message: t('orders.paymentStatusUpdated', language),
        color: getSuccessColor(),
        icon: <IconCheck size={16} />,
      });

      onSuccess();
      onClose();
    } catch (error: any) {
      notifications.show({
        title: t('common.error' as any, language) || 'Error',
        message: error?.response?.data?.message || error?.message || t('orders.failedToMarkOrderAsPaid', language) || 'Failed to mark order as paid',
        color: getErrorColor(),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle split bill button click
  const handleSplitBillClick = async () => {
    // If we already have split data loaded, go directly to view
    if (existingBillSplit) {
      setViewMode('viewSplits');
      return;
    }

    // Always try to load split first (order flag might not be updated yet)
    // Switch view IMMEDIATELY to prevent any visual delay
    setViewMode('viewSplits');
    setLoadingSplit(true);
    try {
      // Wait for the load to complete and get the result
      const split = await loadExistingSplit(false, true); // Force reload to ensure we get latest data
      // If no split found after loading, switch to creation view
      if (!split) {
        setViewMode('splitBill');
      }
      // If split found, view is already set to viewSplits and existingBillSplit is set
    } catch (error) {
      // On error, go to creation view
      setViewMode('splitBill');
    } finally {
      setLoadingSplit(false);
    }
  };

  const handleItemAssignment = (personIndex: number, orderItemId: string, quantity: number) => {
    const newSelectedItems = new Map(selectedItems);
    const personItems = new Map(newSelectedItems.get(personIndex) || new Map());

    if (quantity === 0) {
      personItems.delete(orderItemId);
    } else {
      personItems.set(orderItemId, quantity);
    }

    newSelectedItems.set(personIndex, personItems);
    setSelectedItems(newSelectedItems);
  };

  // Helper to get person's assigned items with details
  const getPersonItems = (personIndex: number) => {
    const personItemsMap = selectedItems.get(personIndex);
    if (!personItemsMap || personItemsMap.size === 0) return [];

    return Array.from(personItemsMap.entries())
      .map(([orderItemId, quantity]) => {
        const orderItem = orderItems.find((item) => item.id === orderItemId);
        if (!orderItem) return null;
        
        const itemName = orderItem.foodItem?.name || orderItem.buffet?.name || orderItem.comboMeal?.name || t('orders.unknownItem', language) || 'Unknown Item';
        const unitPrice = orderItem.unitPrice || 0;
        const totalPrice = unitPrice * quantity;

        return {
          id: orderItemId,
          name: itemName,
          quantity,
          unitPrice,
          totalPrice,
        };
      })
      .filter(Boolean) as Array<{ id: string; name: string; quantity: number; unitPrice: number; totalPrice: number }>;
  };

  // Helper to calculate totals from split payment items (for existing splits)
  const calculateTotalsFromSplitItems = (splitItems: Array<{ orderItemId: string; quantity: number }>) => {
    const orderSubtotal = order.subtotal || 0;
    const orderTax = order.taxAmount || 0;
    const orderDiscount = order.discountAmount || 0;
    const orderCouponDiscount = order.couponDiscount || 0;
    const orderDeliveryCharge = order.deliveryCharge || 0;

    // Pre-calculate order-level bases from items
    let itemsSubtotalTotal = 0;
    let itemsTaxTotal = 0;
    let itemsDiscountTotal = 0;

    orderItems.forEach((item) => {
      const totalQty = item.quantity || 1;
      const baseSubtotal = (item.unitPrice || 0) * totalQty;
      itemsSubtotalTotal += baseSubtotal;
      itemsTaxTotal += item.taxAmount || 0;
      itemsDiscountTotal += item.discountAmount || 0;
    });

    const baseForShare = orderSubtotal > 0 ? orderSubtotal : itemsSubtotalTotal;
    const extraOrderTax = Math.max(0, orderTax - itemsTaxTotal);
    const extraOrderDiscount = Math.max(0, orderDiscount - itemsDiscountTotal - orderCouponDiscount);

    // Calculate person-specific totals from split items
    let baseSubtotal = 0;
    let itemTaxTotal = 0;
    let itemDiscountTotal = 0;

    splitItems.forEach((splitItem) => {
      const orderItem = orderItems.find((item) => item.id === splitItem.orderItemId);
      if (!orderItem || splitItem.quantity <= 0) return;

      const totalQty = orderItem.quantity || 1;
      const baseSubtotalPerUnit = orderItem.unitPrice || 0;
      const taxPerUnit = (orderItem.taxAmount || 0) / totalQty;
      const discountPerUnit = (orderItem.discountAmount || 0) / totalQty;

      baseSubtotal += baseSubtotalPerUnit * splitItem.quantity;
      itemTaxTotal += taxPerUnit * splitItem.quantity;
      itemDiscountTotal += discountPerUnit * splitItem.quantity;
    });

    if (baseSubtotal === 0) {
      return { subtotal: 0, tax: 0, discount: 0, delivery: 0, total: 0 };
    }

    const share = baseForShare > 0 ? baseSubtotal / baseForShare : 0;
    const sharedTax = Math.max(0, extraOrderTax) * share;
    const sharedExtraDiscount = Math.max(0, extraOrderDiscount) * share;
    const sharedCouponDiscount = Math.max(0, orderCouponDiscount) * share;

    const tax = itemTaxTotal + sharedTax;
    const discount = itemDiscountTotal + sharedExtraDiscount + sharedCouponDiscount;
    const delivery = baseForShare > 0 ? (orderDeliveryCharge * baseSubtotal) / baseForShare : 0;

    const total = Math.max(0, baseSubtotal + tax + delivery - discount);

    return { subtotal: baseSubtotal, tax, discount, delivery, total };
  };

  // Helper to calculate person totals (subtotal, tax, discount, total)
  const getPersonTotals = (personIndex: number) => {
    // Use normalized amount from splitPayments if available
    const normalizedAmount = splitPayments[personIndex]?.amount;
    
    const personItems = getPersonItems(personIndex);
    const rawSubtotal = personItems.reduce((sum, item) => sum + item.totalPrice, 0);

    const orderSubtotal = order.subtotal || 0;
    const orderTax = order.taxAmount || 0;
    const orderDiscount = order.discountAmount || 0;
    const orderCouponDiscount = order.couponDiscount || 0;
    const orderDeliveryCharge = order.deliveryCharge || 0;

    // Pre-calculate order-level bases from items
    // Use unitPrice * quantity as base (before tax and discount)
    let itemsSubtotalTotal = 0;
    let itemsTaxTotal = 0;
    let itemsDiscountTotal = 0;

    orderItems.forEach((item) => {
      const totalQty = item.quantity || 1;
      // Base subtotal = unitPrice * quantity (before discount and tax)
      const baseSubtotal = (item.unitPrice || 0) * totalQty;
      itemsSubtotalTotal += baseSubtotal;
      itemsTaxTotal += item.taxAmount || 0;
      itemsDiscountTotal += item.discountAmount || 0;
    });

    const baseForShare = orderSubtotal > 0 ? orderSubtotal : itemsSubtotalTotal;
    // Check if there's any rounding difference in tax/discount
    const extraOrderTax = Math.max(0, orderTax - itemsTaxTotal);
    // Separate extra discount (manual) from coupon discount
    // orderDiscount = itemDiscounts + extraDiscount + couponDiscount
    // So extraDiscount = orderDiscount - itemsDiscountTotal - couponDiscount
    const extraOrderDiscount = Math.max(0, orderDiscount - itemsDiscountTotal - orderCouponDiscount);

    // Person-specific item-level tax/discount
    let itemTaxTotal = 0;
    let itemDiscountTotal = 0;

    const personItemsMap = selectedItems.get(personIndex);
    if (personItemsMap && personItemsMap.size > 0) {
      personItemsMap.forEach((quantity, orderItemId) => {
        const orderItem = orderItems.find((item) => item.id === orderItemId);
        if (!orderItem || quantity <= 0) return;

        const totalQty = orderItem.quantity || 1;
        const taxPerUnit = (orderItem.taxAmount || 0) / totalQty;
        const discountPerUnit = (orderItem.discountAmount || 0) / totalQty;

        itemTaxTotal += taxPerUnit * quantity;
        itemDiscountTotal += discountPerUnit * quantity;
      });
    }

    const subtotal = rawSubtotal;

    if (subtotal === 0) {
      return { subtotal: 0, tax: 0, discount: 0, delivery: 0, total: 0 };
    }

    const share = baseForShare > 0 ? subtotal / baseForShare : 0;
    const sharedTax = Math.max(0, extraOrderTax) * share;
    const sharedExtraDiscount = Math.max(0, extraOrderDiscount) * share;
    const sharedCouponDiscount = Math.max(0, orderCouponDiscount) * share;

    const tax = itemTaxTotal + sharedTax;
    const discount = itemDiscountTotal + sharedExtraDiscount + sharedCouponDiscount;
    const delivery =
      baseForShare > 0 ? (orderDeliveryCharge * subtotal) / baseForShare : 0;

    let total = Math.max(0, subtotal + tax + delivery - discount);
    
    // If normalized amount exists and differs, adjust breakdown to match
    // Preserve tax accuracy - only adjust for small rounding differences
    if (normalizedAmount !== undefined && Math.abs(normalizedAmount - total) > 0.001 && total > 0) {
      const difference = normalizedAmount - total;
      total = normalizedAmount;
      
      // For small differences (typically rounding), adjust tax
      // For larger differences, adjust discount instead to preserve tax accuracy
      if (Math.abs(difference) <= 1.0) {
        // Small rounding difference - adjust tax
        const adjustedTax = tax + difference;
        return {
          subtotal,
          tax: Math.max(0, adjustedTax), // Ensure tax doesn't go negative
          discount,
          delivery,
          total: normalizedAmount,
        };
      } else {
        // Larger difference - adjust discount to preserve tax accuracy
        const adjustedDiscount = discount - difference; // Subtract because discount reduces total
        return {
          subtotal,
          tax, // Keep tax accurate
          discount: Math.max(0, adjustedDiscount), // Ensure discount doesn't go negative
          delivery,
          total: normalizedAmount,
        };
      }
    }

    return { subtotal, tax, discount, delivery, total };
  };

  const getAvailableQuantity = (orderItemId: string): number => {
    const orderItem = orderItems.find((item) => item.id === orderItemId);
    if (!orderItem) return 0;

    const totalAssigned = Array.from(selectedItems.values()).reduce((sum, personItems) => {
      return sum + (personItems.get(orderItemId) || 0);
    }, 0);

    return (orderItem.quantity || 0) - totalAssigned;
  };

  // Check if all items are assigned (for per-person splits)
  const areAllItemsAssigned = useMemo(() => {
    if (splitType !== 'per_person' || orderItems.length === 0) return true;

    const totalAssigned = orderItems.reduce((sum, item) => {
      const assigned = Array.from(selectedItems.values()).reduce(
        (itemSum, personItems) => itemSum + (personItems.get(item.id) || 0),
        0,
      );
      return sum + assigned;
    }, 0);

    const totalItems = orderItems.reduce((sum, item) => sum + (item.quantity || 0), 0);

    return totalAssigned === totalItems;
  }, [splitType, orderItems, selectedItems]);

  // Get unassigned items count
  const getUnassignedItemsCount = useMemo(() => {
    if (splitType !== 'per_person' || orderItems.length === 0) return 0;

    const totalAssigned = orderItems.reduce((sum, item) => {
      const assigned = Array.from(selectedItems.values()).reduce(
        (itemSum, personItems) => itemSum + (personItems.get(item.id) || 0),
        0,
      );
      return sum + assigned;
    }, 0);

    const totalItems = orderItems.reduce((sum, item) => sum + (item.quantity || 0), 0);

    return totalItems - totalAssigned;
  }, [splitType, orderItems, selectedItems]);

  // Handle create bill split
  const handleCreateBillSplit = async () => {
    const totalAmount = order.totalAmount || 0;

    // Normalize amounts to ensure they sum exactly to order total
    const normalizedPayments = [...splitPayments];
    let totalSplitAmount = normalizedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const difference = totalAmount - totalSplitAmount;

    if (Math.abs(difference) > 0.01) {
      // Distribute the difference equally across all non-zero splits
      const nonZeroSplits = normalizedPayments.filter(p => (p.amount || 0) > 0);
      if (nonZeroSplits.length > 0) {
        const adjustmentPerSplit = difference / nonZeroSplits.length;
        let remainingAdjustment = difference;
        
        normalizedPayments.forEach((payment, index) => {
          if ((payment.amount || 0) > 0) {
            const isLastNonZero = index === normalizedPayments.length - 1 || 
              normalizedPayments.slice(index + 1).every(p => (p.amount || 0) === 0);
            const adjustment = isLastNonZero 
              ? remainingAdjustment
              : adjustmentPerSplit;
            payment.amount = Math.max(0, (payment.amount || 0) + adjustment);
            remainingAdjustment -= adjustment;
          }
        });
        
        // Round all amounts to 2 decimal places
        normalizedPayments.forEach(payment => {
          payment.amount = Math.round((payment.amount || 0) * 100) / 100;
        });
        
        // Update state with normalized amounts
        setSplitPayments(normalizedPayments);
      }
    }

    // Validate
    if (splitType === 'equal') {
      totalSplitAmount = normalizedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      if (Math.abs(totalSplitAmount - totalAmount) > 0.01) {
        notifications.show({
          title: t('orders.error', language) || 'Error',
          message: t('orders.splitAmountsMustEqual', language) || 'Split amounts must equal order total',
          color: getErrorColor(),
        });
        return;
      }
    } else {
      // Validate all items are assigned
      const totalAssigned = orderItems.reduce((sum, item) => {
        const assigned = Array.from(selectedItems.values()).reduce(
          (itemSum, personItems) => itemSum + (personItems.get(item.id) || 0),
          0,
        );
        return sum + assigned;
      }, 0);

      const totalItems = orderItems.reduce((sum, item) => sum + (item.quantity || 0), 0);

      if (totalAssigned !== totalItems) {
        notifications.show({
          title: t('orders.error', language) || 'Error',
          message: t('orders.allItemsMustBeAssigned', language) || 'All items must be assigned to people',
          color: getErrorColor(),
        });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const createDto: CreateBillSplitDto = {
        splitType,
        payments: normalizedPayments.map((payment, index) => ({
          ...payment,
          personName: personNames[index] || undefined,
          paymentMethod: payment.paymentMethod as 'cash' | 'card',
        })),
      };

      await ordersApi.createBillSplit(order.id, createDto);

      notifications.show({
        title: t('orders.billSplitCreated', language) || 'Bill Split Created',
        message: t('orders.billSplitCreatedSuccess', language) || 'Bill split created successfully',
        color: getSuccessColor(),
        icon: <IconCheck size={16} />,
      });

      // Load the created split and show it
      setLoadingSplit(true);
      try {
        const split = await ordersApi.getBillSplit(order.id, language);
        if (split) {
          setExistingBillSplit(split);
          loadedOrderIdRef.current = order.id; // Mark as loaded
          setViewMode('viewSplits');
          // Don't call onSuccess here - it might close the modal
          // Parent data will be refreshed when modal closes or when a payment is made
        } else {
          // Split not found, go back to creation
          setViewMode('splitBill');
        }
      } finally {
        setLoadingSplit(false);
      }
    } catch (error: any) {
      notifications.show({
        title: t('common.error' as any, language) || 'Error',
        message: error?.response?.data?.message || error?.message || t('orders.failedToCreateBillSplit', language) || 'Failed to create bill split',
        color: getErrorColor(),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle pay split button click
  const handlePaySplitClick = (payment: BillSplitPayment) => {
    // Log payment data to debug
    console.log('Pay split clicked, payment:', payment);
    if (!payment.id) {
      console.error('Payment missing ID:', payment);
      notifications.show({
        title: t('orders.error', language) || 'Error',
        message: t('orders.paymentIdMissing', language) || 'Payment ID is missing. Please refresh and try again.',
        color: getErrorColor(),
      });
      return;
    }
    setSelectedSplitPayment(payment);
    setSplitPaymentTipAmount(payment.tipAmount || 0);
    setSplitPaymentMethod(payment.paymentMethod);
    setViewMode('splitPayment');
  };

  // Handle split payment submission
  const handleSplitPaymentSubmit = async () => {
    if (!selectedSplitPayment) return;

    // Validate that we have a payment ID
    if (!selectedSplitPayment.id) {
      notifications.show({
        title: t('orders.error', language) || 'Error',
        message: t('orders.splitPaymentIdMissing', language) || 'Split payment ID is missing. Please try refreshing and try again.',
        color: getErrorColor(),
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const updateDto: UpdatePaymentStatusDto = {
        paymentStatus: 'paid',
        amountPaid: selectedSplitPayment.amount,
        paymentMethod: splitPaymentMethod as any,
        tipAmount: splitPaymentTipAmount > 0 ? splitPaymentTipAmount : undefined,
      };

      console.log('Processing split payment:', { 
        orderId: order.id, 
        paymentId: selectedSplitPayment.id,
        payment: selectedSplitPayment,
        updateDto 
      });
      await ordersApi.processBillSplitPayment(order.id, selectedSplitPayment.id, updateDto);

      notifications.show({
        title: t('orders.paymentProcessed', language) || 'Payment Processed',
        message: t('orders.paymentProcessedSuccess', language) || 'Payment processed successfully',
        color: getSuccessColor(),
        icon: <IconCheck size={16} />,
      });

      // Reload split and go back to view - force reload to get latest payment status
      setLoadingSplit(true);
      try {
        // Clear the ref to force a fresh reload
        loadedOrderIdRef.current = null;
        const split = await loadExistingSplit(false, true);
        if (split) {
          setExistingBillSplit(split);
          // Check if all splits are paid
          const allPaid = split.payments?.every((p: any) => p.status === 'paid') || false;
          if (allPaid) {
            // All splits are paid - refresh order data and show mark as paid view
            onSuccess();
            setViewMode('markAsPaid');
            notifications.show({
              title: t('common.success' as any, language) || 'Success',
              message: t('orders.allSplitsPaid', language) || 'All splits paid. Order marked as paid.',
              color: getSuccessColor(),
              icon: <IconCheck size={16} />,
            });
          } else {
            // Not all splits paid - keep modal open to continue paying
            setViewMode('viewSplits');
            // Don't call onSuccess here - it might cause parent to close modal
            // Order data will be refreshed when modal closes or when all splits are paid
            // Reset selected split payment so user can select another one
            setSelectedSplitPayment(null);
            setSplitPaymentTipAmount(0);
            setSplitPaymentMethod('');
          }
        } else {
          setViewMode('markAsPaid');
          // Refresh order data
          onSuccess();
        }
      } catch (error) {
        console.error('Failed to reload split:', error);
      } finally {
        setLoadingSplit(false);
      }
    } catch (error: any) {
      notifications.show({
        title: t('orders.error', language) || 'Error',
        message: error?.response?.data?.message || error?.message || t('orders.failedToProcessPayment', language) || 'Failed to process payment',
        color: getErrorColor(),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle discard split
  const handleDiscardSplit = async () => {
    setIsDiscardingSplit(true);
    try {
      await ordersApi.deleteBillSplit(order.id);
      notifications.show({
        title: t('common.success' as any, language) || 'Success',
        message: t('orders.splitDiscarded', language) || 'Bill split discarded successfully',
        color: getSuccessColor(),
        icon: <IconCheck size={16} />,
      });
      setExistingBillSplit(null);
      setViewMode('markAsPaid');
      onSuccess();
    } catch (error: any) {
      notifications.show({
        title: t('common.error' as any, language) || 'Error',
        message: error?.response?.data?.message || error?.message || t('orders.failedToDiscardBillSplit', language) || 'Failed to discard bill split',
        color: getErrorColor(),
      });
    } finally {
      setIsDiscardingSplit(false);
    }
  };

  // Handle print split invoice
  const handlePrintSplitInvoice = async (splitPayment: BillSplitPayment, template: 'thermal' | 'a4' = 'thermal') => {
    if (!order || !tenant) {
      notifications.show({
        title: t('common.error' as any, language) || 'Error',
        message: t('orders.missingOrderOrTenantData', language) || 'Missing order or tenant data',
        color: getErrorColor(),
      });
      return;
    }

    setPrinting(true);
    try {
      const isEqualSplit = existingBillSplit?.splitType === 'equal';
      const splitItems = splitPayment.items || [];
      
      // For equal splits, show all items with proportional amounts
      // For per-person splits, show only items assigned to this split
      let orderItemsForSplit: any[] = [];
      let totals;
      let adjustmentRatio = 1; // Adjustment ratio for normalizing totals (used for per-person splits)
      
      if (isEqualSplit) {
        // Equal split: show all order items with proportional amounts
        orderItemsForSplit = order.items || [];
        
        // Calculate proportional ratio based on split amount vs order total
        const orderTotal = order.totalAmount || 0;
        const splitAmount = splitPayment.amount || 0;
        const ratio = orderTotal > 0 ? splitAmount / orderTotal : 0;
        
        // Calculate proportional breakdown
        const splitSubtotal = (order.subtotal || 0) * ratio;
        const splitTax = (order.taxAmount || 0) * ratio;
        const splitDiscount = (order.discountAmount || 0) * ratio;
        const splitDelivery = (order.deliveryCharge || 0) * ratio;
        const splitTip = splitPayment.tipAmount || 0;
        const splitTotal = splitAmount; // Use the actual split amount
        
        totals = {
          subtotal: splitSubtotal,
          tax: splitTax,
          discount: splitDiscount,
          delivery: splitDelivery,
          total: splitTotal - splitTip, // Total without tip
        };
      } else {
        // Per-person split: use existing logic
        orderItemsForSplit = order.items?.filter(item => 
          splitItems.some((si: any) => si.orderItemId === item.id)
        ) || [];

        // Calculate proper breakdown for this split
        // Use split payment items if available (for existing splits), otherwise use getPersonTotals
        if (splitItems.length > 0) {
          // Calculate from split payment items (existing split)
          totals = calculateTotalsFromSplitItems(splitItems);
        } else {
          // Calculate from selectedItems (new split being created)
          const personIndex = splitPayment.personIndex ?? 0;
          totals = getPersonTotals(personIndex);
        }
        
        // Normalize totals to match the actual split payment amount
        // The splitPayment.amount is the source of truth (amount WITHOUT tip)
        // Use the same normalization logic as getPersonTotals to match UI display
        const actualTotalWithoutTip = splitPayment.amount;
        const calculatedTotalWithoutTip = totals.total;
        
        // If there's a rounding difference, normalize using the same logic as getPersonTotals
        // This ensures tax and discount match what's shown in the UI
        if (Math.abs(actualTotalWithoutTip - calculatedTotalWithoutTip) > 0.001 && calculatedTotalWithoutTip > 0) {
          const difference = actualTotalWithoutTip - calculatedTotalWithoutTip;
          
          // For small differences (typically rounding), adjust tax
          // For larger differences, adjust discount instead to preserve tax accuracy
          if (Math.abs(difference) <= 1.0) {
            // Small rounding difference - adjust tax (matches getPersonTotals logic)
            const adjustedTax = totals.tax + difference;
            totals = {
              subtotal: totals.subtotal, // Preserve subtotal
              tax: Math.max(0, adjustedTax), // Ensure tax doesn't go negative
              discount: totals.discount, // Preserve discount
              delivery: totals.delivery, // Preserve delivery
              total: actualTotalWithoutTip,
            };
            // No adjustment ratio needed for items since subtotal is preserved
            adjustmentRatio = 1;
          } else {
            // Larger difference - adjust discount to preserve tax accuracy (matches getPersonTotals logic)
            const adjustedDiscount = totals.discount - difference; // Subtract because discount reduces total
            totals = {
              subtotal: totals.subtotal, // Preserve subtotal
              tax: totals.tax, // Keep tax accurate
              discount: Math.max(0, adjustedDiscount), // Ensure discount doesn't go negative
              delivery: totals.delivery, // Preserve delivery
              total: actualTotalWithoutTip,
            };
            // No adjustment ratio needed for items since subtotal is preserved
            adjustmentRatio = 1;
          }
        } else {
          // No normalization needed
          adjustmentRatio = 1;
        }
      }
      
      const splitSubtotal = totals.subtotal;
      const splitTax = totals.tax;
      const splitDiscount = totals.discount;
      const splitDelivery = totals.delivery;
      const splitTip = splitPayment.tipAmount || 0;
      const splitTotal = splitPayment.amount + splitTip; // Amount (without tip) + tip = total

      // Prepare invoice data for this split
      const invoiceData = {
        order: {
          ...order,
          orderType: order.orderType,
          paymentMethod: splitPayment.paymentMethod,
          paymentStatus: splitPayment.status === 'paid' ? 'paid' : 'unpaid',
          totalAmount: splitTotal,
          subtotal: splitSubtotal,
          taxAmount: splitTax,
          discountAmount: splitDiscount,
          deliveryCharge: splitDelivery,
          tipAmount: splitTip,
          paidAt: splitPayment.paidAt || undefined,
          items: orderItemsForSplit.map(item => {
            // For equal splits, calculate proportional subtotal
            // For per-person splits, use the quantity from splitItems
            let itemSubtotal = item.subtotal || 0;
            let itemQuantity = item.quantity || 0;
            
            if (isEqualSplit) {
              // Calculate proportional amount for this item
              const orderTotal = order.totalAmount || 0;
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
                ? (item.buffet?.name?.trim() || (item.buffetId ? `${t('orders.buffet', language) || 'Buffet'} #${item.buffetId.substring(0, 8)}...` : t('orders.buffet', language) || 'Buffet'))
                : (item.comboMealId || item.comboMeal)
                ? (item.comboMeal?.name?.trim() || (item.comboMealId ? `${t('orders.comboMeal', language) || 'Combo Meal'} #${item.comboMealId.substring(0, 8)}...` : t('orders.comboMeal', language) || 'Combo Meal'))
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
        customerName: splitPayment.personName || order.customer?.name || undefined,
        customerPhone: order.customer?.phone,
        customerAddress: undefined,
        splitInfo: {
          splitNumber: splitPayment.personIndex,
          totalSplits: existingBillSplit?.payments?.length || 1,
        },
      };

      const html = template === 'thermal'
        ? InvoiceGenerator.generateThermal(invoiceData, language, themeConfig)
        : InvoiceGenerator.generateA4(invoiceData, language, themeConfig);

      InvoiceGenerator.printInvoice(html);
    } catch (error: any) {
      notifications.show({
        title: t('common.error' as any, language),
        message: error?.message || t('orders.failedToGenerateInvoice', language) || 'Failed to generate invoice',
        color: getErrorColor(),
      });
    } finally {
      setPrinting(false);
    }
  };

  // Show confirmation dialog
  const showConfirm = (action: () => void, message: string) => {
    setConfirmAction(() => action);
    // We'll use a simple approach - store the message and show dialog
    setConfirmDialogOpened(true);
  };

  const handleConfirm = () => {
    if (confirmAction) {
      confirmAction();
    }
    setConfirmDialogOpened(false);
    setConfirmAction(null);
  };

  // Get modal title based on view mode
  const getModalTitle = () => {
    switch (viewMode) {
      case 'markAsPaid':
        return t('orders.markAsPaid', language) || 'Mark as Paid';
      case 'splitBill':
        return t('orders.splitBill', language) || 'Split Bill';
      case 'splitPayment':
        return t('orders.paySplit', language) || 'Pay Split';
      case 'viewSplits':
        return t('orders.splitInvoices', language) || 'Split Invoices';
      default:
        return t('orders.markAsPaid', language) || 'Mark as Paid';
    }
  };

  // Render mark as paid view
  const renderMarkAsPaidView = () => {
    const totalWithTip = order.totalAmount + tipAmount;
    const isOrderPaid = order.paymentStatus === 'paid';
    
    // If order is already paid, show a message instead of payment form
    if (isOrderPaid) {
      return (
        <Stack gap="md">
          <Paper p="md" withBorder>
            <Stack gap="xs" align="center">
              <IconCheck size={48} style={{ color: getSuccessColor() }} />
              <Text fw={600} size="lg">
                {t('orders.orderAlreadyPaid' as any, language) || 'Order Already Paid'}
              </Text>
              <Text size="sm" c="dimmed">
                {t('orders.orderAlreadyPaidMessage' as any, language) || 'This order has already been marked as paid.'}
              </Text>
            </Stack>
          </Paper>
        </Stack>
      );
    }

    return (
      <Stack gap="md">
        <Paper p="md" withBorder>
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                {t('orders.orderTotal', language) || 'Order Total'}:
              </Text>
              <Text fw={600} size="lg">
                {formatCurrency(order.totalAmount, currency)}
              </Text>
            </Group>
          </Stack>
        </Paper>

        <Select
          label={t('pos.paymentMethod', language) || 'Payment Method'}
          value={paymentMethod}
          onChange={(value) => {
            if (value) {
              setPaymentMethod(value);
            }
          }}
          data={enabledPaymentMethods}
          required
          leftSection={<IconCreditCard size={16} />}
        />

        <TipInput subtotal={order.totalAmount} tipAmount={tipAmount} onTipChange={setTipAmount} />

        <Divider />

        <Group justify="space-between">
          <Text fw={700} size="lg">
            {t('orders.totalToPay', language) || 'Total to Pay'}:
          </Text>
          <Text fw={700} size="xl" style={{ color: themeConfig?.colors.primary || getThemeColor() }}>
            {formatCurrency(totalWithTip, currency)}
          </Text>
        </Group>

        <Group grow mt="md">
          <Button
            variant="light"
            style={{ 
              color: themeConfig?.colors.primary || getThemeColor(),
              borderColor: themeConfig?.colors.primary || getThemeColor(),
            }}
            onClick={handleSplitBillClick}
            leftSection={<IconUsers size={16} />}
            disabled={isSubmitting}
          >
            {t('orders.splitBill', language) || 'Split Bill'}
          </Button>
          <Button onClick={handleMarkAsPaid} loading={isSubmitting} leftSection={<IconCheck size={16} />}>
            {t('orders.markAsPaid', language) || 'Mark as Paid'}
          </Button>
        </Group>
      </Stack>
    );
  };

  // Render split bill creation view
  const renderSplitBillView = () => {
    const totalAmount = order.totalAmount || 0;

    return (
      <Stack gap="md">
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => setViewMode('markAsPaid')}>
          {t('common.back', language) || 'Back'}
        </Button>

        <SegmentedControl
          value={splitType}
          onChange={(value) => setSplitType(value as 'equal' | 'per_person')}
          data={[
            { label: t('orders.equalSplit', language) || 'Equal Split', value: 'equal' },
            { label: t('orders.perPersonSplit', language) || 'Per Person Split', value: 'per_person' },
          ]}
          fullWidth
        />

        <Group>
          <Text fw={500} size="sm">
            {t('orders.numberOfPeople', language) || 'Number of People'}:
          </Text>
          <NumberInput
            value={numberOfPeople}
            onChange={(value) => setNumberOfPeople(typeof value === 'number' ? value : 2)}
            min={2}
            max={20}
            style={{ width: 100 }}
          />
        </Group>

        <Divider />

        {splitType === 'equal' ? (
          <Stack gap="md">
            <Text fw={600} size="sm">
              {t('orders.amountPerPerson', language) || 'Amount per Person'}:{' '}
              {formatCurrency(totalAmount / numberOfPeople, currency)}
            </Text>

            {splitPayments.map((payment, index) => (
              <Paper key={index} p="md" withBorder>
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Text fw={600}>
                      {t('orders.person', language) || 'Person'} {index + 1}
                    </Text>
                    <Badge size="lg" variant="light">
                      {formatCurrency(payment.amount || 0, currency)}
                    </Badge>
                  </Group>

                  <TextInput
                    label={t('orders.personNameLabel', language) || t('orders.personName', language) || 'Name (Optional)'}
                    placeholder={t('orders.personNamePlaceholder', language) || t('orders.personName', language) || 'Enter name'}
                    value={personNames[index] || ''}
                    onChange={(e) => {
                      const newNames = [...personNames];
                      newNames[index] = e.target.value;
                      setPersonNames(newNames);
                    }}
                  />

                  <Select
                    label={t('pos.paymentMethod', language) || 'Payment Method'}
                    value={payment.paymentMethod}
                    onChange={(value) => {
                      const newPayments = [...splitPayments];
                      newPayments[index] = { ...payment, paymentMethod: value as any };
                      setSplitPayments(newPayments);
                    }}
                    data={enabledPaymentMethods}
                    size="sm"
                  />

                  <TipInput
                    subtotal={payment.amount || 0}
                    tipAmount={payment.tipAmount || 0}
                    onTipChange={(tipAmount) => {
                      const newPayments = [...splitPayments];
                      newPayments[index] = { ...payment, tipAmount };
                      setSplitPayments(newPayments);
                    }}
                  />
                </Stack>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Grid gutter="md">
            {/* Left Column: Available Items */}
            <Grid.Col span={4}>
              <Paper p="md" withBorder h="100%">
                <Text fw={600} mb="md" size="sm">
                  {t('orders.availableItems', language) || 'Available Items'}
                </Text>
                <ScrollArea h={500}>
                  <Stack gap="xs">
                    {orderItems.length === 0 ? (
                      <Text size="sm" c="dimmed" ta="center" py="md">
                        {t('orders.noItems', language) || 'No items available'}
                      </Text>
                    ) : (
                      orderItems.map((item) => {
                      const availableQty = getAvailableQuantity(item.id);
                      const itemName =
                        item.foodItem?.name || item.buffet?.name || item.comboMeal?.name || t('orders.unknownItem', language) || 'Unknown Item';
                      const unitPrice = item.unitPrice || 0;

                      return (
                        <Paper
                          key={item.id}
                          p="sm"
                          withBorder
                          style={{
                            cursor: availableQty > 0 ? 'pointer' : 'not-allowed',
                            opacity: availableQty > 0 ? 1 : 0.5,
                            backgroundColor: availableQty > 0 
                              ? (themeConfig?.colors.surface || theme.colors.gray[0])
                              : (themeConfig?.colors.surfaceVariant || theme.colors.gray[2]),
                          }}
                        >
                          <Stack gap={4}>
                            <Group justify="space-between" gap="xs">
                              <Text fw={500} size="sm" lineClamp={1}>
                                {itemName}
                              </Text>
                              <Badge 
                                size="sm" 
                                variant="light" 
                                style={{ 
                                  color: themeConfig?.colors.primary || getThemeColor(),
                                  backgroundColor: themeConfig?.colors.primaryLightest || getThemeColor() + '20',
                                }}
                              >
                                {formatCurrency(unitPrice, currency)}
                              </Badge>
                            </Group>
                            <Group justify="space-between" gap="xs">
                              <Text size="xs" c="dimmed">
                                {t('orders.available', language) || 'Available'}: {availableQty} / {item.quantity}
                              </Text>
                              <Group gap={4}>
                                {Array.from({ length: numberOfPeople }, (_, personIndex) => {
                                  const assignedQty = selectedItems.get(personIndex)?.get(item.id) || 0;
                                  if (assignedQty === 0) return null;
                                  return (
                                    <Badge 
                                      key={personIndex} 
                                      size="xs" 
                                      variant="filled" 
                                      style={{ 
                                        backgroundColor: themeConfig?.colors.primary || getThemeColor(),
                                        color: themeConfig?.colors.text || '#ffffff',
                                      }}
                                    >
                                      P{personIndex + 1}: {assignedQty}
                                    </Badge>
                                  );
                                })}
                              </Group>
                            </Group>
                            <Group gap="xs" mt={4}>
                              {Array.from({ length: numberOfPeople }, (_, personIndex) => {
                                const assignedQty = selectedItems.get(personIndex)?.get(item.id) || 0;

                                return (
                                  <Group key={personIndex} gap={4} style={{ flex: 1 }}>
                                    <Text size="xs" c="dimmed" style={{ minWidth: 30 }}>
                                      P{personIndex + 1}
                                    </Text>
                                    <ActionIcon
                                      size="xs"
                                      variant="light"
                                      style={{ 
                                        color: themeConfig?.colors.primary || getThemeColor(),
                                      }}
                                      onClick={() => {
                                        if (assignedQty > 0) {
                                          handleItemAssignment(personIndex, item.id, assignedQty - 1);
                                        }
                                      }}
                                      disabled={assignedQty === 0}
                                    >
                                      <IconMinus size={12} />
                                    </ActionIcon>
                                    <Text size="xs" fw={500} style={{ minWidth: 20, textAlign: 'center' }}>
                                      {assignedQty}
                                    </Text>
                                    <ActionIcon
                                      size="xs"
                                      variant="light"
                                      style={{ 
                                        color: themeConfig?.colors.primary || getThemeColor(),
                                      }}
                                      onClick={() => {
                                        if (availableQty > 0) {
                                          handleItemAssignment(personIndex, item.id, assignedQty + 1);
                                        }
                                      }}
                                      disabled={availableQty === 0}
                                    >
                                      <IconPlus size={12} />
                                    </ActionIcon>
                                  </Group>
                                );
                              })}
                            </Group>
                          </Stack>
                        </Paper>
                      );
                    })
                    )}
                  </Stack>
                </ScrollArea>
              </Paper>
            </Grid.Col>

            {/* Right Column: Person Columns */}
            <Grid.Col span={8}>
              <ScrollArea >
                <Grid gutter="md" h={600} style={{overflowX: 'hidden'}}>
                  {Array.from({ length: numberOfPeople }, (_, personIndex) => {
                    const personItems = getPersonItems(personIndex);
                    const totals = getPersonTotals(personIndex);
                    const payment = splitPayments[personIndex];

                    return (
                      <Grid.Col key={personIndex} span={6}>
                        <Paper p="md" withBorder h="100%">
                          <Stack gap="sm">
                            <Group justify="space-between">
                              <Text fw={600} size="sm">
                                {t('orders.person', language) || 'Person'} {personIndex + 1}
                              </Text>
                              <Badge 
                                size="lg" 
                                variant="light" 
                                style={{ 
                                  color: totals.total > 0 
                                    ? (themeConfig?.colors.primary || getThemeColor())
                                    : (themeConfig?.colors.textMuted || theme.colors.gray[6]),
                                  backgroundColor: totals.total > 0 
                                    ? (themeConfig?.colors.primaryLightest || getThemeColor() + '20')
                                    : (themeConfig?.colors.surfaceVariant || theme.colors.gray[1]),
                                }}
                              >
                                {formatCurrency(totals.total, currency)}
                              </Badge>
                            </Group>

                            <TextInput
                              size="xs"
                              placeholder={t('orders.personNamePlaceholder', language) || t('orders.personName', language) || 'Enter name'}
                              value={personNames[personIndex] || ''}
                              onChange={(e) => {
                                const newNames = [...personNames];
                                newNames[personIndex] = e.target.value;
                                setPersonNames(newNames);
                              }}
                            />

                            {personItems.length > 0 ? (
                              <Box>
                                <Text size="xs" fw={500} mb="xs" c="dimmed">
                                  {t('orders.items', language) || 'Items'}:
                                </Text>
                                <Stack gap={4}>
                                  {personItems.map((item) => (
                                    <Group key={item.id} justify="space-between" gap="xs">
                                      <Text size="xs" lineClamp={1} style={{ flex: 1 }}>
                                        {item.name} × {item.quantity}
                                      </Text>
                                      <Text size="xs" fw={500}>
                                        {formatCurrency(item.totalPrice, currency)}
                                      </Text>
                                    </Group>
                                  ))}
                                </Stack>
                                <Divider my="xs" />
                                <Stack gap={4}>
                                  <Group justify="space-between">
                                    <Text size="xs" c="dimmed">
                                      {t('orders.subtotal', language) || 'Subtotal'}:
                                    </Text>
                                    <Text size="xs">{formatCurrency(totals.subtotal, currency)}</Text>
                                  </Group>
                                  {totals.tax > 0 && (
                                    <Group justify="space-between">
                                      <Text size="xs" c="dimmed">
                                        {t('orders.tax', language) || 'Tax'}:
                                      </Text>
                                      <Text size="xs">{formatCurrency(totals.tax, currency)}</Text>
                                    </Group>
                                  )}
                                  {totals.delivery > 0 && (
                                    <Group justify="space-between">
                                      <Text size="xs" c="dimmed">
                                        {t('orders.delivery', language) || 'Delivery'}:
                                      </Text>
                                      <Text size="xs">{formatCurrency(totals.delivery, currency)}</Text>
                                    </Group>
                                  )}
                                  {totals.discount > 0 && (
                                    <Group justify="space-between">
                                      <Text size="xs" c="dimmed">
                                        {t('orders.discount', language) || 'Discount'}:
                                      </Text>
                                      <Text size="xs" style={{ color: getErrorColor() }}>
                                        -{formatCurrency(totals.discount, currency)}
                                      </Text>
                                    </Group>
                                  )}
                                  <Group justify="space-between" mt="xs" pt="xs" style={{ borderTop: `1px solid ${themeConfig?.colors.borderLight || theme.colors.gray[3]}` }}>
                                    <Text size="sm" fw={600}>
                                      {t('orders.total', language) || 'Total'}:
                                    </Text>
                                    <Text size="sm" fw={700} style={{ color: themeConfig?.colors.primary || getThemeColor() }}>
                                      {formatCurrency(totals.total, currency)}
                                    </Text>
                                  </Group>
                                </Stack>
                              </Box>
                            ) : (
                              <Text size="xs" c="dimmed" ta="center" py="md">
                                {t('orders.noItemsAssigned', language) || 'No items assigned'}
                              </Text>
                            )}

                            <Select
                              label={t('pos.paymentMethod', language) || 'Payment Method'}
                              value={payment?.paymentMethod}
                              onChange={(value) => {
                                const newPayments = [...splitPayments];
                                newPayments[personIndex] = { ...payment, paymentMethod: value as any };
                                setSplitPayments(newPayments);
                              }}
                              data={enabledPaymentMethods}
                              size="xs"
                            />

                            {totals.total > 0 && (
                              <TipInput
                                subtotal={totals.total}
                                tipAmount={payment?.tipAmount || 0}
                                onTipChange={(tipAmount) => {
                                  const newPayments = [...splitPayments];
                                  newPayments[personIndex] = { ...payment, tipAmount };
                                  setSplitPayments(newPayments);
                                }}
                              />
                            )}
                          </Stack>
                        </Paper>
                      </Grid.Col>
                    );
                  })}
                </Grid>
              </ScrollArea>
            </Grid.Col>
          </Grid>
        )}

        <Group justify="space-between" mt="md">
          {splitType === 'per_person' && !areAllItemsAssigned && (
            <Text size="sm" style={{ color: getErrorColor() }} fw={500}>
              {t('orders.itemsNotAssigned', language)?.replace('{count}', getUnassignedItemsCount.toString()) || 
                `Please assign all items. ${getUnassignedItemsCount} item(s) remaining.`}
            </Text>
          )}
          {splitType === 'per_person' && areAllItemsAssigned && (
            <Text size="sm" style={{ color: getSuccessColor() }} fw={500}>
              {t('orders.allItemsAssigned', language) || 'All items assigned ✓'}
            </Text>
          )}
          <Group>
            <Button variant="subtle" onClick={() => setViewMode('markAsPaid')} disabled={isSubmitting}>
              {t('common.cancel', language) || 'Cancel'}
            </Button>
            <Button 
              onClick={handleCreateBillSplit} 
              loading={isSubmitting} 
              leftSection={<IconCheck size={16} />}
              disabled={splitType === 'per_person' && !areAllItemsAssigned}
            >
              {t('orders.createSplit', language) || 'Create Split'}
            </Button>
          </Group>
        </Group>
      </Stack>
    );
  };

  // Render split payment view
  const renderSplitPaymentView = () => {
    if (!selectedSplitPayment) return null;

    const totalWithTip = selectedSplitPayment.amount + splitPaymentTipAmount;

    return (
      <Stack gap="md">
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => setViewMode('viewSplits')}>
          {t('common.back', language) || 'Back'}
        </Button>

        <Paper p="md" withBorder>
          <Stack gap="xs">
            {selectedSplitPayment.personName && (
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  {t('orders.person', language) || 'Person'}:
                </Text>
                <Text fw={600}>{selectedSplitPayment.personName}</Text>
              </Group>
            )}
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                {t('orders.amount', language) || 'Amount'}:
              </Text>
              <Text fw={600} size="lg">
                {formatCurrency(selectedSplitPayment.amount, currency)}
              </Text>
            </Group>
          </Stack>
        </Paper>

        <Select
          label={t('pos.paymentMethod', language) || 'Payment Method'}
          value={splitPaymentMethod}
          onChange={(value) => {
            if (value) {
              setSplitPaymentMethod(value);
            }
          }}
          data={enabledPaymentMethods}
          required
          leftSection={<IconCreditCard size={16} />}
        />

        <TipInput
          subtotal={selectedSplitPayment.amount}
          tipAmount={splitPaymentTipAmount}
          onTipChange={setSplitPaymentTipAmount}
        />

        <Divider />

        <Group justify="space-between">
          <Text fw={700} size="lg">
            {t('orders.totalToPay', language) || 'Total to Pay'}:
          </Text>
          <Text fw={700} size="xl" style={{ color: themeConfig?.colors.primary || getThemeColor() }}>
            {formatCurrency(totalWithTip, currency)}
          </Text>
        </Group>

        <Button onClick={handleSplitPaymentSubmit} loading={isSubmitting} leftSection={<IconCheck size={16} />} fullWidth>
          {t('orders.processPayment', language) || 'Process Payment'}
        </Button>
      </Stack>
    );
  };

  // Render view splits view
  const renderViewSplitsView = () => {
    // Show skeleton loader while checking for existing split
    if (loadingSplit) {
      return (
        <Stack gap="md">
          <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => setViewMode('markAsPaid')}>
            {t('common.back', language) || 'Back'}
          </Button>
          <Stack gap="md">
            <Paper p="md" withBorder>
              <Skeleton height={24} width={200} mb="md" />
              <Skeleton height={20} width={150} />
            </Paper>
            <Divider label={t('orders.splitInvoices', language) || 'Split Invoices'} labelPosition="center" />
            {[1, 2].map((i) => (
              <Paper key={i} p="lg" withBorder>
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Skeleton height={24} width={150} />
                    <Skeleton height={24} width={80} />
                  </Group>
                  <Skeleton height={16} width={120} />
                  <Group justify="space-between" mt="sm">
                    <Skeleton height={20} width={200} />
                    <Skeleton height={32} width={100} />
                  </Group>
                  <Group justify="space-between" mt="sm">
                    <Skeleton height={16} width={150} />
                    <Group gap="xs">
                      <Skeleton height={32} width={100} />
                      <Skeleton height={32} width={100} />
                    </Group>
                  </Group>
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Stack>
      );
    }

    // Show "no split found" only if we're not loading and there's no split
    if (!existingBillSplit) {
      return (
        <Stack gap="md">
          <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => setViewMode('markAsPaid')}>
            {t('common.back', language) || 'Back'}
          </Button>
          <Text>{t('orders.noSplitFound', language) || 'No split found'}</Text>
        </Stack>
      );
    }

    const payments = existingBillSplit.payments || [];
    const paidCount = payments.filter((p: any) => p.status === 'paid').length;
    const totalCount = payments.length;

    return (
      <Stack gap="md">
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => setViewMode('markAsPaid')}>
          {t('common.back', language) || 'Back'}
        </Button>

        <Paper p="md" withBorder>
          <Group justify="space-between" mb="md">
            <Text fw={600}>
              {existingBillSplit.splitType === 'equal'
                ? t('orders.equalSplit', language) || 'Equal Split'
                : t('orders.perPersonSplit', language) || 'Per Person Split'}
            </Text>
            <Badge 
              variant="light" 
              size="lg"
              style={{ 
                color: paidCount === totalCount 
                  ? getSuccessColor()
                  : paidCount > 0 
                  ? getWarningColor()
                  : (themeConfig?.colors.primary || getThemeColor()),
                backgroundColor: paidCount === totalCount 
                  ? getSuccessColor() + '20'
                  : paidCount > 0 
                  ? getWarningColor() + '20'
                  : (themeConfig?.colors.primaryLightest || getThemeColor() + '20'),
              }}
            >
              {paidCount} / {totalCount} {t('orders.paid', language) || 'Paid'}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            {t('orders.splitCreatedInfo', language) || 'Bill has been split. Each person can pay their portion individually.'}
          </Text>
        </Paper>

        <Divider label={t('orders.splitInvoices', language) || 'Split Invoices'} labelPosition="center" />

        {loadingSplit ? (
          <Stack gap="md">
            {[1, 2].map((i) => (
              <Paper key={i} p="lg" withBorder>
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Skeleton height={24} width={150} />
                    <Skeleton height={24} width={80} />
                  </Group>
                  <Skeleton height={16} width={120} />
                  <Group justify="space-between" mt="sm">
                    <Skeleton height={20} width={200} />
                    <Skeleton height={32} width={100} />
                  </Group>
                  <Group justify="space-between" mt="sm">
                    <Skeleton height={16} width={150} />
                    <Group gap="xs">
                      <Skeleton height={32} width={100} />
                      <Skeleton height={32} width={100} />
                    </Group>
                  </Group>
                </Stack>
              </Paper>
            ))}
          </Stack>
        ) : (
          <ScrollArea h={400}>
            <Stack gap="md">
              {payments.map((payment: any, index: number) => {
                // Ensure payment has required fields
                if (!payment.id) {
                  console.error('Payment missing ID:', payment, 'at index:', index);
                  return null;
                }
                return (
                <Paper
                  key={payment.id}
                  p="lg"
                  withBorder
                  shadow="sm"
                  style={{ borderLeft: `4px solid ${payment.status === 'paid' ? getSuccessColor() : getWarningColor()}` }}
                >
                <Stack gap="sm">
                  <Group justify="space-between" align="flex-start">
                    <Stack gap="xs">
                      <Group gap="xs">
                        <Text fw={700} size="lg">
                          {payment.personName || `${t('orders.person', language) || 'Person'} ${payment.personIndex}`}
                        </Text>
                        <Badge 
                          variant="light" 
                          size="lg"
                         
                        >
                          {payment.status === 'paid'
                            ? t('orders.paid', language) || 'Paid'
                            : t('orders.pending', language) || 'Pending'}
                        </Badge>
                      </Group>
                      <Text size="sm" c="dimmed">
                        {t('orders.invoiceNumber', language) || 'Invoice'} #{payment.personIndex}
                      </Text>
                    </Stack>
                    <Stack gap="xs" align="flex-end">
                      <Text fw={700} size="xl" style={{ color: themeConfig?.colors.primary || getThemeColor() }}>
                        {formatCurrency(payment.amount, currency)}
                      </Text>
                      {payment.tipAmount > 0 && (
                        <Text size="sm" c="dimmed">
                          {t('orders.tip', language) || 'Tip'}: {formatCurrency(payment.tipAmount, currency)}
                        </Text>
                      )}
                      <Text size="md" fw={600}>
                        {t('orders.total', language) || 'Total'}:{' '}
                        {formatCurrency(payment.amount + payment.tipAmount, currency)}
                      </Text>
                    </Stack>
                  </Group>

                  <Group justify="space-between" mt="sm">
                    <Text size="sm" c="dimmed">
                      {t('pos.paymentMethod', language) || 'Payment Method'}:{' '}
                      {payment.paymentMethod === 'cash' ? t('pos.cash', language) : t('pos.card', language)}
                    </Text>
                    <Group gap="xs">
                      {payment.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            variant="light"
                            style={{ 
                              color: themeConfig?.colors.textMuted || theme.colors.gray[6],
                              borderColor: themeConfig?.colors.borderLight || theme.colors.gray[3],
                            }}
                            onClick={() => handlePrintSplitInvoice(payment, 'thermal')}
                            loading={printing}
                            leftSection={<IconPrinter size={16} />}
                          >
                            {t('orders.printInvoice', language) || 'Print Invoice'}
                          </Button>
                          <Button
                            size="sm"
                            variant="filled"
                            style={{ 
                              backgroundColor: themeConfig?.colors.primary || getThemeColor(),
                              color: themeConfig?.colors.text || '#ffffff',
                            }}
                            onClick={() => handlePaySplitClick(payment)}
                            leftSection={<IconCreditCard size={16} />}
                          >
                            {t('orders.paySplit', language) || 'Pay Split'}
                          </Button>
                        </>
                      )}
                      {payment.status === 'paid' && (
                        <>
                          <Button
                            size="sm"
                            variant="light"
                            style={{ 
                              color: themeConfig?.colors.textMuted || theme.colors.gray[6],
                              borderColor: themeConfig?.colors.borderLight || theme.colors.gray[3],
                            }}
                            onClick={() => handlePrintSplitInvoice(payment, 'thermal')}
                            loading={printing}
                            leftSection={<IconPrinter size={16} />}
                          >
                            {t('orders.printInvoice', language) || 'Print Invoice'}
                          </Button>
                          {payment.paidAt && (
                            <Text size="xs" c="dimmed">
                              {t('orders.paid', language) || 'Paid'}: {new Date(payment.paidAt).toLocaleString()}
                            </Text>
                          )}
                        </>
                      )}
                    </Group>
                  </Group>
                </Stack>
              </Paper>
              );
            })}
          </Stack>
        </ScrollArea>
        )}

        <Group justify="space-between" mt="md">
          {paidCount === 0 && (
            <Button
              variant="light"
              style={{ 
                color: getErrorColor(),
                borderColor: getErrorColor(),
              }}
              onClick={() => {
                  showConfirm(
                  handleDiscardSplit,
                  t('orders.confirmDiscardSplit', language) ||
                    'Are you sure you want to discard this bill split? This action cannot be undone.',
                );
              }}
              leftSection={<IconTrash size={16} />}
              loading={isDiscardingSplit}
              disabled={isDiscardingSplit}
            >
              {t('orders.discardSplit', language) || 'Discard Split'}
            </Button>
          )}
          <Button 
            variant="subtle" 
            onClick={() => {
              // Refresh parent data before closing
              onSuccess();
              onClose();
            }}
          >
            {t('common.close', language) || 'Close'}
          </Button>
        </Group>
      </Stack>
    );
  };

  // Render content based on view mode
  const renderContent = () => {
    // Show loading state only when switching to views that need split data
    // Note: Loading is now handled within renderViewSplitsView() with skeleton loaders

    switch (viewMode) {
      case 'markAsPaid':
        return renderMarkAsPaidView();
      case 'splitBill':
        return renderSplitBillView();
      case 'splitPayment':
        return renderSplitPaymentView();
      case 'viewSplits':
        return renderViewSplitsView();
      default:
        return renderMarkAsPaidView();
    }
  };

  return (
    <>
      <Modal opened={opened} onClose={onClose} title={getModalTitle()} size="xl" centered zIndex={200}>
        {renderContent()}
      </Modal>

      <ConfirmDialog
        opened={confirmDialogOpened}
        onClose={() => {
          setConfirmDialogOpened(false);
          setConfirmAction(null);
        }}
        onConfirm={handleConfirm}
        message={
          t('orders.confirmDiscardSplit', language) ||
          'Are you sure you want to discard this bill split? This action cannot be undone.'
        }
        confirmColor={getErrorColor()}
      />
    </>
  );
}

