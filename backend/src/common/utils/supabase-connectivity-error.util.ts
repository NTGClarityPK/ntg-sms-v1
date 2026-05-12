/**
 * Supabase JS uses undici/fetch under Node. When the host cannot reach Supabase (firewall, DNS, outage),
 * errors surface as `TypeError: fetch failed` with `UND_ERR_CONNECT_TIMEOUT` etc. — not "invalid token".
 */
export function isSupabaseConnectivityError(error: unknown): boolean {
  if (!error) return false;

  if (typeof error === 'object' && error !== null && 'cause' in error) {
    const cause = (error as { cause?: unknown }).cause;
    if (isSupabaseConnectivityError(cause)) return true;
  }

  const msg =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error);

  if (/fetch failed/i.test(msg)) return true;
  if (/ConnectTimeoutError|UND_ERR_CONNECT_TIMEOUT|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN/i.test(msg)) {
    return true;
  }

  return false;
}

export const SUPABASE_CONNECTIVITY_USER_MESSAGE =
  'Could not reach the authentication service. Check your internet connection, VPN, or firewall, then try again.';
