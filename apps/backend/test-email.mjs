import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.resend.com',
  port: 465,
  secure: true,
  auth: { user: 'resend', pass: 're_bpUiNCWt_9yycKeEo9oZYBAH3keyUWyts' },
});

// ── Inline templates (mirrors the .ts files) ──────────────────────────────────

function baseTemplate(content) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>Apio</title></head>
<body style="margin:0;padding:0;background:#0c0c10;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0c0c10;padding:48px 16px;">
  <tr><td align="center" valign="top">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">

      <!-- Logo header -->
      <tr><td align="center" style="padding-bottom:32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td valign="middle" style="padding-right:10px;">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <polygon points="16,2 28,9 28,23 16,30 4,23 4,9" fill="#6366f1"/>
              <circle cx="16" cy="16" r="5" fill="#ffffff"/>
            </svg>
          </td>
          <td valign="middle">
            <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Apio</span>
          </td>
        </tr></table>
      </td></tr>

      <!-- Card -->
      <tr><td style="background:#ffffff;border-radius:16px;padding:40px 40px 36px;box-shadow:0 4px 24px rgba(0,0,0,0.4);">
        ${content}
      </td></tr>

      <!-- Footer -->
      <tr><td align="center" style="padding:28px 0 8px;">
        <p style="margin:0;font-size:12px;color:#4a4a5a;line-height:1.8;">
          © ${new Date().getFullYear()} Apio &nbsp;·&nbsp;
          <a href="https://apio.one" style="color:#6366f1;text-decoration:none;">apio.one</a>
        </p>
        <p style="margin:6px 0 0;font-size:11px;color:#33334a;">You received this because an action was taken on your Apio account.</p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}

function ctaBtn(text, url) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 8px;"><tr>
    <td style="background:#6366f1;border-radius:10px;">
      <a href="${url}" style="display:inline-block;padding:13px 32px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">${text} →</a>
    </td></tr></table>`;
}

function footerNote(text) {
  return `<p style="margin:28px 0 0;padding-top:20px;border-top:1px solid #f0f0f4;font-size:12px;color:#9090a0;line-height:1.7;">${text}</p>`;
}

// ── Template builders ─────────────────────────────────────────────────────────

function passwordReset(email, url) {
  return baseTemplate(`
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#0c0c10;letter-spacing:-0.3px;">Reset your password</h1>
    <p style="margin:0 0 24px;font-size:14px;color:#6b6b80;line-height:1.6;">
      We received a request for <strong style="color:#0c0c10;">${email}</strong>. Click below to set a new password.
    </p>
    ${ctaBtn('Reset Password', url)}
    <p style="margin:20px 0 0;font-size:12px;color:#9090a0;">Or copy this link into your browser:<br/>
      <a href="${url}" style="color:#6366f1;text-decoration:none;word-break:break-all;font-size:11px;">${url}</a>
    </p>
    ${footerNote("This link expires in <strong>1 hour</strong>. If you didn't request a reset, ignore this email.")}
  `);
}

function otp(code, heading, sub) {
  return baseTemplate(`
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#0c0c10;letter-spacing:-0.3px;">${heading}</h1>
    <p style="margin:0 0 28px;font-size:14px;color:#6b6b80;line-height:1.6;">${sub}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
      <tr><td align="center" style="background:#f5f5ff;border:1.5px solid #e0e0f8;border-radius:12px;padding:28px 20px;">
        <span style="font-size:40px;font-weight:800;letter-spacing:16px;color:#6366f1;">${code}</span>
      </td></tr>
    </table>
    <p style="margin:0;font-size:13px;color:#9090a0;text-align:center;">Expires in <strong style="color:#6b6b80;">10 minutes</strong></p>
    ${footerNote("If you didn't request this code, you can safely ignore this email.")}
  `);
}

function welcome(name, url) {
  return baseTemplate(`
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#0c0c10;letter-spacing:-0.3px;">Welcome, ${name}!</h1>
    <p style="margin:0 0 28px;font-size:14px;color:#6b6b80;line-height:1.6;">Your Apio account is ready. Start monitoring your APIs in real time.</p>
    <div style="height:1px;background:#f0f0f4;margin:0 0 20px;"></div>
    ${ctaBtn('Go to Dashboard', url)}
    ${footerNote('Questions? Reply to this email or visit <a href="https://apio.one" style="color:#6366f1;text-decoration:none;">apio.one</a>.')}
  `);
}

// ── Send all 3 ────────────────────────────────────────────────────────────────
const send = async (subject, html) => {
  const info = await transporter.sendMail({ from: 'Apio <noreply@apio.one>', to: 'soumikb0001@gmail.com', subject, html });
  console.log(`✅ ${subject}  →  ${info.messageId}`);
};

await send('Reset your Apio password',  passwordReset('soumikb0001@gmail.com', 'https://apio.one/reset-password?token=preview'));
await send('Your Apio sign-in code',    otp('483921', 'Sign-in code', 'Use this code to complete your sign-in.'));
await send('Welcome to Apio! 🎉',       welcome('Soumik', 'https://apio.one/projects'));

console.log('\n3 preview emails sent → check your inbox!');
