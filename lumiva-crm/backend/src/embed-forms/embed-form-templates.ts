import { randomBytes } from 'crypto';

export const EMBED_TEMPLATE_KEYS = [
  'contact',
  'callback',
  'consultation',
  'quote',
  'support',
  'brief',
] as const;

export type EmbedTemplateKey = (typeof EMBED_TEMPLATE_KEYS)[number];

export type EmbedFieldType =
  | 'text'
  | 'email'
  | 'url'
  | 'tel'
  | 'number'
  | 'date'
  | 'textarea'
  | 'select'
  | 'file'
  | 'checkbox_consent'
  | 'messaging';

export interface EmbedFieldConfigItem {
  id: string;
  type: EmbedFieldType;
  /** Ключ в payload и маппинге на лид / meta */
  key: string;
  label: string;
  placeholder?: string;
  required: boolean;
  maxLength?: number;
  options?: { value: string; label: string }[];
  /** 2 = вся ширина, 1 = половина (два поля в ряд) */
  colSpan?: 1 | 2;
  /** Сообщение валидации (RU) — фронт может подменить i18n */
  validationHint?: string;
}

export const DEFAULT_DESIGN: Record<string, unknown> = {
  fontFamily:
    'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontSizePx: 15,
  headingSizePx: 20,
  textColor: '#111827',
  backgroundColor: '#ffffff',
  fieldBackground: '#f9fafb',
  borderColor: '#e5e7eb',
  borderRadiusPx: 10,
  fieldPaddingPx: 12,
  gapPx: 12,
  buttonBackground: '#111827',
  buttonTextColor: '#ffffff',
  buttonPaddingXPx: 20,
  buttonPaddingYPx: 12,
  buttonBorderRadiusPx: 10,
  buttonFontWeight: 600,
  buttonWidth: 'full',
  accentColor: '#2563eb',
  labelWeight: 600,
  /** Отступы «от края iframe» к контенту (px), по умолчанию 0 — без лишнего зазора. */
  formOuterPadXPx: 0,
  formOuterPadYPx: 0,
  /** 0 = на всю ширину контейнера, иначе max-width (px, как ex max-w-lg ≈ 512). */
  formMaxWidthPx: 512,
};

const mkId = (n: string) => `f_${n}_${randomBytes(3).toString('hex')}`;

