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

  const FF = "'Inter Tight', 'Helvetica Neue', Helvetica, Arial, sans-serif";
  const FM = "'JetBrains Mono', ui-monospace, monospace";

  return (
    <div className="relative min-h-screen bg-white text-slate-900">
      <PublicHeader activeKey={pageKey} />

      <main className="mx-auto w-full px-5 pb-20 md:px-8" style={{ maxWidth: 1280 }}>
        {/* Breadcrumbs */}
        {crumbs.length > 1 && (
          <nav aria-label="breadcrumb" className="mt-6 flex items-center gap-1.5 text-[11px] text-slate-500" style={{ fontFamily: FM }}>
            {crumbs.map((c, i) => (
              <React.Fragment key={c.key}>
                {i > 0 && <span className="text-slate-300">/</span>}
                {i < crumbs.length - 1 ? (
                  <Link to={c.to} className="hover:text-slate-900 transition-colors">{c.label}</Link>
                ) : (
                  <span className="text-slate-900">{c.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}

        {/* Page hero — same visual language as the landing / pricing pages */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="mb-12 border-b border-[#e7e7e7] pb-12 pt-10 md:pt-14"
        >
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-[#888]" style={{ fontFamily: FM }}>
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#222]" />
            {crumbs[crumbs.length - 1]?.label ?? t('publicPages.common.kicker', { defaultValue: 'Lumiva CRM' })}
          </div>
          <h1
            className="mt-6 max-w-4xl text-[#222]"
            style={{ fontFamily: FF, fontSize: 'clamp(34px, 5vw, 64px)', lineHeight: 1.02, letterSpacing: '-0.04em', fontWeight: 500 }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-[#555] sm:text-[17px]">{subtitle}</p>
          )}
          {pageKey !== 'contact' && (
          <div className="mt-8 flex flex-wrap gap-2.5">
            <Link
              to="/?mode=signup"
              className="inline-flex items-center gap-2 rounded-full border border-[#222] bg-[#222] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-black"
            >
              {t('publicPages.common.tryFree', { defaultValue: 'Попробовать бесплатно' })}
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center rounded-full border border-[#e7e7e7] bg-white px-5 py-3 text-sm font-medium text-[#222] transition-colors hover:border-[#222]"
            >
              {t('publicPages.common.requestDemo', { defaultValue: 'Запросить демо' })}
            </Link>
          </div>
          )}
        </motion.section>

        <section>{children}</section>
      </main>

      <PublicFooter />
    </div>
  );
};
