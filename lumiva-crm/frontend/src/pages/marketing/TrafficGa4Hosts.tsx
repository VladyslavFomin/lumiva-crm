import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Ga4HostAlert, Ga4HostBreakdown } from '../../api/marketing';
import { cl } from '../contacts/CrmListShared';
import { Dash, moneyOf, type CurCtx } from './trafficShared';

type Fmt = { nf: (v: number) => string; mk: (v: number) => string };

/** Сигналы GA4 по доменам: выручка пропала, покупки без суммы, покупок нет вообще. */
export const Ga4HostAlerts: React.FC<{ alerts: Ga4HostAlert[]; dsLabel: (ds: string) => string; fmt: Fmt }> = ({ alerts, dsLabel, fmt }) => {
  const { t } = useTranslation();
  if (!alerts.length) return null;
  const text = (a: Ga4HostAlert) => {
    const base = { property: dsLabel(a.dataSource), host: a.host ?? '' };
    if (a.type === 'revenue_stopped')
      return t('crm.trafficPage.ga4Alerts.revenueStopped', { ...base, date: a.lastRevenueDate, days: a.daysSince, sessions: fmt.nf(a.sessionsSince || 0) });
    if (a.type === 'purchases_without_value') return t('crm.trafficPage.ga4Alerts.noValue', { ...base, count: a.purchases || 0 });
    return t('crm.trafficPage.ga4Alerts.noRevenue', { ...base, sessions: fmt.nf(a.sessions || 0) });
  };
  return (
    <div className="tr-alerts" role="status">
      <div className="tr-alerts-h">{t('crm.trafficPage.ga4Alerts.title')}</div>
      <ul>
        {alerts.map((a) => (
          <li key={`${a.type}:${a.dataSource}:${a.host ?? ''}`} className={cl(a.type === 'revenue_stopped' && 'crit')}>
            {text(a)}
          </li>
        ))}
      </ul>
      <div className="tr-alerts-f">{t('crm.trafficPage.ga4Alerts.hint')}</div>
    </div>
  );
};

/** Выручка GA4 по доменам — модуль бронирования обычно на своём домене. */
export const Ga4HostsCard: React.FC<{
  data: Ga4HostBreakdown;
  ctx: CurCtx;
  dsLabel: (ds: string) => string;
  fmt: Fmt;
  periodName: string;
}> = ({ data, ctx, dsLabel, fmt, periodName }) => {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const flagged = useMemo(() => new Set(data.alerts.filter((a) => a.host).map((a) => `${a.dataSource}\t${a.host}`)), [data.alerts]);
  const groups = useMemo(() => {
    const m = new Map<string, Ga4HostBreakdown['items']>();
    for (const it of data.items) {
      if (!m.has(it.dataSource)) m.set(it.dataSource, []);
      m.get(it.dataSource)!.push(it);
    }
    return [...m.entries()].map(([ds, rows]) => {
      const total = rows.reduce((s, r) => s + r.sessions, 0) || 1;
      // Мелкие домены (тестовые, localhost) прячем, если по ним нет покупок.
      const main = rows.filter((r) => r.revenue > 0 || r.purchases > 0 || r.sessions / total >= 0.01 || flagged.has(`${ds}\t${r.host}`));
      return { ds, rows: showAll ? rows : main, hidden: rows.length - main.length };
    });
  }, [data.items, flagged, showAll]);
  if (!data.items.length) return null;
  const hiddenTotal = groups.reduce((s, g) => s + g.hidden, 0);
  const money = (v: number, c: string) => {
    if (!v) return <Dash />;
    const m = moneyOf(ctx, v, c);
    return (
      <>
        {fmt.mk(m.v)}
        <span className="u">
          {m.c}
          {m.miss ? '*' : ''}
        </span>
      </>
    );
  };
  return (
    <div className="sm-card">
      <div className="sm-card-head">
        <h3>{t('crm.trafficPage.hosts.title')}</h3>
        <div className="sm-card-tools">
          <span className="meta">GA4 · {periodName}</span>
          {hiddenTotal > 0 && (
            <button type="button" className="btn btn-sm" onClick={() => setShowAll((v) => !v)}>
              {showAll ? t('crm.trafficPage.hosts.hideSmall') : t('crm.trafficPage.hosts.showAll', { count: hiddenTotal })}
            </button>
          )}
        </div>
      </div>
      <div className="tr-hosts-wrap">
        <table className="sm-table tr-hosts">
          <thead>
            <tr>
              <th>{t('crm.trafficPage.hosts.host')}</th>
              <th className="r">{t('crm.trafficPage.col.sessions')}</th>
              <th className="r">{t('crm.trafficPage.hosts.purchases')}</th>
              <th className="r">{t('crm.trafficPage.col.revenue')}</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <React.Fragment key={g.ds}>
                <tr className="tr-hosts-g">
                  <td colSpan={4}>{dsLabel(g.ds)}</td>
                </tr>
                {g.rows.map((r) => {
                  const warn = flagged.has(`${g.ds}\t${r.host}`);
                  return (
                    <tr key={r.host} className={cl(warn && 'warn')}>
                      <td>
                        <span className="tr-host">{r.host}</span>
                        {warn && <span className="tr-cond tr-warn-b">{t('crm.trafficPage.hosts.check')}</span>}
                      </td>
                      <td className="r">{r.sessions ? fmt.nf(r.sessions) : <Dash />}</td>
                      <td className="r">{r.purchases ? fmt.nf(r.purchases) : <Dash />}</td>
                      <td className="r pos">{money(r.revenue, r.currency)}</td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="tr-foot">{t('crm.trafficPage.hosts.foot')}</div>
    </div>
  );
};
