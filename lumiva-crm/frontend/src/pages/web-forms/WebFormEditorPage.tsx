import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { fetchSites, type Site } from '../../api/sites';
import {
  createEmbedForm,
  fetchEmbedForm,
  fetchEmbedTemplateList,
  postEmbedPreviewToken,
  updateEmbedForm,
  type EmbedFieldConfigItem,
  type EmbedFieldType,
  type EmbedFormRow,
} from '../../api/embedForms';
import { withTimeout, DEFAULT_FETCH_TIMEOUT_MS } from '../../utils/withTimeout';
import './WebFormEditorPage.css';
import { EmbedSwitch } from './embed-editor/EmbedSwitch';
import { EmbedColorField } from './embed-editor/EmbedColorField';
import { EmbedDesignPreview } from './embed-editor/EmbedDesignPreview';

const DEFAULT_DESIGN: Record<string, unknown> = {
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

type Tab = 'content' | 'design' | 'install';

const ADDABLE_FIELD_TYPES: EmbedFieldType[] = [
  'text',
  'email',
  'url',
  'tel',
  'number',
  'date',
  'textarea',
  'select',
  'file',
  'checkbox_consent',
  'messaging',
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
  const isNew = formId === 'new';
  /** Редактирование: есть id, и это не маршрут /new. Без id не крутим вечный лоадер. */
  const isEdit = Boolean(formId && !isNew);

  const [sites, setSites] = useState<Site[]>([]);
  const [templateKeys, setTemplateKeys] = useState<string[]>([]);
  const [createSiteId, setCreateSiteId] = useState('');
  const [createTemplate, setCreateTemplate] = useState('contact');
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);

  const [row, setRow] = useState<EmbedFormRow | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('content');
  const [name, setName] = useState('');
  const [published, setPublished] = useState(false);
  const [fieldConfig, setFieldConfig] = useState<{ fields: EmbedFieldConfigItem[] }>({
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
      setFieldConfig(f.fieldConfig as { fields: EmbedFieldConfigItem[] });
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

  const addFieldOfType = (type: EmbedFieldType) => {
    setFieldConfig((fc) => {
      const used = new Set(fc.fields.map((f) => f.key));
      const keySeed =
        type === 'checkbox_consent' ? 'consent' : type;
      let key: string = keySeed;
      let n = 1;
      while (used.has(key)) {
        key = `${keySeed}_${n++}`;
      }
      const id = newFieldId();
      const defLabel = t(`crm.embedForms.fieldPaletteLabels.${type}`);
      const next: EmbedFieldConfigItem = {
        id,
        type,
        key,
        label: defLabel,
        colSpan: 2,
        required: type === 'checkbox_consent',
        options:
          type === 'select'
            ? [
                { value: 'opt1', label: t('crm.embedForms.selectOpt1') },
                { value: 'opt2', label: t('crm.embedForms.selectOpt2') },
              ]
            : undefined,
      };
      if (type === 'messaging') {
        next.required = false;
      }
      return { ...fc, fields: [...fc.fields, next] };
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
        templateKey: createTemplate,
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
    return `<iframe title="${row.name}" src="${embedPageUrl}" width="100%" height="700" style="border:0" loading="lazy"></iframe>`;
  }, [row, embedPageUrl]);

  const openPreview = async () => {
    if (!row) return;
    const { token } = await postEmbedPreviewToken(row.id);
    const u = new URL(`${window.location.origin}/embed/${row.publicId}`);
    u.searchParams.set('preview', '1');
    u.searchParams.set('pt', token);
    window.open(u.toString(), '_blank', 'noopener,noreferrer');
  };

  if (isNew) {
    return (
      <MainLayout>
        <div className="max-w-lg mx-auto px-4 py-8 text-[#222]">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 mb-1">
            {t('crm.embedForms.kicker')}
          </p>
          <h1 className="text-2xl font-semibold text-[#222] mb-2">
            {t('crm.embedForms.create.title')}
          </h1>
          <p className="text-sm text-slate-600 mb-6">{t('crm.embedForms.create.hint')}</p>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm px-3 py-2 mb-4">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('crm.embedForms.create.name')}
              </label>
              <input
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder={t('crm.embedForms.create.namePh')}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('crm.embedForms.create.site')}
              </label>
              <select
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
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
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('crm.embedForms.create.template')}
              </label>
              <select
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={createTemplate}
                onChange={(e) => setCreateTemplate(e.target.value)}
              >
                {templateKeys.map((k) => (
                  <option key={k} value={k}>
                    {t(`crm.embedForms.templates.${k}`)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={creating || !sites.length}
              onClick={create}
              className="w-full rounded-lg py-2.5 text-sm font-semibold text-white"
              style={{ background: '#222' }}
            >
              {creating ? t('crm.embedForms.create.creating') : t('crm.embedForms.create.submit')}
            </button>
            <button
              type="button"
              onClick={() => navigate('/web-forms')}
              className="w-full text-sm text-slate-600 hover:text-[#222]"
            >
              {t('crm.embedForms.create.back')}
            </button>
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
          {(['content', 'design', 'install'] as Tab[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={'lv-embed-tab' + (tab === k ? ' is-active' : '')}
            >
              {t(`crm.embedForms.editor.tab.${k}`)}
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
            <div className="lv-embed-sec lv-embed-sec--border">
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
                    {t(`crm.embedForms.fieldPaletteShort.${ft}`)}
                    <kbd>{t(`crm.embedForms.fieldPaletteKbd.${ft}`)}</kbd>
                  </button>
                ))}
              </div>
              <div className="space-y-3 mt-2">
                {fieldConfig.fields.map((f, idx) => (
                  <div key={f.id} className="lv-embed-field-card">
                    <div className="lv-embed-field-card__head">
                      <div className="lv-embed-badges">
                        <span className="lv-embed-badge">{f.type}</span>
                        <code className="text-[11px] text-slate-500 font-mono">{f.key}</code>
                      </div>
                      <div className="lv-embed-field-card__actions">
                        <div className="lv-embed-width" role="group" aria-label={t('crm.embedForms.editorUi.colWidth')}>
                          <button
                            type="button"
                            className={f.colSpan === 1 ? 'is-on' : ''}
                            onClick={() => updateField(f.id, { colSpan: 1 })}
                          >
                            ½
                          </button>
                          <button
                            type="button"
                            className={!f.colSpan || f.colSpan === 2 ? 'is-on' : ''}
                            onClick={() => updateField(f.id, { colSpan: 2 })}
                          >
                            100%
                          </button>
                        </div>
                        <button
                          type="button"
                          className="lv-embed-ico"
                          onClick={() => moveField(f.id, -1)}
                          disabled={idx === 0}
                          title={t('crm.embedForms.editorUi.moveUp')}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="lv-embed-ico"
                          onClick={() => moveField(f.id, 1)}
                          disabled={idx >= fieldConfig.fields.length - 1}
                          title={t('crm.embedForms.editorUi.moveDown')}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="lv-embed-ico"
                          onClick={() => removeField(f.id)}
                          disabled={fieldConfig.fields.length < 2}
                          title={t('crm.embedForms.editorUi.remove')}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    <div>
                      <span className="lv-embed-lbl">{t('crm.embedFields.label')}</span>
                      <input
                        className="lv-embed-inp max-w-none"
                        value={f.label}
                        onChange={(e) => updateField(f.id, { label: e.target.value })}
                      />
                    </div>
                    {f.type !== 'checkbox_consent' && f.type !== 'file' && f.type !== 'messaging' && (
                      <div>
                        <span className="lv-embed-lbl">{t('crm.embedFields.placeholder')}</span>
                        <input
                          className="lv-embed-inp max-w-none"
                          value={f.placeholder || ''}
                          onChange={(e) => updateField(f.id, { placeholder: e.target.value })}
                        />
                      </div>
                    )}
                    {f.type === 'select' && (
                      <div className="sm:col-span-2 space-y-2">
                        <span className="lv-embed-lbl">{t('crm.embedForms.editorUi.selectOptions')}</span>
                        {(f.options || []).map((opt, oi) => (
                          <div key={oi} className="flex flex-wrap gap-2 items-center">
                            <input
                              className="lv-embed-inp flex-1 min-w-[100px] max-w-none"
                              value={opt.value}
                              onChange={(e) => {
                                const o = [...(f.options || [])];
                                o[oi] = { ...o[oi], value: e.target.value };
                                updateField(f.id, { options: o });
                              }}
                            />
                            <input
                              className="lv-embed-inp flex-1 min-w-[120px] max-w-none"
                              value={opt.label}
                              onChange={(e) => {
                                const o = [...(f.options || [])];
                                o[oi] = { ...o[oi], label: e.target.value };
                                updateField(f.id, { options: o });
                              }}
                            />
                          </div>
                        ))}
                        <button
                          type="button"
                          className="lv-embed-btn text-xs"
                          onClick={() =>
                            updateField(f.id, {
                              options: [
                                ...(f.options || []),
                                { value: `v_${fieldConfig.fields.length}`, label: t('crm.embedForms.editorUi.newOption') },
                              ],
                            })
                          }
                        >
                          {t('crm.embedForms.editorUi.addOption')}
                        </button>
                      </div>
                    )}
                    {f.type !== 'checkbox_consent' && f.type !== 'messaging' && f.type !== 'file' && (
                      <div className="sm:col-span-2 flex items-center">
                        <EmbedSwitch
                          id={`req-${f.id}`}
                          checked={f.required}
                          onChange={(v) => updateField(f.id, { required: v })}
                          label={t('crm.embedFields.required')}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'design' && (
          <div className="lv-embed-card lv-embed-design">
            <div>
              <h2 className="lv-embed-sec-title mb-1">{t('crm.embedDesign.tuningTitle')}</h2>
              <p className="lv-embed-hint mb-4">{t('crm.embedDesign.tuningHint')}</p>
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
