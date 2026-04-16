import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  confirmCheckoutSession,
  createCheckoutSession,
  fetchBillingCatalog,
  type BillingCatalogPlan,
} from '../api/client';
import { markBillingUnlocked } from '../auth/session';
import { setAppLanguage } from '../i18n';

type PlanCode = 'standard' | 'professional' | 'enterprise' | 'ultimate';
type BillingPeriod = 'month' | 'year';

const YEARLY_DISCOUNT: Record<PlanCode, number> = {
  standard: 0.1,
  professional: 0.12,
  enterprise: 0.15,
  ultimate: 0.2,
};

const DEFAULT_PLANS: BillingCatalogPlan[] = [];

export const BillingPage: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [plans, setPlans] = React.useState<BillingCatalogPlan[]>(DEFAULT_PLANS);
  const [period, setPeriod] = React.useState<BillingPeriod>(
    params.get('period') === 'year' ? 'year' : 'month',
  );
  const [loadingPlan, setLoadingPlan] = React.useState<PlanCode | null>(null);
  const [status, setStatus] = React.useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(
    null,
  );
  const sessionId = params.get('session_id');
  const cancelled = params.get('cancelled');
  const renew = params.get('renew') === '1';
  const preferredPlan = params.get('plan') as PlanCode | null;
  const isPreferredPlan =
    preferredPlan === 'standard' ||
    preferredPlan === 'professional' ||
    preferredPlan === 'enterprise' ||
    preferredPlan === 'ultimate';
  const lang = (i18n.language || 'ru').slice(0, 2) as 'ru' | 'en' | 'tr';

  const text =
    lang === 'en'
      ? {
          title: renew ? 'Renew your plan and keep access to CRM' : 'Activate a plan and unlock full CRM',
          subtitle: renew
            ? 'Your access period has ended. Select period and renew without re-registration.'
            : 'Your account is currently in limited mode. Select a plan and pay via Stripe.',
          month: 'Monthly',
          year: 'Yearly (discount)',
          planLabel: 'Plan',
          perUserMonth: '/user/month',
          perUserYear: '/user/year',
          yearlyNote: 'Year payment: 12 months · discount',
          choose: 'Choose',
          chooseYear: 'Choose yearly',
          renewMonth: 'Renew monthly',
          renewYear: 'Renew yearly',
          loading: 'Processing...',
          home: 'Main page',
          pricing: 'Pricing',
          login: 'Login',
          footer: 'Lumiva CRM billing and renewals',
          recommended: 'Recommended',
        }
      : lang === 'tr'
        ? {
            title: renew ? 'Planinizi uzatın ve CRM erişimini koruyun' : 'Planı etkinleştirin ve CRM tam erişimi açın',
            subtitle: renew
              ? 'Erişim süreniz sona erdi. Dönemi seçin ve yeniden kayıt olmadan uzatın.'
              : 'Hesabınız şu anda sınırlı modda. Plan seçip Stripe ile ödeme yapın.',
            month: 'Aylık',
            year: 'Yıllık (indirimli)',
            planLabel: 'Plan',
            perUserMonth: '/kullanıcı/ay',
            perUserYear: '/kullanıcı/yıl',
            yearlyNote: 'Yıllık ödeme: 12 ay · indirim',
            choose: 'Seç',
            chooseYear: 'Yıllık seç',
            renewMonth: 'Aylık uzat',
            renewYear: 'Yıllık uzat',
            loading: 'Yönlendiriliyor...',
            home: 'Ana sayfa',
            pricing: 'Fiyatlar',
            login: 'Giriş',
            footer: 'Lumiva CRM faturalandırma ve yenilemeler',
            recommended: 'Önerilen',
          }
        : {
            title: renew ? 'Продлите тариф и продолжайте работу в CRM' : 'Активируйте тариф и получите полный доступ к CRM',
            subtitle: renew
              ? 'Срок доступа завершился. Выберите период и продлите подписку без повторной регистрации.'
              : 'Сейчас аккаунт в ограниченном режиме. Выберите план и оплатите через Stripe.',
            month: 'На месяц',
            year: 'На год (со скидкой)',
            planLabel: 'Тариф',
            perUserMonth: '/пользователь/месяц',
            perUserYear: '/пользователь/год',
            yearlyNote: 'Годовой платеж: 12 месяцев · скидка',
            choose: 'Выбрать',
            chooseYear: 'Выбрать на год',
            renewMonth: 'Продлить на месяц',
            renewYear: 'Продлить на год',
            loading: 'Переходим...',
            home: 'Главная',
            pricing: 'Тарифы',
            login: 'Вход',
            footer: 'Lumiva CRM · биллинг и продления',
            recommended: 'Рекомендуем',
          };

  const getLocalizedPlanContent = (plan: BillingCatalogPlan) => {
    if (lang === 'ru') {
      return {
        subtitle: plan.subtitle,
        description: plan.description,
        features: plan.features,
      };
    }
    const locale = plan.i18n?.[lang];
    return {
      subtitle: locale?.subtitle?.trim() || plan.subtitle,
      description: locale?.description?.trim() || plan.description,
      features: Array.isArray(locale?.features) && locale.features.length ? locale.features : plan.features,
    };
          };

  const parseMonthlyPrice = (raw: string): number => {
    const normalized = String(raw || '').replace(',', '.');
    const match = normalized.match(/(\d+(\.\d+)?)/);
    const v = match ? Number(match[1]) : NaN;
    return Number.isFinite(v) && v > 0 ? v : 0;
  };

  const planGridClass = embedded
    ? 'grid grid-flow-col auto-cols-[88%] gap-3 overflow-x-auto px-0.5 pb-2.5 pt-0.5 snap-x snap-mandatory md:grid-flow-row md:auto-cols-auto md:grid-cols-4'
    : 'grid gap-4 md:grid-cols-2 xl:grid-cols-4';

  React.useEffect(() => {
    fetchBillingCatalog()
      .then((list) => {
        if (Array.isArray(list) && list.length) {
          setPlans(list as BillingCatalogPlan[]);
        }
      })
      .catch(() => {
        // use defaults when backend catalog unavailable
      });
  }, []);

  React.useEffect(() => {
    if (cancelled === '1') {
      setStatus({
        type: 'info',
        text: 'Оплата была отменена. Вы вернулись на страницу тарифов, можете выбрать план снова.',
      });
    }
  }, [cancelled]);

  React.useEffect(() => {
    if (!sessionId) return;
    confirmCheckoutSession(sessionId)
      .then((res) => {
        if (!res.ok) {
          setStatus({
            type: 'error',
            text: 'Платеж не подтвержден. Проверьте оплату и попробуйте еще раз.',
          });
          return;
        }
        markBillingUnlocked();
        setStatus({ type: 'success', text: 'Оплата подтверждена, тариф активирован.' });
        setTimeout(() => navigate('/app', { replace: true }), 800);
      })
      .catch((e) =>
        setStatus({
          type: 'error',
          text: e?.message || 'Не удалось подтвердить оплату. Вы можете повторить попытку.',
        }),
      );
  }, [sessionId, navigate]);

  const startCheckout = async (plan: PlanCode) => {
    try {
      setLoadingPlan(plan);
      setStatus(null);
      const origin = window.location.origin;
      const returnBasePath = embedded ? '/app' : '/app/billing';
      const data = await createCheckoutSession({
        plan,
        period,
        successUrl: `${origin}${returnBasePath}?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${origin}${returnBasePath}?cancelled=1${renew ? '&renew=1' : ''}`,
      });
      if (!data.url) {
        throw new Error('Stripe checkout URL is empty');
      }
      window.location.href = data.url;
    } catch (e: any) {
      setStatus({
        type: 'error',
        text: e?.message || 'Не удалось создать платежную сессию. Попробуйте еще раз позже.',
      });
      setLoadingPlan(null);
    }
  };

  return (
    <div
      className={
        embedded
          ? 'relative rounded-[24px] border border-slate-200/80 bg-white/90 p-4 shadow-[0_22px_65px_rgba(15,23,42,0.22)] backdrop-blur-xl md:p-6'
          : 'relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_20%_0%,rgba(14,165,233,0.12),transparent_36%),radial-gradient(circle_at_80%_100%,rgba(99,102,241,0.12),transparent_34%),linear-gradient(to_bottom,#f8fafc,#f1f5f9)] px-[20px] py-1.5'
      }
    >
      <div className="pointer-events-none absolute -left-28 top-24 h-64 w-64 rounded-full bg-cyan-300/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-28 bottom-16 h-72 w-72 rounded-full bg-indigo-300/25 blur-3xl" />

      <div className="mx-auto w-full max-w-none space-y-4">
        {!embedded ? (
          <header className="rounded-2xl border border-slate-200/80 bg-white/90 px-[20px] py-3 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <a href="/" className="text-sm font-semibold text-slate-900">
                Lumiva CRM
              </a>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={lang}
                  onChange={(e) => setAppLanguage(e.target.value as 'ru' | 'en' | 'tr')}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
                >
                  <option value="ru">RU</option>
                  <option value="en">EN</option>
                  <option value="tr">TR</option>
                </select>
                <a href="/" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">
                  {text.home}
                </a>
                <a href="/pricing" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">
                  {text.pricing}
                </a>
                <a
                  href="/login"
                  className="rounded-lg !border !border-slate-900 !bg-slate-900 px-3 py-1.5 text-xs font-semibold !text-white hover:!bg-slate-800"
                  style={{ color: '#fff', backgroundColor: '#0f172a' }}
                >
                  {text.login}
                </a>
              </div>
            </div>
          </header>
        ) : null}

        <div className="rounded-3xl border border-slate-200/80 bg-white/80 px-[20px] py-4 md:py-5 shadow-[0_16px_45px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Активация тарифа</div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900 md:text-[2rem]">
            {text.title}
          </h1>
          <p className={`mt-2 text-slate-600 ${embedded ? 'text-base leading-relaxed' : 'text-sm'}`}>{text.subtitle}</p>
          <div className="mt-5 inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setPeriod('month')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                period === 'month' ? '!bg-slate-900 !text-white' : '!bg-transparent !text-slate-600'
              }`}
            >
              {text.month}
            </button>
            <button
              type="button"
              onClick={() => setPeriod('year')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                period === 'year' ? '!bg-indigo-600 !text-white' : '!bg-transparent !text-slate-600'
              }`}
            >
              {text.year}
            </button>
          </div>
        </div>

        {status ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              status.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : status.type === 'error'
                  ? 'border-rose-200 bg-rose-50 text-rose-800'
                  : 'border-sky-200 bg-sky-50 text-sky-800'
            }`}
          >
            {status.text}
          </div>
        ) : null}

        <div className={planGridClass}>
          {plans.map((plan) => {
            const localized = getLocalizedPlanContent(plan);
            return (
            <article
              key={plan.code}
              className={`group relative flex h-full flex-col overflow-hidden border bg-white/90 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 ${
                embedded
                  ? 'w-full min-w-0 snap-start rounded-2xl p-4 shadow-[0_10px_24px_rgba(15,23,42,0.09)] hover:shadow-[0_16px_30px_rgba(15,23,42,0.14)]'
                  : 'rounded-3xl p-4 shadow-[0_16px_40px_rgba(15,23,42,0.08)] hover:shadow-[0_26px_55px_rgba(15,23,42,0.18)]'
              } ${
                isPreferredPlan && preferredPlan === plan.code
                  ? 'border-cyan-400/90 ring-2 ring-cyan-200'
                  : plan.code === 'enterprise'
                  ? 'border-indigo-300/80 ring-1 ring-indigo-200'
                  : 'border-slate-200/80'
              }`}
            >
              <div
                className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl transition-opacity duration-300 ${
                  plan.code === 'enterprise'
                    ? 'bg-indigo-400/30 opacity-100'
                    : 'bg-cyan-300/20 opacity-0 group-hover:opacity-100'
                }`}
              />
              {plan.code === 'enterprise' ? (
                <div className={`absolute rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-700 ${embedded ? 'right-2 top-2' : 'right-4 top-4'}`}>
                  {text.recommended}
                </div>
              ) : null}

              <div className={`uppercase tracking-[0.16em] text-slate-400 ${embedded ? 'text-[11px]' : 'text-xs'}`}>{text.planLabel}</div>
              <div className={`mt-1 font-semibold text-slate-900 ${embedded ? 'text-xl' : 'text-xl'}`}>{plan.title}</div>
              <div className={`mt-1 font-medium text-slate-500 ${embedded ? 'text-xs leading-relaxed' : 'text-xs'}`}>{localized.subtitle}</div>
              <div className={`font-semibold leading-none text-slate-900 ${embedded ? 'mt-2 text-[2rem]' : 'mt-3 text-[2rem]'}`}>
                {period === 'year'
                  ? `EUR ${Math.round(parseMonthlyPrice(plan.price) * 12 * (1 - YEARLY_DISCOUNT[plan.code as PlanCode]))}`
                  : plan.price}
              </div>
              <div className={`${embedded ? 'text-[11px]' : 'text-xs'} text-slate-500`}>
                {period === 'year' ? text.perUserYear : text.perUserMonth}
              </div>
              {period === 'year' ? (
                <div className={`mt-1 text-indigo-700 ${embedded ? 'text-[11px]' : 'text-xs'}`}>
                  {text.yearlyNote} {Math.round(YEARLY_DISCOUNT[plan.code as PlanCode] * 100)}%
                </div>
              ) : null}
              {!embedded ? (
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{localized.description}</p>
              ) : null}
              <ul className={`mt-3 text-slate-700 ${embedded ? 'space-y-1.5 text-xs leading-relaxed' : 'space-y-2 text-sm'}`}>
                {(embedded ? localized.features.slice(0, 8) : localized.features).map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <span
                      className={`mt-1 h-1.5 w-1.5 rounded-full ${plan.code === 'enterprise' ? 'bg-indigo-600' : 'bg-slate-900'}`}
                    />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={loadingPlan === plan.code}
                onClick={() => startCheckout(plan.code)}
                className={`w-full rounded-xl border font-semibold transition-all duration-300 disabled:cursor-not-allowed ${
                  embedded ? 'px-4 py-2.5 text-sm' : 'px-4 py-3 text-sm'
                } ${
                  plan.code === 'enterprise'
                    ? 'mt-8 !border-indigo-500 !bg-indigo-600 !text-white shadow-[0_12px_25px_rgba(79,70,229,0.35)] hover:!bg-indigo-500 disabled:!border-indigo-500 disabled:!bg-indigo-500 disabled:!text-white'
                    : 'mt-8 !border-slate-900 !bg-slate-900 !text-white shadow-[0_8px_20px_rgba(15,23,42,0.28)] hover:!bg-slate-800 disabled:!border-slate-700 disabled:!bg-slate-700 disabled:!text-white'
                }`}
              >
                {loadingPlan === plan.code
                  ? text.loading
                  : renew
                    ? period === 'year'
                      ? text.renewYear
                      : text.renewMonth
                    : period === 'year'
                      ? text.chooseYear
                      : text.choose}
              </button>
            </article>
            );
          })}
        </div>

        {!embedded ? (
          <footer className="rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 text-xs text-slate-500 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>{text.footer}</span>
              <a href="mailto:support@lumiva.agency" className="font-semibold text-slate-700">
                support@lumiva.agency
              </a>
            </div>
          </footer>
        ) : null}
      </div>
    </div>
  );
};
