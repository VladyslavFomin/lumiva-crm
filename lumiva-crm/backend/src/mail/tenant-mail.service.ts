import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import * as nodemailer from 'nodemailer';
import { EmailAccount } from '../email/email-account.entity';
import { EmailOAuthService } from '../email/email-oauth.service';
import { MailService } from './mail.service';

export const TENANT_MAIL_NOT_CONNECTED = 'TENANT_MAIL_NOT_CONNECTED';

export interface TenantMailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  /** content — base64 (как у MailService) или Buffer. */
  attachments?: Array<{ filename: string; content: string | Buffer; contentType?: string }>;
}

export type TenantMailResult =
  | { ok: true; via: 'tenant' | 'platform'; from: string }
  | { ok: false; code: 'NO_MAILBOX' | 'SEND_FAILED'; error: string };

export type TenantSenderStatus = {
  /** Ящик, с которого уйдут письма, или null. */
  account: { id: string; email: string; name: string | null; personal: boolean; provider: string } | null;
  selectedAccountId: string | null;
  senderEmail: string | null;
  /** ok — есть; none — почта не подключена; choose — общих ящиков несколько, нужно выбрать; personal_only — подключены только личные ящики сотрудников. */
  reason: 'ok' | 'none' | 'choose' | 'personal_only';
};

const canSend = (a: EmailAccount) => !!((a.oauthProvider === 'gmail' || a.oauthProvider === 'outlook') && a.oauthRefreshToken) || !!(a.smtpHost && a.smtpPort);

/**
 * Письма от имени клиента (тенанта): уведомления, отчёты, письма его гостям и клиентам уходят с почты,
 * которую клиент подключил в CRM, а не с адреса платформы. Почта не подключена — письмо не уходит
 * (вызывающий показывает «подключите почту»). С адреса платформы — только системное (регистрация,
 * сброс пароля, безопасность, оплата) через MailService, и как запасной вариант там, где без письма
 * человек теряет доступ (приглашение сотрудника, вход в клиентский портал) — `fallbackToPlatform`.
 * Такие письма не сохраняются в переписку CRM (иначе алерты засорят «Отправленные» раздела «Почта»).
 */
@Injectable()
export class TenantMailService {
  private readonly log = new Logger(TenantMailService.name);

  constructor(
    @InjectRepository(EmailAccount) private readonly accounts: Repository<EmailAccount>,
    private readonly oauth: EmailOAuthService,
    private readonly platform: MailService,
  ) {}

  /** Выбранный ящик для уведомлений; не выбран — единственный общий (не личный) рабочий ящик. */
  async status(tenantId: string): Promise<TenantSenderStatus> {
    const list = await this.accounts.find({ where: { tenantId }, order: { createdAt: 'ASC' } });
    const brief = (a: EmailAccount) => ({ id: a.id, email: a.email, name: a.name, personal: !!a.userId, provider: a.oauthProvider || 'smtp' });
    const chosen = list.find((a) => a.useForNotifications && canSend(a));
    if (chosen) {
      return {
        account: brief(chosen),
        selectedAccountId: chosen.id,
        senderEmail: chosen.meta?.notificationFromEmail || chosen.email,
        reason: 'ok',
      };
    }
    const shared = list.filter((a) => !a.userId && canSend(a) && a.status !== 'inactive');
    if (shared.length === 1) {
      return {
        account: brief(shared[0]),
        selectedAccountId: null,
        senderEmail: shared[0].email,
        reason: 'ok',
      };
    }
    if (shared.length > 1) {
      return { account: null, selectedAccountId: null, senderEmail: null, reason: 'choose' };
    }
    return {
      account: null,
      selectedAccountId: null,
      senderEmail: null,
      reason: list.some((a) => canSend(a)) ? 'personal_only' : 'none',
    };
  }

