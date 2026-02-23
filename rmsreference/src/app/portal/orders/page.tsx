'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Chip,
  TextInput,
  Select,
  Button,
  Group,
  Stack,
  Card,
  Text,
  Badge,
  ActionIcon,
  Title,
  Menu,
  Paper,
  Box,
  Grid,
  Center,
  Skeleton,
  Switch,
} from '@mantine/core';
import {
  IconSearch,
  IconDotsVertical,
  IconRefresh,
  IconChefHat,
  IconCheck,
  IconClock,
} from '@tabler/icons-react';
import { useLanguageStore } from '@/lib/store/language-store';
import { t } from '@/lib/utils/translations';
import { ordersApi, Order, OrderStatus, OrderType, PaymentStatus } from '@/lib/api/orders';
import { UnifiedPaymentModal } from '@/features/orders/components/UnifiedPaymentModal';
import { notifications } from '@mantine/notifications';
import { useDisclosure, useDebouncedValue } from '@mantine/hooks';
import { OrderDetailsModal } from '@/features/orders';
import { useThemeColor } from '@/lib/hooks/use-theme-color';
import { getStatusColor, getPaymentStatusColor, getSuccessColor, getErrorColor, getBadgeColorForText } from '@/lib/utils/theme';
import { useAuthStore } from '@/lib/store/auth-store';
import { useBranchStore } from '@/lib/store/branch-store';
import { useCurrency } from '@/lib/hooks/use-currency';
import { formatCurrency } from '@/lib/utils/currency-formatter';
import { customersApi } from '@/lib/api/customers';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { IconEye } from '@tabler/icons-react';
import { useDateFormat } from '@/lib/hooks/use-date-format';
import { usePagination } from '@/lib/hooks/use-pagination';
import { PaginationControls } from '@/components/common/PaginationControls';
import { isPaginatedResponse } from '@/lib/types/pagination.types';
import { translationsApi } from '@/lib/api/translations';
import { useRoleAccessConfig } from '@/lib/hooks/use-role-access-config';
import { useKitchenSse, OrderUpdateEvent } from '@/lib/hooks/use-kitchen-sse';
import { useOrderTimer } from '@/lib/hooks/use-order-timer';
import { onOrderUpdate, notifyOrderUpdate } from '@/lib/utils/order-events';

dayjs.extend(relativeTime);

// Available order statuses for filtering
const ORDER_STATUSES = ['pending', 'preparing', 'ready', 'served', 'completed', 'cancelled'] as const;
type OrderStatusFilter = typeof ORDER_STATUSES[number];

