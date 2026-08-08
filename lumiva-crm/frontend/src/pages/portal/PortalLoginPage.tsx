// src/pages/portal/PortalLoginPage.tsx
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { requestPortalMagicLink } from '../../api/portal';

export const PortalLoginPage: React.FC = () => {
  const { clientKey = '' } = useParams<{ clientKey: string }>();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await requestPortalMagicLink(clientKey, email.trim());
      setSent(true);
    } catch (err: any) {
      setError(err?.message || 'Не удалось отправить ссылку для входа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-[0_24px_70px_rgba(17,24,39,0.12)] p-6 md:p-8">
        <div className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2">Личный кабинет</div>
        <h1 className="text-2xl font-semibold text-lumiva-accent mb-3">Вход</h1>

        {sent ? (
          <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-3 leading-relaxed">
            Если такой email есть в нашей базе, мы отправили на него ссылку для входа. Проверьте
            почту — ссылка действует 15 минут.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-slate-600 leading-relaxed">
              Введите email, указанный при работе с нами — пришлём ссылку для входа, без пароля.
            </p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-lumiva-accent placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-lumiva-accent"
              autoFocus
            />
            {error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center rounded-xl bg-lumiva-accent hover:bg-lumiva-accent-soft transition-all px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? 'Отправляем…' : 'Прислать ссылку для входа'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default PortalLoginPage;
