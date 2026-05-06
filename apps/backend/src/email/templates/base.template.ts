/**
 * Base email layout — wraps all transactional emails.
 * Dark-themed, Apio-branded, inbox-safe inline CSS.
 */
export function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Apio</title>
</head>
<body style="margin:0;padding:0;background:#060608;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#060608;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- ── Header ── -->
          <tr>
            <td style="padding-bottom:28px;">
              <span style="font-size:20px;font-weight:800;color:#fff;letter-spacing:-0.5px;">
                Apio<span style="color:#6366f1;">.</span>
              </span>
            </td>
          </tr>

          <!-- ── Card ── -->
          <tr>
            <td style="background:#0f0f14;border:1px solid #1e1e2e;border-radius:16px;padding:36px;">
              ${content}
            </td>
          </tr>

          <!-- ── Footer ── -->
          <tr>
            <td style="padding-top:24px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#3d3d52;line-height:1.6;">
                Apio API Monitoring &nbsp;·&nbsp;
                <a href="https://apio.one" style="color:#6366f1;text-decoration:none;">apio.one</a>
                <br/>
                You received this email because an action was taken on your account.
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

/** Reusable CTA button */
export function ctaButton(text: string, url: string): string {
  return `
    <a href="${url}"
       style="display:inline-block;padding:13px 28px;background:linear-gradient(135deg,#6366f1,#8b5cf6);
              color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;
              letter-spacing:0.2px;margin:8px 0;">
      ${text} →
    </a>`;
}

/** Muted helper text at bottom of card */
export function footerNote(text: string): string {
  return `<p style="margin:24px 0 0;font-size:12px;color:#3d3d52;line-height:1.7;">${text}</p>`;
}
