// src/pages/media/MediaPage.tsx — «Медиа» (порт Claude Design media.html → components/media-crm.jsx)
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import {
  downloadMediaStatsCsv,
  fetchMediaLinks,
  fetchMediaOverview,
  fetchMediaStats,
  updateMediaLink,
  type MediaLink,
  type MediaOverview,
  type MediaPeriod,
  type MediaStats,
} from '../../api/media';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { MediaFilesTab, type ShareInit } from './MediaFilesTab';
import { MediaLinkModal } from './MediaLinkModal';
import { MediaFormTab } from './MediaFormTab';
import { Ic, MIC, Spark, Thumb, copyText, cx, fmtBytes, fmtDate, fmtNum } from './mediaUi';
import './media.css';

type Tab = 'files' | 'links' | 'stats' | 'form';
const TABS: Tab[] = ['files', 'links', 'stats', 'form'];

const readHash = (): Tab => {
  const h = (window.location.hash || '').slice(1) as Tab;
  return TABS.includes(h) ? h : 'files';
};

export const MediaPage: React.FC = () => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const [tab, setTab] = useState<Tab>(readHash);
  const [overview, setOverview] = useState<MediaOverview | null>(null);
  const [links, setLinks] = useState<MediaLink[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ init?: ShareInit; edit?: MediaLink } | null>(null);
  const [statLink, setStatLink] = useState('all');
  const [fresh, setFresh] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [o, l] = await Promise.all([fetchMediaOverview(), fetchMediaLinks()]);
      setOverview(o);
      setLinks(l);
      setError(null);
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    const h = () => setTab(readHash());
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  const go = (x: Tab) => { window.history.replaceState(null, '', `#${x}`); setTab(x); };

  const publicBase = useMemo(() => {
    const u = links[0]?.url;
    return u ? u.slice(0, u.length - links[0].slug.length) : `${window.location.origin}/m/`;
  }, [links]);
  const activeLinks = links.filter((l) => l.enabled && !l.expired);
  const latestActive = activeLinks[0];

  const newLink = () => setModal({ init: { folderIds: [], scope: overview?.hotels.length ? 'hotel' : 'agency', hotelId: overview?.hotels[0]?.id ?? null } });

  return (
    <MainLayout>
      <div className="mf-scope">
        <div className="md-hero">
          <div>
            <h1>{t('crm.media.title')}</h1>
            <p>{t('crm.media.subtitle')}</p>
          </div>
          <div className="md-hero-a">
            {latestActive && (
              <a className="btn btn-sm" href={latestActive.url} target="_blank" rel="noreferrer"><Ic d={MIC.eye} size={13} />{t('crm.media.clientPage')}</a>
            )}
            <button type="button" className="btn btn-sm btn-primary" onClick={newLink} disabled={!overview}><Ic d={MIC.link} size={13} />{t('crm.media.newLink')}</button>
          </div>
        </div>

        <div className="md-tabs" role="tablist">
          {TABS.map((x) => (
            <button type="button" role="tab" aria-selected={tab === x} key={x} className={cx('md-tab', tab === x && 'on')} onClick={() => go(x)}>
              {t(`crm.media.tab_${x}`)}
              {x === 'files' && overview && <span className="n">{overview.totals.files}</span>}
              {x === 'links' && <span className="n">{activeLinks.length}</span>}
            </button>
          ))}
        </div>

        {error && !overview && (
          <div className="md-card"><div className="md-empty"><div className="t">{t('crm.media.loadError')}</div>{error}<div style={{ marginTop: 12 }}><button type="button" className="btn btn-sm" onClick={() => void reload()}>{t('crm.media.retry')}</button></div></div></div>
        )}
        {!overview && !error && <div className="md-skel" style={{ height: 520 }} />}

        {overview && tab === 'files' && <MediaFilesTab overview={overview} links={links} reload={reload} onShare={(init) => setModal({ init })} />}
        {overview && tab === 'links' && (
          <LinksTab
            overview={overview}
            links={links}
            fresh={fresh}
            onNew={newLink}
            onEdit={(l) => setModal({ edit: l })}
            onToggle={async (l) => {
              try {
                const saved = await updateMediaLink(l.id, { enabled: !l.enabled });
                setLinks((ls) => ls.map((x) => (x.id === l.id && saved ? saved : x)));
              } catch (e: any) { showAlert(e?.message || String(e), { variant: 'error' }); }
            }}
            onStats={(id) => { setStatLink(id); go('stats'); }}
          />
        )}
        {overview && tab === 'stats' && <StatsTab links={links} link={statLink} setLink={setStatLink} />}
        {overview && tab === 'form' && <MediaFormTab />}

        {modal && overview && (
          <MediaLinkModal
            overview={overview}
            init={modal.init}
            edit={modal.edit}
            publicBase={publicBase}
            onClose={() => setModal(null)}
            onSaved={(l) => {
              setLinks((ls) => (ls.some((x) => x.id === l.id) ? ls.map((x) => (x.id === l.id ? l : x)) : [l, ...ls]));
              setFresh(l.id);
              void reload();
            }}
            onDeleted={(id) => { setLinks((ls) => ls.filter((x) => x.id !== id)); void reload(); }}
          />
        )}
      </div>
    </MainLayout>
  );
};

