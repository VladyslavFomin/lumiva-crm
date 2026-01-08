import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { requestPasswordReset } from '../api/client';

export const ForgotPasswordPage: React.FC = () => {
  const { t } = useTranslation();
  const [clientKey, setClientKey] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!clientKey.trim() || !email.trim()) {
      setError(t('crm.auth.forgot.errors.required'));
      return;
    }

    setLoading(true);
    try {
      await requestPasswordReset({ clientKey: clientKey.trim(), email: email.trim() });
      setSuccess(t('crm.auth.forgot.success'));
      setTimeout(() => navigate('/login', { replace: true }), 1500);
    } catch (err: any) {
      setError(err.message || t('crm.auth.forgot.errors.failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white via-lumiva-bg to-lumiva-bg px-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-[0_24px_70px_rgba(17,24,39,0.12)] p-6 md:p-8">
        <div className="mb-6">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-1">
            {t('crm.auth.forgot.brand')}
          </div>
          <div className="text-lg font-semibold text-lumiva-accent">
            {t('crm.auth.forgot.title')}
          </div>
          <p className="text-sm text-slate-600 mt-2">
            {t('crm.auth.forgot.subtitle')}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              {t('crm.auth.forgot.clientKey')}
            </label>
            <input
              type="text"
              value={clientKey}
              onChange={(e) => setClientKey(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-lumiva-accent placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-lumiva-accent shadow-sm"
              placeholder={t('crm.auth.forgot.clientKeyPlaceholder')}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              {t('crm.auth.forgot.email')}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-lumiva-accent placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-lumiva-accent shadow-sm"
              placeholder={t('crm.auth.forgot.emailPlaceholder')}
            />
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {error}
            </div>
          )}
          {success && (
            <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center rounded-xl bg-lumiva-accent hover:bg-lumiva-accent-soft transition-all px-3 py-2.5 text-sm font-semibold text-white shadow-[0_16px_38px_rgba(34,34,34,0.18)] hover:-translate-y-[1px] active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? t('crm.auth.forgot.sending') : t('crm.auth.forgot.submit')}
          </button>
        </form>

        <div className="mt-4 text-[11px] text-slate-500 text-center">
          <button
            type="button"
            className="hover:text-lumiva-accent transition-colors"
            onClick={() => navigate('/login')}
          >
            {t('crm.auth.forgot.back')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
