import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlertModal } from '../../../contexts/AlertModalContext';
import { Ic, HTL_ICON } from '../HotelIcons';
import {
  fetchSeasonPrice,
  updatePricingPeriod,
  updateMarketGroup,
  updateRoomType,
  updateOccupancyType,
  setOccupancyOverride,
  setRoomTypePeriodPP,
  type HotelSeasonPrice,
} from '../../../api/hotels';
import { SeasonImportModal } from './SeasonImportModal';
import './season-price.css';

const fmt = (v: number | null | undefined, loc: string) =>
  v === null || v === undefined ? '' : v.toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtCoef = (v: number, loc: string) => v.toLocaleString(loc, { maximumFractionDigits: 2 });
const signed = (v: number, loc: string) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmt(Math.abs(v), loc)}`;

/** «1,6 / 2» → обычный и пиковый коэффициент; пусто/0 — ошибка */
function parseCoef(raw: string): { coefficient: string; peakCoefficient: string | null } | null {
  const parts = raw.split('/').map((s) => Number(s.trim().replace(',', '.'))).filter((n) => Number.isFinite(n) && n > 0);
  if (!parts.length) return null;
  return { coefficient: String(parts[0]), peakCoefficient: parts[1] && parts[1] !== parts[0] ? String(parts[1]) : null };
}

/** Ячейка, которая по клику становится полем ввода: Enter/blur — сохранить, Esc — отмена */
const EditCell: React.FC<{
  display: React.ReactNode;
  value: string;
  onSave: (v: string) => Promise<unknown> | void;
  className?: string;
  title?: string;
  inputMode?: 'decimal' | 'numeric' | 'text';
  disabled?: boolean;
}> = ({ display, value, onSave, className, title, inputMode = 'decimal', disabled }) => {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (edit) { setV(value); setTimeout(() => ref.current?.select(), 0); } }, [edit, value]);
  const commit = () => {
    setEdit(false);
    if (v.trim() !== value.trim()) onSave(v.trim());
  };
  if (edit) {
    return (
      <td className={`${className || ''} sp-editing`}>
        <input
          ref={ref}
          value={v}
          inputMode={inputMode}
          onChange={(e) => setV(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEdit(false);
          }}
        />
      </td>
    );
  }
  return (
    <td className={`${className || ''}${disabled ? '' : ' sp-ed'}`} title={title} onClick={() => !disabled && setEdit(true)}>
      {display}
    </td>
  );
};

/**
 * «Прайс сезона» — весь прайс-лист отеля как в Excel: периоды колонками, категории блоками, размещения строками.
 * Цена = PP периода (минимальная категория) + разница категории, × коэффициент размещения (в пик — пиковый), ± рынок.
 */
export const SeasonPriceSheet: React.FC<{
  hotelId: string;
  version: number;
  onAddPeriod: () => void;
  onAddGroup: () => void;
  onChanged: () => void;
}> = ({ hotelId, version, onAddPeriod, onAddGroup, onChanged }) => {
  const { t, i18n } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.season.${key}`, o);
  const loc = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
  const { showAlert } = useAlertModal();
  const [groupId, setGroupId] = useState<string | null>(null);
  const [data, setData] = useState<HotelSeasonPrice | null>(null);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);

  const load = useCallback(() => {
    if (!hotelId) return;
    fetchSeasonPrice(hotelId, groupId)
      .then(setData)
      .catch((e) => showAlert(e.message || k('loadError'), { variant: 'error' }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId, groupId]);
  useEffect(() => { load(); }, [load, version]);
  useEffect(() => { setGroupId(null); }, [hotelId]);

  const save = (p: Promise<unknown>) =>
    p.then(() => { load(); onChanged(); }).catch((e) => showAlert(e.message || k('saveError'), { variant: 'error' }));
  const d = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(loc, { day: '2-digit', month: '2-digit' });

  if (loading && !data) return <div className="sp-empty">{k('loading')}</div>;
  if (!data) return null;
  const { periods, roomTypes, groups } = data;
  const group = data.isReference ? null : groups.find((g) => g.id === data.marketGroupId) || null;
  const hasBudget = periods.some((p) => p.budgetPP > 0);
  const overlapIds = new Set(data.overlaps.flat());

  const toolbar = (
    <div className="sp-bar">
      <div className="sp-markets">
        <span className="sp-lbl">{k('market')}</span>
        {groups.length === 0 && <span className="sp-muted">{k('noGroups')}</span>}
        {groups.map((g) => (
          <button key={g.id} type="button" className={`sp-chip${g.id === data.marketGroupId ? ' on' : ''}`} onClick={() => setGroupId(g.id)}>
            {g.name}
            {g.id === data.referenceGroupId ? <span className="sp-tag">{k('reference')}</span> : g.adjustmentPct ? <span className="sp-tag">{g.adjustmentPct > 0 ? '+' : ''}{fmtCoef(g.adjustmentPct, loc)}%</span> : null}
          </button>
        ))}
        <button type="button" className="sp-chip add" onClick={onAddGroup}><Ic d={HTL_ICON.plus} size={11} />{k('addGroup')}</button>
      </div>
      <div className="sp-actions">
        <button type="button" className="btn" onClick={onAddPeriod}><Ic d={HTL_ICON.plus} size={13} />{k('addPeriod')}</button>
        <button type="button" className="btn btn-primary" onClick={() => setShowImport(true)}><Ic d={HTL_ICON.download} size={13} />{k('importBtn')}</button>
      </div>
    </div>
  );

  const importModal = showImport && (
    <SeasonImportModal
      hotelId={hotelId}
      onClose={() => setShowImport(false)}
      onDone={() => { setShowImport(false); load(); onChanged(); }}
    />
  );

  if (!periods.length) {
    return (
      <div className="sp-wrap">
        {toolbar}
        <div className="sp-empty">
          <h4>{k('emptyTitle')}</h4>
          <p>{k('emptyText')}</p>
          <button type="button" className="btn btn-primary" onClick={() => setShowImport(true)}><Ic d={HTL_ICON.download} size={13} />{k('importBtn')}</button>
        </div>
        {importModal}
      </div>
    );
  }

  const peakCls = (p: { isPeak: boolean }) => (p.isPeak ? ' pk' : '');

  return (
    <div className="sp-wrap">
      {toolbar}

      <div className="sp-formula">
        <span className="f"><b>{k('f.pp')}</b></span><span className="op">+</span>
        <span className="f">{k('f.diff')}</span><span className="op">×</span>
        <span className="f">{k('f.coef')}</span><span className="op">±</span>
        <span className="f">{k('f.market')}</span><span className="op">=</span>
        <span className="f"><b>{k('f.price')}</b></span>
        <span className="sp-muted">{k('f.hint')}</span>
      </div>

      {group && (
        <div className="sp-note">
          <span>{k('marketNote', { name: group.name })}</span>
          <label className="sp-pct">
            {k('adjustment')}
            <input
              key={`${group.id}-${group.adjustmentPct}`}
              defaultValue={String(group.adjustmentPct)}
              inputMode="decimal"
              onBlur={(e) => {
                const v = e.target.value.trim().replace(',', '.');
                if (v !== String(group.adjustmentPct)) save(updateMarketGroup(group.id, { adjustmentPct: v || '0' }));
              }}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
            %
          </label>
        </div>
      )}
      {data.overlaps.length > 0 && <div className="sp-note warn">{k('overlaps')}</div>}

      <div className="sp-scroll">
        <table className="sp-table">
          <thead>
            <tr>
              <th className="sp-c0">{data.currency}</th>
              <th className="sp-c1">{k('coef')}</th>
              {periods.map((p, i) => (
                <th key={p.id} className={`${peakCls(p)}${overlapIds.has(p.id) ? ' ov' : ''}`}>
                  <div className="sp-pn">{i + 1}</div>
                  <div>{d(p.startDate)}</div>
                  <div>{d(p.endDate)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="sp-meta">
              <td className="sp-c0">{k('minNights')}</td><td className="sp-c1" />
              {periods.map((p) => (
                <EditCell key={p.id} className={peakCls(p)} inputMode="numeric" value={String(p.minNights)} display={p.minNights}
                  onSave={(v) => save(updatePricingPeriod(p.id, { minNights: Number(v) || 1 }))} />
              ))}
            </tr>
            <tr className="sp-meta">
              <td className="sp-c0">{k('release')}</td><td className="sp-c1" />
              {periods.map((p) => (
                <EditCell key={p.id} className={peakCls(p)} inputMode="numeric" value={String(p.releaseDays)} display={p.releaseDays || '—'}
                  onSave={(v) => save(updatePricingPeriod(p.id, { releaseDays: Number(v) || 0 }))} />
              ))}
            </tr>
            <tr className="sp-meta">
              <td className="sp-c0" title={k('peakHint')}>{k('peak')}</td><td className="sp-c1" />
              {periods.map((p) => (
                <td key={p.id} className={`sp-chk${peakCls(p)}`}>
                  <input type="checkbox" checked={p.isPeak} onChange={(e) => save(updatePricingPeriod(p.id, { isPeak: e.target.checked }))} aria-label={k('peak')} />
                </td>
              ))}
            </tr>
            <tr className="sp-meta">
              <td className="sp-c0" title={k('budgetHint')}>{k('budget')}</td><td className="sp-c1" />
              {periods.map((p) => (
                <EditCell key={p.id} className={peakCls(p)} value={p.budgetPP ? String(p.budgetPP) : ''} display={p.budgetPP ? fmt(p.budgetPP, loc) : <span className="sp-muted">—</span>}
                  onSave={(v) => save(updatePricingPeriod(p.id, { budgetPP: v || '0' }))} />
              ))}
            </tr>
            <tr className="sp-base">
              <td className="sp-c0" title={k('ppBaseHint')}>{k('ppBase')}</td><td className="sp-c1" />
              {periods.map((p) => (
                <EditCell key={p.id} className={peakCls(p)} value={p.ppBase ? String(p.ppBase) : ''} display={p.ppBase ? fmt(p.ppBase, loc) : <span className="sp-muted">—</span>}
                  onSave={(v) => save(updatePricingPeriod(p.id, { ppBase: v || '0' }))} />
              ))}
            </tr>
            {group && (
              <tr className="sp-base mk">
                <td className="sp-c0" title={k('marketPPHint')}>{k('marketPP', { name: group.name })}</td><td className="sp-c1" />
                {periods.map((p) => (
                  <EditCell key={p.id} className={`${peakCls(p)}${p.marketPPManual ? ' man' : ' calc'}`}
                    value={p.marketPPManual ? String(group.periodPP[p.id] || '') : ''}
                    display={p.marketPP ? fmt(p.marketPP, loc) : <span className="sp-muted">—</span>}
                    title={p.marketPPManual ? k('manualTitle') : k('calcTitle')}
                    onSave={(v) => save(updateMarketGroup(group.id, { periodPP: { periodId: p.id, pp: v || null } }))} />
                ))}
              </tr>
            )}

            {roomTypes.map((rt) => (
              <React.Fragment key={rt.id}>
                <tr className="sp-cat">
                  <td className="sp-c0" colSpan={2}>
                    <b>{rt.name}</b>
                    {(rt.area || rt.sizeM2) && <span className="sp-area">{rt.area || `${rt.sizeM2} m²`}</span>}
                    {rt.isBase ? (
                      <span className="sp-tag base">{k('baseCategory')}</span>
                    ) : rt.pricingMode === 'fixed_rate' ? null : (
                      <span className="sp-diff">
                        {k('diff')}{' '}
                        <input
                          key={`${rt.id}-${rt.ppNetOffset}`}
                          defaultValue={String(rt.ppNetOffset)}
                          inputMode="decimal"
                          onBlur={(e) => {
                            const v = e.target.value.trim().replace(',', '.');
                            if (v !== String(rt.ppNetOffset)) save(updateRoomType(rt.id, { ppNetOffset: v || '0' }));
                          }}
                          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                        />
                      </span>
                    )}
                  </td>
                  {periods.map((p) => <td key={p.id} className={peakCls(p)} />)}
                </tr>
                <tr className="sp-pp">
                  <td className="sp-c0">{k('ppDbl')}</td><td className="sp-c1" />
                  {periods.map((p) => {
                    const c = rt.periods[p.id];
                    const low = c && c.margin !== null && c.margin < 0;
                    const tip = [
                      c?.budget ? k('budgetTip', { budget: fmt(c.budget, loc), margin: signed(c.margin || 0, loc) }) : '',
                      c?.ownPP ? k('ownTip') : '',
                      c?.dailyDays ? k('dailyTip', { count: c.dailyDays }) : '',
                    ].filter(Boolean).join('\n');
                    return (
                      <EditCell
                        key={p.id}
                        disabled={rt.isBase || !data.isReference}
                        className={`${peakCls(p)}${low ? ' low' : ''}${c?.ownPP ? ' own' : ''}`}
                        value={c?.ownPP ? String(c.pp) : ''}
                        title={tip || (rt.isBase ? k('baseTip') : k('ownEditTip'))}
                        display={<>{c ? fmt(c.pp, loc) : <span className="sp-muted">—</span>}{c?.dailyDays ? <i className="sp-dot" /> : null}</>}
                        onSave={(v) => save(setRoomTypePeriodPP(rt.id, p.id, v || null))}
                      />
                    );
                  })}
                </tr>
                {hasBudget && (
                  <tr className="sp-margin">
                    <td className="sp-c0">{k('margin')}</td><td className="sp-c1" />
                    {periods.map((p) => {
                      const m = rt.periods[p.id]?.margin;
                      return (
                        <td key={p.id} className={`${peakCls(p)}${m === null || m === undefined ? '' : m < 0 ? ' neg' : ' pos'}`}>
                          {m === null || m === undefined ? '' : signed(m, loc)}
                        </td>
                      );
                    })}
                  </tr>
                )}
                {rt.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="sp-c0 lbl">{r.label}</td>
                    <EditCell
                      className="sp-c1 coef"
                      inputMode="text"
                      value={r.peakCoefficient ? `${r.coefficient} / ${r.peakCoefficient}` : String(r.coefficient)}
                      display={r.peakCoefficient ? `${fmtCoef(r.coefficient, loc)} / ${fmtCoef(r.peakCoefficient, loc)}` : fmtCoef(r.coefficient, loc)}
                      title={k('coefHint')}
                      onSave={(v) => {
                        const c = parseCoef(v);
                        if (!c) return showAlert(k('coefError'), { variant: 'error' });
                        return save(updateOccupancyType(r.id, c));
                      }}
                    />
                    {periods.map((p) => {
                      const c = r.prices[p.id];
                      return (
                        <EditCell
                          key={p.id}
                          disabled={!data.isReference}
                          className={`${peakCls(p)}${c?.override ? ' man' : ''}`}
                          value={c?.override ? String(c.price) : ''}
                          title={c?.override ? k('overrideTip') : c ? k('cellTip', { coef: fmtCoef(c.coefficient, loc) }) : ''}
                          display={c ? fmt(c.price, loc) : <span className="sp-muted">—</span>}
                          onSave={(v) => save(setOccupancyOverride(r.id, p.id, v || null))}
                        />
                      );
                    })}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="sp-legend">
        <span><i className="sw pk" />{k('legend.peak')}</span>
        <span><i className="sw man" />{k('legend.manual')}</span>
        <span><i className="sw low" />{k('legend.low')}</span>
        <span><i className="sp-dot" />{k('legend.daily')}</span>
        <span className="sp-muted">{k('legend.edit')}</span>
      </div>
      {importModal}
    </div>
  );
};
