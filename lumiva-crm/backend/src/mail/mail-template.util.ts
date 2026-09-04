// backend/src/mail/mail-template.util.ts
// Shared black-and-white email shell for Lumiva CRM's own system emails (invites,
// signup codes, etc.) — matches the monochrome design language used across the app
// (frontend/src/marketing/emailTemplatePresets.ts uses the same tokens for tenant-facing
// automation emails; kept in sync deliberately, not shared via import since front/back
// don't share a module boundary).

export const MAIL_ACCENT = '#222222';
export const MAIL_BORDER = '#e4e4e7';
export const MAIL_PAGE_BG = '#fafafa';
export const MAIL_TEXT = '#18181b';
export const MAIL_MUTED = '#71717a';

export function escapeMailHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** A big, letter-spaced monochrome box for one-time codes. */
export function mailCodeBox(code: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid ${MAIL_BORDER};border-radius:12px;background:#f4f4f5;margin:0 0 16px;">
  <tr>
    <td align="center" style="padding:22px 16px;">
      <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${MAIL_MUTED};padding-bottom:10px;">Код подтверждения</div>
      <div style="display:inline-block;padding:12px 18px;border-radius:10px;background:${MAIL_ACCENT};color:#ffffff;font-size:30px;line-height:1;font-weight:700;letter-spacing:0.3em;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${code}</div>
    </td>
  </tr>
</table>`;
}

/**
 * Renders Lumiva CRM's own system-email shell: white card, black header block with the
 * "LUMIVA CRM" kicker, body, optional CTA button, footer.
 */
export function renderMailShell(params: {
  headline: string;
  bodyHtml: string;
  cta?: { label: string; href: string };
  footerHtml?: string;
}): string {
  const { headline, bodyHtml, cta } = params;
  const footerHtml =
    params.footerHtml ?? `© ${new Date().getFullYear()} Lumiva CRM. Все права защищены.`;

  const ctaRow = cta
    ? `<tr><td style="padding:4px 28px 28px;"><a href="${cta.href}" style="display:inline-block;padding:13px 28px;background:${MAIL_ACCENT};color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;">${cta.label}</a></td></tr>`
    : '';

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${headline}</title>
</head>
<body style="margin:0;background:${MAIL_PAGE_BG};font-family:system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${MAIL_PAGE_BG};padding:32px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;border:1px solid ${MAIL_BORDER};overflow:hidden;">
        <tr>
          <td style="padding:26px 28px 22px;background:${MAIL_ACCENT};">
            <p style="margin:0;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.7);">Lumiva CRM</p>
            <h1 style="margin:8px 0 0;font-size:21px;line-height:1.35;color:#ffffff;font-weight:600;">${headline}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;color:${MAIL_TEXT};font-size:15px;line-height:1.65;">
            ${bodyHtml}
          </td>
        </tr>
        ${ctaRow}
        <tr>
          <td style="padding:18px 28px 24px;border-top:1px solid ${MAIL_BORDER};font-size:12px;color:${MAIL_MUTED};">
            ${footerHtml}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
