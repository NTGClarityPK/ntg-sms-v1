'use client';

import { Menu, Button, Group, Text, Stack } from '@mantine/core';
import { IconLanguage, IconCheck } from '@tabler/icons-react';
import { useLanguageStore, SUPPORTED_LANGUAGES } from '@/lib/store/language-store';
import { t } from '@/lib/utils/translations';
import { useEffect, useState } from 'react';
import { translationsApi, SupportedLanguage } from '@/lib/api/translations';
import { useAuthStore } from '@/lib/store/auth-store';
import { usePathname } from 'next/navigation';
import { useSubscription } from '@/lib/hooks/use-subscription';
import { planSupportsLanguage } from '@/lib/utils/subscription';
import { DEFAULT_THEME_COLOR } from '@/lib/utils/theme';

interface LanguageSelectorProps {
  variant?: 'button' | 'menu-item';
  size?: string;
}

// All supported languages for auth pages
const ALL_SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'en', name: 'English', nativeName: 'English', isActive: true, isDefault: true, rtl: false },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', isActive: true, isDefault: false, rtl: true },
  { code: 'ku', name: 'Kurdish', nativeName: 'کوردی', isActive: true, isDefault: false, rtl: true },
  { code: 'fr', name: 'French', nativeName: 'Français', isActive: true, isDefault: false, rtl: false },
];

// Cache tenant languages to prevent duplicate API calls
let tenantLanguagesCache: SupportedLanguage[] | null = null;
let tenantLanguagesCacheTimestamp: number = 0;
let tenantLanguagesCachePlanId: string | null = null;
const TENANT_LANGUAGES_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
let pendingTenantLanguagesRequest: Promise<SupportedLanguage[]> | null = null;

// Export function to invalidate cache (e.g., when languages are enabled/disabled)
export function invalidateTenantLanguagesCache() {
  tenantLanguagesCache = null;
  tenantLanguagesCacheTimestamp = 0;
  tenantLanguagesCachePlanId = null;
}