const templates: Record<EmbedTemplateKey, { fieldConfig: { fields: EmbedFieldConfigItem[] } }> = {
  contact: {
    fieldConfig: {
      fields: [
        {
          id: mkId('name'),
          type: 'text',
          key: 'name',
          label: 'Имя',
          placeholder: 'Как к вам обращаться',
          required: true,
          maxLength: 120,
        },
        {
          id: mkId('email'),
          type: 'email',
          key: 'email',
          label: 'E-mail',
          placeholder: 'name@company.com',
          required: true,
          maxLength: 254,
        },
        {
          id: mkId('phone'),
          type: 'tel',
          key: 'phone',
          label: 'Телефон',
          placeholder: '+7 …',
          required: false,
          maxLength: 40,
        },
        {
          id: mkId('message'),
          type: 'textarea',
          key: 'message',
          label: 'Сообщение',
          placeholder: 'Кратко опишите обращение',
          required: true,
          maxLength: 4000,
        },
        {
          id: mkId('consent'),
          type: 'checkbox_consent',
          key: 'consent',
          label: 'Согласие на обработку персональных данных',
          required: true,
        },
      ],
    },
  },
  callback: {
    fieldConfig: {
      fields: [
        {
          id: mkId('name'),
          type: 'text',
          key: 'name',
          label: 'Имя',
          placeholder: 'Ваше имя',
          required: true,
          maxLength: 120,
        },
        {
          id: mkId('phone'),
          type: 'tel',
          key: 'phone',
          label: 'Телефон для звонка',
          placeholder: '+7 …',
          required: true,
          maxLength: 40,
        },
        {
          id: mkId('time'),
          type: 'select',
          key: 'callback_time',
          label: 'Когда удобно',
          required: false,
          options: [
            { value: 'now', label: 'Как можно скорее' },
            { value: 'morning', label: 'Утро' },
            { value: 'afternoon', label: 'День' },
            { value: 'evening', label: 'Вечер' },
          ],
        },
        {
          id: mkId('consent'),
          type: 'checkbox_consent',
          key: 'consent',
          label: 'Согласие на обработку персональных данных',
          required: true,
        },
      ],
    },
  },
  consultation: {
    fieldConfig: {
      fields: [
        {
          id: mkId('name'),
          type: 'text',
          key: 'name',
          label: 'Имя',
          required: true,
          maxLength: 120,
        },
        {
          id: mkId('email'),
          type: 'email',
          key: 'email',
          label: 'E-mail',
          required: true,
        },
        {
          id: mkId('phone'),
          type: 'tel',
          key: 'phone',
          label: 'Телефон',
          required: true,
        },
        {
          id: mkId('company'),
          type: 'text',
          key: 'company',
          label: 'Компания / проект',
          required: false,
          maxLength: 200,
        },
        {
          id: mkId('message'),
          type: 'textarea',
          key: 'message',
          label: 'Запрос / контекст',
          required: true,
          maxLength: 4000,
        },
        {
          id: mkId('consent'),
          type: 'checkbox_consent',
          key: 'consent',
          label: 'Согласие на обработку персональных данных',
          required: true,
        },
      ],
    },
  },
  quote: {
    fieldConfig: {
      fields: [
        {
          id: mkId('name'),
          type: 'text',
          key: 'name',
          label: 'Контактное лицо',
          required: true,
        },
        {
          id: mkId('email'),
          type: 'email',
          key: 'email',
          label: 'E-mail',
          required: true,
        },
        {
          id: mkId('phone'),
          type: 'tel',
          key: 'phone',
          label: 'Телефон',
          required: true,
        },
        {
          id: mkId('company'),
          type: 'text',
          key: 'company',
          label: 'Компания',
          required: true,
        },
        {
          id: mkId('volume'),
          type: 'text',
          key: 'volume',
          label: 'Объём / бюджет (опционально)',
          required: false,
        },
        {
          id: mkId('message'),
          type: 'textarea',
          key: 'message',
          label: 'Задача / ТЗ',
          required: true,
          maxLength: 8000,
        },
        {
          id: mkId('file'),
          type: 'file',
          key: 'attachment',
          label: 'Бриф / файл (PDF, DOC, DOCX)',
          required: false,
        },
        {
          id: mkId('consent'),
          type: 'checkbox_consent',
          key: 'consent',
          label: 'Согласие на обработку персональных данных',
          required: true,
        },
      ],
    },
  },
  support: {
    fieldConfig: {
      fields: [
        {
          id: mkId('name'),
          type: 'text',
          key: 'name',
          label: 'Имя',
          required: true,
        },
        {
          id: mkId('email'),
          type: 'email',
          key: 'email',
          label: 'E-mail',
          required: true,
        },
        {
          id: mkId('topic'),
          type: 'text',
          key: 'topic',
          label: 'Тема',
          required: true,
        },
        {
          id: mkId('message'),
          type: 'textarea',
          key: 'message',
          label: 'Описание проблемы',
          required: true,
          maxLength: 8000,
        },
        {
          id: mkId('messaging'),
          type: 'messaging',
          key: 'messaging_app',
          label: 'Связь в мессенджере (если удобно)',
          required: false,
        },
        {
          id: mkId('consent'),
          type: 'checkbox_consent',
          key: 'consent',
          label: 'Согласие на обработку персональных данных',
          required: true,
        },
      ],
    },
  },
  brief: {
    fieldConfig: {
      fields: [
        {
          id: mkId('name'),
          type: 'text',
          key: 'name',
          label: 'Имя / роль',
          required: true,
        },
        {
          id: mkId('email'),
          type: 'email',
          key: 'email',
          label: 'E-mail',
          required: true,
        },
        {
          id: mkId('phone'),
          type: 'tel',
          key: 'phone',
          label: 'Телефон / Telegram @username',
          required: false,
        },
        {
          id: mkId('deadline'),
          type: 'text',
          key: 'deadline',
          label: 'Сроки',
          required: false,
        },
        {
          id: mkId('message'),
          type: 'textarea',
          key: 'message',
          label: 'Бриф, ссылки, ожидания',
          required: true,
          maxLength: 12000,
        },
        {
          id: mkId('file'),
          type: 'file',
          key: 'attachment',
          label: 'Материалы (PDF, DOC, DOCX)',
          required: false,
        },
        {
          id: mkId('consent'),
          type: 'checkbox_consent',
          key: 'consent',
          label: 'Согласие на обработку персональных данных',
          required: true,
        },
      ],
    },
  },
};

export function isTemplateKey(s: string): s is EmbedTemplateKey {
  return (EMBED_TEMPLATE_KEYS as readonly string[]).includes(s);
}

export function getTemplateFieldConfig(
  key: EmbedTemplateKey,
): { fields: EmbedFieldConfigItem[] } {
  // Генерация id при создании с новыми id — клонируем шаблон
  return JSON.parse(JSON.stringify(templates[key].fieldConfig)) as {
    fields: EmbedFieldConfigItem[];
  };
}

export function getDefaultDesignClone(): Record<string, unknown> {
  return { ...DEFAULT_DESIGN };
}
