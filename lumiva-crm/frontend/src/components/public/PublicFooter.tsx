import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './public-header.css';

export const PublicFooter: React.FC = () => {
  const { t, i18n } = useTranslation();
  const year = new Date().getFullYear();
  const lang = (i18n.language || 'ru').slice(0, 2);
  // ИИ-пункты из макета (lh-sections.jsx LhFooter) ведут на блоки главной; хранение — реальный факт (сервер в ЕС)
  const FT = {
    ru: { tagline: 'CRM с ИИ-командой для продаж, склада, бронирований и сервиса.', aura: 'Aura', crew: 'ИИ-сотрудники', depts: 'ИИ-отделы', login: 'Вход', data: 'Серверы в ЕС · ежедневные резервные копии' },
    en: { tagline: 'A CRM with an AI team for sales, stock, bookings and service.', aura: 'Aura', crew: 'AI employees', depts: 'AI departments', login: 'Log in', data: 'EU servers · daily backups' },
    tr: { tagline: 'Satış, depo, rezervasyon ve hizmet için YZ ekipli CRM.', aura: 'Aura', crew: 'YZ çalışanları', depts: 'YZ departmanları', login: 'Giriş', data: 'AB sunucuları · günlük yedekler' },
  }[lang === 'en' || lang === 'tr' ? lang : 'ru'];

  const productLinks = [
    { to: '/#aura', label: FT.aura },
    { to: '/#crew', label: FT.crew },
    { to: '/#depts', label: FT.depts },
    { to: '/features',    label: t('publicPages.nav.features') },
    { to: '/pricing',     label: t('publicPages.nav.pricing') },
    { to: '/integrations',label: t('publicPages.nav.integrations') },
    { to: '/changelog',   label: t('publicPages.nav.changelog') },
    { to: '/development', label: t('publicPages.nav.development') },
    { to: '/scenarios',   label: t('publicPages.nav.scenarios') },
    { to: '/api-integration', label: t('publicPages.nav.api') },
  ];
  const solutionLinks = [
    { to: '/solutions/analytics',      label: t('publicPages.nav.analytics') },
    { to: '/solutions/marketing',      label: t('publicPages.nav.marketing') },
    { to: '/solutions/sales',          label: t('publicPages.nav.sales') },
    { to: '/solutions/client-accounts',label: t('publicPages.nav.client-accounts') },
    { to: '/solutions/products',       label: t('publicPages.nav.products') },
    { to: '/solutions/warehouse',      label: t('publicPages.nav.warehouse') },
    { to: '/solutions/booking',        label: t('publicPages.nav.booking') },
    { to: '/solutions/hotels',         label: t('publicPages.nav.hotels') },
  ];
  const companyLinks = [
    { to: '/about',   label: t('publicPages.nav.about') },
    { to: '/contact', label: t('publicPages.nav.contact') },
    { to: '/blog',    label: t('publicPages.nav.blog') },
    { to: '/faq',     label: t('publicPages.nav.faq') },
    { to: '/compare', label: t('publicPages.nav.compare') },
    { to: '/?mode=login', label: FT.login },
  ];

  const col = (h: string, links: Array<{ to: string; label: string }>) => (
    <div className="lhh-ft-c">
      <h5>{h}</h5>
      {links.map((l) =>
        l.to.includes('#') ? (
          <a key={l.to} href={l.to}>
            {l.label}
          </a>
        ) : (
          <Link key={l.to} to={l.to}>
            {l.label}
          </Link>
        ),
      )}
    </div>
  );

  return (
    <footer className="lhh lhh-ft">
      <div className="lhh-ft-in">
        <div className="lhh-ft-brand">
          <Link to="/" className="lhh-logo" aria-label="Lumiva CRM">
            <span className="lhh-logo-m">
              <i />
            </span>
            Lumiva<span className="lhh-logo-s">CRM</span>
          </Link>
          <p>{FT.tagline}</p>
          <div className="lhh-ft-ct">
            <a href="mailto:hello@lumiva.agency">hello@lumiva.agency</a>
            <a href="https://t.me/lumiva_crm" target="_blank" rel="noopener noreferrer">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
                <path d="M21 4L3 11l6 2 2 6 3-4 5 4z" />
              </svg>
              @lumiva_crm
            </a>
          </div>
        </div>
        {col(t('publicPages.footer.product', { defaultValue: 'Продукт' }), productLinks)}
        {col(t('publicPages.nav.solutions'), solutionLinks)}
        {col(t('publicPages.footer.company', { defaultValue: 'Компания' }), companyLinks)}
      </div>
      <div className="lhh-ft-b">
        <span>
          © {year} Lumiva CRM. {t('publicPages.footer.rights', { defaultValue: 'Все права защищены.' })}
        </span>
        <span className="lhh-ft-legal">
          <Link to="/privacy">{t('publicPages.footer.privacy', { defaultValue: 'Конфиденциальность' })}</Link>
          <Link to="/terms">{t('publicPages.footer.terms', { defaultValue: 'Условия использования' })}</Link>
          <Link to="/security">{t('publicPages.footer.security', { defaultValue: 'Безопасность' })}</Link>
        </span>
        <span>{FT.data}</span>
      </div>
    </footer>
  );
};
