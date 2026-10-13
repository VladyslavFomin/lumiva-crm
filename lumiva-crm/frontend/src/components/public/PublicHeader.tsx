import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import './public-header.css';
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
  | 'solutions' | 'analytics' | 'marketing' | 'sales' | 'warehouse' | 'client-accounts' | 'products'
  | 'booking' | 'hotels'
  | 'blog' | 'privacy' | 'security' | 'compare' | 'pricing' | 'features'
  | 'about' | 'contact' | 'faq' | 'terms' | 'changelog' | 'home';

interface PublicHeaderProps {
  activeKey?: PageKey;
}

/* Шапка публичного сайта — Claude Design lh-nav.jsx (LhHeader/LhDrawer) + lh.css. Стили — public-header.css (.lhh). */
const Ic: React.FC<{ d: React.ReactNode; size?: number; sw?: number }> = ({ d, size = 16, sw = 1.6 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);
const I = {
  chev: <path d="M6 9l6 6 6-6" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
    </>
  ),
  out: (
    <>
      <path d="M15 4h4a1 1 0 011 1v14a1 1 0 01-1 1h-4" />
      <path d="M10 17l5-5-5-5M15 12H3" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </>
  ),
  app: (
    <>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </>
  ),
  cog: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </>
  ),
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  check: <path d="M5 12l5 5 9-10" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  spark: (
    <>
      <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
    </>
  ),
  chat: <path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z" />,
  box: (
    <>
      <path d="M3 8l9-5 9 5v8l-9 5-9-5z" />
      <path d="M3 8l9 5 9-5M12 13v8" />
    </>
  ),
};

type Lang = 'ru' | 'en' | 'tr';
const LANGS: Array<[Lang, string, string]> = [
  ['ru', 'RU', 'Русский'],
  ['en', 'EN', 'English'],
  ['tr', 'TR', 'Türkçe'],
];
const HT: Record<Lang, Record<string, string>> = {
  ru: {
    ai: 'ИИ', aura: 'Дашборды по одному запросу', crew: 'Роли, доступы, журнал действий', depts: 'Команды ИИ-агентов',
    auraN: 'Aura', crewN: 'ИИ-сотрудники', deptsN: 'ИИ-отделы', platform: 'ИИ-платформа', product: 'Продукт',
    login: 'Войти', start: 'Начать бесплатно', openCrm: 'Открыть CRM', profile: 'Личный кабинет', settings: 'Настройки компании',
    logout: 'Выйти', logoutFull: 'Выйти из аккаунта', menu: 'Меню', close: 'Закрыть', lang: 'Язык',
  },
  en: {
    ai: 'AI', aura: 'Dashboards from one request', crew: 'Roles, access, action log', depts: 'Teams of AI agents',
    auraN: 'Aura', crewN: 'AI employees', deptsN: 'AI departments', platform: 'AI platform', product: 'Product',
    login: 'Log in', start: 'Start for free', openCrm: 'Open CRM', profile: 'My profile', settings: 'Company settings',
    logout: 'Log out', logoutFull: 'Log out of account', menu: 'Menu', close: 'Close', lang: 'Language',
  },
  tr: {
    ai: 'YZ', aura: 'Tek istekle panolar', crew: 'Roller, erişim, işlem günlüğü', depts: 'YZ ajan ekipleri',
    auraN: 'Aura', crewN: 'YZ çalışanları', deptsN: 'YZ departmanları', platform: 'YZ platformu', product: 'Ürün',
    login: 'Giriş yap', start: 'Ücretsiz başla', openCrm: 'CRM’i aç', profile: 'Profilim', settings: 'Şirket ayarları',
    logout: 'Çıkış', logoutFull: 'Hesaptan çıkış', menu: 'Menü', close: 'Kapat', lang: 'Dil',
  },
};

