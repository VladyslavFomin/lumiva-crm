/**
 * Системные заготовки писем (не хранятся в БД до сохранения пользователем).
 * HTML: табличная вёрстка, акцент #222222 — под бренд Lumiva / тёмный UI.
 * Переменные подставляются в сценариях как {{lead.name}}, {{project.name}} и т.д.
 */

export type EmailTemplatePresetId =
  | 'lead_new'
  | 'lead_status'
  | 'project_new'
  | 'sale_new'
  | 'client_broadcast'
  | 'funnel_nurture'
  | 'meeting_reminder'
  | 'thank_you_post_sale'
  | 'reactivation';

const ACCENT = '#222222';
const BORDER = '#e4e4e7';
const PAGE_BG = '#fafafa';
const TEXT = '#18181b';
const MUTED = '#71717a';

/** Общая оболочка письма: заголовок-блок + контент + опциональная кнопка */
function shell(
  headline: string,
  innerHtml: string,
  cta?: { label: string; href: string },
): string {
  const ctaRow = cta
    ? `<tr><td style="padding:8px 28px 28px;"><a href="${cta.href}" style="display:inline-block;padding:12px 22px;background:${ACCENT};color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px;">${cta.label}</a></td></tr>`
    : '';
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${headline}</title>
</head>
<body style="margin:0;background:${PAGE_BG};font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${PAGE_BG};padding:32px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;border:1px solid ${BORDER};overflow:hidden;">
        <tr>
          <td style="padding:24px 28px 20px;background:${ACCENT};">
            <p style="margin:0;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.75);">Lumiva CRM</p>
            <h1 style="margin:8px 0 0;font-size:20px;line-height:1.35;color:#ffffff;font-weight:600;">${headline}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;color:${TEXT};font-size:15px;line-height:1.65;">
            ${innerHtml}
          </td>
        </tr>
        ${ctaRow}
        <tr>
          <td style="padding:18px 28px 24px;border-top:1px solid ${BORDER};font-size:12px;color:${MUTED};">
            Замените этот блок на юридическую подпись и контакты вашей компании.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export interface EmailTemplatePresetContent {
  id: EmailTemplatePresetId;
  subject: string;
  htmlBody: string;
  textBody: string;
}

export const EMAIL_TEMPLATE_PRESET_CONTENTS: readonly EmailTemplatePresetContent[] =
  [
    {
      id: 'lead_new',
      subject: 'Новый лид: {{lead.name}}',
      htmlBody: shell(
        'Новый лид',
        `<p style="margin:0 0 16px;">Здравствуйте!</p>
<p style="margin:0 0 16px;">В CRM появился новый лид — кратко по карточке:</p>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid ${BORDER};border-radius:12px;overflow:hidden;">
  <tr><td style="padding:12px 16px;background:#f4f4f5;font-size:12px;color:${MUTED};width:36%;">Имя</td><td style="padding:12px 16px;font-weight:600;">{{lead.name}}</td></tr>
  <tr><td style="padding:12px 16px;border-top:1px solid ${BORDER};font-size:12px;color:${MUTED};">Email</td><td style="padding:12px 16px;border-top:1px solid ${BORDER};">{{lead.email}}</td></tr>
  <tr><td style="padding:12px 16px;border-top:1px solid ${BORDER};font-size:12px;color:${MUTED};">Телефон</td><td style="padding:12px 16px;border-top:1px solid ${BORDER};">{{lead.phone}}</td></tr>
  <tr><td style="padding:12px 16px;border-top:1px solid ${BORDER};font-size:12px;color:${MUTED};">Статус</td><td style="padding:12px 16px;border-top:1px solid ${BORDER};">{{lead.status}}</td></tr>
</table>`,
        { label: 'Открыть карточку в CRM', href: '#' },
      ),
      textBody:
        'Новый лид в CRM.\nИмя: {{lead.name}}\nEmail: {{lead.email}}\nТелефон: {{lead.phone}}\nСтатус: {{lead.status}}',
    },
    {
      id: 'lead_status',
      subject: '{{lead.name}} — новый статус: {{lead.status}}',
      htmlBody: shell(
        'Лид изменил статус',
        `<p style="margin:0 0 16px;">Здравствуйте!</p>
<p style="margin:0 0 16px;">По лиду <strong>{{lead.name}}</strong> обновился этап воронки.</p>
<p style="margin:0;padding:16px;background:#f4f4f5;border-radius:12px;border:1px solid ${BORDER};">
  <span style="font-size:12px;color:${MUTED};display:block;margin-bottom:6px;">Текущий статус</span>
  <span style="font-size:18px;font-weight:700;color:${ACCENT};">{{lead.status}}</span>
</p>
<p style="margin:16px 0 0;font-size:14px;color:${MUTED};">Контакты: {{lead.email}} · {{lead.phone}}</p>`,
        { label: 'Перейти к лиду', href: '#' },
      ),
      textBody:
        'Лид {{lead.name}} сменил статус на {{lead.status}}.\nEmail: {{lead.email}}\nТелефон: {{lead.phone}}',
    },
    {
      id: 'project_new',
      subject: 'Новый проект: {{project.name}}',
      htmlBody: shell(
        'Новый проект',
        `<p style="margin:0 0 16px;">В CRM создан проект (сделка).</p>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid ${BORDER};border-radius:12px;">
  <tr><td style="padding:12px 16px;background:#f4f4f5;font-size:12px;color:${MUTED};">Название</td><td style="padding:12px 16px;font-weight:600;">{{project.name}}</td></tr>
  <tr><td style="padding:12px 16px;border-top:1px solid ${BORDER};font-size:12px;color:${MUTED};">Статус</td><td style="padding:12px 16px;border-top:1px solid ${BORDER};">{{project.status}}</td></tr>
  <tr><td style="padding:12px 16px;border-top:1px solid ${BORDER};font-size:12px;color:${MUTED};">Сумма</td><td style="padding:12px 16px;border-top:1px solid ${BORDER};">{{project.amount}} {{project.currency}}</td></tr>
</table>`,
        { label: 'Открыть проект', href: '#' },
      ),
      textBody:
        'Новый проект: {{project.name}}\nСтатус: {{project.status}}\nСумма: {{project.amount}} {{project.currency}}',
    },
    {
      id: 'sale_new',
      subject: 'Фиксация продажи: {{sale.id}}',
      htmlBody: shell(
        'Новая продажа',
        `<p style="margin:0 0 16px;">Зафиксирована продажа в CRM.</p>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid ${BORDER};border-radius:12px;">
  <tr><td style="padding:12px 16px;background:#f4f4f5;font-size:12px;color:${MUTED};">Сумма</td><td style="padding:12px 16px;font-weight:700;font-size:18px;color:${ACCENT};">{{sale.amount}} {{sale.currency}}</td></tr>
  <tr><td style="padding:12px 16px;border-top:1px solid ${BORDER};font-size:12px;color:${MUTED};">Статус</td><td style="padding:12px 16px;border-top:1px solid ${BORDER};">{{sale.status}}</td></tr>
</table>
<p style="margin:16px 0 0;font-size:14px;color:${MUTED};">При необходимости добавьте ссылку на счёт или акт во вложении в редакторе.</p>`,
        { label: 'Подробнее в CRM', href: '#' },
      ),
      textBody:
        'Новая продажа.\nСумма: {{sale.amount}} {{sale.currency}}\nСтатус: {{sale.status}}',
    },
    {
      id: 'client_broadcast',
      subject: 'Новости для вас, {{contact.fullName}}',
      htmlBody: shell(
        'Рассылка клиентам',
        `<p style="margin:0 0 12px;">Здравствуйте, {{contact.fullName}}!</p>
<p style="margin:0 0 16px;">Кратко рассказываем, что изменилось для вас за последнее время (замените этот абзац на свой текст).</p>
<ul style="margin:0;padding-left:20px;color:${TEXT};">
  <li style="margin-bottom:8px;">Пункт 1 — продукт или услуга</li>
  <li style="margin-bottom:8px;">Пункт 2 — выгода или кейс</li>
  <li>Пункт 3 — призыв к действию</li>
</ul>`,
        { label: 'Узнать подробнее', href: '#' },
      ),
      textBody:
        'Здравствуйте, {{contact.fullName}}!\n\n[Вставьте текст рассылки.]\n\nС уважением,\nВаша команда',
    },
    {
      id: 'funnel_nurture',
      subject: '{{lead.name}}, продолжим диалог?',
      htmlBody: shell(
        'Воронка: следующий шаг',
        `<p style="margin:0 0 16px;">Здравствуйте, {{lead.name}}!</p>
<p style="margin:0 0 16px;">Мы заметили ваш интерес и хотим помочь с следующим шагом — выберите удобный вариант или ответьте на это письмо.</p>
<p style="margin:0;padding:14px 16px;background:#f4f4f5;border-radius:12px;border-left:4px solid ${ACCENT};font-size:14px;">
  Здесь можно описать оффер, дедлайн или бонус за ответ до указанной даты.
</p>`,
        { label: 'Запланировать звонок', href: '#' },
      ),
      textBody:
        'Здравствуйте, {{lead.name}}!\n\nМы хотим помочь с вашим запросом. Ответьте на письмо или перейдите по ссылке из HTML-версии.',
    },
    {
      id: 'meeting_reminder',
      subject: 'Напоминание: встреча с {{lead.name}}',
      htmlBody: shell(
        'Напоминание о встрече',
        `<p style="margin:0 0 16px;">Здравствуйте!</p>
<p style="margin:0 0 12px;">Напоминаем о запланированной встрече по лиду <strong>{{lead.name}}</strong>.</p>
<p style="margin:0;padding:16px;background:#f4f4f5;border-radius:12px;font-size:14px;">
  Подставьте дату/время и ссылку на видеозвонок вместо этого текста (или используйте переменные из вашего сценария).
</p>`,
        { label: 'Добавить в календарь', href: '#' },
      ),
      textBody:
        'Напоминание о встрече.\nЛид: {{lead.name}}\nEmail: {{lead.email}}\n\n[Укажите дату и время вручную или через сценарий.]',
    },
    {
      id: 'thank_you_post_sale',
      subject: 'Спасибо за сделку, {{contact.fullName}}!',
      htmlBody: shell(
        'Благодарность после сделки',
        `<p style="margin:0 0 16px;">Здравствуйте, {{contact.fullName}}!</p>
<p style="margin:0 0 16px;">Спасибо, что выбрали нас. Ниже — краткая сводка; при необходимости добавьте реквизиты и ссылку на оплату.</p>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid ${BORDER};border-radius:12px;">
  <tr><td style="padding:12px 16px;background:#f4f4f5;font-size:12px;color:${MUTED};">Проект / сделка</td><td style="padding:12px 16px;">{{project.name}}</td></tr>
  <tr><td style="padding:12px 16px;border-top:1px solid ${BORDER};font-size:12px;color:${MUTED};">Сумма</td><td style="padding:12px 16px;border-top:1px solid ${BORDER};font-weight:600;">{{project.amount}} {{project.currency}}</td></tr>
</table>`,
        { label: 'Связаться с менеджером', href: '#' },
      ),
      textBody:
        'Спасибо, {{contact.fullName}}!\nМы ценим сотрудничество.\nПроект: {{project.name}}\nСумма: {{project.amount}} {{project.currency}}',
    },
    {
      id: 'reactivation',
      subject: 'Давно не общались — {{company.name}}',
      htmlBody: shell(
        'Реактивация',
        `<p style="margin:0 0 16px;">Здравствуйте!</p>
<p style="margin:0 0 16px;">Мы по {{company.name}} давно не получали от вас новостей. Если тема актуальна — ответьте на письмо или нажмите кнопку.</p>
<p style="margin:0;font-size:14px;color:${MUTED};">Персонализируйте текст: добавьте имя контакта ({{contact.fullName}}) и конкретное предложение.</p>`,
        { label: 'Хочу продолжить', href: '#' },
      ),
      textBody:
        'Здравствуйте!\n\nМы хотели бы возобновить диалог по {{company.name}}.\n\nС уважением,\n[Подпись]',
    },
  ];

export function getEmailTemplatePreset(
  id: string,
): EmailTemplatePresetContent | undefined {
  return EMAIL_TEMPLATE_PRESET_CONTENTS.find((p) => p.id === id);
}

export const EMAIL_TEMPLATE_PRESET_IDS: EmailTemplatePresetId[] =
  EMAIL_TEMPLATE_PRESET_CONTENTS.map((p) => p.id);
