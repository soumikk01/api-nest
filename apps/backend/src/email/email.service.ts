import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter | null = null;
  private readonly from: string;
  private readonly appName = 'Apio';
  private readonly enabled: boolean;

  constructor(private config: ConfigService) {
    const user = config.get<string>('SMTP_USER');
    const pass = config.get<string>('SMTP_PASS');

    if (user && pass) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
      });
      this.enabled = true;
      this.logger.log(`Email service ready (Nodemailer → Gmail: ${user})`);
    } else {
      this.enabled = false;
      this.logger.warn(
        'Email service DISABLED — SMTP_USER / SMTP_PASS not set in .env. ' +
        'Add your Gmail address and App Password to enable transactional emails.',
      );
    }

    this.from = config.get('EMAIL_FROM', user ?? 'noreply@apio.one');
  }

  // ── Internal send helper ────────────────────────────────────────────────────
  private async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.enabled || !this.transporter) return;
    const info = await this.transporter.sendMail({ from: this.from, to, subject, html });
    this.logger.log(`Email sent to ${to} → messageId: ${info.messageId}`);
  }

  // ── Password Reset ─────────────────────────────────────────────────────────
  async sendPasswordReset(to: string, resetUrl: string): Promise<void> {
    if (!this.enabled) {
      this.logger.debug(`[email disabled] would send password reset to ${to}`);
      return;
    }
    try {
      await this.send(
        to,
        `Reset your ${this.appName} password`,
        `
        <div style="font-family:Inter,sans-serif;max-width:520px;margin:auto;padding:32px;background:#0a0a0a;border-radius:12px">
          <div style="margin-bottom:24px">
            <span style="font-size:18px;font-weight:700;color:#fff">${this.appName}</span>
          </div>
          <h2 style="color:#fff;font-size:22px;margin:0 0 12px">Reset your password</h2>
          <p style="color:#aaa;font-size:14px;line-height:1.6;margin:0 0 24px">
            We received a request to reset the password for <strong style="color:#fff">${to}</strong>.
            Click the button below to set a new password.
          </p>
          <a href="${resetUrl}"
             style="display:inline-block;padding:12px 28px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin-bottom:24px">
            Reset Password &rarr;
          </a>
          <p style="color:#555;font-size:12px;margin:0">
            This link expires in <strong>1 hour</strong>.<br/>
            If you didn't request a reset, you can safely ignore this email.
          </p>
        </div>
        `,
      );
    } catch (err) {
      this.logger.error(`Failed to send password reset email to ${to}`, err);
      throw err;
    }
  }

  // ── OTP / Verification Code ────────────────────────────────────────────────
  async sendOtp(
    to: string,
    otp: string,
    type: 'sign-in' | 'email-verification' | 'forget-password',
  ): Promise<void> {
    if (!this.enabled) {
      this.logger.debug(`[email disabled] would send OTP (${type}) to ${to}`);
      return;
    }
    const subjects: Record<string, string> = {
      'sign-in':            `Your ${this.appName} sign-in code`,
      'email-verification': `Verify your ${this.appName} account`,
      'forget-password':    `Your ${this.appName} password reset code`,
    };
    const headings: Record<string, string> = {
      'sign-in':            'Sign-in verification code',
      'email-verification': 'Email verification code',
      'forget-password':    'Password reset code',
    };
    try {
      await this.send(
        to,
        subjects[type] ?? `Your ${this.appName} code`,
        `
        <div style="font-family:Inter,sans-serif;max-width:520px;margin:auto;padding:32px;background:#0a0a0a;border-radius:12px">
          <div style="margin-bottom:24px">
            <span style="font-size:18px;font-weight:700;color:#fff">${this.appName}</span>
          </div>
          <h2 style="color:#fff;font-size:22px;margin:0 0 12px">${headings[type] ?? 'Verification code'}</h2>
          <p style="color:#aaa;font-size:14px;margin:0 0 24px">Use the code below to continue:</p>
          <div style="background:#1a1a2e;border:1px solid #6366f1;border-radius:10px;padding:20px;text-align:center;margin-bottom:24px">
            <span style="font-size:36px;font-weight:800;letter-spacing:12px;color:#6366f1">${otp}</span>
          </div>
          <p style="color:#555;font-size:12px;margin:0">
            This code expires in <strong>10 minutes</strong>.<br/>
            If you didn't request this, ignore this email.
          </p>
        </div>
        `,
      );
    } catch (err) {
      this.logger.error(`Failed to send OTP email to ${to}`, err);
      throw err;
    }
  }

  // ── Welcome Email ──────────────────────────────────────────────────────────
  async sendWelcome(to: string, name: string): Promise<void> {
    if (!this.enabled) {
      this.logger.debug(`[email disabled] would send welcome email to ${to}`);
      return;
    }
    const dashUrl = this.config.get('FRONTEND_URL', 'https://apio.one');
    try {
      await this.send(
        to,
        `Welcome to ${this.appName}! 🎉`,
        `
        <div style="font-family:Inter,sans-serif;max-width:520px;margin:auto;padding:32px;background:#0a0a0a;border-radius:12px">
          <div style="margin-bottom:24px">
            <span style="font-size:18px;font-weight:700;color:#fff">${this.appName}</span>
          </div>
          <h2 style="color:#fff;font-size:22px;margin:0 0 12px">Welcome, ${name}! 👋</h2>
          <p style="color:#aaa;font-size:14px;line-height:1.6;margin:0 0 24px">
            Your account is ready. Start monitoring your APIs in seconds.
          </p>
          <a href="${dashUrl}/projects"
             style="display:inline-block;padding:12px 28px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
            Go to Dashboard &rarr;
          </a>
        </div>
        `,
      );
    } catch (err) {
      // Welcome email is non-critical — log but don't throw
      this.logger.warn(`Failed to send welcome email to ${to}: ${(err as Error).message}`);
    }
  }
}
