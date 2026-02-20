'use client';

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const INSTALL_DISMISSED_KEY = 'pwa-install-dismissed';

interface InstallAppContextValue {
  /** Trigger the browser install prompt (Chrome/Edge). Only works when canInstallDirectly is true. */
  promptInstall: () => Promise<void>;
  /** True if beforeinstallprompt is available and app is not already installed. */
  canInstallDirectly: boolean;
  /** True when running in Safari (desktop or iOS). */
  isSafari: boolean;
  /** True when app is running as installed PWA (standalone). */
  isInstalled: boolean;
  /** Open Safari instructions modal. */
  showSafariModal: boolean;
  setShowSafariModal: (v: boolean) => void;
  /** Whether the auto install prompt was dismissed this session. */
  installPromptDismissed: boolean;
  setInstallPromptDismissed: (v: boolean) => void;
}

const InstallAppContext = createContext<InstallAppContextValue | null>(null);

function isSafariBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  const vendor = window.navigator.vendor;
  return /Safari/i.test(ua) && /Apple/.test(vendor) && !/Chrome|CriOS|FxiOS/.test(ua);
}

function checkStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

export function InstallAppProvider({ children }: { children: ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showSafariModal, setShowSafariModal] = useState(false);
  const [installPromptDismissed, setInstallPromptDismissedState] = useState(false);
  const [isSafari] = useState(() => isSafariBrowser());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setInstallPromptDismissedState(sessionStorage.getItem(INSTALL_DISMISSED_KEY) === 'true');
  }, []);

  const setInstallPromptDismissed = useCallback((v: boolean) => {
    setInstallPromptDismissedState(v);
    if (typeof window !== 'undefined') {
      if (v) sessionStorage.setItem(INSTALL_DISMISSED_KEY, 'true');
      else sessionStorage.removeItem(INSTALL_DISMISSED_KEY);
    }
  }, []);

  useEffect(() => {
    setIsInstalled(checkStandalone());
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsInstalled(true);
    }
  }, [deferredPrompt]);

  const canInstallDirectly = Boolean(deferredPrompt && !isInstalled);

  const value: InstallAppContextValue = {
    promptInstall,
    canInstallDirectly,
    isSafari,
    isInstalled,
    showSafariModal,
    setShowSafariModal,
    installPromptDismissed,
    setInstallPromptDismissed,
  };

  return (
    <InstallAppContext.Provider value={value}>
      {children}
    </InstallAppContext.Provider>
  );
}

export function useInstallApp(): InstallAppContextValue {
  const ctx = useContext(InstallAppContext);
  if (!ctx) {
    return {
      promptInstall: async () => {},
      canInstallDirectly: false,
      isSafari: false,
      isInstalled: false,
      showSafariModal: false,
      setShowSafariModal: () => {},
      installPromptDismissed: true,
      setInstallPromptDismissed: () => {},
    };
  }
  return ctx;
}
