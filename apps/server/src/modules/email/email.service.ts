import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
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

  private transporter: Transporter | null = null;
  private enabled = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.init();
  }

  private init() {
    const userEmail = this.config.get<string>('USER_EMAIL');
    const userPassword = this.config.get<string>('USER_PASSWORD');

    if (!userEmail || !userPassword) {
      this.logger.warn(
        'Email service disabled — USER_EMAIL or USER_PASSWORD missing. ' +
          'Notifications will be in-app only.',
      );
      this.enabled = false;
      return;
    }

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      port: 465,
      secure: true,
      debug: true,
      auth: {
        user: userEmail,
        pass: userPassword,
      },
      tls: {
        rejectUnauthorized: true,
      },
    } as nodemailer.TransportOptions);

    this.enabled = true;
    this.logger.log(`Email service initialised — sending from ${userEmail}`);
  }

  // ── Core send ──────────────────────────────────────────────────────────────

  async send(
    to: string,
    subject: string,
    text: string,
    attachments?: EmailAttachment[],
  ): Promise<void> {
    if (!this.enabled || !this.transporter) {
      this.logger.debug(
        `[Email disabled] Would have sent "${subject}" to ${to}`,
      );
      return;
    }

    const fromEmail = this.config.get<string>('USER_EMAIL')!;

    const mailOptions: nodemailer.SendMailOptions = {
      from: `"ShiftSync" <${fromEmail}>`,
      to,
      subject,
      text,
    };

    if (attachments && attachments.length > 0) {
      mailOptions.attachments = attachments.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.contentType || 'application/octet-stream',
      }));
      this.logger.debug(
        `Sending email with ${attachments.length} attachment(s)`,
      );
    }

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(
        `Email sent successfully to ${to} — Message ID: ${info.messageId}`,
      );
    } catch (err: unknown) {
      this.logger.error(
        `Failed to send email to ${to}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async sendToMany(
    recipients: string[],
    subject: string,
    text: string,
    attachments?: EmailAttachment[],
  ): Promise<void> {
    if (!recipients || recipients.length === 0) return;
    const emailPromises = recipients.map((email) =>
      this.send(email, subject, text, attachments),
    );
    await Promise.all(emailPromises);
    this.logger.log(
      `Emails sent successfully to ${recipients.length} recipients`,
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

