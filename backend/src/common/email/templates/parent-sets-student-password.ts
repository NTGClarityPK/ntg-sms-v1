import type { InvitationEmailTemplate } from '../../services/email/mailjet.service';
import type { InvitationEmailBranding } from './invitation-email-layout';
import { wrapInvitationEmailDocument } from './invitation-email-layout';
import { escapeAttr, escapeHtml } from '../utils/html-escape';

export function parentSetsStudentPasswordTemplate(input: {
  parentName: string;
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

  const subject = `Set up your child's account · ${schoolShort}`;

  const ctaGreen =
    'display:inline-block;background:linear-gradient(180deg,#10b981 0%,#059669 100%);color:#ffffff!important;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:0.02em;box-shadow:0 3px 12px rgba(5,150,105,0.35);border:1px solid #047857;';

  const bodyHtml = `
    <p style="margin:0 0 8px;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#059669;">
      Parent invitation
    </p>
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;line-height:1.25;color:#0f172a;">
      Hello ${escapeHtml(input.parentName)},
    </h1>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#334155;">
      <strong>${escapeHtml(schoolShort)}</strong> has asked you to complete setup for your child's NTG Alma account.
      The button below opens a secure page where you can set their password. Your child will use the same email address to sign in going forward.
    </p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;">
      <tr>
        <td style="background:#f1f5f9;border-radius:12px;padding:18px 20px;border:1px solid #e2e8f0;">
          <p style="margin:0 0 8px;font-size:14px;color:#0f172a;">
            <span style="color:#64748b;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;">Student</span><br />
            <span style="font-size:17px;font-weight:700;">${escapeHtml(input.studentName)}</span>
          </p>
          <p style="margin:12px 0 0;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:#64748b;">
            Their sign-in email
          </p>
          <p style="margin:4px 0 0;font-size:16px;font-weight:600;color:#0f172a;word-break:break-all;">
            ${escapeHtml(input.loginEmail)}
          </p>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td align="center" style="padding:8px 0 28px;">
          <a href="${escapeAttr(input.invitationLink)}" style="${ctaGreen}">
            Continue setup &amp; set password
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#475569;">
      This secure link expires in <strong>${input.expiresInDays} days</strong>.
      If you need a new one, please contact the school.
    </p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#475569;">
      Need help? Contact <a href="mailto:${escapeAttr(support)}" style="color:#059669;font-weight:600;text-decoration:none;">${escapeHtml(support)}</a>.
    </p>

    <p style="margin:0;padding-top:20px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.6;color:#94a3b8;">
      If you did not expect this message, you can safely ignore it.
    </p>
  `;

  const html = wrapInvitationEmailDocument(input.branding, bodyHtml);

  return { subject, html };
}
