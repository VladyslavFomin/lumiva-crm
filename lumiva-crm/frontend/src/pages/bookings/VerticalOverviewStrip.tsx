import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchVerticalOverview } from '../../api/bookingVerticals';
import { fmtMoney, useDateLocale } from './verticalUi';
import './bookings-verticals.css';

/** Карточки «на сегодня» под тип бизнеса — каждая ведёт в свой рабочий раздел. */
export const VerticalOverviewStrip: React.FC<{ locationId?: string }> = ({ locationId }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const locale = useDateLocale();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetchVerticalOverview(locationId || undefined).then(setData).catch(() => setData(null));
  }, [locationId]);

  if (!data) return null;
  const cur = data.currency;
  const paidToday = (data.ordersToday || []).filter((r: any) => r.status === 'paid');
  const revenueToday = paidToday.filter((r: any) => r.currency === cur).reduce((s: number, r: any) => s + r.total, 0);
  const openChecks = (data.ordersToday || []).filter((r: any) => r.status === 'open' || r.status === 'billed').reduce((s: number, r: any) => s + r.count, 0);
  const cards: Array<{ l: string; v: React.ReactNode; d?: string; to: string }> = [];
  const V = (k: string, o?: Record<string, unknown>) => String(t(`crm.bookings.v.overview.${k}`, o));

  if (data.businessType === 'restaurant' && data.floor) {
    const s = data.floor.stats;
    cards.push({ l: V('tablesFree'), v: `${s.free}/${s.tables}`, d: V('occupiedN', { count: s.occupied }), to: '/bookings/floor' });
    cards.push({ l: V('guestsNow'), v: `${s.guestsNow}/${s.seatsTotal}`, d: V('guestsToday', { count: s.guestsToday }), to: '/bookings/floor' });
    cards.push({ l: V('waitingSeat'), v: data.floor.unseated, d: V('reservationsToday', { count: s.reservationsToday }), to: '/bookings/floor' });
    cards.push({ l: V('openChecks'), v: openChecks, to: '/bookings/orders' });
    cards.push({ l: V('revenueToday'), v: fmtMoney(revenueToday, cur, locale), d: data.topDishes?.[0] ? V('topDish', { name: data.topDishes[0].name }) : undefined, to: '/bookings/orders' });
  }
  if (data.businessType === 'fitness' && data.classes) {
    const c = data.classes;
    cards.push({ l: V('classesToday'), v: c.classesToday, d: V('spots', { booked: c.bookedToday, total: c.spotsToday }), to: '/bookings/schedule' });
    cards.push({ l: V('fillRate'), v: `${c.fillRate30}%`, d: V('last30', { count: c.classes30 }), to: '/bookings/schedule' });
    cards.push({ l: V('attendance'), v: `${c.attendanceRate30}%`, to: '/bookings/schedule' });
    cards.push({ l: V('activePasses'), v: data.passes.active, d: V('expiring', { count: data.passes.expiringSoon }), to: '/bookings/passes' });
    cards.push({ l: V('waitlistToday'), v: c.waitlistToday, to: '/bookings/schedule' });
  }
  if (data.businessType === 'consultation' && data.consult) {
    const c = data.consult;
    cards.push({ l: V('sessionsToday'), v: c.sessionsToday, d: V('onlineN', { count: c.onlineToday }), to: '/bookings/calendar' });
    cards.push({ l: V('followUps'), v: c.followUpsDue, to: '/bookings/calendar' });
    cards.push({ l: V('noSummary'), v: c.withoutSummary, d: V('last30short'), to: '/bookings/reservations' });
    cards.push({ l: V('activePackages'), v: data.passes.active, d: V('lowLeft', { count: data.passes.lowVisits }), to: '/bookings/passes' });
    cards.push({ l: V('revenueToday'), v: fmtMoney(revenueToday, cur, locale), to: '/bookings/orders' });
  }
  if (data.businessType === 'rental' && data.rental) {
    const r = data.rental;
    cards.push({ l: V('pickupsToday'), v: r.pickupsToday, to: '/bookings/desk' });
    cards.push({ l: V('returnsToday'), v: r.returnsToday, to: '/bookings/desk' });
    cards.push({ l: V('overdue'), v: r.overdue, to: '/bookings/desk' });
    cards.push({ l: V('outNow'), v: r.outNow, d: V('unitsN', { count: r.unitsOut }), to: '/bookings/inventory' });
    cards.push({ l: V('depositsHeld'), v: fmtMoney(r.depositsHeld, cur, locale), to: '/bookings/desk' });
  }
  if (data.businessType === 'salon') {
    cards.push({ l: V('openChecks'), v: openChecks, to: '/bookings/orders' });
    cards.push({ l: V('revenueToday'), v: fmtMoney(revenueToday, cur, locale), to: '/bookings/orders' });
  }
  if (!cards.length) return null;

  return (
    <div className="px-scope">
      <div className="vo-strip">
        {cards.map((c) => (
          <button key={c.l} type="button" className="vo-card" onClick={() => navigate(c.to)}>
            <div className="l">{c.l}</div>
            <div className="v" style={c.l === V('overdue') && Number(c.v) > 0 ? { color: '#cc2f47' } : undefined}>{c.v}</div>
            {c.d && <div className="d">{c.d}</div>}
          </button>
        ))}
      </div>
    </div>
  );
};
