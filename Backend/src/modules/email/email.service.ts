import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly isProduction: boolean;
  private readonly frontendUrl: string;
  private readonly fromAddress: string;
  private readonly devMode: boolean;
  private transporter: any;

  constructor(private readonly configService: ConfigService) {
    this.isProduction = configService.get<string>('NODE_ENV') === 'production';
    this.frontendUrl = configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    this.fromAddress =
      configService.get<string>('EMAIL_FROM') || 'no-reply@temarlije.local';

    const smtpHost = configService.get<string>('SMTP_HOST');
    const smtpUser = configService.get<string>('SMTP_USER') || '';
    const isDummySmtp =
      !smtpHost ||
      smtpHost.includes('example.com') ||
      smtpHost === 'dummy' ||
      smtpUser.includes('dummy') ||
      smtpUser === '';

    this.devMode = isDummySmtp;

    if (!this.devMode) {
      try {
        this.transporter = nodemailer.createTransport({
          host: smtpHost,
          port: Number(configService.get('SMTP_PORT') || 587),
          secure: configService.get('SMTP_SECURE') === 'true',
          auth: {
            user: configService.get<string>('SMTP_USER') || '',
            pass: configService.get<string>('SMTP_PASS') || '',
          },
        });
      } catch (err: any) {
        this.logger.warn(`Failed to initialize SMTP transport, falling back to console: ${err.message}`);
        this.devMode = true;
      }
    }
  }

  isSmtpConfigured(): boolean {
    return !this.devMode;
  }

  private async _send({ to, subject, html }: { to: string; subject: string; html: string }) {
    if (this.devMode) {
      this.logger.warn(
        `[EMAIL LOG — SMTP not configured] To: ${to} | Subject: ${subject}\n${html}`,
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to,
        subject,
        html,
      });
    } catch (err: any) {
      this.logger.error(`Failed to send email to ${to}: ${err.message}`);
    }
  }

  async sendVerificationEmail(user: any, rawToken: string) {
    const link = `${this.frontendUrl}/verify-email?token=${rawToken}`;
    await this._send({
      to: user.email,
      subject: 'Verify your Temar Lije account',
      html: `<p>Hi ${user.fullName || 'there'},</p><p>Confirm your email to activate your account:</p><p><a href="${link}">${link}</a></p><p>This link expires in 24 hours.</p>`,
    });
  }

  async sendPasswordResetEmail(user: any, rawToken: string) {
    const link = `${this.frontendUrl}/reset-password?token=${rawToken}`;
    await this._send({
      to: user.email,
      subject: 'Reset your Temar Lije password',
      html: `<p>Hi ${user.fullName || 'there'},</p><p>Click below to choose a new password. If you didn't request this, ignore this email.</p><p><a href="${link}">${link}</a></p><p>This link expires in 1 hour.</p>`,
    });
  }

  async sendOAuthAccountNotice(user: any) {
    await this._send({
      to: user.email,
      subject: 'Password reset requested — Temar Lije',
      html: `<p>Hi ${user.fullName || 'there'},</p><p>Someone requested a password reset for this email, but this account signs in with Google, not a password. Use "Continue with Google" on the sign-in page instead.</p><p>If this wasn't you, no action is needed.</p>`,
    });
  }
}
