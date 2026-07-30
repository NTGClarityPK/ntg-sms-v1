import { createHash } from 'crypto';

/**
 * Short-TTL cache for JwtAuthGuard Auth validation (Nano-safe).
 * Cuts repeated supabase.auth.getUser + role/active checks when the same
 * access token hits many APIs in a short window (e.g. dashboard load).
 *
 * Safety:
 * - TTL is short (default 30s) so logout / deactivate take effect quickly.
 * - Cache key is SHA-256 of the token (token never stored).
 * - Expired JWTs are never served from cache.
 * - Failures are never cached.
 */
export type CachedAuthUser = {
  userId: string;
  email: string;
  roles: string[];
};

type CacheEntry = CachedAuthUser & {
  expiresAtMs: number;
  tokenExpMs: number | null;
};

const DEFAULT_TTL_MS = 30_000;
const MAX_ENTRIES = 500;

const cache = new Map<string, CacheEntry>();

function ttlMs(): number {
  const raw = process.env.AUTH_USER_CACHE_TTL_MS;
  if (!raw) return DEFAULT_TTL_MS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 5_000) return DEFAULT_TTL_MS;
  // Cap at 2 minutes — longer would delay revoke/deactivate too much.
  return Math.min(n, 120_000);
}

function tokenKey(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Read JWT `exp` (ms) without verifying — only used after a successful getUser. */
export function readJwtExpiryMs(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2 || !parts[1]) return null;
    const json = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload = JSON.parse(json) as { exp?: unknown };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function getCachedAuthUser(token: string): CachedAuthUser | null {
  const key = tokenKey(token);
  const entry = cache.get(key);
  if (!entry) return null;

  const now = Date.now();
  if (now >= entry.expiresAtMs) {
    cache.delete(key);
    return null;
  }
  if (entry.tokenExpMs != null && now >= entry.tokenExpMs) {
    cache.delete(key);
    return null;
  }

  return {
    userId: entry.userId,
    email: entry.email,
    roles: entry.roles,
  };
}

export function setCachedAuthUser(token: string, user: CachedAuthUser): void {
  const key = tokenKey(token);
  if (cache.size >= MAX_ENTRIES && !cache.has(key)) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, {
    ...user,
    roles: [...user.roles],
    expiresAtMs: Date.now() + ttlMs(),
    tokenExpMs: readJwtExpiryMs(token),
  });
}

/** Test / emergency: clear all entries. */
export function clearAuthUserCache(): void {
  cache.clear();
}
