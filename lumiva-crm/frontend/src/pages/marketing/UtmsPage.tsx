// Редизайн по мокапу Claude Design (marketing-utms.html / components/utms-page.jsx) —
// структура портирована 1:1, данные реальные: шаблоны UTM хранятся на бэкенде (marketing/utm-templates).
// Мобильная вёрстка — сверх мокапа.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { useAlertModal } from '../../contexts/AlertModalContext';
import {
  createUtmTemplate,
  fetchUtmTemplates,
  deleteUtmTemplate,
  updateUtmTemplate,
  type MarketingUtmTemplate,
} from '../../api/marketing';
import { cl, Ic } from '../contacts/CrmListShared';
import '../contacts/crm-lists-design.css';
import './utms-design.css';
import { CHANNELS, clean, dirty, type ChannelKey } from './utmTags';

type FieldKey = 'source' | 'medium' | 'campaign' | 'content' | 'term';

interface FormState {
  baseUrl: string;
  source: string;
  medium: string;
  campaign: string;
  content: string;
  term: string;
  channel: ChannelKey;
  name: string;
}

const U = {
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="1.5" />
      <path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3" />
    </>
  ),
  check: <path d="M5 12l4 4 10-10" />,
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4l10-10-4-4L4 16z" />
      <path d="M14 6l4 4" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  warn: (
    <>
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4" />
      <path d="M12 17v.01" />
    </>
  ),
};

const FIELDS: Array<{ k: FieldKey; p: string; ph: string; wide: boolean }> = [
  { k: 'source', p: 'utm_source', ph: 'google', wide: false },
  { k: 'medium', p: 'utm_medium', ph: 'cpc', wide: false },
  { k: 'campaign', p: 'utm_campaign', ph: 'autumn_intensive', wide: true },
  { k: 'content', p: 'utm_content', ph: 'banner_320x50', wide: false },
  { k: 'term', p: 'utm_term', ph: 'psiholog_online', wide: false },
];

const emptyForm: FormState = { baseUrl: '', source: 'google', medium: 'cpc', campaign: '', content: '', term: '', channel: 'google_search', name: '' };

