import React, { useEffect, useMemo, useState } from 'react';
import { useAlertModal } from '../../../contexts/AlertModalContext';
import {
  APIFY_PRICE_PER_1000,
  createRepCompetitor,
  fetchRepCompetitors,
  removeRepCompetitor,
  syncRepCompetitorSource,
  updateRepCompetitor,
  type RepCompetitor,
  type RepConfig,
  type RepPlatform,
  type RepSettings,
  type RepSetup,
} from '../../../api/hotelReputation';
import { PLATFORM_META, PlatformBadge, fmtDate, useRepT } from './ReputationShared';

/** Площадки для конкурентов: те же скрейперы. Google и Tripadvisor — дешевле всего и есть почти у всех. */
const MAIN: RepPlatform[] = ['google', 'tripadvisor'];
const EXTRA: RepPlatform[] = ['booking', 'holidaycheck', 'yandex', 'expedia', 'otelpuan', 'check24'];
const usd = (v: number) => (v < 0.1 ? `$${v.toFixed(3)}` : `$${v.toFixed(2)}`);

/** Верхняя граница расходов Apify на одну площадку конкурента (реальные — ниже: дальше берётся только новое). */
function estimate(platform: RepPlatform, c: RepConfig['competitors']) {
  const price = (APIFY_PRICE_PER_1000[platform] || 2) / 1000;
  return { first: c.firstLoadMax * price, monthly: (30 / c.everyDays) * c.maxPerRun * price };
}

type Draft = { name: string; urls: Partial<Record<RepPlatform, string>> };

/**
 * Настройки → Конкуренты. Ничего не собирается и не оплачивается, пока клиент сам не добавит конкурента.
 * Перед добавлением и ручным запуском — оценка расходов Apify (сбор платит клиент).
 */
