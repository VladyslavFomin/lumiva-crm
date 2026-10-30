import React from 'react';
import { useTranslation } from 'react-i18next';
import type { HotelRoomOccupancyType } from '../../../api/hotels';

/** Тот же разбор названия размещения, что на сервере (hotel-occupancy.util.ts) — для размещений без заданного состава */
export function occupancyGuests(o: Pick<HotelRoomOccupancyType, 'adults' | 'children' | 'label'>): { adults: number | null; children: number } {
  if (o.adults !== null && o.adults !== undefined) return { adults: o.adults, children: o.children || 0 };
  const s = o.label || '';
  const a = /(\d+)\s*(?:AD|ADL|ADT|ADULT|ВЗР|YET|YTŞ)/i.exec(s);
  let adults: number | null = a ? Number(a[1]) : null;
  if (adults === null) {
    if (/(SGL|SNG|SINGLE|TEK)/i.test(s)) adults = 1;
    else if (/(DBL|DOUBLE|TWN|TWIN|ÇİFT)/i.test(s)) adults = 2;
    else if (/(TRP|TRIPLE)/i.test(s)) adults = 3;
    else if (/(QUAD|QDR)/i.test(s)) adults = 4;
  }
  const c = /(\d+)\s*(?:CHD|CH|CHILD|РЕБ|ДЕТ|ÇCK|ÇOC)/i.exec(s);
  return { adults, children: c ? Number(c[1]) : 0 };
}

/** Дети с возрастом ≥ childMaxAge считаются взрослыми; возраст не указан — ребёнок */
export function splitGuests(adults: number, childAges: Array<number | null>, childMaxAge: number) {
  const grown = childAges.filter((a) => a !== null && a >= childMaxAge).length;
  return { adults: adults + grown, children: childAges.length - grown, grown };
}

export function matchOccupancy(types: HotelRoomOccupancyType[], adults: number, children: number) {
  return types.find((o) => {
    const g = occupancyGuests(o);
    return g.adults === adults && g.children === children;
  }) || null;
}

const Stepper: React.FC<{ label: string; value: number; min: number; max: number; onChange: (v: number) => void }> = ({ label, value, min, max, onChange }) => (
  <div className="gp-step">
    <span className="gp-step-l">{label}</span>
    <div className="gp-step-c">
      <button type="button" disabled={value <= min} onClick={() => onChange(value - 1)} aria-label="−">−</button>
      <b>{value}</b>
      <button type="button" disabled={value >= max} onClick={() => onChange(value + 1)} aria-label="+">+</button>
    </div>
  </div>
);

/** Состав гостей: взрослые, дети и возраст каждого ребёнка (по нему же решается, ребёнок это или уже взрослый). */
export const GuestsPicker: React.FC<{
  adults: number;
  childAges: Array<number | null>;
  childMaxAge: number;
  onChange: (adults: number, childAges: Array<number | null>) => void;
}> = ({ adults, childAges, childMaxAge, onChange }) => {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.guestsPicker.${key}`, o);
  const split = splitGuests(adults, childAges, childMaxAge);
  return (
    <div className="gp">
      <div className="gp-row">
        <Stepper label={k('adults')} value={adults} min={1} max={12} onChange={(v) => onChange(v, childAges)} />
        <Stepper
          label={k('children', { max: childMaxAge })}
          value={childAges.length}
          min={0}
          max={6}
          onChange={(v) => onChange(adults, v > childAges.length ? [...childAges, null] : childAges.slice(0, v))}
        />
      </div>
      {childAges.length > 0 && (
        <div className="gp-ages">
          {childAges.map((age, i) => (
            <label key={i} className={age === null ? 'gp-age empty' : age >= childMaxAge ? 'gp-age grown' : 'gp-age'}>
              <span>{k('childN', { n: i + 1 })}</span>
              <select value={age === null ? '' : String(age)} onChange={(e) => onChange(adults, childAges.map((a, j) => (j === i ? (e.target.value === '' ? null : Number(e.target.value)) : a)))}>
                <option value="">{k('agePick')}</option>
                {Array.from({ length: 18 }, (_, a) => (
                  <option key={a} value={a}>{a === 0 ? k('under1') : k('years', { count: a })}{a >= childMaxAge ? ` · ${k('asAdult')}` : ''}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}
      {split.grown > 0 && <div className="gp-note">{k('grownNote', { count: split.grown, max: childMaxAge })}</div>}
      {childAges.some((a) => a === null) && <div className="gp-note warn">{k('ageMissing')}</div>}
    </div>
  );
};
