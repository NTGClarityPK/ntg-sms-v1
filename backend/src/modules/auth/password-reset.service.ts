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
   */
  async requestPasswordReset(input: {
    rawEmail: string;
    confirmSendToProvided?: boolean;
  }): Promise<{
    ok: true;
    /** The email address the reset link was (or would be) delivered to. */
    deliveredToEmail?: string;
    /** True when deliveredToEmail differs from the login email provided. */
    usedAssociatedEmail?: boolean;
    /** When true, we did not send yet and require confirmation to send to provided email. */
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

    const actionLink = data.properties?.action_link;
    if (!actionLink) {
      throw new BadRequestException('Could not generate password reset link.');
    }

    const safeLink =
      actionLink.startsWith('http://') || actionLink.startsWith('https://')
        ? actionLink
        : `${this.configService.get<string>('SUPABASE_URL')?.replace(/\/$/, '') ?? ''}/${actionLink.replace(/^\//, '')}`;

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
    if (!usedAssociatedEmail && userId && input.confirmSendToProvided !== true) {
      // We found a user but no associated invitation recipient email; ask user to confirm sending to provided email.
      return {
        ok: true,
        deliveredToEmail: email,
        usedAssociatedEmail: false,
        requiresConfirmation: true,
      };
    }

    const template = passwordResetEmailTemplate({
      loginEmail: email,
      resetLink: safeLink,
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
