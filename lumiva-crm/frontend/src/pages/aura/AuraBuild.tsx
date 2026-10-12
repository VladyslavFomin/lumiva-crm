import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import type { TFunction } from 'i18next';
import { auraApi, auraShareUrl, type AuraAccess, type AuraApp, type AuraEditOp, type AuraFilters, type AuraPeriod } from '../../api/aura';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { AU_REFRESH, AU_THEMES, AU_WIDGET, auPack, draftConfig, type AuDraft } from './auraModel';
import { AU_I, AuIc, AuraShell, auraInvalidate, useAuraDraft, useAuraPreview, useFitHeight } from './auraShared';
import { AuraDash, AuScaled, type AuEditHooks } from './AuraDash';
import { autoTitle } from './AuraWizard';

const DEVICES: Array<['desktop' | 'tablet' | 'phone' | 'tv', number]> = [
  ['desktop', 1280],
  ['tablet', 834],
  ['phone', 390],
  ['tv', 1920],
];

type Msg = { r: 'user' | 'ai' | 'gen'; t?: string; chips?: boolean };

export function draftFromApp(a: AuraApp): AuDraft {
  return {
    prompt: a.config.prompt || '',
    sources: a.config.sources,
    widgets: a.config.widgets,
    period: a.config.period,
    breakdown: a.config.breakdown,
    goals: a.config.goals || {},
    viewer: a.config.viewer || null,
    theme: a.theme,
    density: a.density,
    kiosk: a.kiosk,
    title: a.name,
    step: 5,
    gen: false,
    appId: a.id,
    tpl: null,
    custom: a.config.custom || [],
    style: a.config.style || null,
  };
}

/** Текст «что изменено» по применённым операциям — на языке интерфейса. */
function describeOps(ops: AuraEditOp[], t: TFunction): string | null {
  const parts = ops
    .map((o) => {
      const w = typeof o.widget === 'string' ? t(`crm.aura.w.${o.widget}`, { defaultValue: o.widget }) : '';
      switch (o.op) {
        case 'add':
          return t('crm.aura.edit.added', { name: w });
        case 'remove':
          return t('crm.aura.edit.removed', { name: w });
        case 'move':
          return t('crm.aura.edit.moved', { name: w });
        case 'theme':
          return t('crm.aura.edit.theme', { name: t(`crm.aura.theme.${o.value}.name`) });
        case 'density':
          return t('crm.aura.edit.density', { name: t(`crm.aura.density.${o.value}`) });
        case 'period':
          return t('crm.aura.edit.period', { name: t(`crm.aura.period.${o.value}`) });
        case 'title':
          return t('crm.aura.edit.title', { name: String(o.value) });
        case 'breakdown_add':
          return t('crm.aura.edit.filterAdd', { name: t(`crm.aura.filter.by.${o.value}`) });
        case 'breakdown_remove':
          return t('crm.aura.edit.filterRemove', { name: t(`crm.aura.filter.by.${o.value}`) });
        case 'goal':
          return t('crm.aura.edit.goal');
        case 'add_custom':
          return t('crm.aura.edit.addedCustom', { name: typeof o.widget === 'object' && o.widget ? o.widget.title : '' });
        case 'style':
          return t('crm.aura.edit.style');
        case 'style_reset':
          return t('crm.aura.edit.styleReset');
      }
      return '';
    })
    .filter(Boolean);
  return parts.length ? t('crm.aura.edit.done', { list: parts.join(', ') }) : null;
}

