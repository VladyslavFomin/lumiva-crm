// src/pages/onboarding/OnboardingAiStep.tsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { applyOnboardingAiPlan, fetchOnboardingAiPlan, type OnboardingAiPlan } from '../../api/onboarding';

const btnPrimary =
  'flex-1 inline-flex items-center justify-center rounded-xl bg-lumiva-accent hover:bg-lumiva-accent-soft transition-all px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-60';
const btnGhost =
  'flex-1 inline-flex items-center justify-center rounded-xl border border-slate-200 hover:border-lumiva-accent transition-all px-3 py-2.5 text-sm font-medium text-lumiva-accent disabled:opacity-60';

const Check: React.FC<{ checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }> = ({ checked, onChange, children }) => (
  <label className="flex items-start gap-2.5 py-1.5 text-sm text-slate-700 cursor-pointer">
    <input type="checkbox" className="mt-0.5 accent-black" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span className="min-w-0">{children}</span>
  </label>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="border-t border-slate-100 pt-3 mt-3 first:border-0 first:pt-0 first:mt-0">
    <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400 mb-1">{title}</div>
    {children}
  </div>
);

/**
 * Шаг мастера «Расскажите о бизнесе»: ИИ предлагает настройку из реальных объектов CRM,
 * пользователь отмечает, что применить. Ничего не меняется без «Применить».
 */
