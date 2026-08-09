import { randomBytes } from 'crypto';

export const EMBED_TEMPLATE_KEYS = [
  'contact',
  'callback',
  'consultation',
  'quote',
  'support',
  'brief',
  'quiz',
  'booking',
  'reservation',
  'service_request',
  'audit',
] as const;

export type EmbedTemplateKey = (typeof EMBED_TEMPLATE_KEYS)[number];

/** Куда попадает сабмит формы — независимо от косметического templateKey (см. submit() в
 * embed-forms.service.ts). 'lead' — поведение не менялось никогда, остальные три введены для
 * реальных продуктовых форм (Товары/Бронирования/Система резервации), в отличие от тестовой
 * витрины /store на pl1.lumiva-ui. */
export const EMBED_FORM_KINDS = ['lead', 'product_order', 'booking', 'hotel_reservation'] as const;
export type EmbedFormKind = (typeof EMBED_FORM_KINDS)[number];

export type EmbedFieldType =
  | 'text'
  | 'email'
  | 'url'
  | 'tel'
  | 'number'
  | 'date'
  | 'time'
  | 'datetime'
  | 'textarea'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'multi_checkbox'
  | 'hidden'
  | 'utm'
  | 'page_url'
  | 'rating'
  | 'range'
  | 'html'
  | 'divider'
  | 'service'
  | 'specialist'
  | 'guests'
  | 'promo_code'
  | 'file'
  | 'checkbox_consent'
  | 'messaging'
  /** Составные "живые" поля — не простой инпут, а мини-виджет с реальными данными тенанта
   * (каталог/услуги/отели), см. submit()'s kind-branching и PublicEmbedFormPage.tsx. Ровно одно
   * такое поле на форму соответствующего kind. */
  | 'product_cart'
  | 'service_booking'
  | 'hotel_booking';

export interface EmbedFieldConfigItem {
  id: string;
  type: EmbedFieldType;
  /** Ключ в payload и маппинге на лид / meta */
  key: string;
  label: string;
  placeholder?: string;
  helpText?: string;
  required: boolean;
  stepId?: string;
  defaultValue?: string | number | boolean | string[];
  maxLength?: number;
  min?: number;
  max?: number;
  options?: {
    value: string;
    label: string;
    description?: string;
    price?: string | number;
    duration?: string;
    imageUrl?: string;
  }[];
  /** 2 = вся ширина, 1 = половина (два поля в ряд) */
  colSpan?: 1 | 2;
  /** Сообщение валидации (RU) — фронт может подменить i18n */
  validationHint?: string;
  /** Для kind !== 'lead': какое контактное поле это — submit() ищет по role в первую очередь,
   * с фолбэком на key==='name'/'phone'/'email' для устойчивости. */
  role?: 'customer_name' | 'customer_email' | 'customer_phone';
  /** Только для составных полей (product_cart/service_booking/hotel_booking) — сужает список
   * до конкретных категорий/отелей/услуг тенанта; пусто/не задано = показывать всё публичное. */
  sourceFilter?: { categoryIds?: string[]; hotelIds?: string[]; serviceIds?: string[] };
}

export type EmbedFormFieldConfig = {
  fields: EmbedFieldConfigItem[];
  steps?: { id: string; title: string; description?: string }[];
  settings?: Record<string, unknown>;
  display?: Record<string, unknown>;
  logic?: Array<Record<string, unknown>>;
  booking?: Record<string, unknown>;
};

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

