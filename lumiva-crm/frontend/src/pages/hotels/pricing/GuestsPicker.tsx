import React from 'react';
import { useTranslation } from 'react-i18next';
import type { HotelRoomOccupancyType } from '../../../api/hotels';

/** Младенец — до 2 лет («INF (00-01,99)»): бесплатно, нужна детская кроватка */
export const INFANT_MAX_AGE = 2;
export const isInfant = (age: number | null | undefined) => age !== null && age !== undefined && age < INFANT_MAX_AGE;

/** Тот же разбор названия размещения, что на сервере (hotel-occupancy.util.ts) */
export function occupancyGuests(o: Pick<HotelRoomOccupancyType, 'adults' | 'children' | 'label'> & { infants?: number }) {
  const s = o.label || '';
  const AD = '(?:AD|ADL|ADT|ADULT|ВЗР|YET|YTŞ)';
  const range = new RegExp(`(\\d+)\\s*[-–]\\s*(\\d+)\\s*${AD}`, 'i').exec(s);
  const a = new RegExp(`(\\d+)\\s*${AD}`, 'i').exec(s);
  let adults: number | null = a ? Number(a[1]) : null;
  if (adults === null) {
    if (/(SGL|SNG|SINGLE|TEK)/i.test(s)) adults = 1;
    else if (/(DBL|DOUBLE|TWN|TWIN|ÇİFT)/i.test(s)) adults = 2;
    else if (/(TRP|TRIPLE)/i.test(s)) adults = 3;
    else if (/(QUAD|QDR)/i.test(s)) adults = 4;
  }
  const c = /(\d+)\s*(?:CHD|CH|CHILD|РЕБ|ДЕТ|ÇCK|ÇOC)/i.exec(s);
  const inf = /(\d+)\s*(?:INF|INFANT|BEBEK|МЛАД)/i.exec(s);
  const childPart = inf ? s.slice(0, inf.index) : s;
  const childBands = [...childPart.matchAll(/\(\s*(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)\s*\)/g)].map((m) => ({ from: Number(m[1].replace(',', '.')), to: Number(m[2].replace(',', '.')) }));
  const explicit = o.adults !== null && o.adults !== undefined;
  const max = explicit ? o.adults! : adults;
  return {
    adults: max,
    adultsMin: max === adults && range ? Number(range[1]) : max,
    children: explicit ? o.children || 0 : c ? Number(c[1]) : 0,
    infants: o.infants ?? (inf ? Number(inf[1]) : 0),
    childBands,
  };
}

/** Дети с возрастом ≥ childMaxAge считаются взрослыми; возраст не указан — ребёнок; младше 2 — младенец */
export function splitGuests(adults: number, childAges: Array<number | null>, childMaxAge: number) {
  const grown = childAges.filter((a) => a !== null && a >= childMaxAge).length;
  return { adults: adults + grown, children: childAges.length - grown, grown, infants: childAges.filter(isInfant).length };
}

function bandsFit(ages: Array<number | null>, bands: Array<{ from: number; to: number }>) {
  if (!bands.length) return true;
  const known = ages.filter((a): a is number => a !== null).sort((x, y) => x - y);
  const free = [...bands].sort((x, y) => x.from - y.from);
  while (free.length < known.length) free.push(free[free.length - 1]);
  for (const age of known) {
    const i = free.findIndex((b) => age >= b.from && age < Math.floor(b.to) + 1);
    if (i < 0) return false;
    free.splice(i, 1);
  }
  return true;
}

/** Как на сервере: размещение с младенцем → младенец как ребёнок в полосе → младенец сверх размещения (бесплатно) */
export function matchOccupancyByAges(types: HotelRoomOccupancyType[], adults: number, kidAges: Array<number | null>) {
  const infants = kidAges.filter(isInfant);
  const others = kidAges.filter((a) => !isInfant(a));
  const parsed = types.map((o) => ({ o, g: occupancyGuests(o) }));
  const fits = (g: ReturnType<typeof occupancyGuests>) => g.adults !== null && g.adultsMin !== null && adults >= g.adultsMin && adults <= g.adults;
  const passes: Array<(g: ReturnType<typeof occupancyGuests>) => boolean> = [
    (g) => infants.length > 0 && g.infants === infants.length && g.children === others.length && bandsFit(others, g.childBands),
    (g) => !g.infants && g.children === kidAges.length && bandsFit(kidAges, g.childBands),
    (g) => infants.length > 0 && !g.infants && g.children === others.length && bandsFit(others, g.childBands),
  ];
  for (const pass of passes) {
    const hit = parsed.find((p) => fits(p.g) && pass(p.g));
    if (hit) return hit.o;
  }
  return null;
}

export function matchOccupancy(types: HotelRoomOccupancyType[], adults: number, children: number) {
  return matchOccupancyByAges(types, adults, Array.from({ length: children }, () => null));
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
                  <option key={a} value={a}>{a === 0 ? k('under1') : k('years', { count: a })}{isInfant(a) ? ` · ${k('infant')}` : ''}{a >= childMaxAge ? ` · ${k('asAdult')}` : ''}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}
      {split.infants > 0 && <div className="gp-note">{k('infantNote', { count: split.infants })}</div>}
      {split.grown > 0 && <div className="gp-note">{k('grownNote', { count: split.grown, max: childMaxAge })}</div>}
      {childAges.some((a) => a === null) && <div className="gp-note warn">{k('ageMissing')}</div>}
    </div>
  );
};