export function LanguageSelector({ variant = 'button', size = 'sm' }: LanguageSelectorProps) {
  const { language, setLanguage, getLanguageInfo } = useLanguageStore();
  const { isAuthenticated } = useAuthStore();
  const { subscription } = useSubscription();
  const pathname = usePathname();
  const currentLanguage = getLanguageInfo();
  const [tenantLanguages, setTenantLanguages] = useState<SupportedLanguage[]>([]);
  const [loading, setLoading] = useState(true);

  // Check if we're on an auth page
  const isAuthPage = pathname?.startsWith('/login') || pathname?.startsWith('/signup') || pathname?.startsWith('/auth') || pathname?.startsWith('/forgot-password') || pathname?.startsWith('/reset-password');

  useEffect(() => {
    // On auth pages, show all supported languages
    if (isAuthPage) {
      setTenantLanguages(ALL_SUPPORTED_LANGUAGES);
      setLoading(false);
      return;
    }

    // Only fetch tenant languages if user is authenticated
    if (!isAuthenticated) {
      // When signed out (but not on auth page), use default supported languages (English only)
      setTenantLanguages([
        { code: 'en', name: 'English', nativeName: 'English', isActive: true, isDefault: true, rtl: false },
      ]);
      setLoading(false);
      return;
    }

    // Check cache first
    const now = Date.now();
    const planId = subscription?.planId || null;
    // Don't require planId match for cache - plan filtering happens after caching
    const cacheValid = 
      tenantLanguagesCache && 
      (now - tenantLanguagesCacheTimestamp) < TENANT_LANGUAGES_CACHE_DURATION;

    if (cacheValid && tenantLanguagesCache) {
      // Filter languages based on subscription plan (only if plan is loaded)
      let filteredLangs: SupportedLanguage[] = tenantLanguagesCache;
      if (planId && subscription) {
        // Only filter if plan doesn't support the language
        filteredLangs = tenantLanguagesCache.filter((lang) => planSupportsLanguage(planId, lang.code));
      }
      // If no languages after filtering but we have cached languages, show all cached (plan might not be loaded yet)
      if (filteredLangs.length === 0 && tenantLanguagesCache.length > 0) {
        filteredLangs = tenantLanguagesCache;
      }
      setTenantLanguages(filteredLangs);
      setLoading(false);
      
      // Only switch language if current language is not in tenant languages AND languages have loaded
      // Don't switch if still loading or if languages list is empty
      if (filteredLangs.length > 0 && !filteredLangs.find((l) => l.code === language)) {
        setLanguage(filteredLangs[0].code as any);
      }
      return;
    }

    // If there's already a pending request, wait for it
    if (pendingTenantLanguagesRequest) {
      pendingTenantLanguagesRequest
        .then((langs) => {
          const planId = subscription?.planId;
          let filteredLangs = langs;
          // Only filter if plan is loaded and doesn't support the language
          if (planId && subscription) {
            filteredLangs = langs.filter((lang) => planSupportsLanguage(planId, lang.code));
          }
          // If no languages after filtering but we have languages, show all (plan might not be loaded yet)
          if (filteredLangs.length === 0 && langs.length > 0) {
            filteredLangs = langs;
          }
          setTenantLanguages(filteredLangs);
          // Only switch if current language is not in tenant languages AND languages have loaded
          if (filteredLangs.length > 0 && !filteredLangs.find((l) => l.code === language)) {
            setLanguage(filteredLangs[0].code as any);
          }
        })
        .catch(() => {
          // If pending request fails, continue to make a new request
          pendingTenantLanguagesRequest = null;
        })
        .finally(() => setLoading(false));
      return;
    }

    // Load tenant-enabled languages for authenticated users on dashboard
    const requestPromise = translationsApi.getTenantLanguages();
    pendingTenantLanguagesRequest = requestPromise;
    
    requestPromise
      .then((langs) => {
        // Update cache (store all languages, filter later based on plan)
        tenantLanguagesCache = langs;
        tenantLanguagesCacheTimestamp = now;
        tenantLanguagesCachePlanId = planId || null;
        
        // Filter languages based on subscription plan (only if plan is loaded)
        const currentPlanId = subscription?.planId;
        let filteredLangs: SupportedLanguage[] = langs;
        
        // Only filter if plan is loaded and doesn't support the language
        if (currentPlanId && subscription) {
          filteredLangs = langs.filter((lang) => planSupportsLanguage(currentPlanId, lang.code));
        }
        
        // If no languages after filtering but we have languages, show all (plan might not be loaded yet)
        if (filteredLangs.length === 0 && langs.length > 0) {
          filteredLangs = langs;
        }
        
        setTenantLanguages(filteredLangs);
        // Only switch if current language is not in tenant languages AND languages have loaded
        if (filteredLangs.length > 0 && !filteredLangs.find((l) => l.code === language)) {
          setLanguage(filteredLangs[0].code as any);
        }
        pendingTenantLanguagesRequest = null;
      })
      .catch((error) => {
        console.error('Failed to load tenant languages:', error);
        // Fallback to English only
        setTenantLanguages([
          { code: 'en', name: 'English', nativeName: 'English', isActive: true, isDefault: true, rtl: false },
        ]);
        pendingTenantLanguagesRequest = null;
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated, isAuthPage, subscription?.planId, subscription]); // Include subscription to re-filter when it loads
  
  // Separate effect to handle language switching when tenant languages change
  // Only switch if languages have loaded AND current language is not available
  // Don't switch if still loading (loading === true) or if languages list is empty
  // This ensures we preserve the persisted language until we know it's truly not available
  useEffect(() => {
    // Only run this check if we're not loading and have languages loaded
    // This prevents switching language before tenant languages are loaded
    if (!loading && tenantLanguages.length > 0 && !tenantLanguages.find((l) => l.code === language)) {
      // Current language is not in tenant languages, switch to first available
      setLanguage(tenantLanguages[0].code as any);
    }
  }, [tenantLanguages, language, setLanguage, loading]);

  const handleLanguageChange = (langCode: string) => {
    setLanguage(langCode as any);
    // Optionally refresh the page to update all translations
    // window.location.reload();
  };

  // Filter to only show tenant-enabled languages
  const availableLanguages = tenantLanguages.filter((lang) => lang.isActive);

  if (loading) {
    return (
      <Button variant="subtle" leftSection={<IconLanguage size={16} />} size={size as any} disabled>
        {currentLanguage.nativeName}
      </Button>
    );
  }

  if (variant === 'menu-item') {
    return (
      <Menu.Item
        style={{
          zIndex: 2000,
        }}
        leftSection={<IconLanguage size={16} />}
        rightSection={
          <Group gap={4}>
            {availableLanguages.map((lang) => (
              <Button
                key={lang.code}
                variant={language === lang.code ? 'light' : 'subtle'}
                size="xs"
                onClick={(e) => {
                  e.stopPropagation();
                  handleLanguageChange(lang.code);
                }}
                style={{
                  minWidth: 'auto',
                  padding: '2px 8px',
                }}
              >
                {lang.nativeName}
              </Button>
            ))}
          </Group>
        }
      >
        <Text size="sm">Language</Text>
      </Menu.Item>
    );
  }

  return (
    <Menu zIndex={2000} shadow="md" width={200} position="bottom-end">
      <Menu.Target>
        <Button
          variant="subtle"
          leftSection={<IconLanguage size={16} />}
          size={size as any}
          style={{
            fontWeight: 500,
            color: DEFAULT_THEME_COLOR
          }}
        >
          {currentLanguage.nativeName}
        </Button>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>{t('common.selectLanguage', language)}</Menu.Label>
        {availableLanguages.map((lang) => (
          <Menu.Item
            key={lang.code}
            leftSection={
              <IconCheck
                size={16}
                style={{
                  visibility: language === lang.code ? 'visible' : 'hidden',
                }}
              />
            }
            onClick={() => handleLanguageChange(lang.code)}
            style={{
              fontWeight: language === lang.code ? 600 : 400,
            }}
          >
            <Stack gap={2}>
              <Text size="sm" fw={language === lang.code ? 600 : 400}>
                {lang.nativeName}
              </Text>
              <Text size="xs" c="dimmed">
                {lang.name}
              </Text>
            </Stack>
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}