export const AuraBuildPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const { id: routeId } = useParams();
  const { showAlert, showPrompt } = useAlertModal();
  const [d, setDraft] = useAuraDraft();
  const [app, setApp] = useState<AuraApp | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const loadingApp = !!routeId && d.appId !== routeId;

  // открыть сохранённое приложение для правки
  useEffect(() => {
    if (!routeId) return;
    let alive = true;
    auraApi
      .get(routeId)
      .then((a) => {
        if (!alive) return;
        setApp(a);
        if (d.appId !== a.id) setDraft(draftFromApp(a));
      })
      .catch((e: Error) => alive && setLoadErr(e.message));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId]);

  useEffect(() => {
    if (!routeId && !d.widgets.length) nav('/aura', { replace: true });
  }, [routeId, d.widgets.length, nav]);

  const title = autoTitle(d, t);
  const [viewPeriod, setViewPeriod] = useState<AuraPeriod>(d.period);
  useEffect(() => setViewPeriod(d.period), [d.period]);
  const [filters, setFilters] = useState<AuraFilters>({});
  const preview = useAuraPreview(loadingApp ? null : { widgets: d.widgets, period: viewPeriod, breakdown: d.breakdown, goals: d.goals, custom: d.custom || [] }, filters);

  const steps = useMemo(
    () => [
      t('crm.aura.gen.s1'),
      t('crm.aura.gen.s2', { list: d.sources.map((s) => t(`crm.aura.src.${s}.name`)).join(', ') }),
      t('crm.aura.gen.s3', { period: t(`crm.aura.period.${d.period}`).toLowerCase() }),
      t('crm.aura.gen.s4'),
      t('crm.aura.gen.s5', { name: t(`crm.aura.theme.${d.theme}.name`) }),
      t('crm.aura.gen.s6'),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, d.gen],
  );
  const count = auPack(d.widgets, d.custom || []).length;
  const [tick, setTick] = useState(d.gen ? 0 : 999);
  const stepsDone = Math.min(steps.length, Math.floor(tick / 2));
  const reveal = d.gen ? Math.max(0, tick - 4) : Infinity;
  const genDone = !d.gen || (stepsDone >= steps.length && reveal >= count);

  const [msgs, setMsgs] = useState<Msg[]>(() =>
    d.gen
      ? [{ r: 'user', t: d.prompt || (d.tpl ? t('crm.aura.build.fromTemplate', { name: title }) : title) }, { r: 'gen' }]
      : [{ r: 'ai', t: t('crm.aura.build.opened') }],
  );
  useEffect(() => {
    if (!d.gen) return;
    if (genDone) {
      setDraft((p) => ({ ...p, gen: false }));
      setMsgs((m) => [...m, { r: 'ai', t: t('crm.aura.build.ready', { title, count: d.widgets.length }), chips: true }]);
      return;
    }
    // шаг «Считаю показатели» не завершается, пока данные реально не пришли
    const waitingData = stepsDone >= 2 && !preview.data && !preview.error;
    const id = window.setTimeout(() => !waitingData && setTick((x) => x + 1), 380);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, d.gen, preview.data, preview.error]);

  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const [dev, setDev] = useState<(typeof DEVICES)[number][0]>('desktop');
  const [tab, setTab] = useState<'preview' | 'data'>('preview');
  const [pub, setPub] = useState(false);
  const [wide, setWide] = useState(false);
  const scroll = useRef<HTMLDivElement>(null);
  const fitRef = useFitHeight<HTMLDivElement>();
  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [msgs, busy, stepsDone]);
  useEffect(() => {
    if (!wide) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && setWide(false);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [wide]);

  const send = async (text?: string) => {
    const v = (text ?? input).trim();
    if (!v || busy || !genDone) return;
    setInput('');
    setMsgs((m) => [...m, { r: 'user', t: v }]);
    setBusy(true);
    try {
      const res = await auraApi.edit({ config: draftConfig(d), theme: d.theme, density: d.density, title, message: v, lang: i18n.language || 'ru' });
      setDraft((p) => ({
        ...p,
        sources: res.config.sources,
        widgets: res.config.widgets,
        period: res.config.period,
        breakdown: res.config.breakdown,
        goals: res.config.goals || {},
        custom: res.config.custom || [],
        style: res.config.style || null,
        theme: res.theme,
        density: res.density,
        title: res.title || p.title,
      }));
      setFresh(res.fresh);
      const done = res.reply || describeOps(res.applied, t);
      // ИИ не ответил — честно говорим почему и что умеет простой разбор
      const reply = res.ai
        ? done || t('crm.aura.build.notUnderstood')
        : `${done ? done + '\n\n' : ''}${t(`crm.aura.aiErr.${res.aiError || 'unavailable'}`)} ${done ? '' : t('crm.aura.build.fallbackHelp')}`.trim();
      setMsgs((m) => [...m, { r: 'ai', t: reply }]);
    } catch (e) {
      setMsgs((m) => [...m, { r: 'ai', t: t('crm.aura.build.editFailed', { error: (e as Error).message }) }]);
    } finally {
      setBusy(false);
    }
  };

  const setGoal = async () => {
    const v = await showPrompt({
      title: t('crm.aura.goal.promptTitle'),
      label: t('crm.aura.goal.promptLabel', { currency: preview.data?.currency || '' }),
      defaultValue: d.goals.team_goal ? String(d.goals.team_goal) : '',
    });
    if (v == null) return;
    const n = Math.round(Number(String(v).replace(/[^\d.,]/g, '').replace(',', '.')));
    if (!(n > 0)) return;
    setDraft((p) => ({ ...p, goals: { ...p.goals, team_goal: n }, widgets: p.widgets.includes('team_goal') ? p.widgets : [...p.widgets, 'team_goal'] }));
  };
  const edit: AuEditHooks = {
    onMove: (key, dir) =>
      setDraft((p) => {
        // двигаем среди виджетов того же «ряда» (KPI — среди KPI, остальные — среди остальных)
        const isKpi = AU_WIDGET.get(key)?.type === 'kpi';
        const same = p.widgets.filter((k) => (AU_WIDGET.get(k)?.type === 'kpi') === isKpi);
        const i = same.indexOf(key);
        const j = i + dir;
        if (j < 0 || j >= same.length) return p;
        const swap = same[j];
        const w = [...p.widgets];
        const a = w.indexOf(key);
        const b = w.indexOf(swap);
        [w[a], w[b]] = [w[b], w[a]];
        setFresh(key);
        return { ...p, widgets: w };
      }),
    onRemove: (key) => setDraft((p) => (p.widgets.length > 1 ? { ...p, widgets: p.widgets.filter((k) => k !== key) } : p)),
    onSetGoal: () => void setGoal(),
  };

  const devW = DEVICES.find((x) => x[0] === dev)![1];
  const canSave = !app || app.canEdit;

  if (loadErr) {
    return (
      <AuraShell route="build">
        <div className="au-center">
          <p>{loadErr}</p>
          <button type="button" className="btn" onClick={() => nav('/aura/apps')}>
            {t('crm.aura.nav.apps')}
          </button>
        </div>
      </AuraShell>
    );
  }

  return (
    <AuraShell route="build">
      <div className={'au-build' + (wide ? ' wide' : '')} ref={fitRef}>
        <div className="au-bchat">
          <div className="au-bchat-h">
            <div className={'au-ava' + (!genDone || busy ? ' busy' : '')}>
              <AuIc d={AU_I.aura} size={14} />
            </div>
            <div>
              <b>Aura</b>
              <span className="au-muted">{genDone ? t('crm.aura.build.readyShort') : t('crm.aura.build.building')}</span>
            </div>
          </div>
          <div className="au-chat-scroll" ref={scroll}>
            {msgs.map((m, i) =>
              m.r === 'gen' ? (
                <div key={i} className="au-msg ai au-gen">
                  {steps.map((s, j) => (
                    <div key={j} className={'au-gen-s ' + (j < stepsDone ? 'done' : j === stepsDone ? 'cur' : '')}>
                      <span>{j < stepsDone ? <AuIc d={AU_I.check} size={11} sw={2.4} /> : ''}</span>
                      {s}
                    </div>
                  ))}
                </div>
              ) : (
                <div key={i} className={'au-msg ' + m.r}>
                  {m.t}
                  {m.chips && (
                    <div className="au-msg-chips">
                      {(t('crm.aura.build.chips', { returnObjects: true }) as string[]).map((c) => (
                        <button type="button" key={c} onClick={() => void send(c)}>
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ),
            )}
            {busy && (
              <div className="au-msg ai au-typing">
                <i />
                <i />
                <i />
              </div>
            )}
          </div>
          <div className="au-bchat-in">
            <textarea
              rows={2}
              value={input}
              disabled={!genDone}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder={genDone ? t('crm.aura.build.inputPh') : t('crm.aura.build.inputWait')}
            />
            <button type="button" className="btn btn-primary btn-icon-sq" disabled={!genDone || !input.trim() || busy} onClick={() => void send()} title={t('crm.aura.build.send')}>
              <AuIc d={AU_I.send} size={15} />
            </button>
          </div>
        </div>
        <div className="au-bmain">
          <div className="au-btool">
            <div className="au-seg">
              {(['preview', 'data'] as const).map((k) => (
                <button type="button" key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
                  {t(`crm.aura.build.tab.${k}`)}
                </button>
              ))}
            </div>
            {tab === 'preview' && (
              <div className="au-seg">
                {DEVICES.map(([k]) => (
                  <button type="button" key={k} className={dev === k ? 'on' : ''} onClick={() => setDev(k)}>
                    {t(`crm.aura.build.dev.${k}`)}
                  </button>
                ))}
              </div>
            )}
            <select className="au-select" value={d.theme} onChange={(e) => setDraft({ ...d, theme: e.target.value as AuDraft['theme'] })} aria-label={t('crm.aura.build.styleLabel')}>
              {AU_THEMES.map((th) => (
                <option key={th} value={th}>
                  {t('crm.aura.build.styleOpt', { name: t(`crm.aura.theme.${th}.name`) })}
                </option>
              ))}
            </select>
            <div style={{ flex: 1 }} />
            <button type="button" className={'app-topbar-btn' + (wide ? ' on' : '')} title={wide ? t('crm.aura.build.showMenu') : t('crm.aura.build.hideMenu')} onClick={() => setWide(!wide)}>
              <AuIc d={wide ? AU_I.panel : AU_I.full} size={15} />
            </button>
            <button
              type="button"
              className="btn btn-sm"
              disabled={!genDone}
              onClick={() => nav(d.appId ? `/aura/app/${d.appId}?draft=1` : '/aura/app/draft')}
            >
              <AuIc d={AU_I.open} size={13} />
              {t('crm.aura.build.noMenu')}
            </button>
            {canSave && (
              <button type="button" className="btn btn-sm btn-primary" disabled={!genDone} onClick={() => setPub(true)}>
                {d.appId ? t('crm.aura.build.save') : t('crm.aura.build.publish')}
              </button>
            )}
          </div>
          <div className={'au-stage au-dev-' + dev}>
            {tab === 'preview' ? (
              <div className="au-frame" style={{ maxWidth: dev === 'phone' ? 390 : dev === 'tablet' ? 834 : 'none' }}>
                <AuScaled width={devW}>
                  <AuraDash
                    title={title}
                    sources={d.sources}
                    widgets={d.widgets}
                    theme={d.theme}
                    density={d.density}
                    data={preview.data}
                    error={preview.error}
                    period={viewPeriod}
                    onPeriod={setViewPeriod}
                    breakdown={d.breakdown}
                    filters={filters}
                    onFilter={(k, v) => setFilters((f) => ({ ...f, [k]: v || undefined }))}
                    reveal={reveal}
                    freshKey={fresh}
                    custom={d.custom || []}
                    style={d.style || null}
                    edit={genDone ? edit : undefined}
                  />
                </AuScaled>
              </div>
            ) : (
              <DataTab d={d} data={preview.data} />
            )}
          </div>
        </div>
        {pub && (
          <PublishModal
            draft={d}
            title={title}
            existing={app && app.id === d.appId ? app : null}
            onClose={() => setPub(false)}
            onSaved={(a) => {
              setApp(a);
              setDraft((p) => ({ ...p, appId: a.id, title: a.name }));
              auraInvalidate();
              if (!routeId || routeId !== a.id) nav(`/aura/build/${a.id}`, { replace: true });
            }}
            onError={(m) => showAlert(m)}
          />
        )}
      </div>
    </AuraShell>
  );
};

/* ---------- вкладка «Данные» ---------- */

function DataTab({ d, data }: { d: AuDraft; data: ReturnType<typeof useAuraPreview>['data'] }) {
  const { t } = useTranslation();
  return (
    <div className="au-data">
      <table className="au-dtable">
        <thead>
          <tr>
            <th>{t('crm.aura.data.widget')}</th>
            <th>{t('crm.aura.data.type')}</th>
            <th>{t('crm.aura.data.source')}</th>
            <th>{t('crm.aura.data.fields')}</th>
            <th>{t('crm.aura.data.filters')}</th>
            <th>{t('crm.aura.data.status')}</th>
          </tr>
        </thead>
        <tbody>
          {d.widgets.map((k) => {
            const c = (d.custom || []).find((x) => x.id === k);
            if (c) {
              const res = data?.widgets[k];
              const st = !res ? '…' : 'error' in res ? t(`crm.aura.err.${res.error}`, { source: '' }) : t('crm.aura.data.ok');
              const ds = c.dataset.startsWith('table:') ? t('crm.aura.data.wsTable') : t(`crm.aura.ds.${c.dataset}`, { defaultValue: c.dataset });
              return (
                <tr key={k}>
                  <td>{c.title}</td>
                  <td className="au-muted">{t(`crm.aura.type.${c.viz === 'bar' ? 'bar' : c.viz}`)} · AI</td>
                  <td>{ds}</td>
                  <td className="mono-s">
                    {c.measure.agg}
                    {c.measure.field ? `(${c.measure.field})` : ''}
                    {c.groupBy ? ` · ${c.groupBy}` : ''}
                    {(c.filters || []).length ? ` · ${(c.filters || []).map((f) => `${f.field} ${f.op} ${Array.isArray(f.value) ? f.value.join('|') : f.value ?? ''}`).join(', ')}` : ''}
                  </td>
                  <td className="au-muted">{t('crm.aura.data.periodFilter')}</td>
                  <td className={res && !('error' in res) ? 'ok' : res ? 'no' : ''}>{st}</td>
                </tr>
              );
            }
            const m = AU_WIDGET.get(k);
            if (!m) return null;
            const res = data?.widgets[k];
            const st = !res ? '…' : 'error' in res ? t(`crm.aura.err.${res.error}`, { source: m.source === 'extra' ? '' : t(`crm.aura.src.${m.source}.name`) }) : t('crm.aura.data.ok');
            return (
              <tr key={k}>
                <td>{t(`crm.aura.w.${k}`)}</td>
                <td className="au-muted">{t(`crm.aura.type.${m.type}`)}</td>
                <td>{m.source === 'extra' ? 'Aura' : t(`crm.aura.src.${m.source}.name`)}</td>
                <td className="mono-s">{t(`crm.aura.fields.${k}`)}</td>
                <td className="au-muted">{t(`crm.aura.wfilters.${k}`)}</td>
                <td className={res && !('error' in res) ? 'ok' : res ? 'no' : ''}>{st}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="au-hint" style={{ padding: '12px 14px', margin: 0 }}>
        {t('crm.aura.data.note', { currency: data?.currency || '—' })}
      </p>
    </div>
  );
}

/* ---------- публикация ---------- */

function PublishModal({
  draft,
  title,
  existing,
  onClose,
  onSaved,
  onError,
}: {
  draft: AuDraft;
  title: string;
  existing: AuraApp | null;
  onClose: () => void;
  onSaved: (a: AuraApp) => void;
  onError: (m: string) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(existing?.name || title);
  const [access, setAccess] = useState<AuraAccess>(existing?.access || 'private');
  const [menu, setMenu] = useState(existing ? existing.showInMenu : true);
  const [refresh, setRefresh] = useState(existing?.refreshSec || (draft.kiosk ? 60 : 300));
  const [shareOn, setShareOn] = useState(existing?.share.enabled || false);
  const [password, setPassword] = useState('');
  const [dropPassword, setDropPassword] = useState(false);
  const [expires, setExpires] = useState(existing?.share.expiresAt ? existing.share.expiresAt.slice(0, 10) : '');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<AuraApp | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const save = async () => {
    if (!name.trim()) return;
    if (shareOn && password && password.length < 4) {
      onError(t('crm.aura.pub.passShort'));
      return;
    }
    setSaving(true);
    try {
      const body = { name: name.trim(), theme: draft.theme, density: draft.density, kiosk: draft.kiosk, config: draftConfig(draft), access, showInMenu: menu, refreshSec: refresh };
      let a = existing ? await auraApi.update(existing.id, body) : await auraApi.create(body);
      const shareChanged =
        shareOn !== a.share.enabled || (shareOn && (!!password || dropPassword || (expires || '') !== (a.share.expiresAt || '').slice(0, 10)));
      if (shareChanged) {
        const share = await auraApi.saveShare(a.id, {
          enabled: shareOn,
          ...(password ? { password } : dropPassword ? { password: null } : {}),
          expiresAt: expires ? new Date(`${expires}T23:59:59`).toISOString() : null,
        });
        a = { ...a, share };
      }
      onSaved(a);
      if (a.share.enabled) setDone(a);
      else onClose();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const link = done ? auraShareUrl(done.share.shareKey) : existing?.share.enabled ? auraShareUrl(existing.share.shareKey) : null;
  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* буфер недоступен — ссылка видна в поле */
    }
  };

  return (
    <div className="au-modal-bg lv-backdrop" onClick={onClose}>
      <div className="au-modal lv-dialog" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
        <div className="au-modal-h">
          <div>
            <h3>{done ? t('crm.aura.pub.doneTitle') : existing ? t('crm.aura.pub.saveTitle') : t('crm.aura.pub.title')}</h3>
            <p>{done ? t('crm.aura.pub.doneSub') : t('crm.aura.pub.sub')}</p>
          </div>
          <button type="button" className="app-topbar-btn" onClick={onClose} aria-label={t('crm.aura.close')}>
            <AuIc d={AU_I.x} size={16} />
          </button>
        </div>
        {done && link ? (
          <div className="au-modal-body">
            <div className="au-link">
              <span className="mono-s">{link}</span>
              <button type="button" className="btn btn-sm" onClick={() => void copy(link)}>
                {copied ? t('crm.aura.pub.copied') : t('crm.aura.pub.copy')}
              </button>
            </div>
            <p className="au-hint">{done.share.hasPassword ? t('crm.aura.pub.withPassword') : t('crm.aura.pub.noPassword')}</p>
          </div>
        ) : (
          <div className="au-modal-body">
            <label className="au-field">
              <span>{t('crm.aura.pub.name')}</span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={160} />
            </label>
            <div className="au-field">
              <span>{t('crm.aura.pub.access')}</span>
              <div className="au-radios">
                {(['private', 'department', 'company'] as AuraAccess[]).map((v) => (
                  <button type="button" key={v} className={access === v ? 'on' : ''} onClick={() => setAccess(v)}>
                    <span className="au-radio" />
                    <span>
                      <b>{t(`crm.aura.access.${v}.name`)}</b>
                      <em>{t(`crm.aura.access.${v}.desc`)}</em>
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="au-field">
              <span>{t('crm.aura.pub.refresh')}</span>
              <div className="au-seg">
                {AU_REFRESH.map((x) => (
                  <button type="button" key={x} className={refresh === x ? 'on' : ''} onClick={() => setRefresh(x)}>
                    {t(`crm.aura.refresh.${x}`)}
                  </button>
                ))}
              </div>
            </div>
            <label className="au-check">
              <input type="checkbox" checked={menu} onChange={(e) => setMenu(e.target.checked)} />
              <span>{t('crm.aura.pub.inMenu')}</span>
            </label>
            <div className="au-share">
              <label className="au-check">
                <input type="checkbox" checked={shareOn} onChange={(e) => setShareOn(e.target.checked)} />
                <span>
                  <b>{t('crm.aura.pub.shareOn')}</b>
                </span>
              </label>
              <p className="au-hint">{t('crm.aura.pub.shareHint')}</p>
              {shareOn && (
                <>
                  <div className="au-share-row">
                    <label className="au-field">
                      <span>{existing?.share.hasPassword ? t('crm.aura.pub.newPassword') : t('crm.aura.pub.password')}</span>
                      <input type="password" value={password} autoComplete="new-password" placeholder={t('crm.aura.pub.passwordPh')} onChange={(e) => setPassword(e.target.value)} />
                    </label>
                    <label className="au-field">
                      <span>{t('crm.aura.pub.expires')}</span>
                      <input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
                    </label>
                  </div>
                  {existing?.share.hasPassword && !password && (
                    <label className="au-check">
                      <input type="checkbox" checked={dropPassword} onChange={(e) => setDropPassword(e.target.checked)} />
                      <span>{t('crm.aura.pub.dropPassword')}</span>
                    </label>
                  )}
                  {link && (
                    <div className="au-link">
                      <span className="mono-s">{link}</span>
                      <button type="button" className="btn btn-sm" onClick={() => void copy(link)}>
                        {copied ? t('crm.aura.pub.copied') : t('crm.aura.pub.copy')}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
        <div className="au-modal-f">
          {done ? (
            <button type="button" className="btn btn-primary" onClick={onClose}>
              {t('crm.aura.pub.close')}
            </button>
          ) : (
            <>
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                {t('crm.aura.cancel')}
              </button>
              <button type="button" className="btn btn-primary" disabled={saving || !name.trim()} onClick={() => void save()}>
                {saving ? t('crm.aura.pub.saving') : existing ? t('crm.aura.build.save') : t('crm.aura.build.publish')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
