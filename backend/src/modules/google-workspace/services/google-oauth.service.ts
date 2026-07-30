import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { GoogleOAuthTokens } from '../types/google-classroom.types';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

const CLASSROOM_SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.students.readonly',
  'https://www.googleapis.com/auth/classroom.rosters.readonly',
  'https://www.googleapis.com/auth/classroom.student-submissions.students.readonly',
  // Required to read student email addresses for grade matching
  'https://www.googleapis.com/auth/classroom.profile.emails',
  'openid',
  'email',
  'profile',
] as const;

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleUserInfo = {
  email?: string;
  sub?: string;
};

@Injectable()
export class GoogleOAuthService {
  constructor(private readonly configService: ConfigService) {}

  getAuthorizationUrl(state: string): string {
    const { clientId, redirectUri } = this.requireOAuthConfig();
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: CLASSROOM_SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    });
    return `${AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<GoogleOAuthTokens> {
    const { clientId, clientSecret, redirectUri } = this.requireOAuthConfig();
    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const tokenPayload = await this.postForm<GoogleTokenResponse>(TOKEN_URL, body);
    if (!tokenPayload.access_token) {
      throw new BadRequestException(
        tokenPayload.error_description ||
          'Failed to exchange Google authorisation code',
      );
    }

    const expiresAt = new Date(
      Date.now() + (tokenPayload.expires_in ?? 3600) * 1000,
    );
    const scopes = this.parseScopes(tokenPayload.scope);
    const email = await this.fetchEmail(tokenPayload.access_token);

    return {
      accessToken: tokenPayload.access_token,
      refreshToken: tokenPayload.refresh_token ?? null,
      expiresAt,
      email,
      scopes,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<GoogleOAuthTokens> {
    const { clientId, clientSecret } = this.requireOAuthConfig();
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const tokenPayload = await this.postForm<GoogleTokenResponse>(TOKEN_URL, body);
    if (!tokenPayload.access_token) {
      throw new BadRequestException(
        tokenPayload.error_description ||
          'Failed to refresh Google access token. Please reconnect Google Classroom.',
      );
    }

    const expiresAt = new Date(
      Date.now() + (tokenPayload.expires_in ?? 3600) * 1000,
    );
    const scopes = this.parseScopes(tokenPayload.scope);
    const email = await this.fetchEmail(tokenPayload.access_token);

    return {
      accessToken: tokenPayload.access_token,
      refreshToken: tokenPayload.refresh_token ?? refreshToken,
      expiresAt,
      email,
      scopes,
    };
  }

  async revokeToken(token: string): Promise<void> {
    const body = new URLSearchParams({ token });
    try {
      await this.postForm<{ error?: string }>(REVOKE_URL, body);
    } catch {
      // Best-effort revoke; local disconnect still proceeds.
    }
  }

  private requireOAuthConfig(): {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  } {
    const clientId = this.configService.get<string>('GOOGLE_CLASSROOM_CLIENT_ID');
    const clientSecret = this.configService.get<string>(
      'GOOGLE_CLASSROOM_CLIENT_SECRET',
    );
    const redirectUri = this.configService.get<string>(
      'GOOGLE_CLASSROOM_REDIRECT_URI',
    );
    if (!clientId || !clientSecret || !redirectUri) {
      throw new ServiceUnavailableException(
        'Google Classroom OAuth is not configured',
      );
    }
    return { clientId, clientSecret, redirectUri };
  }

  private async fetchEmail(accessToken: string): Promise<string | null> {
    try {
      const res = await fetch(USERINFO_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as GoogleUserInfo;
      return data.email?.toLowerCase() ?? null;
    } catch {
      return null;
    }
  }

  private parseScopes(scope: string | undefined): string[] {
    if (!scope) return [...CLASSROOM_SCOPES];
    return scope.split(/\s+/).filter(Boolean);
  }

  private async postForm<T>(url: string, body: URLSearchParams): Promise<T> {
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
    } catch {
      throw new ServiceUnavailableException(
        'Unable to reach Google OAuth services',
      );
    }

    const payload = (await res.json().catch(() => ({}))) as T & {
      error?: string;
      error_description?: string;
    };

    if (!res.ok) {
      throw new BadRequestException(
        payload.error_description ||
          payload.error ||
          'Google OAuth request failed',
      );
    }
    return payload;
  }
}
