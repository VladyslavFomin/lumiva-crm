import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api/client';
import { persistSession } from '../auth/session';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [clientKey, setClientKey] = useState('demo-client'); // демо-данные
  const [email, setEmail] = useState('owner@demo.com');
  const [password, setPassword] = useState('demo123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!clientKey || !email || !password) {
      setError('Заполните все поля');
      return;
    }

    setLoading(true);
    try {
      const resp = await login({ clientKey, email, password });
      persistSession(resp);
      setSuccess(true);
      setTimeout(() => {
        navigate('/app', { replace: true });
      }, 400);
    } catch (err: any) {
      setError(err.message || 'Не удалось войти');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex items-center justify-center px-4">
      <div className="max-w-5xl w-full flex flex-col md:flex-row items-center gap-10 md:gap-16">
        {/* Левая колонка — описание продукта */}
        <div className="flex-1 text-slate-100">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/60 border border-slate-700/60 mb-6">
            <span className="h-2 w-2 rounded-full bg-lumiva-accent-soft animate-pulse" />
            <span className="text-xs uppercase tracking-[0.16em] text-slate-300">
              Lumiva CRM · v0.1
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight mb-4">
            Центр управления
            <span className="text-lumiva-accent block mt-1">
              лидами и продажами
            </span>
          </h1>

          <p className="text-slate-300 text-sm md:text-base max-w-xl mb-6">
            От первого клика на сайте до счёта клиента. Лиды из форм, чата,
            рекламных кампаний и бронирований собираются в одной панели —
            как в Bitrix24, но без лишнего шума.
          </p>

          <ul className="space-y-2 text-sm text-slate-300">
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-lumiva-accent" />
              <span>Сбор лидов из WordPress, чатов и онлайн-форм.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-lumiva-accent" />
              <span>Готовая база для статусов, ответственных и счётов.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-lumiva-accent" />
              <span>UI в стиле премиальной CRM под hospitality.</span>
            </li>
          </ul>
        </div>

        {/* Правая колонка — форма входа */}
        <div className="flex-1 max-w-md w-full">
          <div className="bg-lumiva-card/90 border border-slate-800/80 rounded-3xl shadow-lumiva p-6 md:p-8 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400 mb-1">
                  LUMIVA
                </div>
                <div className="text-lg font-semibold text-slate-50">
                  Вход в Lumiva CRM
                </div>
              </div>
              <div className="h-10 w-10 rounded-2xl bg-slate-900/80 border border-slate-700/60 flex items-center justify-center">
                <span className="text-xs font-semibold text-lumiva-accent">
                  CRM
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Client Key
                </label>
                <input
                  type="text"
                  value={clientKey}
                  onChange={(e) => setClientKey(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-lumiva-accent focus:border-lumiva-accent"
                  placeholder="например, selectum-main-site"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  E-mail
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-lumiva-accent focus:border-lumiva-accent"
                  placeholder="you@company.com"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Пароль
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-lumiva-accent focus:border-lumiva-accent"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2">
                  {error}
                </div>
              )}

              {success && (
                <div className="text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-700/60 rounded-xl px-3 py-2">
                  Успешный вход. Сессия сохранена.
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center rounded-xl bg-lumiva-accent hover:bg-lumiva-accent-soft transition-colors px-3 py-2.5 text-sm font-medium text-slate-950 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Входим...' : 'Войти в CRM'}
              </button>
            </form>

            <div className="mt-4 flex items-center justify-between text-[11px] text-slate-500">
              <button
                type="button"
                className="hover:text-slate-300 transition-colors"
              >
                Забыли пароль?
              </button>
              <span>© {new Date().getFullYear()} Lumiva</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
  
};