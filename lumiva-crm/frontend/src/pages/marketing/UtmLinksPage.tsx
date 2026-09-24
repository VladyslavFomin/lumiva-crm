// Редизайн по мокапу Claude Design (marketing-utm-links.html / components/utm-links.jsx) —
// структура портирована 1:1, данные реальные (backend marketing.service.ts: listUtmLinks):
// лиды — из заявок с теми же метками, переходы — из подключённой аналитики (GA4 / Яндекс.Метрика).
// Мобильная вёрстка — сверх мокапа: таблица превращается в карточки.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { useAlertModal } from '../../contexts/AlertModalContext';
import {
  createUtmLink,
  createUtmTemplate,
  deleteUtmLink,
  fetchUtmLinks,
  type MarketingUtmLink,
} from '../../api/marketing';
import { getLocale } from '../../i18n/utils';
import { cl, Ic } from '../contacts/CrmListShared';
import '../contacts/crm-lists-design.css';
import './utms-design.css';
import './utm-links-design.css';
import { CHANNELS, buildTaggedUrl, clean, dirty, type ChannelKey } from './utmTags';

type FieldKey = 'source' | 'medium' | 'campaign' | 'content' | 'term';

const LI = {
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="1.5" />
      <path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3" />
    </>
  ),
  check: <path d="M5 12l4 4 10-10" />,
  ext: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4l-8 8" />
      <path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" />
    </>
  ),
  qr: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3z" />
      <path d="M20 14v3" />
      <path d="M14 20h7" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.5-4.5" />
    </>
  ),
  x: (
    <>
      <path d="M6 6l12 12" />
      <path d="M6 18L18 6" />
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

const FIELDS: Array<{ k: FieldKey; p: string; wide: boolean }> = [
  { k: 'source', p: 'utm_source', wide: false },
  { k: 'medium', p: 'utm_medium', wide: false },
  { k: 'campaign', p: 'utm_campaign', wide: true },
  { k: 'content', p: 'utm_content', wide: false },
  { k: 'term', p: 'utm_term', wide: false },
];

/** Ссылка с порогом «переходы есть, а лидов почти нет» (как в мокапе). */
const LOW_CR_MIN_CLICKS = 300;
const LOW_CR = 0.01;

const tagsOf = (l: MarketingUtmLink) => ({ source: l.utmSource, medium: l.utmMedium, campaign: l.utmCampaign, content: l.utmContent, term: l.utmTerm });
const fullUrl = (l: MarketingUtmLink) => buildTaggedUrl(l.baseUrl, tagsOf(l))?.url || l.baseUrl;

/* ── новая ссылка ── */
const NewLinkDrawer: React.FC<{
  onClose: () => void;
  onCreated: (msg: string) => void;
  onError: (msg: string) => void;
}> = ({ onClose, onCreated, onError }) => {
  const { t } = useTranslation();
  const [f, setF] = useState({ name: '', channel: 'meta_ads' as ChannelKey, base: '', source: 'facebook', medium: 'paid_social', campaign: '', content: '', term: '' });
  const [busy, setBusy] = useState<'link' | 'tpl' | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const built = buildTaggedUrl(f.base, f);
  const baseInvalid = !!f.base.trim() && !built;
  const canSave = !!f.name.trim() && !!built;

  const payload = () => ({
    name: f.name.trim(),
    baseUrl: f.base.trim(),
    channelType: f.channel,
    utmSource: f.source || undefined,
    utmMedium: f.medium || undefined,
    utmCampaign: f.campaign || undefined,
    utmContent: f.content || undefined,
    utmTerm: f.term || undefined,
  });

  const submit = async (kind: 'link' | 'tpl') => {
    if (!canSave) return;
    setBusy(kind);
    try {
      if (kind === 'link') {
        await createUtmLink(payload());
        onCreated(t('crm.marketingUtmLinks.msg.created'));
      } else {
        await createUtmTemplate(payload());
        onCreated(t('crm.marketingUtmLinks.msg.templateSaved'));
      }
      onClose();
    } catch (e) {
      onError(e instanceof Error && e.message ? e.message : t('crm.marketingUtmLinks.errors.create'));
      setBusy(null);
    }
  };

  return (
    <div className="px-scope utm-scope">
      <div
        className="ul-back"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="ul-drawer" role="dialog" aria-modal="true" aria-label={t('crm.marketingUtmLinks.drawer.title')}>
          <div className="ul-drawer-head">
            <h2>{t('crm.marketingUtmLinks.drawer.title')}</h2>
            <button type="button" className="ut-ico" onClick={onClose} aria-label={t('crm.marketingUtmLinks.drawer.cancel')}>
              <Ic d={LI.x} size={15} />
            </button>
          </div>
          <div className="ul-drawer-body">
            <div className="ut-chips">
              {CHANNELS.map((c) => (
                <button
                  key={c.k}
                  type="button"
                  className={cl('ut-chip', f.channel === c.k && 'on')}
                  onClick={() => setF((x) => ({ ...x, channel: c.k, source: c.source, medium: c.medium }))}
                >
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
                  <b>{t('crm.marketingUtmLinks.drawer.name')}</b>
                  <span>{t('crm.marketingUtmLinks.drawer.nameHint')}</span>
                </div>
                <input className="ut-input body" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder={t('crm.marketingUtmLinks.drawer.namePh')} aria-label={t('crm.marketingUtmLinks.drawer.name')} />
              </div>
              <div className="ut-f wide">
                <div className="l">
                  <b>{t('crm.marketingUtms.ui.page.label')}</b>
                  <span>{t('crm.marketingUtms.ui.page.hint')}</span>
                </div>
                <input
                  className={cl('ut-input', baseInvalid && 'bad')}
                  value={f.base}
                  onChange={(e) => set('base', e.target.value)}
                  placeholder="https://example.com/pricing"
                  inputMode="url"
                  autoCapitalize="off"
                  autoCorrect="off"
                  aria-label={t('crm.marketingUtms.ui.page.label')}
                />
                {baseInvalid && <div className="ut-warn">{t('crm.marketingUtms.errors.invalidBaseUrl')}</div>}
              </div>
              {FIELDS.map((fd) => (
                <div className={cl('ut-f', fd.wide && 'wide')} key={fd.k}>
                  <div className="l">
                    <b>{fd.p}</b>
                    <span>{t(`crm.marketingUtmLinks.drawer.hints.${fd.k}`)}</span>
                  </div>
                  <input
                    className={cl('ut-input', dirty(f[fd.k]) && 'bad')}
                    value={f[fd.k]}
                    onChange={(e) => set(fd.k, e.target.value)}
                    autoCapitalize="off"
                    autoCorrect="off"
                    aria-label={fd.p}
                  />
                  {dirty(f[fd.k]) && (
                    <div className="ut-warn">
                      <Ic d={LI.warn} size={13} />
                      {t('crm.marketingUtms.ui.warn.text')}
                      <button type="button" onClick={() => set(fd.k, clean(f[fd.k]))}>
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
              </div>
              <div className="ut-url">
                {built ? (
                  <>
                    <span className="base">{built.url.split('?')[0]}</span>
                    {built.parts.map(([k, v], i) => (
                      <React.Fragment key={k}>
                        <span className="k">
                          {i === 0 ? '?' : '&'}
                          {k}=
                        </span>
                        <span className="v">{v}</span>
                      </React.Fragment>
                    ))}
                  </>
                ) : (
                  <span className="hint">{t('crm.marketingUtms.ui.out.empty')}</span>
                )}
              </div>
            </div>
          </div>
          <div className="ul-drawer-foot">
            <button type="button" className="btn btn-sm" onClick={onClose}>
              {t('crm.marketingUtmLinks.drawer.cancel')}
            </button>
            <button type="button" className="btn btn-sm" disabled={!canSave || !!busy} onClick={() => void submit('tpl')}>
              {t('crm.marketingUtmLinks.drawer.saveTemplate')}
            </button>
            <button type="button" className="btn btn-sm btn-primary" disabled={!canSave || !!busy} onClick={() => void submit('link')}>
              {busy === 'link' ? t('crm.marketingUtmLinks.drawer.creating') : t('crm.marketingUtmLinks.drawer.create')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── QR-код ссылки ── */
const QrDialog: React.FC<{ link: MarketingUtmLink; onClose: () => void; onCopy: () => void }> = ({ link, onClose, onCopy }) => {
  const { t } = useTranslation();
  const [src, setSrc] = useState<string | null>(null);
  const url = fullUrl(link);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { width: 480, margin: 1, errorCorrectionLevel: 'M' })
      .then((d) => alive && setSrc(d))
      .catch(() => alive && setSrc(null));
    return () => {
      alive = false;
    };
  }, [url]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="px-scope utm-scope">
      <div
        className="ul-modal-back"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="ul-modal" role="dialog" aria-modal="true" aria-label={t('crm.marketingUtmLinks.qr.title')}>
          <div className="ul-modal-h">
            <h3>{t('crm.marketingUtmLinks.qr.title')}</h3>
            <button type="button" className="ut-ico" onClick={onClose} aria-label={t('crm.marketingUtmLinks.qr.close')}>
              <Ic d={LI.x} size={15} />
            </button>
          </div>
          <div className="ul-modal-b">
            {src ? <img className="ul-qr" src={src} alt={link.name} /> : <div className="ul-qr" />}
            <div className="nm">{link.name}</div>
            <div className="hint">{t('crm.marketingUtmLinks.qr.hint')}</div>
          </div>
          <div className="ul-modal-f">
            <button type="button" className="btn btn-sm" onClick={onCopy}>
              {t('crm.marketingUtmLinks.qr.copy')}
            </button>
            {src && (
              <a className="btn btn-sm btn-primary" href={src} download={`qr-${clean(link.name) || 'link'}.png`}>
                {t('crm.marketingUtmLinks.qr.download')}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const UtmLinksPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { showConfirm } = useAlertModal();
  const navigate = useNavigate();
  const locale = getLocale(i18n.language);
  const [links, setLinks] = useState<MarketingUtmLink[]>([]);
  const [hasTraffic, setHasTraffic] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [ch, setCh] = useState<'all' | ChannelKey>('all');
  const [copied, setCopied] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [qr, setQr] = useState<MarketingUtmLink | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetchUtmLinks();
      setLinks(res.items);
      setHasTraffic(res.hasTraffic);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error && e.message ? e.message : t('crm.marketingUtmLinks.errors.load'));
    } finally {
      setLoading(false);
    }
  }, [t]);
  useEffect(() => {
    void load();
  }, [load]);

  const nf = (n: number) => Math.round(n).toLocaleString(locale);
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
  const channelName = (k?: string | null) => t(`crm.marketingUtms.channels.${(k && CHANNELS.some((c) => c.k === k) ? k : 'other') as ChannelKey}`);
  const crOf = (l: MarketingUtmLink) => (l.clicks && l.clicks > 0 ? l.leads / l.clicks : null);

  const rows = useMemo(
    () =>
      links.filter(
        (l) =>
          (ch === 'all' || (l.channelType || 'other') === ch) &&
          (!q || `${l.name} ${l.utmCampaign || ''} ${l.utmSource || ''}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [links, q, ch],
  );
  const T = rows.reduce((a, l) => ({ clicks: a.clicks + (l.clicks || 0), leads: a.leads + l.leads }), { clicks: 0, leads: 0 });
  const maxClicks = Math.max(...links.map((l) => l.clicks || 0), 1);
  const lowCr = links.filter((l) => (l.clicks || 0) > LOW_CR_MIN_CLICKS && (crOf(l) ?? 1) < LOW_CR);

  const copy = async (l: MarketingUtmLink) => {
    try {
      await navigator.clipboard.writeText(fullUrl(l));
      setCopied(l.id);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setError(t('crm.marketingUtms.errors.copyFailed'));
    }
  };

  const remove = async (l: MarketingUtmLink) => {
    const ok = await showConfirm(t('crm.marketingUtmLinks.confirmDelete', { name: l.name }), {
      title: t('crm.confirmModal.deleteTitle'),
      confirmLabel: t('crm.confirmModal.deleteLabel'),
      cancelLabel: t('crm.confirmModal.cancel'),
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteUtmLink(l.id);
      setLinks((prev) => prev.filter((x) => x.id !== l.id));
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t('crm.marketingUtmLinks.errors.remove'));
    }
  };

  const Actions: React.FC<{ l: MarketingUtmLink }> = ({ l }) => (
    <div className="ul-acts">
      <button type="button" className="ut-ico" title={t('crm.marketingUtmLinks.actions.copy')} aria-label={t('crm.marketingUtmLinks.actions.copy')} onClick={() => void copy(l)}>
        <Ic d={copied === l.id ? LI.check : LI.copy} size={14} />
      </button>
      <button type="button" className="ut-ico" title={t('crm.marketingUtmLinks.actions.qr')} aria-label={t('crm.marketingUtmLinks.actions.qr')} onClick={() => setQr(l)}>
        <Ic d={LI.qr} size={14} />
      </button>
      <a className="ut-ico" href={fullUrl(l)} target="_blank" rel="noreferrer" title={t('crm.marketingUtmLinks.actions.open')} aria-label={t('crm.marketingUtmLinks.actions.open')}>
        <Ic d={LI.ext} size={14} />
      </a>
      <button type="button" className="ut-ico danger" title={t('crm.marketingUtmLinks.actions.remove')} aria-label={t('crm.marketingUtmLinks.actions.remove')} onClick={() => void remove(l)}>
        <Ic d={LI.trash} size={14} />
      </button>
    </div>
  );

  const clicksCell = (l: MarketingUtmLink) => (l.clicks === null ? <span className="ul-na">—</span> : nf(l.clicks));
  const crCell = (l: MarketingUtmLink) => {
    const cr = crOf(l);
    return cr === null ? <span className="ul-na">—</span> : <span style={{ color: cr < LOW_CR ? '#cc2f47' : 'var(--ink)' }}>{(cr * 100).toFixed(2)}%</span>;
  };

  return (
    <MainLayout>
      <PageHelpButton topic="marketingUtms" />
      <div className="px-scope utm-scope">
        <div className="ut-wrap">
          <div className="ut-head">
            <div>
              <div className="kicker">
                <span className="dot" />
                {t('crm.marketingUtmLinks.kicker')}
              </div>
              <h1>{t('crm.marketingUtmLinks.title')}</h1>
              <div className="sub">{t('crm.marketingUtmLinks.subtitle')}</div>
            </div>
            <div className="ut-head-actions">
              <button type="button" className="btn btn-sm" onClick={() => navigate('/marketing/utms')}>
                {t('crm.marketingUtmLinks.builder')}
              </button>
              <button type="button" className="btn btn-sm btn-primary" onClick={() => setDrawer(true)}>
                <Ic d={LI.plus} size={14} />
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

          <div className="ul-kpis">
            <div className="ul-kpi">
              <div className="l">{t('crm.marketingUtmLinks.kpi.links')}</div>
              <div className="v">{rows.length}</div>
            </div>
            <div className="ul-kpi">
              <div className="l">{t('crm.marketingUtmLinks.kpi.clicks')}</div>
              <div className={cl('v', !hasTraffic && 'na')}>{hasTraffic ? nf(T.clicks) : '—'}</div>
            </div>
            <div className="ul-kpi">
              <div className="l">{t('crm.marketingUtmLinks.kpi.leads')}</div>
              <div className="v">{nf(T.leads)}</div>
            </div>
            <div className="ul-kpi">
              <div className="l">{t('crm.marketingUtmLinks.kpi.cr')}</div>
              <div className={cl('v', !hasTraffic && 'na')}>
                {hasTraffic ? (T.clicks ? ((T.leads / T.clicks) * 100).toFixed(2) : '0.00') : '—'}
                {hasTraffic && <span className="u">%</span>}
              </div>
            </div>
          </div>

          {!hasTraffic && links.length > 0 && (
            <div className="ul-note info">
              <span className="sp">{t('crm.marketingUtmLinks.noTraffic')}</span>
              <button type="button" className="btn btn-sm" onClick={() => navigate('/integrations-hub?tab=marketing')}>
                {t('crm.marketingUtmLinks.connectAnalytics')}
              </button>
            </div>
          )}
          {lowCr.length > 0 && (
            <div className="ul-note">
              <Ic d={LI.warn} size={15} />
              <span className="sp">
                {lowCr.length === 1 ? t('crm.marketingUtmLinks.warn.one', { name: lowCr[0].name }) : t('crm.marketingUtmLinks.warn.many', { count: lowCr.length })}
                {t('crm.marketingUtmLinks.warn.tail')}
              </span>
            </div>
          )}

          <div className="ut-card">
            <div className="ut-card-head">
              <h3>{t('crm.marketingUtmLinks.list.title')}</h3>
              <div className="ul-tools">
                <label className="ul-search">
                  <Ic d={LI.search} size={14} />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('crm.marketingUtmLinks.list.search')} />
                </label>
                <select className="ul-select" value={ch} onChange={(e) => setCh(e.target.value as 'all' | ChannelKey)}>
                  <option value="all">{t('crm.marketingUtmLinks.list.allChannels')}</option>
                  {CHANNELS.map((c) => (
                    <option key={c.k} value={c.k}>
                      {t(`crm.marketingUtms.channels.${c.k}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="ut-empty">{t('crm.marketingUtms.loading')}</div>
            ) : rows.length === 0 ? (
              <div className="ut-empty">{links.length === 0 ? t('crm.marketingUtmLinks.list.emptyAll') : t('crm.marketingUtmLinks.list.empty')}</div>
            ) : (
              <>
                <div className="ul-scroll">
                  <table className="ul-table">
                    <thead>
                      <tr>
                        <th>{t('crm.marketingUtmLinks.table.link')}</th>
                        <th>{t('crm.marketingUtmLinks.table.channel')}</th>
                        <th>{t('crm.marketingUtmLinks.table.campaign')}</th>
                        <th className="r">{t('crm.marketingUtmLinks.table.clicks')}</th>
                        <th className="r">{t('crm.marketingUtmLinks.table.leads')}</th>
                        <th className="r">CR</th>
                        <th className="r">{t('crm.marketingUtmLinks.table.created')}</th>
                        <th className="r" style={{ width: 150 }}>
                          {t('crm.marketingUtmLinks.table.actions')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((l) => (
                        <tr key={l.id}>
                          <td>
                            <div className="ul-nm">{l.name}</div>
                            <div className="ul-url" title={fullUrl(l)}>
                              {fullUrl(l).replace(/^https?:\/\//, '')}
                            </div>
                          </td>
                          <td>
                            <span className="ul-chip">{channelName(l.channelType)}</span>
                            <div className="ul-sub">
                              {l.utmSource || '—'} / {l.utmMedium || '—'}
                            </div>
                          </td>
                          <td className="ul-mono">
                            {l.utmCampaign || '—'}
                            {l.utmContent && <div className="ul-sub">{l.utmContent}</div>}
                          </td>
                          <td className="r">
                            {l.clicks === null ? (
                              <span className="ul-na">—</span>
                            ) : (
                              <div className="ul-bars">
                                <span className="tr">
                                  <i style={{ width: `${((l.clicks || 0) / maxClicks) * 100}%` }} />
                                </span>
                                {nf(l.clicks)}
                              </div>
                            )}
                          </td>
                          <td className="r">{nf(l.leads)}</td>
                          <td className="r">{crCell(l)}</td>
                          <td className="r">
                            <div>{fmtDate(l.createdAt)}</div>
                            {l.createdByName && <div className="ul-sub">{l.createdByName}</div>}
                          </td>
                          <td>
                            <Actions l={l} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* телефон: карточки вместо широкой таблицы */}
                <div className="ul-cards">
                  {rows.map((l) => (
                    <div className="ul-card" key={l.id}>
                      <div className="ul-nm">{l.name}</div>
                      <div className="ul-url" title={fullUrl(l)}>
                        {fullUrl(l).replace(/^https?:\/\//, '')}
                      </div>
                      <div className="ul-card-tags">
                        <span className="ul-chip">{channelName(l.channelType)}</span>
                        <span className="ul-sub" style={{ marginTop: 0 }}>
                          {l.utmSource || '—'} / {l.utmMedium || '—'}
                          {l.utmCampaign ? ` · ${l.utmCampaign}` : ''}
                        </span>
                      </div>
                      <div className="ul-card-grid">
                        <div>
                          <div className="k">{t('crm.marketingUtmLinks.table.clicks')}</div>
                          <div className="v">{clicksCell(l)}</div>
                        </div>
                        <div>
                          <div className="k">{t('crm.marketingUtmLinks.table.leads')}</div>
                          <div className="v">{nf(l.leads)}</div>
                        </div>
                        <div>
                          <div className="k">CR</div>
                          <div className="v">{crCell(l)}</div>
                        </div>
                      </div>
                      <div className="ul-card-foot">
                        <span>
                          {fmtDate(l.createdAt)}
                          {l.createdByName ? ` · ${l.createdByName}` : ''}
                        </span>
                        <Actions l={l} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className="ut-foot">{t('crm.marketingUtmLinks.foot')}</div>
          </div>
        </div>
      </div>

      {drawer &&
        createPortal(
          <NewLinkDrawer
            onClose={() => setDrawer(false)}
            onCreated={(msg) => {
              setError(null);
              setStatus(msg);
              void load();
            }}
            onError={(msg) => {
              setStatus(null);
              setError(msg);
            }}
          />,
          document.body,
        )}
      {qr && createPortal(<QrDialog link={qr} onClose={() => setQr(null)} onCopy={() => void copy(qr)} />, document.body)}
    </MainLayout>
  );
};
