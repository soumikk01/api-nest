import { baseTemplate, ctaButton, footerNote } from './base.template';

export function passwordResetTemplate(userEmail: string, resetUrl: string): string {
  const content = `
    <!-- Heading -->
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#0c0c10;letter-spacing:-0.3px;">
      Reset your password
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:#6b6b80;line-height:1.6;">
      We received a request for <strong style="color:#0c0c10;">${userEmail}</strong>.
      Click below to set a new password.
    </p>

    ${ctaButton('Reset Password', resetUrl)}

    <!-- Fallback link -->
    <p style="margin:20px 0 0;font-size:12px;color:#9090a0;line-height:1.6;">
      Or copy this link into your browser:<br/>
      <a href="${resetUrl}"
         style="color:#6366f1;text-decoration:none;word-break:break-all;font-size:11px;">
        ${resetUrl}
      </a>
    </p>

    ${footerNote(
      "This link expires in <strong>1 hour</strong>. " +
      "If you didn't request a password reset, you can safely ignore this email."
    )}
  `;
  return baseTemplate(content);
}
