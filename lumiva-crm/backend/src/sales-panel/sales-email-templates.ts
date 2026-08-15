import type { SalesInvitationLanguage } from './sales-invitation.entity';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function shell(opts: {
  lang: string;
  heading: string;
  greeting: string;
  paragraphs: string[];
  ctaText: string;
  ctaHref: string;
  footer: string;
}): string {
  const { lang, heading, greeting, paragraphs, ctaText, ctaHref, footer } = opts;
  const body = paragraphs
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#334155;">${p}</p>`)
    .join('');
  return `<!doctype html>
<html lang="${lang}">
  <body style="margin:0;padding:0;background:#eef1f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f6;padding:40px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:18px;border:1px solid #e2e8f0;overflow:hidden;">
            <tr>
              <td style="padding:22px 40px;background:linear-gradient(135deg,#2563eb,#0ea5e9);">
                <span style="font-size:14px;font-weight:700;letter-spacing:0.04em;color:#ffffff;text-transform:uppercase;">Lumiva CRM</span>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 40px 4px;">
                <h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:700;color:#0f172a;">${heading}</h1>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#0f172a;font-weight:600;">${greeting}</p>
                ${body}
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:8px 40px 8px;">
                <a href="${ctaHref}" style="display:inline-block;padding:13px 34px;border-radius:10px;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;">
                  ${ctaText}
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 40px 32px;">
                <p style="margin:0;font-size:12.5px;line-height:1.6;color:#94a3b8;">${footer}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 40px;border-top:1px solid #eef1f6;">
                <p style="margin:0;font-size:11.5px;color:#cbd5e1;">© ${new Date().getFullYear()} Lumiva CRM</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

const LUMIVA_SITE_URL = process.env.LUMIVA_SITE_URL || 'https://lumiva.agency';

export interface SalesEmailTemplate {
  subject: string;
  bodyHtml: (businessName: string) => string;
}

export const SALES_EMAIL_TEMPLATES: Record<SalesInvitationLanguage, SalesEmailTemplate> = {
  en: {
    subject: 'Partnership opportunity with Lumiva CRM',
    bodyHtml: (businessName: string) =>
      shell({
        lang: 'en',
        heading: 'A quick idea for your business',
        greeting: `Hello ${escapeHtml(businessName)} team,`,
        paragraphs: [
          `My name is on the Lumiva CRM team — we build a CRM and booking platform used by businesses like yours to manage clients, sales, bookings and communication in one place.`,
          `We came across ${escapeHtml(businessName)} and think there could be a good fit for a partnership: we help businesses digitize client management and, in return, get a chance to work with great local teams like yours.`,
          `If you're open to a short conversation, just reply to this email — we'll find a time that works for you. If it's not relevant right now, no worries at all, feel free to ignore this message.`,
        ],
        ctaText: 'Learn more about Lumiva CRM',
        ctaHref: LUMIVA_SITE_URL,
        footer:
          'This is a one-time outreach email, not a recurring newsletter. Reply "not interested" and we will not contact you again.',
      }),
  },
  ru: {
    subject: 'Предложение о сотрудничестве от Lumiva CRM',
    bodyHtml: (businessName: string) =>
      shell({
        lang: 'ru',
        heading: 'Короткая идея для вашего бизнеса',
        greeting: `Здравствуйте, команда ${escapeHtml(businessName)}!`,
        paragraphs: [
          `Меня зовут представитель команды Lumiva CRM — мы разрабатываем CRM- и booking-платформу, которой пользуются такие компании, как ваша, для управления клиентами, продажами, бронированиями и коммуникацией в одном месте.`,
          `Мы обратили внимание на ${escapeHtml(businessName)} и считаем, что сотрудничество могло бы быть взаимовыгодным: мы помогаем бизнесам оцифровать работу с клиентами, а взамен рады работать с сильными локальными командами, как ваша.`,
          `Если вам интересно коротко обсудить это — просто ответьте на это письмо, и мы подберём удобное время. Если сейчас не актуально — ничего страшного, можно просто проигнорировать это сообщение.`,
        ],
        ctaText: 'Узнать больше о Lumiva CRM',
        ctaHref: LUMIVA_SITE_URL,
        footer:
          'Это разовое письмо, а не регулярная рассылка. Ответьте «не интересно» — и мы больше не будем писать.',
      }),
  },
  tr: {
    subject: 'Lumiva CRM ile iş birliği fırsatı',
    bodyHtml: (businessName: string) =>
      shell({
        lang: 'tr',
        heading: 'İşletmeniz için kısa bir fikir',
        greeting: `Merhaba ${escapeHtml(businessName)} ekibi,`,
        paragraphs: [
          `Ben Lumiva CRM ekibindenim — sizin gibi işletmelerin müşteri yönetimi, satış, rezervasyon ve iletişimini tek bir yerden yönetmesini sağlayan bir CRM ve rezervasyon platformu geliştiriyoruz.`,
          `${escapeHtml(businessName)} işletmesini fark ettik ve bir iş birliği için iyi bir eşleşme olabileceğini düşünüyoruz: işletmelerin müşteri yönetimini dijitalleştirmesine yardımcı oluyoruz ve karşılığında sizin gibi güçlü yerel ekiplerle çalışma fırsatı buluyoruz.`,
          `Kısa bir görüşme için uygunsanız bu e-postayı yanıtlamanız yeterli, size uygun bir zaman bulalım. Şu an için uygun değilse sorun değil, bu mesajı görmezden gelebilirsiniz.`,
        ],
        ctaText: "Lumiva CRM hakkında daha fazla bilgi",
        ctaHref: LUMIVA_SITE_URL,
        footer:
          'Bu tek seferlik bir e-postadır, düzenli bir bülten değildir. "İlgilenmiyorum" şeklinde yanıtlarsanız bir daha iletişime geçmeyiz.',
      }),
  },
};
