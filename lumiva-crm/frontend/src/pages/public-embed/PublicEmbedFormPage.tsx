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
    marginBottom: 8,
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

  const padX = designNum(d, 'formOuterPadXPx', 16);
  const padY = designNum(d, 'formOuterPadYPx', 16);
  const maxW = designNum(d, 'formMaxWidthPx', 512);

  const formShellStyle: React.CSSProperties = {
    ...styleFromDesign(d),
    boxSizing: 'border-box',
    width: '100%',
    maxWidth: maxW > 0 ? maxW : undefined,
    margin: maxW > 0 ? '0 auto' : 0,
    padding: `${padY}px ${padX}px`,
  };

  return (
    <form onSubmit={onSubmit} className="block" style={formShellStyle}>
      <h1 style={hStyle}>{config.name}</h1>
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
        {config.fieldConfig?.fields?.map((field) => {
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
                  : field.type === 'number'
                    ? 'number'
                    : field.type === 'date'
                      ? 'date'
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

      <button
        type="submit"
        disabled={sending}
        className="mt-4 w-full border-0 text-center cursor-pointer"
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
        {sending ? '…' : 'Отправить'}
      </button>
    </form>
  );
};
