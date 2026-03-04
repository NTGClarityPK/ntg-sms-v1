/* Client-side PIN authentication utility.
 * Stores AES-encrypted Supabase refresh tokens per email in localStorage.
 * Each entry is scoped to a specific device via a hashed device fingerprint.
 */

const PIN_SESSION_PREFIX = 'pin_session_';
const DEVICE_FINGERPRINT_KEY = 'pin_device_fingerprint';

export type PinAuthErrorCode = 'INVALID_PIN' | 'PIN_LOCKED' | 'NOT_SETUP' | 'CORRUPTED';

export class PinAuthError extends Error {
  code: PinAuthErrorCode;

  constructor(code: PinAuthErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'PinAuthError';
  }
}

export interface DevicePinData {
  encryptedRefreshToken: string;
  pinHash: string;
  userEmail: string;
  createdAt: string;
  failedAttempts: number;
  lockedUntil: string | null;
}

function ensureBrowser(): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    throw new PinAuthError('CORRUPTED', 'PIN authentication is only available in the browser.');
  }
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function getDeviceFingerprint(): Promise<string> {
  ensureBrowser();

  const cached = window.localStorage.getItem(DEVICE_FINGERPRINT_KEY);
  if (cached) return cached;

  const navigatorInfo = window.navigator;
  const screenInfo = window.screen;

  const parts: string[] = [
    navigatorInfo.userAgent,
    navigatorInfo.language,
    navigatorInfo.platform,
    `${screenInfo.width}x${screenInfo.height}`,
    String(screenInfo.colorDepth ?? 24),
    String(new Date().getTimezoneOffset()),
    String((navigatorInfo as { hardwareConcurrency?: number }).hardwareConcurrency ?? 0),
  ];

  const encoder = new TextEncoder();
  const data = encoder.encode(parts.join('|'));
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const fingerprint = toHex(hashBuffer);

  window.localStorage.setItem(DEVICE_FINGERPRINT_KEY, fingerprint);
  return fingerprint;
}

function normaliseEmail(email: string): string {
  return email.toLowerCase().trim();
}

function getStorageKeyForEmail(email: string): string {
  const normalised = normaliseEmail(email);
  const safe = normalised.replace(/[^a-z0-9@._-]/g, '_');
  return `${PIN_SESSION_PREFIX}${safe}`;
}

function readPinData(email: string): DevicePinData | null {
  ensureBrowser();
  const key = getStorageKeyForEmail(email);
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DevicePinData;
    // Basic shape check
    if (!parsed.encryptedRefreshToken || !parsed.pinHash || !parsed.userEmail) {
      throw new Error('Invalid PIN data');
    }
    return parsed;
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
}

function writePinData(email: string, data: DevicePinData): void {
  ensureBrowser();
  const key = getStorageKeyForEmail(email);
  window.localStorage.setItem(key, JSON.stringify(data));
}

function removePinData(email: string): void {
  ensureBrowser();
  const key = getStorageKeyForEmail(email);
  window.localStorage.removeItem(key);
}

function listAllPinKeys(): string[] {
  ensureBrowser();
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith(PIN_SESSION_PREFIX)) {
      keys.push(key);
    }
  }
  return keys;
}

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  return toHex(hashBuffer);
}

async function deriveKey(
  pin: string,
  deviceFingerprint: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const combined = encoder.encode(`${pin}:${deviceFingerprint}`);

  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    combined,
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new Uint8Array(salt),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function encryptRefreshToken(refreshToken: string, pin: string): Promise<string> {
  const deviceFingerprint = await getDeviceFingerprint();
  const encoder = new TextEncoder();

  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, deviceFingerprint, salt);

  const data = encoder.encode(refreshToken);
  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data,
  );

  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);

  // Base64 encode
  let binary = '';
  combined.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return window.btoa(binary);
}

async function decryptRefreshToken(encrypted: string, pin: string): Promise<string> {
  try {
    const deviceFingerprint = await getDeviceFingerprint();
    const binary = window.atob(encrypted);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }

    const salt = bytes.slice(0, 16);
    const iv = bytes.slice(16, 28);
    const cipherBytes = bytes.slice(28);

    const key = await deriveKey(pin, deviceFingerprint, salt);
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      cipherBytes,
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch {
    throw new PinAuthError(
      'CORRUPTED',
      'Stored PIN session data is corrupted on this device. Please set up PIN again.',
    );
  }
}

function isLocked(data: DevicePinData): boolean {
  if (!data.lockedUntil) return false;
  const until = new Date(data.lockedUntil);
  if (Number.isNaN(until.getTime())) return false;
  return until > new Date();
}

