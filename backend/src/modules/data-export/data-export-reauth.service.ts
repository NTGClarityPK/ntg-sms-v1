import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';

@Injectable()
export class DataExportReauthService {
  constructor(private readonly supabaseConfig: SupabaseConfig) {}

  /**
   * Verifies password via DB RPC — does NOT call signInWithPassword, so the
   * user's browser session is not rotated or revoked.
   */
  async verifyAccountPassword(
    userId: string,
    _hintEmail: string,
    password: string,
  ): Promise<void> {
    const authUser = await this.loadAuthUser(userId);
    if (authUser && !this.userCanUsePassword(authUser)) {
      throw new ForbiddenException({
        message:
          'This account uses single sign-on and does not have a password. Use a password-based admin account to export data.',
        code: 'EXPORT_REAUTH_OAUTH_ONLY',
      });
    }

    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase.rpc('verify_user_password', {
      p_user_id: userId,
      p_password: password,
    });

    if (error) {
      if (error.message.includes('verify_user_password')) {
        throw new UnauthorizedException({
          message:
            'Password verification is not available. Apply the latest database migration (verify_user_password).',
          code: 'EXPORT_REAUTH_RPC_MISSING',
        });
      }
      throw new UnauthorizedException({
        message: 'Could not verify account password',
        code: 'EXPORT_REAUTH_FAILED',
      });
    }

    if (data !== true) {
      throw new UnauthorizedException({
        message: 'Invalid account password',
        code: 'INVALID_ACCOUNT_PASSWORD',
      });
    }
  }

  private async loadAuthUser(userId: string): Promise<User | null> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error || !data.user) return null;
    return data.user;
  }

  private userCanUsePassword(user: User): boolean {
    const identities = user.identities ?? [];
    if (identities.length === 0) {
      return Boolean(user.email);
    }
    return identities.some((i) => i.provider === 'email');
  }
}