const templates: Record<EmbedTemplateKey, { fieldConfig: EmbedFormFieldConfig }> = {
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
  quiz: {
    fieldConfig: {
      steps: [
        { id: 'goal', title: 'Цель' },
        { id: 'details', title: 'Детали' },
        { id: 'contacts', title: 'Контакты' },
      ],
      settings: { showProgress: true, nextText: 'Далее', backText: 'Назад', submitText: 'Получить предложение' },
      fields: [
        { id: mkId('goal_title'), type: 'html', key: 'goal_title', label: 'Подберём решение за 1 минуту', required: false, stepId: 'goal', colSpan: 2 },
        {
          id: mkId('goal'),
          type: 'radio',
          key: 'request_goal',
          label: 'Что нужно сделать?',
          required: true,
          stepId: 'goal',
          colSpan: 2,
          options: [
            { value: 'site', label: 'Сайт / лендинг' },
            { value: 'ads', label: 'Реклама / лиды' },
            { value: 'crm', label: 'CRM / автоматизация' },
            { value: 'consulting', label: 'Консультация' },
          ],
        },
        {
          id: mkId('budget'),
          type: 'select',
          key: 'budget',
          label: 'Ориентировочный бюджет',
          required: false,
          stepId: 'details',
          options: [
            { value: 'under_1000', label: 'До 1 000' },
            { value: '1000_5000', label: '1 000 - 5 000' },
            { value: '5000_plus', label: '5 000+' },
            { value: 'unknown', label: 'Пока не знаю' },
          ],
        },
        { id: mkId('deadline'), type: 'select', key: 'deadline', label: 'Когда нужно запустить?', required: false, stepId: 'details', options: [
          { value: 'asap', label: 'Как можно скорее' },
          { value: 'month', label: 'В течение месяца' },
          { value: 'later', label: 'Позже' },
        ] },
        { id: mkId('name'), type: 'text', key: 'name', label: 'Имя', required: true, stepId: 'contacts', colSpan: 1 },
        { id: mkId('phone'), type: 'tel', key: 'phone', label: 'Телефон / мессенджер', required: true, stepId: 'contacts', colSpan: 1 },
        { id: mkId('email'), type: 'email', key: 'email', label: 'E-mail', required: false, stepId: 'contacts' },
        { id: mkId('consent'), type: 'checkbox_consent', key: 'consent', label: 'Согласие на обработку персональных данных', required: true, stepId: 'contacts' },
      ],
    },
  },
  booking: {
    fieldConfig: {
      steps: [
        { id: 'service', title: 'Услуга' },
        { id: 'time', title: 'Дата и время' },
        { id: 'contacts', title: 'Контакты' },
      ],
      settings: { showProgress: true, nextText: 'Далее', backText: 'Назад', submitText: 'Записаться' },
      fields: [
        { id: mkId('service'), type: 'service', key: 'service', label: 'Услуга', required: true, stepId: 'service', options: [
          { value: 'consultation', label: 'Консультация' },
          { value: 'demo', label: 'Демонстрация' },
          { value: 'audit', label: 'Аудит' },
        ] },
        { id: mkId('specialist'), type: 'specialist', key: 'specialist', label: 'Специалист', required: false, stepId: 'service', options: [
          { value: 'any', label: 'Любой свободный' },
          { value: 'manager', label: 'Менеджер' },
          { value: 'expert', label: 'Эксперт' },
        ] },
        { id: mkId('date'), type: 'date', key: 'booking_date', label: 'Дата', required: true, stepId: 'time', colSpan: 1 },
        { id: mkId('time'), type: 'time', key: 'booking_time', label: 'Время', required: true, stepId: 'time', colSpan: 1 },
        { id: mkId('name'), type: 'text', key: 'name', label: 'Имя', required: true, stepId: 'contacts', colSpan: 1 },
        { id: mkId('phone'), type: 'tel', key: 'phone', label: 'Телефон', required: true, stepId: 'contacts', colSpan: 1 },
        { id: mkId('comment'), type: 'textarea', key: 'comment', label: 'Комментарий', required: false, stepId: 'contacts' },
        { id: mkId('consent'), type: 'checkbox_consent', key: 'consent', label: 'Согласие на обработку персональных данных', required: true, stepId: 'contacts' },
      ],
    },
  },
  reservation: {
    fieldConfig: {
      steps: [
        { id: 'dates', title: 'Даты' },
        { id: 'options', title: 'Параметры' },
        { id: 'contacts', title: 'Контакты' },
      ],
      settings: { showProgress: true, nextText: 'Далее', backText: 'Назад', submitText: 'Забронировать' },
      fields: [
        { id: mkId('start'), type: 'date', key: 'date_from', label: 'Дата начала / заезда', required: true, stepId: 'dates', colSpan: 1 },
        { id: mkId('end'), type: 'date', key: 'date_to', label: 'Дата окончания / выезда', required: false, stepId: 'dates', colSpan: 1 },
        { id: mkId('guests'), type: 'guests', key: 'guests', label: 'Количество гостей', required: true, stepId: 'options', min: 1, max: 50, defaultValue: 1, colSpan: 1 },
        { id: mkId('extras'), type: 'multi_checkbox', key: 'extras', label: 'Дополнительные услуги', required: false, stepId: 'options', options: [
          { value: 'transfer', label: 'Трансфер' },
          { value: 'breakfast', label: 'Завтрак' },
          { value: 'vip', label: 'VIP сопровождение' },
        ] },
        { id: mkId('promo'), type: 'promo_code', key: 'promo_code', label: 'Промокод', required: false, stepId: 'options' },
        { id: mkId('name'), type: 'text', key: 'name', label: 'Имя', required: true, stepId: 'contacts', colSpan: 1 },
        { id: mkId('phone'), type: 'tel', key: 'phone', label: 'Телефон', required: true, stepId: 'contacts', colSpan: 1 },
        { id: mkId('email'), type: 'email', key: 'email', label: 'E-mail', required: false, stepId: 'contacts' },
        { id: mkId('consent'), type: 'checkbox_consent', key: 'consent', label: 'Согласие на обработку персональных данных', required: true, stepId: 'contacts' },
      ],
    },
  },
  service_request: {
    fieldConfig: {
      fields: [
        { id: mkId('service'), type: 'service', key: 'service', label: 'Интересующая услуга', required: true, options: [
          { value: 'seo', label: 'SEO' },
          { value: 'ads', label: 'Реклама' },
          { value: 'crm', label: 'CRM' },
          { value: 'development', label: 'Разработка' },
        ] },
        { id: mkId('website'), type: 'url', key: 'website_url', label: 'Сайт', required: false },
        { id: mkId('message'), type: 'textarea', key: 'message', label: 'Что нужно сделать?', required: true, maxLength: 8000 },
        { id: mkId('name'), type: 'text', key: 'name', label: 'Имя', required: true, colSpan: 1 },
        { id: mkId('phone'), type: 'tel', key: 'phone', label: 'Телефон', required: true, colSpan: 1 },
        { id: mkId('utm'), type: 'utm', key: 'utm_source', label: 'UTM source', required: false },
        { id: mkId('page'), type: 'page_url', key: 'page_url', label: 'Страница заявки', required: false },
        { id: mkId('consent'), type: 'checkbox_consent', key: 'consent', label: 'Согласие на обработку персональных данных', required: true },
      ],
    },
  },
  audit: {
    fieldConfig: {
      fields: [
        { id: mkId('website'), type: 'url', key: 'website_url', label: 'Адрес сайта', required: true },
        { id: mkId('channels'), type: 'multi_checkbox', key: 'channels', label: 'Что проверить?', required: true, options: [
          { value: 'seo', label: 'SEO' },
          { value: 'ads', label: 'Рекламу' },
          { value: 'analytics', label: 'Аналитику' },
          { value: 'ux', label: 'UX / конверсию' },
        ] },
        { id: mkId('budget'), type: 'range', key: 'monthly_budget', label: 'Примерный месячный бюджет', required: false, min: 0, max: 50000, defaultValue: 5000 },
        { id: mkId('name'), type: 'text', key: 'name', label: 'Имя', required: true, colSpan: 1 },
        { id: mkId('email'), type: 'email', key: 'email', label: 'E-mail', required: true, colSpan: 1 },
        { id: mkId('consent'), type: 'checkbox_consent', key: 'consent', label: 'Согласие на обработку персональных данных', required: true },
      ],
    },
  },
};

