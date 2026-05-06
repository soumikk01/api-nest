import { baseTemplate, ctaButton, footerNote } from './base.template';

/**
 * Password reset email.
 * @param userEmail  - recipient's email (shown in body)
 * @param resetUrl   - the one-time reset link from BetterAuth
 */
export function passwordResetTemplate(userEmail: string, resetUrl: string): string {
  const content = `
    <h2 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#fff;letter-spacing:-0.5px;">
      Reset your password
    </h2>
    <p style="margin:0 0 24px;font-size:14px;color:#8b8ba7;line-height:1.7;">
      We received a request to reset the password for
      <strong style="color:#fff;">${userEmail}</strong>.
      Click the button below — this link expires in <strong style="color:#fff;">1 hour</strong>.
    </p>

    ${ctaButton('Reset Password', resetUrl)}

    <div style="margin-top:28px;padding-top:20px;border-top:1px solid #1e1e2e;">
      <p style="margin:0;font-size:13px;color:#8b8ba7;line-height:1.6;">
        Or copy and paste this link into your browser:
      </p>
      <p style="margin:6px 0 0;font-size:12px;color:#6366f1;word-break:break-all;">
        ${resetUrl}
      </p>
    </div>

    ${footerNote("If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.")}
  `;

  return baseTemplate(content);
}
