import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { TFunction } from 'i18next';
import { auraApi, type AuraSourceKey } from '../../api/aura';
import { AU_DENSITIES, AU_FILTERS, AU_PERIODS, AU_SOURCES, AU_THEMES, AU_VIEWERS, AU_WIDGET, auDefaultWidgets, auWidgetOptions, type AuDraft } from './auraModel';
import { AU_I, AuIc, AuraShell, useAuraDraft, useAuraPreview, useFitHeight } from './auraShared';
import { AuThumb } from './AuraDash';

type Q = { id: 'sources' | 'widgets' | 'period' | 'breakdown' | 'viewer'; multi: boolean; opts: Array<{ v: string; l: string; sub?: string }> };

function questions(d: AuDraft, t: TFunction): Q[] {
  return [
    { id: 'sources', multi: true, opts: AU_SOURCES.map((s) => ({ v: s, l: t(`crm.aura.src.${s}.name`), sub: t(`crm.aura.src.${s}.desc`) })) },
    { id: 'widgets', multi: true, opts: auWidgetOptions(d.sources).map((k) => ({ v: k, l: t(`crm.aura.w.${k}`) })) },
    { id: 'period', multi: false, opts: AU_PERIODS.map((p) => ({ v: p, l: t(`crm.aura.period.${p}`) })) },
    { id: 'breakdown', multi: true, opts: AU_FILTERS.map((f) => ({ v: f, l: t(`crm.aura.filter.by.${f}`) })) },
    { id: 'viewer', multi: false, opts: AU_VIEWERS.map((v) => ({ v, l: t(`crm.aura.viewer.${v}`) })) },
  ];
}

const valueOf = (d: AuDraft, id: Q['id']): string[] | string | null =>
  id === 'sources' ? d.sources : id === 'widgets' ? d.widgets : id === 'period' ? d.period : id === 'breakdown' ? d.breakdown : d.viewer;

export const autoTitle = (d: AuDraft, t: TFunction) => d.title || (d.sources[0] ? t(`crm.aura.autoTitle.${d.sources[0]}`) : t('crm.aura.autoTitle.default'));

/** Ответ на вопрос → новый черновик (с зависимыми полями). */
function applyAnswer(d: AuDraft, id: Q['id'], val: string[] | string): AuDraft {
  if (id === 'sources') {
    const sources = (val as string[]).filter((s): s is AuraSourceKey => (AU_SOURCES as string[]).includes(s));
    const kept = d.widgets.filter((k) => {
      const m = AU_WIDGET.get(k);
      return m && (m.source === 'extra' || sources.includes(m.source as AuraSourceKey));
    });
    const added = sources.filter((s) => !kept.some((k) => AU_WIDGET.get(k)?.source === s));
    return { ...d, sources, widgets: [...kept, ...auDefaultWidgets(added)] };
  }
  if (id === 'widgets') return { ...d, widgets: val as string[] };
  if (id === 'period') return { ...d, period: val as AuDraft['period'] };
  if (id === 'breakdown') return { ...d, breakdown: val as AuDraft['breakdown'] };
  const viewer = val as AuDraft['viewer'];
  return viewer === 'tv' ? { ...d, viewer, kiosk: true, theme: 'graphite', density: 'large' } : { ...d, viewer };
}

