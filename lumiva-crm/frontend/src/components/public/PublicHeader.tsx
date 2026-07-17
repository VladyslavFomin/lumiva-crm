import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { setAppLanguage } from '../../i18n';
import {
  clearSession,
  getAccessToken,
  getStoredTenantName,
  getStoredUser,
  SESSION_USER_UPDATED_EVENT,
} from '../../auth/session';
import {
  fetchCompanySettings,
  normalizeLogoUrl,
  TENANT_BRANDING_EVENT,
} from '../../api/settings';
import { ApiError, resolvePublicAssetUrl } from '../../api/client';

type PageKey =
  | 'development' | 'scenarios' | 'api' | 'integrations'
  | 'solutions' | 'analytics' | 'marketing' | 'sales' | 'warehouse'
  | 'blog' | 'privacy' | 'pricing' | 'features'
  | 'about' | 'contact' | 'faq' | 'terms' | 'changelog' | 'home';

interface PublicHeaderProps {
  activeKey?: PageKey;
}

const ChevronDown: React.FC<{ open: boolean }> = ({ open }) => (
  <svg
    className={`w-3 h-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    fill="none" stroke="currentColor" viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const ArrowRight: React.FC = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
  </svg>
);

type TenantSessionChip = {
  companyName: string;
  userLabel: string;
  logoSrc: string | null;
};

function formatSessionUserLabel(user: unknown): string {
  if (!user || typeof user !== 'object') return '';
  const u = user as Record<string, unknown>;
  const name = typeof u.name === 'string' ? u.name.trim() : '';
  if (name) return name;
  const email = typeof u.email === 'string' ? u.email.trim() : '';
  if (email) return email.split('@')[0] || email;
  return '';
}

export const PublicHeader: React.FC<PublicHeaderProps> = ({ activeKey }) => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const currentLang = (i18n.language || 'ru').slice(0, 2) as 'ru' | 'en' | 'tr';
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [tenantSession, setTenantSession] = useState<TenantSessionChip | null>(null);

  const refreshTenantSession = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setTenantSession(null);
      return;
    }
    const user = getStoredUser();
    const userLabel = formatSessionUserLabel(user);
    const fallbackCompany = getStoredTenantName() || '';

    try {
      const s = await fetchCompanySettings({ skipUnauthorizedRedirect: true });
      const logoRel = normalizeLogoUrl(s.logoUrl);
      const logoSrc = logoRel ? resolvePublicAssetUrl(logoRel) : null;
      setTenantSession({
        companyName: (s.name && String(s.name).trim()) || fallbackCompany || 'CRM',
        userLabel:
          userLabel ||
          (typeof user === 'object' && user !== null && 'email' in user
            ? String((user as { email?: string }).email ?? '')
            : ''),
        logoSrc,
      });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        clearSession();
        setTenantSession(null);
        return;
      }
      setTenantSession({
        companyName: fallbackCompany || 'CRM',
        userLabel,
        logoSrc: null,
      });
    }
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    void refreshTenantSession();
  }, [refreshTenantSession, location.pathname]);

  useEffect(() => {
    const onBranding = () => void refreshTenantSession();
    const onUser = () => void refreshTenantSession();
    window.addEventListener(TENANT_BRANDING_EVENT, onBranding);
    window.addEventListener(SESSION_USER_UPDATED_EVENT, onUser);
    return () => {
      window.removeEventListener(TENANT_BRANDING_EVENT, onBranding);
      window.removeEventListener(SESSION_USER_UPDATED_EVENT, onUser);
    };
  }, [refreshTenantSession]);

  const isActive = (key: PageKey) => activeKey === key;
  const isSolutionActive = ['solutions', 'analytics', 'marketing', 'sales', 'warehouse'].includes(activeKey ?? '');

  const primaryItems = [
    { key: 'features' as PageKey, to: '/features' },
    { key: 'integrations' as PageKey, to: '/integrations' },
    { key: 'pricing' as PageKey, to: '/pricing' },
  ];
  const solutionItems = [
    { key: 'analytics' as PageKey, to: '/solutions/analytics' },
    { key: 'marketing' as PageKey, to: '/solutions/marketing' },
    { key: 'sales' as PageKey, to: '/solutions/sales' },
    { key: 'warehouse' as PageKey, to: '/solutions/warehouse' },
  ];
  const tailItems = [
    { key: 'about' as PageKey, to: '/about' },
    { key: 'blog' as PageKey, to: '/blog' },
    { key: 'contact' as PageKey, to: '/contact' },
  ];

  const navLinkClass = (key: PageKey) =>
    isActive(key)
      ? 'rounded-full border border-black bg-black px-3 py-1.5 text-white'
      : 'rounded-full border border-transparent px-3 py-1.5 hover:border-neutral-200 hover:bg-white/80 hover:text-black transition-all duration-150';

  return (
    <>
      <header className={`sticky top-0 z-40 transition-all duration-300 ${scrolled ? 'pt-0' : 'pt-2 sm:pt-3'}`}>
        <div className={`mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 sm:py-3 transition-all duration-300 ${
          scrolled
            ? 'bg-white/95 backdrop-blur-xl shadow-[0_2px_20px_rgba(0,0,0,0.06)] border-b border-black/5'
            : 'rounded-3xl border border-black/5 bg-white/70 shadow-[0_10px_40px_rgba(0,0,0,0.06)] backdrop-blur-xl'
        }`}>
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0 group">
            <div className="w-7 h-7 rounded-xl bg-black flex items-center justify-center transition-transform duration-200 group-hover:scale-95">
              <div className="w-3 h-3 rounded-full bg-white" />
            </div>
            <span className="text-sm font-semibold uppercase tracking-[0.14em] text-black">Lumiva CRM</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1 text-xs font-medium text-neutral-600">
            {primaryItems.map((item) => (
              <Link key={item.key} to={item.to} className={navLinkClass(item.key)}>
                {t(`publicPages.nav.${item.key}`)}
              </Link>
            ))}

            {/* Solutions dropdown */}
            <div className="relative group">
              <button
                type="button"
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 transition-all duration-150 ${
                  isSolutionActive
                    ? 'border-black bg-black text-white'
                    : 'border-transparent hover:border-neutral-200 hover:bg-white/80 hover:text-black'
                }`}
              >
                {t('publicPages.nav.solutions')}
                <ChevronDown open={false} />
              </button>
              <div className="invisible absolute left-0 top-full z-50 mt-2 w-52 rounded-2xl border border-slate-100 bg-white p-2 opacity-0 shadow-[0_16px_40px_rgba(15,23,42,0.12)] transition-all duration-200 group-hover:visible group-hover:opacity-100">
                {solutionItems.map((item) => (
                  <Link
                    key={item.key}
                    to={item.to}
                    className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-medium transition-all ${
                      isActive(item.key)
                        ? 'bg-black text-white'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {t(`publicPages.nav.${item.key}`)}
                    {isActive(item.key) && <ArrowRight />}
                  </Link>
                ))}
              </div>
            </div>

            {tailItems.map((item) => (
              <Link key={item.key} to={item.to} className={navLinkClass(item.key)}>
                {t(`publicPages.nav.${item.key}`)}
              </Link>
            ))}
          </nav>

          {/* Right controls */}
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={currentLang}
              onChange={(e) => setAppLanguage(e.target.value as 'ru' | 'en' | 'tr')}
              className="rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600 outline-none cursor-pointer hover:border-slate-300 transition-colors"
              aria-label="Language"
            >
              <option value="ru">RU</option>
              <option value="en">EN</option>
              <option value="tr">TR</option>
            </select>
            {tenantSession ? (
              <Link
                to="/app"
                title={t('publicPages.nav.openCrmHint')}
                className="hidden md:flex max-w-[min(280px,34vw)] items-center gap-2 rounded-full border border-slate-200/90 bg-white pl-1.5 pr-3 py-1 shadow-[0_2px_12px_rgba(15,23,42,0.06)] transition-colors hover:border-slate-300 hover:bg-slate-50/90"
              >
                <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
                  {tenantSession.logoSrc ? (
                    <img
                      src={tenantSession.logoSrc}
                      alt=""
                      className="h-full w-full object-contain p-0.5"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-black text-[10px] font-bold uppercase tracking-tight text-white">
                      {(tenantSession.companyName || '?').slice(0, 2)}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 text-left leading-tight">
                  <div className="truncate text-[11px] font-semibold text-slate-900">{tenantSession.companyName}</div>
                  <div className="truncate text-[10px] font-medium text-slate-500">{tenantSession.userLabel}</div>
                </div>
                <ArrowRight />
              </Link>
            ) : (
              <Link
                to="/login"
                className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-black bg-black px-4 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800 transition-colors"
              >
                {t('landing.nav.login', { defaultValue: 'Войти' })}
                <ArrowRight />
              </Link>
            )}
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-900 md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M4 7H20M4 12H20M4 17H16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 z-[8500] md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/40 backdrop-blur-md"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            />
            <motion.aside
              className="absolute right-0 top-0 h-full w-[85vw] max-w-sm bg-white p-5 shadow-[0_28px_70px_rgba(15,23,42,0.28)] flex flex-col"
              initial={{ x: 60, opacity: 0.7 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 60, opacity: 0.7 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            >
              <div className="flex items-center justify-between mb-6">
                <Link to="/" className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-black flex items-center justify-center">
                    <div className="w-3 h-3 rounded-full bg-white" />
                  </div>
                  <span className="text-sm font-semibold uppercase tracking-[0.14em]">Lumiva CRM</span>
                </Link>
                <button
                  type="button"
                  className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-600"
                  onClick={() => setMobileOpen(false)}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <nav className="flex flex-col gap-1 flex-1 overflow-y-auto">
                {[...primaryItems, ...tailItems].map((item) => (
                  <Link
                    key={item.key}
                    to={item.to}
                    className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive(item.key)
                        ? 'bg-black text-white'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {t(`publicPages.nav.${item.key}`)}
                  </Link>
                ))}
                <div className="px-3 pt-3 pb-1">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400 font-semibold mb-1">
                    {t('publicPages.nav.solutions')}
                  </div>
                </div>
                {solutionItems.map((item) => (
                  <Link
                    key={item.key}
                    to={item.to}
                    className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive(item.key) ? 'bg-black text-white' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {t(`publicPages.nav.${item.key}`)}
                  </Link>
                ))}
              </nav>

              <div className="pt-4 border-t border-slate-100 flex flex-col gap-2">
                <select
                  value={currentLang}
                  onChange={(e) => setAppLanguage(e.target.value as 'ru' | 'en' | 'tr')}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold"
                >
                  <option value="ru">Русский</option>
                  <option value="en">English</option>
                  <option value="tr">Türkçe</option>
                </select>
                {tenantSession ? (
                  <Link
                    to="/app"
                    className="w-full flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left hover:bg-slate-50 transition-colors"
                  >
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
                      {tenantSession.logoSrc ? (
                        <img src={tenantSession.logoSrc} alt="" className="h-full w-full object-contain p-0.5" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-black text-xs font-bold text-white">
                          {(tenantSession.companyName || '?').slice(0, 2)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-slate-900">{tenantSession.companyName}</div>
                      <div className="truncate text-[11px] text-slate-500">{tenantSession.userLabel}</div>
                      <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        {t('publicPages.nav.openCrmCta')}
                      </div>
                    </div>
                  </Link>
                ) : (
                  <Link
                    to="/login"
                    className="w-full text-center rounded-xl bg-black text-white px-4 py-2.5 text-xs font-semibold hover:bg-neutral-800 transition-colors"
                  >
                    {t('landing.nav.login', { defaultValue: 'Войти' })}
                  </Link>
                )}
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
