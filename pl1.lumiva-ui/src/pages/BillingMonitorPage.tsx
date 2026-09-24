import React, { useEffect, useMemo, useState } from "react";
import {
  fetchBillingHealth,
  fetchBillingOverview,
  fetchPlatformSettings,
  sendStripeTest,
  type BillingHealth,
  type BillingOverview,
  type BillingPlanContent,
} from "../api/settings";

const formatMoney = (rows: Array<{ currency: string; amount: number }>) =>
  rows.length
    ? rows.map((r) => `${r.amount.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ${r.currency}`).join(" + ")
    : "—";

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

const BillingMonitorPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [health, setHealth] = useState<BillingHealth | null>(null);
  const [plans, setPlans] = useState<BillingPlanContent[]>([]);
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const crmBase =
    import.meta.env.VITE_CRM_FRONT_URL || "https://crm.lumiva.agency";

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [h, s, o] = await Promise.all([fetchBillingHealth(), fetchPlatformSettings(), fetchBillingOverview()]);
      setHealth(h);
      setPlans(s.billingPlans || []);
      setOverview(o);
    } catch (e: any) {
      setError(e?.message || "Не удалось загрузить Billing Monitor");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const runStripeTest = async () => {
    setTesting(true);
    setError(null);
    setStatus(null);
    try {
      await sendStripeTest();
      setStatus("Stripe тест прошел успешно.");
      await load();
    } catch (e: any) {
      setError(e?.message || "Stripe тест не прошел");
    } finally {
      setTesting(false);
    }
  };

  const readiness = useMemo(() => {
    if (!health) return 0;
    let score = 0;
    if (health.hasPublishableKey) score += 20;
    if (health.hasPlanContent) score += 20;
    const okPrices = health.prices.filter((p) => p.configured && p.validFormat).length;
    score += okPrices * 15;
    if (health.configured) score = 100;
    return Math.min(score, 100);
  }, [health]);

  return (
    <div className="space-y-4">
      <header className="pl1-page-header">
        <div>
          <h1 className="pl1-page-title">Billing Monitor</h1>
          <p className="pl1-page-subtitle">
            Мониторинг готовности Stripe/billing и наполнение тарифов из pl1.
          </p>
        </div>
        <div className="pl1-header-actions">
          <button type="button" className="pl1-btn-outline" onClick={() => void load()} disabled={loading}>
            {loading ? "Обновляем…" : "Обновить"}
          </button>
          <button type="button" className="pl1-btn-primary" onClick={() => void runStripeTest()} disabled={testing}>
            {testing ? "Проверяем…" : "Stripe test"}
          </button>
        </div>
      </header>

      {error && <div className="pl1-alert pl1-alert-error"><span className="pl1-alert-badge">ERROR</span><span>{error}</span></div>}
      {status && <div className="rounded-2xl border border-emerald-700/50 bg-emerald-900/30 px-4 py-3 text-sm text-emerald-50">{status}</div>}

      <section className="pl1-card p-5 space-y-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Выручка и тенанты</div>
          <p className="mt-1 text-xs text-slate-500">
            Реальные оплаченные Stripe Checkout Sessions за период — не оценка. Основной тариф
            продаётся как предоплаченный период (не Stripe Subscription), поэтому традиционного
            MRR здесь нет: это сумма реально прошедших платежей.
          </p>
        </div>

        {!overview?.stripeConfigured && (
          <div className="rounded-xl border border-amber-700/50 bg-amber-900/20 px-4 py-3 text-xs text-amber-200">
            Stripe не настроен — показаны только локальные данные по тенантам, без выручки.
          </div>
        )}

        {overview?.revenue && (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">За 30 дней</div>
              <div className="mt-1 text-xl font-semibold text-slate-100">{formatMoney(overview.revenue.last30d.byCurrency)}</div>
              <div className="text-xs text-slate-500 mt-0.5">{overview.revenue.last30d.count} платежей</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">За 90 дней</div>
              <div className="mt-1 text-xl font-semibold text-slate-100">{formatMoney(overview.revenue.last90d.byCurrency)}</div>
              <div className="text-xs text-slate-500 mt-0.5">{overview.revenue.last90d.count} платежей</div>
            </div>
          </div>
        )}

        {overview?.summary && (
          <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2.5">
              <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Платящих</div>
              <div className="mt-1 text-lg font-semibold text-slate-100">{overview.summary.totalPayingTenants}</div>
            </div>
            <div className={`rounded-xl border px-3 py-2.5 ${overview.summary.expiredCount ? "border-rose-700/60 bg-rose-900/20" : "border-slate-800 bg-slate-900/50"}`}>
              <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Просрочено</div>
              <div className={`mt-1 text-lg font-semibold ${overview.summary.expiredCount ? "text-rose-300" : "text-slate-100"}`}>{overview.summary.expiredCount}</div>
            </div>
            <div className={`rounded-xl border px-3 py-2.5 ${overview.summary.expiringSoonCount ? "border-amber-700/60 bg-amber-900/20" : "border-slate-800 bg-slate-900/50"}`}>
              <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Истекает ≤7д</div>
              <div className={`mt-1 text-lg font-semibold ${overview.summary.expiringSoonCount ? "text-amber-300" : "text-slate-100"}`}>{overview.summary.expiringSoonCount}</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2.5">
              <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Телефония</div>
              <div className="mt-1 text-lg font-semibold text-slate-100">{overview.summary.telephonySubscribers}</div>
            </div>
            <div className={`rounded-xl border px-3 py-2.5 ${overview.summary.recentPaymentFailures ? "border-rose-700/60 bg-rose-900/20" : "border-slate-800 bg-slate-900/50"}`}>
              <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Сбои оплаты (30д)</div>
              <div className={`mt-1 text-lg font-semibold ${overview.summary.recentPaymentFailures ? "text-rose-300" : "text-slate-100"}`}>{overview.summary.recentPaymentFailures}</div>
            </div>
          </div>
        )}

        {!!overview?.tenants.length && (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-xs">
              <thead className="bg-slate-900/70 text-slate-500">
                <tr>
                  <th className="text-left px-3 py-2">Тенант</th>
                  <th className="text-left px-3 py-2">Тариф</th>
                  <th className="text-left px-3 py-2">Статус</th>
                  <th className="text-left px-3 py-2">Активен до</th>
                  <th className="text-left px-3 py-2">Телефония</th>
                  <th className="text-left px-3 py-2">Сбой оплаты</th>
                </tr>
              </thead>
              <tbody>
                {overview.tenants.map((t) => (
                  <tr key={t.id} className={`border-t border-slate-800 ${t.expired ? "bg-rose-900/10" : t.expiringSoon ? "bg-amber-900/10" : ""}`}>
                    <td className="px-3 py-2 text-slate-200">{t.name} <span className="text-slate-500">· {t.clientKey}</span></td>
                    <td className="px-3 py-2 text-slate-300">{t.plan}</td>
                    <td className="px-3 py-2 text-slate-300">{t.status}</td>
                    <td className={`px-3 py-2 ${t.expired ? "text-rose-300 font-semibold" : t.expiringSoon ? "text-amber-300" : "text-slate-300"}`}>
                      {formatDate(t.activeUntil)}{t.expired ? " · просрочено" : t.expiringSoon ? " · скоро" : ""}
                    </td>
                    <td className="px-3 py-2 text-slate-300">{t.telephonyAddonEnabled ? "да" : "—"}</td>
                    <td className="px-3 py-2 text-slate-300">{formatDate(t.lastPaymentFailedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="pl1-card p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Readiness</div>
            <div className="mt-1 text-2xl font-semibold text-slate-100">{readiness}%</div>
          </div>
          <div className="h-2 w-full max-w-[420px] rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-sky-400 to-emerald-400" style={{ width: `${readiness}%` }} />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <a href={`${crmBase}/app/billing`} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-200 hover:border-slate-600">
            Открыть CRM Billing
          </a>
          <a href={`${crmBase}/pricing?renew=1`} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-200 hover:border-slate-600">
            Открыть Public Pricing
          </a>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {health?.prices.map((price) => (
            <div key={price.code} className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{price.code}</div>
              <div className="mt-1 text-sm text-slate-200">
                {price.configured ? "Price задан" : "Price не задан"}
              </div>
              <div className={`text-xs ${price.validFormat ? "text-emerald-300" : "text-amber-300"}`}>
                {price.validFormat ? "Формат ok (price_...)" : "Неверный формат"}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => (
          <article
            key={plan.code}
            className={`rounded-2xl border bg-slate-950/70 p-4 ${
              plan.highlighted ? "border-indigo-500/60" : "border-slate-800"
            }`}
          >
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{plan.code}</div>
            <h3 className="mt-1 text-lg font-semibold text-slate-100">{plan.title}</h3>
            <div className="text-2xl font-semibold text-slate-50 mt-2">{plan.price}</div>
            <p className="mt-1 text-xs text-slate-400">{plan.subtitle}</p>
            <ul className="mt-3 space-y-1.5 text-xs text-slate-300">
              {plan.features.slice(0, 5).map((f) => (
                <li key={f}>• {f}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </div>
  );
};

export default BillingMonitorPage;
