import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { passwordResetEmailTemplate } from '../../common/email/templates/password-reset';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { MailjetService } from '../../common/services/email/mailjet.service';

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly mailjetService: MailjetService,
    private readonly configService: ConfigService,
  ) {}

  private normalizeEmail(raw: string): string {
    return raw.normalize('NFKC').trim().toLowerCase();
  }

  /**
   * Request a password reset email. Mirrors Supabase client recover behaviour:
   * if no user exists for the email, completes without error (no enumeration).
   *
   * Uses Admin generateLink + Mailjet instead of POST /auth/v1/recover so school
   * domains are not rejected by GoTrue extended email / MX validation when sending via Supabase SMTP.
   *
   * When the user has an invitation recipient email different from their login email
   * (typical staff school-domain logins), the reset link is sent to that recipient.
   * Otherwise it is sent to the login email provided.
   */
  async requestPasswordReset(input: {
    rawEmail: string;
    /** @deprecated No longer required; kept for API compatibility with older clients. */
    confirmSendToProvided?: boolean;
  }): Promise<{
    ok: true;
    /** The email address the reset link was delivered to (when a user was found). */
    deliveredToEmail?: string;
    /** True when deliveredToEmail differs from the login email provided. */
    usedAssociatedEmail?: boolean;
    /** Always false; kept for API compatibility with older clients. */
    requiresConfirmation?: boolean;
  }> {
    const email = this.normalizeEmail(input.rawEmail);
    const frontendBase =
      this.configService.get<string>('FRONTEND_URL')?.replace(/\/$/, '') ?? 'http://localhost:3000';
    const redirectTo = `${frontendBase}/reset-password`;

    const supabase = this.supabaseConfig.getClient();

    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo },
    });

    if (error) {
      const msg = (error.message || '').toLowerCase();
      const code = ((error as { code?: string }).code || '').toLowerCase();
      if (
        code === 'user_not_found' ||
        msg.includes('user not found') ||
        msg.includes('no user found') ||
        msg.includes('not registered')
      ) {
        return { ok: true };
      }
      throw new BadRequestException(error.message);
    }

    const hashedToken = data.properties?.hashed_token;
    if (!hashedToken) {
      throw new BadRequestException('Could not generate password reset link.');
    }

    // Build an app-owned link. Do NOT use action_link (Supabase /auth/v1/verify):
    // if Redirect URLs / Site URL are misconfigured, verify falls back to Site URL
    // (e.g. /home) with error=otp_expired. Our page verifies via verifyOtp instead.
    const resetLink = `${frontendBase}/reset-password?token_hash=${encodeURIComponent(hashedToken)}&type=recovery`;

    const userId = data.user?.id;
    let deliveryEmail = email;
    if (userId) {
      const { data: invRow, error: invError } = await supabase
        .from('invitations')
        .select('recipient_email')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!invError && invRow && typeof (invRow as { recipient_email?: string }).recipient_email === 'string') {
        const raw = (invRow as { recipient_email: string }).recipient_email;
        const resolved = this.normalizeEmail(raw);
        if (resolved.length > 0) {
          deliveryEmail = resolved;
        }
      }
    }

    const usedAssociatedEmail = deliveryEmail !== email;

    // Prefer invitation recipient when it differs from the login email (staff school
    // logins). When they match — e.g. school admin signed up with their real mailbox
    // and has no invitations row — send immediately to the login email.
    const template = passwordResetEmailTemplate({
      loginEmail: email,
      resetLink,
      deliveredToEmail: deliveryEmail !== email ? deliveryEmail : undefined,
    });

    const localPart = deliveryEmail.split('@')[0] || 'User';
    try {
      await this.mailjetService.sendEmail({
        toEmail: deliveryEmail,
        toName: localPart,
        subject: template.subject,
        html: template.html,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown email error';
      throw new BadRequestException(`Failed to send password reset email: ${message}`);
    }

    return {
      ok: true,
      deliveredToEmail: deliveryEmail,
      usedAssociatedEmail,
      requiresConfirmation: false,
    };
  }
}
