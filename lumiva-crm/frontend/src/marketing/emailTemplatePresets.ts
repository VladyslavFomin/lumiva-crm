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

/**
 * Тело письма (то, что реально сохраняется в htmlBody): контент + опциональная кнопка,
 * БЕЗ шапки/футера компании — они подставляются автоматически из обёртки
 * (Настройки компании → «Обёртка для писем») при отправке, см. useWrapper на шаблоне.
 */
function fragment(innerHtml: string, cta?: { label: string; href: string }): string {
  const ctaRow = cta
    ? `<p style="margin:20px 0 0;"><a href="${cta.href}" style="display:inline-block;padding:12px 22px;background:${ACCENT};color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px;">${cta.label}</a></p>`
    : '';
  return `${innerHtml}${ctaRow}`;
}

/**
 * Полноценный HTML-документ ИСКЛЮЧИТЕЛЬНО для миниатюры в «Библиотеке заготовок» —
 * показывает, как контент будет выглядеть внутри дизайна компании (условно, на дефолтной теме).
 * В реальное письмо не идёт.
 */
function previewShell(headline: string, innerHtml: string, cta?: { label: string; href: string }): string {
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
  /** Только для миниатюры в библиотеке заготовок — не сохраняется как содержимое шаблона. */
  previewHtml: string;
}

/** Собирает один пункт библиотеки заготовок: реальный фрагмент + макет для миниатюры. */
function preset(
  id: EmailTemplatePresetId,
  subject: string,
  headline: string,
  innerHtml: string,
  textBody: string,
  cta: { label: string; href: string },
): EmailTemplatePresetContent {
  return {
    id,
    subject,
    htmlBody: fragment(innerHtml, cta),
    textBody,
    previewHtml: previewShell(headline, innerHtml, cta),
  };
}

