import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { setAppLanguage } from '../../i18n';
import { AnimatePresence, motion } from 'framer-motion';

type Props = {
  pageKey:
    | 'development'
    | 'scenarios'
    | 'api'
    | 'integrations'
    | 'solutions'
    | 'analytics'
    | 'marketing'
    | 'sales'
    | 'blog'
    | 'privacy'
    | 'pricing';
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

export const PublicPageLayout: React.FC<Props> = ({ pageKey, title, subtitle, children }) => {
  const { i18n, t } = useTranslation();
  const currentLang = (i18n.language || 'ru').slice(0, 2);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [mobileSolutionsOpen, setMobileSolutionsOpen] = React.useState(false);
  const navItems = [
    { key: 'development', to: '/development' },
    { key: 'scenarios', to: '/scenarios' },
    { key: 'api', to: '/api-integration' },
    { key: 'integrations', to: '/integrations' },
    { key: 'solutions', to: '/solutions' },
    { key: 'pricing', to: '/pricing' },
    { key: 'blog', to: '/blog' },
    { key: 'privacy', to: '/privacy' },
  ] as const;
  const desktopPrimaryItems = [
    { key: 'development', to: '/development' },
    { key: 'scenarios', to: '/scenarios' },
    { key: 'api', to: '/api-integration' },
    { key: 'integrations', to: '/integrations' },
  ] as const;
  const solutionItems = [
    { key: 'analytics', to: '/solutions/analytics' },
    { key: 'marketing', to: '/solutions/marketing' },
    { key: 'sales', to: '/solutions/sales' },
  ] as const;
  const desktopTailItems = [
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
            {desktopPrimaryItems.map((item) => (
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
            <div className="relative group">
              <button
                type="button"
                className={
                  pageKey === 'solutions' || pageKey === 'analytics' || pageKey === 'marketing' || pageKey === 'sales'
                    ? 'inline-flex items-center gap-1 rounded-full border !border-black !bg-black px-3 py-1.5 !text-white'
                    : 'inline-flex items-center gap-1 rounded-full border border-transparent px-3 py-1.5 hover:border-neutral-300 hover:bg-white hover:text-black'
                }
              >
                {t('publicPages.nav.solutions')}
                <span className="text-[10px]">▾</span>
              </button>
              <div className="invisible absolute left-0 top-full z-50 mt-2 w-48 rounded-2xl border border-slate-200 bg-white p-2 opacity-0 shadow-[0_16px_40px_rgba(15,23,42,0.12)] transition-all group-hover:visible group-hover:opacity-100">
                {solutionItems.map((item) => (
                  <Link
                    key={item.key}
                    to={item.to}
                    className={
                      pageKey === item.key
                        ? 'block rounded-xl !bg-slate-900 px-3 py-2 text-xs font-semibold !text-white'
                        : 'block rounded-xl px-3 py-2 text-xs font-semibold !text-slate-700 hover:bg-slate-100'
                    }
                  >
                    {t(`publicPages.nav.${item.key}`)}
                  </Link>
                ))}
              </div>
            </div>
            {desktopTailItems.map((item) => (
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
              className="hidden rounded-full !border !border-slate-900 !bg-slate-900 px-3 py-1.5 text-xs font-semibold !text-white no-underline hover:!bg-slate-800 md:inline-flex"
              style={{ color: '#fff', backgroundColor: '#0f172a' }}
            >
              {t('landing.nav.login')}
            </a>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-900 shadow-[0_8px_24px_rgba(15,23,42,0.12)] md:hidden"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 7H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M4 12H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M4 17H16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {mobileMenuOpen ? (
          <motion.div
            className="fixed inset-0 z-[80] md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-slate-950/55 backdrop-blur-md"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close menu"
            />
            <motion.aside
              className="absolute right-0 top-0 h-full w-[88vw] max-w-sm border-l border-white/50 bg-gradient-to-b from-white via-slate-50 to-slate-100 p-5 shadow-[0_28px_70px_rgba(15,23,42,0.28)]"
              initial={{ x: 56, opacity: 0.7 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 56, opacity: 0.7 }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            >
              <div className="pointer-events-none absolute -left-10 top-20 h-32 w-32 rounded-full bg-indigo-300/25 blur-2xl" />
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <Link
                    to="/"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-900 no-underline"
                  >
                    Lumiva CRM
                  </Link>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-slate-500">
                    Navigation
                  </div>
                </div>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white/90 text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.12)]"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close menu"
                >
                  ×
                </button>
              </div>

              <div className="mb-4 rounded-xl border border-white/70 bg-white/75 px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-slate-500 shadow-[0_6px_16px_rgba(15,23,42,0.08)]">
                Premium navigation
              </div>

              <nav className="grid gap-2.5 text-sm">
                {desktopPrimaryItems.map((item) => (
                  <Link
                    key={item.key}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={
                      pageKey === item.key
                        ? 'group flex items-center justify-between rounded-xl !border !border-slate-900/90 !bg-gradient-to-r !from-slate-950 !to-indigo-950 px-3.5 py-2.5 font-semibold tracking-[0.01em] !text-white shadow-[0_10px_24px_rgba(15,23,42,0.25)]'
                        : 'group flex items-center justify-between rounded-xl border border-slate-200/90 bg-white/75 px-3.5 py-2.5 font-semibold tracking-[0.01em] !text-slate-700 shadow-[0_4px_12px_rgba(15,23,42,0.05)]'
                    }
                  >
                    <span>{t(`publicPages.nav.${item.key}`)}</span>
                  </Link>
                ))}
                <div className="mt-1">
                  <div
                    className={`flex items-center justify-between rounded-xl border px-3 py-2 ${
                      pageKey === 'solutions'
                        ? '!border-slate-900/90 !bg-gradient-to-r !from-slate-950 !to-indigo-950'
                        : 'border-slate-200/90 bg-white/75'
                    }`}
                  >
                    <Link
                      to="/solutions"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`text-sm font-semibold tracking-[0.01em] no-underline ${
                        pageKey === 'solutions' ? '!text-white' : '!text-slate-700'
                      }`}
                    >
                      {t('publicPages.nav.solutions')}
                    </Link>
                    <button
                      type="button"
                      onClick={() => setMobileSolutionsOpen((prev) => !prev)}
                      aria-label={t('publicPages.nav.solutions')}
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs transition ${
                        pageKey === 'solutions'
                          ? 'border-white/35 bg-white/15 text-white'
                          : 'border-slate-300 bg-white text-slate-600'
                      }`}
                    >
                      {mobileSolutionsOpen ? '▴' : '▾'}
                    </button>
                  </div>
                  {mobileSolutionsOpen ? (
                    <div className="mt-2 grid gap-1 rounded-xl border border-slate-200/90 bg-white/70 p-2 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
                      {solutionItems.map((item) => (
            <Link
              key={item.key}
              to={item.to}
                          onClick={() => setMobileMenuOpen(false)}
              className={
                pageKey === item.key
                              ? 'flex items-center justify-between rounded-lg !bg-slate-900 px-3 py-2 text-xs font-semibold tracking-[0.01em] !text-white'
                              : 'flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold tracking-[0.01em] !text-slate-700 hover:bg-white'
              }
            >
                          <span>{t(`publicPages.nav.${item.key}`)}</span>
            </Link>
          ))}
        </div>
                  ) : null}
                </div>
                {desktopTailItems.map((item) => (
                  <Link
                    key={item.key}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={
                      pageKey === item.key
                        ? 'flex items-center justify-between rounded-xl !border !border-slate-900/90 !bg-gradient-to-r !from-slate-950 !to-indigo-950 px-3.5 py-2.5 font-semibold tracking-[0.01em] !text-white shadow-[0_10px_24px_rgba(15,23,42,0.25)]'
                        : 'flex items-center justify-between rounded-xl border border-slate-200/90 bg-white/75 px-3.5 py-2.5 font-semibold tracking-[0.01em] !text-slate-700 shadow-[0_4px_12px_rgba(15,23,42,0.05)]'
                    }
                  >
                    <span>{t(`publicPages.nav.${item.key}`)}</span>
                  </Link>
                ))}
              </nav>

              <div className="absolute bottom-5 left-5 right-5 space-y-2.5">
                <div className="rounded-xl border border-slate-200/90 bg-white/80 px-3 py-2 text-xs text-slate-600">
                  vlad@lumiva.agency
                </div>
                <a
                  href="/login"
                  className="block rounded-xl !border !border-slate-900 !bg-gradient-to-r !from-slate-950 !to-indigo-950 px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-[0.12em] !text-white no-underline shadow-[0_10px_24px_rgba(15,23,42,0.28)] hover:!from-slate-900 hover:!to-indigo-900"
                  style={{ color: '#fff', backgroundColor: '#0f172a' }}
                >
                  {t('landing.nav.login')}
                </a>
              </div>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>

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
