import React from 'react';
import { PublicPageLayout } from './PublicPageLayout';
import {
  fetchBillingCatalog,
  resendSignupCode,
  signup,
  verifySignupCode,
  type BillingCatalogPlan,
} from '../../api/client';
import { getAccessToken } from '../../auth/session';
import { persistSession } from '../../auth/session';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

type PlanCode = 'standard' | 'professional' | 'enterprise' | 'ultimate';
type BillingPeriod = 'month' | 'year';
type Lang = 'ru' | 'en' | 'tr';
const YEARLY_DISCOUNT: Record<PlanCode, number> = {
  standard: 0.1,
  professional: 0.12,
  enterprise: 0.15,
  ultimate: 0.2,
};

const DEFAULT_PLANS: BillingCatalogPlan[] = [];


export default function PricingPage() {
  const { i18n } = useTranslation();
  const [plans, setPlans] = React.useState<BillingCatalogPlan[]>(DEFAULT_PLANS);
  const [period, setPeriod] = React.useState<BillingPeriod>('month');
  const [selectedPlanCode, setSelectedPlanCode] = React.useState<PlanCode | null>(null);
  const [registerOpen, setRegisterOpen] = React.useState(false);
  const [registerLoading, setRegisterLoading] = React.useState(false);
  const [registerError, setRegisterError] = React.useState<string | null>(null);
  const [registerMessage, setRegisterMessage] = React.useState<string | null>(null);
  const [verifyContext, setVerifyContext] = React.useState<{
    clientKey: string;
    email: string;
  } | null>(null);
  const [verifyCode, setVerifyCode] = React.useState('');
  const [resendCooldown, setResendCooldown] = React.useState(0);
  const [lastChangedDigit, setLastChangedDigit] = React.useState<number | null>(null);
  const verifyInputRef = React.useRef<HTMLInputElement | null>(null);
  const [registerForm, setRegisterForm] = React.useState({
    companyName: '',
    clientKey: '',
    email: '',
    password: '',
    phoneCountry: '+7',
    phoneNumber: '',
  });
  const isLoggedIn = Boolean(getAccessToken());
  const lang = ((i18n.language || 'ru').slice(0, 2) as Lang) || 'ru';
  const verificationDigits = React.useMemo(
    () => Array.from({ length: 6 }, (_, index) => verifyCode[index] || ''),
    [verifyCode],
  );

  const text =
    lang === 'en'
      ? {
          title: 'Plans and connection terms',
          subtitle:
            'Choose your plan and billing period. Monthly and yearly options are available with an automatic discount.',
          month: 'Month',
          year: 'Year with discount',
          tariff: 'Plan',
          perMonth: 'per user / month',
          perYear: 'per user / year',
          yearDiscount: '12 months · discount',
          choose: 'Choose',
          recommended: 'Recommended',
          howItWorks: 'How activation and renewal work',
          howItWorksText:
            'After registration, the account starts in limited mode. To activate working modules, select a plan and complete payment. When access period ends, renew for a month or a year with discount.',
          registerKicker: 'Registration',
          registerTitle: 'Create account for payment',
          verifyKicker: 'Email verification',
          verifyTitle: 'Enter code from email',
          companyName: 'Company name',
          clientKey: 'Client key',
          generate: 'Generate',
          phone: 'Phone',
          email: 'Email',
          password: 'Password',
          close: 'Close',
          signupAction: 'Sign up',
          loadingWait: 'Please wait...',
          verifyAction: 'Continue',
          verifying: 'Verifying...',
          requiredError: 'Fill all required fields',
          signupError: 'Registration failed',
          verifyError: 'Enter 6-digit code',
          invalidCode: 'Invalid code',
          codeSent: 'Code sent to your email',
          codeSentTo: 'We sent a code to',
          resendCode: 'Send code again',
          resendWait: 'Resend available in',
          verifyTapHint: 'Tap to enter code',
        }
      : lang === 'tr'
        ? {
            title: 'Tarifeler ve bağlantı koşulları',
            subtitle:
              'Planınızı ve ödeme dönemini seçin. Aylık ve yıllık (indirimli) seçenekler mevcuttur.',
            month: 'Ay',
            year: 'Yıllık indirimli',
            tariff: 'Plan',
            perMonth: 'kullanıcı / ay',
            perYear: 'kullanıcı / yıl',
            yearDiscount: '12 ay · indirim',
            choose: 'Seç',
            recommended: 'Önerilen',
            howItWorks: 'Aktivasyon ve yenileme nasıl çalışır',
            howItWorksText:
              'Kayıttan sonra hesap sınırlı modda açılır. Modülleri aktifleştirmek için plan seçip ödemeyi tamamlayın. Erişim süresi bittiğinde aylık veya yıllık olarak yenileyebilirsiniz.',
            registerKicker: 'Kayıt',
            registerTitle: 'Ödeme için hesap oluşturun',
            verifyKicker: 'E-posta doğrulama',
            verifyTitle: 'E-postadaki kodu girin',
            companyName: 'Şirket adı',
            clientKey: 'Müşteri anahtarı',
            generate: 'Oluştur',
            phone: 'Telefon',
            email: 'E-posta',
            password: 'Şifre',
            close: 'Kapat',
            signupAction: 'Kayıt ol',
            loadingWait: 'Lütfen bekleyin...',
            verifyAction: 'Devam et',
            verifying: 'Doğrulanıyor...',
            requiredError: 'Zorunlu alanları doldurun',
            signupError: 'Kayıt başarısız',
            verifyError: '6 haneli kod girin',
            invalidCode: 'Geçersiz kod',
            codeSent: 'Kod e-postanıza gönderildi',
            codeSentTo: 'Kodu şu adrese gönderdik',
            resendCode: 'Kodu tekrar gönder',
            resendWait: 'Tekrar gönderim',
            verifyTapHint: 'Kodu girmek için dokunun',
          }
        : {
            title: 'Тарифы и условия подключения',
            subtitle:
              'Выберите план и период оплаты. Доступно продление на месяц или на год с автоматической скидкой.',
            month: 'Месяц',
            year: 'Год со скидкой',
            tariff: 'Тариф',
            perMonth: 'за пользователя / месяц',
            perYear: 'за пользователя / год',
            yearDiscount: '12 месяцев · скидка',
            choose: 'Выбрать',
            recommended: 'Рекомендуем',
            howItWorks: 'Как работает подключение и продление',
            howItWorksText:
              'После регистрации аккаунт создается в ограниченном режиме. Для активации рабочих модулей нужно выбрать тариф и завершить оплату. При окончании срока доступа выполняется продление: можно оплатить на месяц или на год со скидкой.',
            registerKicker: 'Регистрация',
            registerTitle: 'Создайте аккаунт для оплаты',
            verifyKicker: 'Подтверждение email',
            verifyTitle: 'Введите код из письма',
            companyName: 'Название компании',
            clientKey: 'Ключ клиента',
            generate: 'Сформировать',
            phone: 'Телефон',
            email: 'Email',
            password: 'Пароль',
            close: 'Закрыть',
            signupAction: 'Зарегистрироваться',
            loadingWait: 'Подождите...',
            verifyAction: 'Продолжить',
            verifying: 'Проверяем...',
            requiredError: 'Заполните обязательные поля',
            signupError: 'Ошибка регистрации',
            verifyError: 'Введите 6-значный код',
            invalidCode: 'Неверный код',
            codeSent: 'Код отправлен вам на почту',
            codeSentTo: 'Мы отправили код на',
            resendCode: 'Отправить код повторно',
            resendWait: 'Повторная отправка через',
            verifyTapHint: 'Нажмите, чтобы ввести код',
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
      subtitle: (locale?.subtitle && locale.subtitle.trim()) || plan.subtitle,
      description: (locale?.description && locale.description.trim()) || plan.description,
      features: (Array.isArray(locale?.features) && locale.features.length ? locale.features : plan.features),
    };
  };

  const parseMonthlyPrice = (raw: string): number => {
    const normalized = String(raw || '').replace(',', '.');
    const match = normalized.match(/(\d+(\.\d+)?)/);
    const v = match ? Number(match[1]) : NaN;
    return Number.isFinite(v) && v > 0 ? v : 0;
  };

  React.useEffect(() => {
    fetchBillingCatalog()
      .then((list) => {
        if (Array.isArray(list) && list.length) {
          setPlans(list as BillingCatalogPlan[]);
        }
      })
      .catch(() => {
        // fallback to defaults
      });
  }, []);

  React.useEffect(() => {
    if (!resendCooldown) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const makeClientKey = () => {
    const raw = registerForm.companyName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9а-яё\s-]/gi, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    const latin = raw
      .replace(/а/g, 'a')
      .replace(/б/g, 'b')
      .replace(/в/g, 'v')
      .replace(/г/g, 'g')
      .replace(/д/g, 'd')
      .replace(/е/g, 'e')
      .replace(/ё/g, 'e')
      .replace(/ж/g, 'zh')
      .replace(/з/g, 'z')
      .replace(/и/g, 'i')
      .replace(/й/g, 'y')
      .replace(/к/g, 'k')
      .replace(/л/g, 'l')
      .replace(/м/g, 'm')
      .replace(/н/g, 'n')
      .replace(/о/g, 'o')
      .replace(/п/g, 'p')
      .replace(/р/g, 'r')
      .replace(/с/g, 's')
      .replace(/т/g, 't')
      .replace(/у/g, 'u')
      .replace(/ф/g, 'f')
      .replace(/х/g, 'h')
      .replace(/ц/g, 'c')
      .replace(/ч/g, 'ch')
      .replace(/ш/g, 'sh')
      .replace(/щ/g, 'sch')
      .replace(/ы/g, 'y')
      .replace(/э/g, 'e')
      .replace(/ю/g, 'yu')
      .replace(/я/g, 'ya');
    setRegisterForm((s) => ({ ...s, clientKey: latin.slice(0, 64) }));
  };

  const openBilling = (plan: PlanCode) => {
    window.location.href = `/app?plan=${plan}${period === 'year' ? '&period=year' : ''}`;
  };

  const handleChoose = (plan: PlanCode) => {
    if (isLoggedIn) {
      openBilling(plan);
      return;
    }
    setSelectedPlanCode(plan);
    setRegisterOpen(true);
    setRegisterError(null);
    setRegisterMessage(null);
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError(null);
    setRegisterMessage(null);
    if (!registerForm.companyName || !registerForm.clientKey || !registerForm.email || !registerForm.password) {
      setRegisterError(text.requiredError);
      return;
    }
    setRegisterLoading(true);
    try {
      const phone = `${registerForm.phoneCountry} ${registerForm.phoneNumber}`.trim();
      const resp = await signup({
        companyName: registerForm.companyName,
        clientKey: registerForm.clientKey,
        email: registerForm.email,
        password: registerForm.password,
        phone,
      });
      setVerifyContext({
        clientKey: resp.clientKey,
        email: resp.email,
      });
      setRegisterMessage(resp.message || text.codeSent);
      setVerifyCode('');
      setResendCooldown(45);
    } catch (err: any) {
      setRegisterError(err?.message || text.signupError);
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyContext || !selectedPlanCode) return;
    setRegisterError(null);
    setRegisterMessage(null);
    if (!/^\d{6}$/.test(verifyCode.trim())) {
      setRegisterError(text.verifyError);
      return;
    }
    setRegisterLoading(true);
    try {
      const resp = await verifySignupCode({
        clientKey: verifyContext.clientKey,
        email: verifyContext.email,
        code: verifyCode.trim(),
      });
      persistSession(resp);
      openBilling(selectedPlanCode);
    } catch (err: any) {
      setRegisterError(err?.message || text.invalidCode);
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!verifyContext || resendCooldown > 0) return;
    setRegisterError(null);
    setRegisterMessage(null);
    setRegisterLoading(true);
    try {
      const resp = await resendSignupCode({
        clientKey: verifyContext.clientKey,
        email: verifyContext.email,
      });
      setVerifyCode('');
      setResendCooldown(45);
      setRegisterMessage(resp.message || text.codeSent);
      verifyInputRef.current?.focus();
    } catch (err: any) {
      setRegisterError(err?.message || text.invalidCode);
    } finally {
      setRegisterLoading(false);
    }
  };

  return (
    <PublicPageLayout
      pageKey="pricing"
      title={text.title}
      subtitle={text.subtitle}
    >
      <div className="px-[20px]">
      <div className="mb-4 inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => {
            const localized = getLocalizedPlanContent(plan);
            return (
          <article
            key={plan.code}
              className={`relative flex h-full flex-col rounded-2xl border bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.06)] ${
                plan.code === 'enterprise'
                  ? 'border-indigo-300 ring-1 ring-indigo-200'
                  : plan.highlighted
                    ? 'border-indigo-300 ring-1 ring-indigo-200'
                    : 'border-slate-200'
            }`}
          >
              {plan.code === 'enterprise' ? (
                <div className="absolute right-3 top-3 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-indigo-700">
                  {text.recommended}
                </div>
              ) : null}
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{text.tariff}</div>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">{plan.title}</h3>
              <p className="mt-1 text-xs text-slate-600">{localized.subtitle}</p>
            <div className="mt-4 text-3xl font-semibold text-slate-900">
              {period === 'year'
                ? `EUR ${Math.round(parseMonthlyPrice(plan.price) * 12 * (1 - YEARLY_DISCOUNT[plan.code as PlanCode]))}`
                : plan.price}
            </div>
            <div className="text-xs text-slate-500">
                {period === 'year' ? text.perYear : text.perMonth}
            </div>
            {period === 'year' ? (
              <div className="mt-1 text-xs text-indigo-700">
                  {text.yearDiscount} {Math.round(YEARLY_DISCOUNT[plan.code as PlanCode] * 100)}%
              </div>
            ) : null}
              <button
                type="button"
                onClick={() => handleChoose(plan.code as PlanCode)}
                className={`mt-3 w-full rounded-xl px-4 py-2 text-xs font-semibold !text-white ${
                  plan.code === 'enterprise'
                    ? '!border !border-indigo-600 !bg-indigo-600 hover:!bg-indigo-500'
                    : '!border !border-slate-900 !bg-slate-900 hover:!bg-slate-800'
                }`}
                style={{
                  color: '#fff',
                  backgroundColor: plan.code === 'enterprise' ? '#4f46e5' : '#0f172a',
                }}
              >
                {text.choose}
              </button>
              <p className="mt-2 text-xs text-slate-600">{localized.description}</p>
            <ul className="mt-4 space-y-2 text-xs text-slate-600">
                {localized.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-900" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </article>
            );
          })}
      </section>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
          <h4 className="text-sm font-semibold text-slate-900">{text.howItWorks}</h4>
          <p className="mt-2">{text.howItWorksText}</p>
      </section>
      </div>
      {registerOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/35 backdrop-blur-sm px-4"
          onClick={() => setRegisterOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-[0_24px_60px_rgba(15,23,42,0.25)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{verifyContext ? text.verifyKicker : text.registerKicker}</div>
            <h3 className="mt-1 text-3xl font-semibold text-slate-900">
              {verifyContext ? text.verifyTitle : text.registerTitle}
            </h3>
            {!verifyContext ? (
              <form onSubmit={handleSignupSubmit} className="mt-4 grid gap-2.5" autoComplete="on">
                <input
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                  placeholder={text.companyName}
                  autoComplete="organization"
                  value={registerForm.companyName}
                  onChange={(e) => setRegisterForm((s) => ({ ...s, companyName: e.target.value }))}
                />
                <div className="flex gap-2">
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                    placeholder={text.clientKey}
                    autoComplete="off"
                    value={registerForm.clientKey}
                    onChange={(e) => setRegisterForm((s) => ({ ...s, clientKey: e.target.value }))}
                  />
                  <button
                    type="button"
                    onClick={makeClientKey}
                    className="shrink-0 rounded-xl border border-slate-300 px-3 text-xs font-semibold"
                  >
                    {text.generate}
                  </button>
                </div>
                <div className="flex gap-2">
                  <select
                    value={registerForm.phoneCountry}
                    onChange={(e) => setRegisterForm((s) => ({ ...s, phoneCountry: e.target.value }))}
                    className="w-28 rounded-xl border border-slate-200 bg-white px-2 py-2.5 text-sm"
                    aria-label="Country code"
                  >
                    <option value="+7">🇷🇺 +7</option>
                    <option value="+90">🇹🇷 +90</option>
                    <option value="+1">🇺🇸 +1</option>
                    <option value="+44">🇬🇧 +44</option>
                    <option value="+49">🇩🇪 +49</option>
                  </select>
                  <input
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                    placeholder={text.phone}
                    autoComplete="tel-national"
                    inputMode="tel"
                    value={registerForm.phoneNumber}
                    onChange={(e) => setRegisterForm((s) => ({ ...s, phoneNumber: e.target.value }))}
                  />
                </div>
                <input
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                  placeholder={text.email}
                  type="email"
                  autoComplete="email"
                  value={registerForm.email}
                  onChange={(e) => setRegisterForm((s) => ({ ...s, email: e.target.value }))}
                />
                <input
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                  placeholder={text.password}
                  type="password"
                  autoComplete="new-password"
                  value={registerForm.password}
                  onChange={(e) => setRegisterForm((s) => ({ ...s, password: e.target.value }))}
                />
                <div className="mt-1 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setRegisterOpen(false)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                  >
                    {text.close}
                  </button>
                  <button
                    type="submit"
                    disabled={registerLoading}
                    className="rounded-lg !border !border-slate-900 !bg-slate-900 px-3 py-2 text-xs font-semibold !text-white hover:!bg-slate-800 disabled:opacity-70"
                    style={{ color: '#fff', backgroundColor: '#0f172a' }}
                  >
                    {registerLoading ? text.loadingWait : text.signupAction}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifySubmit} className="mt-4 grid gap-3" autoComplete="off" data-lpignore="true">
                <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-cyan-50 p-4 sm:p-5 shadow-[0_16px_45px_rgba(15,23,42,0.14)]">
                  <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-cyan-300/35 blur-2xl" />
                  <div className="pointer-events-none absolute -left-10 -bottom-10 h-28 w-28 rounded-full bg-indigo-300/30 blur-2xl" />
                  <div className="relative">
                    <div className="inline-flex items-center rounded-full border border-slate-300/80 bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Lumiva Secure
                    </div>
                    <div className="mt-2 text-[17px] sm:text-[19px] font-semibold text-slate-900">
                      {text.verifyTitle}
                    </div>
                    <div className="mt-1 text-xs sm:text-sm text-slate-600 leading-relaxed">
                      {text.codeSentTo} <span className="font-semibold">{verifyContext.email}</span>
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <input
                    ref={verifyInputRef}
                    type="text"
                    name="one-time-code"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    spellCheck={false}
                    data-lpignore="true"
                    className="absolute inset-0 h-full w-full opacity-0"
                    value={verifyCode}
                    maxLength={6}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
                      const prevLength = verifyCode.length;
                      const nextLength = digits.length;
                      if (nextLength > prevLength) {
                        setLastChangedDigit(nextLength - 1);
                      } else if (nextLength < prevLength) {
                        setLastChangedDigit(Math.max(nextLength, 0));
                      }
                      setVerifyCode(digits);
                    }}
                    onFocus={() => {
                      if (lastChangedDigit === null && verifyCode.length === 0) {
                        setLastChangedDigit(0);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => verifyInputRef.current?.focus()}
                    className="w-full"
                  >
                    <div className="grid grid-cols-6 gap-2 sm:gap-3">
                      {verificationDigits.map((digit, index) => {
                        const active = index === Math.min(verifyCode.length, 5);
                        const filled = Boolean(digit);
                        return (
                          <motion.div
                            key={`${index}-${digit || 'empty'}`}
                            initial={false}
                            animate={
                              lastChangedDigit === index
                                ? { y: [0, -3, 2, -1, 0], rotate: [0, -1.2, 1.2, 0], scale: [1, 1.05, 1] }
                                : { y: 0, rotate: 0, scale: 1 }
                            }
                            transition={{ duration: 0.32, ease: 'easeOut' }}
                            className={`h-12 sm:h-14 rounded-2xl border text-lg sm:text-xl font-semibold flex items-center justify-center transition-all ${
                              filled
                                ? 'border-cyan-400 bg-slate-900 text-cyan-300 shadow-[0_8px_22px_rgba(8,145,178,0.25)]'
                                : active
                                  ? 'border-slate-700 bg-slate-800 text-white shadow-[0_10px_24px_rgba(15,23,42,0.35)]'
                                  : 'border-slate-200 bg-white text-slate-300'
                            }`}
                          >
                            {digit || '•'}
                          </motion.div>
                        );
                      })}
                    </div>
                    <div className="mt-2 text-center text-[11px] text-slate-500">
                      {text.verifyTapHint}
                    </div>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="submit"
                    disabled={registerLoading || verifyCode.length !== 6}
                    className="rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {registerLoading ? text.verifying : text.verifyAction}
                  </button>
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={registerLoading || resendCooldown > 0}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400 disabled:opacity-60"
                  >
                    {resendCooldown > 0 ? `${text.resendWait} ${resendCooldown}s` : text.resendCode}
                  </button>
                </div>
                <div className="mt-1">
                  <button
                    type="button"
                    onClick={() => setRegisterOpen(false)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                  >
                    {text.close}
                  </button>
                </div>
              </form>
            )}
            {registerError && (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {registerError}
              </div>
            )}
            {registerMessage && (
              <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                {registerMessage || text.codeSent}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </PublicPageLayout>
  );
}
