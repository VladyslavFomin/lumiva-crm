// backend/src/mail/mail.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;

  constructor() {
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
        logger: true,   // <– добавь
        debug: true,    // <– добавь
    });
  }

  async sendMail(opts: { to: string; subject: string; html: string }) {
    const from =
      process.env.MAIL_FROM || '"Lumiva CRM" <no-reply@lumiva.agency>';

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
        (err as any).stack || String(err),
      );
      // ВАЖНО: НЕ пробрасываем ошибку дальше,
      // чтобы API не падал 500 из-за проблем SMTP.
    }
  }

  async sendOwnerInviteEmail(params: {
    to: string;
    fullName: string;
    tenantName?: string;
    link: string;
  }) {
    const { to, fullName, tenantName, link } = params;

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
                Здравствуйте, ${fullName}!<br/><br/>
                Для компании ${
                  tenantName ? `<strong>${tenantName}</strong>` : 'вашей компании'
                } создан доступ к платформе Lumiva CRM.
                Чтобы начать работу, задайте персональный пароль.
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <a href="${link}" style="display:inline-block;padding:12px 28px;border-radius:999px;background:#0ea5e9;color:#0b1120;text-decoration:none;font-weight:600;font-size:15px;">
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
}