import apiClient from './client';
import { API_ENDPOINTS } from '../constants/api';
import { PaginationParams, PaginatedResponse } from '../types/pagination.types';

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'completed' | 'cancelled';
export type OrderType = 'dine_in' | 'takeaway' | 'delivery';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

export interface OrderItem {
  id: string;
  orderId: string;
  foodItemId?: string;
  foodItem?: {
    id: string;
    name: string;
    imageUrl?: string;
  };
  buffetId?: string;
  buffet?: {
    id: string;
    name: string;
    imageUrl?: string;
  };
  comboMealId?: string;
  comboMeal?: {
    id: string;
    name: string;
    imageUrl?: string;
    foodItemIds?: string[];
    foodItems?: {
      id: string;
      name: string;
      imageUrl?: string;
    }[];
  };
  variationId?: string;
  variation?: {
    id: string;
    variationGroup: string;
    variationGroupName?: string;
    variationName: string;
    priceAdjustment: number;
  };
  // Multiple variations support (one per variation group)
  variations?: {
    id: string;
    variationGroup: string;
    variationGroupName?: string;
    variationName: string;
    priceAdjustment: number;
  }[];
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxAmount: number;
  subtotal: number;
  specialInstructions?: string;
  status?: 'pending' | 'preparing' | 'ready' | 'served';
  addOns?: {
    id: string;
    addOnId: string;
    addOn?: {
      id: string;
      name: string;
      price: number;
    };
    quantity: number;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  tenantId: string;
  branchId: string;
  branch?: {
    id: string;
    name: string;
    code: string;
  };
  counterId?: string;
  counter?: {
    id: string;
    name: string;
    code: string;
  };
  tableId?: string;
  table?: {
    id: string;
    table_number: string;
    seating_capacity: number;
  };
  customerId?: string;
  customer?: {
    id: string;
    name: string;
    phone: string;
    email?: string;
  };
  waiterEmail?: string;
  waiterName?: string;
  orderNumber: string;
  tokenNumber?: string;
  orderType: OrderType;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  deliveryCharge: number;
  totalAmount: number;
  tipAmount?: number;
  couponCode?: string;
  couponDiscount?: number;
  specialInstructions?: string;
  numberOfPersons?: number;
  isSplitBill?: boolean;
  billSplitId?: string;
  orderDate: string;
  placedAt?: string; // ISO 8601 datetime string - when order was placed (reset when moving from pending to preparing)
  items?: OrderItem[];
  createdAt: string;
  updatedAt: string;
  scheduledFor?: string; // ISO 8601 datetime string for scheduled orders
  preparationTimeMinutes?: number; // Preparation time in minutes for this order
}

export interface GetOrdersParams {
  status?: OrderStatus | OrderStatus[];
  branchId?: string;
  orderType?: OrderType;
  paymentStatus?: PaymentStatus;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
  page?: number;
  includeItems?: boolean;
  search?: string;
  waiterEmail?: string;
  language?: string;
}

export interface UpdateOrderStatusDto {
  status: OrderStatus;
  cancellationReason?: string;
}

export interface UpdatePaymentStatusDto {
  paymentStatus: PaymentStatus;
  amountPaid?: number;
  paymentMethod?: 'cash' | 'card';
  tipAmount?: number;
}

export interface UpdateOrderItemStatusDto {
  status: 'pending' | 'preparing' | 'ready' | 'served';
}

export interface CreateOrderItemDto {
  foodItemId?: string;
  buffetId?: string;
  comboMealId?: string;
  quantity: number;
  variationId?: string;
  addOns?: {
    addOnId: string;
    quantity?: number;
  }[];
  specialInstructions?: string;
}

export interface CreateOrderDto {
  branchId: string;
  counterId?: string;
  tableId?: string;
  customerId?: string;
  orderType: OrderType;
  items: CreateOrderItemDto[];
  tokenNumber?: string;
  extraDiscountAmount?: number;
  couponCode?: string;
  specialInstructions?: string;
  paymentTiming?: 'pay_first' | 'pay_after';
  paymentMethod?: 'cash' | 'card' | 'zainCash' | 'asiaHawala' | 'bankTransfer';
  customerAddressId?: string;
  deliveryAddress?: string; // For walk-in delivery customers
  deliveryAddressCity?: string; // For walk-in delivery customers
  deliveryAddressState?: string; // For walk-in delivery customers
  deliveryAddressCountry?: string; // For walk-in delivery customers
  numberOfPersons?: number;
  scheduledFor?: string; // ISO 8601 datetime string for scheduled orders
  preparationTimeMinutes?: number; // Overrides default from settings
}

export interface UpdateOrderDto {
  tableId?: string;
  customerId?: string;
  orderType?: OrderType;
  items?: CreateOrderItemDto[];
  extraDiscountAmount?: number;
  couponCode?: string;
  specialInstructions?: string;
  customerAddressId?: string;
  deliveryAddress?: string; // For walk-in delivery customers
  deliveryAddressCity?: string; // For walk-in delivery customers
  deliveryAddressState?: string; // For walk-in delivery customers
  deliveryAddressCountry?: string; // For walk-in delivery customers
  numberOfPersons?: number;
}

export interface BillSplitItem {
  id?: string;
  orderItemId: string;
  quantity: number;
  amount?: number;
}

export interface BillSplitPayment {
  id?: string;
  personName?: string;
  personIndex: number;
  amount: number;
  tipAmount: number;
  paymentMethod: 'cash' | 'card' | 'zainCash' | 'asiaHawala' | 'bankTransfer';
  status: 'pending' | 'paid';
  items?: BillSplitItem[];
  paidAt?: string;
}

export interface BillSplit {
  id: string;
  orderId: string;
  splitType: 'equal' | 'per_person';
  totalAmount: number;
  tipAmount: number;
  payments: BillSplitPayment[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateBillSplitPaymentDto {
  personName?: string;
  amount: number;
  tipAmount?: number;
  paymentMethod: 'cash' | 'card';
  items?: BillSplitItem[]; // Only for per_person splits
}

export interface CreateBillSplitDto {
  splitType: 'equal' | 'per_person';
  payments: CreateBillSplitPaymentDto[];
  totalTipAmount?: number;
}

export const ordersApi = {
  async createOrder(data: CreateOrderDto): Promise<Order> {
    const response = await apiClient.post(API_ENDPOINTS.ORDERS, data);
    return response.data;
  },

  async getOrders(params?: GetOrdersParams): Promise<Order[] | PaginatedResponse<Order>> {
    // Convert status array to comma-separated string for query parameter
    const queryParams: any = { ...params };
    if (params?.status && Array.isArray(params.status)) {
      queryParams.status = params.status.join(',');
    }
    // Convert boolean to string for query parameter
    if (params?.includeItems !== undefined) {
      queryParams.includeItems = params.includeItems.toString();
    }
    const response = await apiClient.get<Order[] | PaginatedResponse<Order>>(API_ENDPOINTS.ORDERS, { params: queryParams });
    return response.data;
  },

  async getOrderById(id: string, language?: string): Promise<Order> {
    const params = language ? { language } : {};
    const response = await apiClient.get(`${API_ENDPOINTS.ORDERS}/${id}`, { params });
    return response.data;
  },

  async updateOrderStatus(id: string, data: UpdateOrderStatusDto): Promise<Order> {
    const response = await apiClient.put(`${API_ENDPOINTS.ORDERS}/${id}/status`, data);
    return response.data;
  },

  async updateOrder(id: string, data: UpdateOrderDto): Promise<Order> {
    const response = await apiClient.put(`${API_ENDPOINTS.ORDERS}/${id}`, data);
    return response.data;
  },

  async updatePaymentStatus(id: string, data: UpdatePaymentStatusDto): Promise<Order> {
    const response = await apiClient.put(`${API_ENDPOINTS.ORDERS}/${id}/payment`, data);
    return response.data;
  },

  async deleteOrder(id: string, reason?: string): Promise<void> {
    await apiClient.delete(`${API_ENDPOINTS.ORDERS}/${id}`, { params: { reason } });
  },

  async updateOrderItemStatus(orderId: string, itemId: string, data: UpdateOrderItemStatusDto): Promise<Order> {
    const response = await apiClient.put(`${API_ENDPOINTS.ORDERS}/${orderId}/items/${itemId}/status`, data);
    return response.data;
  },

  async createBillSplit(orderId: string, data: CreateBillSplitDto): Promise<BillSplit> {
    const response = await apiClient.post(`${API_ENDPOINTS.ORDERS}/${orderId}/bill-split`, data);
    return response.data;
  },

  async getBillSplit(orderId: string, language?: string): Promise<BillSplit | null> {
    const params = language ? { language } : {};
    const response = await apiClient.get(`${API_ENDPOINTS.ORDERS}/${orderId}/bill-split`, { params });
    return response.data;
  },

  async processBillSplitPayment(
    orderId: string,
    splitPaymentId: string,
    data: UpdatePaymentStatusDto,
  ): Promise<any> {
    const response = await apiClient.post(
      `${API_ENDPOINTS.ORDERS}/${orderId}/bill-split/${splitPaymentId}/pay`,
      data,
    );
    return response.data;
  },

  async deleteBillSplit(orderId: string): Promise<void> {
    await apiClient.delete(`${API_ENDPOINTS.ORDERS}/${orderId}/bill-split`);
  },
};