export default function OrdersPage() {
  const router = useRouter();
  const { language } = useLanguageStore();
  const currency = useCurrency();
  const primary = useThemeColor();
  const { user } = useAuthStore();
  const { formatDateTime } = useDateFormat();
  const { isKitchenDisplayEnabledForUser, isMarkAsPaidEnabledForUser } = useRoleAccessConfig();
  const pagination = usePagination<Order>({ initialPage: 1, initialLimit: 10 });
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery] = useDebouncedValue(searchQuery, 300);
  const { selectedBranchId } = useBranchStore();
  
  // Track previous search value to detect when search is cleared
  const prevSearchRef = useRef<string>('');
  
  // Reset pagination and force reload when search is cleared
  useEffect(() => {
    const trimmedSearch = debouncedSearchQuery.trim();
    const prevTrimmedSearch = prevSearchRef.current.trim();
    
    // Detect when search is cleared (had value, now empty)
    if (prevTrimmedSearch !== '' && trimmedSearch === '') {
      // Clear the last request ref to force a reload
      lastOrdersRequestRef.current = '';
      // Reset pagination to page 1
      if (pagination.page !== 1) {
        pagination.setPage(1);
      } else {
        // If already on page 1, explicitly reload to ensure results reset
        // Use the ref to avoid dependency issues
        loadOrdersRef.current?.(false);
      }
    }
    
    // Update previous search value
    prevSearchRef.current = debouncedSearchQuery;
  }, [debouncedSearchQuery, pagination]);
  const [selectedOrderType, setSelectedOrderType] = useState<string | null>(null);
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<string | null>(null);
  const [showMyOrdersOnly, setShowMyOrdersOnly] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailsModalOpened, { open: openDetailsModal, close: closeDetailsModal }] = useDisclosure(false);
  const [markingAsPaidOrderId, setMarkingAsPaidOrderId] = useState<string | null>(null);
  const [markingAsCompleteOrderId, setMarkingAsCompleteOrderId] = useState<string | null>(null);
  const [markAsPaidModalOrder, setMarkAsPaidModalOrder] = useState<Order | null>(null);
  // Branch translations cache: { branchId: { name: { languageCode: string } } }
  const [branchTranslationsCache, setBranchTranslationsCache] = useState<{
    [branchId: string]: { name?: { [languageCode: string]: string } };
  }>({});
  
  // Waiter translations cache: { waiterEmail: { name: { languageCode: string } } }
  const [waiterTranslationsCache, setWaiterTranslationsCache] = useState<{
    [waiterEmail: string]: { name?: { [languageCode: string]: string } };
  }>({});

  // Ref to store the latest loadOrders function for use in subscriptions
  // This prevents subscription recreation while ensuring we always use the latest function
  const loadOrdersRef = useRef<(silent?: boolean) => Promise<void>>();
  
  // Refs to prevent duplicate API calls (especially in React StrictMode)
  const loadingOrdersRef = useRef(false);
  const lastOrdersRequestRef = useRef<string>('');
  const ordersRequestSequenceRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentSearchRef = useRef<string>('');
  const reloadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const loadOrders = useCallback(async (silent = false) => {
    // Create a unique key for this request to prevent duplicates
    // Use undefined for empty search to match API params and ensure proper comparison
    const trimmedSearch = debouncedSearchQuery.trim();
    const requestKey = JSON.stringify({
      status: selectedStatuses,
      branchId: selectedBranchId,
      orderType: selectedOrderType,
      paymentStatus: selectedPaymentStatus,
      search: trimmedSearch || undefined,
      waiterEmail: showMyOrdersOnly && user?.email ? user.email : undefined,
      page: pagination.page,
      limit: pagination.limit,
      language,
    });
    
    // Cancel any in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new AbortController for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    // Prevent duplicate calls with the same parameters
    // But allow if last request ref was cleared (e.g., when search is cleared or SSE event received)
    // Also allow if the request key is different (search/filter changed)
    const isSameRequest = lastOrdersRequestRef.current === requestKey;
    
    // If silent reload and last request was cleared (e.g., by SSE event), force reload
    // This ensures SSE events always trigger a reload even if a request is in progress
    const forceReload = lastOrdersRequestRef.current === '';
    
    // If forcing a reload (SSE event), always proceed regardless of loading state
    if (!forceReload) {
    if (isSameRequest && loadingOrdersRef.current && !silent && lastOrdersRequestRef.current !== '') {
      return;
      }
      
      // If request parameters changed (different request key), allow reload even if loading
      // This ensures search clearing and filter changes always trigger a reload
      const requestChanged = !isSameRequest;
      if (loadingOrdersRef.current && !silent && !requestChanged) {
        return;
      }
    }
    
    // Increment request sequence to track the order of requests
    const currentRequestSequence = ++ordersRequestSequenceRef.current;
    lastOrdersRequestRef.current = requestKey;
    
    // Store current search term to verify results match
    currentSearchRef.current = trimmedSearch;
    
    // If this is a new request (parameters changed), immediately clear old results
    // to prevent showing stale data while loading
    const requestChanged = !isSameRequest;
    if ((requestChanged || forceReload) && !silent) {
      setOrders([]);
    }
    
    loadingOrdersRef.current = true;
    
    if (!silent) {
      setLoading(true);
    }
    try {
      // Load orders from backend with all filters including search
      const params = {
        status: selectedStatuses.length > 0 ? (selectedStatuses as OrderStatus[]) : undefined,
        branchId: selectedBranchId || undefined,
        orderType: selectedOrderType as OrderType | undefined,
        paymentStatus: selectedPaymentStatus as PaymentStatus | undefined,
        search: trimmedSearch || undefined,
        waiterEmail: showMyOrdersOnly && user?.email ? user.email : undefined,
        language,
        ...pagination.paginationParams,
      };
      
      let backendOrders: Order[] = [];
      let backendResponse: Order[] | any = null;
      try {
        backendResponse = await ordersApi.getOrders(params);
        
        // Check if request was aborted
        if (abortController.signal.aborted) {
          console.log('⚠️ Request was aborted, ignoring response');
          return;
        }
        
        // Check if this is still the latest request
        if (currentRequestSequence !== ordersRequestSequenceRef.current) {
          console.log('⚠️ Ignoring outdated orders request response');
          return;
        }
        
        // Verify the search term hasn't changed (double-check to prevent race conditions)
        if (currentSearchRef.current !== trimmedSearch) {
          console.log('⚠️ Search term changed during request, ignoring response');
          return;
        }
        
        backendOrders = pagination.extractData(backendResponse);
        pagination.extractPagination(backendResponse);
        
        console.log(`📦 Loaded ${backendOrders.length} orders from backend (silent: ${silent})`);
        
        // Set orders from backend immediately - don't wait for translations
        setOrders(backendOrders);
        
        // Populate cache with names from order response (already translated by backend)
        // This ensures UI renders immediately with correct names
        // Clear cache for current language and rebuild with new translations
        const newBranchTranslations: typeof branchTranslationsCache = {};
        const newWaiterTranslations: typeof waiterTranslationsCache = {};
        
        backendOrders.forEach(order => {
          // Use branch name from order response (already translated by backend)
          if (order.branchId && order.branch?.name) {
            newBranchTranslations[order.branchId] = {
              name: {
                [language]: order.branch.name,
              },
            };
          }
          
          // Use waiter name from order response (already translated by backend)
          if (order.waiterEmail && order.waiterName) {
            newWaiterTranslations[order.waiterEmail] = {
              name: {
                [language]: order.waiterName,
              },
            };
          }
        });
        
        // Update caches synchronously so UI can render immediately
        setBranchTranslationsCache(newBranchTranslations);
        setWaiterTranslationsCache(newWaiterTranslations);
        
        // Note: Since order response already includes translated branch and waiter names,
        // we don't need to fetch additional translations. The backend handles translation
        // based on the language parameter, so the names in the order response are already correct.
      } catch (error: any) {
        // Don't set error state if request was aborted
        if (abortController.signal.aborted) {
          console.log('⚠️ Request was aborted');
          return;
        }
        console.error('Failed to load orders from backend:', error);
        // Only update state if this is still the latest request
        if (currentRequestSequence === ordersRequestSequenceRef.current) {
          setOrders([]);
        }
      }
    } catch (error: any) {
      if (!silent) {
        notifications.show({
          title: t('common.error' as any, language),
          message: error?.response?.data?.message || t('orders.loadError', language),
          color: getErrorColor(),
        });
      }
    } finally {
      // Only update loading state if this is still the current request
      if (currentRequestSequence === ordersRequestSequenceRef.current) {
        if (!silent) {
          setLoading(false);
        }
        loadingOrdersRef.current = false;
        // Clear abort controller if this was the current request
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranchId, selectedOrderType, selectedPaymentStatus, selectedStatuses, debouncedSearchQuery, showMyOrdersOnly, user?.email, language, pagination]);

  // Cleanup reload timeout on unmount
  useEffect(() => {
    return () => {
      if (reloadTimeoutRef.current) {
        clearTimeout(reloadTimeoutRef.current);
        reloadTimeoutRef.current = null;
      }
    };
  }, []);

  // Update ref whenever loadOrders changes
  useEffect(() => {
    loadOrdersRef.current = loadOrders;
  }, [loadOrders]);

  // FIXED: Combined redundant useEffects into one with proper dependencies
  // This prevents loadOrders from being called multiple times when dependencies change
  // Note: searchQuery is debounced via debouncedSearchQuery, so we use that in dependencies
  useEffect(() => {
    // Use a small timeout to debounce rapid changes and prevent duplicate calls
    const timeoutId = setTimeout(() => {
      loadOrders();
    }, 0);
    
    return () => {
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranchId, selectedOrderType, selectedPaymentStatus, selectedStatuses, debouncedSearchQuery, showMyOrdersOnly, pagination.page, pagination.limit, language]);

  // Server-Sent Events (SSE) for real-time order updates (like kitchen display)
  // Receives instant updates when orders are created or status changes
  // Falls back to polling if SSE fails
  const { isConnected, isConnecting } = useKitchenSse({
    branchId: selectedBranchId,
    onOrderUpdate: (event: OrderUpdateEvent) => {
      console.log('📨 Order update received via SSE in orders page:', event.type, event.orderId, event);
      
      // Clear any pending reload timeout to debounce rapid events
      if (reloadTimeoutRef.current) {
        console.log('⏱️ Clearing pending reload timeout due to new SSE event');
        clearTimeout(reloadTimeoutRef.current);
        reloadTimeoutRef.current = null;
      }
      
      // Cancel any in-flight requests to ensure we get fresh data
      if (abortControllerRef.current) {
        console.log('🛑 Cancelling in-flight request due to SSE update');
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      // Reset loading state to allow new request
      loadingOrdersRef.current = false;
      
      // Clear the last request ref to force a fresh reload even if filters haven't changed
      // This ensures we get the latest data when order status changes
      lastOrdersRequestRef.current = '';
      
      // Debounce reloads - wait a bit to batch multiple rapid updates
      reloadTimeoutRef.current = setTimeout(() => {
        console.log('🔄 Reloading orders due to SSE update:', event.type, event.orderId);
        // Reload orders to get latest data
        if (loadOrdersRef.current) {
          loadOrdersRef.current(true); // silent = true to avoid loading spinner
        } else {
          console.warn('⚠️ loadOrdersRef.current is null, cannot reload orders');
        }
        reloadTimeoutRef.current = null;
      }, 300); // 300ms debounce to batch rapid updates
    },
    onConnect: () => {
      console.log('✅ SSE connected in orders page - receiving real-time order updates');
      // Don't reload on connect - orders are already loaded on mount
      // SSE will handle updates via onOrderUpdate callback
    },
    onError: (error) => {
      console.error('❌ SSE connection error in orders page:', error);
      // Fallback: reload orders manually on error
      if (loadOrdersRef.current) {
        lastOrdersRequestRef.current = '';
        loadOrdersRef.current(true);
      }
    },
    enabled: true,
  });

  // Fallback polling if SSE is not connected AND not connecting (poll every 5 seconds)
  // Wait 3 seconds before starting fallback to give SSE time to connect
  // This ensures updates even if SSE fails, but doesn't interfere with SSE connection attempts
  const sseConnectedRef = useRef(isConnected);
  const sseConnectingRef = useRef(isConnecting);
  
  useEffect(() => {
    sseConnectedRef.current = isConnected;
    sseConnectingRef.current = isConnecting;
  }, [isConnected, isConnecting]);

  useEffect(() => {
    // Don't start polling if SSE is connected or actively connecting
    if (isConnected || isConnecting) {
      return;
    }

    let pollInterval: NodeJS.Timeout | null = null;

    // Wait 3 seconds before starting fallback polling
    // This gives SSE time to establish connection on page load
    const fallbackDelay = setTimeout(() => {
      // Double-check SSE is still not connected after delay (use refs for current state)
      if (!sseConnectedRef.current && !sseConnectingRef.current) {
        console.log('⚠️ SSE not connected after delay in orders page, using polling fallback');
        pollInterval = setInterval(() => {
          // Only poll if SSE is still not connected (check refs for current state)
          if (!sseConnectedRef.current && !sseConnectingRef.current && loadOrdersRef.current) {
            loadOrdersRef.current(true); // silent poll
          }
        }, 5000); // Poll every 5 seconds as fallback
      }
    }, 3000); // Wait 3 seconds before starting fallback

    return () => {
      clearTimeout(fallbackDelay);
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [isConnected, isConnecting]);

  // Listen for order creation/update events (for same-browser updates)
  useEffect(() => {
    const handleOrderEvent = (eventType: string) => {
      console.log(`📨 Order event received in orders page (same-browser): ${eventType}`);
      
      // Clear any pending reload timeout to debounce rapid events
      if (reloadTimeoutRef.current) {
        clearTimeout(reloadTimeoutRef.current);
        reloadTimeoutRef.current = null;
      }
      
      // Cancel any in-flight requests to ensure we get fresh data
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      // Reset loading state
      loadingOrdersRef.current = false;
      
      // Clear the last request ref to force a fresh reload
      lastOrdersRequestRef.current = '';
      
      // Debounce reloads - wait a bit to batch multiple rapid updates
      reloadTimeoutRef.current = setTimeout(() => {
        if (loadOrdersRef.current) {
          loadOrdersRef.current(true); // silent reload to maintain current tab
        }
        reloadTimeoutRef.current = null;
      }, 300); // 300ms debounce to batch rapid updates
    };
    
    const unsubscribeCreated = onOrderUpdate('order-created', () => {
      handleOrderEvent('order-created');
    });
    
    const unsubscribeUpdated = onOrderUpdate('order-updated', () => {
      handleOrderEvent('order-updated');
    });
    
    const unsubscribeStatusChanged = onOrderUpdate('order-status-changed', () => {
      handleOrderEvent('order-status-changed');
    });

    return () => {
      unsubscribeCreated();
      unsubscribeUpdated();
      unsubscribeStatusChanged();
      // Clear any pending reload timeout
      if (reloadTimeoutRef.current) {
        clearTimeout(reloadTimeoutRef.current);
        reloadTimeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only set up once, use ref for latest function

  // No client-side filtering needed - all filtering is done on the backend
  // The orders array already contains filtered results from the backend
  const filteredOrders = useMemo(() => orders, [orders]);

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order);
    openDetailsModal();
  };

  const handleStatusUpdate = () => {
    loadOrders();
    closeDetailsModal();
  };

  const handleMarkAsPaid = (order: Order) => {
    setMarkAsPaidModalOrder(order);
  };

  const handleMarkAsPaidSuccess = async () => {
    await loadOrders();
    setMarkAsPaidModalOrder(null);
  };

  const handleMarkAsComplete = async (order: Order) => {
    setMarkingAsCompleteOrderId(order.id);
    try {
      await ordersApi.updateOrderStatus(order.id, {
        status: 'completed',
      });
      // Notify same-browser screens about the status change
      notifyOrderUpdate('order-status-changed', order.id);
      notifications.show({
        title: t('common.success' as any, language),
        message: t('orders.statusUpdated', language),
        color: getSuccessColor(),
      });
      await loadOrders();
    } catch (error: any) {
      notifications.show({
        title: t('common.error' as any, language),
        message: error?.response?.data?.message || t('orders.updateError', language),
        color: getErrorColor(),
      });
    } finally {
      setMarkingAsCompleteOrderId(null);
    }
  };

  const getStatusColorForBadge = (status: OrderStatus): string => {
    return getStatusColor(status);
  };

  const getOrderTypeLabel = (type: OrderType): string => {
    const labels: Record<OrderType, string> = {
      dine_in: t('pos.dineIn', language),
      takeaway: t('pos.takeaway', language),
      delivery: t('pos.delivery', language),
    };
    return labels[type] || type;
  };

  const getPaymentStatusLabel = (status: PaymentStatus): string => {
    const labels: Record<PaymentStatus, string> = {
      paid: t('orders.paymentPaid', language),
      unpaid: t('orders.paymentUnpaid', language),
      partial: t('orders.paymentPartial', language) || 'Partial',
    };
    return labels[status] || status;
  };

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" align="center" style={{ width: '100%', height: '100%' }}>
          <Title order={1} style={{ margin: 0, textAlign: 'left' }}>
            {t('orders.title', language)}
          </Title>
          <Group gap="xs">
            <Switch
              checked={showMyOrdersOnly}
              onChange={(event) => setShowMyOrdersOnly(event.currentTarget.checked)}
              label={t('orders.myOrders', language)}
              size="md"
            />
            {/* Show kitchen display button based on role access configuration (checks all user roles) */}
            {user && isKitchenDisplayEnabledForUser() && (
              <Button
                leftSection={<IconChefHat size={16} />}
                variant="light"
                onClick={() => router.push('/portal/orders/kitchen')}
                size="sm"
              >
                {t('orders.kitchenDisplay', language)}
              </Button>
            )}
            <ActionIcon
              variant="light"
              size="lg"
              onClick={() => {
                console.log('🔄 Manual refresh triggered');
                lastOrdersRequestRef.current = '';
                loadOrders(false);
              }}
              loading={loading}
              title={t('common.refresh' as any, language)}
            >
              <IconRefresh size={18} />
            </ActionIcon>
          </Group>
        </Group>
      </div>

      <div className="page-sub-title-bar"></div>

      <div style={{ marginTop: '60px', paddingLeft: 'var(--mantine-spacing-md)', paddingRight: 'var(--mantine-spacing-md)', paddingTop: 'var(--mantine-spacing-sm)', paddingBottom: 'var(--mantine-spacing-xl)' }}>
        <Stack gap="md">
          {/* Filters */}
        <Paper p="md" withBorder>
          <Grid>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <TextInput
                placeholder={t('common.search' as any, language)}
                leftSection={<IconSearch size={16} />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 5 }}>
              <Select
                placeholder={t('orders.filterByType', language)}
                data={[
                  { value: 'dine_in', label: t('pos.dineIn', language) },
                  { value: 'takeaway', label: t('pos.takeaway', language) },
                  { value: 'delivery', label: t('pos.delivery', language) },
                ]}
                value={selectedOrderType}
                onChange={setSelectedOrderType}
                clearable
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 3 }}>
              <Select
                placeholder={t('orders.filterByPayment', language)}
                data={[
                  { value: 'unpaid', label: t('orders.paymentUnpaid', language) },
                  { value: 'paid', label: t('orders.paymentPaid', language) },
                ]}
                value={selectedPaymentStatus}
                onChange={setSelectedPaymentStatus}
                clearable
              />
            </Grid.Col>
          </Grid>
        </Paper>

        {/* Status Filter Chips */}
        <Paper p="sm" withBorder>
          <Group gap="xs" wrap="wrap" className="filter-chip-group">
            <Chip
              checked={selectedStatuses.length === 0}
              onChange={() => setSelectedStatuses([])}
              variant="filled"
            >
              {t('orders.allOrders', language)}
            </Chip>
            <Chip.Group multiple value={selectedStatuses} onChange={setSelectedStatuses}>
              <Group gap="xs" wrap="wrap">
                <Chip value="pending" variant="filled">
                  {t('orders.pending', language)}
                </Chip>
                <Chip value="preparing" variant="filled">
                  {t('orders.preparing', language)}
                </Chip>
                <Chip value="ready" variant="filled">
                  {t('orders.ready', language)}
                </Chip>
                <Chip value="served" variant="filled">
                  {t('orders.served', language)}
                </Chip>
                <Chip value="completed" variant="filled">
                  {t('orders.completed', language)}
                </Chip>
                <Chip value="cancelled" variant="filled">
                  {t('orders.cancelled', language)}
                </Chip>
              </Group>
            </Chip.Group>
          </Group>
        </Paper>

        {/* Orders List */}
        <Box mt="md">
            {loading ? (
              <Stack gap="md">
                {[1, 2].map((i) => (
                  <Card key={i} withBorder p="md">
                    <Stack gap="sm">
                      <Group justify="space-between">
                        <Skeleton height={24} width="30%" />
                        <Skeleton height={20} width="15%" />
                        <Skeleton height={20} width="15%" />
                      </Group>
                      <Skeleton height={16} width="40%" />
                      <Skeleton height={16} width="50%" />
                    </Stack>
                  </Card>
                ))}
              </Stack>
            ) : filteredOrders.length === 0 ? (
              <Center py="xl">
                <Text c="dimmed">{t('orders.noOrders', language)}</Text>
              </Center>
            ) : (
              <Stack gap="sm">
                {filteredOrders.map((order) => (
                  <OrderCardWithTimer
                    key={order.id}
                    order={order}
                    language={language}
                    currency={currency}
                    branchTranslationsCache={branchTranslationsCache}
                    waiterTranslationsCache={waiterTranslationsCache}
                    getStatusColorForBadge={getStatusColorForBadge}
                    getOrderTypeLabel={getOrderTypeLabel}
                    getPaymentStatusLabel={getPaymentStatusLabel}
                    getPaymentStatusColor={getPaymentStatusColor}
                    formatDateTime={formatDateTime}
                    formatCurrency={formatCurrency}
                    isMarkAsPaidEnabledForUser={isMarkAsPaidEnabledForUser}
                    markingAsPaidOrderId={markingAsPaidOrderId}
                    markingAsCompleteOrderId={markingAsCompleteOrderId}
                    handleMarkAsPaid={handleMarkAsPaid}
                    handleMarkAsComplete={handleMarkAsComplete}
                    handleViewOrder={handleViewOrder}
                    t={t}
                  />
                ))}
              </Stack>
            )}
            
            {/* Pagination Controls */}
            {pagination.total > 0 && (
              <PaginationControls
                page={pagination.page}
                totalPages={pagination.totalPages}
                limit={pagination.limit}
                total={pagination.total}
                onPageChange={(page) => {
                  pagination.setPage(page);
                }}
                onLimitChange={(newLimit) => {
                  pagination.setLimit(newLimit);
                  pagination.setPage(1);
                }}
              />
            )}
          </Box>
        </Stack>
      </div>

      {selectedOrder && (
        <OrderDetailsModal
          opened={detailsModalOpened}
          onClose={closeDetailsModal}
          order={selectedOrder}
          onStatusUpdate={handleStatusUpdate}
        />
      )}

      {/* Unified Payment Modal (Mark as Paid, Split Bill, etc.) */}
      {markAsPaidModalOrder && (
        <UnifiedPaymentModal
          opened={!!markAsPaidModalOrder}
          onClose={() => setMarkAsPaidModalOrder(null)}
          order={markAsPaidModalOrder}
          onSuccess={handleMarkAsPaidSuccess}
        />
      )}
    </>
  );
}

// Order Card Component with Timer
interface OrderCardWithTimerProps {
  order: Order;
  language: 'en' | 'ar' | 'ku' | 'fr';
  currency: string;
  branchTranslationsCache: { [branchId: string]: { name?: { [languageCode: string]: string } } };
  waiterTranslationsCache: { [waiterEmail: string]: { name?: { [languageCode: string]: string } } };
  getStatusColorForBadge: (status: OrderStatus) => string;
  getOrderTypeLabel: (type: OrderType) => string;
  getPaymentStatusLabel: (status: PaymentStatus) => string;
  getPaymentStatusColor: (status: PaymentStatus) => string;
  formatDateTime: (date: string) => string;
  formatCurrency: (amount: number, currency: string) => string;
  isMarkAsPaidEnabledForUser: () => boolean;
  markingAsPaidOrderId: string | null;
  markingAsCompleteOrderId: string | null;
  handleMarkAsPaid: (order: Order) => void;
  handleMarkAsComplete: (order: Order) => void;
  handleViewOrder: (order: Order) => void;
  t: (key: any, language: 'en' | 'ar' | 'ku' | 'fr') => string;
}

function OrderCardWithTimer({
  order,
  language,
  currency,
  branchTranslationsCache,
  waiterTranslationsCache,
  getStatusColorForBadge,
  getOrderTypeLabel,
  getPaymentStatusLabel,
  getPaymentStatusColor,
  formatDateTime,
  formatCurrency,
  isMarkAsPaidEnabledForUser,
  markingAsPaidOrderId,
  markingAsCompleteOrderId,
  handleMarkAsPaid,
  handleMarkAsComplete,
  handleViewOrder,
  t,
}: OrderCardWithTimerProps) {
  const { elapsedTimeFormatted, isStopped } = useOrderTimer(order);

  return (
                  <Card key={order.id} withBorder p="md">
                    <Group justify="space-between" align="flex-start">
                      <Stack gap="xs" style={{ flex: 1 }}>
                        <Group gap="md">
                          <Text fw={600} size="lg">
                            {t('pos.orderNumber', language)}: {order.orderNumber}
                          </Text>
                          {order.tokenNumber && (
                            <Text c="dimmed">
                              {t('pos.tokenNumber', language)}: {order.tokenNumber}
                            </Text>
                          )}
                          <Badge variant="light" color={getStatusColorForBadge(order.status)}>
                            {t(`orders.status.${order.status}`, language)}
                          </Badge>
                          <Badge variant="light" color={getBadgeColorForText(getOrderTypeLabel(order.orderType))}>
                            {getOrderTypeLabel(order.orderType)}
                          </Badge>
                          <Badge variant="light" color={getPaymentStatusColor(order.paymentStatus)}>
                            {getPaymentStatusLabel(order.paymentStatus)}
                          </Badge>
                        </Group>
                        <Group gap="md" align="flex-start">
                          {order.branch?.name && (
                            <Text size="sm" c="dimmed">
                              {branchTranslationsCache[order.branchId || '']?.name?.[language] || order.branch.name}
                            </Text>
                          )}
                          {order.waiterName && (
                            <Text size="sm" c="dimmed">
                              {t('orders.waiterName', language)}: {order.waiterEmail 
                                ? (waiterTranslationsCache[order.waiterEmail]?.name?.[language] || order.waiterName)
                                : order.waiterName}
                            </Text>
                          )}
                          {((order as any).tables && (order as any).tables.length > 0) || (order.table && order.table.table_number) ? (
                            <Text size="sm" c="dimmed">
                              {t('orders.tableNumber', language)}: {
                                (order as any).tables && (order as any).tables.length > 0
                                  ? (order as any).tables.map((t: any) => t.table_number).join(', ')
                                  : (order.table?.table_number || '')
                              }
                            </Text>
                          ) : null}
                          {order.customer && order.customer.name && (
                            <Text size="sm" c="dimmed">
                              {order.customer.name}
                            </Text>
                          )}
                          {order.orderDate && (
                            <Text size="sm" c="dimmed" style={{ lineHeight: '1.5' }}>
                              {formatDateTime(order.orderDate)}
                            </Text>
                          )}
                          {/* For scheduled orders, show scheduled date/time and prep time */}
                          {order.scheduledFor && (
                            <Group gap="md" align="flex-start">
                              <Group gap={4} align="center">
                                <IconClock size={14} />
                                <Text size="sm" c="dimmed" fw={500}>
                                  {t('orders.scheduledFor' as any, language)}: {formatDateTime(order.scheduledFor)}
                                </Text>
                              </Group>
                              {order.preparationTimeMinutes && (
                                <Text size="sm" c="dimmed" fw={500}>
                                  {t('orders.prepTime' as any, language)}: {order.preparationTimeMinutes} {t('orders.minutes' as any, language)}
                                </Text>
                              )}
                            </Group>
                          )}
                          {/* Timer display - show for preparing, ready, or served orders (NOT for pending) */}
                          {order.status !== 'pending' && (order.status === 'preparing' || order.status === 'ready' || order.status === 'served') && (
                            <Group gap={4} align="center">
                              <IconClock size={14} />
                              <Text size="sm" c="dimmed" fw={isStopped ? 600 : 400}>
                                {isStopped ? `${elapsedTimeFormatted}` : elapsedTimeFormatted}
                              </Text>
                            </Group>
                          )}
                        </Group>
                        <Group gap="md">
                          <Text size="sm" fw={500}>
                            {t('pos.subtotal', language)}: {formatCurrency(order.subtotal || 0, currency)}
                          </Text>
                          {(order.discountAmount || 0) > 0 && (
                            <Text size="sm" c={getSuccessColor()}>
                              {t('pos.discount', language)}: -{formatCurrency(order.discountAmount || 0, currency)}
                            </Text>
                          )}
                          <Text size="sm" fw={600}>
                            {t('pos.grandTotal', language)}: {formatCurrency(order.totalAmount || 0, currency)}
                          </Text>
                        </Group>
                      </Stack>
                      <Group gap="xs">
                        {(order.paymentStatus === 'unpaid' || order.paymentStatus === 'partial') && isMarkAsPaidEnabledForUser() && (
                          <Button
                            size="sm"
                            variant={markingAsPaidOrderId === order.id ? "filled" : "light"}
                            color={getSuccessColor()}
                            onClick={() => {
                              if (markingAsPaidOrderId !== order.id) {
                                handleMarkAsPaid(order);
                              }
                            }}
                            loading={markingAsPaidOrderId === order.id}
                            disabled={markingAsPaidOrderId === order.id}
                          >
                            {t('orders.markAsPaid', language)}
                          </Button>
                        )}
                        {order.status !== 'completed' && order.status !== 'cancelled' && (
                          <ActionIcon
                            size="lg"
                            variant="light"
                            color={getSuccessColor()}
                            onClick={() => {
                              if (markingAsCompleteOrderId !== order.id) {
                                handleMarkAsComplete(order);
                              }
                            }}
                            loading={markingAsCompleteOrderId === order.id}
                            disabled={markingAsCompleteOrderId === order.id}
                            title={t('orders.completed' as any, language)}
                          >
                            <IconCheck size={18} />
                          </ActionIcon>
                        )}
                        <Menu>
                          <Menu.Target>
                            <ActionIcon variant="subtle">
                              <IconDotsVertical size={16} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item
                              leftSection={<IconEye size={16} />}
                              onClick={() => handleViewOrder(order)}
                            >
                              {t('common.view' as any, language)}
                            </Menu.Item>
                            {(order.paymentStatus === 'unpaid' || order.paymentStatus === 'partial') && isMarkAsPaidEnabledForUser() && (
                              <Menu.Item
                                leftSection={<IconCheck size={16} />}
                                onClick={() => handleMarkAsPaid(order)}
                                disabled={markingAsPaidOrderId === order.id}
                              >
                                {t('orders.markAsPaid', language)}
                              </Menu.Item>
                            )}
                          </Menu.Dropdown>
                        </Menu>
                      </Group>
                    </Group>
                  </Card>
  );
}
