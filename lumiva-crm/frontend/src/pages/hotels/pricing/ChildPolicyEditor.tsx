import React from 'react';
import { useTranslation } from 'react-i18next';
import { Ic, HTL_ICON } from '../HotelIcons';
import type { HotelChildPolicyRule } from '../../../api/hotels';

/** Типовая турецкая политика — для кнопки «Заполнить типовой» */
export const TYPICAL_CHILD_POLICY: HotelChildPolicyRule[] = [
  { ageFrom: 0, ageTo: 2, type: 'free', value: 0 },
  { ageFrom: 2, ageTo: 7, type: 'percent', value: 50 },
  { ageFrom: 7, ageTo: 12, type: 'percent', value: 70 },
];

/** Полосы возраста детей → бесплатно / % от цены взрослого; правило можно ограничить N-м ребёнком (1 — старший). Тот же редактор у отеля и у контракта. */
export const ChildPolicyEditor: React.FC<{
  value: HotelChildPolicyRule[];
  onChange: (v: HotelChildPolicyRule[]) => void;
  childMaxAge?: number;
}> = ({ value, onChange, childMaxAge }) => {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.childPolicy.${key}`, o);
  const up = (i: number, patch: Partial<HotelChildPolicyRule>) => onChange(value.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="cp-ed">
      {value.map((r, i) => (
        <div key={i} className="htl-rule">
          <select value={r.childNo || 0} onChange={(e) => up(i, { childNo: Number(e.target.value) || undefined })} aria-label={k('childNoLabel')}>
            <option value={0}>{k('anyChild')}</option>
            {[1, 2, 3].map((n) => <option key={n} value={n}>{k('nthChild', { n })}</option>)}
          </select>
          <span>{k('ageFrom')}</span>
          <input type="number" min={0} max={17} value={r.ageFrom} onChange={(e) => up(i, { ageFrom: Number(e.target.value) })} />
          <span>{k('ageTo')}</span>
          <input type="number" min={1} max={18} value={r.ageTo} onChange={(e) => up(i, { ageTo: Number(e.target.value) })} />
          <span className="cp-range">{k('range', { from: r.ageFrom, to: Math.max(r.ageFrom, r.ageTo - 1) })}</span>
          <select value={r.type} onChange={(e) => up(i, { type: e.target.value as 'free' | 'percent', value: e.target.value === 'free' ? 0 : r.value || 50 })}>
            <option value="free">{k('free')}</option>
            <option value="percent">{k('percent')}</option>
          </select>
          {r.type === 'percent' && (
            <>
              <input type="number" min={0} max={100} value={r.value} onChange={(e) => up(i, { value: Number(e.target.value) })} />
              <span>%</span>
            </>
          )}
          <button type="button" className="btn-icon" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={k('remove')}><Ic d={HTL_ICON.x} size={13} /></button>
        </div>
      ))}
      {value.some((r) => r.ageTo <= r.ageFrom) && <div className="htl-hint" style={{ color: '#9a1f31' }}>{k('badRange')}</div>}
      {childMaxAge && value.some((r) => r.ageTo > childMaxAge) && <div className="htl-hint">{k('overMax', { max: childMaxAge })}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-sm" onClick={() => onChange([...value, { ageFrom: 2, ageTo: childMaxAge || 12, type: 'percent', value: 50 }])}>
          <Ic d={HTL_ICON.plus} size={12} />{k('add')}
        </button>
        {!value.length && (
          <button type="button" className="btn btn-sm" onClick={() => onChange(TYPICAL_CHILD_POLICY.map((r) => ({ ...r })))}>{k('typical')}</button>
        )}
      </div>
    </div>
  );
};
