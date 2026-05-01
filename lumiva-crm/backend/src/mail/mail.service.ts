// backend/src/mail/mail.service.ts
import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as nodemailer from 'nodemailer';
import { MAIL_QUEUE, MAIL_JOB_SEND } from './mail.constants';

export interface MailSendOptions {
  to: string;
  subject: string;
  html: string;
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

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async sendOwnerInviteEmail(params: {
    to: string;
    fullName: string;
    tenantName?: string;
    link: string;
  }) {
    const { to, fullName, tenantName, link } = params;
    const safeName = this.escapeHtml(fullName);
    const safeTenant = tenantName ? this.escapeHtml(tenantName) : '';

    const subject = 'Добро пожаловать в Lumiva CRM';

    const html = `<!doctype html>
<html lang="ru">
  <body style="margin:0;padding:0;background:#050816;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e5e7eb;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#050816;padding:32px 0;">
      <tr>
        <td align="center">
          <table width="560" cellpadding="0" cellspacing="0" style="background:radial-gradient(circle at top left,#22d3ee,#1e293b);border-radius:24px;padding:32px 32px 40px;">
            <tr>
              <td style="font-size:24px;font-weight:600;padding-bottom:8px;color:#ecfeff;">
                Добро пожаловать в Lumiva CRM
              </td>
            </tr>
            <tr>
              <td style="font-size:15px;line-height:1.6;color:#e5e7eb;padding-bottom:24px;">
                Здравствуйте, ${safeName}!<br/><br/>
                Для компании ${
                  safeTenant ? `<strong>${safeTenant}</strong>` : 'вашей компании'
                } создан доступ к платформе Lumiva CRM.
                Чтобы начать работу, задайте персональный пароль.
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <a href="${link}" style="display:inline-block;padding:14px 32px;border-radius:14px;background:#222222;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;">
                  Задать пароль
                </a>
              </td>
            </tr>
            <tr>
              <td style="font-size:13px;line-height:1.6;color:#9ca3af;">
                Ссылка будет активна в течение <strong>48 часов</strong> и может быть использована только один раз.
                Если вы не запрашивали доступ к Lumiva CRM, просто проигнорируйте это письмо.
              </td>
            </tr>
            <tr>
              <td style="font-size:12px;color:#6b7280;padding-top:24px;border-top:1px solid rgba(15,23,42,0.8);">
                © ${new Date().getFullYear()} Lumiva CRM. Все права защищены.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

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
    const safeName = this.escapeHtml(fullName);
    const safeTenant = tenantName ? this.escapeHtml(tenantName) : '';

    const subject = 'Приглашение в команду — Lumiva CRM';

    const html = `<!doctype html>
<html lang="ru">
  <body style="margin:0;padding:0;background:#050816;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e5e7eb;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#050816;padding:32px 0;">
      <tr>
        <td align="center">
          <table width="560" cellpadding="0" cellspacing="0" style="background:radial-gradient(circle at top left,#22d3ee,#1e293b);border-radius:24px;padding:32px 32px 40px;">
            <tr>
              <td style="font-size:22px;font-weight:600;padding-bottom:8px;color:#ecfeff;">
                Приглашение в Lumiva CRM
              </td>
            </tr>
            <tr>
              <td style="font-size:15px;line-height:1.65;color:#e5e7eb;padding-bottom:20px;">
                Здравствуйте, ${safeName}!<br/><br/>
                ${
                  safeTenant
                    ? `Компания <strong>${safeTenant}</strong> приглашает вас в рабочее пространство Lumiva CRM.`
                    : 'Вам открыт доступ к рабочему пространству Lumiva CRM.'
                }
                Нажмите кнопку ниже, чтобы <strong>задать пароль</strong> и активировать учётную запись.
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-bottom:16px;">
                <a href="${link}" style="display:inline-block;padding:14px 32px;border-radius:14px;background:#222222;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;">
                  Задать пароль и войти
                </a>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-bottom:22px;">
                <a href="${loginUrl}" style="font-size:14px;color:#e0f2fe;text-decoration:underline;font-weight:500;">
                  Уже есть пароль? Войти в аккаунт
                </a>
              </td>
            </tr>
            <tr>
              <td style="font-size:13px;line-height:1.6;color:#9ca3af;">
                Ссылка для пароля действует <strong>48 часов</strong> и одноразовая.
                Если вы не ожидали это письмо, проигнорируйте его.
              </td>
            </tr>
            <tr>
              <td style="font-size:12px;color:#6b7280;padding-top:24px;border-top:1px solid rgba(15,23,42,0.8);">
                © ${new Date().getFullYear()} Lumiva CRM
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

    await this.sendMail({ to, subject, html });
  }
}
