import type { InvitationEmailTemplate } from '../../services/email/mailjet.service';
import type { InvitationEmailBranding } from './invitation-email-layout';
import { wrapInvitationEmailDocument } from './invitation-email-layout';
import { escapeAttr, escapeHtml } from '../utils/html-escape';

export function studentSetsOwnPasswordTemplate(input: {
  studentName: string;
  loginEmail: string;
  invitationLink: string;
  expiresInDays: number;
  supportEmail?: string;
  branding: InvitationEmailBranding;
}): InvitationEmailTemplate {
  const support = input.supportEmail ?? 'support@ntg-sms.com';
  const schoolShort =
    (input.branding.schoolName && input.branding.schoolName.trim()) ||
    (input.branding.branchName && input.branding.branchName.trim()) ||
    'your school';

  const subject = `Complete your account · ${schoolShort}`;

  const ctaGreen =
    'display:inline-block;background:linear-gradient(180deg,#10b981 0%,#059669 100%);color:#ffffff!important;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:0.02em;box-shadow:0 3px 12px rgba(5,150,105,0.35);border:1px solid #047857;';

  const bodyHtml = `
    <p style="margin:0 0 8px;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#059669;">
      Account invitation
    </p>
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;line-height:1.25;color:#0f172a;">
      Hello ${escapeHtml(input.studentName)},
    </h1>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#334155;">
      <strong>${escapeHtml(schoolShort)}</strong> has invited you to activate your NTG Alma student account.
      Use the secure link below to choose your password and finish setup. You will sign in with the email address your school provided.
    </p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;">
      <tr>
        <td style="background:#f1f5f9;border-radius:12px;padding:18px 20px;border:1px solid #e2e8f0;">
          <p style="margin:0 0 10px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:#64748b;">
            Sign-in email
          </p>
          <p style="margin:0;font-size:16px;font-weight:600;color:#0f172a;word-break:break-all;">
            ${escapeHtml(input.loginEmail)}
          </p>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td align="center" style="padding:8px 0 28px;">
          <a href="${escapeAttr(input.invitationLink)}" style="${ctaGreen}">
            Activate account &amp; set password
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#475569;">
      For your security, this link expires in <strong>${input.expiresInDays} days</strong>.
      If it has expired, contact your school office and ask them to send a new invitation.
    </p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#475569;">
      Questions? Reply to this message or write to <a href="mailto:${escapeAttr(support)}" style="color:#059669;font-weight:600;text-decoration:none;">${escapeHtml(support)}</a>.
    </p>

    <p style="margin:0;padding-top:20px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.6;color:#94a3b8;">
      If you were not expecting this email, you can ignore it. No changes will be made to any account.
    </p>
  `;

  const html = wrapInvitationEmailDocument(input.branding, bodyHtml);

  return { subject, html };
}
