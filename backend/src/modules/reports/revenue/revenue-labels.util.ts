export type RevenueLocale = 'en-GB' | 'en-US' | 'ar';

export function normalizeRevenueLocale(locale?: string): RevenueLocale {
  const raw = (locale ?? 'en-GB').trim().toLowerCase();
  if (raw.startsWith('ar')) return 'ar';
  if (raw === 'en-us') return 'en-US';
  return 'en-GB';
}

const PAYMENT_METHOD_LABELS: Record<string, Record<RevenueLocale, string>> = {
  Bank_Transfer: {
    'en-GB': 'Bank transfer',
    'en-US': 'Bank transfer',
    ar: 'تحويل بنكي',
  },
  Cash: { 'en-GB': 'Cash', 'en-US': 'Cash', ar: 'نقداً' },
  Online: { 'en-GB': 'Online', 'en-US': 'Online', ar: 'عبر الإنترنت' },
  Cheque: { 'en-GB': 'Cheque', 'en-US': 'Check', ar: 'شيك' },
  Unknown: { 'en-GB': 'Other', 'en-US': 'Other', ar: 'أخرى' },
};

const SOURCE_LABELS: Record<string, Record<RevenueLocale, string>> = {
  fee_management: {
    'en-GB': 'Fee collection',
    'en-US': 'Fee collection',
    ar: 'تحصيل الرسوم',
  },
  id_card_reprints: {
    'en-GB': 'ID card reprints',
    'en-US': 'ID card reprints',
    ar: 'إعادة طباعة بطاقات الهوية',
  },
};

const PERSON_TYPE_LABELS: Record<string, Record<RevenueLocale, string>> = {
  student: { 'en-GB': 'Student', 'en-US': 'Student', ar: 'طالب' },
  staff: { 'en-GB': 'Staff', 'en-US': 'Staff', ar: 'موظف' },
  admin: { 'en-GB': 'Administrator', 'en-US': 'Administrator', ar: 'مسؤول' },
  visitor: { 'en-GB': 'Visitor', 'en-US': 'Visitor', ar: 'زائر' },
};

const REPORT_LABELS: Record<RevenueLocale, Record<string, string>> = {
  'en-GB': {
    title: 'Revenue report',
    period: 'Period',
    scope: 'Scope',
    scopeCurrent: 'Current branch',
    scopeBranch: 'Selected branch',
    scopeCombined: 'All branches',
    grandTotal: 'Grand total',
    bySource: 'Revenue by category',
    byBranch: 'Revenue by branch',
    byPaymentMethod: 'Fee collections by payment method',
    source: 'Category',
    enabled: 'Included',
    total: 'Total',
    transactions: 'Transactions',
    branch: 'Branch',
    fees: 'Fee collection',
    idCards: 'ID card reprints',
    paymentMethod: 'Payment method',
    yes: 'Yes',
    no: 'No',
    detailedFees: 'Fee payments (detail)',
    detailedIdCards: 'ID card reprint fees (detail)',
    person: 'Name',
    personType: 'Type',
    date: 'Date',
    amount: 'Amount',
    challan: 'Challan',
    cardNumber: 'Card number',
    reference: 'Reference',
  },
  'en-US': {
    title: 'Revenue report',
    period: 'Period',
    scope: 'Scope',
    scopeCurrent: 'Current branch',
    scopeBranch: 'Selected branch',
    scopeCombined: 'All branches',
    grandTotal: 'Grand total',
    bySource: 'Revenue by category',
    byBranch: 'Revenue by branch',
    byPaymentMethod: 'Fee collections by payment method',
    source: 'Category',
    enabled: 'Included',
    total: 'Total',
    transactions: 'Transactions',
    branch: 'Branch',
    fees: 'Fee collection',
    idCards: 'ID card reprints',
    paymentMethod: 'Payment method',
    yes: 'Yes',
    no: 'No',
    detailedFees: 'Fee payments (detail)',
    detailedIdCards: 'ID card reprint fees (detail)',
    person: 'Name',
    personType: 'Type',
    date: 'Date',
    amount: 'Amount',
    challan: 'Challan',
    cardNumber: 'Card number',
    reference: 'Reference',
  },
  ar: {
    title: 'تقرير الإيرادات',
    period: 'الفترة',
    scope: 'النطاق',
    scopeCurrent: 'الفرع الحالي',
    scopeBranch: 'فرع محدد',
    scopeCombined: 'جميع الفروع',
    grandTotal: 'الإجمالي',
    bySource: 'الإيرادات حسب الفئة',
    byBranch: 'الإيرادات حسب الفرع',
    byPaymentMethod: 'تحصيل الرسوم حسب طريقة الدفع',
    source: 'الفئة',
    enabled: 'مشمول',
    total: 'الإجمالي',
    transactions: 'المعاملات',
    branch: 'الفرع',
    fees: 'تحصيل الرسوم',
    idCards: 'إعادة طباعة البطاقات',
    paymentMethod: 'طريقة الدفع',
    yes: 'نعم',
    no: 'لا',
    detailedFees: 'مدفوعات الرسوم (تفصيلي)',
    detailedIdCards: 'رسوم إعادة طباعة البطاقة (تفصيلي)',
    person: 'الاسم',
    personType: 'النوع',
    date: 'التاريخ',
    amount: 'المبلغ',
    challan: 'إيصال',
    cardNumber: 'رقم البطاقة',
    reference: 'مرجع',
  },
};

export function getPaymentMethodLabel(methodKey: string, locale?: string): string {
  const loc = normalizeRevenueLocale(locale);
  return PAYMENT_METHOD_LABELS[methodKey]?.[loc] ?? PAYMENT_METHOD_LABELS.Unknown[loc];
}

export function getRevenueSourceLabel(sourceKey: string, locale?: string): string {
  const loc = normalizeRevenueLocale(locale);
  return SOURCE_LABELS[sourceKey]?.[loc] ?? sourceKey;
}

export function getPersonTypeLabel(personType: string, locale?: string): string {
  const loc = normalizeRevenueLocale(locale);
  return PERSON_TYPE_LABELS[personType]?.[loc] ?? personType;
}

export function getReportLabel(key: string, locale?: string): string {
  const loc = normalizeRevenueLocale(locale);
  return REPORT_LABELS[loc][key] ?? key;
}

export function getScopeLabel(
  scope: 'current' | 'branch' | 'combined',
  locale?: string,
): string {
  const loc = normalizeRevenueLocale(locale);
  if (scope === 'combined') return REPORT_LABELS[loc].scopeCombined;
  if (scope === 'branch') return REPORT_LABELS[loc].scopeBranch;
  return REPORT_LABELS[loc].scopeCurrent;
}