/* ─── Ссылки ───────────────────────────── */
const LinksTab: React.FC<{
  overview: MediaOverview;
  links: MediaLink[];
  fresh: string | null;
  onNew: () => void;
  onEdit: (l: MediaLink) => void;
  onToggle: (l: MediaLink) => void;
  onStats: (id: string) => void;
}> = ({ overview, links, fresh, onNew, onEdit, onToggle, onStats }) => {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || 'ru').slice(0, 2);
  const [hf, setHf] = useState('all');
  const [copied, setCopied] = useState<string | null>(null);
  const hasHotels = overview.hotels.length > 0;
  const rows = links.filter((l) =>
    hf === 'all' ? true : hf === 'multi' ? l.scope === 'multi' : hf === 'none' ? l.scope === 'agency' : l.scope === 'hotel' && l.hotelIds.includes(hf),
  );
  const target = (l: MediaLink) => {
    if (l.scope === 'multi') return t('crm.media.targetAllShort', { count: l.hotelIds.length });
    if (l.scope === 'agency') return hasHotels ? t('crm.media.noHotel') : '—';
    return overview.hotels.find((h) => h.id === l.hotelIds[0])?.name ?? '—';
  };
  const copy = (l: MediaLink) => { void copyText(l.url); setCopied(l.id); setTimeout(() => setCopied(null), 1400); };

  return (
    <div className="md-card">
      <div className="md-bar">
        {hasHotels && (
          <div className="md-seg" style={{ overflowX: 'auto', maxWidth: '100%' }}>
            {[['all', t('crm.media.filterAll')], ...overview.hotels.map((h) => [h.id, h.name]), ['multi', t('crm.media.filterMulti')], ['none', t('crm.media.noHotel')]].map(([k, l]) => (
              <button type="button" key={k} className={cx(hf === k && 'on')} onClick={() => setHf(k)}>{l}</button>
            ))}
          </div>
        )}
        <span style={{ flex: 1 }} />
        <button type="button" className="btn btn-sm btn-primary" onClick={onNew}><Ic d={MIC.plus} size={13} />{t('crm.media.newLink')}</button>
      </div>
      {rows.length === 0 ? (
        <div className="md-empty">
          <div className="t">{t('crm.media.noLinksTitle')}</div>
          {t('crm.media.noLinksText')}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="md-tbl">
            <thead>
              <tr>
                <th>{t('crm.media.colLink')}</th>
                {hasHotels && <th>{t('crm.media.hotel')}</th>}
                <th>{t('crm.media.colAccess')}</th>
                <th className="r">{t('crm.media.colViews')}</th>
                <th className="r">{t('crm.media.colDownloads')}</th>
                <th className="r">{t('crm.media.colLeads')}</th>
                <th>{t('crm.media.col14d')}</th>
                <th>{t('crm.media.colStatus')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id} className={cx(fresh === l.id && 'mf-fresh')} onClick={() => onStats(l.id)}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{l.name}</div>
                    <div className="mono mf-slug">/m/{l.slug} · {[l.folderIds.length ? t('crm.media.foldersN', { count: l.folderIds.length }) : null, l.fileIds.length ? t('crm.media.filesN', { count: l.fileIds.length }) : null].filter(Boolean).join(' + ')}</div>
                  </td>
                  {hasHotels && <td style={{ whiteSpace: 'nowrap' }}>{target(l)}</td>}
                  <td>
                    <div className="mf-flags">
                      {l.gate ? <span className="md-st"><Ic d={MIC.form} size={11} />{t('crm.media.flagForm')}</span> : <span className="md-st draft">{t('crm.media.flagOpen')}</span>}
                      {l.hasPassword && <span className="md-st" title={t('crm.media.password')}><Ic d={MIC.lock} size={11} /></span>}
                      {!l.allowZip && <span className="md-st draft" title={t('crm.media.tgZip')}>1×</span>}
                    </div>
                    <div className="mf-slug">{l.expiresAt ? t('crm.media.until', { date: fmtDate(l.expiresAt, lang) }) : t('crm.media.noExpiry')}</div>
                  </td>
                  <td className="sum">{fmtNum(l.views, lang)}<div className="mf-sub">{t('crm.media.uniqN', { n: fmtNum(l.uniq, lang) })}</div></td>
                  <td className="sum">{fmtNum(l.downloads, lang)}</td>
                  <td className="sum">
                    {l.gate ? fmtNum(l.leads, lang) : '—'}
                    {l.gate && l.uniq > 0 && <div className="mf-sub">{t('crm.media.convN', { n: Math.round((l.leads / l.uniq) * 100) })}</div>}
                  </td>
                  <td style={{ color: 'var(--ink)' }}><Spark d={l.spark} /></td>
                  <td>
                    <span
                      className={cx('md-st', l.enabled && !l.expired ? 'ok' : l.expired ? 'bad' : 'draft')}
                      style={{ cursor: 'pointer' }}
                      title={t('crm.media.toggleHint')}
                      onClick={(e) => { e.stopPropagation(); onToggle(l); }}
                    >
                      <span className="dot" />
                      {l.expired ? t('crm.media.stExpired') : l.enabled ? t('crm.media.stOn') : t('crm.media.stOff')}
                    </span>
                  </td>
                  <td>
                    <div className="md-acts" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="md-ib" title={t('crm.media.copy')} onClick={() => copy(l)}><Ic d={copied === l.id ? MIC.check : MIC.copy} size={13} /></button>
                      <a className="md-ib" title={t('crm.media.openAsClient')} href={l.url} target="_blank" rel="noreferrer"><Ic d={MIC.ext} size={13} /></a>
                      <button type="button" className="md-ib" title={t('crm.media.editLink')} onClick={() => onEdit(l)}><Ic d={MIC.edit} size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="md-foot"><span>{t('crm.media.linksFoot')}</span></div>
    </div>
  );
};

/* ─── Аналитика ─────────────────────────── */
const StatsTab: React.FC<{ links: MediaLink[]; link: string; setLink: (id: string) => void }> = ({ links, link, setLink }) => {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || 'ru').slice(0, 2);
  const { showAlert } = useAlertModal();
  const [period, setPeriod] = useState<MediaPeriod>('30');
  const [s, setS] = useState<MediaStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let off = false;
    setLoading(true);
    fetchMediaStats(link, period)
      .then((r) => { if (!off) setS(r); })
      .catch((e: any) => showAlert(e?.message || String(e), { variant: 'error' }))
      .finally(() => { if (!off) setLoading(false); });
    // живое обновление ленты, пока вкладка открыта
    const h = setInterval(() => { fetchMediaStats(link, period).then((r) => { if (!off) setS(r); }).catch(() => undefined); }, 30000);
    return () => { off = true; clearInterval(h); };
  }, [link, period, showAlert]);

  // ряд с нулями для пустых дней — иначе столбики «склеиваются»
  const days = useMemo(() => {
    if (!s) return [];
    const map = new Map(s.series.map((x) => [String(x.d).slice(0, 10), x]));
    if (s.bucket === 'week' || period === 'all') return s.series.map((x) => ({ d: String(x.d).slice(0, 10), v: x.views, f: x.files }));
    const n = Number(period);
    const out: Array<{ d: string; v: number; f: number }> = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const x = map.get(key);
      out.push({ d: key, v: x?.views ?? 0, f: x?.files ?? 0 });
    }
    return out;
  }, [s, period]);
  const mx = Math.max(1, ...days.map((x) => Math.max(x.v, x.f)));
  const k = s?.kpi;
  const funnel0 = s?.funnel[0]?.n || 0;
  const leadSt = (st: string | null) => (st ? t(`crm.media.leadStatus_${st}`, { defaultValue: st }) : null);

  return (
    <>
      <div className="md-bar mf-sbar">
        <span className="mf-lbl">{t('crm.media.colLink')}</span>
        <select className="md-sel" style={{ width: 'auto', minWidth: 220, maxWidth: '100%' }} value={link} onChange={(e) => setLink(e.target.value)}>
          <option value="all">{t('crm.media.allLinks')}</option>
          {links.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <span style={{ flex: 1 }} />
        <div className="md-seg">
          {(['7', '30', '90', 'all'] as MediaPeriod[]).map((p) => (
            <button type="button" key={p} className={cx(period === p && 'on')} onClick={() => setPeriod(p)}>{p === 'all' ? t('crm.media.allTime') : t('crm.media.days', { count: Number(p) })}</button>
          ))}
        </div>
        <button type="button" className="btn btn-sm" onClick={() => void downloadMediaStatsCsv(link, period).catch((e) => showAlert(String(e?.message || e), { variant: 'error' }))}><Ic d={MIC.dl} size={12} />CSV</button>
      </div>

      {!s && loading ? <div className="md-skel" style={{ height: 420 }} /> : s && k && (
        <div style={{ opacity: loading ? 0.6 : 1, transition: 'opacity .2s' }}>
          <div className="md-kpis mf-kpis5">
            {[
              [t('crm.media.kpiViews'), fmtNum(k.views, lang), t('crm.media.kpiViewsD', { n: fmtNum(k.uniq, lang) })],
              [t('crm.media.kpiFiles'), fmtNum(k.files, lang), t('crm.media.kpiFilesD', { n: (k.files / Math.max(1, k.uniq)).toFixed(1) })],
              [t('crm.media.kpiLeads'), fmtNum(k.leads, lang), t('crm.media.kpiLeadsD')],
              [t('crm.media.kpiConv'), `${Math.round((k.leads / Math.max(1, k.uniq)) * 100)}%`, t('crm.media.kpiConvD')],
              [t('crm.media.kpiTraffic'), fmtBytes(k.bytes, lang), t('crm.media.kpiTrafficD', { n: fmtNum(k.downloads, lang) })],
            ].map(([kk, v, d]) => (
              <div key={kk} className="md-kpi"><div className="k">{kk}</div><div className="v">{v}</div><div className="d">{d}</div></div>
            ))}
          </div>

          <div className="mf-grid2">
            <div className="md-card">
              <div className="md-card-head">
                <div><h3>{t('crm.media.chartTitle')}</h3><div className="sub">{s.bucket === 'week' ? t('crm.media.chartByWeek') : t('crm.media.chartByDay')}</div></div>
                <div className="mf-leg"><span><i className="a" />{t('crm.media.legViews')}</span><span><i className="b" />{t('crm.media.legFiles')}</span></div>
              </div>
              {days.length === 0 ? <div className="md-empty">{t('crm.media.noData')}</div> : (
                <>
                  <div className="mf-chart">
                    {days.map((x) => (
                      <div key={x.d} className="col" title={`${fmtDate(x.d, lang)} · ${t('crm.media.tipViews', { n: x.v })} · ${t('crm.media.tipFiles', { n: x.f })}`}>
                        <i className="b" style={{ height: `${(x.f / mx) * 100}%` }} />
                        <i className="a" style={{ height: `${(x.v / mx) * 100}%` }} />
                      </div>
                    ))}
                  </div>
                  <div className="mf-axis">
                    <span>{fmtDate(days[0].d, lang)}</span>
                    {days.length > 2 && <span>{fmtDate(days[Math.floor(days.length / 2)].d, lang)}</span>}
                    <span>{fmtDate(days[days.length - 1].d, lang)}</span>
                  </div>
                </>
              )}
            </div>
            <div className="md-card">
              <div className="md-card-head"><div><h3>{t('crm.media.funnel')}</h3><div className="sub">{t('crm.media.funnelSub')}</div></div></div>
              <div className="md-body">
                {s.funnel.map((f, i) => (
                  <div key={f.key} className="mf-fn">
                    <div className="t">
                      <span>{t(`crm.media.fn_${f.key}`)}</span>
                      <span className="mono">{fmtNum(f.n, lang)}{i > 0 && funnel0 > 0 && <em> · {Math.round((f.n / funnel0) * 100)}%</em>}</span>
                    </div>
                    <div className="bar"><i style={{ width: `${funnel0 ? (f.n / funnel0) * 100 : 0}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mf-grid2" style={{ gridTemplateColumns: 'minmax(0,1fr) 340px' }}>
            <div className="md-card">
              <div className="md-card-head">
                <div><h3>{t('crm.media.whoDownloaded')}</h3><div className="sub">{t('crm.media.whoDownloadedSub')}</div></div>
                <Link className="btn btn-sm" to="/leads">{t('crm.media.openLeads')}</Link>
              </div>
              {s.feed.length === 0 ? <div className="md-empty">{t('crm.media.noDownloadsYet')}</div> : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="md-tbl">
                    <thead>
                      <tr><th>{t('crm.media.colContact')}</th><th>{t('crm.media.colCompany')}</th><th>{t('crm.media.colWhat')}</th><th>{t('crm.media.colLink')}</th><th>{t('crm.media.colWhen')}</th><th>{t('crm.media.colLead')}</th></tr>
                    </thead>
                    <tbody>
                      {s.feed.map((a) => (
                        <tr key={a.id} onClick={() => { if (a.leadId) window.open(`/leads/${a.leadId}`, '_self'); }} style={a.leadId ? undefined : { cursor: 'default' }}>
                          <td>
                            {a.email || a.name ? (
                              <div className="md-cl">
                                <div className="md-av">{(a.name || a.email || '?').split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase()}</div>
                                <div style={{ minWidth: 0 }}><div className="nm">{a.name || a.email}</div><div className="cm">{[a.email, a.phone].filter(Boolean).join(' · ')}</div></div>
                              </div>
                            ) : (
                              <div className="md-cl"><div className="md-av" style={{ color: 'var(--fg-4)' }}>?</div><div className="cm">{t('crm.media.noForm')}</div></div>
                            )}
                          </td>
                          <td>{a.company || <span style={{ color: 'var(--fg-4)' }}>—</span>}{a.role && <div className="mf-sub">{a.role}</div>}</td>
                          <td>
                            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                              <Ic d={a.type === 'download' ? (a.zip ? MIC.zip : MIC.dl) : MIC.form} size={12} />
                              {a.type === 'lead' ? t('crm.media.filledForm') : a.what}
                            </span>
                          </td>
                          <td className="mf-slug" style={{ whiteSpace: 'nowrap' }}>{a.linkName}</td>
                          <td className="num">{fmtDate(a.at, lang, true)}</td>
                          <td>{a.leadStatus ? <span className={cx('md-st', a.leadStatus === 'new' ? 'wait' : a.leadStatus === 'lost' ? 'bad' : 'ok')}><span className="dot" />{leadSt(a.leadStatus)}</span> : <span style={{ color: 'var(--fg-4)' }}>—</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="md-card">
              <div className="md-card-head"><div><h3>{t('crm.media.topFiles')}</h3><div className="sub">{t('crm.media.topFilesSub')}</div></div></div>
              {s.topFiles.length === 0 ? <div className="md-empty">{t('crm.media.noData')}</div> : (
                <div>
                  {s.topFiles.map((f, i) => (
                    <div key={f.id} className="mf-top">
                      <span className="mono r">{i + 1}</span>
                      <div className="mf-mini"><Thumb f={f} /></div>
                      <div style={{ minWidth: 0, flex: 1 }}><div className="fn">{f.name}</div><div className="fm">{fmtBytes(f.sizeBytes, lang)}</div></div>
                      <span className="mono">{f.periodDownloads}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
