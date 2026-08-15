import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { fetchSites, type Site } from '../../api/sites';
import { fetchProductCategories, type ProductCategory } from '../../api/products';
import { fetchHotels, type Hotel } from '../../api/hotels';
import { fetchBookingServices, type BookingServiceItem } from '../../api/bookings';
import {
  createEmbedForm,
  fetchEmbedForm,
  fetchEmbedTemplateList,
  postEmbedPreviewToken,
  updateEmbedForm,
  EMBED_FORM_KINDS,
  type EmbedFieldConfigItem,
  type EmbedFieldType,
  type EmbedFormKind,
  type EmbedFormRow,
} from '../../api/embedForms';
import { withTimeout, DEFAULT_FETCH_TIMEOUT_MS } from '../../utils/withTimeout';
import './WebForms.css';
import { EmbedSwitch } from './embed-editor/EmbedSwitch';
import { EmbedColorField } from './embed-editor/EmbedColorField';
import { EmbedDesignPreview } from './embed-editor/EmbedDesignPreview';

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
  formOuterPadXPx: 0,
  formOuterPadYPx: 0,
  formMaxWidthPx: 512,
};

type Tab = 'content' | 'fields' | 'steps' | 'logic' | 'booking' | 'design' | 'install';
type EmbedStep = { id: string; title: string; description?: string };
type LogicRule = {
  id: string;
  fieldId: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_empty' | 'empty';
  value?: string;
  action: 'show_field' | 'hide_field';
  targetFieldId: string;
};

export const ADDABLE_FIELD_TYPES: EmbedFieldType[] = [
  'text',
  'email',
  'url',
  'tel',
  'number',
  'date',
  'time',
  'datetime',
  'textarea',
  'select',
  'radio',
  'checkbox',
  'multi_checkbox',
  'service',
  'specialist',
  'guests',
  'promo_code',
  'rating',
  'range',
  'html',
  'divider',
  'hidden',
  'utm',
  'page_url',
  'file',
  'checkbox_consent',
  'messaging',
];

export const FIELD_TYPE_LABELS: Record<EmbedFieldType, string> = {
  text: 'Текст',
  email: 'E-mail',
  url: 'URL',
  tel: 'Телефон',
  number: 'Число',
  date: 'Дата',
  time: 'Время',
  datetime: 'Дата и время',
  textarea: 'Большой текст',
  select: 'Список',
  radio: 'Radio',
  checkbox: 'Чекбокс',
  multi_checkbox: 'Мультивыбор',
  hidden: 'Hidden',
  utm: 'UTM',
  page_url: 'URL страницы',
  rating: 'Рейтинг',
  range: 'Слайдер',
  html: 'Текстовый блок',
  divider: 'Разделитель',
  service: 'Услуга',
  specialist: 'Специалист',
  guests: 'Гости',
  promo_code: 'Промокод',
  file: 'Файл',
  checkbox_consent: 'Согласие',
  messaging: 'Мессенджер',
  product_cart: 'Товары (корзина)',
  service_booking: 'Услуга и время',
  hotel_booking: 'Отель и даты',
};

export const KIND_META: Record<EmbedFormKind, { label: string; description: string; fieldType?: EmbedFieldType; fieldLabel?: string }> = {
  lead: { label: 'Заявка (лид)', description: 'Классическая форма — заполненные поля попадают в CRM как лид.' },
  product_order: {
    label: 'Заказ товаров',
    description: 'Клиент выбирает товары из вашего каталога — заказ попадает в Продажи.',
    fieldType: 'product_cart',
    fieldLabel: 'Товары',
  },
  booking: {
    label: 'Запись на услугу',
    description: 'Клиент выбирает услугу и время — заявка попадает в Бронирования.',
    fieldType: 'service_booking',
    fieldLabel: 'Услуга и время',
  },
  hotel_reservation: {
    label: 'Бронирование отеля',
    description: 'Клиент выбирает отель, номер и даты — бронь попадает в Систему резервации.',
    fieldType: 'hotel_booking',
    fieldLabel: 'Отель и даты',
  },
};

export const TEMPLATE_LABELS: Record<string, string> = {
  contact: 'Форма обращения',
  callback: 'Обратный звонок',
  consultation: 'Консультация',
  quote: 'Коммерческое предложение',
  support: 'Техподдержка',
  brief: 'Бриф',
  quiz: 'Квиз / подбор услуги',
  booking: 'Запись на услугу',
  reservation: 'Бронирование',
  service_request: 'Заявка на услугу',
  audit: 'Аудит сайта / маркетинга',
};

export const TEMPLATE_META: Record<string, { description: string; badge: string }> = {
  contact: { badge: 'Lead', description: 'Классическая заявка с именем, контактами и сообщением.' },
  callback: { badge: 'Call', description: 'Быстрая форма обратного звонка с выбором удобного времени.' },
  consultation: { badge: 'Sales', description: 'Запрос консультации для услуг, CRM, разработки и маркетинга.' },
  quote: { badge: 'B2B', description: 'Запрос коммерческого предложения с компанией и ТЗ.' },
  support: { badge: 'Helpdesk', description: 'Обращение в поддержку с темой, описанием и каналом связи.' },
  brief: { badge: 'Brief', description: 'Расширенный бриф с файлами и подробным описанием задачи.' },
  quiz: { badge: 'Quiz', description: 'Многошаговый квиз для подбора услуги и сегментации лида.' },
  booking: { badge: 'Booking', description: 'Запись на услугу с выбором специалиста, даты и времени.' },
  reservation: { badge: 'Reserve', description: 'Бронирование с датами, гостями, опциями и промокодом.' },
  service_request: { badge: 'Service', description: 'Заявка на конкретную услугу с UTM и URL страницы.' },
  audit: { badge: 'Audit', description: 'Заявка на аудит сайта, рекламы, аналитики или UX.' },
};

