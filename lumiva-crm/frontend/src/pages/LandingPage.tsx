// src/pages/LandingPage.tsx — главная crm.lumiva.agency (дизайн: Claude Design home-v2)
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { login, resendSignupCode, signup, verifySignupCode, verifyTwoFactorLogin } from "../api/client";
import { persistSession, getAccessToken, clearSession, getStoredTenantName } from "../auth/session";
import { fetchLeadStats } from "../api/leads";
import { fetchProjects } from "../api/projects";
import { PublicHeader } from "../components/public/PublicHeader";
import { PublicFooter } from "../components/public/PublicFooter";
import {
  AuraShowcase, Automation, Crew, Depts, FinalCta, Hero, Icon, Integrations, Modules, Platform, Pricing, Start, useScrollReveal,
} from "./landing/LandingSections";

const FF = "'Inter Tight','Helvetica Neue',Helvetica,Arial,sans-serif";
const FM = "'JetBrains Mono',ui-monospace,monospace";

/* ═══════════════════════════════════════════════════════════════════
   AUTH PANEL  (logic untouched — only outer wrapper restyled)
═══════════════════════════════════════════════════════════════════ */
const LandingAuthPanel: React.FC<{ compact?: boolean; initialMode?: "login" | "signup" }> = ({ compact = false, initialMode }) => {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const lang = (i18n.language || "ru").slice(0, 2);
  const text =
    lang === "en"
      ? {
          title: "Access account",
          subtitle: "Sign in to your account or create a new one — 14 days of Enterprise for free, no card required.",
          loginTab: "Login", signupTab: "Sign up",
          loginClientKey: "Client key", email: "Email", password: "Password",
          companyName: "Company name", phone: "Phone", makeKey: "Generate key",
          submitLogin: "Enter account", submitSignup: "Create account",
          loading: "Please wait...", needFields: "Fill required fields",
          signupOk: "Account created. Check your email for the code.", loginOk: "Login successful",
          verifyTitle: "Email confirmation", verifyHint: "Enter the 6-digit code sent to your email.",
          verifyCode: "Verification code", verifySubmit: "Confirm code",
          verifySent: "Code sent to your email", verifyOk: "Email confirmed. Opening your CRM...",
          resendCode: "Send code again", resendWait: "You can request again in", verifyTapHint: "Tap to type code",
          welcomeBackTitle: "Welcome back", welcomeBackSubtitle: "You're already signed in. Jump back into your workspace, or switch to a different account.",
          returnToPanel: "Back to dashboard", switchAccount: "Sign in with a different account",
          previewLeadsTitle: "Leads", previewLeadsPeriod: "30d", previewLeadsTotal: "leads",
          previewLeadsInProgress: "in progress", previewLeadsConversion: "conversion",
          previewProjectsTitle: "Projects", previewProjectsTotal: "total",
          previewProjectsInProgress: "in progress", previewProjectsWon: "won",
          twoFactorTitle: "Two-factor code", twoFactorHint: "Enter the code from your authenticator app or a backup code.",
          twoFactorCode: "Verification code", twoFactorSubmit: "Verify and sign in", twoFactorBack: "Back to password",
        }
      : lang === "tr"
        ? {
            title: "Hesap erişimi",
            subtitle: "Hesabınıza giriş yapın veya yeni hesap oluşturun — 14 gün Enterprise ücretsiz, kart gerekmez.",
            loginTab: "Giriş", signupTab: "Kayıt",
            loginClientKey: "Müşteri anahtarı", email: "E-posta", password: "Şifre",
            companyName: "Şirket adı", phone: "Telefon", makeKey: "Anahtar üret",
            submitLogin: "Panele gir", submitSignup: "Hesap oluştur",
            loading: "Yükleniyor...", needFields: "Zorunlu alanları doldurun",
            signupOk: "Hesap oluşturuldu. Kod için e-postanızı kontrol edin.", loginOk: "Giriş başarılı",
            verifyTitle: "E-posta doğrulama", verifyHint: "E-postanıza gönderilen 6 haneli kodu girin.",
            verifyCode: "Doğrulama kodu", verifySubmit: "Kodu onayla",
            verifySent: "Kod e-postanıza gönderildi", verifyOk: "E-posta doğrulandı. CRM açılıyor...",
            resendCode: "Kodu tekrar gönder", resendWait: "Tekrar isteme süresi", verifyTapHint: "Kodu yazmak için dokunun",
            welcomeBackTitle: "Tekrar hoş geldiniz", welcomeBackSubtitle: "Zaten giriş yaptınız. Panele dönün veya başka bir hesapla giriş yapın.",
            returnToPanel: "Panele dön", switchAccount: "Başka bir hesapla giriş yap",
            previewLeadsTitle: "Potansiyel müşteriler", previewLeadsPeriod: "30g", previewLeadsTotal: "toplam",
            previewLeadsInProgress: "işlemde", previewLeadsConversion: "dönüşüm",
            previewProjectsTitle: "Projeler", previewProjectsTotal: "toplam",
            previewProjectsInProgress: "işlemde", previewProjectsWon: "kazanılan",
            twoFactorTitle: "İki faktörlü kod", twoFactorHint: "Kimlik doğrulayıcı uygulamanızdaki kodu veya bir yedek kodu girin.",
            twoFactorCode: "Doğrulama kodu", twoFactorSubmit: "Doğrula ve giriş yap", twoFactorBack: "Şifreye dön",
          }
        : {
            title: "Вход в аккаунт",
            subtitle: "Войдите в аккаунт или зарегистрируйте новый — 14 дней тарифа Enterprise бесплатно, без карты.",
            loginTab: "Вход", signupTab: "Регистрация",
            loginClientKey: "Ключ клиента", email: "Email", password: "Пароль",
            companyName: "Название компании", phone: "Телефон", makeKey: "Сформировать ключ",
            submitLogin: "Войти в аккаунт", submitSignup: "Создать аккаунт",
            loading: "Подождите...", needFields: "Заполните обязательные поля",
            signupOk: "Аккаунт создан. Проверьте почту — мы отправили код.", loginOk: "Вход выполнен",
            verifyTitle: "Подтверждение email", verifyHint: "Введите код из 6 цифр, отправленный на вашу почту.",
            verifyCode: "Код подтверждения", verifySubmit: "Подтвердить код",
            verifySent: "Код отправлен вам на почту", verifyOk: "Email подтверждён. Открываем CRM...",
            resendCode: "Отправить код повторно", resendWait: "Повторная отправка через", verifyTapHint: "Нажмите, чтобы ввести код",
            welcomeBackTitle: "С возвращением", welcomeBackSubtitle: "Вы уже вошли в аккаунт. Вернитесь в рабочее пространство или войдите под другим аккаунтом.",
            returnToPanel: "Вернуться в панель", switchAccount: "Войти под другим аккаунтом",
            previewLeadsTitle: "Лиды", previewLeadsPeriod: "30д", previewLeadsTotal: "всего",
            previewLeadsInProgress: "в работе", previewLeadsConversion: "конверсия",
            previewProjectsTitle: "Проекты", previewProjectsTotal: "всего",
            previewProjectsInProgress: "в работе", previewProjectsWon: "выиграно",
            twoFactorTitle: "Код двухфакторной защиты", twoFactorHint: "Введите код из приложения-аутентификатора или резервный код.",
            twoFactorCode: "Код подтверждения", twoFactorSubmit: "Подтвердить и войти", twoFactorBack: "Назад к паролю",
          };

  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup">(
    initialMode ?? (searchParams.get("mode") === "signup" ? "signup" : "login"),
  );
  const [loggedIn, setLoggedIn] = useState(() => !!getAccessToken());
  const tenantName = loggedIn ? getStoredTenantName() : null;
  const handleSwitchAccount = () => { clearSession(); setLoggedIn(false); setMode("login"); };
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [loginForm, setLoginForm] = useState({ clientKey: "", email: "", password: "" });
  const [twoFactorChallenge, setTwoFactorChallenge] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [signupForm, setSignupForm] = useState({
    companyName: "", clientKey: "", email: "", password: "", phoneCountry: "+7", phoneNumber: "",
  });
  const [signupVerification, setSignupVerification] = useState<{ clientKey: string; email: string } | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [lastChangedDigit, setLastChangedDigit] = useState<number | null>(null);
  const verifyInputRef = useRef<HTMLInputElement | null>(null);

  const verificationDigits = useMemo(
    () => Array.from({ length: 6 }, (_, i) => verificationCode[i] || ""),
    [verificationCode],
  );

  const makeClientKey = () => {
    const raw = signupForm.companyName.trim().toLowerCase()
      .replace(/[^a-z0-9а-яё\s-]/gi, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    const latin = raw
      .replace(/а/g,"a").replace(/б/g,"b").replace(/в/g,"v").replace(/г/g,"g").replace(/д/g,"d")
      .replace(/е/g,"e").replace(/ё/g,"e").replace(/ж/g,"zh").replace(/з/g,"z").replace(/и/g,"i")
      .replace(/й/g,"y").replace(/к/g,"k").replace(/л/g,"l").replace(/м/g,"m").replace(/н/g,"n")
      .replace(/о/g,"o").replace(/п/g,"p").replace(/р/g,"r").replace(/с/g,"s").replace(/т/g,"t")
      .replace(/у/g,"u").replace(/ф/g,"f").replace(/х/g,"h").replace(/ц/g,"c").replace(/ч/g,"ch")
      .replace(/ш/g,"sh").replace(/щ/g,"sch").replace(/ы/g,"y").replace(/э/g,"e").replace(/ю/g,"yu").replace(/я/g,"ya");
    setSignupForm(s => ({ ...s, clientKey: latin.slice(0, 64) }));
  };

  useEffect(() => {
    if (!resendCooldown) return;
    const timer = window.setInterval(() => setResendCooldown(p => p <= 1 ? 0 : p - 1), 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setMessage(null);
    if (!loginForm.clientKey || !loginForm.email || !loginForm.password) { setError(text.needFields); return; }
    setLoading(true);
    try {
      const resp = await login(loginForm);
      if ((resp as any).twoFactorRequired) {
        setTwoFactorChallenge((resp as any).challengeToken);
        return;
      }
      const loginResp = resp as import('../api/client').LoginResponse;
      persistSession(loginResp); setMessage(text.loginOk);
      navigate(loginResp.billingLocked ? "/billing" : "/dashboard", { replace: true });
    } catch (err: any) { setError(err?.message || "Error"); } finally { setLoading(false); }
  };

  const handleVerifyTwoFactor = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setMessage(null);
    if (!twoFactorChallenge || !twoFactorCode) return;
    setLoading(true);
    try {
      const resp = await verifyTwoFactorLogin({ challengeToken: twoFactorChallenge, code: twoFactorCode });
      persistSession(resp); setMessage(text.loginOk);
      navigate(resp.billingLocked ? "/billing" : "/dashboard", { replace: true });
    } catch (err: any) { setError(err?.message || "Error"); } finally { setLoading(false); }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setMessage(null);
    if (!signupForm.companyName || !signupForm.clientKey || !signupForm.email || !signupForm.password) { setError(text.needFields); return; }
    setLoading(true);
    try {
      const phone = `${signupForm.phoneCountry} ${signupForm.phoneNumber}`.trim();
      const resp = await signup({ companyName: signupForm.companyName, clientKey: signupForm.clientKey, email: signupForm.email, password: signupForm.password, phone });
      setSignupVerification({ clientKey: resp.clientKey, email: resp.email });
      setVerificationCode(""); setResendCooldown(45); setMessage(resp.message || text.verifySent);
    } catch (err: any) { setError(err?.message || "Error"); } finally { setLoading(false); }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setMessage(null);
    if (!signupVerification) { setError("Verification context is missing"); return; }
    if (!/^\d{6}$/.test(verificationCode.trim())) { setError(text.verifyHint); return; }
    setLoading(true);
    try {
      const resp = await verifySignupCode({ clientKey: signupVerification.clientKey, email: signupVerification.email, code: verificationCode.trim() });
      persistSession(resp); setMessage(text.verifyOk);
      // Раньше сюда всегда попадал только что заблокированный free_locked тенант, поэтому
      // редирект на /app/billing был безусловным. Теперь signup даёт 14-дневный Enterprise-триал
      // (billingLocked=false), так что нужно вести в CRM, а не сразу на экран оплаты.
      navigate(resp.billingLocked ? "/billing" : "/dashboard", { replace: true });
    } catch (err: any) { setError(err?.message || "Error"); } finally { setLoading(false); }
  };

  const handleResendCode = async () => {
    if (!signupVerification || resendCooldown > 0) return;
    setError(null); setMessage(null); setLoading(true);
    try {
      const resp = await resendSignupCode({ clientKey: signupVerification.clientKey, email: signupVerification.email });
      setVerificationCode(""); setResendCooldown(45); setMessage(resp.message || text.verifySent);
      verifyInputRef.current?.focus();
    } catch (err: any) { setError(err?.message || "Error"); } finally { setLoading(false); }
  };

  /* Shared input style */
  const inp = "rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-400 w-full";

  return (
    <section className={compact
      ? "overflow-y-auto overflow-x-hidden rounded-[24px] bg-white p-5"
      : "rounded-3xl border border-neutral-200 bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.06)] md:p-8"}>
      <div className={compact ? "max-w-none" : "max-w-3xl"}>
        <h2 style={{ fontFamily: FF }} className={compact ? "text-xl font-semibold text-black" : "text-2xl font-semibold text-black"}>
          {loggedIn ? text.welcomeBackTitle : text.title}
        </h2>
        <p className={compact ? "mt-1.5 text-xs text-neutral-500" : "mt-2 text-sm text-neutral-500"}>
          {loggedIn ? text.welcomeBackSubtitle : text.subtitle}
        </p>
        {loggedIn && tenantName && (
          <p className="mt-1 text-xs font-medium text-neutral-700">{tenantName}</p>
        )}
      </div>

      {loggedIn && (
        <div className={compact ? "mt-4 grid gap-3" : "mt-5 grid gap-3"}>
          <button type="button" onClick={() => navigate("/dashboard")}
            style={{ fontFamily: FF }}
            className="w-full rounded-xl bg-black py-2.5 text-sm font-medium text-white hover:bg-neutral-800 transition-colors">
            {text.returnToPanel}
          </button>
          <button type="button" onClick={handleSwitchAccount}
            className="text-xs font-medium text-neutral-500 hover:text-black transition-colors">
            {text.switchAccount}
          </button>
          <AccountPreviewWidgets compact={compact} text={text} />
        </div>
      )}

      {/* Tab switcher */}
      {!loggedIn && (
      <>
      <div className={compact ? "mt-4" : "mt-5"}>
        <div className="inline-flex rounded-full border border-neutral-200 bg-neutral-50 p-1">
          {(["login", "signup"] as const).map(tab => (
            <button key={tab} type="button"
              onClick={() => { setMode(tab); setSignupVerification(null); setVerificationCode(""); setResendCooldown(0); setError(null); setMessage(null); }}
              style={{ fontFamily: FF }}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${mode === tab ? "bg-black text-white" : "text-neutral-500 hover:text-black"}`}>
              {tab === "login" ? text.loginTab : text.signupTab}
            </button>
          ))}
        </div>
      </div>

      {/* Login form */}
      {mode === "login" && !twoFactorChallenge && (
        <form onSubmit={handleLogin} className={compact ? "mt-4 grid gap-2.5" : "mt-5 grid gap-3"}>
          <input className={inp} placeholder={text.loginClientKey} value={loginForm.clientKey}
            onChange={e => setLoginForm(s => ({ ...s, clientKey: e.target.value }))} />
          <input className={inp} placeholder={text.email} type="email" value={loginForm.email}
            onChange={e => setLoginForm(s => ({ ...s, email: e.target.value }))} />
          <input className={inp} placeholder={text.password} type="password" value={loginForm.password}
            onChange={e => setLoginForm(s => ({ ...s, password: e.target.value }))} />
          <button type="submit" disabled={loading}
            style={{ fontFamily: FF }}
            className="w-full rounded-xl bg-black py-2.5 text-sm font-medium text-white disabled:opacity-60 hover:bg-neutral-800 transition-colors">
            {loading ? text.loading : text.submitLogin}
          </button>
        </form>
      )}

      {/* Two-factor challenge */}
      {mode === "login" && twoFactorChallenge && (
        <form onSubmit={handleVerifyTwoFactor} className={compact ? "mt-4 grid gap-2.5" : "mt-5 grid gap-3"}>
          <p className="text-xs text-neutral-500">{text.twoFactorHint}</p>
          <input className={inp} placeholder={text.twoFactorCode} autoFocus value={twoFactorCode}
            onChange={e => setTwoFactorCode(e.target.value)} />
          <button type="submit" disabled={loading || !twoFactorCode}
            style={{ fontFamily: FF }}
            className="w-full rounded-xl bg-black py-2.5 text-sm font-medium text-white disabled:opacity-60 hover:bg-neutral-800 transition-colors">
            {loading ? text.loading : text.twoFactorSubmit}
          </button>
          <button type="button" onClick={() => { setTwoFactorChallenge(null); setTwoFactorCode(""); setError(null); }}
            className="text-xs font-medium text-neutral-500 hover:text-black transition-colors">
            {text.twoFactorBack}
          </button>
        </form>
      )}

      {/* Signup form */}
      {mode === "signup" && !signupVerification && (
        <form onSubmit={handleSignup} className={compact ? "mt-4 grid gap-2.5" : "mt-5 grid gap-3"} autoComplete="on">
          <input className={inp} placeholder={text.companyName} autoComplete="organization" value={signupForm.companyName}
            onChange={e => setSignupForm(s => ({ ...s, companyName: e.target.value }))} />
          <div className="flex gap-2">
            <input className={`${inp} flex-1 min-w-0`} placeholder={text.loginClientKey} autoComplete="off" value={signupForm.clientKey}
              onChange={e => setSignupForm(s => ({ ...s, clientKey: e.target.value }))} />
            <button type="button" onClick={makeClientKey}
              className="shrink-0 rounded-xl border border-neutral-200 px-3 text-xs font-medium text-neutral-600 hover:border-neutral-400 whitespace-nowrap">
              {text.makeKey}
            </button>
          </div>
          <div className="flex gap-2">
            <select value={signupForm.phoneCountry} onChange={e => setSignupForm(s => ({ ...s, phoneCountry: e.target.value }))}
              className="w-24 rounded-xl border border-neutral-200 bg-white px-2 py-2.5 text-sm" aria-label="Country code">
              <option value="+7">🇷🇺 +7</option>
              <option value="+90">🇹🇷 +90</option>
              <option value="+1">🇺🇸 +1</option>
              <option value="+44">🇬🇧 +44</option>
              <option value="+49">🇩🇪 +49</option>
            </select>
            <input className={`${inp} flex-1 min-w-0`} placeholder={text.phone} autoComplete="tel-national" inputMode="tel"
              value={signupForm.phoneNumber} onChange={e => setSignupForm(s => ({ ...s, phoneNumber: e.target.value }))} />
          </div>
          <input className={inp} placeholder={text.email} type="email" autoComplete="email" value={signupForm.email}
            onChange={e => setSignupForm(s => ({ ...s, email: e.target.value }))} />
          <input className={inp} placeholder={text.password} type="password" autoComplete="new-password" value={signupForm.password}
            onChange={e => setSignupForm(s => ({ ...s, password: e.target.value }))} />
          <button type="submit" disabled={loading}
            style={{ fontFamily: FF }}
            className="w-full rounded-xl bg-black py-2.5 text-sm font-medium text-white disabled:opacity-60 hover:bg-neutral-800 transition-colors">
            {loading ? text.loading : text.submitSignup}
          </button>
        </form>
      )}

      {/* Email verification */}
      {mode === "signup" && signupVerification && (
        <form onSubmit={handleVerifyCode} className={compact ? "mt-4 grid gap-3" : "mt-5 grid gap-4"} autoComplete="off" data-lpignore="true">
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-cyan-50 p-4 sm:p-5 shadow-[0_16px_45px_rgba(15,23,42,0.14)]">
            <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-cyan-300/35 blur-2xl" />
            <div className="pointer-events-none absolute -left-10 -bottom-10 h-28 w-28 rounded-full bg-indigo-300/30 blur-2xl" />
            <div className="relative">
              <div className="inline-flex items-center rounded-full border border-slate-300/80 bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Lumiva Secure
              </div>
              <div className="mt-2 text-[17px] sm:text-[19px] font-semibold text-slate-900">{text.verifyTitle}</div>
              <div className="mt-1 text-xs sm:text-sm text-slate-600 leading-relaxed">{text.verifyHint}</div>
              <div className="mt-2 text-xs text-slate-500">{signupVerification.email}</div>
            </div>
          </div>

          <div className="relative">
            <input ref={verifyInputRef} type="text" inputMode="numeric" autoComplete="one-time-code"
              name="one-time-code" spellCheck={false} data-lpignore="true"
              className="absolute inset-0 h-full w-full opacity-0"
              value={verificationCode} maxLength={6}
              onChange={e => {
                const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
                const prevLength = verificationCode.length;
                const nextLength = digits.length;
                if (nextLength > prevLength) setLastChangedDigit(nextLength - 1);
                else if (nextLength < prevLength) setLastChangedDigit(Math.max(nextLength, 0));
                setVerificationCode(digits);
              }}
              onFocus={() => { if (lastChangedDigit === null && verificationCode.length === 0) setLastChangedDigit(0); }}
            />
            <button type="button" onClick={() => verifyInputRef.current?.focus()} className="w-full">
              <div className="grid grid-cols-6 gap-2 sm:gap-3">
                {verificationDigits.map((digit, index) => {
                  const active = index === Math.min(verificationCode.length, 5);
                  const filled = Boolean(digit);
                  return (
                    <motion.div key={`${index}-${digit || "empty"}`}
                      initial={false}
                      animate={lastChangedDigit === index ? { y: [0, -3, 2, -1, 0], rotate: [0, -1.2, 1.2, 0], scale: [1, 1.05, 1] } : { y: 0, rotate: 0, scale: 1 }}
                      transition={{ duration: 0.32, ease: "easeOut" }}
                      className={`h-12 sm:h-14 rounded-2xl border text-lg sm:text-xl font-semibold flex items-center justify-center transition-all ${
                        filled ? "border-cyan-400 bg-slate-900 text-cyan-300 shadow-[0_8px_22px_rgba(8,145,178,0.25)]"
                          : active ? "border-slate-700 bg-slate-800 text-white shadow-[0_10px_24px_rgba(15,23,42,0.35)]"
                          : "border-slate-200 bg-white text-slate-300"
                      }`}>
                      {digit || "•"}
                    </motion.div>
                  );
                })}
              </div>
              <div className="mt-2 text-center text-[11px] text-slate-500">{text.verifyTapHint}</div>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button type="submit" disabled={loading || verificationCode.length !== 6}
              className="rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">
              {loading ? text.loading : text.verifySubmit}
            </button>
            <button type="button" onClick={handleResendCode} disabled={loading || resendCooldown > 0}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-slate-400 disabled:opacity-60">
              {resendCooldown > 0 ? `${text.resendWait} ${resendCooldown}s` : text.resendCode}
            </button>
          </div>
        </form>
      )}

      {error   && <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}
      {message && <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{message}</div>}
      </>
      )}
    </section>
  );
};

/* ─── ACCOUNT PREVIEW WIDGETS (уже вошёл, реальные данные тенанта) ──
   Показываются вместо формы входа тому, у кого уже есть валидная сессия.
   При ошибке/нехватке прав конкретный блок просто не рендерится —
   "Вернуться в панель" выше остаётся рабочим в любом случае. */
type PreviewLeadsData = { total: number; inProgress: number; conversion: number };
type PreviewProjectsData = { total: number; inProgress: number; won: number };

const PreviewStatCard: React.FC<{
  icon: string; title: string; period?: string;
  stats: { label: string; value: string }[];
}> = ({ icon, title, period, stats }) => (
  <div className="rounded-2xl border border-neutral-200 bg-neutral-50/60 p-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-black">
        <Icon name={icon} size={15} />
        <span style={{ fontFamily: FF }} className="text-sm font-medium">{title}</span>
      </div>
      {period && (
        <span style={{ fontFamily: FM }} className="text-[10px] uppercase tracking-[0.08em] text-neutral-400">{period}</span>
      )}
    </div>
    <div className="mt-3 grid grid-cols-3 gap-2">
      {stats.map((s) => (
        <div key={s.label}>
          <div style={{ fontFamily: FF }} className="text-lg font-semibold leading-none text-black">{s.value}</div>
          <div className="mt-1 text-[10px] leading-tight text-neutral-500">{s.label}</div>
        </div>
      ))}
    </div>
  </div>
);

const AccountPreviewWidgets: React.FC<{ compact?: boolean; text: any }> = ({ text }) => {
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<PreviewLeadsData | null>(null);
  const [projects, setProjects] = useState<PreviewProjectsData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const to = new Date();
      const from = new Date(to);
      from.setDate(from.getDate() - 29);
      const fmt = (d: Date) => d.toISOString().slice(0, 10);

      const [leadStats, projectsRes] = await Promise.all([
        fetchLeadStats({ from: fmt(from), to: fmt(to) }).catch(() => null),
        fetchProjects().catch(() => null),
      ]);
      if (cancelled) return;

      if (leadStats) {
        const byStatus = new Map(leadStats.byStatus.map((s) => [s.status, s.count]));
        const won = byStatus.get("won") || 0;
        const lost = byStatus.get("lost") || 0;
        const total = leadStats.total;
        setLeads({
          total,
          inProgress: Math.max(0, total - won - lost),
          conversion: total > 0 ? Math.round((won / total) * 100) : 0,
        });
      }

      if (projectsRes) {
        const items = projectsRes.items;
        setProjects({
          total: projectsRes.total,
          inProgress: items.filter((p) => p.status === "В работе" || p.status === "Новый" || p.status === "На проверке").length,
          won: items.filter((p) => p.status === "Выиграно").length,
        });
      }

      if (!leadStats && !projectsRes) setFailed(true);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (failed) return null;

  if (loading) {
    return (
      <div className="grid gap-3">
        <div className="h-[84px] animate-pulse rounded-2xl border border-neutral-200 bg-neutral-50" />
        <div className="h-[84px] animate-pulse rounded-2xl border border-neutral-200 bg-neutral-50" />
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {leads && (
        <PreviewStatCard icon="user" title={text.previewLeadsTitle} period={text.previewLeadsPeriod}
          stats={[
            { label: text.previewLeadsTotal, value: String(leads.total) },
            { label: text.previewLeadsInProgress, value: String(leads.inProgress) },
            { label: text.previewLeadsConversion, value: `${leads.conversion}%` },
          ]} />
      )}
      {projects && (
        <PreviewStatCard icon="grid" title={text.previewProjectsTitle}
          stats={[
            { label: text.previewProjectsTotal, value: String(projects.total) },
            { label: text.previewProjectsInProgress, value: String(projects.inProgress) },
            { label: text.previewProjectsWon, value: String(projects.won) },
          ]} />
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   MAIN LANDING PAGE
═══════════════════════════════════════════════════════════════════ */
const LandingPage: React.FC = () => {
  const { t } = useTranslation();

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const loggedIn = !!getAccessToken();
  const rootRef = useRef<HTMLElement>(null);
  useScrollReveal(rootRef);

  /* /#aura, /#crew… со страниц «Функции» и др.: блоки рендерятся после загрузки чанка — докручиваем сами */
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    const tm = window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), 150);
    return () => window.clearTimeout(tm);
  }, []);

  /* Окно входа/регистрации. /?mode=signup|login (ссылки с других страниц и писем) открывает его сразу. */
  const urlMode = searchParams.get("mode");
  const [auth, setAuth] = useState<"login" | "signup" | null>(urlMode === "signup" || urlMode === "login" ? urlMode : null);
  useEffect(() => {
    if (urlMode === "signup" || urlMode === "login") setAuth(urlMode);
  }, [urlMode]);
  useEffect(() => {
    if (!auth) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setAuth(null); };
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [auth]);

  const [cookiesAccepted, setCookiesAccepted] = useState(() => {
    try {
      const d = window.localStorage.getItem("lumiva_cookies_consent");
      return d === "accepted" || d === "declined";
    } catch { return false; }
  });

  const [demoOpen, setDemoOpen] = useState(false);
  const [utmPayload, setUtmPayload] = useState<Record<string, string>>({});
  const [demoForm, setDemoForm] = useState({
    firstName: "", lastName: "", email: "", phoneCountry: "+7", phoneNumber: "",
    ordersPerMonth: "", contactMethod: "", consent: false, botTrap: "",
  });
  const [demoSubmitting, setDemoSubmitting] = useState(false);
  const [demoStatus, setDemoStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  /* UTM */
  useEffect(() => {
    const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
    const params = new URLSearchParams(window.location.search);
    const fromUrl: Record<string, string> = {};
    keys.forEach(k => { const v = params.get(k); if (v) fromUrl[k] = v; });
    if (Object.keys(fromUrl).length > 0) {
      setUtmPayload(fromUrl);
      try { window.localStorage.setItem("lumiva_utm", JSON.stringify(fromUrl)); } catch {};
      return;
    }
    try {
      const cached = window.localStorage.getItem("lumiva_utm");
      if (cached) { const p = JSON.parse(cached); if (p && typeof p === "object") setUtmPayload(p); }
    } catch {}
  }, []);

  return (
    <div className="min-h-screen bg-white text-black overflow-x-clip">
      <PublicHeader activeKey="home" />

      <main className="lhv" ref={rootRef}>
        <Hero onAuth={setAuth} loggedIn={loggedIn} onOpenCrm={() => navigate("/dashboard")} />
        <Integrations />
        <Platform />
        <Modules />
        <Automation />
        <AuraShowcase onAuth={setAuth} />
        <Crew />
        <Depts />
        <Start />
        <Pricing onAuth={setAuth} />
        <FinalCta onAuth={setAuth} onDemo={() => setDemoOpen(true)} loggedIn={loggedIn} />

        {auth && (
          <div className="lh-modal-bg" onClick={() => setAuth(null)}>
            <div className="lh-login" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
              <div className="lh-login-glow" />
              <button type="button" className="lh-x" onClick={() => setAuth(null)} aria-label={t("landing.v5.close")}>
                <Icon name="x" size={16} />
              </button>
              <LandingAuthPanel compact initialMode={auth} key={auth} />
            </div>
          </div>
        )}
      </main>

      <PublicFooter />

      {/* DEMO DRAWER */}
      <div className={`fixed inset-0 z-50 transition-opacity duration-300 ${demoOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        <button className="absolute inset-0 bg-black/40" onClick={() => setDemoOpen(false)} aria-label={t("landing.form.close")} />
        <div className={`absolute inset-0 bg-white transition-transform duration-300 ease-out ${demoOpen ? "translate-x-0" : "translate-x-full"}`}>
          <div className="mx-auto h-full max-w-[1440px] px-4 sm:px-6 py-8 sm:py-12 grid gap-8 lg:gap-10 lg:grid-cols-[1.35fr,1fr] overflow-y-auto">
            <div className="space-y-6">
              <div style={{ fontFamily: FM }} className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">Lumiva CRM</div>
              <h2 style={{ fontFamily: FF }} className="text-4xl sm:text-6xl lg:text-7xl font-medium text-black leading-[1.05] whitespace-pre-line">
                {t("landing.form.headline")}
              </h2>
              <p className="text-sm text-neutral-600 max-w-md">{t("landing.form.sub")}</p>
              <div className="flex items-center gap-4 text-[12px] text-neutral-500">
                <a href="mailto:hello@lumiva.agency" className="hover:text-black">hello@lumiva.agency</a><span>{t("landing.v4.formContactNote")}</span>
              </div>
            </div>

            <form className="space-y-5" onSubmit={e => {
              e.preventDefault();
              if (!demoForm.consent) { setDemoStatus({ type: "error", message: t("landing.form.errors.consent") }); return; }
              if (!demoForm.firstName || !demoForm.email || !demoForm.phoneNumber) { setDemoStatus({ type: "error", message: t("landing.form.errors.required") }); return; }
              if (!demoForm.contactMethod) { setDemoStatus({ type: "error", message: t("landing.form.errors.contact") }); return; }
              setDemoSubmitting(true); setDemoStatus(null);
              const phone = `${demoForm.phoneCountry} ${demoForm.phoneNumber}`.trim();
              void fetch("/v1/public/demo-requests", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ firstName: demoForm.firstName, lastName: demoForm.lastName, email: demoForm.email, phone, ordersPerMonth: demoForm.ordersPerMonth, contactMethod: demoForm.contactMethod, botField: demoForm.botTrap || undefined, utm: utmPayload }),
              })
                .then(res => { if (!res.ok) throw new Error(t("landing.form.errors.submit")); return res.json(); })
                .then(() => { setDemoStatus({ type: "success", message: t("landing.form.success") }); setDemoForm({ firstName: "", lastName: "", email: "", phoneCountry: "+7", phoneNumber: "", ordersPerMonth: "", contactMethod: "", consent: false, botTrap: "" }); })
                .catch(() => setDemoStatus({ type: "error", message: t("landing.form.errors.failed") }))
                .finally(() => setDemoSubmitting(false));
            }}>
              {demoStatus && (
                <div className={`rounded-2xl border px-4 py-3 text-sm ${demoStatus.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
                  {demoStatus.message}
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                  {t("landing.form.name")} *
                  <input className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm" value={demoForm.firstName} onChange={e => setDemoForm(s => ({ ...s, firstName: e.target.value }))} placeholder={t("landing.form.placeholders.name")} />
                </label>
                <label className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                  {t("landing.form.surname")}
                  <input className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm" value={demoForm.lastName} onChange={e => setDemoForm(s => ({ ...s, lastName: e.target.value }))} placeholder={t("landing.form.placeholders.surname")} />
                </label>
              </div>
              <input className="hidden" tabIndex={-1} autoComplete="off" value={demoForm.botTrap} onChange={e => setDemoForm(s => ({ ...s, botTrap: e.target.value }))} />
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                  {t("landing.form.email")} *
                  <input type="email" className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm" value={demoForm.email} onChange={e => setDemoForm(s => ({ ...s, email: e.target.value }))} placeholder={t("landing.form.placeholders.email")} />
                </label>
                <label className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                  {t("landing.form.phone")} *
                  <div className="mt-2 flex gap-2">
                    <select value={demoForm.phoneCountry} onChange={e => setDemoForm(s => ({ ...s, phoneCountry: e.target.value }))} className="w-28 rounded-2xl border border-neutral-200 bg-white px-3 py-3 text-sm">
                      <option value="+7">🇷🇺 +7</option><option value="+90">🇹🇷 +90</option><option value="+1">🇺🇸 +1</option><option value="+44">🇬🇧 +44</option><option value="+49">🇩🇪 +49</option>
                    </select>
                    <input className="min-w-0 flex-1 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm" value={demoForm.phoneNumber} onChange={e => setDemoForm(s => ({ ...s, phoneNumber: e.target.value }))} placeholder={t("landing.form.placeholders.phone")} />
                  </div>
                </label>
              </div>
              <label className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                {t("landing.form.orders")}
                <input className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm" value={demoForm.ordersPerMonth} onChange={e => setDemoForm(s => ({ ...s, ordersPerMonth: e.target.value }))} placeholder={t("landing.form.placeholders.orders")} />
              </label>
              <div className="space-y-2">
                <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">{t("landing.form.contact")} *</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[{ value: "telegram", label: "Telegram" }, { value: "whatsapp", label: "WhatsApp" }, { value: "email", label: "Email" }, { value: "phone", label: t("landing.form.phone") }].map(m => (
                    <label key={m.value} className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm transition-colors ${demoForm.contactMethod === m.value ? m.value === "telegram" ? "border-sky-500 bg-sky-50 text-sky-700" : "border-black bg-neutral-50 text-black" : "border-neutral-200 text-neutral-700 hover:border-neutral-400"}`}>
                      <span>{m.label}</span>
                      <input type="radio" name="contactMethod" value={m.value} checked={demoForm.contactMethod === m.value} onChange={e => setDemoForm(s => ({ ...s, contactMethod: e.target.value }))} />
                    </label>
                  ))}
                </div>
              </div>
              <label className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-200 px-4 py-3 text-sm">
                <span className="text-neutral-600">
                  {t("landing.form.consent")}{" "}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 text-neutral-800">{t("landing.form.policy")}</a>
                </span>
                <span className="relative inline-flex items-center">
                  <input type="checkbox" checked={demoForm.consent} onChange={e => setDemoForm(s => ({ ...s, consent: e.target.checked }))} className="peer sr-only" />
                  <span className="h-6 w-11 rounded-full bg-neutral-300 transition-colors peer-checked:bg-emerald-500" />
                  <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
                </span>
              </label>
              <button type="submit" disabled={demoSubmitting} className="w-full rounded-2xl border border-black bg-black px-4 py-3 text-sm font-medium text-white disabled:opacity-60 hover:bg-neutral-800 transition-colors">
                {demoSubmitting ? t("landing.form.sending") : t("landing.form.send")}
              </button>
            </form>
          </div>
          <button onClick={() => setDemoOpen(false)} className="absolute right-6 top-6 text-sm text-neutral-500 hover:text-black">✕</button>
        </div>
      </div>

      {/* COOKIES */}
      {!cookiesAccepted && (
        <div className="fixed inset-x-0 bottom-4 z-50 px-4">
          <div className="mx-auto max-w-3xl rounded-2xl border border-neutral-200 bg-white/95 shadow-[0_20px_60px_rgba(0,0,0,0.12)] px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-neutral-700">
            <div className="space-y-1">
              <div className="font-semibold text-black">{t("landing.cookies.title")}</div>
              <div className="text-[12px] text-neutral-500">
                {t("landing.cookies.text")}{" "}
                <a href="/privacy" className="underline underline-offset-4 text-neutral-800">{t("landing.cookies.link")}</a>.
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setCookiesAccepted(true); try { window.localStorage.setItem("lumiva_cookies_consent", "accepted"); } catch {} }}
                className="rounded-xl border border-black bg-black text-white px-3 py-2 text-sm font-medium">
                {t("landing.cookies.accept")}
              </button>
              <button onClick={() => { setCookiesAccepted(true); try { window.localStorage.setItem("lumiva_cookies_consent", "declined"); } catch {} }}
                className="rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-700">
                {t("landing.cookies.decline")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;