export const CompetitorsTab: React.FC<{ settings: RepSettings; setup: RepSetup; save: (b: any) => Promise<void> }> = ({ settings, setup, save }) => {
  const { r, lang } = useRepT();
  const { showAlert, showConfirm } = useAlertModal();
  const hotels = setup.hotels;
  const [hotelId, setHotelId] = useState(hotels[0]?.id || '');
  const [list, setList] = useState<RepCompetitor[] | null>(null);
  const [all, setAll] = useState<RepCompetitor[]>([]);
  const [cfg, setCfg] = useState(settings.config.competitors);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [extraPlat, setExtraPlat] = useState<RepPlatform[]>([]);
  const [edit, setEdit] = useState<{ id: string; draft: Draft } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => setCfg(settings.config.competitors), [settings.config.competitors]);

  const load = () => {
    fetchRepCompetitors(hotelId || undefined).then(setList).catch((e) => showAlert(e.message, { variant: 'error' }));
    fetchRepCompetitors().then(setAll).catch(() => undefined);
  };
  useEffect(() => {
    if (!hotelId) return;
    setList(null);
    setDraft(null);
    setEdit(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId]);

  const run = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key);
    try {
      await fn();
      if (ok) showAlert(ok, { variant: 'success' });
      load();
    } catch (e: any) {
      showAlert(e?.message || r('card.error'), { variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  // все источники всех конкурентов: текущая оценка расходов в месяц
  const totals = useMemo(() => {
    let first = 0;
    let monthly = 0;
    for (const c of all) {
      if (!c.active) continue;
      for (const s of c.sources) {
        if (!s.active) continue;
        const e = estimate(s.platform, cfg);
        monthly += e.monthly;
        if (!s.lastSuccessAt) first += e.first;
      }
    }
    return { first, monthly, count: all.filter((c) => c.active).length };
  }, [all, cfg]);

  const draftPlatforms = (d: Draft) => (Object.keys(d.urls) as RepPlatform[]).filter((p) => d.urls[p]?.trim());
  const draftCost = (d: Draft) =>
    draftPlatforms(d).reduce((a, p) => {
      const e = estimate(p, cfg);
      return { first: a.first + e.first, monthly: a.monthly + e.monthly };
    }, { first: 0, monthly: 0 });

  const urlFields = (d: Draft, set: (d: Draft) => void, platforms: RepPlatform[]) => (
    <div style={{ display: 'grid', gap: 8 }}>
      {platforms.map((p) => (
        <div key={p} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ width: 120, flexShrink: 0 }}><PlatformBadge platform={p} /></span>
          <input className="rp-input" style={{ flex: 1 }} value={d.urls[p] || ''} onChange={(e) => set({ ...d, urls: { ...d.urls, [p]: e.target.value } })} placeholder={r(`src.urlPh.${p}`)} />
        </div>
      ))}
    </div>
  );

  const noToken = !settings.apifyToken;

  return (
    <>
      <div className="ha-section">
        <div className="ha-section-head"><div><h3>{r('comp.settingsTitle')}</h3><div className="sub">{r('comp.settingsSub')}</div></div></div>
        {noToken && <div className="rp-note warn" style={{ marginBottom: 12 }}>{r('comp.noToken')}</div>}
        <div className="rp-note" style={{ marginBottom: 12 }}>
          {totals.count
            ? r('comp.costNow', { n: totals.count, monthly: usd(totals.monthly), first: usd(totals.first) })
            : r('comp.costNone')}
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label className="rp-field">
            <span>{r('comp.everyDays')}</span>
            <select className="rp-input" value={cfg.everyDays} onChange={(e) => setCfg({ ...cfg, everyDays: Number(e.target.value) })}>
              {[3, 7, 14, 30].map((d) => <option key={d} value={d}>{r('comp.everyDaysOpt', { n: d })}</option>)}
            </select>
          </label>
          <label className="rp-field">
            <span>{r('comp.historyMonths')}</span>
            <select className="rp-input" value={cfg.historyMonths} onChange={(e) => setCfg({ ...cfg, historyMonths: Number(e.target.value) })}>
              {[3, 6, 12].map((m) => <option key={m} value={m}>{r('comp.monthsOpt', { n: m })}</option>)}
            </select>
          </label>
          <label className="rp-field">
            <span>{r('comp.firstLoadMax')}</span>
            <select className="rp-input" value={cfg.firstLoadMax} onChange={(e) => setCfg({ ...cfg, firstLoadMax: Number(e.target.value) })}>
              {[50, 100, 200, 500].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="rp-field">
            <span>{r('comp.maxPerRun')}</span>
            <select className="rp-input" value={cfg.maxPerRun} onChange={(e) => setCfg({ ...cfg, maxPerRun: Number(e.target.value) })}>
              {[10, 20, 30, 50].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="rp-toggle" style={{ paddingBottom: 8 }}>
            <input type="checkbox" checked={cfg.ai} onChange={(e) => setCfg({ ...cfg, ai: e.target.checked })} />
            {r('comp.ai')}
          </label>
          <button type="button" className="btn btn-primary" disabled={busy === 'cfg'} onClick={() => run('cfg', () => save({ competitors: cfg }), r('settings.saved'))}>{r('settings.save')}</button>
        </div>
        <div className="rp-src-meta" style={{ marginTop: 10 }}>{r('comp.paramsNote')}</div>
      </div>

      <div className="ha-section">
        <div className="ha-section-head">
          <div><h3>{r('comp.listTitle')}</h3><div className="sub">{r('comp.listSub')}</div></div>
          <select className="rp-input" value={hotelId} onChange={(e) => setHotelId(e.target.value)}>
            {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}{all.some((c) => c.hotelId === h.id) ? ` · ${all.filter((c) => c.hotelId === h.id).length}` : ''}</option>)}
          </select>
        </div>

        {!list ? (
          <div className="rp-empty">{r('card.loading')}</div>
        ) : (
          <>
            {list.map((c) =>
              edit?.id === c.id ? (
                <div key={c.id} className="rp-conn">
                  <input className="rp-input" style={{ width: '100%', marginBottom: 10 }} value={edit.draft.name} onChange={(e) => setEdit({ id: c.id, draft: { ...edit.draft, name: e.target.value } })} />
                  {urlFields(edit.draft, (d) => setEdit({ id: c.id, draft: d }), [...MAIN, ...EXTRA.filter((p) => c.sources.some((s) => s.platform === p) || edit.draft.urls[p] !== undefined)])}
                  <div className="rp-src-meta" style={{ marginTop: 8 }}>{r('comp.editNote')}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    <select className="rp-input" value="" onChange={(e) => e.target.value && setEdit({ id: c.id, draft: { ...edit.draft, urls: { ...edit.draft.urls, [e.target.value]: '' } } })}>
                      <option value="">{r('comp.addPlatform')}</option>
                      {EXTRA.filter((p) => edit.draft.urls[p] === undefined && !c.sources.some((s) => s.platform === p)).map((p) => <option key={p} value={p}>{PLATFORM_META[p].label}</option>)}
                    </select>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={!!busy || !edit.draft.name.trim() || !draftPlatforms(edit.draft).length}
                      onClick={() =>
                        run('edit', async () => {
                          await updateRepCompetitor(c.id, {
                            name: edit.draft.name,
                            sources: [...MAIN, ...EXTRA].filter((p) => edit.draft.urls[p] !== undefined).map((p) => ({ platform: p, url: edit.draft.urls[p] || '' })),
                          });
                          setEdit(null);
                        }, r('settings.saved'))
                      }
                    >
                      {r('settings.save')}
                    </button>
                    <button type="button" className="btn btn-sm" onClick={() => setEdit(null)}>{r('comp.cancel')}</button>
                  </div>
                </div>
              ) : (
                <div key={c.id} className="rp-conn" style={c.active ? undefined : { opacity: 0.65 }}>
                  <div className="rp-conn-head">
                    <h3>{c.name}{!c.active && <span className="rp-pill muted">{r('comp.paused')}</span>}</h3>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button type="button" className="btn btn-sm" onClick={() => setEdit({ id: c.id, draft: { name: c.name, urls: Object.fromEntries(c.sources.map((s) => [s.platform, s.url])) } })}>{r('comp.edit')}</button>
                      <button type="button" className="btn btn-sm" disabled={!!busy} onClick={() => run('pause', () => updateRepCompetitor(c.id, { active: !c.active }))}>{c.active ? r('comp.pause') : r('comp.resume')}</button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={!!busy}
                        onClick={async () => (await showConfirm(r('comp.removeConfirm', { name: c.name }))) && run('rm', () => removeRepCompetitor(c.id))}
                      >
                        {r('comp.remove')}
                      </button>
                    </div>
                  </div>
                  {c.sources.map((s) => {
                    const e = estimate(s.platform, cfg);
                    return (
                      <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '130px minmax(0,1fr) auto', gap: 10, alignItems: 'center', padding: '8px 0', borderTop: '1px solid #eef0f3' }}>
                        <PlatformBadge platform={s.platform} />
                        <div style={{ fontSize: 12, color: 'var(--fg-3)', minWidth: 0 }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.url}</a></div>
                          <div>
                            {s.running ? r('comp.running') : s.lastSuccessAt ? r('comp.lastOk', { d: fmtDate(s.lastSuccessAt, lang, true), n: s.collected }) : r('comp.notYet', { first: usd(e.first) })}
                            {s.avg10 != null && ` · ${r('comp.avgCollected', { v: s.avg10.toFixed(2) })}`}
                            {s.platformRating != null && ` · ${r('comp.onSite', { v: s.platformRating, n: s.platformCount ?? '—' })}`}
                            {s.aiPending > 0 && cfg.ai && ` · ${r('comp.aiPending', { n: s.aiPending })}`}
                          </div>
                          {s.lastError && <div style={{ color: '#9c1f33' }}>{s.lastError.slice(0, 200)}</div>}
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm"
                          disabled={!!busy || s.running || noToken || !c.active}
                          title={r('comp.syncHint')}
                          onClick={async () => {
                            const cost = s.lastSuccessAt ? r('comp.syncCostNext', { v: usd(cfg.maxPerRun * ((APIFY_PRICE_PER_1000[s.platform] || 2) / 1000)) }) : r('comp.syncCostFirst', { v: usd(e.first) });
                            if (!(await showConfirm(r('comp.syncConfirm', { cost })))) return;
                            run(`s${s.id}`, async () => {
                              const res = await syncRepCompetitorSource(s.id);
                              showAlert(res.alreadyRunning ? r('comp.alreadyRunning') : res.queued ? r('comp.queued') : r('comp.started'), { variant: 'success' });
                            });
                          }}
                        >
                          {r('comp.syncNow')}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ),
            )}
            {!list.length && !draft && <div className="rp-empty" style={{ marginBottom: 12 }}>{r('comp.empty')}</div>}

            {draft ? (
              <div className="rp-conn">
                <input className="rp-input" style={{ width: '100%', marginBottom: 10 }} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder={r('comp.namePh')} autoFocus />
                {urlFields(draft, setDraft, [...MAIN, ...extraPlat])}
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <select className="rp-input" value="" onChange={(e) => e.target.value && setExtraPlat([...extraPlat, e.target.value as RepPlatform])}>
                    <option value="">{r('comp.addPlatform')}</option>
                    {EXTRA.filter((p) => !extraPlat.includes(p)).map((p) => <option key={p} value={p}>{PLATFORM_META[p].label}</option>)}
                  </select>
                  {draftPlatforms(draft).length > 0 && (
                    <span style={{ fontSize: 12, color: 'var(--fg-2)' }}>
                      {r('comp.draftCost', { first: usd(draftCost(draft).first), monthly: usd(draftCost(draft).monthly) })}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={!!busy || !draft.name.trim() || !draftPlatforms(draft).length}
                    onClick={() =>
                      run('add', async () => {
                        await createRepCompetitor({ hotelId, name: draft.name.trim(), sources: draftPlatforms(draft).map((p) => ({ platform: p, url: draft.urls[p]!.trim() })) });
                        setDraft(null);
                        setExtraPlat([]);
                      }, r('comp.added'))
                    }
                  >
                    {r('comp.addSave')}
                  </button>
                  <button type="button" className="btn btn-sm" onClick={() => { setDraft(null); setExtraPlat([]); }}>{r('comp.cancel')}</button>
                </div>
                <div className="rp-src-meta" style={{ marginTop: 8 }}>{r('comp.addNote')}</div>
              </div>
            ) : (
              <button type="button" className="btn" disabled={!hotelId || list.length >= 10} onClick={() => setDraft({ name: '', urls: {} })}>+ {r('comp.add')}</button>
            )}
          </>
        )}
      </div>
    </>
  );
};
