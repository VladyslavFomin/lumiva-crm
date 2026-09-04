// backend/src/mail/mail.service.ts
import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as nodemailer from 'nodemailer';
import { MAIL_QUEUE, MAIL_JOB_SEND } from './mail.constants';
import { escapeMailHtml, renderMailShell } from './mail-template.util';

export interface MailSendOptions {
  to: string;
  subject: string;
  html: string;
  /** Base64-encoded content — required (not a Buffer) so an attachment survives BullMQ's JSON
   * serialization through Redis when queued. */
  attachments?: Array<{ filename: string; content: string }>;
  replyTo?: string;
  messageId?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(
    @Optional() @InjectQueue(MAIL_QUEUE) private readonly queue: Queue | null,
  ) {
    const host = process.env.MAIL_HOST;
    const port = Number(process.env.MAIL_PORT || 587);
    const secure =
      process.env.MAIL_SECURE === '1' ||
      process.env.MAIL_SECURE === 'true' ||
      process.env.MAIL_SECURE === 'yes';

    this.logger.log(
      `Init transporter host=${host} port=${port} secure=${secure}, user=${process.env.MAIL_USER}`,
    );

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
      logger: true,
      debug: true,
    });
  }

  async sendMail(opts: MailSendOptions): Promise<void> {
    if (this.queue) {
      await this.queue.add(MAIL_JOB_SEND, opts, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      });
      this.logger.debug(`Mail queued to ${opts.to}: ${opts.subject}`);
    } else {
      await this.sendMailDirect(opts);
    }
  }

  async sendMailDirect(opts: MailSendOptions): Promise<void> {
    const from = process.env.MAIL_FROM || '"Lumiva CRM" <no-reply@lumiva.agency>';
    try {
      const info = await this.transporter.sendMail({
        from,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        replyTo: opts.replyTo,
        messageId: opts.messageId,
        attachments: opts.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          encoding: 'base64' as const,
        })),
      });
      this.logger.log(
        `Mail sent to ${opts.to}: ${opts.subject} (messageId=${info.messageId})`,
      );
    } catch (err) {
      this.logger.error(
        `Mail send failed to ${opts.to}: ${opts.subject}`,
        (err as Error).stack || String(err),
      );
    }
  }

  /**
   * Sends synchronously (bypasses the BullMQ queue) and never swallows the error —
   * callers that need a deterministic sent/failed result for the UI (e.g. Sales Panel)
   * should use this instead of `sendMail`/`sendMailDirect`.
   */
  async sendMailNow(
    opts: MailSendOptions,
  ): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
    const from = process.env.MAIL_FROM || '"Lumiva CRM" <no-reply@lumiva.agency>';
    try {
      const info = await this.transporter.sendMail({
        from,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        replyTo: opts.replyTo,
        messageId: opts.messageId,
        attachments: opts.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          encoding: 'base64' as const,
        })),
      });
      this.logger.log(
        `Mail sent to ${opts.to}: ${opts.subject} (messageId=${info.messageId})`,
      );
      return { ok: true, messageId: info.messageId };
    } catch (err) {
      const message = (err as Error).message || String(err);
      this.logger.error(
        `Mail send failed to ${opts.to}: ${opts.subject}`,
        (err as Error).stack || message,
      );
      return { ok: false, error: message };
    }
  }

  async sendOwnerInviteEmail(params: {
    to: string;
    fullName: string;
    tenantName?: string;
    link: string;
  }) {
    const { to, fullName, tenantName, link } = params;
    const safeName = escapeMailHtml(fullName);
    const safeTenant = tenantName ? escapeMailHtml(tenantName) : '';

    const subject = 'Добро пожаловать в Lumiva CRM';

    const html = renderMailShell({
      headline: 'Добро пожаловать в Lumiva CRM',
      bodyHtml: `<p style="margin:0 0 16px;">Здравствуйте, ${safeName}!</p>
<p style="margin:0 0 16px;">Для компании ${
        safeTenant ? `<strong>${safeTenant}</strong>` : 'вашей компании'
      } создан доступ к платформе Lumiva CRM. Чтобы начать работу, задайте персональный пароль.</p>
<p style="margin:0;font-size:13px;color:#71717a;">Ссылка будет активна в течение <strong>48 часов</strong> и может быть использована только один раз. Если вы не запрашивали доступ к Lumiva CRM, просто проигнорируйте это письмо.</p>`,
      cta: { label: 'Задать пароль', href: link },
    });

    await this.sendMail({ to, subject, html });
  }

  async sendTeamInviteEmail(params: {
    to: string;
    fullName: string;
    tenantName?: string;
    link: string;
    loginUrl: string;
  }) {
    const { to, fullName, tenantName, link, loginUrl } = params;
    const safeName = escapeMailHtml(fullName);
    const safeTenant = tenantName ? escapeMailHtml(tenantName) : '';

    const subject = 'Приглашение в команду — Lumiva CRM';

    const html = renderMailShell({
      headline: 'Приглашение в Lumiva CRM',
      bodyHtml: `<p style="margin:0 0 16px;">Здравствуйте, ${safeName}!</p>
<p style="margin:0 0 20px;">${
        safeTenant
          ? `Компания <strong>${safeTenant}</strong> приглашает вас в рабочее пространство Lumiva CRM.`
          : 'Вам открыт доступ к рабочему пространству Lumiva CRM.'
      } Нажмите кнопку ниже, чтобы задать пароль и активировать учётную запись.</p>
<p style="margin:0 0 16px;"><a href="${loginUrl}" style="color:#222222;font-weight:600;text-decoration:underline;">Уже есть пароль? Войти в аккаунт</a></p>
<p style="margin:0;font-size:13px;color:#71717a;">Ссылка для пароля действует <strong>48 часов</strong> и одноразовая. Если вы не ожидали это письмо, проигнорируйте его.</p>`,
      cta: { label: 'Задать пароль и войти', href: link },
    });

    await this.sendMail({ to, subject, html });
  }
}
