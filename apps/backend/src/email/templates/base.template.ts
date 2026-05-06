/**
 * Base email layout — Gmail-safe, no SVG, no dark background.
 * Uses HTML+CSS logo (not SVG) · Light neutral bg · All text visible in light & dark mode.
 */
export function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <meta name="color-scheme" content="light"/>
  <meta name="supported-color-schemes" content="light"/>
  <title>Apio</title>
  <style>
    :root { color-scheme: light !important; }
    body { margin:0;padding:0;background-color:#f0f2ff !important; }
    @media (prefers-color-scheme: dark) {
      body { background-color:#f0f2ff !important; }
      .outer { background-color:#f0f2ff !important; }
    }
    [data-ogsc] body { background-color:#f0f2ff !important; }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f0f2ff;"
      bgcolor="#f0f2ff">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
  class="outer" bgcolor="#f0f2ff"
  style="background-color:#f0f2ff;width:100%;padding:40px 16px;">
  <tr><td align="center" valign="top">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"
      style="width:100%;max-width:500px;">

      <!-- ── WHITE CARD ─────────────────────────────── -->
      <tr>
        <td bgcolor="#ffffff"
          style="background-color:#ffffff;border-radius:20px;overflow:hidden;
                 box-shadow:0 8px 40px rgba(99,102,241,0.12),0 2px 8px rgba(0,0,0,0.06);">

          <!-- LOGO SECTION -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center" bgcolor="#ffffff"
                style="background-color:#ffffff;padding:36px 32px 24px;">

                <!-- HTML Hexagon Logo (no SVG - Gmail safe) -->
                <table role="presentation" cellpadding="0" cellspacing="0" border="0"
                  style="margin:0 auto 16px;">
                  <tr>
                    <!-- Left hex triangle -->
                    <td style="width:0;height:0;
                               border-top:22px solid transparent;
                               border-bottom:22px solid transparent;
                               border-right:13px solid #6366f1;
                               font-size:0;line-height:0;">
                    </td>
                    <!-- Middle rectangle -->
                    <td bgcolor="#6366f1"
                      style="background-color:#6366f1;width:30px;height:44px;
                             font-size:0;line-height:0;">
                      <!-- White dot inside -->
                      <table role="presentation" width="100%" height="100%"
                        cellpadding="0" cellspacing="0" border="0">
                        <tr><td align="center" valign="middle">
                          <div style="width:14px;height:14px;border-radius:50%;
                                      background:#ffffff;margin:0 auto;
                                      font-size:0;line-height:0;">
                          </div>
                        </td></tr>
                      </table>
                    </td>
                    <!-- Right hex triangle -->
                    <td style="width:0;height:0;
                               border-top:22px solid transparent;
                               border-bottom:22px solid transparent;
                               border-left:13px solid #6366f1;
                               font-size:0;line-height:0;">
                    </td>
                  </tr>
                </table>

                <!-- Brand name -->
                <div style="font-size:22px;font-weight:800;color:#1e1b4b;
                            letter-spacing:-0.3px;line-height:1.2;">
                  Apio
                </div>
                <div style="font-size:10px;font-weight:500;color:#6366f1;
                            letter-spacing:2px;margin-top:4px;">
                  API MONITORING
                </div>

                <!-- Accent line -->
                <div style="width:36px;height:3px;border-radius:3px;
                            background-color:#6366f1;margin:16px auto 0;">
                </div>
              </td>
            </tr>
          </table>

          <!-- CONTENT AREA -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td bgcolor="#ffffff"
                style="background-color:#ffffff;padding:4px 36px 32px;">
                ${content}
              </td>
            </tr>
          </table>

          <!-- FOOTER INSIDE CARD -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center" bgcolor="#f8f8fc"
                style="background-color:#f8f8fc;border-top:1px solid #ede9fe;
                       border-radius:0 0 20px 20px;padding:20px 32px;">
                <!-- Social links row -->
                <table role="presentation" cellpadding="0" cellspacing="0" border="0"
                  style="margin:0 auto 14px;">
                  <tr>
                    <td style="padding:0 8px;">
                      <a href="https://x.com" style="font-size:12px;color:#6366f1;text-decoration:none;font-weight:600;">X (Twitter)</a>
                    </td>
                    <td style="color:#d4d4e8;font-size:12px;">&nbsp;·&nbsp;</td>
                    <td style="padding:0 8px;">
                      <a href="https://linkedin.com" style="font-size:12px;color:#6366f1;text-decoration:none;font-weight:600;">LinkedIn</a>
                    </td>
                    <td style="color:#d4d4e8;font-size:12px;">&nbsp;·&nbsp;</td>
                    <td style="padding:0 8px;">
                      <a href="https://github.com" style="font-size:12px;color:#6366f1;text-decoration:none;font-weight:600;">GitHub</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.8;">
                  &copy; ${new Date().getFullYear()} Apio &nbsp;&middot;&nbsp;
                  <a href="https://apio.one" style="color:#6366f1;text-decoration:none;">apio.one</a>
                  &nbsp;&middot;&nbsp;
                  <a href="https://apio.one/privacy" style="color:#6366f1;text-decoration:none;">Privacy</a>
                </p>
                <p style="margin:5px 0 0;font-size:11px;color:#c4b5fd;">
                  You received this because an action was taken on your Apio account.
                </p>
              </td>
            </tr>
          </table>

        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/** Indigo CTA button */
export function ctaButton(text: string, url: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"
           style="margin:8px 0;">
      <tr>
        <td bgcolor="#6366f1"
            style="background-color:#6366f1;border-radius:10px;
                   box-shadow:0 4px 14px rgba(99,102,241,0.35);">
          <a href="${url}"
             style="display:inline-block;padding:13px 32px;color:#ffffff;
                    font-size:14px;font-weight:600;text-decoration:none;letter-spacing:0.1px;">
            ${text} &rarr;
          </a>
        </td>
      </tr>
    </table>`;
}

/** Muted note inside card */
export function footerNote(text: string): string {
  return `
    <p style="margin:24px 0 0;padding-top:18px;border-top:1px solid #f1f5f9;
              font-size:12px;color:#94a3b8;line-height:1.7;">${text}</p>`;
}

/** Section divider inside card */
export function divider(): string {
  return `<div style="height:1px;background:#f1f5f9;margin:20px 0;"></div>`;
}
