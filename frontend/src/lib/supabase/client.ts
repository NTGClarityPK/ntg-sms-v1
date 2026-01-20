import { createBrowserClient } from '@supabase/ssr';
import { Database } from './types';

interface CookieOptions {
  maxAge?: number;
  domain?: string;
  path?: string;
  sameSite?: 'strict' | 'lax' | 'none';
  secure?: boolean;
  httpOnly?: boolean;
}

interface Cookie {
  name: string;
  value: string;
  options?: CookieOptions;
}

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return document.cookie.split('; ').map((cookie) => {
            const [name, ...rest] = cookie.split('=');
            return { name, value: rest.join('=') };
          });
        },
        setAll(cookiesToSet: Cookie[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            let cookieString = `${name}=${value}`;
            if (options?.maxAge) {
              cookieString += `; max-age=${options.maxAge}`;
            }
            if (options?.domain) {
              cookieString += `; domain=${options.domain}`;
            }
            if (options?.path) {
              cookieString += `; path=${options.path}`;
            }
            if (options?.sameSite) {
              cookieString += `; samesite=${options.sameSite}`;
            }
            if (options?.secure) {
              cookieString += `; secure`;
            }
            if (options?.httpOnly) {
              cookieString += `; httponly`;
            }
            document.cookie = cookieString;
          });
        },
      },
    },
  );
}

export const supabase = createClient();

