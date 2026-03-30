import { escapeHtml } from '../utils/html-escape';

export type InvitationEmailBranding = {
  /** Organisation / school display name (from tenant). */
  schoolName?: string | null;
  /** Branch / campus name when useful in footer. */
  branchName?: string | null;
};

/**
 * Table-based, inline-styled shell for invitation emails (broad client support).
 */
export function wrapInvitationEmailDocument(
  branding: InvitationEmailBranding,
  bodyHtml: string,
): string {
  const schoolLabel =
    (branding.schoolName && branding.schoolName.trim()) ||
    (branding.branchName && branding.branchName.trim()) ||
    'Your school';

  const campusLine =
    branding.branchName &&
    branding.schoolName &&
    branding.branchName.trim() !== branding.schoolName.trim()
      ? `<p style="margin:8px 0 0;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#64748b;line-height:1.5;text-align:center;">${escapeHtml(branding.branchName.trim())}</p>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width" />
  <title>Invitation</title>
</head>
<body style="margin:0;padding:0;background-color:#eef2f6;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#eef2f6;">
    <tr>
      <td align="center" style="padding:28px 16px 40px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;">
          <tr>
            <td style="padding:0 0 20px;">
              <p style="margin:0;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:#0f172a;line-height:1.3;text-align:center;">
                ${escapeHtml(schoolLabel)}
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;border-radius:16px;box-shadow:0 4px 24px rgba(15,23,42,0.07);border:1px solid #e2e8f0;overflow:hidden;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="padding:36px 32px 40px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
                    ${bodyHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 12px 0;text-align:center;">
              <p style="margin:0;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#64748b;line-height:1.65;">
                Powered by NTG Alma
              </p>
              ${campusLine}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