export const OnboardingAiStep: React.FC<{ onNext: () => void }> = ({ onNext }) => {
  const { t, i18n } = useTranslation();
  const ob = (key: string, opts?: Record<string, unknown>) => t(`crm.onboarding.ai.${key}`, opts as any) as string;
  const [text, setText] = useState('');
  const [plan, setPlan] = useState<OnboardingAiPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useCurrency, setUseCurrency] = useState(true);
  const [useBooking, setUseBooking] = useState(true);
  const [services, setServices] = useState<Set<number>>(new Set());
  const [fields, setFields] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<{ ok: number; failed: string[] } | null>(null);

  const errText = (e: unknown, fallback: string) => {
    const code = (e as { code?: string })?.code;
    if (code && ['AI_QUOTA_EXCEEDED', 'AI_UNAVAILABLE', 'TOO_SHORT', 'OWNER_ONLY'].includes(code)) return ob(`err.${code}`);
    return (e as Error)?.message || fallback;
  };

  const suggest = async () => {
    setBusy(true);
    setError(null);
    try {
      const p = await fetchOnboardingAiPlan(text, (i18n.language || 'ru').slice(0, 2));
      setPlan(p);
      setUseCurrency(!!p.currency);
      setUseBooking(!!p.bookingType && p.allowed.bookings);
      setServices(new Set(p.services.map((_, i) => i)));
      setFields(new Set(p.leadFields.map((_, i) => i)));
    } catch (e) {
      setError(errText(e, ob('err.plan')));
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!plan) return;
    setBusy(true);
    setError(null);
    try {
      const res = await applyOnboardingAiPlan(plan, {
        currency: useCurrency,
        booking: useBooking,
        services: servicesAllowed ? [...services] : [],
        leadFields: [...fields],
      });
      setResult({ ok: res.filter((r) => r.ok).length, failed: res.filter((r) => !r.ok).map((r) => r.item.split(':').slice(1).join(':')) });
    } catch (e) {
      setError(errText(e, ob('err.apply')));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (set: Set<number>, i: number, v: boolean) => {
    const n = new Set(set);
    if (v) n.add(i);
    else n.delete(i);
    return n;
  };

  const asBooking = !!plan?.bookingType && !!plan?.allowed.bookings;
  const servicesAllowed = asBooking || !!plan?.allowed.products;
  const nothingPicked = plan && !(useCurrency && plan.currency) && !(useBooking && asBooking) && !(servicesAllowed && services.size) && !fields.size;

  return (
    <>
      <div className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2">{ob('kicker')}</div>
      <h1 className="text-2xl font-semibold text-lumiva-accent mb-3">{plan ? plan.businessKind || ob('planTitle') : ob('title')}</h1>

      {!plan && (
        <>
          <p className="text-sm text-slate-600 leading-relaxed mb-4">{ob('body')}</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder={ob('placeholder')}
            className="w-full rounded-xl border border-slate-200 focus:border-lumiva-accent outline-none px-3 py-2.5 text-sm text-slate-700 resize-none mb-4"
          />
        </>
      )}

      {plan && !result && (
        <>
          {plan.summary && <p className="text-sm text-slate-600 leading-relaxed mb-4">{plan.summary}</p>}
          <div className="max-h-[46vh] overflow-y-auto pr-1 mb-4">
            {plan.currency && (
              <Section title={ob('sec.currency')}>
                <Check checked={useCurrency} onChange={setUseCurrency}>{ob('currency', { currency: plan.currency })}</Check>
              </Section>
            )}
            {asBooking && (
              <Section title={ob('sec.booking')}>
                <Check checked={useBooking} onChange={setUseBooking}>{ob('booking', { type: ob(`bookingType.${plan.bookingType}`) })}</Check>
              </Section>
            )}
            {servicesAllowed && plan.services.length > 0 && (
              <Section title={asBooking ? ob('sec.bookingServices') : ob('sec.products')}>
                {plan.services.map((s, i) => (
                  <Check key={i} checked={services.has(i)} onChange={(v) => setServices((p) => toggle(p, i, v))}>
                    {s.name}
                    <span className="text-slate-400">
                      {s.price != null ? ` · ${s.price}` : ''}
                      {asBooking && s.durationMinutes ? ` · ${ob('minutes', { n: s.durationMinutes })}` : ''}
                    </span>
                  </Check>
                ))}
                {plan.services.some((s) => s.price == null) && <div className="text-[11px] text-slate-400 mt-0.5">{ob('priceLater')}</div>}
              </Section>
            )}
            {plan.leadFields.length > 0 && (
              <Section title={ob('sec.fields')}>
                {plan.leadFields.map((f, i) => (
                  <Check key={i} checked={fields.has(i)} onChange={(v) => setFields((p) => toggle(p, i, v))}>
                    {f.label}
                    <span className="text-slate-400">
                      {' · '}
                      {ob(`fieldType.${f.type}`)}
                      {f.options.length ? `: ${f.options.join(', ')}` : ''}
                    </span>
                  </Check>
                ))}
              </Section>
            )}
            {plan.channels.length > 0 && (
              <Section title={ob('sec.channels')}>
                <div className="flex flex-wrap gap-1.5 py-1">
                  {plan.channels.map((c) => (
                    <span key={c} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{ob(`channel.${c}`)}</span>
                  ))}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {ob('channelsHint')}{' '}
                  <a href="/integrations-hub" className="underline text-slate-600">{ob('openIntegrations')}</a>
                </div>
              </Section>
            )}
          </div>
        </>
      )}

      {result && (
        <div className="text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-xl px-3 py-3 mb-4">
          {ob('applied', { count: result.ok })}
          {result.failed.length > 0 && <div className="text-xs text-red-600 mt-1">{ob('failed', { items: result.failed.join(', ') })}</div>}
        </div>
      )}

      {error && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-4">{error}</div>}

      <div className="flex gap-2">
        {!plan && (
          <>
            <button type="button" onClick={onNext} disabled={busy} className={btnGhost}>{ob('skipBtn')}</button>
            <button type="button" onClick={suggest} disabled={busy || text.trim().length < 10} className={btnPrimary}>
              {busy ? ob('thinkingBtn') : ob('suggestBtn')}
            </button>
          </>
        )}
        {plan && !result && (
          <>
            <button type="button" onClick={() => setPlan(null)} disabled={busy} className={btnGhost}>{ob('backBtn')}</button>
            <button type="button" onClick={apply} disabled={busy || !!nothingPicked} className={btnPrimary}>
              {busy ? ob('applyingBtn') : ob('applyBtn')}
            </button>
          </>
        )}
        {result && (
          <button type="button" onClick={onNext} className={btnPrimary}>{ob('nextBtn')}</button>
        )}
      </div>
    </>
  );
};
