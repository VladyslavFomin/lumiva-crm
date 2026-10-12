import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { auraApi, type AuraApp, type AuraCustomWidget, type AuraData, type AuraPeriod } from '../../api/aura';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { AU_SOURCES, AU_TEMPLATES, AU_TEMPLATE_WIDGETS, AU_TPL_CATS, auDetectSources, draftFromTemplate, AU_EMPTY, type AuTemplate } from './auraModel';
import { AU_I, AuIc, AuraShell, auraInvalidate, setAuraDraft, useAgo, useAuraPreview, useReveal } from './auraShared';
import { AuraDash, AuScaled, AuThumb } from './AuraDash';

/* ---------- данные для миниатюр ---------- */

/** Один запрос на все виджеты шаблонов — миниатюры показывают реальные данные компании. */
function useTemplateData() {
  return useAuraPreview({ widgets: AU_TEMPLATE_WIDGETS, period: '30d', breakdown: [], goals: {} }).data;
}

/** Данные для миниатюр приложений: по одному запросу на каждый период. */
function useAppsData(apps: AuraApp[]) {
  const byPeriod = useMemo(() => {
    const m = new Map<AuraPeriod, { widgets: string[]; custom: AuraCustomWidget[] }>();
    for (const a of apps) {
      const cur = m.get(a.config.period) || { widgets: [], custom: [] };
      m.set(a.config.period, { widgets: [...new Set([...cur.widgets, ...a.config.widgets])], custom: [...cur.custom, ...(a.config.custom || [])] });
    }
    return m;
  }, [apps]);
  const inp = (p: AuraPeriod) => (byPeriod.has(p) ? { ...byPeriod.get(p)!, period: p } : null);
  const today = useAuraPreview(inp('today')).data;
  const d7 = useAuraPreview(inp('7d')).data;
  const d30 = useAuraPreview(inp('30d')).data;
  const q = useAuraPreview(inp('quarter')).data;
  const y = useAuraPreview(inp('year')).data;
  return (p: AuraPeriod): AuraData | null => ({ today, '7d': d7, '30d': d30, quarter: q, year: y })[p] ?? null;
}

/* ---------- сетки ---------- */

