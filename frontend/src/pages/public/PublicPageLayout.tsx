import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { setAppLanguage } from '../../i18n';

type Props = {
  pageKey: 'development' | 'scenarios' | 'api' | 'solutions' | 'blog' | 'privacy' | 'pricing';
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

export const PublicPageLayout: React.FC<Props> = ({ pageKey, title, subtitle, children }) => {
  const { i18n, t } = useTranslation();
  const currentLang = (i18n.language || 'ru').slice(0, 2);
  const navItems = [
    { key: 'development', to: '/development' },
    { key: 'scenarios', to: '/scenarios' },
    { key: 'api', to: '/api' },
    { key: 'solutions', to: '/solutions' },
    { key: 'pricing', to: '/pricing' },
    { key: 'blog', to: '/blog' },
    { key: 'privacy', to: '/privacy' },
  ] as const;

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-white via-slate-50 to-slate-100 text-slate-900">
      <div className="pointer-events-none absolute -left-24 top-24 h-64 w-64 rounded-full bg-slate-300/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-40 h-72 w-72 rounded-full bg-slate-400/20 blur-3xl" />

      <header className="sticky top-0 z-40 mb-8 sm:mb-10">
        <div className="mx-auto mt-2 flex w-full max-w-7xl items-center justify-between gap-3 rounded-3xl border border-black/5 bg-white/70 px-4 py-2.5 shadow-[0_10px_40px_rgba(0,0,0,0.06)] backdrop-blur-xl sm:mt-3 sm:px-6 sm:py-3">
          <Link to="/" className="text-sm font-semibold uppercase tracking-[0.14em]">
            Lumiva CRM
          </Link>
          <nav className="hidden md:flex items-center gap-2 text-xs font-medium text-neutral-600">
            {navItems.map((item) => (
              <Link
                key={item.key}
                to={item.to}
                className={
                  pageKey === item.key
                    ? 'rounded-full border border-black bg-black px-3 py-1.5 text-white'
                    : 'rounded-full border border-transparent px-3 py-1.5 hover:border-neutral-300 hover:bg-white hover:text-black'
                }
              >
                {t(`publicPages.nav.${item.key}`)}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <select
              value={currentLang}
              onChange={(e) => setAppLanguage(e.target.value as 'ru' | 'en' | 'tr')}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600"
              aria-label={t('crm.common.language')}
            >
              <option value="ru">{t('lang.ru')}</option>
              <option value="en">{t('lang.en')}</option>
              <option value="tr">{t('lang.tr')}</option>
            </select>
            <a
              href="/login"
              className="rounded-full !border !border-slate-900 !bg-slate-900 px-3 py-1.5 text-xs font-semibold !text-white no-underline hover:!bg-slate-800"
              style={{ color: '#fff', backgroundColor: '#0f172a' }}
            >
              {t('landing.nav.login')}
            </a>
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-7xl gap-2 overflow-x-auto px-3 pb-2 md:hidden">
          {navItems.map((item) => (
            <Link
              key={item.key}
              to={item.to}
              className={
                pageKey === item.key
                  ? 'whitespace-nowrap rounded-full border border-black bg-black px-3 py-1.5 text-[11px] font-semibold text-white'
                  : 'whitespace-nowrap rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700'
              }
            >
              {t(`publicPages.nav.${item.key}`)}
            </Link>
          ))}
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-3 py-8 sm:px-4 md:py-14">
        <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-white to-slate-100 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:p-6 md:p-10">
          <svg
            aria-hidden="true"
            viewBox="0 0 240 80"
            className="pointer-events-none absolute -right-8 -top-3 h-24 w-64 opacity-25"
          >
            <path d="M0 60 C 40 20, 80 20, 120 45 S 200 70, 240 25" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
          <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
            {t('publicPages.common.kicker')}
          </div>
          <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
          <p className="mt-3 max-w-3xl text-sm text-slate-600">{subtitle}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <a
              href="/login"
              className="rounded-full !border !border-slate-900 !bg-slate-900 px-4 py-2 text-xs font-semibold !text-white no-underline hover:!bg-slate-800"
              style={{ color: '#fff', backgroundColor: '#0f172a' }}
            >
              {t('publicPages.common.primaryCta')}
            </a>
            <Link
              to="/"
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:border-slate-500"
            >
              {t('publicPages.common.secondaryCta')}
            </Link>
          </div>
        </section>
        <section className="mt-6">{children}</section>
      </main>

      <footer className="mt-24 bg-black text-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:py-14">
          <div className="mb-8 inline-flex items-center gap-2">
            <div className="h-7 w-7 rounded-xl border border-white flex items-center justify-center">
              <div className="h-3 w-3 rounded-full bg-white" />
            </div>
            <span className="text-xs font-semibold tracking-[0.16em] uppercase">Lumiva CRM</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-300">
            {navItems.map((item) => (
              <Link
                key={item.key}
                to={item.to}
                className={
                  pageKey === item.key ? 'text-white underline decoration-white/40' : 'hover:text-white'
                }
              >
                {t(`publicPages.nav.${item.key}`)}
              </Link>
            ))}
          </div>
          <div className="mt-8 border-t border-white/10 pt-4 text-[10px] text-neutral-400">
            © {new Date().getFullYear()} Lumiva CRM
          </div>
        </div>
      </footer>
    </div>
  );
};
