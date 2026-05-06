/**
 * Base email layout — Apio minimal design.
 * Clean white card · Dark background · Logo + name header.
 */
export function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Apio</title>
</head>
<body style="margin:0;padding:0;background:#0c0c10;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">

  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background:#0c0c10;min-height:100vh;padding:48px 16px;">
    <tr>
      <td align="center" valign="top">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:520px;">

          <!-- ── LOGO HEADER ───────────────────────────── -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <!-- Hexagon SVG logo + wordmark -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle" style="padding-right:10px;">
                    <!-- Hexagon icon -->
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none"
                         xmlns="http://www.w3.org/2000/svg">
                      <polygon points="16,2 28,9 28,23 16,30 4,23 4,9"
                               fill="#6366f1" />
                      <circle cx="16" cy="16" r="5" fill="#ffffff" />
                    </svg>
                  </td>
                  <td valign="middle">
                    <span style="font-size:22px;font-weight:700;color:#ffffff;
                                 letter-spacing:-0.5px;line-height:1;">
                      Apio
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── CARD ─────────────────────────────────── -->
          <tr>
            <td style="background:#ffffff;border-radius:16px;padding:40px 40px 36px;
                       box-shadow:0 4px 24px rgba(0,0,0,0.4);">
              ${content}
            </td>
          </tr>

          <!-- ── FOOTER ───────────────────────────────── -->
          <tr>
            <td align="center" style="padding:28px 0 8px;">
              <p style="margin:0;font-size:12px;color:#4a4a5a;line-height:1.8;">
                © ${new Date().getFullYear()} Apio &nbsp;·&nbsp;
                <a href="https://apio.one" style="color:#6366f1;text-decoration:none;">apio.one</a>
                &nbsp;·&nbsp;
                <a href="https://apio.one/privacy" style="color:#6366f1;text-decoration:none;">Privacy</a>
              </p>
              <p style="margin:6px 0 0;font-size:11px;color:#33334a;">
                You received this because an action was taken on your Apio account.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}

/** Indigo CTA button */
export function ctaButton(text: string, url: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"
           style="margin:4px 0 8px;">
      <tr>
        <td style="background:#6366f1;border-radius:10px;">
          <a href="${url}"
             style="display:inline-block;padding:13px 32px;color:#ffffff;
                    font-size:14px;font-weight:600;text-decoration:none;
                    letter-spacing:0.1px;line-height:1;">
            ${text} →
          </a>
        </td>
      </tr>
    </table>`;
}

/** Muted small note at bottom of card */
export function footerNote(text: string): string {
  return `
    <p style="margin:28px 0 0;padding-top:20px;border-top:1px solid #f0f0f4;
              font-size:12px;color:#9090a0;line-height:1.7;">
      ${text}
    </p>`;
}

/** Section divider */
export function divider(): string {
  return `<div style="height:1px;background:#f0f0f4;margin:24px 0;"></div>`;
}