export const UtmsPage: React.FC = () => {
  const { t } = useTranslation();
  const { showConfirm } = useAlertModal();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [templates, setTemplates] = useState<MarketingUtmTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  /** Если задан — «Сохранить» обновляет этот шаблон, а не создаёт новый. */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setTemplates(await fetchUtmTemplates());
    } catch (e) {
      console.error(e);
      setError(e instanceof Error && e.message ? e.message : t('crm.marketingUtms.errors.loadTemplates'));
    } finally {
      setLoading(false);
    }
  }, [t]);
  useEffect(() => {
    void load();
  }, [load]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const preset = (c: (typeof CHANNELS)[number]) => {
    setEditingId(null);
    setForm((f) => ({ ...f, channel: c.k, source: c.source, medium: c.medium }));
  };

  const { url, parts, urlError } = useMemo(() => {
    const base = form.baseUrl.trim();
    if (!base) return { url: '', parts: [] as Array<[string, string]>, urlError: null as string | null };
    let u: URL;
    try {
      u = new URL(base, base.startsWith('http') ? undefined : 'https://dummy.host');
    } catch {
      return { url: '', parts: [], urlError: t('crm.marketingUtms.errors.invalidBaseUrl') };
    }
    const ps = FIELDS.filter((f) => form[f.k]).map((f) => [f.p, form[f.k]] as [string, string]);
    ps.forEach(([k, v]) => u.searchParams.set(k, v));
    return { url: u.toString().replace('https://dummy.host', ''), parts: ps, urlError: null };
  }, [form, t]);

  const baseShown = url.split('?')[0];
  const flash = (msg: string) => {
    setError(null);
    setStatus(msg);
  };
  const fail = (e: unknown, fallback: string) => {
    console.error(e);
    setStatus(null);
    setError(e instanceof Error && e.message ? e.message : fallback);
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError(t('crm.marketingUtms.errors.copyFailed'));
    }
  };

  const payloadOf = (name: string) => ({
    name,
    baseUrl: form.baseUrl.trim() || undefined,
    channelType: form.channel,
    utmSource: form.source || undefined,
    utmMedium: form.medium || undefined,
    utmCampaign: form.campaign || undefined,
    utmContent: form.content || undefined,
    utmTerm: form.term || undefined,
  });

  const save = async (asCopy: boolean) => {
    const name = form.name.trim();
    if (!name) {
      setError(t('crm.marketingUtms.errors.nameRequired'));
      return;
    }
    setSaving(true);
    try {
      if (editingId && !asCopy) {
        const updated = await updateUtmTemplate(editingId, payloadOf(name));
        setTemplates((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
        flash(t('crm.marketingUtms.success.updated'));
      } else {
        const copyName = asCopy ? t('crm.marketingUtms.copyNameSuffix', { name }) : name;
        const created = await createUtmTemplate(payloadOf(copyName));
        setTemplates((prev) => [created, ...prev]);
        setEditingId(created.id);
        if (asCopy) set('name', copyName);
        flash(asCopy ? t('crm.marketingUtms.success.duplicated') : t('crm.marketingUtms.success.created'));
      }
    } catch (e) {
      fail(e, t('crm.marketingUtms.errors.saveTemplate'));
    } finally {
      setSaving(false);
    }
  };

  const apply = (tpl: MarketingUtmTemplate) => {
    setEditingId(tpl.id);
    setForm((f) => ({
      baseUrl: tpl.baseUrl || '',
      channel: ((tpl.channelType as ChannelKey) || f.channel) as ChannelKey,
      source: tpl.utmSource || '',
      medium: tpl.utmMedium || '',
      campaign: tpl.utmCampaign || '',
      content: tpl.utmContent || '',
      term: tpl.utmTerm || '',
      name: tpl.name,
    }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const reset = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
  };

  const remove = async (tpl: MarketingUtmTemplate) => {
    const ok = await showConfirm(t('crm.marketingUtms.confirmDelete', { name: tpl.name }), {
      title: t('crm.confirmModal.deleteTitle'),
      confirmLabel: t('crm.confirmModal.deleteLabel'),
      cancelLabel: t('crm.confirmModal.cancel'),
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteUtmTemplate(tpl.id);
      setTemplates((prev) => prev.filter((x) => x.id !== tpl.id));
      if (editingId === tpl.id) {
        setEditingId(null);
        set('name', '');
      }
    } catch (e) {
      fail(e, t('crm.marketingUtms.errors.deleteTemplate'));
    }
  };

  const none = t('crm.marketingUtms.ui.crm.none');
  const leadRows: Array<[string, string]> = [
    [t('crm.marketingUtms.ui.crm.rows.source'), form.source],
    [t('crm.marketingUtms.ui.crm.rows.medium'), form.medium],
    [t('crm.marketingUtms.ui.crm.rows.campaign'), form.campaign],
    [t('crm.marketingUtms.ui.crm.rows.content'), form.content],
    [t('crm.marketingUtms.ui.crm.rows.term'), form.term],
    [t('crm.marketingUtms.ui.crm.rows.landing'), baseShown],
  ];

  return (
    <MainLayout>
      <PageHelpButton topic="marketingUtms" />
      <div className="px-scope utm-scope">
        <div className="ut-wrap">
          <div className="ut-head">
            <div>
              <div className="kicker">
                <span className="dot" />
                {t('crm.marketingUtms.kicker')}
              </div>
              <h1>{t('crm.marketingUtms.title')}</h1>
              <div className="sub">{t('crm.marketingUtms.subtitle')}</div>
            </div>
            <div className="ut-head-actions">
              <button type="button" className="btn btn-sm" onClick={reset}>
                <Ic d={U.plus} size={14} />
                {t('crm.marketingUtms.actions.newLink')}
              </button>
            </div>
          </div>

          {error && (
            <div className="ut-note err" role="alert">
              <span className="sp">{error}</span>
              <button type="button" className="x" onClick={() => setError(null)} aria-label="×">
                ×
              </button>
            </div>
          )}
          {status && !error && (
            <div className="ut-note ok" role="status">
              <span className="sp">{status}</span>
              <button type="button" className="x" onClick={() => setStatus(null)} aria-label="×">
                ×
              </button>
            </div>
          )}

          <div className="ut-flow">
            {[0, 1, 2, 3, 4].map((i) => (
              <div className={cl('ut-step', i < 2 && 'on')} key={i}>
                <div className="n">{t('crm.marketingUtms.ui.flow.step', { n: i + 1 })}</div>
                <div className="t">{t(`crm.marketingUtms.ui.flow.items.${i}.t`)}</div>
                <div className="d">{t(`crm.marketingUtms.ui.flow.items.${i}.d`)}</div>
              </div>
            ))}
          </div>

          <div className="ut-cols">
            <div>
              <div className="ut-card">
                <div className="ut-card-head">
                  <h3>{editingId ? t('crm.marketingUtms.ui.builder.titleEdit') : t('crm.marketingUtms.ui.builder.titleNew')}</h3>
                  <span className="meta">{editingId ? t('crm.marketingUtms.ui.builder.metaEdit') : t('crm.marketingUtms.ui.builder.metaNew')}</span>
                </div>

                <div className="ut-chips">
                  {CHANNELS.map((c) => (
                    <button key={c.k} type="button" className={cl('ut-chip', form.channel === c.k && 'on')} onClick={() => preset(c)}>
                      {t(`crm.marketingUtms.channels.${c.k}`)}
                      {c.source && (
                        <span className="mono">
                          {c.source} / {c.medium}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="ut-fields">
                  <div className="ut-f wide">
                    <div className="l">
                      <b>{t('crm.marketingUtms.ui.page.label')}</b>
                      <span>{t('crm.marketingUtms.ui.page.hint')}</span>
                    </div>
                    <input
                      className="ut-input"
                      value={form.baseUrl}
                      onChange={(e) => set('baseUrl', e.target.value)}
                      placeholder="https://example.com/pricing"
                      inputMode="url"
                      autoCapitalize="off"
                      autoCorrect="off"
                      aria-label={t('crm.marketingUtms.ui.page.label')}
                    />
                  </div>
                  {FIELDS.map((f) => (
                    <div className={cl('ut-f', f.wide && 'wide')} key={f.k}>
                      <div className="l">
                        <b>{f.p}</b>
                        <span>
                          {t(`crm.marketingUtms.ui.fields.${f.k}.n`)} {t(`crm.marketingUtms.ui.fields.${f.k}.hint`)}
                        </span>
                      </div>
                      <input
                        className={cl('ut-input', dirty(form[f.k]) && 'bad')}
                        value={form[f.k]}
                        onChange={(e) => set(f.k, e.target.value)}
                        placeholder={f.ph}
                        autoCapitalize="off"
                        autoCorrect="off"
                        aria-label={f.p}
                      />
                      {dirty(form[f.k]) && (
                        <div className="ut-warn">
                          <Ic d={U.warn} size={13} />
                          {t('crm.marketingUtms.ui.warn.text')}
                          <button type="button" onClick={() => set(f.k, clean(form[f.k]))}>
                            {t('crm.marketingUtms.ui.warn.fix')}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="ut-out">
                  <div className="ut-out-head">
                    <span className="l">{t('crm.marketingUtms.ui.out.label')}</span>
                    <button type="button" className="btn btn-sm" onClick={() => void copy()} disabled={!url}>
                      <Ic d={copied ? U.check : U.copy} size={13} />
                      {copied ? t('crm.marketingUtms.actions.copied') : t('crm.marketingUtms.ui.out.copy')}
                    </button>
                  </div>
                  <div className="ut-url">
                    {urlError ? (
                      <span className="err">{urlError}</span>
                    ) : !url ? (
                      <span className="hint">{t('crm.marketingUtms.ui.out.empty')}</span>
                    ) : (
                      <>
                        <span className="base">{baseShown}</span>
                        {parts.map(([k, v], i) => (
                          <React.Fragment key={k}>
                            <span className="k">
                              {i === 0 ? '?' : '&'}
                              {k}=
                            </span>
                            <span className="v">{v}</span>
                          </React.Fragment>
                        ))}
                        {!parts.length && <span className="k">{t('crm.marketingUtms.ui.out.noParams')}</span>}
                      </>
                    )}
                  </div>
                </div>

                <div className="ut-save">
                  <div className="ut-f">
                    <div className="l">
                      <b>{t('crm.marketingUtms.ui.save.name')}</b>
                      <span>{t('crm.marketingUtms.ui.save.nameHint')}</span>
                    </div>
                    <input
                      className="ut-input body"
                      value={form.name}
                      onChange={(e) => set('name', e.target.value)}
                      placeholder={t('crm.marketingUtms.ui.save.namePh')}
                      aria-label={t('crm.marketingUtms.ui.save.name')}
                    />
                  </div>
                  {editingId && (
                    <button type="button" className="btn btn-sm" onClick={() => void save(true)} disabled={saving || !form.name.trim()}>
                      {t('crm.marketingUtms.ui.save.copy')}
                    </button>
                  )}
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => void save(false)} disabled={saving || !form.name.trim()}>
                    {saving ? t('crm.marketingUtms.ui.save.saving') : editingId ? t('crm.marketingUtms.ui.save.update') : t('crm.marketingUtms.ui.save.create')}
                  </button>
                </div>
              </div>

              <div className="ut-bottom">
                {[0, 1, 2].map((i) => (
                  <div className="ut-role" key={i}>
                    <div className="r">{t(`crm.marketingUtms.ui.roles.${i}.r`)}</div>
                    <div className="t">{t(`crm.marketingUtms.ui.roles.${i}.t`)}</div>
                    <div className="d">{t(`crm.marketingUtms.ui.roles.${i}.d`)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="ut-card">
                <div className="ut-card-head">
                  <h3>{t('crm.marketingUtms.ui.crm.title')}</h3>
                  <span className="meta">{t('crm.marketingUtms.ui.crm.meta')}</span>
                </div>
                <div className="ut-lead">
                  {leadRows.map(([k, v]) => (
                    <div className="ut-lead-row" key={k}>
                      <div className="k">{k}</div>
                      <div className={cl('v', !v && 'empty')}>{v || none}</div>
                    </div>
                  ))}
                </div>
                <div className="ut-foot">{t('crm.marketingUtms.ui.crm.foot')}</div>
              </div>

              <div className="ut-card">
                <div className="ut-card-head">
                  <h3>{t('crm.marketingUtms.ui.templates.title')}</h3>
                  <span className="meta">{templates.length}</span>
                </div>
                {loading ? (
                  <div className="ut-empty">{t('crm.marketingUtms.loading')}</div>
                ) : templates.length === 0 ? (
                  <div className="ut-empty">{t('crm.marketingUtms.ui.templates.empty')}</div>
                ) : (
                  templates.map((tpl) => (
                    <div className={cl('ut-tpl', editingId === tpl.id && 'on')} key={tpl.id}>
                      <div className="nm">
                        <b>{tpl.name}</b>
                        <div className="p">
                          {tpl.utmSource || '—'} / {tpl.utmMedium || '—'}
                          {tpl.utmCampaign ? ` · ${tpl.utmCampaign}` : ''}
                        </div>
                        {tpl.baseUrl && (
                          <div className="p" style={{ color: 'var(--fg-4)' }}>
                            {tpl.baseUrl}
                          </div>
                        )}
                      </div>
                      <div className="ut-tpl-acts">
                        <button type="button" className="ut-ico" title={t('crm.marketingUtms.ui.templates.load')} aria-label={t('crm.marketingUtms.ui.templates.load')} onClick={() => apply(tpl)}>
                          <Ic d={U.edit} size={14} />
                        </button>
                        <button type="button" className="ut-ico danger" title={t('crm.marketingUtms.ui.templates.remove')} aria-label={t('crm.marketingUtms.ui.templates.remove')} onClick={() => void remove(tpl)}>
                          <Ic d={U.trash} size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="ut-card">
                <div className="ut-card-head">
                  <h3>{t('crm.marketingUtms.ui.rules.title')}</h3>
                  <span className="meta">{t('crm.marketingUtms.ui.rules.meta')}</span>
                </div>
                <ul className="ut-rules">
                  {[0, 1, 2, 3].map((i) => (
                    <li key={i}>
                      <i>{String(i + 1).padStart(2, '0')}</i>
                      <span>
                        <Trans i18nKey={`crm.marketingUtms.ui.rules.items.${i}`} components={{ code: <code /> }} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};