  /** Выбрать ящик и, для Gmail, адрес отправителя для уведомлений. */
  async choose(tenantId: string, accountId: string | null, senderEmail?: string | null) {
    let account: EmailAccount | null = null;
    if (accountId) {
      account = await this.accounts.findOne({ where: { id: accountId, tenantId } });
      if (!account) throw new BadRequestException('Email account not found');
      if (!canSend(account)) throw new BadRequestException('This mailbox cannot send: set up SMTP or connect it via Gmail / Microsoft');
    } else if (senderEmail) {
      throw new BadRequestException('Choose a mailbox before selecting its sender address');
    }

    let selectedSenderEmail: string | null = null;
    if (senderEmail && account) {
      if (account.oauthProvider !== 'gmail' || !account.oauthRefreshToken) {
        throw new BadRequestException('Additional sender addresses are only available for connected Gmail accounts');
      }
      const requestedEmail = senderEmail.trim().toLowerCase();
      const { addresses } = await this.oauth.syncGmailSendAs(account);
      const selectedSender = addresses.find(
        (address) => address.canSend && address.sendAsEmail.toLowerCase() === requestedEmail,
      );
      if (!selectedSender) {
        throw new BadRequestException('The selected Gmail sender is not verified or is no longer available');
      }
      selectedSenderEmail = selectedSender.sendAsEmail;
    }

    await this.accounts.update({ tenantId, useForNotifications: true }, { useForNotifications: false });
    if (account) {
      const meta =
        account.meta && typeof account.meta === 'object' && !Array.isArray(account.meta)
          ? { ...account.meta }
          : {};
      if (selectedSenderEmail) meta.notificationFromEmail = selectedSenderEmail;
      else delete meta.notificationFromEmail;
      account.meta = meta;
      account.useForNotifications = true;
      await this.accounts.save(account);
    }
    return this.status(tenantId);
  }

  /** Отправить от имени клиента. Не бросает — возвращает результат (для фоновых рассылок/алертов). */
  async send(tenantId: string, msg: TenantMailMessage, opts: { fallbackToPlatform?: boolean } = {}): Promise<TenantMailResult> {
    const to = (Array.isArray(msg.to) ? msg.to : [msg.to]).map((x) => String(x || '').trim()).filter(Boolean);
    if (!to.length) return { ok: false, code: 'SEND_FAILED', error: 'No recipients' };
    const st = await this.status(tenantId);
    const account = st.account ? await this.accounts.findOne({ where: { id: st.account.id, tenantId } }) : null;
    if (!account) {
      if (opts.fallbackToPlatform) return this.viaPlatform(to, msg);
      return { ok: false, code: 'NO_MAILBOX', error: `Email is not connected (${st.reason})` };
    }
    try {
      const sender = await this.notificationSender(account);
      const senderEmail = sender?.email || account.email;
      await this.deliver(account, to, msg, sender);
      return { ok: true, via: 'tenant', from: senderEmail };
    } catch (e: any) {
      const error = String(e?.response?.data?.error?.message || e?.response?.data?.error || e?.message || e).slice(0, 500);
      this.log.warn(`tenant mail ${tenantId} via ${account.email} failed: ${error}`);
      // ошибку видно владельцу в разделе «Почта» — как у синхронизации
      await this.accounts.update({ id: account.id }, { lastError: `Send: ${error}`.slice(0, 1000) }).catch(() => undefined);
      if (opts.fallbackToPlatform) return this.viaPlatform(to, msg);
      return { ok: false, code: 'SEND_FAILED', error };
    }
  }

  /** То же, но для действий пользователя («Отправить»): почта не подключена / не отправилось — понятная ошибка. */
  async sendOrThrow(tenantId: string, msg: TenantMailMessage): Promise<{ via: 'tenant' | 'platform'; from: string }> {
    const r = await this.send(tenantId, msg);
    if (r.ok) return { via: r.via, from: r.from };
    if (r.code === 'NO_MAILBOX') {
      throw new BadRequestException({
        code: TENANT_MAIL_NOT_CONNECTED,
        message: 'Email is not connected: connect a mailbox in Email (or choose the mailbox for CRM notifications) — emails are sent from your address.',
      });
    }
    throw new BadRequestException({ code: 'TENANT_MAIL_SEND_FAILED', message: `Your mailbox could not send the email: ${r.error}` });
  }

  private async viaPlatform(to: string[], msg: TenantMailMessage): Promise<TenantMailResult> {
    for (const rcpt of to) {
      const r = await this.platform.sendMailNow({
        to: rcpt,
        subject: msg.subject,
        html: msg.html,
        replyTo: msg.replyTo,
        attachments: msg.attachments?.map((a) => ({ filename: a.filename, content: Buffer.isBuffer(a.content) ? a.content.toString('base64') : a.content, contentType: a.contentType })),
      });
      if (!r.ok) return { ok: false, code: 'SEND_FAILED', error: r.error };
    }
    return { ok: true, via: 'platform', from: process.env.MAIL_FROM || 'platform' };
  }