function updateFailedAttempt(data: DevicePinData): DevicePinData {
  const updated: DevicePinData = { ...data };
  const now = new Date();

  if (isLocked(updated)) {
    return updated;
  }

  updated.failedAttempts += 1;
  if (updated.failedAttempts >= 5) {
    const lockoutUntil = new Date(now.getTime() + 15 * 60 * 1000);
    updated.lockedUntil = lockoutUntil.toISOString();
    updated.failedAttempts = 0;
  }

  return updated;
}

function clearLockout(data: DevicePinData): DevicePinData {
  return {
    ...data,
    failedAttempts: 0,
    lockedUntil: null,
  };
}

export const pinAuth = {
  async isPinAuthAvailable(userEmail?: string): Promise<boolean> {
    ensureBrowser();
    if (userEmail) {
      const data = readPinData(userEmail);
      return Boolean(data);
    }

    const keys = listAllPinKeys();
    return keys.length > 0;
  },

  async setupPinAuth(pin: string, refreshToken: string, userEmail: string): Promise<void> {
    ensureBrowser();
    const normalisedEmail = normaliseEmail(userEmail);

    if (!/^\d{4,6}$/.test(pin)) {
      throw new PinAuthError('INVALID_PIN', 'PIN must be a 4–6 digit number.');
    }
    if (!refreshToken) {
      throw new PinAuthError('CORRUPTED', 'No active session found for PIN setup.');
    }

    const encryptedRefreshToken = await encryptRefreshToken(refreshToken, pin);
    const pinHash = await hashPin(pin);

    const data: DevicePinData = {
      encryptedRefreshToken,
      pinHash,
      userEmail: normalisedEmail,
      createdAt: new Date().toISOString(),
      failedAttempts: 0,
      lockedUntil: null,
    };

    writePinData(normalisedEmail, data);
  },

  async authenticateWithPin(
    pin: string,
    expectedUserEmail?: string,
  ): Promise<{ refreshToken: string; userEmail: string }> {
    ensureBrowser();

    if (!/^\d{4,6}$/.test(pin)) {
      throw new PinAuthError('INVALID_PIN', 'Invalid PIN. Please try again.');
    }

    const pinHash = await hashPin(pin);

    const resolveForEmail = async (email: string): Promise<{ refreshToken: string; userEmail: string }> => {
      const data = readPinData(email);
      if (!data) {
        throw new PinAuthError('NOT_SETUP', 'PIN is not set up on this device for this account.');
      }

      if (isLocked(data)) {
        throw new PinAuthError(
          'PIN_LOCKED',
          'Too many incorrect PIN attempts. Please try again in 15 minutes.',
        );
      }

      if (data.pinHash !== pinHash) {
        const updated = updateFailedAttempt(data);
        writePinData(email, updated);
        if (isLocked(updated)) {
          throw new PinAuthError(
            'PIN_LOCKED',
            'Too many incorrect PIN attempts. Please try again in 15 minutes.',
          );
        }
        throw new PinAuthError('INVALID_PIN', 'Invalid PIN. Please try again.');
      }

      // Correct PIN: clear lockout and decrypt
      const cleared = clearLockout(data);
      writePinData(email, cleared);
      const refreshToken = await decryptRefreshToken(cleared.encryptedRefreshToken, pin);
      return { refreshToken, userEmail: cleared.userEmail };
    };

    if (expectedUserEmail) {
      return resolveForEmail(expectedUserEmail);
    }

    // Parent path: search all blobs for matching pinHash
    const keys = listAllPinKeys();
    if (keys.length === 0) {
      throw new PinAuthError('NOT_SETUP', 'PIN is not set up on this device.');
    }

    for (const key of keys) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      try {
        const data = JSON.parse(raw) as DevicePinData;
        const email = data.userEmail;
        if (!email || typeof data.pinHash !== 'string') {
          continue;
        }

        if (data.pinHash !== pinHash) {
          continue;
        }

        // We found a candidate entry whose hash matches this PIN.
        // Reuse resolveForEmail to enforce lockout and decryption logic.
        return resolveForEmail(email);
      } catch {
        // Ignore malformed entries; they will be cleaned up lazily by other calls.
      }
    }

    // No matching pinHash found in any blob
    throw new PinAuthError('INVALID_PIN', 'Invalid PIN. Please try again.');
  },

  clearPinAuth(userEmail?: string): void {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return;

    if (userEmail) {
      removePinData(userEmail);
      return;
    }

    const keys = listAllPinKeys();
    keys.forEach((key) => window.localStorage.removeItem(key));
  },
};