export const VISUAL_PRESETS: Array<{
  key: string;
  name: string;
  description: string;
  patch: Record<string, unknown>;
}> = [
  {
    key: 'classic',
    name: 'Classic',
    description: 'Чистая универсальная форма.',
    patch: {
      visualPreset: 'classic',
      backgroundColor: '#ffffff',
      textColor: '#111827',
      fieldBackground: '#f9fafb',
      borderColor: '#e5e7eb',
      buttonBackground: '#111827',
      buttonTextColor: '#ffffff',
      accentColor: '#2563eb',
      optionStyle: 'cards',
      headerStyle: 'plain',
    },
  },
  {
    key: 'spa',
    name: 'Spa / Wellness',
    description: 'Мягкий зелёный стиль для записи и услуг.',
    patch: {
      visualPreset: 'spa',
      backgroundColor: '#ffffff',
      textColor: '#405f57',
      fieldBackground: '#eef7f2',
      borderColor: '#dbe8e1',
      buttonBackground: '#48685f',
      buttonTextColor: '#ffffff',
      accentColor: '#5fa898',
      optionStyle: 'list',
      headerStyle: 'band',
      headerBackground: '#48685f',
      headerTextColor: '#ffffff',
    },
  },
  {
    key: 'hotel',
    name: 'Hotel Booking',
    description: 'Премиальный стиль резервации.',
    patch: {
      visualPreset: 'hotel',
      backgroundColor: '#ffffff',
      textColor: '#102a43',
      fieldBackground: '#ffffff',
      borderColor: '#d9e2ec',
      buttonBackground: '#0f2a44',
      buttonTextColor: '#ffffff',
      accentColor: '#1d6580',
      optionStyle: 'list',
      headerStyle: 'plain',
      fontFamily: 'Georgia, "Times New Roman", serif',
    },
  },
  {
    key: 'dark',
    name: 'Dark Popup',
    description: 'Контрастный popup для лид-форм.',
    patch: {
      visualPreset: 'dark',
      backgroundColor: '#111827',
      textColor: '#f8fafc',
      fieldBackground: '#1f2937',
      borderColor: '#374151',
      buttonBackground: '#60a5fa',
      buttonTextColor: '#08111f',
      accentColor: '#93c5fd',
      optionStyle: 'cards',
      headerStyle: 'plain',
    },
  },
];

function newFieldId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `f_${crypto.randomUUID()}`;
  }
  return `f_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function designNum(
  d: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  const v = Number(d[key]);
  return Number.isFinite(v) ? v : fallback;
}

export const WebFormEditorPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { formId } = useParams<{ formId: string }>();
  const [searchParams] = useSearchParams();
  const isNew = formId === 'new';
  /** Редактирование: есть id, и это не маршрут /new. Без id не крутим вечный лоадер. */
  const isEdit = Boolean(formId && !isNew);

  const [sites, setSites] = useState<Site[]>([]);
  const [templateKeys, setTemplateKeys] = useState<string[]>([]);
  const [productCategories, setProductCategories] = useState<ProductCategory[]>([]);
  const [hotelsList, setHotelsList] = useState<Hotel[]>([]);
  const [bookingServicesList, setBookingServicesList] = useState<BookingServiceItem[]>([]);
  const [createSiteId, setCreateSiteId] = useState('');
  const [createTemplate, setCreateTemplate] = useState('contact');
  const [createKind, setCreateKind] = useState<EmbedFormKind>(() => {
    const k = searchParams.get('kind');
    return k && (EMBED_FORM_KINDS as readonly string[]).includes(k) ? (k as EmbedFormKind) : 'lead';
  });
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);

  const [row, setRow] = useState<EmbedFormRow | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('content');
  const [name, setName] = useState('');
  const [published, setPublished] = useState(false);
  const [fieldConfig, setFieldConfig] = useState<{
    fields: EmbedFieldConfigItem[];
    steps?: EmbedStep[];
    settings?: Record<string, unknown>;
    display?: Record<string, unknown>;
    logic?: LogicRule[];
    booking?: Record<string, unknown>;
  }>({
    fields: [],
  });
  const [design, setDesign] = useState<Record<string, unknown>>({ ...DEFAULT_DESIGN });
  const [successMessage, setSuccessMessage] = useState('');
  const [privacyPolicyUrl, setPrivacyPolicyUrl] = useState('');

  const load = useCallback(async () => {
    if (!formId || isNew) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const f = await withTimeout(
        fetchEmbedForm(formId),
        DEFAULT_FETCH_TIMEOUT_MS,
        'embed form',
      );
      setRow(f);
      setName(f.name);
      setPublished(f.published);
      setFieldConfig(f.fieldConfig as {
        fields: EmbedFieldConfigItem[];
        steps?: EmbedStep[];
        settings?: Record<string, unknown>;
        display?: Record<string, unknown>;
        logic?: LogicRule[];
        booking?: Record<string, unknown>;
      });
      setDesign({ ...DEFAULT_DESIGN, ...(f.design || {}) });
      setSuccessMessage(f.successMessage || '');
      setPrivacyPolicyUrl(f.privacyPolicyUrl || '');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message.trim() : '';
      setError(msg || t('crm.embedForms.editor.loadError'));
    } finally {
      setLoading(false);
    }
  }, [formId, isNew, t]);

  useEffect(() => {
    fetchSites()
      .then((s) => {
        setSites(s);
        if (s.length && !createSiteId) setCreateSiteId(s[0].id);
      })
      .catch(() => {
        // ignore
      });
    fetchEmbedTemplateList()
      .then((r) => setTemplateKeys(r.items.map((i) => i.key)))
      .catch(() => {
        // ignore
      });
    // Для sourceFilter составных полей (product_cart/service_booking/hotel_booking) — не
    // критично, если модуль не подключён тенанту, тогда просто пустой список без ошибок в UI.
    fetchProductCategories().then(setProductCategories).catch(() => {});
    fetchHotels().then(setHotelsList).catch(() => {});
    fetchBookingServices().then(setBookingServicesList).catch(() => {});
  }, [createSiteId]);

  useEffect(() => {
    if (isNew) {
      setLoading(false);
      return;
    }
    load();
  }, [isNew, load]);

  const updateField = (id: string, patch: Partial<EmbedFieldConfigItem>) => {
    setFieldConfig((fc) => ({
      ...fc,
      fields: fc.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }));
  };

  const setDesignK = (key: string, v: string | number) => {
    setDesign((d) => ({ ...d, [key]: v }));
  };

  const setFieldConfigSection = (section: 'settings' | 'display' | 'booking', key: string, value: unknown) => {
    setFieldConfig((fc) => ({
      ...fc,
      [section]: { ...(fc[section] || {}), [key]: value },
    }));
  };

  const parseOptionLines = (value: unknown) => String(value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [rawValue, rawLabel, rawPrice, rawDescription, rawImage] = line.split('|');
      const optionValue = rawValue.trim();
      return {
        value: optionValue,
        label: rawLabel?.trim() || optionValue,
        price: rawPrice?.trim() || undefined,
        description: rawDescription?.trim() || undefined,
        imageUrl: rawImage?.trim() || undefined,
      };
    });

  const syncBookingOptions = (fieldType: 'service' | 'specialist', raw: string) => {
    const options = parseOptionLines(raw);
    setFieldConfig((fc) => ({
      ...fc,
      fields: fc.fields.map((field) => field.type === fieldType ? { ...field, options } : field),
      booking: {
        ...(fc.booking || {}),
        [fieldType === 'service' ? 'servicesText' : 'specialistsText']: raw,
      },
    }));
  };

  const addFieldOfType = (type: EmbedFieldType) => {
    setFieldConfig((fc) => {
      const used = new Set(fc.fields.map((f) => f.key));
      const keySeed =
        type === 'checkbox_consent' ? 'consent' : type === 'page_url' ? 'page_url' : type;
      let key: string = keySeed;
      let n = 1;
      while (used.has(key)) {
        key = `${keySeed}_${n++}`;
      }
      const id = newFieldId();
      const defLabel = FIELD_TYPE_LABELS[type] || t(`crm.embedForms.fieldPaletteLabels.${type}`);
      const optionTypes: EmbedFieldType[] = ['select', 'radio', 'multi_checkbox', 'service', 'specialist'];
      const next: EmbedFieldConfigItem = {
        id,
        type,
        key,
        label: defLabel,
        colSpan: 2,
        required: type === 'checkbox_consent',
        options:
          optionTypes.includes(type)
            ? [
                { value: 'opt1', label: t('crm.embedForms.selectOpt1') },
                { value: 'opt2', label: t('crm.embedForms.selectOpt2') },
              ]
            : undefined,
      };
      if (type === 'range') {
        next.min = 0;
        next.max = 100;
        next.defaultValue = 50;
      }
      if (type === 'guests') {
        next.min = 1;
        next.max = 20;
        next.defaultValue = 1;
      }
      if (type === 'messaging') {
        next.required = false;
      }
      return { ...fc, fields: [...fc.fields, next] };
    });
  };

  const addKindField = (fieldType: EmbedFieldType, label: string) => {
    setFieldConfig((fc) => {
      const used = new Set(fc.fields.map((f) => f.key));
      let key = fieldType === 'product_cart' ? 'cart' : fieldType === 'service_booking' ? 'booking' : 'stay';
      let n = 1;
      while (used.has(key)) key = `${key}_${n++}`;
      const next: EmbedFieldConfigItem = { id: newFieldId(), type: fieldType, key, label, required: true, colSpan: 2 };
      return { ...fc, fields: [next, ...fc.fields] };
    });
  };

  const removeField = (id: string) => {
    if (fieldConfig.fields.length < 2) {
      return;
    }
    setFieldConfig((fc) => ({
      ...fc,
      fields: fc.fields.filter((f) => f.id !== id),
    }));
  };

  const moveField = (id: string, dir: -1 | 1) => {
    setFieldConfig((fc) => {
      const i = fc.fields.findIndex((f) => f.id === id);
      if (i < 0) return fc;
      const j = i + dir;
      if (j < 0 || j >= fc.fields.length) return fc;
      const fields = [...fc.fields];
      [fields[i], fields[j]] = [fields[j], fields[i]];
      return { ...fc, fields };
    });
  };

  const save = async () => {
    if (!row) return;
    setSaving(true);
    setError(null);
    try {
      const u = await updateEmbedForm(row.id, {
        name: name.trim(),
        published,
        fieldConfig: fieldConfig as unknown as Record<string, unknown>,
        design,
        successMessage: successMessage.trim() || null,
        privacyPolicyUrl: privacyPolicyUrl.trim() || null,
      });
      setRow(u);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('crm.embedForms.editor.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const create = async () => {
    if (!createSiteId || !createName.trim()) {
      setError(t('crm.embedForms.create.validation'));
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const f = await createEmbedForm({
        siteId: createSiteId,
        templateKey: createKind === 'lead' ? createTemplate : undefined,
        kind: createKind,
        name: createName.trim(),
      });
      navigate(`/web-forms/${f.id}`, { replace: true });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('crm.embedForms.create.error'));
    } finally {
      setCreating(false);
    }
  };

  const embedPageUrl = useMemo(() => {
    if (typeof window === 'undefined' || !row) return '';
    return `${window.location.origin}/embed/${row.publicId}`;
  }, [row]);

  const iframeCode = useMemo(() => {
    if (!row) return '';
    return `<iframe id="lumiva-form-${row.publicId}" title="${row.name}" src="${embedPageUrl}" width="100%" height="700" style="border:0;width:100%" loading="lazy"></iframe>
