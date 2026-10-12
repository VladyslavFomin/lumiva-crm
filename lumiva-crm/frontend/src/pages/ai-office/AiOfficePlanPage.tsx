import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { aiOfficeApi, type OfficePlanPage } from '../../api/aiOffice';
import { OfficeShell, fmtEur, useNotify } from './officeShared';

const plx = (...a: Array<string | false | null | undefined>) => a.filter(Boolean).join(' ');
const PENDING_KEY = 'lumiva-ai-office-payment';

export function AiOfficePlanPage() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const notify = useNotify();
  const [p, setP] = useState<OfficePlanPage | null>(null);
  const [extra, setExtra] = useState(0);
  const [paying, setPaying] = useState(false);

  const load = async () => {
    try {
      const r = await aiOfficeApi.plan();
      setP(r);
      setExtra((cur) => (cur ? cur : Math.max(r.extraActive, r.used - r.included, 0)));
      return r;
    } catch (e) {
      notify.error(e);
      return null;
    }
  };

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    (async () => {
      // возврат с оплаты: подтверждаем платёж на сервере (никогда не доверяем самому редиректу)
      if (q.get('paid') === '1' || q.get('provider') === 'iyzico') {
        try {
          let ok = q.get('status') === 'paid';
          if (q.get('session_id')) ok = (await aiOfficeApi.confirmPayment({ provider: 'stripe', sessionId: q.get('session_id')! })).ok;
          else {
            const pend = JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null');
            if (pend?.provider === 'yookassa' && pend.ref) ok = (await aiOfficeApi.confirmPayment({ provider: 'yookassa', ref: pend.ref })).ok;
          }
          sessionStorage.removeItem(PENDING_KEY);
          if (ok) notify.success(t('aiOffice.plan.paid'));
          else notify.error(t('aiOffice.plan.notPaid'));
        } catch (e) {
          notify.error(e);
        }
        navigate('/ai-office/plan', { replace: true });
      }
      const r = await load();
      if (r && q.get('add') === '1') setExtra(Math.max(r.extraActive, r.used - r.included, 0) + 1);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!p) {
    return (
      <OfficeShell title={t('aiOffice.plan.title')}>
        <div className="of-none">{t('aiOffice.common.loading')}</div>
      </OfficeShell>
    );
  }

  const maxExtra = Math.max(0, p.maxDepartments - p.included);
  const minExtra = Math.max(0, p.used - p.included);
  const slots = p.included + extra;
  const cost = extra * p.extraPriceEur;
  const localCur = p.lang === 'ru' ? { code: 'RUB', rate: p.rates.RUB, sign: '₽' } : p.lang === 'tr' ? { code: 'TRY', rate: p.rates.TRY, sign: '₺' } : null;
  const active = p.extraActive > 0 && p.slotsUntil && new Date(p.slotsUntil).getTime() > Date.now();
  const changed = extra !== p.extraActive;
  const fmt = (v: number) => Math.round(v).toLocaleString(i18n.language);

  const pay = async () => {
    if (extra < 1) return;
    setPaying(true);
    try {
      const r = await aiOfficeApi.checkoutSlots(extra);
      if (r.provider === 'yookassa' && r.ref) sessionStorage.setItem(PENDING_KEY, JSON.stringify({ provider: 'yookassa', ref: r.ref }));
      if (r.url) window.location.href = r.url;
    } catch (e) {
      notify.error(e);
      setPaying(false);
    }
  };

  const cells = Array.from({ length: Math.max(slots, p.used) }, (_, i) => i);
  const plans = [
    { key: 'professional', price: t('aiOffice.plan.proPrice'), feats: ['proF1', 'proF2', 'proF3'], off: true },
    { key: 'enterprise', price: t('aiOffice.plan.includedN', { count: 3 }), feats: ['entF1', 'entF2', 'entF3', 'entF4'] },
    { key: 'ultimate', price: t('aiOffice.plan.includedN', { count: 5 }), feats: ['ultF1', 'entF2', 'entF3', 'entF4'] },
    { key: 'extra', price: t('aiOffice.plan.perMonth', { price: p.extraPriceEur }), feats: ['extraF1', 'extraF2', 'extraF3', 'extraF4'] },
  ];

  return (
    <OfficeShell
      title={t('aiOffice.plan.title')}
      plan={p.plan}
      sub={p.available ? t('aiOffice.plan.sub', { plan: t(`aiOffice.plans.${p.plan}`, p.plan), included: p.included, price: p.extraPriceEur }) : t('aiOffice.lock.text')}
      right={<Link className="ofp-btn" to="/billing">{t('aiOffice.plan.billing')}</Link>}
    >
      {!p.available ? (
        <div className="of-lock ofp-card">
          <h2>{t('aiOffice.lock.title')}</h2>
          <p>{t('aiOffice.lock.text')}</p>
          <Link className="ofp-btn pri" to="/billing">{t('aiOffice.lock.cta')}</Link>
        </div>
      ) : (
        <>
          <div className="pl-top">
            <div className="ofp-card ofp-card-b">
              <div className="pl-h">
                <span className="ofp-k">{t('aiOffice.plan.slots')}</span>
                <span className="ofp-k">{t('aiOffice.plan.usedOf', { used: p.used, total: p.capacity })}</span>
              </div>
              <div className="pl-grid">
                {cells.map((i) => {
                  const d = p.departments[i];
                  const inc = i < p.included;
                  const paid = !inc && i < p.capacity;
                  const free = !d && i < slots;
                  return (
                    <div key={i} className={plx('pl-cell', free && 'free', inc && 'inc')} style={d ? ({ ['--dc' as any]: d.color, animationDelay: i * 0.15 + 's' } as React.CSSProperties) : undefined}>
                      {d ? (
                        <>
                          <i />
                          <b>{d.name}</b>
                          <span>{inc ? t('aiOffice.plan.inPlan') : paid ? t('aiOffice.plan.paidSlot') : t('aiOffice.plan.unpaid')}</span>
                        </>
                      ) : (
                        <>
                          <b>{t('aiOffice.plan.free')}</b>
                          <span>{i < p.capacity ? t('aiOffice.plan.paidSlot') : t('aiOffice.plan.afterPay')}</span>
                        </>
                      )}
                    </div>
                  );
                })}
                {slots < p.maxDepartments && (
                  <button className="pl-cell add" onClick={() => setExtra(Math.min(maxExtra, extra + 1))}>
                    +<span>{p.extraPriceEur} €</span>
                  </button>
                )}
              </div>
            </div>
            <div className="ofp-card ofp-card-b pl-calc">
              <span className="ofp-k">{t('aiOffice.plan.extraDepts')}</span>
              <div className="pl-step">
                <button onClick={() => setExtra(Math.max(minExtra, extra - 1))} disabled={extra <= minExtra} aria-label="−">−</button>
                <b>{extra}</b>
                <button onClick={() => setExtra(Math.min(maxExtra, extra + 1))} disabled={extra >= maxExtra} aria-label="+">+</button>
              </div>
              <div className="pl-lines">
                <div><span>{t('aiOffice.plan.planLine', { plan: t(`aiOffice.plans.${p.plan}`, p.plan), count: p.included })}</span><b>{t('aiOffice.plan.inPlan')}</b></div>
                <div><span>{t('aiOffice.plan.extraLine', { n: extra, price: p.extraPriceEur })}</span><b>{fmt(cost)} €</b></div>
                <div className="tot"><span>{t('aiOffice.plan.total')}</span><b>{fmt(cost)} € / {t('aiOffice.plan.mo')}</b></div>
                {localCur?.rate ? (
                  <div className="rub"><span>{t('aiOffice.plan.rate', { rate: localCur.rate.toLocaleString(i18n.language, { maximumFractionDigits: 2 }), sign: localCur.sign })}</span><span>≈ {fmt(cost * localCur.rate)} {localCur.sign}</span></div>
                ) : null}
              </div>
              {active && (
                <div className="pl-note">{t('aiOffice.plan.activeUntil', { n: p.extraActive, date: new Date(p.slotsUntil!).toLocaleDateString(i18n.language) })}</div>
              )}
              <button className="ofp-btn pri" style={{ justifyContent: 'center' }} disabled={paying || extra < 1} onClick={pay}>
                {paying
                  ? t('aiOffice.plan.redirecting')
                  : extra < 1
                    ? t('aiOffice.plan.nothingToPay')
                    : active && !changed
                      ? t('aiOffice.plan.renew', { amount: fmt(cost) })
                      : t('aiOffice.plan.payN', { count: extra, amount: fmt(cost) })}
              </button>
              <div className="pl-note">{t('aiOffice.plan.note')}</div>
            </div>
          </div>

          <div className="pl-plans" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
            {plans.map((pl) => (
              <div key={pl.key} className={plx('ofp-card ofp-card-b pl-plan', p.plan === pl.key && 'cur', pl.off && 'off')}>
                <div className="pl-h">
                  <b>{pl.key === 'extra' ? t('aiOffice.plan.extraCard') : t(`aiOffice.plans.${pl.key}`)}</b>
                  {p.plan === pl.key && <span className="ofp-tag ok"><i />{t('aiOffice.plan.yourPlan')}</span>}
                </div>
                <div className="pl-price">{pl.price}</div>
                <ul>{pl.feats.map((f) => <li key={f}>{t(`aiOffice.plan.${f}`)}</li>)}</ul>
              </div>
            ))}
          </div>

          <div className="ofp-card">
            <div className="ofp-card-h">
              <h2>{t('aiOffice.plan.deptsInSub')} <small>{p.used}</small></h2>
              <Link className="ofp-btn" to="/ai-office/departments/new">+ {t('aiOffice.office.newDept')}</Link>
            </div>
            <div className="pl-tbl">
              <div className="pl-tr th">
                <span>{t('aiOffice.office.department')}</span>
                <span>{t('aiOffice.plan.agentsCol')}</span>
                <span>{t('aiOffice.plan.engineCol')}</span>
                <span>{t('aiOffice.plan.spendCol')}</span>
                <span>{t('aiOffice.plan.slotCol')}</span>
              </div>
              {p.departments.map((d, i) => (
                <Link key={d.id} className="pl-tr" to={`/ai-office/departments/${d.id}`}>
                  <span><i style={{ background: d.color }} />{d.name}</span>
                  <span>{d.agents}</span>
                  <span><em>{t(`aiOffice.engine.${d.engine.mode}`)}</em></span>
                  <span>{d.engine.mode === 'byok' ? <em>{t('aiOffice.plan.byokSpend')}</em> : `${fmtEur(d.spendMonthCents)} / ${fmtEur(d.monthlyBudgetCents)}`}</span>
                  <span>
                    {i < p.included ? (
                      <span className="ofp-tag ok">{t('aiOffice.plan.inPlan')}</span>
                    ) : i < p.capacity ? (
                      <span className="ofp-tag">{p.extraPriceEur} € / {t('aiOffice.plan.mo')}</span>
                    ) : (
                      <span className="ofp-tag warn">{t('aiOffice.paused.plan')}</span>
                    )}
                  </span>
                </Link>
              ))}
              {p.departments.length === 0 && <div className="of-none">{t('aiOffice.plan.noDepts')}</div>}
            </div>
          </div>
          <p className="pl-foot">{t('aiOffice.plan.foot')}</p>
        </>
      )}
    </OfficeShell>
  );
}

export default AiOfficePlanPage;