export function AuAppGrid({ apps, onChanged }: { apps: AuraApp[]; onChanged: () => void }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const ago = useAgo();
  const dataOf = useAppsData(apps);
  const { showConfirm, showAlert } = useAlertModal();
  const del = async (a: AuraApp) => {
    if (!(await showConfirm(t('crm.aura.apps.deleteConfirm', { name: a.name })))) return;
    try {
      await auraApi.remove(a.id);
      auraInvalidate();
      onChanged();
    } catch (e) {
      showAlert((e as Error).message);
    }
  };
  const dup = async (a: AuraApp) => {
    try {
      const n = await auraApi.duplicate(a.id, t('crm.aura.apps.copyName', { name: a.name }));
      onChanged();
      nav(`/aura/build/${n.id}`);
    } catch (e) {
      showAlert((e as Error).message);
    }
  };
  return (
    <div className="au-cards">
      {apps.map((a) => (
        <div key={a.id} className="au-card au-rv">
          <button type="button" className="au-card-thumb" onClick={() => nav(a.kiosk ? `/aura/app/${a.id}` : `/aura/view/${a.id}`)}>
            <AuThumb title={a.name} sources={a.config.sources} widgets={a.config.widgets} theme={a.theme} density={a.density} data={dataOf(a.config.period)} period={a.config.period} breakdown={a.config.breakdown} custom={a.config.custom || []} style={a.config.style || null} />
          </button>
          <div className="au-card-b">
            <div>
              <div className="au-card-t">{a.name}</div>
              <div className="au-card-m">
                {t(`crm.aura.access.${a.access}.name`)}
                {a.share.enabled ? ` · ${t('crm.aura.apps.public')}` : ''} · {ago(a.updatedAt)}
                {!a.isMine && a.ownerName ? ` · ${a.ownerName}` : ''}
              </div>
            </div>
            <div className="au-card-act">
              {a.canEdit && (
                <button type="button" className="app-topbar-btn" title={t('crm.aura.apps.edit')} onClick={() => nav(`/aura/build/${a.id}`)}>
                  <AuIc d={AU_I.edit} size={15} />
                </button>
              )}
              <button type="button" className="app-topbar-btn" title={t('crm.aura.apps.openFull')} onClick={() => nav(`/aura/app/${a.id}`)}>
                <AuIc d={AU_I.open} size={15} />
              </button>
              <button type="button" className="app-topbar-btn" title={t('crm.aura.apps.duplicate')} onClick={() => dup(a)}>
                <AuIc d={AU_I.copy} size={15} />
              </button>
              {a.canEdit && (
                <button type="button" className="app-topbar-btn" title={t('crm.aura.apps.delete')} onClick={() => del(a)}>
                  <AuIc d={AU_I.trash} size={15} />
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
      <button type="button" className="au-card au-card-new" onClick={() => nav('/aura')}>
        <AuIc d={AU_I.plus} size={18} />
        {t('crm.aura.apps.new')}
      </button>
    </div>
  );
}

function useTemplateStart() {
  const { t } = useTranslation();
  const nav = useNavigate();
  return (tp: AuTemplate, viaAi: boolean) => {
    const title = t(`crm.aura.tpl.${tp.id}.name`);
    const d = draftFromTemplate(tp, title, viaAi);
    if (viaAi) {
      d.prompt = t('crm.aura.tpl.adaptPrompt', { name: title });
      d.briefPending = false;
    }
    setAuraDraft(d);
    nav(viaAi ? '/aura/brief' : '/aura/build');
  };
}

export function AuTplGrid({ list, data }: { list: AuTemplate[]; data: AuraData | null }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<AuTemplate | null>(null);
  const start = useTemplateStart();
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open]);
  return (
    <>
      <div className="au-cards">
        {list.map((tp) => (
          <div key={tp.id} className="au-card au-rv">
            <button type="button" className="au-card-thumb" onClick={() => setOpen(tp)}>
              <AuThumb title={t(`crm.aura.tpl.${tp.id}.name`)} sources={tp.sources} widgets={tp.widgets} theme={tp.theme} density={tp.density || 'normal'} data={data} period="30d" breakdown={tp.breakdown} />
            </button>
            <div className="au-card-b">
              <div>
                <div className="au-card-t">{t(`crm.aura.tpl.${tp.id}.name`)}</div>
                <div className="au-card-m">{t(`crm.aura.tpl.${tp.id}.desc`)}</div>
              </div>
            </div>
            <div className="au-card-tags">
              <span className="tag">{t(`crm.aura.theme.${tp.theme}.name`)}</span>
              {tp.sources.map((s) => (
                <span key={s} className="tag">
                  {t(`crm.aura.src.${s}.name`)}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      {open && (
        <div className="au-modal-bg lv-backdrop" onClick={() => setOpen(null)}>
          <div className="au-modal au-modal-lg lv-dialog" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
            <div className="au-modal-h">
              <div>
                <h3>{t(`crm.aura.tpl.${open.id}.name`)}</h3>
                <p>{t(`crm.aura.tpl.${open.id}.desc`)}</p>
              </div>
              <button type="button" className="app-topbar-btn" onClick={() => setOpen(null)} aria-label={t('crm.aura.close')}>
                <AuIc d={AU_I.x} size={16} />
              </button>
            </div>
            <div className="au-modal-prev">
              <AuScaled width={1280}>
                <AuraDash title={t(`crm.aura.tpl.${open.id}.name`)} sources={open.sources} widgets={open.widgets} theme={open.theme} density={open.density || 'normal'} data={data} period="30d" breakdown={open.breakdown} still />
              </AuScaled>
            </div>
            <div className="au-modal-f">
              <span className="au-muted">{t('crm.aura.tpl.realData')}</span>
              <div className="au-row">
                <button type="button" className="btn" onClick={() => start(open, true)}>
                  <AuIc d={AU_I.aura} size={14} />
                  {t('crm.aura.tpl.adapt')}
                </button>
                <button type="button" className="btn btn-primary" onClick={() => start(open, false)}>
                  {t('crm.aura.tpl.use')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- главная ---------- */

function useTypewriter(list: string[], on: boolean) {
  const [text, setText] = useState('');
  const st = useRef({ i: 0, c: 0, del: false });
  useEffect(() => {
    if (!on || !list.length) return;
    let tm: number;
    const step = () => {
      const s = st.current;
      const full = list[s.i % list.length];
      if (!s.del) {
        s.c++;
        setText(full.slice(0, s.c));
        if (s.c >= full.length) {
          s.del = true;
          tm = window.setTimeout(step, 1900);
          return;
        }
        tm = window.setTimeout(step, 28 + Math.random() * 30);
      } else {
        s.c -= 2;
        setText(full.slice(0, Math.max(0, s.c)));
        if (s.c <= 0) {
          s.del = false;
          s.i = (s.i + 1) % list.length;
          tm = window.setTimeout(step, 350);
          return;
        }
        tm = window.setTimeout(step, 12);
      }
    };
    tm = window.setTimeout(step, 600);
    return () => window.clearTimeout(tm);
  }, [on, list]);
  return text;
}

function Rotator({ words }: { words: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setI((x) => (x + 1) % words.length), 2600);
    return () => window.clearInterval(id);
  }, [words.length]);
  return (
    <span className="ah-rot">
      <span key={i} className="ah-rot-w">
        {words[i]}
      </span>
    </span>
  );
}

function Showcase({ data }: { data: AuraData | null }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const list = AU_TEMPLATES;
  const [c, setC] = useState(0);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [pause, setPause] = useState(false);
  useEffect(() => {
    if (pause) return;
    const id = window.setInterval(() => setC((x) => (x + 1) % list.length), 3800);
    return () => window.clearInterval(id);
  }, [pause, list.length]);
  const move = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setTilt({ x: ((e.clientY - r.top) / r.height - 0.5) * -6, y: ((e.clientX - r.left) / r.width - 0.5) * 8 });
  };
  const n = list.length;
  return (
    <div className="ah-show" onMouseMove={move} onMouseEnter={() => setPause(true)} onMouseLeave={() => { setTilt({ x: 0, y: 0 }); setPause(false); }}>
      <div className="ah-show-stage" style={{ ['--rx' as string]: `${12 + tilt.x}deg`, ['--ry' as string]: `${tilt.y}deg` } as React.CSSProperties}>
        {list.map((tp, i) => {
          let p = (((i - c) % n) + n) % n;
          if (p > n / 2) p -= n;
          const cls = p < -1 ? '-x' : p > 1 ? 'x' : String(p);
          return (
            <div
              key={tp.id}
              role="button"
              tabIndex={p === 0 ? 0 : -1}
              aria-label={t(`crm.aura.tpl.${tp.id}.name`)}
              className={'ah-shot ah-p' + cls}
              onClick={() => (p === 0 ? nav('/aura/templates') : setC(i))}
              onKeyDown={(e) => e.key === 'Enter' && (p === 0 ? nav('/aura/templates') : setC(i))}
            >
              <div className="ah-shot-in">
                <AuThumb title={t(`crm.aura.tpl.${tp.id}.name`)} sources={tp.sources} widgets={tp.widgets} theme={tp.theme} density={tp.density || 'normal'} data={data} period="30d" breakdown={tp.breakdown} />
              </div>
              <div className="ah-shot-cap">
                <b>{t(`crm.aura.tpl.${tp.id}.name`)}</b>
                <span>{t(`crm.aura.theme.${tp.theme}.name`)}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="ah-dots">
        {list.map((tp, i) => (
          <button type="button" key={tp.id} className={i === c ? 'on' : ''} onClick={() => setC(i)} aria-label={t(`crm.aura.tpl.${tp.id}.name`)} />
        ))}
      </div>
    </div>
  );
}

export function startAuraFromPrompt(text: string) {
  setAuraDraft({ ...AU_EMPTY, prompt: text, sources: [], widgets: [], step: 0, briefPending: true, appId: null, tpl: null });
}

function useApps() {
  const [apps, setApps] = useState<AuraApp[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = () =>
    auraApi
      .list()
      .then((a) => {
        setApps(a);
        setErr(null);
      })
      .catch((e: Error) => setErr(e.message));
  useEffect(() => {
    void load();
  }, []);
  return { apps, err, reload: load };
}

export const AuraHomePage: React.FC = () => {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [p, setP] = useState('');
  const [focus, setFocus] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const typeList = useMemo(() => t('crm.aura.home.typed', { returnObjects: true }) as string[], [t]);
  const words = useMemo(() => t('crm.aura.home.words', { returnObjects: true }) as string[], [t]);
  const suggest = useMemo(() => t('crm.aura.home.suggest', { returnObjects: true }) as string[], [t]);
  const typed = useTypewriter(Array.isArray(typeList) ? typeList : [], !p && !focus);
  const detected = p ? auDetectSources(p) : [];
  const tplData = useTemplateData();
  const { apps, reload } = useApps();
  const rv = useReveal();
  const start = (text?: string) => {
    const v = (text ?? p).trim();
    if (!v) return;
    startAuraFromPrompt(v);
    nav('/aura/brief');
  };
  return (
    <AuraShell route="home">
      <div className="au-page ah" ref={rv}>
        <section className="ah-stage">
          <div className="ah-glow" />
          <div className="ah-hero">
            <div className="ah-kick">
              <AuIc d={AU_I.aura} size={13} />
              Lumiva Aura<span className="ah-beta">{t('crm.aura.beta')}</span>
            </div>
            <h1 className="ah-h1">
              {t('crm.aura.home.h1a')}
              <br />
              {t('crm.aura.home.h1b')} <Rotator words={Array.isArray(words) ? words : ['']} />
            </h1>
            <p className="ah-sub">{t('crm.aura.home.sub')}</p>
            <div className={'ah-prompt' + (focus ? ' focus' : '') + (p ? ' has' : '')}>
              <div className="ah-prompt-in">
                <div className="ah-ta-wrap">
                  <textarea
                    ref={ta}
                    value={p}
                    rows={2}
                    onFocus={() => setFocus(true)}
                    onBlur={() => setFocus(false)}
                    onChange={(e) => setP(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        start();
                      }
                    }}
                    aria-label={t('crm.aura.home.aria')}
                  />
                  {!p && (
                    <div className="ah-ph" onClick={() => ta.current?.focus()}>
                      {focus ? t('crm.aura.home.focusPh') : typed}
                      <i className="ah-caret" />
                    </div>
                  )}
                </div>
                <div className="ah-bar">
                  <div className="ah-srcs">
                    {AU_SOURCES.map((s) => (
                      <span key={s} className={'ah-src' + (detected.includes(s) ? ' on' : '')}>
                        {t(`crm.aura.src.${s}.name`)}
                      </span>
                    ))}
                  </div>
                  <button type="button" className="ah-go" disabled={!p.trim()} onClick={() => start()}>
                    <span>{t('crm.aura.home.create')}</span>
                    <AuIc d={AU_I.send} size={15} sw={2} />
                  </button>
                </div>
              </div>
            </div>
            <div className="ah-suggest">
              {(Array.isArray(suggest) ? suggest : []).map((s, i) => (
                <button type="button" key={s} style={{ animationDelay: 0.5 + i * 0.08 + 's' }} onClick={() => start(s)}>
                  {s}
                  <AuIc d={AU_I.send} size={12} />
                </button>
              ))}
            </div>
          </div>
          <Showcase data={tplData} />
        </section>
        <section className="au-sec">
          <div className="au-sec-h au-rv">
            <h2>{t('crm.aura.nav.apps')}</h2>
            <Link className="ah-link" to="/aura/apps">
              {t('crm.aura.home.allApps', { count: apps?.length ?? 0 })}
              <AuIc d={AU_I.send} size={13} />
            </Link>
          </div>
          {apps && <AuAppGrid apps={apps.slice(0, 3)} onChanged={reload} />}
        </section>
        <section className="au-sec">
          <div className="au-sec-h au-rv">
            <h2>{t('crm.aura.home.fromTemplate')}</h2>
            <Link className="ah-link" to="/aura/templates">
              {t('crm.aura.home.allTemplates')}
              <AuIc d={AU_I.send} size={13} />
            </Link>
          </div>
          <AuTplGrid list={AU_TEMPLATES.slice(0, 3)} data={tplData} />
        </section>
      </div>
    </AuraShell>
  );
};

export const AuraTemplatesPage: React.FC = () => {
  const { t } = useTranslation();
  const [cat, setCat] = useState<(typeof AU_TPL_CATS)[number]>('all');
  const data = useTemplateData();
  const rv = useReveal();
  const list = AU_TEMPLATES.filter((x) => cat === 'all' || x.cat === cat);
  return (
    <AuraShell route="templates">
      <div className="au-page" ref={rv}>
        <div className="au-ph">
          <div>
            <h1>{t('crm.aura.nav.templates')}</h1>
            <p className="au-muted">{t('crm.aura.tpl.sub')}</p>
          </div>
        </div>
        <div className="au-chips">
          {AU_TPL_CATS.map((c) => (
            <button type="button" key={c} className={c === cat ? 'on' : ''} onClick={() => setCat(c)}>
              {t(`crm.aura.tplCat.${c}`)}
            </button>
          ))}
        </div>
        <AuTplGrid key={cat} list={list} data={data} />
      </div>
    </AuraShell>
  );
};

export const AuraAppsPage: React.FC = () => {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { apps, err, reload } = useApps();
  const rv = useReveal();
  return (
    <AuraShell route="apps">
      <div className="au-page" ref={rv}>
        <div className="au-ph">
          <div>
            <h1>{t('crm.aura.nav.apps')}</h1>
            <p className="au-muted">{t('crm.aura.apps.sub')}</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => nav('/aura')}>
            <AuIc d={AU_I.plus} size={14} />
            {t('crm.aura.apps.newShort')}
          </button>
        </div>
        {err && <div className="au-empty">{err}</div>}
        {!apps && !err && <div className="au-empty">{t('crm.aura.dash.loading')}</div>}
        {apps && <AuAppGrid apps={apps} onChanged={reload} />}
      </div>
    </AuraShell>
  );
};
