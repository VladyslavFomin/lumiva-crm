// src/media/media.constants.ts
import type { MediaFormField, MediaKind } from './media.entities';

export const MEDIA_MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024; // 2 ГБ на файл
/** Меньше client_max_body_size nginx (32m) с запасом на multipart. */
export const MEDIA_CHUNK_BYTES = 16 * 1024 * 1024;
export const MEDIA_PREVIEW_TTL_SEC = 6 * 60 * 60;
export const MEDIA_TICKET_TTL_SEC = 30 * 60;

const BY_EXT: Record<string, { kind: MediaKind; mime: string }> = {
  jpg: { kind: 'image', mime: 'image/jpeg' },
  jpeg: { kind: 'image', mime: 'image/jpeg' },
  png: { kind: 'image', mime: 'image/png' },
  webp: { kind: 'image', mime: 'image/webp' },
  gif: { kind: 'image', mime: 'image/gif' },
  svg: { kind: 'image', mime: 'image/svg+xml' },
  heic: { kind: 'image', mime: 'image/heic' },
  tif: { kind: 'image', mime: 'image/tiff' },
  tiff: { kind: 'image', mime: 'image/tiff' },
  mp4: { kind: 'video', mime: 'video/mp4' },
  m4v: { kind: 'video', mime: 'video/x-m4v' },
  mov: { kind: 'video', mime: 'video/quicktime' },
  webm: { kind: 'video', mime: 'video/webm' },
  pdf: { kind: 'pdf', mime: 'application/pdf' },
};

export function extOf(name: string): string {
  const m = /\.([a-z0-9]{1,8})$/i.exec(String(name || ''));
  return m ? m[1].toLowerCase() : '';
}

/** Тип определяем по расширению (браузеры шлют пустой/разный mime для mov/heic). */
export function classifyMediaFile(name: string): { kind: MediaKind; mime: string; ext: string } | null {
  const ext = extOf(name);
  const hit = BY_EXT[ext];
  return hit ? { ...hit, ext } : null;
}

type Lang = 'ru' | 'en' | 'tr';
const L = (lang: string | null | undefined): Lang => (lang === 'en' || lang === 'tr' ? lang : 'ru');

const FORM_TEXT: Record<Lang, Record<string, string>> = {
  ru: {
    name: 'Имя и фамилия', namePh: 'Как к вам обращаться', email: 'Рабочая почта', phone: 'Телефон',
    company: 'Компания', companyPh: 'Название компании', role: 'Кто вы',
    roles: 'Туроператор|Пресса|Блогер|Партнёр|Другое', purpose: 'Где будете использовать материалы',
    purposePh: 'Каталог, статья, соцсети…', consent: 'Согласен на обработку персональных данных',
    title: 'Оставьте контакты, чтобы скачать',
  },
  en: {
    name: 'Full name', namePh: 'How should we address you', email: 'Work email', phone: 'Phone',
    company: 'Company', companyPh: 'Company name', role: 'You are',
    roles: 'Tour operator|Press|Blogger|Partner|Other', purpose: 'Where will you use the materials',
    purposePh: 'Catalogue, article, social media…', consent: 'I agree to the processing of my personal data',
    title: 'Leave your contacts to download',
  },
  tr: {
    name: 'Ad soyad', namePh: 'Size nasıl hitap edelim', email: 'İş e-postası', phone: 'Telefon',
    company: 'Şirket', companyPh: 'Şirket adı', role: 'Siz kimsiniz',
    roles: 'Tur operatörü|Basın|Blogger|Partner|Diğer', purpose: 'Materyalleri nerede kullanacaksınız',
    purposePh: 'Katalog, makale, sosyal medya…', consent: 'Kişisel verilerimin işlenmesini kabul ediyorum (KVKK)',
    title: 'İndirmek için iletişim bilgilerinizi bırakın',
  },
};

