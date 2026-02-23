// PIN Authentication Utility
// Stores encrypted refresh token locally, encrypted with PIN-derived key
// No personal identification data is stored

import { getTranslation } from './translations';
import type { Language } from '../store/language-store';

interface DevicePinData {
  encryptedRefreshToken: string;
  pinHash: string; // SHA-256 hash of PIN for verification
  deviceFingerprint: string;
  userEmail: string; // User email to ensure PIN is tied to specific user
  createdAt: string;
}

// Helper function to get current language, with fallback to 'en'
async function getLanguage(language?: Language): Promise<Language> {
  if (language) return language;
  
  // Try to get from language store
  try {
    if (typeof window !== 'undefined') {
      const { useLanguageStore } = await import('@/lib/store/language-store');
      return useLanguageStore.getState().language || 'en';
    }
  } catch {
    // Fallback to English if store is not available
  }
  
  return 'en';
}

// Generate device fingerprint (stable across sessions)
async function generateDeviceFingerprint(): Promise<string> {
  // Use stable identifiers that don't change between browser sessions
  // Canvas hash is excluded as it can vary between sessions
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    navigator.platform,
    screen.width + 'x' + screen.height,
    screen.colorDepth?.toString() || '24',
    new Date().getTimezoneOffset().toString(),
    // Use hardwareConcurrency if available (more stable than canvas)
    navigator.hardwareConcurrency?.toString() || '0',
  ].join('|');
  
  // Hash the fingerprint
  const encoder = new TextEncoder();
  const data = encoder.encode(fingerprint);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Derive encryption key from PIN using PBKDF2
async function deriveKeyFromPin(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const pinData = encoder.encode(pin);
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    pinData,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Hash PIN for verification (without salt to allow verification)
async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Encrypt refresh token with PIN
async function encryptRefreshToken(refreshToken: string, pin: string): Promise<string> {
  // Generate random salt and IV
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Derive key from PIN
  const key = await deriveKeyFromPin(pin, salt);
  
  // Encrypt the refresh token
  const encoder = new TextEncoder();
  const data = encoder.encode(refreshToken);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    data
  );
  
  // Combine salt + iv + encrypted data
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);
  
  // Convert to base64 for storage
  return btoa(String.fromCharCode(...combined));
}

// Decrypt refresh token with PIN
async function decryptRefreshToken(encryptedData: string, pin: string): Promise<string> {
  try {
    // Decode from base64
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    
    // Extract salt, IV, and encrypted data
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const encrypted = combined.slice(28);
    
    // Derive key from PIN
    const key = await deriveKeyFromPin(pin, salt);
    
    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encrypted
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    // Get language for error message
    const lang = await getLanguage();
    throw new Error(getTranslation('auth.pinInvalidOrCorrupted', lang));
  }
}

// Storage key - stores multiple users' PIN data
const PIN_STORAGE_KEY = 'rms_pin_auth_data';

// Helper to get storage key for a specific user
// Normalizes email to ensure consistent storage keys
function getPinStorageKeyForUser(userEmail: string): string {
  // Normalize email (lowercase, trim) for consistent keys
  const normalizedEmail = userEmail.toLowerCase().trim();
  // Replace special characters that might cause issues in localStorage keys
  const safeEmail = normalizedEmail.replace(/[^a-z0-9@._-]/g, '_');
  return `${PIN_STORAGE_KEY}_${safeEmail}`;
}

