import React, { useEffect, useMemo, useState } from "react";
import {
  fetchBillingHealth,
  fetchPlatformSettings,
  sendStripeTest,
  type BillingHealth,
  type BillingPlanContent,
} from "../api/settings";

const BillingMonitorPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [health, setHealth] = useState<BillingHealth | null>(null);
  const [plans, setPlans] = useState<BillingPlanContent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const crmBase =
    import.meta.env.VITE_CRM_FRONT_URL || "https://crm.lumiva.agency";

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [h, s] = await Promise.all([fetchBillingHealth(), fetchPlatformSettings()]);
      setHealth(h);
      setPlans(s.billingPlans || []);
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
