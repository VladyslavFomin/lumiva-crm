import React from 'react';
import { useTranslation } from 'react-i18next';
import type { CountryAnalyticsRow } from '../../../api/hotels';
import { CountryTag } from '../CountrySelect';
import { money } from './partnerUtils';

/** Разрез по странам: брони, ночи, гости, брутто/нетто/комиссия, ADR, средняя длительность, доля с полоской. */
export const CountryTable: React.FC<{ rows: CountryAnalyticsRow[]; currency: string; onPick?: (code: string | null) => void }> = ({ rows, currency, onPick }) => {
  const { t, i18n } = useTranslation();
  const c = (k: string) => t(`crm.hotels.countriesTable.${k}`);
  const lang = i18n.language;
  if (!rows.length) return <div className="htl-sub" style={{ padding: 16 }}>{c('empty')}</div>;
  const max = Math.max(...rows.map((r) => r.sharePct), 1);
  return (
    <div className="bk-table-wrap">
      <table className={`bk-table${onPick ? ' htl-click-rows' : ''}`}>
        <thead>
          <tr>
            <th>{c('country')}</th>
            <th>{c('share')}</th>
            <th>{c('bookings')}</th>
            <th>{c('roomNights')}</th>
            <th>{c('guests')}</th>
            <th>{c('avgStay')}</th>
            <th>{c('adr')}</th>
            <th>{c('gross')}</th>
            <th>{c('commission')}</th>
            <th>{c('net')}</th>
            <th>{c('cancelled')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.country || 'none'} onClick={onPick ? () => onPick(r.country) : undefined}>
              <td><CountryTag code={r.country} empty={c('unknown')} /></td>
              <td style={{ minWidth: 140 }}>
                <div className="htl-share">
                  <div className="bar"><div style={{ width: `${(r.sharePct / max) * 100}%` }} /></div>
                  <span className="mono">{r.sharePct}%</span>
                </div>
              </td>
              <td className="mono">{r.bookings}</td>
              <td className="mono">{r.roomNights}</td>
              <td className="mono">{r.guests}</td>
              <td className="mono">{r.avgStay}</td>
              <td className="mono">{money(r.adr, currency, lang)}</td>
              <td className="mono">{money(r.gross, currency, lang)}</td>
              <td className="mono">{r.commission ? money(r.commission, currency, lang) : '—'}</td>
              <td className="mono">{money(r.net, currency, lang)}</td>
              <td className="mono">{r.cancelled || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
