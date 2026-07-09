import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  fetchPublicEmbedConfig,
  submitPublicEmbed,
  uploadPublicEmbedAttachment,
  type PublicEmbedConfig,
  type EmbedFieldConfigItem,
} from '../../api/embedForms';

function designNum(d: Record<string, unknown>, k: string, def: number): number {
  const n = Number(d[k]);
  return Number.isFinite(n) ? n : def;
}

function tLinkHost(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return 'policy';
  }
}

function styleFromDesign(d: Record<string, unknown>) {
  const bg = d['backgroundColor'];
  return {
    fontFamily: String(d['fontFamily'] || 'system-ui, sans-serif'),
    fontSize: `${Number(d['fontSizePx'] || 15)}px`,
    color: String(d['textColor'] || '#111'),
    backgroundColor:
      bg != null && String(bg).trim() !== ''
        ? String(bg)
        : '#ffffff',
  } as React.CSSProperties;
}

function moneyLabel(value: unknown) {
  const s = String(value ?? '').trim();
  if (!s) return '';
  return s;
}

export const PublicEmbedFormPage: React.FC = () => {
  const { publicId } = useParams<{ publicId: string }>();
  const [search] = useSearchParams();
  const previewToken =
    search.get('pt') || search.get('previewToken') || null;
  const isPreview = search.get('preview') === '1' || Boolean(previewToken);

  const [config, setConfig] = useState<PublicEmbedConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [fileBusy, setFileBusy] = useState(false);
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  const load = useCallback(() => {
    if (!publicId) return;
    setLoading(true);
    setError(null);
    fetchPublicEmbedConfig(publicId, isPreview ? previewToken : null)
      .then(setConfig)
      .catch((e) => {
        setError(e?.message || 'Failed to load form');
      })
      .finally(() => setLoading(false));
  }, [publicId, isPreview, previewToken]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!config) return;
    const next: Record<string, unknown> = {};
    config.fieldConfig?.fields?.forEach((field) => {
      if (field.defaultValue !== undefined && values[field.id] === undefined) {
        next[field.id] = field.defaultValue;
      }
      if (field.type === 'page_url' && values[field.id] === undefined) {
        next[field.id] = document.referrer || window.location.href;
      }
      if (field.type === 'utm' && values[field.id] === undefined) {
        const key = field.key || 'utm_source';
        next[field.id] = search.get(key) || search.get('utm_source') || '';
      }
    });
    if (Object.keys(next).length) {
      setValues((prev) => ({ ...next, ...prev }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, search]);

  useEffect(() => {
    const send = () => {
      const h = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
        document.documentElement.offsetHeight,
      );
      window.parent?.postMessage({ type: 'lumiva-form-resize', publicId, height: h }, '*');
    };
    send();
    const t = window.setTimeout(send, 80);
    return () => window.clearTimeout(t);
  }, [publicId, config, values, done, error, activeStepIndex]);

  useLayoutEffect(() => {
    document.documentElement.classList.add('embed-public-iframe');
    document.body.classList.add('embed-public-iframe');
    return () => {
      document.documentElement.classList.remove('embed-public-iframe');
      document.body.classList.remove('embed-public-iframe');
    };
  }, []);

  const d = useMemo(
    () => (config ? { ...config.design } : ({} as Record<string, unknown>)),
    [config],
  );

  const setField = (id: string, v: unknown) => {
    setValues((m) => ({ ...m, [id]: v }));
  };

  const onFile = async (field: EmbedFieldConfigItem, file: File | null) => {
    if (!publicId || !file) return;
    setFileBusy(true);
    try {
      const r = await uploadPublicEmbedAttachment(
        publicId,
        file,
        isPreview ? previewToken : null,
      );
      setAttachmentIds((a) => [...a, r.id]);
      setField(field.id, r.name);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setFileBusy(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicId) return;
    setSending(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { ...values };
      if (attachmentIds.length) {
        body['attachmentIds'] = attachmentIds;
      }
      const res = await submitPublicEmbed(
        publicId,
        body,
        isPreview ? previewToken : null,
      );
      if (res.silent) {
        setDone(true);
        return;
      }
      if (res.preview) {
        setDone(true);
        return;
      }
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div
        className="min-h-[200px] flex items-center justify-center p-4 text-slate-500"
        style={d ? styleFromDesign(d) : undefined}
      >
        …
      </div>
    );
  }

  if (error && !config) {
    return (
      <div className="p-4 text-sm text-rose-700 bg-rose-50 min-h-[120px] flex items-center justify-center">
        {error}
      </div>
    );
  }

  if (!config) return null;

  if (done) {
    return (
      <div
        className="p-6 text-center"
        style={styleFromDesign(d)}
        role="status"
      >
        <p className="text-base font-medium" style={{ color: d['textColor'] as string }}>
          {config.successMessage ||
            (isPreview
              ? 'Превью: форма валидна, лид в CRM не создаётся.'
              : 'Спасибо! Заявка отправлена.')}
        </p>
      </div>
    );
  }

  const hStyle: React.CSSProperties = {
    fontSize: `${Number(d['headingSizePx'] || 20)}px`,
    fontWeight: 600,
    color: d['textColor'] as string,
    margin: 0,
    marginBottom: d.headerStyle === 'band' ? 0 : 8,
    textAlign: d.headerStyle === 'centered' ? 'center' : undefined,
  };

  const gapV = Number(d['gapPx'] || 12);
  const colWrap = (f: EmbedFieldConfigItem): React.CSSProperties => ({
    width: f.colSpan === 1 ? `calc((100% - ${gapV}px) / 2)` : '100%',
    boxSizing: 'border-box',
  });

  const fieldInputStyle: React.CSSProperties = {
    backgroundColor: d['fieldBackground'] as string,
    border: `1px solid ${String(d['borderColor'] || '#e5e7eb')}`,
    color: d['textColor'] as string,
    borderRadius: Number(d['borderRadiusPx'] || 8),
    padding: Number(d['fieldPaddingPx'] || 12),
  };

  const optionStyle = String(d.optionStyle || 'cards');
  const optionBaseStyle = (selected: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: optionStyle === 'compact' ? 8 : 14,
    width: '100%',
    padding: optionStyle === 'compact' ? '10px 12px' : '14px 16px',
    border: `1px solid ${selected ? String(d.accentColor || '#2563eb') : String(d.borderColor || '#e5e7eb')}`,
    borderRadius: optionStyle === 'list' ? 0 : Number(d.borderRadiusPx || 12) + 4,
    background: selected ? String(d.fieldBackground || '#f9fafb') : 'transparent',
    boxShadow: selected && optionStyle === 'cards' ? '0 10px 30px rgba(15,23,42,.08)' : undefined,
    cursor: 'pointer',
    transition: 'border-color .15s, background .15s, box-shadow .15s',
  });

  const renderChoiceMark = (selected: boolean, multi = false) => (
    <span
      aria-hidden
      style={{
        width: 18,
        height: 18,
        borderRadius: multi ? 3 : 999,
        border: `1px solid ${selected ? String(d.accentColor || '#2563eb') : String(d.borderColor || '#e5e7eb')}`,
        background: selected ? String(d.accentColor || '#2563eb') : 'transparent',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        flex: '0 0 auto',
        fontSize: 12,
      }}
    >
      {selected ? '✓' : ''}
    </span>
  );

  const renderOptionList = (
    field: EmbedFieldConfigItem,
    selectedValues: string[],
    onToggle: (value: string) => void,
    multi = false,
  ) => (
    <div
      className={optionStyle === 'cards' ? 'grid gap-3 sm:grid-cols-2' : 'grid gap-0'}
      style={optionStyle === 'list' ? { borderTop: `1px solid ${String(d.borderColor || '#e5e7eb')}` } : undefined}
    >
      {(field.options || []).map((option: any) => {
        const selected = selectedValues.includes(option.value);
        const price = moneyLabel(option.price);
        const description = option.description || option.duration;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onToggle(option.value)}
            style={{
              ...optionBaseStyle(selected),
              borderLeft: optionStyle === 'list' ? 0 : optionBaseStyle(selected).border,
              borderRight: optionStyle === 'list' ? 0 : optionBaseStyle(selected).border,
              borderTop: optionStyle === 'list' ? 0 : optionBaseStyle(selected).border,
            }}
          >
            {renderChoiceMark(selected, multi)}
            {option.imageUrl ? (
              <img src={option.imageUrl} alt="" style={{ width: 52, height: 52, borderRadius: 999, objectFit: 'cover', flex: '0 0 auto' }} />
            ) : null}
            <span style={{ display: 'grid', gap: 3, textAlign: 'left', flex: 1, minWidth: 0 }}>
              <span style={{ fontWeight: 650, color: d.textColor as string }}>{option.label}</span>
              {description ? <span style={{ fontSize: 12, opacity: 0.65 }}>{description}</span> : null}
            </span>
            {price ? <span style={{ fontWeight: 700, color: d.textColor as string, whiteSpace: 'nowrap' }}>{price}</span> : null}
          </button>
        );
      })}
    </div>
  );

  const padX = designNum(d, 'formOuterPadXPx', 16);
  const padY = designNum(d, 'formOuterPadYPx', 16);
  const maxW = designNum(d, 'formMaxWidthPx', 512);
  const steps = config.fieldConfig?.steps || [];
  const activeStep = steps[activeStepIndex] || null;
  const settings = config.fieldConfig?.settings || {};
  const logicRules = (config.fieldConfig as any)?.logic || [];
  const evalRule = (rule: any) => {
    const raw = values[rule.fieldId];
    const text = Array.isArray(raw) ? raw.join(',') : String(raw ?? '');
    const expected = String(rule.value ?? '');
    if (rule.operator === 'not_equals') return text !== expected;
    if (rule.operator === 'contains') return text.includes(expected);
    if (rule.operator === 'not_empty') return text.trim() !== '';
    if (rule.operator === 'empty') return text.trim() === '';
    return text === expected;
  };
  const hiddenByLogic = new Set<string>();
  logicRules.forEach((rule: any) => {
    if (!rule?.targetFieldId) return;
    const matched = evalRule(rule);
    if (rule.action === 'hide_field' && matched) hiddenByLogic.add(rule.targetFieldId);
    if (rule.action === 'show_field' && !matched) hiddenByLogic.add(rule.targetFieldId);
  });
  const visibleFields = (config.fieldConfig?.fields || []).filter((field) => {
    if (hiddenByLogic.has(field.id)) return false;
    if (!steps.length) return true;
    return !field.stepId || field.stepId === activeStep?.id;
  });
  const isLastStep = !steps.length || activeStepIndex >= steps.length - 1;
  const validateCurrentStep = () => {
    for (const field of visibleFields) {
      if (!field.required || ['html', 'divider', 'hidden', 'utm', 'page_url'].includes(field.type)) continue;
      const value = values[field.id];
      if (field.type === 'checkbox_consent' || field.type === 'checkbox') {
        if (value !== true) return false;
      } else if (field.type === 'multi_checkbox') {
        if (!Array.isArray(value) || value.length === 0) return false;
      } else if (value === null || value === undefined || String(value).trim() === '') {
        return false;
      }
    }
    return true;
  };

  const formShellStyle: React.CSSProperties = {
    ...styleFromDesign(d),
    boxSizing: 'border-box',
    width: '100%',
    maxWidth: maxW > 0 ? maxW : undefined,
    margin: maxW > 0 ? '0 auto' : 0,
    padding: d.headerStyle === 'band' ? 0 : `${padY}px ${padX}px`,
    overflow: 'hidden',
  };

  return (
    <form onSubmit={onSubmit} className="block" style={formShellStyle}>
      <div
        style={
          d.headerStyle === 'band'
            ? {
                background: String(d.headerBackground || d.buttonBackground || d.accentColor || '#111827'),
                color: String(d.headerTextColor || '#ffffff'),
                padding: `${Math.max(22, padY + 10)}px ${Math.max(24, padX)}px`,
                marginBottom: 0,
              }
            : { padding: d.headerStyle === 'centered' ? `0 0 ${Math.max(8, gapV)}px` : undefined }
        }
      >
        <h1 style={{ ...hStyle, color: d.headerStyle === 'band' ? String(d.headerTextColor || '#ffffff') : hStyle.color }}>{config.name}</h1>
      </div>
      <div style={{ padding: d.headerStyle === 'band' ? `${padY}px ${padX}px` : undefined }}>
      {steps.length && settings.showProgress !== false ? (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs mb-2" style={{ color: d['textColor'] as string }}>
            <span>{activeStep?.title || `Шаг ${activeStepIndex + 1}`}</span>
            <span>{activeStepIndex + 1} / {steps.length}</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: String(d['borderColor'] || '#e5e7eb') }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${((activeStepIndex + 1) / steps.length) * 100}%`,
                background: String(d['accentColor'] || '#2563eb'),
              }}
            />
          </div>
        </div>
      ) : null}
      {error && (
        <div className="mb-3 text-sm text-rose-700 bg-rose-50 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          gap: gapV,
        }}
      >
        {visibleFields.map((field) => {
          if (field.type === 'hidden' || field.type === 'utm' || field.type === 'page_url') {
            return (
              <input
                key={field.id}
                type="hidden"
                value={String(values[field.id] ?? field.defaultValue ?? '')}
                onChange={() => undefined}
              />
            );
          }
          if (field.type === 'divider') {
            return <div key={field.id} style={colWrap(field)}><hr style={{ border: 0, borderTop: `1px solid ${String(d['borderColor'] || '#e5e7eb')}` }} /></div>;
          }
          if (field.type === 'html') {
            return (
              <div key={field.id} style={colWrap(field)}>
                <div className="rounded-2xl px-3 py-2 text-sm" style={{ background: String(d['fieldBackground'] || '#f9fafb'), color: d['textColor'] as string }}>
                  {field.helpText || field.placeholder || field.label}
                </div>
              </div>
            );
          }
          if (field.type === 'file') {
            return (
              <div key={field.id} style={colWrap(field)}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: 4,
                    fontWeight: designNum(d, 'labelWeight', 600),
                    fontSize: 13,
                  }}
                >
                  {field.label}
                  {field.required ? ' *' : ''}
                </label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf"
                  disabled={fileBusy}
                  onChange={(e) => onFile(field, e.target.files?.[0] || null)}
                  className="w-full text-sm"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  PDF, DOC, DOCX · до 12 МБ
                </p>
              </div>
            );
          }
          if (field.type === 'checkbox_consent') {
            return (
              <div key={field.id} style={colWrap(field)}>
                <label className="flex gap-2 items-start text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    required={field.required}
                    checked={values[field.id] === true}
                    onChange={(e) => setField(field.id, e.target.checked)}
                  />
                  <span>
                    {field.label}
                    {config.privacyPolicyUrl ? (
                      <>
                        {' '}
                        <a
                          href={config.privacyPolicyUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: d['accentColor'] as string }}
                          className="underline"
                        >
                          {tLinkHost(config.privacyPolicyUrl)}
                        </a>
                      </>
                    ) : null}
                  </span>
                </label>
              </div>
            );
          }
          if (field.type === 'messaging') {
            return (
              <div key={field.id} style={colWrap(field)}>
                <div
                  className="text-sm font-semibold mb-2"
                  style={{ fontWeight: designNum(d, 'labelWeight', 600) as number }}
                >
                  {field.label}
                </div>
                <div className="flex flex-wrap gap-2">
                  {['whatsapp', 'telegram', 'email'].map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        setField(
                          field.id,
                          values[field.id] === k ? null : k,
                        );
                      }}
                      className="px-3 py-1.5 rounded-full border text-sm"
                      style={{
                        borderColor: d['borderColor'] as string,
                        backgroundColor:
                          values[field.id] === k
                            ? String(d['fieldBackground'] || '#eee')
                            : 'transparent',
                        color: d['textColor'] as string,
                        fontWeight: 600,
                      }}
                    >
                      {k === 'whatsapp'
                        ? 'WhatsApp'
                        : k === 'telegram'
                          ? 'Telegram'
                          : 'E-mail'}
                    </button>
                  ))}
                </div>
              </div>
            );
          }
          if (field.type === 'checkbox') {
            return (
              <div key={field.id} style={colWrap(field)}>
                <label className="flex gap-2 items-start text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    required={field.required}
                    checked={values[field.id] === true}
                    onChange={(e) => setField(field.id, e.target.checked)}
                  />
                  <span>{field.label}{field.required ? ' *' : ''}</span>
                </label>
              </div>
            );
          }
          if (field.type === 'radio') {
            return (
              <div key={field.id} style={colWrap(field)}>
                <div className="block text-sm mb-2" style={{ fontWeight: designNum(d, 'labelWeight', 600) }}>
                  {field.label}{field.required ? ' *' : ''}
                </div>
                {renderOptionList(field, values[field.id] ? [String(values[field.id])] : [], (value) => setField(field.id, value), false)}
                {field.required ? <input className="sr-only" required value={values[field.id] ? 'ok' : ''} onChange={() => undefined} /> : null}
              </div>
            );
          }
          if (field.type === 'multi_checkbox') {
            const selected = Array.isArray(values[field.id]) ? values[field.id] as string[] : [];
            return (
              <div key={field.id} style={colWrap(field)}>
                <div className="block text-sm mb-2" style={{ fontWeight: designNum(d, 'labelWeight', 600) }}>
                  {field.label}{field.required ? ' *' : ''}
                </div>
                {renderOptionList(field, selected, (value) => {
                  const next = selected.includes(value) ? selected.filter((x) => x !== value) : [...selected, value];
                  setField(field.id, next);
                }, true)}
                {field.required ? <input className="sr-only" required value={selected.length ? 'ok' : ''} onChange={() => undefined} /> : null}
              </div>
            );
          }
          if (field.type === 'textarea') {
            return (
              <div key={field.id} style={colWrap(field)}>
                <label className="block text-sm mb-1" style={{ fontWeight: designNum(d, 'labelWeight', 600) }}>
                  {field.label}
                  {field.required ? ' *' : ''}
                </label>
                <textarea
                  required={field.required}
                  className="w-full min-h-[100px] border rounded-md"
                  style={fieldInputStyle}
                  placeholder={field.placeholder}
                  value={String(values[field.id] ?? '')}
                  onChange={(e) => setField(field.id, e.target.value)}
                  maxLength={field.maxLength}
                />
              </div>
            );
          }
          if (field.type === 'service' || field.type === 'specialist') {
            return (
              <div key={field.id} style={colWrap(field)}>
                <div className="block text-sm mb-2" style={{ fontWeight: designNum(d, 'labelWeight', 600) }}>
                  {field.label}{field.required ? ' *' : ''}
                </div>
                {renderOptionList(field, values[field.id] ? [String(values[field.id])] : [], (value) => setField(field.id, value), false)}
                {field.required ? <input className="sr-only" required value={values[field.id] ? 'ok' : ''} onChange={() => undefined} /> : null}
              </div>
            );
          }
          if (field.type === 'select') {
            return (
              <div key={field.id} style={colWrap(field)}>
                <label className="block text-sm mb-1" style={{ fontWeight: designNum(d, 'labelWeight', 600) }}>
                  {field.label}
                  {field.required ? ' *' : ''}
                </label>
                <select
                  required={field.required}
                  className="w-full border rounded-md"
                  style={fieldInputStyle}
                  value={String(values[field.id] ?? '')}
                  onChange={(e) => setField(field.id, e.target.value)}
                >
                  <option value="">—</option>
                  {(field.options || []).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            );
          }
          const tpe =
            field.type === 'email'
              ? 'email'
              : field.type === 'tel'
                ? 'tel'
                : field.type === 'url'
                  ? 'url'
                : field.type === 'number' || field.type === 'guests' || field.type === 'rating' || field.type === 'range'
                    ? 'number'
                    : field.type === 'date'
                      ? 'date'
                  : field.type === 'time'
                    ? 'time'
                    : field.type === 'datetime'
                      ? 'datetime-local'
                      : 'text';
          return (
            <div key={field.id} style={colWrap(field)}>
              <label className="block text-sm mb-1" style={{ fontWeight: designNum(d, 'labelWeight', 600) }}>
                {field.label}
                {field.required ? ' *' : ''}
              </label>
              <input
                type={tpe}
                required={field.required}
                className="w-full border outline-none"
                style={fieldInputStyle}
                placeholder={field.placeholder}
                value={String(values[field.id] ?? '')}
                onChange={(e) => setField(field.id, e.target.value)}
                maxLength={field.maxLength}
                min={field.min}
                max={field.max}
              />
            </div>
          );
        })}

        <input
          type="text"
          name={config.honeypotField}
          autoComplete="off"
          tabIndex={-1}
          aria-hidden
          className="absolute opacity-0 w-0 h-0 pointer-events-none"
          value={String(values[config.honeypotField] ?? '')}
          onChange={(e) => setField(config.honeypotField, e.target.value)}
        />
      </div>

      <div className="mt-4 flex gap-2">
        {steps.length && activeStepIndex > 0 ? (
          <button
            type="button"
            className="border text-center cursor-pointer"
            onClick={() => setActiveStepIndex((i) => Math.max(0, i - 1))}
            style={{
              borderColor: String(d['borderColor'] || '#e5e7eb'),
              color: d['textColor'] as string,
              borderRadius: Number(d['buttonBorderRadiusPx'] || 10),
              padding: `${Number(d['buttonPaddingYPx'] || 12)}px ${Number(d['buttonPaddingXPx'] || 20)}px`,
              fontWeight: Number(d['buttonFontWeight'] || 600),
            }}
          >
            {String(settings.backText || 'Назад')}
          </button>
        ) : null}
        <button
          type={isLastStep ? 'submit' : 'button'}
          disabled={sending}
          onClick={() => {
            if (!isLastStep) {
              if (!validateCurrentStep()) {
                setError('Заполните обязательные поля текущего шага.');
                return;
              }
              setError(null);
              setActiveStepIndex((i) => Math.min(steps.length - 1, i + 1));
            }
          }}
          className="flex-1 border-0 text-center cursor-pointer"
          style={
            {
              width: d['buttonWidth'] === 'auto' ? 'auto' : '100%',
              backgroundColor: d['buttonBackground'] || '#111',
              color: d['buttonTextColor'] || '#fff',
              borderRadius: Number(d['buttonBorderRadiusPx'] || 10),
              padding: `${Number(d['buttonPaddingYPx'] || 12)}px ${Number(
                d['buttonPaddingXPx'] || 20,
              )}px`,
              fontWeight: Number(d['buttonFontWeight'] || 600),
              fontSize: d['fontSizePx'] ? `${d['fontSizePx']}px` : undefined,
            } as React.CSSProperties
          }
        >
          {sending ? '…' : isLastStep ? String(settings.submitText || 'Отправить') : String(settings.nextText || 'Далее')}
        </button>
      </div>
      </div>
    </form>
  );
};