export function isTemplateKey(s: string): s is EmbedTemplateKey {
  return (EMBED_TEMPLATE_KEYS as readonly string[]).includes(s);
}

export function isFormKind(s: string): s is EmbedFormKind {
  return (EMBED_FORM_KINDS as readonly string[]).includes(s);
}

/** Служебные contact-поля, общие для всех трёх продуктовых kind — по одному экземпляру. */
function contactFields(stepId?: string): EmbedFieldConfigItem[] {
  return [
    { id: mkId('name'), type: 'text', key: 'name', label: 'Имя', required: true, stepId, colSpan: 1, role: 'customer_name' },
    { id: mkId('phone'), type: 'tel', key: 'phone', label: 'Телефон', required: true, stepId, colSpan: 1, role: 'customer_phone' },
    { id: mkId('email'), type: 'email', key: 'email', label: 'E-mail', required: false, stepId, role: 'customer_email' },
    { id: mkId('consent'), type: 'checkbox_consent', key: 'consent', label: 'Согласие на обработку персональных данных', required: true, stepId },
  ];
}

const kindSeeds: Record<Exclude<EmbedFormKind, 'lead'>, { fieldConfig: EmbedFormFieldConfig; templateKey: string }> = {
  product_order: {
    templateKey: 'product_order_widget',
    fieldConfig: {
      settings: { submitText: 'Оформить заказ' },
      fields: [
        { id: mkId('cart'), type: 'product_cart', key: 'cart', label: 'Товары', required: true },
        ...contactFields(),
      ],
    },
  },
  booking: {
    templateKey: 'booking_widget',
    fieldConfig: {
      settings: { submitText: 'Записаться' },
      fields: [
        { id: mkId('booking'), type: 'service_booking', key: 'booking', label: 'Услуга и время', required: true },
        ...contactFields(),
      ],
    },
  },
  hotel_reservation: {
    templateKey: 'hotel_reservation_widget',
    fieldConfig: {
      settings: { submitText: 'Забронировать' },
      fields: [
        { id: mkId('stay'), type: 'hotel_booking', key: 'stay', label: 'Отель и даты', required: true },
        ...contactFields(),
      ],
    },
  },
};

/** Стартовый fieldConfig для kind !== 'lead' — templateKey игнорируется полностью (в отличие от
 * getTemplateFieldConfig, здесь нет выбора пользователем варианта раскладки на этапе создания). */
export function getKindSeedFieldConfig(kind: Exclude<EmbedFormKind, 'lead'>): EmbedFormFieldConfig {
  return JSON.parse(JSON.stringify(kindSeeds[kind].fieldConfig)) as EmbedFormFieldConfig;
}

export function getKindDefaultTemplateKey(kind: Exclude<EmbedFormKind, 'lead'>): string {
  return kindSeeds[kind].templateKey;
}

export function getTemplateFieldConfig(
  key: EmbedTemplateKey,
): EmbedFormFieldConfig {
  // Генерация id при создании с новыми id — клонируем шаблон
  return JSON.parse(JSON.stringify(templates[key].fieldConfig)) as EmbedFormFieldConfig;
}

export function getDefaultDesignClone(): Record<string, unknown> {
  return { ...DEFAULT_DESIGN };
}