export const AuraBriefPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const [d, setDraft] = useAuraDraft();
  const qs = questions(d, t);
  const step = d.step || 0;
  const done = step >= qs.length;
  const q = qs[Math.min(step, qs.length - 1)];
  const cur = valueOf(d, q.id);
  const [typing, setTyping] = useState(true);
  const [free, setFree] = useState('');
  const [freeBusy, setFreeBusy] = useState(false);
  const [freeMiss, setFreeMiss] = useState(false);
  const [aiNote, setAiNote] = useState<boolean | null>(null);
  const [aiErr, setAiErr] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const fitRef = useFitHeight<HTMLDivElement>();

  // разбор запроса ИИ (один раз на новый черновик)
  useEffect(() => {
    if (!d.briefPending) return;
    let alive = true;
    auraApi
      .brief(d.prompt, i18n.language || 'ru')
      .then((r) => {
        if (!alive) return;
        setAiNote(r.ai);
        setAiErr(r.aiError || null);
        const custom = r.custom || [];
        setDraft((p) => ({
          ...p,
          sources: r.sources,
          widgets: [...r.widgets, ...custom.map((c) => c.id)],
          custom,
          period: r.period,
          breakdown: r.breakdown,
          viewer: r.viewer,
          title: p.title || r.title,
          kiosk: r.viewer === 'tv',
          theme: r.viewer === 'tv' ? 'graphite' : p.theme,
          density: r.viewer === 'tv' ? 'large' : p.density,
          briefPending: false,
        }));
      })
      .catch(() => {
        if (!alive) return;
        setAiNote(false);
        setDraft((p) => ({ ...p, sources: p.sources.length ? p.sources : ['leads', 'deals'], widgets: p.widgets.length ? p.widgets : auDefaultWidgets(['leads', 'deals']), briefPending: false }));
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.briefPending]);

  useEffect(() => {
    setTyping(true);
    setFreeMiss(false);
    const id = window.setTimeout(() => setTyping(false), 700);
    return () => window.clearTimeout(id);
  }, [step]);
  useEffect(() => {
    const el = end.current?.closest('.au-chat-scroll');
    if (el) el.scrollTop = el.scrollHeight;
  }, [step, typing, d.briefPending]);

  const toggle = (v: string) => {
    if (q.multi) {
      const a = (cur as string[]) || [];
      setDraft(applyAnswer(d, q.id, a.includes(v) ? a.filter((x) => x !== v) : [...a, v]));
    } else setDraft(applyAnswer(d, q.id, v));
  };
  const next = () => setDraft((p) => ({ ...p, step: (p.step || 0) + 1 }));
  const canNext = q.multi ? q.id === 'breakdown' || ((cur as string[]) || []).length > 0 : cur != null;
  const pending = !!d.briefPending;

  const answerFree = async () => {
    const text = free.trim();
    if (!text || freeBusy) return;
    setFreeBusy(true);
    try {
      const r = await auraApi.answer(q.id, text, q.opts.map((o) => o.v));
      if (!r.values.length) {
        setFreeMiss(true);
        return;
      }
      setFree('');
      setDraft((p) => ({ ...applyAnswer(p, q.id, q.multi ? r.values : r.values[0]), step: (p.step || 0) + 1 }));
    } catch {
      setFreeMiss(true);
    } finally {
      setFreeBusy(false);
    }
  };

  const ansLabel = (qq: Q) => {
    const v = valueOf(d, qq.id);
    const arr = Array.isArray(v) ? v : v != null ? [v] : [];
    if (!arr.length) return qq.id === 'breakdown' ? t('crm.aura.brief.noBreakdown') : '—';
    return arr.map((x) => qq.opts.find((o) => o.v === x)?.l || x).join(', ');
  };
  const preview = useAuraPreview(d.widgets.length && !pending ? { widgets: d.widgets, period: d.period, breakdown: d.breakdown, custom: d.custom || [] } : null);

  return (
    <AuraShell route="brief">
      <div className="au-brief" ref={fitRef}>
        <div className="au-chat">
          <div className="au-chat-scroll">
            <div className="au-msg user">{d.prompt || t('crm.aura.brief.newApp')}</div>
            {pending ? (
              <div className="au-msg ai au-typing">
                <i />
                <i />
                <i />
              </div>
            ) : (
              <>
                {qs.slice(0, step).map((qq) => (
                  <React.Fragment key={qq.id}>
                    <div className="au-msg ai">{t(`crm.aura.brief.q.${qq.id}`)}</div>
                    <div className="au-msg user">{ansLabel(qq)}</div>
                  </React.Fragment>
                ))}
                {typing ? (
                  <div className="au-msg ai au-typing">
                    <i />
                    <i />
                    <i />
                  </div>
                ) : done ? (
                  <div className="au-msg ai">{t('crm.aura.brief.done', { widgets: d.widgets.length, sources: d.sources.length })}</div>
                ) : (
                  <div className="au-msg ai">
                    {step === 0 && aiNote === false && d.prompt ? `${t(`crm.aura.aiErr.${aiErr || 'unavailable'}`)} ${t('crm.aura.brief.qSourcesNoAi')}` : t(`crm.aura.brief.q.${q.id}`)}
                    <span className="au-q-n">{t('crm.aura.brief.qn', { n: step + 1, total: qs.length })}</span>
                  </div>
                )}
              </>
            )}
            <div ref={end} />
          </div>
          {!typing && !pending && (
            <div className="au-answer">
              {done ? (
                <div className="au-row au-end">
                  <button type="button" className="btn" onClick={() => setDraft({ ...d, step: qs.length - 1 })}>
                    {t('crm.aura.brief.change')}
                  </button>
                  <button type="button" className="btn btn-primary" onClick={() => nav('/aura/style')}>
                    {t('crm.aura.brief.toStyle')} <AuIc d={AU_I.send} size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <div className={'au-opts' + (q.id === 'sources' ? ' au-opts-src' : '')}>
                    {q.opts.map((o) => {
                      const on = q.multi ? ((cur as string[]) || []).includes(o.v) : cur === o.v;
                      return (
                        <button type="button" key={o.v} className={on ? 'on' : ''} onClick={() => toggle(o.v)}>
                          <span className="au-opt-ch">{on && <AuIc d={AU_I.check} size={11} sw={2.4} />}</span>
                          <span>
                            <b>{o.l}</b>
                            {o.sub && <em>{o.sub}</em>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {freeMiss && <div className="au-err">{t('crm.aura.brief.freeMiss')}</div>}
                  <div className="au-free">
                    <input
                      value={free}
                      disabled={freeBusy}
                      onChange={(e) => setFree(e.target.value)}
                      placeholder={t('crm.aura.brief.freePh')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void answerFree();
                      }}
                    />
                    {step > 0 && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDraft({ ...d, step: step - 1 })}>
                        {t('crm.aura.back')}
                      </button>
                    )}
                    {free.trim() ? (
                      <button type="button" className="btn btn-primary btn-sm" disabled={freeBusy} onClick={() => void answerFree()}>
                        {freeBusy ? t('crm.aura.brief.thinking') : t('crm.aura.brief.answer')}
                      </button>
                    ) : (
                      <button type="button" className="btn btn-primary btn-sm" disabled={!canNext} onClick={next}>
                        {q.id === 'breakdown' && !((cur as string[]) || []).length ? t('crm.aura.brief.skip') : t('crm.aura.brief.answer')}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        <aside className="au-brief-side">
          <div className="au-side-h">
            <span className="mono">{t('crm.aura.brief.side')}</span>
            <span className="au-muted">
              {Math.min(step, qs.length)}/{qs.length}
            </span>
          </div>
          <dl className="au-dl">
            <dt>{t('crm.aura.brief.task')}</dt>
            <dd>{d.prompt || '—'}</dd>
            <dt>{t('crm.aura.brief.data')}</dt>
            <dd className="au-tags">
              {d.sources.map((s) => (
                <span key={s} className="tag">
                  {t(`crm.aura.src.${s}.name`)}
                </span>
              ))}
            </dd>
            <dt>{t('crm.aura.brief.metrics')}</dt>
            <dd>{t('crm.aura.brief.widgetsN', { count: d.widgets.length })}</dd>
            <dt>{t('crm.aura.brief.period')}</dt>
            <dd>{t(`crm.aura.period.${d.period}`)}</dd>
            <dt>{t('crm.aura.brief.viewer')}</dt>
            <dd>{d.viewer ? t(`crm.aura.viewer.${d.viewer}`) : '—'}</dd>
          </dl>
          <div className="mono au-muted" style={{ margin: '18px 0 8px' }}>
            {t('crm.aura.brief.wire')}
          </div>
          <div className="au-wire">
            <AuThumb title={autoTitle(d, t)} sources={d.sources} widgets={d.widgets} theme="lumiva" density="normal" data={preview.data} period={d.period} breakdown={d.breakdown} custom={d.custom || []} style={d.style || null} />
          </div>
        </aside>
      </div>
    </AuraShell>
  );
};

export const AuraStylePage: React.FC = () => {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [d, setDraft] = useAuraDraft();
  const preview = useAuraPreview(d.widgets.length ? { widgets: d.widgets, period: d.period, breakdown: d.breakdown, goals: d.goals, custom: d.custom || [] } : null);
  const title = autoTitle(d, t);
  useEffect(() => {
    if (!d.widgets.length) nav('/aura', { replace: true });
  }, [d.widgets.length, nav]);
  return (
    <AuraShell route="style">
      <div className="au-page">
        <div className="au-ph">
          <div>
            <button type="button" className="au-back" onClick={() => nav('/aura/brief')}>
              <AuIc d={AU_I.back} size={14} />
              {t('crm.aura.style.toBrief')}
            </button>
            <h1>{t('crm.aura.style.h1')}</h1>
            <p className="au-muted">{t('crm.aura.style.sub')}</p>
          </div>
        </div>
        <div className="au-themes">
          {AU_THEMES.map((th) => (
            <button type="button" key={th} className={'au-theme' + (d.theme === th ? ' on' : '')} onClick={() => setDraft({ ...d, theme: th })}>
              <div className="au-theme-prev">
                <AuThumb title={title} sources={d.sources} widgets={d.widgets} theme={th} density={d.density} data={preview.data} period={d.period} breakdown={d.breakdown} custom={d.custom || []} />
              </div>
              <div className="au-theme-b">
                <span className="au-opt-ch">{d.theme === th && <AuIc d={AU_I.check} size={11} sw={2.4} />}</span>
                <div>
                  <b>{t(`crm.aura.theme.${th}.name`)}</b>
                  <em>{t(`crm.aura.theme.${th}.desc`)}</em>
                </div>
              </div>
            </button>
          ))}
        </div>
        <div className="au-style-opts">
          <label className="au-field">
            <span>{t('crm.aura.style.name')}</span>
            <input value={d.title || title} onChange={(e) => setDraft({ ...d, title: e.target.value })} />
          </label>
          <div className="au-field">
            <span>{t('crm.aura.style.density')}</span>
            <div className="au-seg">
              {AU_DENSITIES.map((k) => (
                <button type="button" key={k} className={d.density === k ? 'on' : ''} onClick={() => setDraft({ ...d, density: k })}>
                  {t(`crm.aura.density.${k}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="au-field">
            <span>{t('crm.aura.style.open')}</span>
            <div className="au-seg">
              {[false, true].map((k) => (
                <button type="button" key={String(k)} className={d.kiosk === k ? 'on' : ''} onClick={() => setDraft({ ...d, kiosk: k })}>
                  {t(k ? 'crm.aura.style.openKiosk' : 'crm.aura.style.openCrm')}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={() => {
              setDraft({ ...d, title: d.title || title, gen: true });
              nav(d.appId ? `/aura/build/${d.appId}` : '/aura/build');
            }}
          >
            <AuIc d={AU_I.aura} size={15} />
            {t('crm.aura.style.build')}
          </button>
        </div>
      </div>
    </AuraShell>
  );
};
