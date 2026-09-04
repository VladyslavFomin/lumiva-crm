import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  login,
  resolveClientKeyByDomain,
  verifyTwoFactorLogin,
  type LoginResponse,
  type TwoFactorRequiredResponse,
} from '../api/client';
import {
  clearSessionExpired,
  getAccessToken,
  persistSession,
  readSessionExpired,
} from '../auth/session';

export const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [clientKey, setClientKey] = useState('');
  const [clientKeyLocked, setClientKeyLocked] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');

  const existingToken = getAccessToken();

  React.useEffect(() => {
    if (existingToken) {
      navigate('/app', { replace: true });
    }
  }, [existingToken, navigate]);

  React.useEffect(() => {
    const expired = readSessionExpired();
    if (expired) {
      setInfo(t('crm.auth.login.sessionExpired'));
      clearSessionExpired();
    }
  }, [t]);

  // Автоподстановка clientKey: либо из ?clientKey= (ссылка "Логин для тенанта" в pl1), либо,
  // если открыли не с crm.lumiva.agency, по кастомному домену тенанта — чтобы клиент на своём
  // домене видел только email+пароль, а не свой company slug.
  React.useEffect(() => {
    const fromQuery = new URLSearchParams(window.location.search).get('clientKey');
    if (fromQuery) {
      setClientKey(fromQuery);
      setClientKeyLocked(true);
      return;
    }
    const host = window.location.hostname;
    if (host === 'crm.lumiva.agency' || host === 'localhost' || host === '127.0.0.1') {
      return;
    }
    let cancelled = false;
    resolveClientKeyByDomain(host).then((key) => {
      if (!cancelled && key) {
        setClientKey(key);
        setClientKeyLocked(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (existingToken) {
    return <Navigate to="/app" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!clientKey || !email || !password) {
      setError(t('crm.auth.login.errors.required'));
      return;
    }

    setLoading(true);
    try {
      const resp = await login({ clientKey, email, password });
      if ((resp as TwoFactorRequiredResponse).twoFactorRequired) {
        setChallengeToken((resp as TwoFactorRequiredResponse).challengeToken);
        setLoading(false);
        return;
      }
      persistSession(resp as LoginResponse);
      setSuccess(true);
      setTimeout(() => {
        navigate('/app', { replace: true });
      }, 400);
    } catch (err: any) {
      setError(err.message || t('crm.auth.login.errors.failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyTwoFactor = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!challengeToken || !twoFactorCode) return;
    setLoading(true);
    try {
      const resp = await verifyTwoFactorLogin({ challengeToken, code: twoFactorCode });
      persistSession(resp);
      setSuccess(true);
      setTimeout(() => {
        navigate('/app', { replace: true });
      }, 400);
    } catch (err: any) {
      setError(err.message || t('crm.auth.login.errors.failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-start md:items-center justify-center px-4 py-8 sm:py-12 bg-gradient-to-b from-white via-lumiva-bg to-lumiva-bg">
      <div className="max-w-5xl w-full flex flex-col md:flex-row items-stretch md:items-center gap-8 md:gap-12">
        {/* Левая колонка — описание продукта */}
        <div className="w-full md:flex-1 text-lumiva-accent">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-slate-200 shadow-sm mb-6">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
              {t('crm.auth.login.badge')}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight mb-4 leading-tight">
            {t('crm.auth.login.headline')}
            <span className="text-lumiva-accent block mt-1">
              {t('crm.auth.login.headlineAccent')}
            </span>
          </h1>

          <p className="text-slate-600 text-sm md:text-base max-w-xl mb-6">
            {t('crm.auth.login.description')}
          </p>

          <ul className="space-y-2 text-[13px] sm:text-sm text-slate-600">
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-lumiva-accent" />
              <span>{t('crm.auth.login.bullets.collect')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-lumiva-accent" />
              <span>{t('crm.auth.login.bullets.statuses')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-lumiva-accent" />
              <span>{t('crm.auth.login.bullets.ui')}</span>
            </li>
          </ul>
        </div>

        {/* Правая колонка — форма входа */}
        <div className="w-full md:flex-1 max-w-lg">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-[0_24px_70px_rgba(17,24,39,0.12)] p-5 sm:p-6 md:p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-1">
                  {t('crm.auth.login.brand')}
                </div>
                <div className="text-lg font-semibold text-lumiva-accent">
                  {t('crm.auth.login.formTitle')}
                </div>
              </div>
              <div className="h-10 w-10 rounded-2xl bg-black text-white border border-slate-200 flex items-center justify-center shadow-[0_10px_30px_rgba(17,24,39,0.18)]">
                <span className="text-xs font-semibold">
                  CRM
                </span>
              </div>
            </div>

            {challengeToken ? (
              <form onSubmit={handleVerifyTwoFactor} className="space-y-4">
                <p className="text-sm text-slate-600">{t('crm.auth.login.twoFactor.subtitle')}</p>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">
                    {t('crm.auth.login.twoFactor.codeLabel')}
                  </label>
                  <input
                    type="text"
                    inputMode="text"
                    autoFocus
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-lumiva-accent tracking-[0.2em] placeholder:text-slate-400 placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-lumiva-accent shadow-sm"
                    placeholder={t('crm.auth.login.twoFactor.codePlaceholder')}
                  />
                  <p className="mt-1.5 text-[11px] text-slate-400">{t('crm.auth.login.twoFactor.backupHint')}</p>
                </div>

                {error && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !twoFactorCode}
                  className="w-full inline-flex items-center justify-center rounded-xl bg-lumiva-accent hover:bg-lumiva-accent-soft transition-all px-3 py-2.5 text-sm font-semibold text-white shadow-[0_16px_38px_rgba(34,34,34,0.18)] hover:-translate-y-[1px] active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? t('crm.auth.login.submitting') : t('crm.auth.login.twoFactor.submit')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setChallengeToken(null);
                    setTwoFactorCode('');
                    setError(null);
                  }}
                  className="w-full text-center text-[12px] text-slate-500 hover:text-lumiva-accent"
                >
                  {t('crm.auth.login.twoFactor.back')}
                </button>
              </form>
            ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {!clientKeyLocked && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">
                    {t('crm.auth.login.clientKey')}
                  </label>
                  <input
                    type="text"
                    value={clientKey}
                    onChange={(e) => setClientKey(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-lumiva-accent placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-lumiva-accent shadow-sm"
                    placeholder={t('crm.auth.login.clientKeyPlaceholder')}
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  {t('crm.auth.login.email')}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-lumiva-accent placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-lumiva-accent shadow-sm"
                  placeholder={t('crm.auth.login.emailPlaceholder')}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  {t('crm.auth.login.password')}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-lumiva-accent placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-lumiva-accent shadow-sm"
                  placeholder={t('crm.auth.login.passwordPlaceholder')}
                />
              </div>

              {error && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                  {error}
                </div>
              )}

              {info && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                  {info}
                </div>
              )}

              {success && (
                <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                  {t('crm.auth.login.success')}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center rounded-xl bg-lumiva-accent hover:bg-lumiva-accent-soft transition-all px-3 py-2.5 text-sm font-semibold text-white shadow-[0_16px_38px_rgba(34,34,34,0.18)] hover:-translate-y-[1px] active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? t('crm.auth.login.submitting') : t('crm.auth.login.submit')}
              </button>
            </form>
            )}

            <div className="mt-4 flex items-center justify-between text-[11px] text-slate-500">
              <button
                type="button"
                className="hover:text-lumiva-accent transition-colors"
                onClick={() => navigate('/forgot-password')}
              >
                {t('crm.auth.login.forgot')}
              </button>
              <span>© {new Date().getFullYear()} Lumiva</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

};
