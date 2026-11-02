import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../../layout/MainLayout';
import { PageHelpButton } from '../../../components/help/PageHelpButton';
import { useAlertModal } from '../../../contexts/AlertModalContext';
import { HotelsSubnav } from '../HotelsSubnav';
import { Ic, HTL_ICON } from '../HotelIcons';
import { DateInput } from '../../../components/ui/DateInput';
import { money, todayIso } from '../partners/partnerUtils';
import { hotelErrorText } from '../ReservationLifecycle';
import { useLoc } from '../guests/GuestShared';
import {
  adjustLoyaltyMember,
  createLoyaltyProgram,
  fetchLoyaltyMember,
  fetchLoyaltyMembers,
  fetchLoyaltyOverview,
  fetchLoyaltyPrograms,
  fetchLoyaltySettlement,
  setLoyaltyMemberStatus,
  updateLoyaltyProgram,
  type LoyaltyMemberDetail,
  type LoyaltyMemberRow,
  type LoyaltyProgram,
  type LoyaltyPrograms,
  type LoyaltySettings,
  type LoyaltySettlement,
  type LoyaltyTier,
} from '../../../api/hotels';
import '../hotels-design.css';
import './loyalty.css';

type Tab = 'programs' | 'members' | 'settlement';
type Draft = { id?: string; name: string; scope: LoyaltyProgram['scope']; hotelIds: string[]; brandIds: string[]; currency: string; active: boolean; settings: LoyaltySettings };

const useK = () => {
  const { t } = useTranslation();
  return { t, k: (key: string, o?: Record<string, unknown>) => t(`crm.hotels.loyalty.${key}`, o) };
};

/**
 * Лояльность: программы (область — отели / бренды-сеть / весь аккаунт; уровни, баллы, простой режим скидки,
 * правила для сети: возмещение, лимиты, блэкаут), участники (баланс, история, корректировки), взаиморасчёты сети.
 */
export const HotelLoyaltyPage: React.FC = () => {
  const { k } = useK();
  const [tab, setTab] = useState<Tab>('programs');
  const [data, setData] = useState<LoyaltyPrograms | null>(null);
  const [programId, setProgramId] = useState('');
  const load = useCallback(() => fetchLoyaltyPrograms().then((d) => { setData(d); setProgramId((cur) => cur || d.programs.find((p) => p.active)?.id || d.programs[0]?.id || ''); }).catch(() => setData(null)), []);
  useEffect(() => { void load(); }, [load]);
  const programs = data?.programs || [];
  const totalMembers = programs.reduce((s, p) => s + p.members, 0);
  return (
    <MainLayout>
      <PageHelpButton topic="hotels" />
      <div className="px-scope">
        <HotelsSubnav active="loyalty" />
        <div className="htl-hero">
          <div>
            <div className="kicker"><span className="dot" />{k('kicker')}</div>
            <h1>{k('title')}</h1>
            <p className="sub">{k('subtitle')}</p>
          </div>
        </div>
        <div className="htl-kpis">
          <div className="htl-kpi"><div className="l">{k('kpi.programs')}</div><div className="v">{programs.filter((p) => p.active).length}</div><div className="d">{k('kpi.programsOf', { count: programs.length })}</div></div>
          <div className="htl-kpi"><div className="l">{k('kpi.members')}</div><div className="v">{totalMembers}</div></div>
          <div className="htl-kpi"><div className="l">{k('kpi.points')}</div><div className="v">{programs.reduce((s, p) => s + p.outstandingPoints, 0).toLocaleString()}</div><div className="d">{k('kpi.pointsHint')}</div></div>
          <div className="htl-kpi"><div className="l">{k('kpi.hotels')}</div><div className="v">{new Set(programs.filter((p) => p.active).flatMap((p) => p.hotelsCovered)).size} / {data?.hotels.length ?? 0}</div></div>
        </div>
        <div className="htl-toolbar">
          <div className="bk-savedviews" style={{ flex: 'none' }}>
            {(['programs', 'members', 'settlement'] as Tab[]).map((x) => <div key={x} className={`bk-sv-tab${tab === x ? ' active' : ''}`} onClick={() => setTab(x)}>{k(`tab.${x}`)}</div>)}
          </div>
          {tab !== 'programs' && programs.length > 0 && (
            <select className="htl-select" style={{ marginLeft: 'auto' }} value={programId} onChange={(e) => setProgramId(e.target.value)}>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.name}{p.active ? '' : ` (${k('off')})`}</option>)}
            </select>
          )}
        </div>
        {!data ? <div className="htl-rack-skel">{[0, 1].map((i) => <div key={i} />)}</div>
          : tab === 'programs' ? <ProgramsTab data={data} onChanged={load} />
          : !programs.length ? <div className="htl-empty"><h4>{k('noPrograms')}</h4><p>{k('noProgramsHint')}</p></div>
          : tab === 'members' ? <MembersTab data={data} programId={programId} />
          : <SettlementTab programId={programId} />}
      </div>
    </MainLayout>
  );
};