const initials = (n: string) => (n || '?').replace(/[«»"]/g, '').trim().slice(0, 2).toUpperCase();

/** Закрытие выпадашки по клику снаружи. */
function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const f = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', f);
    return () => document.removeEventListener('mousedown', f);
  }, [open, close]);
  return ref;
}

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
    onScroll();
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

  const lang: Lang = currentLang === 'en' || currentLang === 'tr' ? currentLang : 'ru';
  const ht = HT[lang];
  const isActive = (key: PageKey) => activeKey === key;
  const [langOpen, setLangOpen] = useState(false);
  const [acctOpen, setAcctOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const langRef = useOutside(langOpen, useCallback(() => setLangOpen(false), []));
  const acctRef = useOutside(acctOpen, useCallback(() => setAcctOpen(false), []));

  const mainItems: Array<{ key: PageKey; to: string }> = [
    { key: 'features', to: '/features' },
    { key: 'integrations', to: '/integrations' },
    { key: 'pricing', to: '/pricing' },
  ];
  const solutionItems: Array<{ key: PageKey; to: string }> = [
    { key: 'analytics', to: '/solutions/analytics' },
    { key: 'marketing', to: '/solutions/marketing' },
    { key: 'sales', to: '/solutions/sales' },
    { key: 'client-accounts', to: '/solutions/client-accounts' },
    { key: 'products', to: '/solutions/products' },
    { key: 'warehouse', to: '/solutions/warehouse' },
    { key: 'booking', to: '/solutions/booking' },
    { key: 'hotels', to: '/solutions/hotels' },
  ];
  const tailItems: Array<{ key: PageKey; to: string }> = [
    { key: 'about', to: '/about' },
    { key: 'blog', to: '/blog' },
    { key: 'contact', to: '/contact' },
  ];
  const aiItems = [
    { to: '/#aura', n: ht.auraN, d: ht.aura, ic: I.spark },
    { to: '/#crew', n: ht.crewN, d: ht.crew, ic: I.chat },
    { to: '/#depts', n: ht.deptsN, d: ht.depts, ic: I.box },
  ];
  const isSolutionActive = solutionItems.some((x) => x.key === activeKey) || activeKey === 'solutions';

  const logout = () => {
    clearSession();
    setTenantSession(null);
    setAcctOpen(false);
  };
  const closeDrawer = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setMobileOpen(false);
      setClosing(false);
    }, 260);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const k = (e: KeyboardEvent) => e.key === 'Escape' && closeDrawer();
    window.addEventListener('keydown', k);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', k);
    };
  }, [mobileOpen, closeDrawer]);

  const Logo = (
    <Link to="/" className="lhh-logo" aria-label="Lumiva CRM">
      <span className="lhh-logo-m">
        <i />
      </span>
      Lumiva<span className="lhh-logo-s">CRM</span>
    </Link>
  );

  const AcctLogo = ({ size }: { size: 'sm' | 'md' | 'lg' }) =>
    tenantSession?.logoSrc ? (
      <span className={'lhh-acct-lg img ' + size}>
        <img src={tenantSession.logoSrc} alt="" />
        <i />
      </span>
    ) : (
      <span className={'lhh-acct-lg ' + size}>
        {initials(tenantSession?.companyName || '')}
        <i />
      </span>
    );

  let n = 0;
  const st = () => ({ animationDelay: 0.06 + n++ * 0.03 + 's' });

  const drawer =
    mobileOpen &&
    createPortal(
      <div className={'lhh lhh-dr' + (closing ? ' out' : '')}>
        <button type="button" className="lhh-dr-bg" onClick={closeDrawer} aria-label={ht.close} />
        <aside className="lhh-dr-p">
          <div className="lhh-dr-h">
            {Logo}
            <button type="button" className="lhh-x" onClick={closeDrawer} aria-label={ht.close}>
              <Ic d={I.x} size={16} />
            </button>
          </div>
          <div className="lhh-dr-b">
            {tenantSession && (
              <Link to="/dashboard" className="lhh-dr-acct" style={st()}>
                <AcctLogo size="lg" />
                <span className="lhh-acct-t">
                  <b>{tenantSession.companyName}</b>
                  <em>{tenantSession.userLabel}</em>
                  <u>{ht.openCrm}</u>
                </span>
                <Ic d={I.arrow} size={15} />
              </Link>
            )}
            <div className="lhh-dr-k" style={st()}>
              {ht.platform}
            </div>
            <div className="lhh-dr-ai">
              {aiItems.map((x) => (
                <a key={x.to} href={x.to} style={st()} onClick={closeDrawer}>
                  <span className="lhh-ic">
                    <Ic d={x.ic} size={16} />
                  </span>
                  <span>
                    <b>{x.n}</b>
                    <em>{x.d}</em>
                  </span>
                </a>
              ))}
            </div>
            <div className="lhh-dr-k" style={st()}>
              {ht.product}
            </div>
            <div className="lhh-dr-l">
              {[...mainItems, ...tailItems].map((x) => (
                <Link key={x.key} to={x.to} style={st()} className={isActive(x.key) ? 'on' : ''}>
                  {t(`publicPages.nav.${x.key}`)}
                  <Ic d={I.arrow} size={13} />
                </Link>
              ))}
            </div>
            <div className="lhh-dr-k" style={st()}>
              {t('publicPages.nav.solutions')}
            </div>
            <div className="lhh-dr-chips" style={st()}>
              {solutionItems.map((x) => (
                <Link key={x.key} to={x.to} className={isActive(x.key) ? 'on' : ''}>
                  {t(`publicPages.nav.${x.key}`)}
                </Link>
              ))}
            </div>
          </div>
          <div className="lhh-dr-f">
            <div className="lhh-dr-lang" role="radiogroup" aria-label={ht.lang}>
              <span className="lhh-dr-lang-i" style={{ transform: `translateX(${LANGS.findIndex((x) => x[0] === lang) * 100}%)` }} />
              {LANGS.map(([k, , nm]) => (
                <button key={k} type="button" role="radio" aria-checked={lang === k} className={lang === k ? 'on' : ''} onClick={() => setAppLanguage(k)}>
                  {nm}
                </button>
              ))}
            </div>
            {tenantSession ? (
              <button type="button" className="lhh-btn gh block" onClick={logout}>
                <Ic d={I.out} size={14} />
                {ht.logoutFull}
              </button>
            ) : (
              <div className="lhh-dr-cta">
                <Link className="lhh-btn gh" to="/?mode=login">
                  {ht.login}
                </Link>
                <Link className="lhh-btn" to="/?mode=signup">
                  {ht.start}
                </Link>
              </div>
            )}
          </div>
        </aside>
      </div>,
      document.body,
    );

  return (
    <>
      <header className={'lhh lhh-hd' + (scrolled ? ' sc' : '')}>
        <div className="lhh-hd-in">
          {Logo}
          <nav className="lhh-nav">
            <div className="lhh-dd">
              <button type="button" className="lhh-dd-b">
                {ht.ai}
                <Ic d={I.chev} size={12} />
              </button>
              <div className="lhh-pop lhh-dd-m wide">
                {aiItems.map((x) => (
                  <a key={x.to} href={x.to} className="lhh-dd-ai">
                    <span className="lhh-ic">
                      <Ic d={x.ic} size={16} />
                    </span>
                    <span>
                      <b>{x.n}</b>
                      <em>{x.d}</em>
                    </span>
                  </a>
                ))}
              </div>
            </div>
            {mainItems.map((x) => (
              <Link key={x.key} to={x.to} className={isActive(x.key) ? 'on' : ''}>
                {t(`publicPages.nav.${x.key}`)}
              </Link>
            ))}
            <div className="lhh-dd">
              <button type="button" className={'lhh-dd-b' + (isSolutionActive ? ' on' : '')}>
                {t('publicPages.nav.solutions')}
                <Ic d={I.chev} size={12} />
              </button>
              <div className="lhh-pop lhh-dd-m">
                <div className="lhh-dd-g">
                  {solutionItems.map((x) => (
                    <Link key={x.key} to={x.to} className={isActive(x.key) ? 'on' : ''}>
                      {t(`publicPages.nav.${x.key}`)}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
            {tailItems.map((x) => (
              <Link key={x.key} to={x.to} className={isActive(x.key) ? 'on' : ''}>
                {t(`publicPages.nav.${x.key}`)}
              </Link>
            ))}
          </nav>
          <div className="lhh-hd-r">
            <div className={'lhh-lang' + (langOpen ? ' o' : '')} ref={langRef}>
              <button type="button" className="lhh-lang-b" onClick={() => setLangOpen((o) => !o)} aria-label={ht.lang} aria-expanded={langOpen}>
                <Ic d={I.globe} size={14} />
                {lang.toUpperCase()}
                <Ic d={I.chev} size={12} />
              </button>
              <div className="lhh-pop lhh-lang-m">
                {LANGS.map(([k, s, nm]) => (
                  <button
                    key={k}
                    type="button"
                    className={lang === k ? 'on' : ''}
                    onClick={() => {
                      setAppLanguage(k);
                      setLangOpen(false);
                    }}
                  >
                    <b>{s}</b>
                    {nm}
                    {lang === k && <Ic d={I.check} size={13} sw={2} />}
                  </button>
                ))}
              </div>
            </div>
            {tenantSession ? (
              <div className={'lhh-acct' + (acctOpen ? ' o' : '')} ref={acctRef}>
                <button type="button" className="lhh-acct-b" onClick={() => setAcctOpen((o) => !o)} aria-expanded={acctOpen} title={t('publicPages.nav.openCrmHint')}>
                  <AcctLogo size="md" />
                  <span className="lhh-acct-t">
                    <b>{tenantSession.companyName}</b>
                    <em>{tenantSession.userLabel}</em>
                  </span>
                  <Ic d={I.chev} size={12} />
                </button>
                <div className="lhh-pop lhh-acct-m">
                  <div className="lhh-acct-h">
                    <AcctLogo size="lg" />
                    <div>
                      <b>{tenantSession.companyName}</b>
                      <em>{tenantSession.userLabel}</em>
                    </div>
                  </div>
                  <Link to="/dashboard" className="lhh-acct-go">
                    <Ic d={I.app} size={15} />
                    {ht.openCrm}
                    <Ic d={I.arrow} size={13} />
                  </Link>
                  <Link to="/profile">
                    <Ic d={I.user} size={15} />
                    {ht.profile}
                  </Link>
                  <Link to="/settings">
                    <Ic d={I.cog} size={15} />
                    {ht.settings}
                  </Link>
                  <button type="button" onClick={logout}>
                    <Ic d={I.out} size={15} />
                    {ht.logout}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <Link className="lhh-btn gh sm lhh-in-b" to="/?mode=login">
                  {ht.login}
                </Link>
                <Link className="lhh-btn sm lhh-st" to="/?mode=signup">
                  {ht.start}
                </Link>
              </>
            )}
            <button type="button" className="lhh-burger" aria-label={ht.menu} onClick={() => setMobileOpen(true)}>
              {tenantSession && <AcctLogo size="sm" />}
              <span className="lhh-burger-i">
                <i />
                <i />
                <i />
              </span>
            </button>
          </div>
        </div>
      </header>
      {drawer}
    </>
  );
};
