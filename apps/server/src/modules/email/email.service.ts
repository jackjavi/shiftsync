import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { google } from 'googleapis';
import type { Transporter } from 'nodemailer';

// ─── Attachment ───────────────────────────────────────────────────────────────

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);

  /** Cached transporter — recreated if the OAuth2 access-token expires */
  private transporter: Transporter | null = null;

  /** Whether email sending is fully configured and enabled */
  private enabled = false;

  constructor(private readonly config: ConfigService) {}

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  onModuleInit() {
    this.init();
  }

  private init() {
    const clientId     = this.config.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');
    const redirectUrl  = this.config.get<string>('REDIRECT_URL');
    const refreshToken = this.config.get<string>('GOOGLE_REFRESH_TOKEN');
    const userEmail    = this.config.get<string>('USER_EMAIL');

    if (!clientId || !clientSecret || !redirectUrl || !refreshToken || !userEmail) {
      this.logger.warn(
        'Email service disabled — one or more OAuth2 env vars missing ' +
        '(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URL, GOOGLE_REFRESH_TOKEN, USER_EMAIL). ' +
        'Notifications will be in-app only.',
      );
      this.enabled = false;
      return;
    }

    const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUrl);
    oAuth2Client.setCredentials({ refresh_token: refreshToken });

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      port: 465,
      secure: true,
      auth: {
        type: 'OAuth2',
        user: userEmail,
        clientId,
        clientSecret,
        refreshToken,
      },
    } as nodemailer.TransportOptions);

    this.enabled = true;
    this.logger.log(`Email service initialised — sending from ${userEmail}`);
  }

  // ── Core send ──────────────────────────────────────────────────────────────

  /**
   * Send a single email.
   * Resolves silently if email is disabled/misconfigured — never throws to callers.
   */
  async send(
    to: string,
    subject: string,
    text: string,
    attachments?: EmailAttachment[],
  ): Promise<void> {
    if (!this.enabled || !this.transporter) {
      this.logger.debug(`[Email disabled] Would have sent "${subject}" to ${to}`);
      return;
    }

    const fromAddress = this.config.get<string>('USER_EMAIL')!;

    const mailOptions: nodemailer.SendMailOptions = {
      from: `"ShiftSync" <${fromAddress}>`,
      to,
      subject,
      text,
    };

    if (attachments && attachments.length > 0) {
      mailOptions.attachments = attachments.map((a) => ({
        filename:    a.filename,
        content:     a.content,
        contentType: a.contentType ?? 'application/octet-stream',
      }));
    }

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email sent to ${to} — messageId: ${info.messageId}`);
    } catch (err: unknown) {
      // Log but don't propagate — in-app notification was already saved
      this.logger.error(
        `Failed to send email to ${to}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Send the same email to multiple recipients in parallel.
   * Never throws.
   */
  async sendToMany(
    recipients: string[],
    subject: string,
    text: string,
    attachments?: EmailAttachment[],
  ): Promise<void> {
    if (!recipients.length) return;
    await Promise.allSettled(
      recipients.map((to) => this.send(to, subject, text, attachments)),
    );
  }

  // ── Convenience: pre-formatted ShiftSync emails ───────────────────────────

  async sendShiftAssigned(
    to: string,
    staffName: string,
    locationName: string,
    shiftDate: string,
    shiftTime: string,
  ) {
    await this.send(
      to,
      'ShiftSync — New shift assigned',
      [
        `Hi ${staffName},`,
        '',
        `You have been assigned a new shift at ${locationName}.`,
        `Date: ${shiftDate}`,
        `Time: ${shiftTime}`,
        '',
        'Log in to ShiftSync to view your full schedule.',
        '',
        '— The ShiftSync team',
      ].join('\n'),
    );
  }

  async sendSwapRequested(
    to: string,
    targetName: string,
    requesterName: string,
    shiftDate: string,
  ) {
    await this.send(
      to,
      'ShiftSync — Shift swap request',
      [
        `Hi ${targetName},`,
        '',
        `${requesterName} has requested to swap a shift with you on ${shiftDate}.`,
        '',
        'Log in to ShiftSync to accept or decline.',
        '',
        '— The ShiftSync team',
      ].join('\n'),
    );
  }

  async sendSwapApproved(
    to: string,
    staffName: string,
    approved: boolean,
    shiftDate: string,
  ) {
    const subject = approved
      ? 'ShiftSync — Shift swap approved'
      : 'ShiftSync — Shift swap rejected';
    const body = [
      `Hi ${staffName},`,
      '',
      approved
        ? `Your shift swap for ${shiftDate} has been approved by the manager.`
        : `Your shift swap request for ${shiftDate} was not approved.`,
      '',
      'Log in to ShiftSync for details.',
      '',
      '— The ShiftSync team',
    ].join('\n');
    await this.send(to, subject, body);
  }

  async sendSchedulePublished(
    to: string,
    staffName: string,
    locationName: string,
    weekRange: string,
  ) {
    await this.send(
      to,
      'ShiftSync — Schedule published',
      [
        `Hi ${staffName},`,
        '',
        `The schedule at ${locationName} for ${weekRange} has been published.`,
        '',
        'Log in to ShiftSync to review your shifts.',
        '',
        '— The ShiftSync team',
      ].join('\n'),
    );
  }

  async sendOvertimeWarning(
    to: string,
    staffName: string,
    scheduledHours: number,
    limitHours: number,
  ) {
    await this.send(
      to,
      'ShiftSync — Overtime warning',
      [
        `Hi ${staffName},`,
        '',
        `You are currently scheduled for ${scheduledHours}h this week, approaching the ${limitHours}h limit.`,
        '',
        'Contact your manager if you have any concerns.',
        '',
        '— The ShiftSync team',
      ].join('\n'),
    );
  }

  async sendDropAvailable(
    to: string,
    staffName: string,
    posterName: string,
    shiftDate: string,
    locationName: string,
  ) {
    await this.send(
      to,
      'ShiftSync — Shift available for pickup',
      [
        `Hi ${staffName},`,
        '',
        `${posterName} has posted a shift for coverage at ${locationName} on ${shiftDate}.`,
        '',
        'Log in to ShiftSync to pick it up.',
        '',
        '— The ShiftSync team',
      ].join('\n'),
    );
  }
}