export const EMAIL_TEMPLATE_PRESET_CONTENTS: readonly EmailTemplatePresetContent[] =
  [
    preset(
      'lead_new',
      'Новый лид: {{lead.name}}',
      'Новый лид',
      `<p style="margin:0 0 16px;">Здравствуйте!</p>
<p style="margin:0 0 16px;">В CRM появился новый лид — кратко по карточке:</p>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid ${BORDER};border-radius:12px;overflow:hidden;">
  <tr><td style="padding:12px 16px;background:#f4f4f5;font-size:12px;color:${MUTED};width:36%;">Имя</td><td style="padding:12px 16px;font-weight:600;">{{lead.name}}</td></tr>
  <tr><td style="padding:12px 16px;border-top:1px solid ${BORDER};font-size:12px;color:${MUTED};">Email</td><td style="padding:12px 16px;border-top:1px solid ${BORDER};">{{lead.email}}</td></tr>
  <tr><td style="padding:12px 16px;border-top:1px solid ${BORDER};font-size:12px;color:${MUTED};">Телефон</td><td style="padding:12px 16px;border-top:1px solid ${BORDER};">{{lead.phone}}</td></tr>
  <tr><td style="padding:12px 16px;border-top:1px solid ${BORDER};font-size:12px;color:${MUTED};">Статус</td><td style="padding:12px 16px;border-top:1px solid ${BORDER};">{{lead.status}}</td></tr>
</table>`,
      'Новый лид в CRM.\nИмя: {{lead.name}}\nEmail: {{lead.email}}\nТелефон: {{lead.phone}}\nСтатус: {{lead.status}}',
      { label: 'Открыть карточку в CRM', href: '#' },
    ),
    preset(
      'lead_status',
      '{{lead.name}} — новый статус: {{lead.status}}',
      'Лид изменил статус',
      `<p style="margin:0 0 16px;">Здравствуйте!</p>
<p style="margin:0 0 16px;">По лиду <strong>{{lead.name}}</strong> обновился этап воронки.</p>
<p style="margin:0;padding:16px;background:#f4f4f5;border-radius:12px;border:1px solid ${BORDER};">
  <span style="font-size:12px;color:${MUTED};display:block;margin-bottom:6px;">Текущий статус</span>
  <span style="font-size:18px;font-weight:700;color:${ACCENT};">{{lead.status}}</span>
</p>
<p style="margin:16px 0 0;font-size:14px;color:${MUTED};">Контакты: {{lead.email}} · {{lead.phone}}</p>`,
      'Лид {{lead.name}} сменил статус на {{lead.status}}.\nEmail: {{lead.email}}\nТелефон: {{lead.phone}}',
      { label: 'Перейти к лиду', href: '#' },
    ),
    preset(
      'project_new',
      'Новый проект: {{project.name}}',
      'Новый проект',
      `<p style="margin:0 0 16px;">В CRM создан проект (сделка).</p>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid ${BORDER};border-radius:12px;">
  <tr><td style="padding:12px 16px;background:#f4f4f5;font-size:12px;color:${MUTED};">Название</td><td style="padding:12px 16px;font-weight:600;">{{project.name}}</td></tr>
  <tr><td style="padding:12px 16px;border-top:1px solid ${BORDER};font-size:12px;color:${MUTED};">Статус</td><td style="padding:12px 16px;border-top:1px solid ${BORDER};">{{project.status}}</td></tr>
  <tr><td style="padding:12px 16px;border-top:1px solid ${BORDER};font-size:12px;color:${MUTED};">Сумма</td><td style="padding:12px 16px;border-top:1px solid ${BORDER};">{{project.amount}} {{project.currency}}</td></tr>
</table>`,
      'Новый проект: {{project.name}}\nСтатус: {{project.status}}\nСумма: {{project.amount}} {{project.currency}}',
      { label: 'Открыть проект', href: '#' },
    ),
    preset(
      'sale_new',
      'Фиксация продажи: {{sale.id}}',
      'Новая продажа',
      `<p style="margin:0 0 16px;">Зафиксирована продажа в CRM.</p>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid ${BORDER};border-radius:12px;">
  <tr><td style="padding:12px 16px;background:#f4f4f5;font-size:12px;color:${MUTED};">Сумма</td><td style="padding:12px 16px;font-weight:700;font-size:18px;color:${ACCENT};">{{sale.amount}} {{sale.currency}}</td></tr>
  <tr><td style="padding:12px 16px;border-top:1px solid ${BORDER};font-size:12px;color:${MUTED};">Статус</td><td style="padding:12px 16px;border-top:1px solid ${BORDER};">{{sale.status}}</td></tr>
</table>
<p style="margin:16px 0 0;font-size:14px;color:${MUTED};">При необходимости добавьте ссылку на счёт или акт во вложении в редакторе.</p>`,
      'Новая продажа.\nСумма: {{sale.amount}} {{sale.currency}}\nСтатус: {{sale.status}}',
      { label: 'Подробнее в CRM', href: '#' },
    ),
    preset(
      'client_broadcast',
      'Новости для вас, {{contact.fullName}}',
      'Рассылка клиентам',
      `<p style="margin:0 0 12px;">Здравствуйте, {{contact.fullName}}!</p>
<p style="margin:0 0 16px;">Кратко рассказываем, что изменилось для вас за последнее время (замените этот абзац на свой текст).</p>
<ul style="margin:0;padding-left:20px;color:${TEXT};">
  <li style="margin-bottom:8px;">Пункт 1 — продукт или услуга</li>
  <li style="margin-bottom:8px;">Пункт 2 — выгода или кейс</li>
  <li>Пункт 3 — призыв к действию</li>
</ul>`,
      'Здравствуйте, {{contact.fullName}}!\n\n[Вставьте текст рассылки.]\n\nС уважением,\nВаша команда',
      { label: 'Узнать подробнее', href: '#' },
    ),
    preset(
      'funnel_nurture',
      '{{lead.name}}, продолжим диалог?',
      'Воронка: следующий шаг',
      `<p style="margin:0 0 16px;">Здравствуйте, {{lead.name}}!</p>
<p style="margin:0 0 16px;">Мы заметили ваш интерес и хотим помочь с следующим шагом — выберите удобный вариант или ответьте на это письмо.</p>
<p style="margin:0;padding:14px 16px;background:#f4f4f5;border-radius:12px;border-left:4px solid ${ACCENT};font-size:14px;">
  Здесь можно описать оффер, дедлайн или бонус за ответ до указанной даты.
</p>`,
      'Здравствуйте, {{lead.name}}!\n\nМы хотим помочь с вашим запросом. Ответьте на письмо или перейдите по ссылке из HTML-версии.',
      { label: 'Запланировать звонок', href: '#' },
    ),
    preset(
      'meeting_reminder',
      'Напоминание: встреча с {{lead.name}}',
      'Напоминание о встрече',
      `<p style="margin:0 0 16px;">Здравствуйте!</p>
<p style="margin:0 0 12px;">Напоминаем о запланированной встрече по лиду <strong>{{lead.name}}</strong>.</p>
<p style="margin:0;padding:16px;background:#f4f4f5;border-radius:12px;font-size:14px;">
  Подставьте дату/время и ссылку на видеозвонок вместо этого текста (или используйте переменные из вашего сценария).
</p>`,
      'Напоминание о встрече.\nЛид: {{lead.name}}\nEmail: {{lead.email}}\n\n[Укажите дату и время вручную или через сценарий.]',
      { label: 'Добавить в календарь', href: '#' },
    ),
    preset(
      'thank_you_post_sale',
      'Спасибо за сделку, {{contact.fullName}}!',
      'Благодарность после сделки',
      `<p style="margin:0 0 16px;">Здравствуйте, {{contact.fullName}}!</p>
<p style="margin:0 0 16px;">Спасибо, что выбрали нас. Ниже — краткая сводка; при необходимости добавьте реквизиты и ссылку на оплату.</p>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid ${BORDER};border-radius:12px;">
  <tr><td style="padding:12px 16px;background:#f4f4f5;font-size:12px;color:${MUTED};">Проект / сделка</td><td style="padding:12px 16px;">{{project.name}}</td></tr>
  <tr><td style="padding:12px 16px;border-top:1px solid ${BORDER};font-size:12px;color:${MUTED};">Сумма</td><td style="padding:12px 16px;border-top:1px solid ${BORDER};font-weight:600;">{{project.amount}} {{project.currency}}</td></tr>
</table>`,
      'Спасибо, {{contact.fullName}}!\nМы ценим сотрудничество.\nПроект: {{project.name}}\nСумма: {{project.amount}} {{project.currency}}',
      { label: 'Связаться с менеджером', href: '#' },
    ),
    preset(
      'reactivation',
      'Давно не общались — {{company.name}}',
      'Реактивация',
      `<p style="margin:0 0 16px;">Здравствуйте!</p>
<p style="margin:0 0 16px;">Мы по {{company.name}} давно не получали от вас новостей. Если тема актуальна — ответьте на письмо или нажмите кнопку.</p>
<p style="margin:0;font-size:14px;color:${MUTED};">Персонализируйте текст: добавьте имя контакта ({{contact.fullName}}) и конкретное предложение.</p>`,
      'Здравствуйте!\n\nМы хотели бы возобновить диалог по {{company.name}}.\n\nС уважением,\n[Подпись]',
      { label: 'Хочу продолжить', href: '#' },
    ),
  ];

export function getEmailTemplatePreset(
  id: string,
): EmailTemplatePresetContent | undefined {
  return EMAIL_TEMPLATE_PRESET_CONTENTS.find((p) => p.id === id);
}

export const EMAIL_TEMPLATE_PRESET_IDS: EmailTemplatePresetId[] =
  EMAIL_TEMPLATE_PRESET_CONTENTS.map((p) => p.id);
