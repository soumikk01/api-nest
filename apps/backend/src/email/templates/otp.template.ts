import { baseTemplate, footerNote } from './base.template';

export type OtpType = 'sign-in' | 'email-verification' | 'forget-password';

const OTP_COPY: Record<OtpType, { heading: string; sub: string }> = {
  'sign-in': {
    heading: 'Sign-in code',
    sub: 'Use this code to complete your sign-in.',
  },
  'email-verification': {
    heading: 'Verify your email',
    sub: 'Use this code to verify your Apio account.',
  },
  'forget-password': {
    heading: 'Password reset code',
    sub: 'Use this code to reset your password.',
  },
};

export function otpTemplate(otp: string, type: OtpType): string {
  const { heading, sub } = OTP_COPY[type];

  const content = `
    <!-- Heading -->
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#0c0c10;letter-spacing:-0.3px;">
      ${heading}
    </h1>
    <p style="margin:0 0 28px;font-size:14px;color:#6b6b80;line-height:1.6;">
      ${sub}
    </p>

    <!-- OTP box -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="margin-bottom:24px;">
      <tr>
        <td align="center"
            style="background:#f5f5ff;border:1.5px solid #e0e0f8;
                   border-radius:12px;padding:28px 20px;">
          <span style="font-size:40px;font-weight:800;letter-spacing:16px;
                       color:#6366f1;font-variant-numeric:tabular-nums;">
            ${otp}
          </span>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:13px;color:#9090a0;text-align:center;">
      Expires in <strong style="color:#6b6b80;">10 minutes</strong>
    </p>

    ${footerNote(
      "If you didn't request this code, you can safely ignore this email."
    )}
  `;

  return baseTemplate(content);
}