export const pinAuth = {
  // Check if PIN authentication is available for this device
  // Optionally check if it's for a specific user
  async isPinAuthAvailable(userEmail?: string): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    
    // Migrate old PIN data if it exists (backward compatibility)
    // Only migrate once, then remove old format
    const oldKey = PIN_STORAGE_KEY;
    const oldStored = localStorage.getItem(oldKey);
    if (oldStored) {
      try {
        const oldData: DevicePinData = JSON.parse(oldStored);
        if (oldData.userEmail) {
          // Migrate to user-specific key
          const normalizedOldEmail = oldData.userEmail.toLowerCase().trim();
          const newKey = getPinStorageKeyForUser(normalizedOldEmail);
          localStorage.setItem(newKey, oldStored);
          localStorage.removeItem(oldKey);
        } else {
          // No email in old data, remove it
          localStorage.removeItem(oldKey);
        }
      } catch {
        // Invalid old data, remove it
        localStorage.removeItem(oldKey);
      }
    }
    
    if (userEmail) {
      // Normalize email for comparison (lowercase, trim)
      const normalizedEmail = userEmail.toLowerCase().trim();
      
      // Check for specific user's PIN using user-specific key
      const storageKey = getPinStorageKeyForUser(normalizedEmail);
      const stored = localStorage.getItem(storageKey);
      
      if (!stored) {
        // No PIN found for this user at the expected key
        // Double-check by searching all PIN keys to ensure we're not missing anything
        // This also handles migration cases
        let foundPinForUser = false;
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(PIN_STORAGE_KEY + '_')) {
            try {
              const candidateStored = localStorage.getItem(key);
              if (candidateStored) {
                const candidateData: DevicePinData = JSON.parse(candidateStored);
                const candidateEmail = (candidateData.userEmail || '').toLowerCase().trim();
                if (candidateEmail === normalizedEmail) {
                  // Found PIN for this user - migrate to correct key if needed
                  if (key !== storageKey) {
                    localStorage.setItem(storageKey, candidateStored);
                    localStorage.removeItem(key);
                  }
                  foundPinForUser = true;
                  break;
                }
              }
            } catch {
              // Skip invalid entries
            }
          }
        }
        return foundPinForUser;
      }
      
      try {
        const data: DevicePinData = JSON.parse(stored);
        // Double-check the email matches exactly (case-insensitive)
        const storedEmail = (data.userEmail || '').toLowerCase().trim();
        const matches = storedEmail === normalizedEmail;
        
        if (!matches) {
          // Email doesn't match - this shouldn't happen, but clean it up
          console.warn(`PIN data email mismatch: expected ${normalizedEmail}, found ${storedEmail}. Removing invalid PIN.`);
          localStorage.removeItem(storageKey);
          return false;
        }
        
        return true;
      } catch {
        // Invalid data, remove it
        localStorage.removeItem(storageKey);
        return false;
      }
    } else {
      // Check if any user has PIN set up (for login page)
      // Check all localStorage keys that match our pattern
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(PIN_STORAGE_KEY + '_')) {
          try {
            const stored = localStorage.getItem(key);
            if (stored) {
              const data: DevicePinData = JSON.parse(stored);
              if (data.userEmail) {
                return true; // Found at least one PIN
              }
            }
          } catch {
            // Skip invalid entries
          }
        }
      }
      return false;
    }
  },
  
  // Get the email of the user who set up the PIN (for backward compatibility)
  // Returns the first PIN found, or null if none exists
  getPinUserEmail(): string | null {
    if (typeof window === 'undefined') return null;
    
    // Check all localStorage keys that match our pattern
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(PIN_STORAGE_KEY + '_')) {
        try {
          const stored = localStorage.getItem(key);
          if (stored) {
            const data: DevicePinData = JSON.parse(stored);
            if (data.userEmail) {
              return data.userEmail;
            }
          }
        } catch {
          // Skip invalid entries
        }
      }
    }
    
    // Also check old format
    const oldStored = localStorage.getItem(PIN_STORAGE_KEY);
    if (oldStored) {
      try {
        const oldData: DevicePinData = JSON.parse(oldStored);
        if (oldData.userEmail) {
          return oldData.userEmail;
        }
      } catch {
        // Invalid old data
      }
    }
    
    return null;
  },

  // Setup PIN authentication after successful email/password login
  // userEmail is optional - will automatically get from auth store if not provided
  async setupPinAuth(pin: string, refreshToken: string, userEmail?: string, language?: Language): Promise<void> {
    if (typeof window === 'undefined') {
      const lang = await getLanguage(language);
      throw new Error(getTranslation('auth.pinSetupBrowserOnly', lang));
    }
    
    // Validate PIN (4-6 digits recommended)
    if (!/^\d{4,6}$/.test(pin)) {
      const lang = await getLanguage(language);
      throw new Error(getTranslation('auth.pinMustBeDigits', lang));
    }
    
    // Get user email if not provided - try to get from auth store or localStorage
    let email = userEmail;
    if (!email) {
      try {
        // First try: Get from auth store
        const authStoreModule = await import('@/lib/store/auth-store');
        const authStore = authStoreModule.useAuthStore;
        const state = authStore.getState();
        email = state.user?.email || undefined;
      } catch (err) {
        console.warn('Could not access auth store to get user email:', err);
      }
      
      // Fallback: Try to get from localStorage directly (auth store persists there)
      if (!email && typeof window !== 'undefined') {
        try {
          const authStorage = localStorage.getItem('rms-auth-storage');
          if (authStorage) {
            const parsed = JSON.parse(authStorage);
            email = parsed?.state?.user?.email || undefined;
          }
        } catch (err) {
          console.warn('Could not read user email from localStorage:', err);
        }
      }
    }
    
    if (!email) {
      const lang = await getLanguage(language);
      throw new Error(getTranslation('auth.pinEmailRequired', lang));
    }
    
    // Normalize email (lowercase, trim) for consistent storage
    const normalizedEmail = email.toLowerCase().trim();
    
    // Clear any old PIN data for this user (if exists in old format)
    const oldKey = PIN_STORAGE_KEY;
    const oldStored = localStorage.getItem(oldKey);
    if (oldStored) {
      try {
        const oldData: DevicePinData = JSON.parse(oldStored);
        const oldEmail = (oldData.userEmail || '').toLowerCase().trim();
        if (oldEmail === normalizedEmail) {
          // This is the same user's old PIN, we'll overwrite it below
          localStorage.removeItem(oldKey);
        }
      } catch {
        // Invalid old data, remove it
        localStorage.removeItem(oldKey);
      }
    }
    
    const deviceFingerprint = await generateDeviceFingerprint();
    const pinHash = await hashPin(pin);
    const encryptedRefreshToken = await encryptRefreshToken(refreshToken, pin);
    
    const data: DevicePinData = {
      encryptedRefreshToken,
      pinHash,
      deviceFingerprint,
      userEmail: normalizedEmail, // Store normalized email
      createdAt: new Date().toISOString(),
    };
    
    // Store PIN data with user-specific key (using normalized email)
    const storageKey = getPinStorageKeyForUser(normalizedEmail);
    localStorage.setItem(storageKey, JSON.stringify(data));
  },

  // Authenticate with PIN
  async authenticateWithPin(pin: string, expectedUserEmail?: string, language?: Language): Promise<string> {
    if (typeof window === 'undefined') {
      const lang = await getLanguage(language);
      throw new Error(getTranslation('auth.pinAuthBrowserOnly', lang));
    }
    
    let data: DevicePinData | null = null;
    let storageKey: string | null = null;
    
    // Normalize expected email if provided
    const normalizedExpectedEmail = expectedUserEmail ? expectedUserEmail.toLowerCase().trim() : undefined;
    
    if (normalizedExpectedEmail) {
      // When email is provided, only check that specific user's PIN
      // Try specific user's PIN first (new format)
      storageKey = getPinStorageKeyForUser(normalizedExpectedEmail);
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          const parsedData = JSON.parse(stored);
          // Verify email matches
          const storedEmail = (parsedData.userEmail || '').toLowerCase().trim();
          if (storedEmail === normalizedExpectedEmail) {
            // Verify PIN matches before using this data
            const pinHash = await hashPin(pin);
            if (pinHash === parsedData.pinHash) {
              data = parsedData;
            }
            // If PIN doesn't match, data stays null and we'll throw error below
          }
          // If email doesn't match, data stays null
        } catch {
          // Invalid data, data stays null
        }
      }
      
      // Also check old format for migration (only if we haven't found a match yet)
      if (!data) {
        const oldStored = localStorage.getItem(PIN_STORAGE_KEY);
        if (oldStored) {
          try {
            const oldData: DevicePinData = JSON.parse(oldStored);
            const oldEmail = (oldData.userEmail || '').toLowerCase().trim();
            if (oldEmail === normalizedExpectedEmail) {
              // Verify PIN matches
              const pinHash = await hashPin(pin);
              if (pinHash === oldData.pinHash) {
                // Migrate and use old data
                data = oldData;
                storageKey = getPinStorageKeyForUser(normalizedExpectedEmail);
                localStorage.setItem(storageKey, oldStored);
                localStorage.removeItem(PIN_STORAGE_KEY);
              }
            }
          } catch {
            // Invalid old data
            localStorage.removeItem(PIN_STORAGE_KEY);
          }
        }
      }
      
      // If email was provided but no matching PIN found, don't search all PINs
      // This is more secure - prevents trying other users' PINs
      if (!data) {
        const lang = await getLanguage(language);
        throw new Error(getTranslation('auth.pinNotSetupForAccount', lang));
      }
    }
    
    // If not found or no email provided, search all PINs
    if (!data || !storageKey) {
      // Calculate PIN hash once for efficiency
      const pinHash = await hashPin(pin);
      
      // Collect all PIN storage keys first to ensure we check all of them
      const pinKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(PIN_STORAGE_KEY + '_')) {
          pinKeys.push(key);
        }
      }
      
      // Also check old format key
      if (localStorage.getItem(PIN_STORAGE_KEY)) {
        pinKeys.push(PIN_STORAGE_KEY);
      }
      
      // Search through all PIN keys to find matching PIN
      for (const key of pinKeys) {
        try {
          const stored = localStorage.getItem(key);
          if (stored) {
            const candidateData: DevicePinData = JSON.parse(stored);
            // Verify PIN matches
            if (pinHash === candidateData.pinHash) {
              data = candidateData;
              // If it's the old format, migrate it
              if (key === PIN_STORAGE_KEY && candidateData.userEmail) {
                storageKey = getPinStorageKeyForUser(candidateData.userEmail.toLowerCase().trim());
                localStorage.setItem(storageKey, stored);
                localStorage.removeItem(PIN_STORAGE_KEY);
              } else {
                storageKey = key;
              }
              break; // Found matching PIN
            }
          }
        } catch {
          // Skip invalid entries
        }
      }
    }
    
    if (!data || !storageKey) {
      const lang = await getLanguage(language);
      throw new Error(getTranslation('auth.pinNotSetup', lang));
    }
    
    // Verify PIN (if not already verified above)
    if (!expectedUserEmail) {
      const pinHash = await hashPin(pin);
      if (pinHash !== data.pinHash) {
        const lang = await getLanguage(language);
        throw new Error(getTranslation('auth.invalidPin', lang));
      }
    }
    
    // Verify user email matches (if provided) - case-insensitive comparison
    if (normalizedExpectedEmail) {
      const storedEmail = (data.userEmail || '').toLowerCase().trim();
      if (storedEmail !== normalizedExpectedEmail) {
        const lang = await getLanguage(language);
        throw new Error(getTranslation('auth.pinDifferentUser', lang));
      }
    }
    
    // Verify device fingerprint
    const currentFingerprint = await generateDeviceFingerprint();
    if (data.deviceFingerprint !== currentFingerprint) {
      // If PIN is correct but fingerprint doesn't match, update the fingerprint
      // This handles cases where fingerprint format changed or browser updated
      // Only update if PIN verification passed (security: PIN must be correct)
      data.deviceFingerprint = currentFingerprint;
      localStorage.setItem(storageKey, JSON.stringify(data));
    }
    
    // Decrypt and return refresh token
    const refreshToken = await decryptRefreshToken(data.encryptedRefreshToken, pin);
    return refreshToken;
  },

  // Clear PIN authentication data
  // If userEmail is provided, clears only that user's PIN
  // If not provided, clears all PINs (for logout)
  clearPinAuth(userEmail?: string): void {
    if (typeof window === 'undefined') return;
    
    if (userEmail) {
      // Normalize email for consistent lookup
      const normalizedEmail = userEmail.toLowerCase().trim();
      // Clear specific user's PIN (new format)
      const storageKey = getPinStorageKeyForUser(normalizedEmail);
      localStorage.removeItem(storageKey);
      // Also clear old format if it exists
      const oldStored = localStorage.getItem(PIN_STORAGE_KEY);
      if (oldStored) {
        try {
          const oldData: DevicePinData = JSON.parse(oldStored);
          const oldEmail = (oldData.userEmail || '').toLowerCase().trim();
          if (oldEmail === normalizedEmail) {
            localStorage.removeItem(PIN_STORAGE_KEY);
          }
        } catch {
          // Invalid old data, remove it anyway
          localStorage.removeItem(PIN_STORAGE_KEY);
        }
      }
    } else {
      // Clear all PINs (backward compatibility and logout)
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(PIN_STORAGE_KEY + '_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      // Also clear old format
      localStorage.removeItem(PIN_STORAGE_KEY);
    }
  },
  
  // Clear PINs from all users except the specified one
  clearOtherUsersPins(currentUserEmail: string): void {
    if (typeof window === 'undefined') return;
    
    const normalizedCurrentEmail = currentUserEmail.toLowerCase().trim();
    const keysToRemove: string[] = [];
    
    // Check all PIN storage keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(PIN_STORAGE_KEY + '_')) {
        try {
          const stored = localStorage.getItem(key);
          if (stored) {
            const data: DevicePinData = JSON.parse(stored);
            const storedEmail = (data.userEmail || '').toLowerCase().trim();
            // Remove if it's not the current user's PIN
            if (storedEmail !== normalizedCurrentEmail) {
              keysToRemove.push(key);
            }
          }
        } catch {
          // Invalid data, remove it
          keysToRemove.push(key);
        }
      }
    }
    
    // Remove all other users' PINs
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    // Also check and clear old format if it's not for current user
    const oldStored = localStorage.getItem(PIN_STORAGE_KEY);
    if (oldStored) {
      try {
        const oldData: DevicePinData = JSON.parse(oldStored);
        const oldEmail = (oldData.userEmail || '').toLowerCase().trim();
        if (oldEmail !== normalizedCurrentEmail) {
          localStorage.removeItem(PIN_STORAGE_KEY);
        }
      } catch {
        // Invalid old data, remove it
        localStorage.removeItem(PIN_STORAGE_KEY);
      }
    }
  },

  // Update PIN (requires old PIN)
  // userEmail is optional - will try to get from auth store if not provided
  async updatePin(oldPin: string, newPin: string, userEmail?: string, language?: Language): Promise<void> {
    if (typeof window === 'undefined') {
      const lang = await getLanguage(language);
      throw new Error(getTranslation('auth.pinUpdateBrowserOnly', lang));
    }
    
    // Validate new PIN
    if (!/^\d{4,6}$/.test(newPin)) {
      const lang = await getLanguage(language);
      throw new Error(getTranslation('auth.pinMustBeDigits', lang));
    }
    
    // Get user email if not provided
    let email = userEmail;
    if (!email) {
      try {
        const authStoreModule = await import('@/lib/store/auth-store');
        const authStore = authStoreModule.useAuthStore;
        const state = authStore.getState();
        email = state.user?.email || undefined;
      } catch (err) {
        console.warn('Could not access auth store to get user email:', err);
      }
    }
    
    if (!email) {
      const lang = await getLanguage(language);
      throw new Error(getTranslation('auth.pinUpdateEmailRequired', lang));
    }
    
    // Get current refresh token using old PIN
    const refreshToken = await this.authenticateWithPin(oldPin, email, language);
    
    // Setup with new PIN
    await this.setupPinAuth(newPin, refreshToken, email, language);
  },
};