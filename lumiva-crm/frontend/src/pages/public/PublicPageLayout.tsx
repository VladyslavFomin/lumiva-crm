import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { PublicHeader } from '../../components/public/PublicHeader';
import { PublicFooter } from '../../components/public/PublicFooter';

type PageKey =
  | 'development' | 'scenarios' | 'api' | 'integrations'
  | 'solutions' | 'analytics' | 'marketing' | 'sales'
  | 'blog' | 'privacy' | 'pricing' | 'features' | 'security' | 'compare'
  | 'about' | 'contact' | 'faq' | 'terms' | 'changelog' | 'home';

const PARENT_MAP: Partial<Record<PageKey, PageKey>> = {
  analytics: 'solutions',
  marketing: 'solutions',
  sales:     'solutions',
  faq:       'about',
  terms:     'about',
  privacy:   'about',
  security:  'about',
  changelog: 'features',
};

const PAGE_PATHS: Partial<Record<PageKey, string>> = {
  home:         '/',
  features:     '/features',
  integrations: '/integrations',
  pricing:      '/pricing',
  solutions:    '/solutions',
  analytics:    '/solutions/analytics',
  marketing:    '/solutions/marketing',
  sales:        '/solutions/sales',
  about:        '/about',
  contact:      '/contact',
  blog:         '/blog',
  faq:          '/faq',
  terms:        '/terms',
  privacy:      '/privacy',
  security:     '/security',
  compare:      '/compare',
  changelog:    '/changelog',
  development:  '/development',
  scenarios:    '/scenarios',
  api:          '/api-integration',
};

type Props = {
  pageKey: PageKey;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export const PublicPageLayout: React.FC<Props> = ({ pageKey, title, subtitle, children }) => {
  const { t } = useTranslation();

  const crumbs: { key: PageKey; label: string; to: string }[] = [];
  crumbs.push({ key: 'home', label: 'Lumiva CRM', to: '/' });

  const parentKey = PARENT_MAP[pageKey];
  if (parentKey) {
    crumbs.push({
      key: parentKey,
      label: t(`publicPages.nav.${parentKey}`),
      to: PAGE_PATHS[parentKey] ?? '/',
    });
  }
  if (pageKey !== 'home') {
    crumbs.push({
      key: pageKey,
      label: t(`publicPages.nav.${pageKey}`),
      to: PAGE_PATHS[pageKey] ?? '/',
    });
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-white via-slate-50 to-slate-100 text-slate-900">
      {/* Background blobs */}
      <div className="pointer-events-none fixed -left-32 top-20 h-80 w-80 rounded-full bg-slate-200/30 blur-3xl" />
      <div className="pointer-events-none fixed -right-32 top-60 h-96 w-96 rounded-full bg-slate-300/20 blur-3xl" />

      <PublicHeader activeKey={pageKey} />

      <main className="mx-auto w-full max-w-7xl px-3 pb-16 sm:px-4">
        {/* Breadcrumbs */}
        {crumbs.length > 1 && (
          <nav aria-label="breadcrumb" className="mb-6 flex items-center gap-1.5 text-[11px] text-slate-500">
            {crumbs.map((c, i) => (
              <React.Fragment key={c.key}>
                {i > 0 && (
                  <svg className="w-3 h-3 text-slate-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 18l6-6-6-6" />
                  </svg>
                )}
                {i < crumbs.length - 1 ? (
                  <Link to={c.to} className="hover:text-slate-800 transition-colors">{c.label}</Link>
                ) : (
                  <span className="text-slate-800 font-medium">{c.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}

        {/* Page hero */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-white to-slate-50 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.07)] sm:p-8 md:p-12 mb-8"
        >
          <div className="pointer-events-none absolute -right-8 -top-6 h-40 w-40 rounded-full bg-slate-100/60 blur-2xl" />
          <div className="pointer-events-none absolute right-16 top-8 h-24 w-24 rounded-full bg-slate-200/40 blur-xl" />
          <svg
            aria-hidden="true"
            viewBox="0 0 240 80"
            className="pointer-events-none absolute -right-8 -top-3 h-24 w-64 opacity-[0.07]"
          >
            <path d="M0 60 C 40 20, 80 20, 120 45 S 200 70, 240 25" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
          <div className="relative">
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              {t('publicPages.common.kicker', { defaultValue: 'Lumiva CRM' })}
            </div>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl md:text-4xl leading-tight">{title}</h1>
            {subtitle && (
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">{subtitle}</p>
            )}
            <div className="mt-6 flex flex-wrap gap-2.5">
              <Link
                to="/?mode=signup"
                className="inline-flex items-center gap-1.5 rounded-full bg-black px-5 py-2 text-xs font-semibold text-white hover:bg-neutral-800 transition-colors"
              >
                {t('publicPages.common.primaryCta', { defaultValue: 'Попробовать бесплатно' })}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
              <Link
                to="/contact"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-2 text-xs font-medium text-slate-700 hover:border-slate-300 transition-colors"
              >
                {t('publicPages.common.secondaryCta', { defaultValue: 'Записаться на демо' })}
              </Link>
            </div>
          </div>
        </motion.section>

        <section>{children}</section>
      </main>

      <PublicFooter />
    </div>
  );
};
