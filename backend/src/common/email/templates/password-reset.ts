import type { InvitationEmailTemplate } from '../../services/email/mailjet.service';
import { escapeAttr, escapeHtml } from '../utils/html-escape';

export function passwordResetEmailTemplate(input: {
  loginEmail: string;
  resetLink: string;
  /** When set, email was delivered here (invitation recipient) rather than the login address. */
  deliveredToEmail?: string;
}): InvitationEmailTemplate {
  const subject = 'Reset your NTG Alma password';

  const ctaGreen =
    'display:inline-block;background-color:#059669;background:#059669;color:#ffffff!important;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:0.02em;box-shadow:0 3px 12px rgba(5,150,105,0.35);border:1px solid #047857;line-height:1.2;white-space:nowrap;';

  const deliveryNote =
    input.deliveredToEmail &&
    input.deliveredToEmail.toLowerCase() !== input.loginEmail.toLowerCase()
      ? `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 20px;">
      <tr>
        <td style="background:#f0fdf4;border-radius:12px;padding:14px 16px;border:1px solid #bbf7d0;">
          <p style="margin:0;font-size:14px;line-height:1.55;color:#166534;">
            This message was sent to <strong>${escapeHtml(input.deliveredToEmail)}</strong> — the address used when your account was first invited.
            You still sign in with <strong>${escapeHtml(input.loginEmail)}</strong>.
          </p>
        </td>
      </tr>
    </table>
  `
      : '';

  const bodyHtml = `
    <p style="margin:0 0 8px;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#059669;">
      Password reset
    </p>
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;line-height:1.25;color:#0f172a;">
      Reset your password
    </h1>
    ${deliveryNote}
    <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#334155;">
      We received a request to reset the password for
      <strong>${escapeHtml(input.loginEmail)}</strong>.
      Use the secure link below to choose a new password.
    </p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td align="center" style="padding:8px 0 28px;">
          <a href="${escapeAttr(input.resetLink)}" style="${ctaGreen}">
            Reset password
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#475569;">
      If you did not request this, you can ignore this email. Your password will stay the same.
    </p>
    <p style="margin:0;padding-top:20px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.6;color:#94a3b8;">
      For security, this link expires after a short time. If it has expired, request a new reset from the sign-in page.
    </p>
  `;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;background:#f8fafc;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f8fafc;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;padding:32px 28px;">
          <tr>
            <td>${bodyHtml}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}
