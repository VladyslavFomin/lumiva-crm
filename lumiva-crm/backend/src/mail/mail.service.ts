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

  /**
   * Платформенное письмо о проблеме с оплатой тарифа (карта отклонена / платёж не прошёл) или
   * о том, что доступ приостановлен из-за просрочки — см. billing/billing-alerts.service.ts.
   * Локализовано по tenant.uiLanguage (ru/en/tr), т.к. это письмо уходит клиенту, а не команде Lumiva.
   */
  async sendBillingAlertEmail(params: {
    to: string;
    uiLanguage?: string | null;
    kind: 'payment_failed' | 'access_expired';
    tenantName?: string | null;
    billingUrl: string;
  }) {
    const { to, kind, billingUrl } = params;
    const lang = (params.uiLanguage || 'ru').slice(0, 2);
    const safeTenant = params.tenantName ? escapeMailHtml(params.tenantName) : '';

    const copy: Record<'ru' | 'en' | 'tr', Record<'payment_failed' | 'access_expired', { subject: string; headline: string; body: string; cta: string }>> = {
      ru: {
        payment_failed: {
          subject: 'Не удалось провести оплату — Lumiva CRM',
          headline: 'Платёж не прошёл',
          body: `Мы не смогли провести оплату тарифа${safeTenant ? ` для <strong>${safeTenant}</strong>` : ''} — банк отклонил операцию или платёж не был завершён. Пожалуйста, проверьте карту или способ оплаты и попробуйте снова, чтобы не потерять доступ к CRM.`,
          cta: 'Повторить оплату',
        },
        access_expired: {
          subject: 'Доступ к CRM приостановлен — оплата просрочена',
          headline: 'Оплата просрочена',
          body: `Срок действия тарифа${safeTenant ? ` для <strong>${safeTenant}</strong>` : ''} истёк, и доступ к Lumiva CRM временно ограничен. Чтобы возобновить работу без потери данных, выберите тариф и оплатите его — это займёт пару минут.`,
          cta: 'Продлить тариф',
        },
      },
      en: {
        payment_failed: {
          subject: 'Your payment did not go through — Lumiva CRM',
          headline: 'Payment failed',
          body: `We couldn't process your plan payment${safeTenant ? ` for <strong>${safeTenant}</strong>` : ''} — the card was declined or the payment did not complete. Please check your payment method and try again to avoid losing access to your CRM.`,
          cta: 'Retry payment',
        },
        access_expired: {
          subject: 'CRM access paused — payment overdue',
          headline: 'Payment overdue',
          body: `Your plan${safeTenant ? ` for <strong>${safeTenant}</strong>` : ''} has expired and access to Lumiva CRM is currently limited. Choose a plan and pay to resume work — your data is safe and nothing is lost.`,
          cta: 'Renew plan',
        },
      },
      tr: {
        payment_failed: {
          subject: 'Ödemeniz gerçekleşmedi — Lumiva CRM',
          headline: 'Ödeme başarısız',
          body: `Plan ödemenizi${safeTenant ? ` (<strong>${safeTenant}</strong>)` : ''} işleyemedik — kart reddedildi veya ödeme tamamlanmadı. CRM erişiminizi kaybetmemek için lütfen ödeme yönteminizi kontrol edip tekrar deneyin.`,
          cta: 'Ödemeyi tekrar dene',
        },
        access_expired: {
          subject: 'CRM erişimi duraklatıldı — ödeme gecikti',
          headline: 'Ödeme gecikti',
          body: `Planınızın${safeTenant ? ` (<strong>${safeTenant}</strong>)` : ''} süresi doldu ve Lumiva CRM erişimi şu anda sınırlı. Çalışmaya devam etmek için bir plan seçip ödeme yapın — verileriniz güvende.`,
          cta: 'Planı yenile',
        },
      },
    };

    const localized = copy[(lang === 'en' || lang === 'tr' ? lang : 'ru') as 'ru' | 'en' | 'tr'][kind];
    const html = renderMailShell({
      headline: localized.headline,
      bodyHtml: `<p style="margin:0;">${localized.body}</p>`,
      cta: { label: localized.cta, href: billingUrl },
    });

    await this.sendMail({ to, subject: localized.subject, html });
  }

  /**
   * Письмо о том, что доступ к рекламному кабинету / соцсети (OAuth-токен Meta) скоро истечёт или уже истёк —
   * см. marketing/integration-token-expiry.scheduler.ts. Локализовано по tenant.uiLanguage (ru/en/tr).
   */
  async sendIntegrationTokenEmail(params: {
    to: string;
    uiLanguage?: string | null;
    tenantName?: string | null;
    /** Название подключения: «Meta Ads» / «Meta (SMM)». */
    what: string;
    kind: 'soon' | 'expired';
    /** Дата окончания доступа, уже отформатированная. */
    dateLabel: string;
    daysLeft: number;
    url: string;
  }) {
    const { to, what, kind, dateLabel, daysLeft, url } = params;
    const lang = (params.uiLanguage || 'ru').slice(0, 2);
    const w = escapeMailHtml(what);
    const d = escapeMailHtml(dateLabel);
    const copy = {
      ru: {
        soon: { subject: `Доступ к ${what} истекает через ${daysLeft} дн. — Lumiva CRM`, headline: 'Доступ скоро истечёт', body: `Доступ Lumiva CRM к <strong>${w}</strong> действует до <strong>${d}</strong> (осталось дней: ${daysLeft}). После этой даты статистика перестанет обновляться. Переподключите аккаунт — это занимает минуту.`, cta: 'Переподключить' },
        expired: { subject: `Доступ к ${what} истёк — Lumiva CRM`, headline: 'Доступ истёк', body: `Доступ Lumiva CRM к <strong>${w}</strong> истёк (${d}), поэтому данные больше не обновляются. Переподключите аккаунт, чтобы статистика снова начала поступать.`, cta: 'Переподключить' },
      },
      en: {
        soon: { subject: `Access to ${what} expires in ${daysLeft} days — Lumiva CRM`, headline: 'Access is about to expire', body: `Lumiva CRM’s access to <strong>${w}</strong> is valid until <strong>${d}</strong> (${daysLeft} days left). After that date statistics will stop updating. Reconnect the account — it takes a minute.`, cta: 'Reconnect' },
        expired: { subject: `Access to ${what} has expired — Lumiva CRM`, headline: 'Access expired', body: `Lumiva CRM’s access to <strong>${w}</strong> expired on ${d}, so data is no longer updating. Reconnect the account to start receiving statistics again.`, cta: 'Reconnect' },
      },
      tr: {
        soon: { subject: `${what} erişimi ${daysLeft} gün içinde sona eriyor — Lumiva CRM`, headline: 'Erişim yakında sona erecek', body: `Lumiva CRM’in <strong>${w}</strong> erişimi <strong>${d}</strong> tarihine kadar geçerli (${daysLeft} gün kaldı). Bu tarihten sonra istatistikler güncellenmeyecek. Hesabı yeniden bağlayın — bir dakika sürer.`, cta: 'Yeniden bağla' },
        expired: { subject: `${what} erişiminin süresi doldu — Lumiva CRM`, headline: 'Erişimin süresi doldu', body: `Lumiva CRM’in <strong>${w}</strong> erişiminin süresi ${d} tarihinde doldu, bu yüzden veriler güncellenmiyor. İstatistiklerin yeniden gelmesi için hesabı yeniden bağlayın.`, cta: 'Yeniden bağla' },
      },
    } as const;
    const l = copy[(lang === 'en' || lang === 'tr' ? lang : 'ru') as 'ru' | 'en' | 'tr'][kind];
    const html = renderMailShell({
      headline: l.headline,
      bodyHtml: `<p style="margin:0;">${l.body}</p>`,
      cta: { label: l.cta, href: url },
    });
    await this.sendMail({ to, subject: l.subject, html });
  }
}