// ─── программы ───

const blankDraft = (d: LoyaltyPrograms): Draft => ({ name: '', scope: d.brands.length ? 'brands' : 'hotels', hotelIds: d.hotels.length === 1 ? [d.hotels[0].id] : [], brandIds: [], currency: d.hotels[0]?.currency || 'EUR', active: true, settings: JSON.parse(JSON.stringify(d.defaults)) });

const ProgramsTab: React.FC<{ data: LoyaltyPrograms; onChanged: () => void }> = ({ data, onChanged }) => {
  const { k, t } = useK();
  const { showAlert } = useAlertModal();
  const [edit, setEdit] = useState<Draft | null>(null);
  const [ov, setOv] = useState<Record<string, Awaited<ReturnType<typeof fetchLoyaltyOverview>>>>({});
  useEffect(() => {
    data.programs.forEach((p) => fetchLoyaltyOverview(p.id, 90).then((o) => setOv((m) => ({ ...m, [p.id]: o }))).catch(() => undefined));
  }, [data]);
  const err = (e: unknown) => showAlert(hotelErrorText(t, e, k('error')), { variant: 'error' });
  const toggle = (p: LoyaltyProgram) => updateLoyaltyProgram(p.id, { active: !p.active }).then(onChanged).catch(err);
  const scopeText = (p: LoyaltyProgram) => p.scope === 'account' ? k('scope.account') : p.scope === 'brands'
    ? `${k('scope.brands')}: ${p.brandIds.map((b) => data.brands.find((x) => x.id === b)?.name).filter(Boolean).join(', ')}`
    : `${k('scope.hotels')}: ${p.hotelIds.map((h) => data.hotels.find((x) => x.id === h)?.name).filter(Boolean).join(', ')}`;
  if (edit) return <ProgramEditor data={data} draft={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); onChanged(); }} />;
  return (
    <>
      <div className="ly-head"><p className="htl-sub">{k('programsHint')}</p><button className="btn btn-primary btn-sm" onClick={() => setEdit(blankDraft(data))}><Ic d={HTL_ICON.plus} size={12} />{k('newProgram')}</button></div>
      {!data.programs.length ? <div className="htl-empty"><h4>{k('noPrograms')}</h4><p>{k('noProgramsHint')}</p></div> : (
        <div className="ly-programs">
          {data.programs.map((p) => {
            const o = ov[p.id];
            return (
              <div key={p.id} className={`ly-program${p.active ? '' : ' off'}`}>
                <div className="ly-program-top">
                  <div>
                    <b>{p.name}</b>
                    <span className="htl-sub">{scopeText(p)} · {k('hotelsCount', { count: p.hotelsCovered.length })} · {p.currency}</span>
                  </div>
                  <label className="ly-switch"><input type="checkbox" checked={p.active} onChange={() => void toggle(p)} /><span>{p.active ? k('on') : k('off')}</span></label>
                </div>
                <div className="ly-tiers">
                  {p.settings.tiers.map((tr) => (
                    <div key={tr.key}>
                      <b>{tr.name}</b>
                      <span>{[tr.minNights ? k('tierNights', { count: tr.minNights }) : '', tr.minStays ? k('tierStays', { count: tr.minStays }) : '', tr.minSpend ? `${tr.minSpend} ${p.currency}` : ''].filter(Boolean).join(k('or')) || k('tierStart')}</span>
                      <em>{[tr.discountPct ? `−${tr.discountPct}%` : '', tr.pointsMultiplier && tr.pointsMultiplier !== 1 ? `×${tr.pointsMultiplier} ${k('pointsShort')}` : ''].filter(Boolean).join(' · ') || '—'}</em>
                      <i>{o?.byTier.find((x) => x.key === tr.key)?.members ?? 0}</i>
                    </div>
                  ))}
                </div>
                <div className="ly-program-stats">
                  <span>{k('stat.members', { count: p.members })}</span>
                  {p.settings.points.enabled && <span>{k('stat.earn', { n: p.settings.points.earnPerUnit, cur: p.currency, value: p.settings.points.pointValue })}</span>}
                  {o && <span>{k('stat.flow', { earned: o.earned, redeemed: o.redeemed, expired: o.expired })}</span>}
                  {p.settings.simpleDiscount.enabled && <span>{k('stat.simple', { n: p.settings.simpleDiscount.fromStay, pct: p.settings.simpleDiscount.pct })}</span>}
                </div>
                <button className="btn btn-sm" onClick={() => setEdit({ id: p.id, name: p.name, scope: p.scope, hotelIds: p.hotelIds, brandIds: p.brandIds, currency: p.currency, active: p.active, settings: JSON.parse(JSON.stringify(p.settings)) })}>{k('edit')}</button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};

const ProgramEditor: React.FC<{ data: LoyaltyPrograms; draft: Draft; onClose: () => void; onSaved: () => void }> = ({ data, draft, onClose, onSaved }) => {
  const { k, t } = useK();
  const { showAlert } = useAlertModal();
  const [d, setD] = useState<Draft>(draft);
  const [busy, setBusy] = useState(false);
  const s = d.settings;
  const set = (patch: Partial<LoyaltySettings>) => setD({ ...d, settings: { ...s, ...patch } });
  const setPts = (patch: Partial<LoyaltySettings['points']>) => set({ points: { ...s.points, ...patch } });
  const setSt = (patch: Partial<LoyaltySettings['settlement']>) => set({ settlement: { ...s.settlement, ...patch } });
  const setTier = (i: number, patch: Partial<LoyaltyTier>) => set({ tiers: s.tiers.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const n = (v: string) => (v === '' ? null : Number(v.replace(',', '.')));
  const toggleIn = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const save = () => {
    setBusy(true);
    const dto = { name: d.name, scope: d.scope, hotelIds: d.hotelIds, brandIds: d.brandIds, currency: d.currency, active: d.active, settings: s };
    (d.id ? updateLoyaltyProgram(d.id, dto) : createLoyaltyProgram(dto))
      .then(() => { showAlert(k('saved'), { variant: 'success' }); onSaved(); })
      .catch((e) => showAlert(hotelErrorText(t, e, k('error')), { variant: 'error' }))
      .finally(() => setBusy(false));
  };
  const multi = data.hotels.length > 1;
  return (
    <div className="ly-editor">
      <div className="htl-panel">
        <h3 className="htl-h3">{d.id ? k('editTitle') : k('newProgram')}</h3>
        <div className="htl-form ly-grid">
          <div className="htl-f wide"><label>{k('f.name')}</label><input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder={k('f.namePh')} /></div>
          <div className="htl-f"><label>{k('f.currency')}</label><input value={d.currency} maxLength={3} onChange={(e) => setD({ ...d, currency: e.target.value.toUpperCase() })} /></div>
        </div>
        <div className="ly-sec">{k('scopeTitle')}</div>
        <div className="ly-scope">
          {(['hotels', 'brands', 'account'] as const).map((x) => (
            <button key={x} type="button" className={d.scope === x ? 'on' : ''} disabled={x === 'brands' && !data.brands.length} onClick={() => setD({ ...d, scope: x })}>
              <b>{k(`scope.${x}`)}</b><span>{k(`scopeHint.${x}`)}</span>
            </button>
          ))}
        </div>
        {d.scope === 'hotels' && <div className="ly-chips">{data.hotels.map((h) => <button key={h.id} type="button" className={d.hotelIds.includes(h.id) ? 'on' : ''} onClick={() => setD({ ...d, hotelIds: toggleIn(d.hotelIds, h.id) })}>{h.name}</button>)}</div>}
        {d.scope === 'brands' && <div className="ly-chips">{data.brands.map((b) => <button key={b.id} type="button" className={d.brandIds.includes(b.id) ? 'on' : ''} onClick={() => setD({ ...d, brandIds: toggleIn(d.brandIds, b.id) })}>{b.name}<em>{data.hotels.filter((h) => h.brandId === b.id).length}</em></button>)}</div>}
        {!data.brands.length && <div className="htl-hint">{k('noBrandsHint')}</div>}
        <div className="htl-hint">{k('oneProgramHint')}</div>
      </div>

      <div className="htl-panel">
        <h3 className="htl-h3">{k('tiersTitle')}</h3>
        <p className="htl-sub">{k('tiersHint')}</p>
        <div className="ly-tier-edit head"><span>{k('t.name')}</span><span>{k('t.nights')}</span><span>{k('t.stays')}</span><span>{k('t.spend', { cur: d.currency })}</span><span>{k('t.discount')}</span><span>{k('t.mult')}</span><span>{k('t.benefits')}</span><span /></div>
        {s.tiers.map((tr, i) => (
          <div key={i} className="ly-tier-edit">
            <input value={tr.name} onChange={(e) => setTier(i, { name: e.target.value })} aria-label={k('t.name')} />
            <input type="number" min={0} value={tr.minNights ?? ''} onChange={(e) => setTier(i, { minNights: n(e.target.value) })} aria-label={k('t.nights')} />
            <input type="number" min={0} value={tr.minStays ?? ''} onChange={(e) => setTier(i, { minStays: n(e.target.value) })} aria-label={k('t.stays')} />
            <input type="number" min={0} value={tr.minSpend ?? ''} onChange={(e) => setTier(i, { minSpend: n(e.target.value) })} aria-label={k('t.spend', { cur: d.currency })} />
            <input type="number" min={0} max={50} value={tr.discountPct ?? 0} onChange={(e) => setTier(i, { discountPct: Number(e.target.value) || 0 })} aria-label={k('t.discount')} />
            <input type="number" min={0} step="0.05" value={tr.pointsMultiplier ?? 1} onChange={(e) => setTier(i, { pointsMultiplier: Number(e.target.value) || 0 })} aria-label={k('t.mult')} />
            <input value={(tr.benefits || []).join(', ')} onChange={(e) => setTier(i, { benefits: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} placeholder={k('t.benefitsPh')} aria-label={k('t.benefits')} />
            <button type="button" className="btn btn-sm" onClick={() => set({ tiers: s.tiers.filter((_, j) => j !== i) })} aria-label={t('crm.hotels.common.delete')}><Ic d={HTL_ICON.x} size={11} /></button>
          </div>
        ))}
        <div className="ly-row">
          <button type="button" className="btn btn-sm" disabled={s.tiers.length >= 8} onClick={() => set({ tiers: [...s.tiers, { key: `tier${s.tiers.length + 1}`, name: '', discountPct: 0, pointsMultiplier: 1, benefits: [] }] })}><Ic d={HTL_ICON.plus} size={11} />{k('addTier')}</button>
          <label className="ly-inline">{k('tierPeriod')}
            <select value={s.tierPeriod} onChange={(e) => set({ tierPeriod: e.target.value as LoyaltySettings['tierPeriod'] })}><option value="12m">{k('period.12m')}</option><option value="lifetime">{k('period.lifetime')}</option></select>
          </label>
        </div>
        <div className="htl-hint">{k('tierRuleHint')}</div>
      </div>

      <div className="htl-panel">
        <h3 className="htl-h3"><label className="rtp-check"><input type="checkbox" checked={s.points.enabled} onChange={(e) => setPts({ enabled: e.target.checked })} />{k('pointsTitle')}</label></h3>
        {s.points.enabled && (
          <div className="htl-form ly-grid">
            <div className="htl-f"><label>{k('p.earn', { cur: d.currency })}</label><input type="number" min={0} step="0.1" value={s.points.earnPerUnit} onChange={(e) => setPts({ earnPerUnit: Number(e.target.value) || 0 })} /></div>
            <div className="htl-f"><label>{k('p.value', { cur: d.currency })}</label><input type="number" min={0} step="0.001" value={s.points.pointValue} onChange={(e) => setPts({ pointValue: Number(e.target.value) || 0 })} /></div>
            <div className="htl-f"><label>{k('p.maxRedeem')}</label><input type="number" min={0} max={100} value={s.points.maxRedeemPct} onChange={(e) => setPts({ maxRedeemPct: Number(e.target.value) || 0 })} /></div>
            <div className="htl-f"><label>{k('p.pending')}</label><input type="number" min={0} max={90} value={s.points.pendingDays} onChange={(e) => setPts({ pendingDays: Number(e.target.value) || 0 })} /></div>
            <div className="htl-f"><label>{k('p.expiry')}</label><input type="number" min={0} max={120} value={s.points.expiryMonths} onChange={(e) => setPts({ expiryMonths: Number(e.target.value) || 0 })} /></div>
            <label className="rtp-check ly-check"><input type="checkbox" checked={s.points.includeExtras} onChange={(e) => setPts({ includeExtras: e.target.checked })} />{k('p.extras')}</label>
          </div>
        )}
        {s.points.enabled && <div className="htl-hint">{k('p.hint', { earn: s.points.earnPerUnit, cur: d.currency, value: s.points.pointValue, pct: Math.round(s.points.earnPerUnit * s.points.pointValue * 1000) / 10 })}</div>}
        <div className="ly-sec">{k('simpleTitle')}</div>
        <div className="ly-row">
          <label className="rtp-check"><input type="checkbox" checked={s.simpleDiscount.enabled} onChange={(e) => set({ simpleDiscount: { ...s.simpleDiscount, enabled: e.target.checked } })} />{k('simpleOn')}</label>
          {s.simpleDiscount.enabled && (
            <>
              <label className="ly-inline">{k('simpleFrom')}<input type="number" min={1} value={s.simpleDiscount.fromStay} onChange={(e) => set({ simpleDiscount: { ...s.simpleDiscount, fromStay: Number(e.target.value) || 1 } })} /></label>
              <label className="ly-inline">{k('simplePct')}<input type="number" min={0} max={50} value={s.simpleDiscount.pct} onChange={(e) => set({ simpleDiscount: { ...s.simpleDiscount, pct: Number(e.target.value) || 0 } })} /></label>
            </>
          )}
        </div>
      </div>

      <div className="htl-panel">
        <h3 className="htl-h3">{k('rulesTitle')}</h3>
        <div className="htl-form ly-grid">
          <div className="htl-f wide">
            <label>{k('enrollment')}</label>
            <select value={s.enrollment} onChange={(e) => set({ enrollment: e.target.value as LoyaltySettings['enrollment'] })}>
              {(['auto_consent', 'auto_all', 'manual'] as const).map((x) => <option key={x} value={x}>{k(`enroll.${x}`)}</option>)}
            </select>
          </div>
          <label className="rtp-check ly-check"><input type="checkbox" checked={s.partnerEarnPoints} onChange={(e) => set({ partnerEarnPoints: e.target.checked })} />{k('partnerEarn')}</label>
          <label className="rtp-check ly-check"><input type="checkbox" checked={s.partnerCountsForTier} onChange={(e) => set({ partnerCountsForTier: e.target.checked })} />{k('partnerTier')}</label>
        </div>
      </div>

      {(multi || d.scope !== 'hotels') && (
        <div className="htl-panel">
          <h3 className="htl-h3">{k('netTitle')}</h3>
          <p className="htl-sub">{k('netHint')}</p>
          <div className="htl-form ly-grid">
            <div className="htl-f"><label>{k('st.reimburse')}</label><input type="number" min={0} max={100} value={s.settlement.reimbursePct} onChange={(e) => setSt({ reimbursePct: Number(e.target.value) || 0 })} /></div>
            <div className="htl-f"><label>{k('st.minTransfer', { cur: d.currency })}</label><input type="number" min={0} value={s.settlement.minTransfer} onChange={(e) => setSt({ minTransfer: Number(e.target.value) || 0 })} /></div>
            <div className="htl-f"><label>{k('st.cap', { cur: d.currency })}</label><input type="number" min={0} value={s.settlement.monthlyRedeemCap} placeholder="0" onChange={(e) => setSt({ monthlyRedeemCap: Number(e.target.value) || 0 })} /></div>
            <div className="htl-f"><label>{k('st.ratio')}</label><input type="number" min={1} step="0.5" value={s.settlement.imbalanceRatio} onChange={(e) => setSt({ imbalanceRatio: Number(e.target.value) || 1 })} /></div>
          </div>
          <div className="ly-sec">{k('blackoutTitle')}</div>
          {s.blackout.map((b, i) => (
            <div key={i} className="ly-row">
              <select value={b.hotelId || ''} onChange={(e) => set({ blackout: s.blackout.map((x, j) => (j === i ? { ...x, hotelId: e.target.value || null } : x)) })}>
                <option value="">{k('allHotels')}</option>
                {data.hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
              <DateInput value={b.from} onChange={(v) => set({ blackout: s.blackout.map((x, j) => (j === i ? { ...x, from: v } : x)) })} />
              <DateInput value={b.to} onChange={(v) => set({ blackout: s.blackout.map((x, j) => (j === i ? { ...x, to: v } : x)) })} />
              <button type="button" className="btn btn-sm" onClick={() => set({ blackout: s.blackout.filter((_, j) => j !== i) })} aria-label={t('crm.hotels.common.delete')}><Ic d={HTL_ICON.x} size={11} /></button>
            </div>
          ))}
          <button type="button" className="btn btn-sm" onClick={() => set({ blackout: [...s.blackout, { hotelId: null, from: todayIso(), to: todayIso() }] })}><Ic d={HTL_ICON.plus} size={11} />{k('addBlackout')}</button>
          <div className="htl-hint">{k('blackoutHint')}</div>
        </div>
      )}

      <div className="ly-actions">
        <label className="ly-switch"><input type="checkbox" checked={d.active} onChange={(e) => setD({ ...d, active: e.target.checked })} /><span>{k('activeLabel')}</span></label>
        <button className="btn" onClick={onClose}>{t('crm.hotels.common.cancel')}</button>
        <button className="btn btn-primary" disabled={busy} onClick={save}>{t('crm.hotels.common.save')}</button>
      </div>
    </div>
  );
};

// ─── участники ───

const MembersTab: React.FC<{ data: LoyaltyPrograms; programId: string }> = ({ data, programId }) => {
  const { k } = useK();
  const loc = useLoc();
  const [q, setQ] = useState('');
  const [tier, setTier] = useState('');
  const [rows, setRows] = useState<{ total: number; items: LoyaltyMemberRow[] } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const p = data.programs.find((x) => x.id === programId);
  const load = useCallback(() => fetchLoyaltyMembers({ programId, search: q || undefined, tier: tier || undefined }).then(setRows).catch(() => setRows({ total: 0, items: [] })), [programId, q, tier]);
  useEffect(() => { const h = window.setTimeout(() => void load(), 250); return () => window.clearTimeout(h); }, [load]);
  const tierName = (key: string | null) => p?.settings.tiers.find((x) => x.key === key)?.name || '—';
  return (
    <>
      <div className="htl-toolbar" style={{ marginTop: 0 }}>
        <div className="bk-search"><Ic d={HTL_ICON.search} size={14} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={k('searchPh')} /></div>
        <select className="htl-select" value={tier} onChange={(e) => setTier(e.target.value)}>
          <option value="">{k('allTiers')}</option>
          {p?.settings.tiers.map((x) => <option key={x.key} value={x.key}>{x.name}</option>)}
        </select>
        <span className="htl-sub" style={{ marginLeft: 'auto' }}>{rows ? k('membersTotal', { count: rows.total }) : ''}</span>
      </div>
      {!rows ? <div className="htl-rack-skel">{[0, 1].map((i) => <div key={i} />)}</div> : !rows.items.length ? <div className="htl-empty"><h4>{k('noMembers')}</h4><p>{k('noMembersHint')}</p></div> : (
        <div className="bk-table-wrap">
          <table className="bk-table">
            <thead><tr><th>{k('col.number')}</th><th>{k('col.guest')}</th><th>{k('col.tier')}</th><th className="num">{k('col.points')}</th><th className="num">{k('col.pending')}</th><th className="num">{k('col.lifetime')}</th><th>{k('col.activity')}</th></tr></thead>
            <tbody>
              {rows.items.map((m) => (
                <tr key={m.id} onClick={() => setOpen(m.id)} style={{ cursor: 'pointer' }} className={m.status === 'blocked' ? 'grp-off' : undefined}>
                  <td className="mono">{m.number}</td>
                  <td><b>{m.fullName}</b>{m.vip && <span className="ly-vip">VIP</span>}<div className="htl-sub">{m.email || '—'}</div></td>
                  <td><span className={`ly-tier t-${p?.settings.tiers.findIndex((x) => x.key === m.tier) ?? -1}`}>{tierName(m.tier)}</span></td>
                  <td className="num mono"><b>{m.points.toLocaleString(loc)}</b></td>
                  <td className="num mono htl-sub">{m.pendingPoints ? m.pendingPoints.toLocaleString(loc) : '—'}</td>
                  <td className="num mono">{m.lifetimePoints.toLocaleString(loc)}</td>
                  <td>{m.lastActivityAt ? new Date(m.lastActivityAt).toLocaleDateString(loc) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && <MemberDrawer id={open} hotels={data.hotels} onClose={() => setOpen(null)} onChanged={load} />}
    </>
  );
};

const MemberDrawer: React.FC<{ id: string; hotels: LoyaltyPrograms['hotels']; onClose: () => void; onChanged: () => void }> = ({ id, hotels, onClose, onChanged }) => {
  const { k, t } = useK();
  const loc = useLoc();
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlertModal();
  const [d, setD] = useState<LoyaltyMemberDetail | null>(null);
  const [adj, setAdj] = useState({ points: '', note: '', hotelId: '' });
  const load = useCallback(() => fetchLoyaltyMember(id).then(setD).catch(() => setD(null)), [id]);
  useEffect(() => { void load(); }, [load]);
  const err = (e: unknown) => showAlert(hotelErrorText(t, e, k('error')), { variant: 'error' });
  const doAdjust = () => adjustLoyaltyMember(id, { points: Number(adj.points), note: adj.note, hotelId: adj.hotelId || null }).then(() => { setAdj({ points: '', note: '', hotelId: '' }); void load(); onChanged(); showAlert(k('adjusted'), { variant: 'success' }); }).catch(err);
  const block = async () => {
    if (!d) return;
    const next = d.member.status === 'blocked' ? 'active' : 'blocked';
    if (next === 'blocked' && !(await showConfirm(k('blockBody'), { title: k('block'), confirmLabel: k('block'), cancelLabel: t('crm.hotels.common.cancel'), danger: true }))) return;
    setLoyaltyMemberStatus(id, next).then(() => { void load(); onChanged(); }).catch(err);
  };
  const tier = d?.program?.tiers.find((x) => x.key === d.member.tier);
  const cur = d?.program?.currency || '';
  return (
    <>
      <div className="bk-drawer-back" onClick={onClose} />
      <div className="bk-drawer ly-drawer">
        <div className="bk-drawer-head">
          <div><div className="htl-sub mono">{d?.member.number}</div><h3>{d?.profile?.fullName || '…'}</h3></div>
          <button type="button" className="btn btn-sm" onClick={onClose} aria-label={t('crm.hotels.common.cancel')}><Ic d={HTL_ICON.x} size={14} /></button>
        </div>
        {d && (
          <div className="bk-drawer-body">
            <div className="ly-member-top">
              <div><span>{k('col.tier')}</span><b>{tier?.name || '—'}</b>{tier?.discountPct ? <em>−{tier.discountPct}%</em> : null}</div>
              <div><span>{k('col.points')}</span><b>{d.member.points.toLocaleString(loc)}</b><em>≈ {money(d.member.points * (d.program?.pointValue || 0), cur, loc)}</em></div>
              <div><span>{k('col.pending')}</span><b>{d.member.pendingPoints.toLocaleString(loc)}</b></div>
            </div>
            {d.stats && <p className="htl-sub">{k('statsLine', { stays: d.stats.stays, nights: d.stats.nights, spend: money(d.stats.spend, cur, loc), period: k(`period.${d.program?.tierPeriod || '12m'}`) })}</p>}
            {tier?.benefits?.length ? <div className="ly-benefits">{tier.benefits.map((b) => <span key={b}>{b}</span>)}</div> : null}
            <div className="ly-row">
              <button className="btn btn-sm" onClick={() => void navigator.clipboard?.writeText(d.link).then(() => showAlert(k('copied'), { variant: 'success' }))}>{k('copyLink')}</button>
              {d.profile && <button className="btn btn-sm" onClick={() => navigate(`/hotels/guests?profile=${d.profile!.id}`)}>{k('openProfile')}</button>}
              <button className="btn btn-sm" onClick={() => void block()}>{d.member.status === 'blocked' ? k('unblock') : k('block')}</button>
            </div>
            {d.profile && !d.profile.marketingConsent && <div className="htl-hint">{k('noConsentHint')}</div>}

            <div className="htl-folio-sec">{k('adjustTitle')}</div>
            <div className="ly-adjust">
              <input type="number" placeholder={k('adjustPointsPh')} value={adj.points} onChange={(e) => setAdj({ ...adj, points: e.target.value })} />
              <select value={adj.hotelId} onChange={(e) => setAdj({ ...adj, hotelId: e.target.value })}><option value="">{k('noHotel')}</option>{hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
              <input className="wide" placeholder={k('adjustNotePh')} value={adj.note} onChange={(e) => setAdj({ ...adj, note: e.target.value })} />
              <button className="btn btn-sm btn-primary" disabled={!Number(adj.points) || !adj.note.trim()} onClick={doAdjust}>{k('adjust')}</button>
            </div>

            <div className="htl-folio-sec">{k('historyTitle')}</div>
            <div className="ly-tx">
              {d.tx.map((x) => (
                <div key={x.id} className={`ly-tx-row ${x.points < 0 ? 'neg' : ''} s-${x.status}`}>
                  <span>{new Date(x.createdAt).toLocaleDateString(loc)}</span>
                  <span>{k(`tx.${x.type}`)}{x.status === 'pending' ? ` · ${k('pending')}` : ''}{x.hotelName ? ` · ${x.hotelName}` : ''}{x.note ? <em> · {x.note}</em> : null}</span>
                  <b className="mono">{x.points > 0 ? '+' : ''}{x.points.toLocaleString(loc)}</b>
                </div>
              ))}
              {!d.tx.length && <div className="htl-sub">{k('noTx')}</div>}
            </div>
            <div className="htl-folio-sec">{k('staysTitle')}</div>
            <div className="ly-tx">
              {d.stays.map((x) => (
                <button key={x.id} type="button" className="ly-tx-row link" onClick={() => navigate(`/hotels/reservations?reservation=${x.reservationId}`)}>
                  <span>{x.checkOut}</span>
                  <span>{x.hotelName} · {k('nightsN', { count: x.nights })}{x.countsForTier ? '' : ` · ${k('notForTier')}`}</span>
                  <b className="mono">{money(x.spend, cur, loc)}</b>
                </button>
              ))}
              {!d.stays.length && <div className="htl-sub">{k('noStays')}</div>}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

// ─── взаиморасчёты сети ───

const monthStart = () => `${todayIso().slice(0, 8)}01`;

const SettlementTab: React.FC<{ programId: string }> = ({ programId }) => {
  const { k, t } = useK();
  const loc = useLoc();
  const { showAlert } = useAlertModal();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(todayIso());
  const [d, setD] = useState<LoyaltySettlement | null>(null);
  useEffect(() => { setD(null); fetchLoyaltySettlement(programId, from, to).then(setD).catch((e) => showAlert(hotelErrorText(t, e, k('error')), { variant: 'error' })); }, [programId, from, to]); // eslint-disable-line react-hooks/exhaustive-deps
  const cur = d?.program.currency || '';
  const m = (v: number) => money(v, cur, loc);
  return (
    <>
      <div className="htl-toolbar" style={{ marginTop: 0 }}>
        <DateInput value={from} onChange={setFrom} />
        <span className="htl-sub">—</span>
        <DateInput value={to} onChange={setTo} />
        <span className="htl-sub" style={{ marginLeft: 'auto' }}>{d ? k('settleRules', { pct: d.program.reimbursePct, min: m(d.program.minTransfer) }) : ''}</span>
      </div>
      {!d ? <div className="htl-rack-skel">{[0, 1].map((i) => <div key={i} />)}</div> : (
        <>
          <div className="htl-kpis">
            <div className="htl-kpi"><div className="l">{k('pool.issued')}</div><div className="v">{m(d.pool.issued)}</div></div>
            <div className="htl-kpi"><div className="l">{k('pool.reimbursed')}</div><div className="v">{m(d.pool.reimbursed)}</div></div>
            <div className="htl-kpi"><div className="l">{k('pool.retained')}</div><div className="v">{m(d.pool.retained)}</div><div className="d">{k('pool.retainedHint')}</div></div>
            <div className="htl-kpi"><div className="l">{k('pool.liability')}</div><div className="v">{m(d.liability.value)}</div><div className="d">{k('pool.liabilityHint', { points: (d.liability.points + d.liability.pendingPoints).toLocaleString(loc) })}</div></div>
          </div>
          <div className="bk-table-wrap">
            <table className="bk-table">
              <thead><tr><th>{k('s.hotel')}</th><th className="num">{k('s.issued')}</th><th className="num">{k('s.redeemed')}</th><th className="num">{k('s.reimbursed')}</th><th className="num">{k('s.net')}</th><th /></tr></thead>
              <tbody>
                {d.hotels.map((h) => (
                  <tr key={h.hotelId}>
                    <td><b>{h.hotelName}</b></td>
                    <td className="num mono">{m(h.issued)}<div className="htl-sub">{k('pts', { n: h.issuedPoints.toLocaleString(loc) })}</div></td>
                    <td className="num mono">{m(h.redeemedValue)}<div className="htl-sub">{k('pts', { n: h.redeemedPoints.toLocaleString(loc) })}</div></td>
                    <td className="num mono">{m(h.reimbursed)}</td>
                    <td className={`num mono ly-net ${h.net > 0 ? 'pos' : h.net < 0 ? 'neg' : ''}`}><b>{h.net > 0 ? '+' : ''}{m(h.net)}</b><div className="htl-sub">{h.net > 0 ? k('s.receives') : h.net < 0 ? k('s.pays') : ''}</div></td>
                    <td>{h.imbalance && <span className="ly-flag" title={k('imbalanceTitle', { ratio: d.program.imbalanceRatio })}>{k('imbalance')}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="htl-folio-sec">{k('transfersTitle')}</div>
          {!d.transfers.length && !d.carried.length ? <div className="htl-sub">{k('noTransfers')}</div> : (
            <div className="ly-transfers">
              {d.transfers.map((x, i) => <div key={`t${i}`}><b>{x.fromName}</b><span>→</span><b>{x.toName}</b><em className="mono">{m(x.amount)}</em></div>)}
              {d.carried.map((x, i) => <div key={`c${i}`} className="carried"><b>{x.fromName}</b><span>→</span><b>{x.toName}</b><em className="mono">{m(x.amount)}</em><i>{k('carried')}</i></div>)}
            </div>
          )}
          <div className="htl-hint" style={{ marginTop: 10 }}>{k('settleHint')}</div>
        </>
      )}
    </>
  );
};
