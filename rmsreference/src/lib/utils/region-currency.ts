import { t } from './translations';
import { Language } from '../store/language-store';

/**
 * Maps timezone/region to default currency
 * This is used during signup to automatically detect the user's currency
 */
export function getCurrencyFromTimezone(timezone: string): string {
  // Map timezones to currencies
  const timezoneToCurrency: Record<string, string> = {
    // Middle East
    'Asia/Baghdad': 'IQD', // Iraq
    'Asia/Riyadh': 'SAR', // Saudi Arabia
    'Asia/Dubai': 'AED', // UAE
    'Asia/Kuwait': 'KWD', // Kuwait
    'Asia/Qatar': 'QAR', // Qatar
    'Asia/Bahrain': 'BHD', // Bahrain
    'Asia/Muscat': 'OMR', // Oman
    'Asia/Amman': 'JOD', // Jordan
    'Asia/Beirut': 'LBP', // Lebanon
    'Asia/Damascus': 'SYP', // Syria
    'Asia/Yemen': 'YER', // Yemen
    'Asia/Tehran': 'IRR', // Iran
    'Asia/Jerusalem': 'ILS', // Israel/Palestine
    
    // North America
    'America/New_York': 'USD',
    'America/Chicago': 'USD',
    'America/Denver': 'USD',
    'America/Los_Angeles': 'USD',
    'America/Toronto': 'CAD', // Canada
    'America/Mexico_City': 'MXN', // Mexico
    
    // Europe
    'Europe/London': 'GBP', // UK
    'Europe/Paris': 'EUR', // France
    'Europe/Berlin': 'EUR', // Germany
    'Europe/Rome': 'EUR', // Italy
    'Europe/Madrid': 'EUR', // Spain
    'Europe/Amsterdam': 'EUR', // Netherlands
    'Europe/Brussels': 'EUR', // Belgium
    'Europe/Vienna': 'EUR', // Austria
    'Europe/Stockholm': 'SEK', // Sweden
    'Europe/Oslo': 'NOK', // Norway
    'Europe/Copenhagen': 'DKK', // Denmark
    'Europe/Zurich': 'CHF', // Switzerland
    'Europe/Warsaw': 'PLN', // Poland
    'Europe/Prague': 'CZK', // Czech Republic
    'Europe/Budapest': 'HUF', // Hungary
    'Europe/Athens': 'EUR', // Greece
    
    // Asia Pacific
    'Asia/Tokyo': 'JPY', // Japan
    'Asia/Shanghai': 'CNY', // China
    'Asia/Hong_Kong': 'HKD', // Hong Kong
    'Asia/Singapore': 'SGD', // Singapore
    'Asia/Seoul': 'KRW', // South Korea
    'Asia/Bangkok': 'THB', // Thailand
    'Asia/Jakarta': 'IDR', // Indonesia
    'Asia/Manila': 'PHP', // Philippines
    'Asia/Kuala_Lumpur': 'MYR', // Malaysia
    'Asia/Ho_Chi_Minh': 'VND', // Vietnam
    'Asia/Colombo': 'LKR', // Sri Lanka
    'Asia/Dhaka': 'BDT', // Bangladesh
    'Asia/Kathmandu': 'NPR', // Nepal
    'Asia/Karachi': 'PKR', // Pakistan
    'Asia/Kolkata': 'INR', // India
    'Australia/Sydney': 'AUD', // Australia
    'Australia/Melbourne': 'AUD',
    'Pacific/Auckland': 'NZD', // New Zealand
    
    // Africa
    'Africa/Cairo': 'EGP', // Egypt
    'Africa/Johannesburg': 'ZAR', // South Africa
    'Africa/Lagos': 'NGN', // Nigeria
    'Africa/Nairobi': 'KES', // Kenya
    'Africa/Casablanca': 'MAD', // Morocco
    
    // South America
    'America/Sao_Paulo': 'BRL', // Brazil
    'America/Buenos_Aires': 'ARS', // Argentina
    'America/Santiago': 'CLP', // Chile
    'America/Lima': 'PEN', // Peru
    'America/Bogota': 'COP', // Colombia
  };
  
  // Direct match
  if (timezoneToCurrency[timezone]) {
    return timezoneToCurrency[timezone];
  }
  
  // Fallback: try to match by region prefix
  if (timezone.startsWith('Asia/')) {
    // Default for Middle East if not specifically matched
    if (['Asia/Baghdad', 'Asia/Riyadh', 'Asia/Dubai', 'Asia/Kuwait', 'Asia/Qatar', 
         'Asia/Bahrain', 'Asia/Muscat', 'Asia/Amman', 'Asia/Beirut', 'Asia/Damascus'].some(tz => timezone.includes(tz.split('/')[1]))) {
      return 'IQD'; // Default Middle East currency
    }
    return 'USD'; // Default for other Asian countries
  }
  
  if (timezone.startsWith('Europe/')) {
    // Check if it's UK
    if (timezone.includes('London')) {
      return 'GBP';
    }
    return 'EUR'; // Default for Europe
  }
  
  if (timezone.startsWith('America/')) {
    // Check if it's Canada
    if (timezone.includes('Toronto') || timezone.includes('Vancouver') || timezone.includes('Montreal')) {
      return 'CAD';
    }
    return 'USD'; // Default for Americas
  }
  
  if (timezone.startsWith('Australia/') || timezone.startsWith('Pacific/')) {
    if (timezone.includes('Auckland')) {
      return 'NZD';
    }
    return 'AUD';
  }
  
  // Ultimate fallback
  return 'USD';
}

/**
 * Gets the user's timezone from the browser
 */
export function getUserTimezone(): string {
  if (typeof window === 'undefined') {
    return 'UTC';
  }
  
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    console.warn('Failed to detect timezone:', error);
    return 'UTC';
  }
}

/**
 * List of all currencies that can be detected from regions
 */
const ALL_CURRENCIES = [
  // Middle East
  'IQD', 'SAR', 'AED', 'KWD', 'QAR', 'BHD', 'OMR', 'JOD', 'LBP', 'SYP', 'YER', 'IRR', 'ILS',
  // North America
  'USD', 'CAD', 'MXN',
  // Europe
  'EUR', 'GBP', 'SEK', 'NOK', 'DKK', 'CHF', 'PLN', 'CZK', 'HUF',
  // Asia Pacific
  'JPY', 'CNY', 'HKD', 'SGD', 'KRW', 'THB', 'IDR', 'PHP', 'MYR', 'VND', 'LKR', 'BDT', 'NPR', 'PKR', 'INR', 'AUD', 'NZD',
  // Africa
  'EGP', 'ZAR', 'NGN', 'KES', 'MAD',
  // South America
  'BRL', 'ARS', 'CLP', 'PEN', 'COP',
];

/**
 * Gets currency label for display using translations
 */
export function getCurrencyLabel(currency: string, language: Language = 'en'): string {
  const translationKey = `currencies.${currency}` as any;
  const translated = t(translationKey, language);
  
  // If translation exists and is not just the key, return it
  if (translated && translated !== translationKey && !translated.includes('currencies.')) {
    return translated;
  }
  
  // Fallback to currency code
  return `${currency} - ${currency}`;
}

/**
 * Gets all available currencies as options for Select dropdown
 */
export function getCurrencyOptions(language: Language = 'en'): Array<{ value: string; label: string }> {
  return ALL_CURRENCIES.map((code) => ({
    value: code,
    label: getCurrencyLabel(code, language),
  }));
}

