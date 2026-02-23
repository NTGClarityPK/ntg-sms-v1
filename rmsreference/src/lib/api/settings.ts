import apiClient from './client';
import { API_ENDPOINTS } from '../constants/api';
import { getApiLanguage } from '../hooks/use-api-language';

export interface GeneralSettings {
  defaultLanguage?: string;
  defaultCurrency?: string;
  dateFormat?: string;
  timeFormat?: '12' | '24';
  firstDayOfWeek?: string;
  defaultOrderType?: string;
  autoPrintInvoices?: boolean;
  autoPrintKitchenTickets?: boolean;
  enableTableManagement?: boolean;
  enableDeliveryManagement?: boolean;
  minimumDeliveryOrderAmount?: number;
  emailNotifications?: boolean;
  smsNotifications?: boolean;
  soundAlerts?: boolean;
  totalTables?: number;
  defaultPreparationTimeMinutes?: number; // Default preparation time in minutes for scheduled orders
}

export interface InvoiceSettings {
  headerText?: string;
  footerText?: string;
  termsAndConditions?: string;
  showLogo?: boolean;
  showVatNumber?: boolean;
  showQrCode?: boolean;
  invoiceNumberFormat?: string;
  receiptTemplate?: 'thermal' | 'a4';
  customTemplate?: string;
}

export interface PaymentMethodSettings {
  enableCash?: boolean;
  enableCard?: boolean;
  enableZainCash?: boolean;
  enableAsiaHawala?: boolean;
  enableBankTransfer?: boolean;
  paymentGatewayConfig?: Record<string, any>;
}

export interface Printer {
  id?: string;
  name: string;
  type: 'receipt' | 'kitchen' | 'invoice';
  connectionType: 'usb' | 'network' | 'bluetooth';
  ipAddress?: string;
  counterId?: string;
}

export interface PrinterSettings {
  printers?: Printer[];
  autoPrint?: boolean;
  numberOfCopies?: number;
  paperSize?: string;
}

export interface TaxSettings {
  enableTaxSystem?: boolean;
  taxCalculationMethod?: 'included' | 'excluded';
  taxApplicationType?: 'order' | 'category' | 'item';
  applyTaxOnDelivery?: boolean;
  applyTaxOnServiceCharge?: boolean;
  applyTaxOnReservations?: boolean;
}

export interface Settings {
  general: GeneralSettings;
  invoice: InvoiceSettings;
  paymentMethods: PaymentMethodSettings;
  printers: PrinterSettings;
  tax: TaxSettings;
}

export interface UpdateSettingsDto {
  general?: GeneralSettings;
  invoice?: InvoiceSettings;
  paymentMethods?: PaymentMethodSettings;
  printers?: PrinterSettings;
  tax?: TaxSettings;
}

export interface RoleAccessConfiguration {
  id: string;
  tenantId: string;
  roleName: string;
  accessibleTabs: string[];
  blockedPaths: string[];
  kitchenDisplayEnabled: boolean;
  markAsPaidEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateRoleAccessConfigDto {
  roleName: string;
  accessibleTabs?: string[];
  blockedPaths?: string[];
  kitchenDisplayEnabled?: boolean;
  markAsPaidEnabled?: boolean;
}

export interface BulkUpdateRoleAccessConfigDto {
  configurations: UpdateRoleAccessConfigDto[];
}

export const settingsApi = {
  /**
   * Get all settings
   */
  getSettings: async (branchId?: string, language?: string): Promise<Settings> => {
    const lang = language || getApiLanguage();
    const params: any = { language: lang };
    if (branchId) params.branchId = branchId;
    const response = await apiClient.get(API_ENDPOINTS.SETTINGS, { params });
    return response.data;
  },

  /**
   * Get a specific settings category
   */
  getSettingCategory: async (category: string, branchId?: string, language?: string): Promise<any> => {
    const lang = language || getApiLanguage();
    const params: any = { language: lang };
    if (branchId) params.branchId = branchId;
    const response = await apiClient.get(`${API_ENDPOINTS.SETTINGS}/${category}`, { params });
    return response.data;
  },

  /**
   * Update settings
   */
  updateSettings: async (data: UpdateSettingsDto, branchId?: string, language?: string): Promise<Settings> => {
    const lang = language || getApiLanguage();
    const params: any = { language: lang };
    if (branchId) params.branchId = branchId;
    const response = await apiClient.put(API_ENDPOINTS.SETTINGS, data, { params });
    return response.data;
  },

  /**
   * Get all role access configurations
   */
  getRoleAccessConfigurations: async (): Promise<RoleAccessConfiguration[]> => {
    try {
      const response = await apiClient.get(`${API_ENDPOINTS.SETTINGS}/role-access`);
      // Ensure we always return an array
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.error('Failed to fetch role access configurations:', error);
      // Return empty array on error
      return [];
    }
  },

  /**
   * Get role access configuration for a specific role
   */
  getRoleAccessConfiguration: async (roleName: string): Promise<RoleAccessConfiguration> => {
    const response = await apiClient.get(`${API_ENDPOINTS.SETTINGS}/role-access/${roleName}`);
    return response.data;
  },

  /**
   * Update role access configuration
   */
  updateRoleAccessConfiguration: async (data: UpdateRoleAccessConfigDto): Promise<RoleAccessConfiguration> => {
    const response = await apiClient.put(`${API_ENDPOINTS.SETTINGS}/role-access`, data);
    return response.data;
  },

  /**
   * Bulk update role access configurations
   */
  bulkUpdateRoleAccessConfigurations: async (data: BulkUpdateRoleAccessConfigDto): Promise<RoleAccessConfiguration[]> => {
    const response = await apiClient.post(`${API_ENDPOINTS.SETTINGS}/role-access/bulk`, data);
    return response.data;
  },
};