  private attachmentsOf(msg: TenantMailMessage) {
    return msg.attachments?.map((a) => ({
      filename: a.filename,
      contentType: a.contentType,
      content: Buffer.isBuffer(a.content) ? a.content : Buffer.from(a.content, 'base64'),
    }));
  }

  private async notificationSender(a: EmailAccount): Promise<{ email: string; displayName: string } | null> {
    if (a.oauthProvider !== 'gmail' || !a.oauthRefreshToken) return null;
    const { addresses } = await this.oauth.syncGmailSendAs(a);
    const requestedEmail = String(a.meta?.notificationFromEmail || '').trim().toLowerCase();
    const sender =
      addresses.find((address) => address.canSend && address.sendAsEmail.toLowerCase() === requestedEmail) ||
      (!requestedEmail ? addresses.find((address) => address.isPrimary && address.canSend) : undefined);
    if (!sender) {
      throw new Error(
        requestedEmail
          ? 'The configured Gmail sender is no longer verified or available'
          : 'No verified Gmail sender address is available',
      );
    }
    return {
      email: sender.sendAsEmail,
      displayName: sender.displayName || addresses.find((address) => address.isPrimary)?.displayName || a.name || '',
    };
  }

  private fromOf(a: EmailAccount, senderEmail = a.email, senderName = a.name) {
    return senderName ? `${senderName.replace(/"/g, '')} <${senderEmail}>` : senderEmail;
  }

  private async deliver(
    a: EmailAccount,
    to: string[],
    msg: TenantMailMessage,
    sender: { email: string; displayName: string } | null,
  ) {
    const attachments = this.attachmentsOf(msg);
    if (a.oauthProvider === 'gmail' && a.oauthRefreshToken) {
      const token = await this.oauth.ensureAccessToken(a);
      if (!sender) throw new Error('No verified Gmail sender address is available');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const MailComposer = require('nodemailer/lib/mail-composer');
      const mime: Buffer = await new Promise((resolve, reject) =>
        new MailComposer({
          from: this.fromOf(a, sender.email, sender.displayName),
          to,
          replyTo: msg.replyTo,
          subject: msg.subject,
          text: msg.text,
          html: msg.html,
          attachments,
        })
          .compile()
          .build((err: Error | null, out: Buffer) => (err ? reject(err) : resolve(out))),
      );
      const raw = mime.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      await axios.post('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { raw }, { headers: { Authorization: `Bearer ${token}` }, timeout: 30_000 });
      return;
    }
    if (a.oauthProvider === 'outlook' && a.oauthRefreshToken) {
      const token = await this.oauth.ensureAccessToken(a);
      await axios.post(
        'https://graph.microsoft.com/v1.0/me/sendMail',
        {
          message: {
            subject: msg.subject,
            body: { contentType: 'HTML', content: msg.html },
            toRecipients: to.map((address) => ({ emailAddress: { address } })),
            ...(msg.replyTo ? { replyTo: [{ emailAddress: { address: msg.replyTo } }] } : {}),
            attachments: attachments?.length
              ? attachments.map((x) => ({ '@odata.type': '#microsoft.graph.fileAttachment', name: x.filename, contentType: x.contentType || 'application/octet-stream', contentBytes: x.content.toString('base64') }))
              : undefined,
          },
          saveToSentItems: true,
        },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 30_000 },
      );
      return;
    }
    if (!a.smtpHost || !a.smtpPort) throw new Error('SMTP is not configured for this mailbox');
    const transporter = nodemailer.createTransport({
      host: a.smtpHost,
      port: a.smtpPort,
      secure: a.smtpSecure,
      auth: { user: a.smtpUsername || a.email, pass: a.smtpPassword || '' },
      connectionTimeout: 20_000,
      greetingTimeout: 20_000,
      socketTimeout: 30_000,
      requireTLS: !a.smtpSecure,
      tls: { rejectUnauthorized: false },
    } as any);
    await transporter.sendMail({ from: this.fromOf(a), to, replyTo: msg.replyTo, subject: msg.subject, text: msg.text, html: msg.html, attachments });
  }
}