<script>
  window.addEventListener('message', function(event) {
    if (!event.data || event.data.type !== 'lumiva-form-resize' || event.data.publicId !== '${row.publicId}') return;
    var iframe = document.getElementById('lumiva-form-${row.publicId}');
    if (iframe && event.data.height) iframe.style.height = event.data.height + 'px';
  });
</script>`;
  }, [row, embedPageUrl]);

  const popupCode = useMemo(() => {
    if (!row) return '';
    const display = fieldConfig.display || {};
    const buttonText = String(display.popupButtonText || 'Оставить заявку');
    const width = String(display.popupWidthPx || 760);
    const blur = display.popupBlur === false ? '0' : '1';
    return `<button type="button" data-lumiva-form="${row.publicId}" data-lumiva-width="${width}" data-lumiva-blur="${blur}">${buttonText}</button>
<script src="${window.location.origin}/forms/widget.js" async></script>`;
  }, [row, fieldConfig.display]);

  const floatingCode = useMemo(() => {
    if (!row) return '';
    const display = fieldConfig.display || {};
    return `<script src="${window.location.origin}/forms/widget.js" async data-lumiva-floating="${row.publicId}" data-lumiva-label="${String(display.floatingLabel || 'Оставить заявку')}" data-lumiva-position="${String(display.floatingPosition || 'right-bottom')}" data-lumiva-delay="${String(display.floatingDelaySec || 0)}"></script>`;
  }, [row, fieldConfig.display]);

  const openPreview = async () => {
    if (!row) return;
    const previewWindow = window.open('', '_blank');
    if (!previewWindow) {
      setError('Браузер заблокировал новое окно. Разрешите pop-up для CRM и попробуйте ещё раз.');
      return;
    }
    previewWindow.document.write('<!doctype html><title>Preview</title><body style="font-family:system-ui;padding:24px;color:#222">Loading preview...</body>');
    setSaving(true);
    setError(null);
    try {
      const saved = await updateEmbedForm(row.id, {
        name: name.trim(),
        published,
        fieldConfig: fieldConfig as unknown as Record<string, unknown>,
        design,
        successMessage: successMessage.trim() || null,
        privacyPolicyUrl: privacyPolicyUrl.trim() || null,
      });
      setRow(saved);
      const { token } = await postEmbedPreviewToken(saved.id);
      const u = new URL(`${window.location.origin}/embed/${saved.publicId}`);
      u.searchParams.set('preview', '1');
      u.searchParams.set('pt', token);
      previewWindow.location.href = u.toString();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t('crm.embedForms.editor.saveError');
      setError(message);
      previewWindow.document.body.innerHTML = `<pre style="white-space:pre-wrap;color:#b91c1c;font-family:system-ui">${message.replace(/[<>&]/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[ch] || ch))}</pre>`;
    } finally {
      setSaving(false);
    }
  };

  if (isNew) {
    return (
      <MainLayout>
        <div className="lv-embed-page w-full min-w-0 max-w-none px-2 sm:px-4 md:px-6 lg:px-8 py-6 md:py-8 pb-16">
          <div className="lv-embed-setup">
            <button type="button" onClick={() => navigate('/web-forms')} className="lv-embed-back">
              ← {t('crm.embedForms.create.back')}
            </button>
            <div className="lv-embed-kicker"><span className="dot" />{t('crm.embedForms.kicker')}</div>
            <h1>{t('crm.embedForms.create.title')}</h1>
            <p className="lv-embed-sub" style={{ marginTop: 6 }}>{t('crm.embedForms.create.hint')}</p>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm px-3 py-2 mt-4">
                {error}
              </div>
            )}

            <div className="lv-embed-setup-card">
              <div className="lv-embed-field">
                <label className="lv-embed-lbl">{t('crm.embedForms.create.name')}</label>
                <input
                  className="lv-embed-inp max-w-none"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder={t('crm.embedForms.create.namePh')}
                />
              </div>
              <div className="lv-embed-field">
                <label className="lv-embed-lbl">{t('crm.embedForms.create.site')}</label>
                <select
                  className="lv-embed-inp max-w-none"
                  value={createSiteId}
                  onChange={(e) => setCreateSiteId(e.target.value)}
                >
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name || s.domain}
                    </option>
                  ))}
                </select>
                {!sites.length && (
                  <p className="text-xs text-amber-700 mt-1">{t('crm.embedForms.create.noSites')}</p>
                )}
              </div>
              <div className="lv-embed-field">
                <label className="lv-embed-lbl">{t('crm.embedForms.create.kind')}</label>
                <div className="lv-embed-kind-pick">
                  {EMBED_FORM_KINDS.map((k) => {
                    const meta = KIND_META[k];
                    return (
                      <div
                        key={k}
                        className={'lv-embed-pick-card' + (createKind === k ? ' is-active' : '')}
                        onClick={() => setCreateKind(k)}
                      >
                        <div className="nm">{meta.label}</div>
                        <div className="desc">{meta.description}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {createKind === 'lead' && (
                <div className="lv-embed-field">
                  <label className="lv-embed-lbl">{t('crm.embedForms.create.template')}</label>
                  <div className="lv-embed-tpl-pick">
                    {templateKeys.map((k) => {
                      const meta = TEMPLATE_META[k] || { badge: 'Form', description: 'Готовый шаблон формы для сайта.' };
                      return (
                        <div
                          key={k}
                          className={'lv-embed-tpl-card' + (createTemplate === k ? ' is-active' : '')}
                          onClick={() => setCreateTemplate(k)}
                        >
                          <div className="lv-embed-tpl-top">
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{TEMPLATE_LABELS[k] || t(`crm.embedForms.templates.${k}`)}</div>
                            <span className="lv-embed-tpl-badge">{meta.badge}</span>
                          </div>
                          <div className="desc">{meta.description}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="lv-embed-setup-actions">
                <button
                  type="button"
                  disabled={creating || !sites.length}
                  onClick={create}
                  className="lv-embed-btn lv-embed-btn--primary"
                >
                  {creating ? t('crm.embedForms.create.creating') : t('crm.embedForms.create.submit')}
                </button>
                <button type="button" onClick={() => navigate('/web-forms')} className="lv-embed-btn">
                  {t('crm.embedForms.create.back')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="p-8 text-slate-600 text-sm">{t('crm.embedForms.editor.loading')}</div>
      </MainLayout>
    );
  }

  if (!row) {
    return (
      <MainLayout>
        <div className="w-full min-w-0 max-w-lg px-4 py-8">
          <p className="text-rose-700 text-sm">
            {error || t('crm.embedForms.editor.notFound')}
          </p>
          <p className="text-slate-500 text-sm mt-2">
            {t('crm.embedForms.editor.notFoundHint')}
          </p>
          <button
            type="button"
            onClick={() => navigate('/web-forms')}
            className="mt-4 text-sm font-semibold text-slate-700 hover:text-[#222] underline"
          >
            {t('crm.embedForms.editor.backList')}
          </button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="lv-embed-page w-full min-w-0 max-w-none px-2 sm:px-4 md:px-6 lg:px-8 py-6 md:py-8 pb-20">
        <div className="lv-embed-head">
          <div>
            <button
              type="button"
              onClick={() => navigate('/web-forms')}
              className="lv-embed-back"
            >
              ← {t('crm.embedForms.editor.backList')}
            </button>
            <h1>{t('crm.embedForms.editor.title')}</h1>
            <p className="lv-embed-sub">
              {t('crm.embedForms.editor.subtitle', { publicId: row.publicId })}
            </p>
          </div>
          <div className="lv-embed-head-actions">
            <EmbedSwitch
              checked={published}
              onChange={setPublished}
              label={t('crm.embedForms.editor.published')}
              id="embed-published"
            />
            <button type="button" onClick={openPreview} className="lv-embed-btn">
              {t('crm.embedForms.editor.preview')}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={save}
              className="lv-embed-btn lv-embed-btn--primary"
            >
              {saving ? t('crm.embedForms.editor.saving') : t('crm.embedForms.editor.save')}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm px-3 py-2 mb-4">
            {error}
          </div>
        )}

        <div className="lv-embed-tabs">
          {(['content', 'fields', 'steps', 'logic', 'booking', 'design', 'install'] as Tab[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={'lv-embed-tab' + (tab === k ? ' is-active' : '')}
            >
              {{
                content: 'Основное',
                fields: 'Поля',
                steps: 'Шаги',
                logic: 'Логика',
                booking: 'Запись / бронирование',
                design: t('crm.embedForms.editor.tab.design'),
                install: t('crm.embedForms.editor.tab.install'),
              }[k]}
            </button>
          ))}
        </div>

        {tab === 'content' && (
          <div className="lv-embed-card space-y-5">
            <div className="lv-embed-sec">
              <h2 className="lv-embed-sec-title">{t('crm.embedForms.editorUi.formSettings')}</h2>
              <div>
                <span className="lv-embed-lbl">{t('crm.embedForms.editor.internalName')}</span>
                <input
                  className="lv-embed-inp"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <span className="lv-embed-lbl">{t('crm.embedFields.successMessage')}</span>
                <input
                  className="lv-embed-inp"
                  value={successMessage}
                  onChange={(e) => setSuccessMessage(e.target.value)}
                  placeholder={t('crm.embedFields.successMessagePh')}
                />
              </div>
              <div>
                <span className="lv-embed-lbl">{t('crm.embedFields.privacyUrl')}</span>
                <input
                  className="lv-embed-inp"
                  value={privacyPolicyUrl}
                  onChange={(e) => setPrivacyPolicyUrl(e.target.value)}
                  placeholder="https://"
                />
              </div>
            </div>
          </div>
        )}

        {tab === 'fields' && (
          <div className="lv-embed-card space-y-5">
            <div className="lv-embed-sec">
              <h2 className="lv-embed-sec-title">{t('crm.embedFields.fieldsTitle')}</h2>
              <p className="lv-embed-hint">{t('crm.embedForms.editorUi.addFieldHint')}</p>
              <div className="lv-embed-palette">
                {ADDABLE_FIELD_TYPES.map((ft) => (
                  <button
                    key={ft}
                    type="button"
                    className="lv-embed-palette__btn"
                    onClick={() => addFieldOfType(ft)}
                  >
                    {FIELD_TYPE_LABELS[ft] || t(`crm.embedForms.fieldPaletteShort.${ft}`)}
                    <kbd>{ft}</kbd>
                  </button>
                ))}
              </div>
              {row && row.kind !== 'lead' && KIND_META[row.kind].fieldType &&
                !fieldConfig.fields.some((f) => f.type === KIND_META[row.kind].fieldType) && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-center justify-between gap-3">
                  <p className="text-xs text-amber-800">
                    В форме нет блока «{KIND_META[row.kind].fieldLabel}» — без него клиент не сможет ничего выбрать.
                  </p>
                  <button
                    type="button"
                    className="lv-embed-btn text-xs shrink-0"
                    onClick={() => addKindField(KIND_META[row.kind].fieldType!, KIND_META[row.kind].fieldLabel!)}
                  >
                    Добавить блок
                  </button>
                </div>
              )}
              <div className="space-y-3 mt-4">
                {fieldConfig.fields.map((f, idx) => (
                  <div key={f.id} className="lv-embed-field-card">
                    <div className="lv-embed-field-card__head">
                      <div className="lv-embed-badges">
                        <span className="lv-embed-badge">{FIELD_TYPE_LABELS[f.type] || f.type}</span>
                        <code className="text-[11px] text-slate-500 font-mono">{f.key}</code>
                      </div>
                      <div className="lv-embed-field-card__actions">
                        <div className="lv-embed-width" role="group" aria-label={t('crm.embedForms.editorUi.colWidth')}>
                          <button type="button" className={f.colSpan === 1 ? 'is-on' : ''} onClick={() => updateField(f.id, { colSpan: 1 })}>½</button>
                          <button type="button" className={!f.colSpan || f.colSpan === 2 ? 'is-on' : ''} onClick={() => updateField(f.id, { colSpan: 2 })}>100%</button>
                        </div>
                        <button type="button" className="lv-embed-ico" onClick={() => moveField(f.id, -1)} disabled={idx === 0}>↑</button>
                        <button type="button" className="lv-embed-ico" onClick={() => moveField(f.id, 1)} disabled={idx >= fieldConfig.fields.length - 1}>↓</button>
                        <button type="button" className="lv-embed-ico" style={{ color: '#9a1f31', borderColor: '#f0c8cf' }} onClick={() => removeField(f.id)} disabled={fieldConfig.fields.length < 2}>×</button>
                      </div>
                    </div>
                    <div>
                      <span className="lv-embed-lbl">{t('crm.embedFields.label')}</span>
                      <input className="lv-embed-inp max-w-none" value={f.label} onChange={(e) => updateField(f.id, { label: e.target.value })} />
                    </div>
                    {fieldConfig.steps?.length ? (
                      <div>
                        <span className="lv-embed-lbl">Шаг</span>
                        <select className="lv-embed-inp max-w-none" value={f.stepId || ''} onChange={(e) => updateField(f.id, { stepId: e.target.value || undefined })}>
                          <option value="">Без шага / всегда</option>
                          {fieldConfig.steps.map((step) => <option key={step.id} value={step.id}>{step.title}</option>)}
                        </select>
                      </div>
                    ) : null}
                    {!['checkbox_consent', 'file', 'messaging', 'html', 'divider', 'hidden', 'utm', 'page_url'].includes(f.type) && (
                      <div>
                        <span className="lv-embed-lbl">{t('crm.embedFields.placeholder')}</span>
                        <input className="lv-embed-inp max-w-none" value={f.placeholder || ''} onChange={(e) => updateField(f.id, { placeholder: e.target.value })} />
                      </div>
                    )}
                    {['html', 'divider'].includes(f.type) ? (
                      <div className="sm:col-span-2">
                        <span className="lv-embed-lbl">Текст блока</span>
                        <textarea className="lv-embed-inp max-w-none min-h-[80px]" value={f.helpText || f.placeholder || ''} onChange={(e) => updateField(f.id, { helpText: e.target.value })} />
                      </div>
                    ) : null}
                    {['select', 'radio', 'multi_checkbox', 'service', 'specialist'].includes(f.type) && (
                      <div className="sm:col-span-2 space-y-2">
                        <span className="lv-embed-lbl">{t('crm.embedForms.editorUi.selectOptions')}</span>
                        {(f.options || []).map((opt, oi) => (
                          <div key={oi} className="flex flex-wrap gap-2 items-center">
                            <input className="lv-embed-inp flex-1 min-w-[100px] max-w-none" value={opt.value} onChange={(e) => {
                              const o = [...(f.options || [])];
                              o[oi] = { ...o[oi], value: e.target.value };
                              updateField(f.id, { options: o });
                            }} />
                            <input className="lv-embed-inp flex-1 min-w-[120px] max-w-none" value={opt.label} onChange={(e) => {
                              const o = [...(f.options || [])];
                              o[oi] = { ...o[oi], label: e.target.value };
                              updateField(f.id, { options: o });
                            }} />
                          </div>
                        ))}
                        <button type="button" className="lv-embed-btn text-xs" onClick={() => updateField(f.id, { options: [...(f.options || []), { value: `v_${Date.now().toString(36)}`, label: t('crm.embedForms.editorUi.newOption') }] })}>{t('crm.embedForms.editorUi.addOption')}</button>
                      </div>
                    )}
                    {f.type === 'product_cart' && (
                      <div className="sm:col-span-2 space-y-2">
                        <span className="lv-embed-lbl">Какие категории товаров показывать (пусто — все опубликованные)</span>
                        <div className="flex flex-wrap gap-2">
                          {productCategories.map((c) => {
                            const ids = f.sourceFilter?.categoryIds || [];
                            const on = ids.includes(c.id);
                            return (
                              <button
                                key={c.id}
                                type="button"
                                className={`rounded-full border px-3 py-1 text-xs ${on ? 'border-[#222] bg-[#222] text-white' : 'border-slate-200 text-slate-600'}`}
                                onClick={() => updateField(f.id, {
                                  sourceFilter: { ...f.sourceFilter, categoryIds: on ? ids.filter((x) => x !== c.id) : [...ids, c.id] },
                                })}
                              >
                                {c.name}
                              </button>
                            );
                          })}
                          {!productCategories.length && <span className="text-xs text-slate-400">Категорий пока нет</span>}
                        </div>
                      </div>
                    )}
                    {f.type === 'service_booking' && (
                      <div className="sm:col-span-2 space-y-2">
                        <span className="lv-embed-lbl">Какие услуги показывать (пусто — все активные)</span>
                        <div className="flex flex-wrap gap-2">
                          {bookingServicesList.map((s) => {
                            const ids = f.sourceFilter?.serviceIds || [];
                            const on = ids.includes(s.id);
                            return (
                              <button
                                key={s.id}
                                type="button"
                                className={`rounded-full border px-3 py-1 text-xs ${on ? 'border-[#222] bg-[#222] text-white' : 'border-slate-200 text-slate-600'}`}
                                onClick={() => updateField(f.id, {
                                  sourceFilter: { ...f.sourceFilter, serviceIds: on ? ids.filter((x) => x !== s.id) : [...ids, s.id] },
                                })}
                              >
                                {s.name}
                              </button>
                            );
                          })}
                          {!bookingServicesList.length && <span className="text-xs text-slate-400">Услуг пока нет</span>}
                        </div>
                      </div>
                    )}
                    {f.type === 'hotel_booking' && (
                      <div className="sm:col-span-2 space-y-2">
                        <span className="lv-embed-lbl">Какие отели показывать (пусто — все активные)</span>
                        <div className="flex flex-wrap gap-2">
                          {hotelsList.map((h) => {
                            const ids = f.sourceFilter?.hotelIds || [];
                            const on = ids.includes(h.id);
                            return (
                              <button
                                key={h.id}
                                type="button"
                                className={`rounded-full border px-3 py-1 text-xs ${on ? 'border-[#222] bg-[#222] text-white' : 'border-slate-200 text-slate-600'}`}
                                onClick={() => updateField(f.id, {
                                  sourceFilter: { ...f.sourceFilter, hotelIds: on ? ids.filter((x) => x !== h.id) : [...ids, h.id] },
                                })}
                              >
                                {h.name}
                              </button>
                            );
                          })}
                          {!hotelsList.length && <span className="text-xs text-slate-400">Отелей пока нет</span>}
                        </div>
                      </div>
                    )}
                    {['number', 'range', 'guests', 'rating'].includes(f.type) ? (
                      <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div><span className="lv-embed-lbl">Min</span><input type="number" className="lv-embed-inp max-w-none" value={f.min ?? ''} onChange={(e) => updateField(f.id, { min: e.target.value === '' ? undefined : Number(e.target.value) })} /></div>
                        <div><span className="lv-embed-lbl">Max</span><input type="number" className="lv-embed-inp max-w-none" value={f.max ?? ''} onChange={(e) => updateField(f.id, { max: e.target.value === '' ? undefined : Number(e.target.value) })} /></div>
                        <div><span className="lv-embed-lbl">Default</span><input className="lv-embed-inp max-w-none" value={String(f.defaultValue ?? '')} onChange={(e) => updateField(f.id, { defaultValue: e.target.value })} /></div>
                      </div>
                    ) : null}
                    {!['checkbox_consent', 'messaging', 'file', 'html', 'divider', 'hidden', 'utm', 'page_url'].includes(f.type) && (
                      <div className="sm:col-span-2 flex items-center">
                        <EmbedSwitch id={`req-${f.id}`} checked={f.required} onChange={(v) => updateField(f.id, { required: v })} label={t('crm.embedFields.required')} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'steps' && (
          <div className="lv-embed-card space-y-5">
            <div className="lv-embed-sec">
              <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-[#222]">Шаги формы</div>
                    <p className="text-xs text-slate-500">Для квиза, записи и бронирования назначайте поля на шаги.</p>
                  </div>
                  <button
                    type="button"
                    className="lv-embed-btn text-xs"
                    onClick={() => {
                      const id = `step_${Date.now().toString(36)}`;
                      setFieldConfig((fc) => ({
                        ...fc,
                        steps: [...(fc.steps || []), { id, title: `Шаг ${(fc.steps || []).length + 1}` }],
                        settings: { ...(fc.settings || {}), showProgress: true },
                      }));
                    }}
                  >
                    Добавить шаг
                  </button>
                </div>
                {fieldConfig.steps?.length ? (
                  <div className="mt-3 space-y-2">
                    {fieldConfig.steps.map((step, idx) => (
                      <div key={step.id} className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-slate-500 w-12">#{idx + 1}</span>
                        <input
                          className="lv-embed-inp flex-1 max-w-none"
                          value={step.title}
                          onChange={(e) => setFieldConfig((fc) => ({
                            ...fc,
                            steps: (fc.steps || []).map((s) => s.id === step.id ? { ...s, title: e.target.value } : s),
                          }))}
                        />
                        <button
                          type="button"
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#f0c8cf] bg-white px-3 py-1.5 text-[12px] font-medium text-[#9a1f31] hover:bg-[#fbecef] hover:border-[#e8b4bb] transition-colors"
                          onClick={() => setFieldConfig((fc) => ({
                            ...fc,
                            steps: (fc.steps || []).filter((s) => s.id !== step.id),
                            fields: fc.fields.map((field) => field.stepId === step.id ? { ...field, stepId: undefined } : field),
                          }))}
                        >
                          Удалить
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">Шаги выключены, форма отображается одним экраном.</p>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <span className="lv-embed-lbl">Текст кнопки далее</span>
                  <input className="lv-embed-inp max-w-none" value={String(fieldConfig.settings?.nextText || 'Далее')} onChange={(e) => setFieldConfigSection('settings', 'nextText', e.target.value)} />
                </div>
                <div>
                  <span className="lv-embed-lbl">Текст кнопки назад</span>
                  <input className="lv-embed-inp max-w-none" value={String(fieldConfig.settings?.backText || 'Назад')} onChange={(e) => setFieldConfigSection('settings', 'backText', e.target.value)} />
                </div>
                <div>
                  <span className="lv-embed-lbl">Текст отправки</span>
                  <input className="lv-embed-inp max-w-none" value={String(fieldConfig.settings?.submitText || 'Отправить')} onChange={(e) => setFieldConfigSection('settings', 'submitText', e.target.value)} />
                </div>
                <div className="flex items-end">
                  <EmbedSwitch id="show-progress" checked={fieldConfig.settings?.showProgress !== false} onChange={(v) => setFieldConfigSection('settings', 'showProgress', v)} label="Показывать прогресс" />
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'logic' && (
          <div className="lv-embed-card space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="lv-embed-sec-title">Условная логика</h2>
                <p className="lv-embed-hint">Показывайте или скрывайте поля по ответам пользователя.</p>
              </div>
              <button
                type="button"
                className="lv-embed-btn"
                onClick={() => setFieldConfig((fc) => ({
                  ...fc,
                  logic: [
                    ...(fc.logic || []),
                    {
                      id: `rule_${Date.now().toString(36)}`,
                      fieldId: fc.fields[0]?.id || '',
                      operator: 'equals',
                      value: '',
                      action: 'show_field',
                      targetFieldId: fc.fields[1]?.id || fc.fields[0]?.id || '',
                    },
                  ],
                }))}
              >
                Добавить правило
              </button>
            </div>
            <div className="space-y-3">
              {(fieldConfig.logic || []).map((rule) => (
                <div key={rule.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                    <div>
                      <span className="lv-embed-lbl">Если поле</span>
                      <select className="lv-embed-inp max-w-none" value={rule.fieldId} onChange={(e) => setFieldConfig((fc) => ({ ...fc, logic: (fc.logic || []).map((r) => r.id === rule.id ? { ...r, fieldId: e.target.value } : r) }))}>
                        {fieldConfig.fields.map((field) => <option key={field.id} value={field.id}>{field.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <span className="lv-embed-lbl">Условие</span>
                      <select className="lv-embed-inp max-w-none" value={rule.operator} onChange={(e) => setFieldConfig((fc) => ({ ...fc, logic: (fc.logic || []).map((r) => r.id === rule.id ? { ...r, operator: e.target.value as LogicRule['operator'] } : r) }))}>
                        <option value="equals">равно</option>
                        <option value="not_equals">не равно</option>
                        <option value="contains">содержит</option>
                        <option value="not_empty">заполнено</option>
                        <option value="empty">пусто</option>
                      </select>
                    </div>
                    <div>
                      <span className="lv-embed-lbl">Значение</span>
                      <input className="lv-embed-inp max-w-none" value={rule.value || ''} onChange={(e) => setFieldConfig((fc) => ({ ...fc, logic: (fc.logic || []).map((r) => r.id === rule.id ? { ...r, value: e.target.value } : r) }))} />
                    </div>
                    <div>
                      <span className="lv-embed-lbl">Действие</span>
                      <select className="lv-embed-inp max-w-none" value={rule.action} onChange={(e) => setFieldConfig((fc) => ({ ...fc, logic: (fc.logic || []).map((r) => r.id === rule.id ? { ...r, action: e.target.value as LogicRule['action'] } : r) }))}>
                        <option value="show_field">показать поле</option>
                        <option value="hide_field">скрыть поле</option>
                      </select>
                    </div>
                    <div>
                      <span className="lv-embed-lbl">Целевое поле</span>
                      <select className="lv-embed-inp max-w-none" value={rule.targetFieldId} onChange={(e) => setFieldConfig((fc) => ({ ...fc, logic: (fc.logic || []).map((r) => r.id === rule.id ? { ...r, targetFieldId: e.target.value } : r) }))}>
                        {fieldConfig.fields.map((field) => <option key={field.id} value={field.id}>{field.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#f0c8cf] bg-white px-3 py-1.5 text-[12px] font-medium text-[#9a1f31] hover:bg-[#fbecef] hover:border-[#e8b4bb] transition-colors"
                    onClick={() => setFieldConfig((fc) => ({ ...fc, logic: (fc.logic || []).filter((r) => r.id !== rule.id) }))}
                  >
                    Удалить правило
                  </button>
                </div>
              ))}
              {!fieldConfig.logic?.length ? <p className="text-sm text-slate-500">Правил пока нет. Форма работает без условной логики.</p> : null}
            </div>
          </div>
        )}

        {tab === 'booking' && (
          <div className="lv-embed-card space-y-5">
            <div>
              <h2 className="lv-embed-sec-title">Запись / бронирование</h2>
              <p className="lv-embed-hint">Настройте услуги, специалистов и расписание. Значения синхронизируются с полями типа “Услуга” и “Специалист”.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <span className="lv-embed-lbl">Услуги: value|Название|цена|длительность/описание</span>
                <textarea
                  className="lv-embed-inp max-w-none min-h-[180px]"
                  value={String(fieldConfig.booking?.servicesText || 'wellness|Wellness massage|$10.00|60 min\nrelax|Relaxing massage|$15.00|60 min\ndetox|Spa detox|$17.00|60 min')}
                  onChange={(e) => syncBookingOptions('service', e.target.value)}
                />
              </div>
              <div>
                <span className="lv-embed-lbl">Специалисты: value|Имя|роль|аватар URL</span>
                <textarea
                  className="lv-embed-inp max-w-none min-h-[180px]"
                  value={String(fieldConfig.booking?.specialistsText || 'any|Любой свободный|Автоназначение\nmanager|Hannah Wellson|Cosmetologist\nexpert|Anna Doe|Spa detox therapist')}
                  onChange={(e) => syncBookingOptions('specialist', e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <span className="lv-embed-lbl">Timezone</span>
                <input className="lv-embed-inp max-w-none" value={String(fieldConfig.booking?.timezone || 'Europe/Zurich')} onChange={(e) => setFieldConfigSection('booking', 'timezone', e.target.value)} />
              </div>
              <div>
                <span className="lv-embed-lbl">Длительность слота, мин</span>
                <input type="number" className="lv-embed-inp max-w-none" value={Number(fieldConfig.booking?.slotMinutes || 30)} onChange={(e) => setFieldConfigSection('booking', 'slotMinutes', Number(e.target.value) || 30)} />
              </div>
              <div>
                <span className="lv-embed-lbl">Буфер между слотами, мин</span>
                <input type="number" className="lv-embed-inp max-w-none" value={Number(fieldConfig.booking?.bufferMinutes || 0)} onChange={(e) => setFieldConfigSection('booking', 'bufferMinutes', Number(e.target.value) || 0)} />
              </div>
            </div>
            <div>
              <span className="lv-embed-lbl">Расписание / правила доступности</span>
              <textarea className="lv-embed-inp max-w-none min-h-[120px]" value={String(fieldConfig.booking?.scheduleText || 'Пн-Пт 09:00-18:00')} onChange={(e) => setFieldConfigSection('booking', 'scheduleText', e.target.value)} />
            </div>
          </div>
        )}

        {tab === 'design' && (
          <div className="lv-embed-card lv-embed-design">
            <div>
              <h2 className="lv-embed-sec-title mb-1">{t('crm.embedDesign.tuningTitle')}</h2>
              <p className="lv-embed-hint mb-4">{t('crm.embedDesign.tuningHint')}</p>
              <div className="mb-5">
                <span className="lv-embed-lbl">Визуальный пресет</span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {VISUAL_PRESETS.map((preset) => {
                    const active = String(design.visualPreset || 'classic') === preset.key;
                    return (
                      <button
                        key={preset.key}
                        type="button"
                        className={`rounded-2xl border p-3 text-left transition ${active ? 'border-[#222] bg-[#222] text-white' : 'border-slate-200 bg-white text-[#222] hover:border-slate-400'}`}
                        onClick={() => setDesign((prev) => ({ ...prev, ...preset.patch }))}
                      >
                        <div className="font-semibold text-sm">{preset.name}</div>
                        <div className={`mt-1 text-xs ${active ? 'text-white/70' : 'text-slate-500'}`}>{preset.description}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <span className="lv-embed-lbl">Стиль вариантов</span>
                  <select className="lv-embed-inp max-w-none" value={String(design.optionStyle || 'cards')} onChange={(e) => setDesignK('optionStyle', e.target.value)}>
                    <option value="cards">Карточки</option>
                    <option value="list">Список как booking</option>
                    <option value="compact">Компактные кнопки</option>
                  </select>
                </div>
                <div>
                  <span className="lv-embed-lbl">Шапка формы</span>
                  <select className="lv-embed-inp max-w-none" value={String(design.headerStyle || 'plain')} onChange={(e) => setDesignK('headerStyle', e.target.value)}>
                    <option value="plain">Обычная</option>
                    <option value="band">Цветная плашка</option>
                    <option value="centered">По центру</option>
                  </select>
                </div>
              </div>
              <div className="lv-embed-number-grid">
                {[
                  ['fontSizePx', t('crm.embedDesign.fontSize')],
                  ['headingSizePx', t('crm.embedDesign.headingSize')],
                  ['fieldPaddingPx', t('crm.embedDesign.fieldPad')],
                  ['gapPx', t('crm.embedDesign.gap')],
                  ['borderRadiusPx', t('crm.embedDesign.radius')],
                  ['buttonPaddingXPx', t('crm.embedDesign.btnPadX')],
                  ['buttonPaddingYPx', t('crm.embedDesign.btnPadY')],
                  ['buttonBorderRadiusPx', t('crm.embedDesign.btnRadius')],
                  ['buttonFontWeight', t('crm.embedDesign.btnWeight')],
                  ['labelWeight', t('crm.embedDesign.labelWeight')],
                  ['formOuterPadXPx', t('crm.embedDesign.formOuterPadX')],
                  ['formOuterPadYPx', t('crm.embedDesign.formOuterPadY')],
                  ['formMaxWidthPx', t('crm.embedDesign.formMaxWidth')],
                ].map(([key, lab]) => (
                  <div key={key}>
                    <span className="lv-embed-lbl">{lab}</span>
                    <input
                      type="number"
                      className="lv-embed-inp max-w-none"
                      value={designNum(design, String(key), 0)}
                      onChange={(e) => setDesignK(String(key), Number(e.target.value) || 0)}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <span className="lv-embed-lbl">{t('crm.embedDesign.fontFamily')}</span>
                <input
                  className="lv-embed-inp max-w-none"
                  value={String(design['fontFamily'] || '')}
                  onChange={(e) => setDesignK('fontFamily', e.target.value)}
                />
              </div>
              <div className="mt-4 max-w-sm">
                <span className="lv-embed-lbl">{t('crm.embedDesign.btnWidth')}</span>
                <select
                  className="lv-embed-inp"
                  value={String(design['buttonWidth'] || 'full')}
                  onChange={(e) => setDesignK('buttonWidth', e.target.value)}
                >
                  <option value="full">{t('crm.embedDesign.btnWidthFull')}</option>
                  <option value="auto">{t('crm.embedDesign.btnWidthAuto')}</option>
                </select>
              </div>
              <div className="mt-6 space-y-4">
                {[
                  ['textColor', t('crm.embedDesign.text')],
                  ['backgroundColor', t('crm.embedDesign.bg')],
                  ['fieldBackground', t('crm.embedDesign.fieldBg')],
                  ['borderColor', t('crm.embedDesign.border')],
                  ['buttonBackground', t('crm.embedDesign.btnBg')],
                  ['buttonTextColor', t('crm.embedDesign.btnText')],
                  ['accentColor', t('crm.embedDesign.accent')],
                  ['headerBackground', 'Фон шапки'],
                  ['headerTextColor', 'Текст шапки'],
                ].map(([key, lab]) => (
                  <EmbedColorField
                    key={key}
                    label={lab}
                    value={String(
                      design[key] != null && design[key] !== ''
                        ? design[key]
                        : DEFAULT_DESIGN[key] ?? '#000000',
                    )}
                    onChange={(v) => setDesignK(String(key), v)}
                  />
                ))}
              </div>
            </div>
            <div>
              <h2 className="lv-embed-sec-title mb-1">{t('crm.embedDesign.livePreview')}</h2>
              <p className="lv-embed-hint mb-3">{t('crm.embedDesign.livePreviewHint')}</p>
              <EmbedDesignPreview design={design} title={name || row.name} />
            </div>
          </div>
        )}

        {tab === 'install' && (
          <div className="lv-embed-card space-y-5">
            <p className="text-sm text-[#555] leading-relaxed">{t('crm.embedInstall.hint')}</p>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h2 className="lv-embed-sec-title mb-3">Настройки popup / floating</h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <span className="lv-embed-lbl">Текст popup-кнопки</span>
                  <input className="lv-embed-inp max-w-none" value={String(fieldConfig.display?.popupButtonText || 'Оставить заявку')} onChange={(e) => setFieldConfigSection('display', 'popupButtonText', e.target.value)} />
                </div>
                <div>
                  <span className="lv-embed-lbl">Ширина popup, px</span>
                  <input type="number" className="lv-embed-inp max-w-none" value={Number(fieldConfig.display?.popupWidthPx || 760)} onChange={(e) => setFieldConfigSection('display', 'popupWidthPx', Number(e.target.value) || 760)} />
                </div>
                <div className="flex items-end">
                  <EmbedSwitch id="popup-blur" checked={fieldConfig.display?.popupBlur !== false} onChange={(v) => setFieldConfigSection('display', 'popupBlur', v)} label="Blur background" />
                </div>
                <div>
                  <span className="lv-embed-lbl">Floating текст</span>
                  <input className="lv-embed-inp max-w-none" value={String(fieldConfig.display?.floatingLabel || 'Оставить заявку')} onChange={(e) => setFieldConfigSection('display', 'floatingLabel', e.target.value)} />
                </div>
                <div>
                  <span className="lv-embed-lbl">Позиция floating</span>
                  <select className="lv-embed-inp max-w-none" value={String(fieldConfig.display?.floatingPosition || 'right-bottom')} onChange={(e) => setFieldConfigSection('display', 'floatingPosition', e.target.value)}>
                    <option value="right-bottom">Справа снизу</option>
                    <option value="left-bottom">Слева снизу</option>
                    <option value="right-center">Справа по центру</option>
                    <option value="left-center">Слева по центру</option>
                  </select>
                </div>
                <div>
                  <span className="lv-embed-lbl">Задержка показа, сек</span>
                  <input type="number" className="lv-embed-inp max-w-none" value={Number(fieldConfig.display?.floatingDelaySec || 0)} onChange={(e) => setFieldConfigSection('display', 'floatingDelaySec', Number(e.target.value) || 0)} />
                </div>
              </div>
            </div>
            <div>
              <span className="lv-embed-lbl">{t('crm.embedInstall.url')}</span>
              <code className="lv-embed-mono block break-all whitespace-pre-wrap text-[#222]">
                {embedPageUrl}
              </code>
            </div>
            <div>
              <span className="lv-embed-lbl">{t('crm.embedInstall.iframe')}</span>
              <textarea
                readOnly
                className="lv-embed-mono w-full min-h-[120px] resize-y"
                value={iframeCode}
              />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <span className="lv-embed-lbl">Popup по кнопке</span>
                <textarea
                  readOnly
                  className="lv-embed-mono w-full min-h-[130px] resize-y"
                  value={popupCode}
                />
              </div>
              <div>
                <span className="lv-embed-lbl">Floating widget</span>
                <textarea
                  readOnly
                  className="lv-embed-mono w-full min-h-[130px] resize-y"
                  value={floatingCode}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(iframeCode)}
              className="lv-embed-btn"
            >
              {t('crm.embedInstall.copy')}
            </button>
          </div>
        )}
      </div>
    </MainLayout>
  );
};