export function mediaFormDefault(lang?: string | null): MediaFormField[] {
  const t = FORM_TEXT[L(lang)];
  return [
    { id: 'name', label: t.name, type: 'text', ph: t.namePh, on: true, req: true, lock: true },
    { id: 'email', label: t.email, type: 'email', ph: 'name@company.com', on: true, req: true },
    { id: 'phone', label: t.phone, type: 'tel', ph: '+90 5xx xxx xx xx', on: true, req: true },
    { id: 'company', label: t.company, type: 'text', ph: t.companyPh, on: true, req: false },
    { id: 'role', label: t.role, type: 'select', options: t.roles.split('|'), on: true, req: false },
    { id: 'purpose', label: t.purpose, type: 'textarea', ph: t.purposePh, on: false, req: false },
    { id: 'consent', label: t.consent, type: 'check', on: true, req: true },
  ];
}

export function mediaFormTitleDefault(lang?: string | null): string {
  return FORM_TEXT[L(lang)].title;
}


/**
 * Словарь стандартных текстов формы на трёх языках. Подпись, совпадающая с любым вариантом
 * из словаря (на любом языке), считается стандартной и показывается на языке посетителя —
 * так сохранённая на русском форма не остаётся русской у английского клиента.
 */
const EXTRA: Array<Record<Lang, string>> = [
  { ru: 'Турагентство', en: 'Travel agency', tr: 'Seyahat acentesi' },
  { ru: 'Отель', en: 'Hotel', tr: 'Otel' },
  { ru: 'Свадебное агентство', en: 'Wedding agency', tr: 'Düğün ajansı' },
  { ru: 'Фотограф', en: 'Photographer', tr: 'Fotoğrafçı' },
  { ru: 'Согласен на обработку персональных данных (KVKK)', en: 'I agree to the processing of my personal data (KVKK)', tr: 'Kişisel verilerimin işlenmesini kabul ediyorum (KVKK)' },
  { ru: 'Согласен на обработку персональных данных', en: 'I agree to the processing of my personal data', tr: 'Kişisel verilerimin işlenmesini kabul ediyorum' },
];

export const MEDIA_DICT: Array<Record<Lang, string>> = (() => {
  const keys = Object.keys(FORM_TEXT.ru).filter((k) => k !== 'roles');
  const out: Array<Record<Lang, string>> = keys.map((k) => ({ ru: FORM_TEXT.ru[k], en: FORM_TEXT.en[k], tr: FORM_TEXT.tr[k] }));
  const roles = { ru: FORM_TEXT.ru.roles.split('|'), en: FORM_TEXT.en.roles.split('|'), tr: FORM_TEXT.tr.roles.split('|') };
  roles.ru.forEach((_, i) => out.push({ ru: roles.ru[i], en: roles.en[i], tr: roles.tr[i] }));
  return [...out, ...EXTRA];
})();

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** Стандартный текст → на нужный язык; свой текст — без изменений. */
export function mediaAuto(text: string | undefined | null, lang: string | null | undefined): string {
  if (!text) return text || '';
  const n = norm(text);
  const hit = MEDIA_DICT.find((d) => norm(d.ru) === n || norm(d.en) === n || norm(d.tr) === n);
  return hit ? hit[L(lang)] : text;
}

/** Поле формы на языке посетителя: ручной перевод → автоперевод стандартного → как написано. */
export function localizeMediaField(f: MediaFormField, lang: string | null | undefined): MediaFormField {
  const o = f.l10n?.[L(lang)] || {};
  const { l10n: _drop, ...rest } = f;
  void _drop;
  return {
    ...rest,
    label: (o.label && o.label.trim()) || mediaAuto(f.label, lang),
    ph: o.ph !== undefined && o.ph !== '' ? o.ph : mediaAuto(f.ph, lang),
    options: o.options?.length ? o.options : f.options?.map((x) => mediaAuto(x, lang)),
  };
}

export function localizeMediaTitle(title: string | null | undefined, titles: Partial<Record<Lang, string>> | null | undefined, lang: string | null | undefined): string {
  const own = titles?.[L(lang)];
  if (own && own.trim()) return own;
  return mediaAuto(title || mediaFormTitleDefault(lang), lang);
}
