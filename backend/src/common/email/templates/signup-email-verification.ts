import type { InvitationEmailTemplate } from '../../services/email/mailjet.service';
import { escapeHtml } from '../utils/html-escape';

export function signupEmailVerificationTemplate(input: {
  email: string;
  code: string;
  fullName?: string;
}): InvitationEmailTemplate {
  const subject = 'Your NTG Alma verification code';
  const greeting = input.fullName?.trim()
    ? `Hi ${escapeHtml(input.fullName.trim())},`
    : 'Hi,';

  const bodyHtml = `
    <p style="margin:0 0 8px;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#059669;">
      Email verification
    </p>
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;line-height:1.25;color:#0f172a;">
      Confirm your email
    </h1>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#334155;">
      ${greeting}
    </p>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#334155;">
      Use this one-time code to verify
      <strong>${escapeHtml(input.email)}</strong>
      while creating your school account:
    </p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td align="center" style="padding:8px 0 28px;">
          <div style="display:inline-block;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px 28px;font-size:32px;font-weight:700;letter-spacing:0.35em;color:#047857;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">
            ${escapeHtml(input.code)}
          </div>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#475569;">
      This code expires in 10 minutes. If you did not start school signup, you can ignore this email.
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
