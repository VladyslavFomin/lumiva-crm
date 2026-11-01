import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTenantComponents } from '../../hooks/useTenantComponents';

type SubnavKey = 'overview' | 'hotels' | 'reservations' | 'groups' | 'guests' | 'rack' | 'partners' | 'inventory' | 'guestRegister' | 'frontdesk' | 'housekeeping' | 'cashier' | 'nightAudit' | 'reports' | 'pricing' | 'calendar' | 'analytics' | 'reviews' | 'channels' | 'guestCare' | 'precheckin';

const ICONS: Record<SubnavKey, React.ReactNode> = {
  overview: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  hotels: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M3 21V9l9-6 9 6v12" /><path d="M9 21v-6h6v6" />
    </svg>
  ),
  reservations: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18" /><path d="M8 3v4" /><path d="M16 3v4" />
    </svg>
  ),
  groups: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="3" y="4" width="8" height="7" rx="1.5" /><rect x="13" y="4" width="8" height="7" rx="1.5" /><rect x="3" y="13" width="8" height="7" rx="1.5" /><rect x="13" y="13" width="8" height="7" rx="1.5" />
    </svg>
  ),
  precheckin: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h5" /><path d="M9 17l2 2 4-4" />
    </svg>
  ),
  guests: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7" /><path d="M18 14.8c2 .7 3.2 2.4 3.5 5.2" />
    </svg>
  ),
  rack: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 4v16" /><path d="M10.5 12.5h5M12.5 16h6" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  ),
  housekeeping: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4 20h16" /><path d="M6 20V10l6-5 6 5v10" /><path d="M10 20v-5h4v5" /><path d="M17 3l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" />
    </svg>
  ),
  cashier: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /><path d="M7 15h3" />
    </svg>
  ),
  nightAudit: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" /><path d="M14 9l1.5 1.5L18 8" />
    </svg>
  ),
  guestCare: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4 18h16M6 18a6 6 0 0112 0" /><path d="M12 9V7M10 7h4" />
    </svg>
  ),
  channels: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="5" cy="12" r="2.2" /><circle cx="19" cy="5" r="2.2" /><circle cx="19" cy="19" r="2.2" /><path d="M7 11l10-5M7 13l10 5" />
    </svg>
  ),
  reports: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  ),
  partners: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M16 4.5a3 3 0 010 6" /><path d="M18 14c2 .7 3 2.6 3 6" />
    </svg>
  ),
  inventory: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M3 14h18M9 4v16M15 4v16" />
    </svg>
  ),
  guestRegister: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="4" y="3" width="16" height="18" rx="2" /><circle cx="12" cy="10" r="2.6" /><path d="M8 17c.6-2 2.1-3 4-3s3.4 1 4 3" />
    </svg>
  ),
  frontdesk: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
    </svg>
  ),
  pricing: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M12 1v22" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  ),
  calendar: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18" /><path d="M8 3v4" /><path d="M16 3v4" />
      <path d="M8 15h.01" /><path d="M12 15h.01" /><path d="M16 15h.01" />
    </svg>
  ),
  analytics: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M3 3v18h18" /><path d="M7 15l4-5 3 3 5-7" />
    </svg>
  ),
  reviews: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" />
    </svg>
  ),
};

export const HotelsSubnav: React.FC<{ active: SubnavKey }> = ({ active }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isEnabled } = useTenantComponents();

  const items: Array<{ key: SubnavKey; label: string; path: string; component: string }> = [
    { key: 'overview', label: t('crm.hotels.nav.overview'), path: '/hotels', component: 'hotels' },
    { key: 'hotels', label: t('crm.hotels.nav.hotels'), path: '/hotels/list', component: 'hotels' },
    { key: 'reservations', label: t('crm.hotels.nav.reservations'), path: '/hotels/reservations', component: 'hotels_reservations' },
    { key: 'groups', label: t('crm.hotels.nav.groups'), path: '/hotels/groups', component: 'hotels_groups' },
    { key: 'guests', label: t('crm.hotels.nav.guests'), path: '/hotels/guests', component: 'hotels_guests' },
    { key: 'partners', label: t('crm.hotels.nav.partners'), path: '/hotels/partners', component: 'hotels_partners' },
    { key: 'inventory', label: t('crm.hotels.nav.inventory'), path: '/hotels/inventory', component: 'hotels_partners' },
    { key: 'rack', label: t('crm.hotels.nav.rack'), path: '/hotels/rack', component: 'hotels_rack' },
    { key: 'frontdesk', label: t('crm.hotels.nav.frontdesk'), path: '/hotels/frontdesk', component: 'hotels_frontdesk' },
    { key: 'housekeeping', label: t('crm.hotels.nav.housekeeping'), path: '/hotels/housekeeping', component: 'hotels_housekeeping' },
    { key: 'guestCare', label: t('crm.hotels.nav.guestCare'), path: '/hotels/guest-care', component: 'hotels_guest_care' },
    { key: 'precheckin', label: t('crm.hotels.nav.precheckin'), path: '/hotels/precheckin', component: 'hotels_precheckin' },
    { key: 'cashier', label: t('crm.hotels.nav.cashier'), path: '/hotels/cashier', component: 'hotels_cashier' },
    { key: 'nightAudit', label: t('crm.hotels.nav.nightAudit'), path: '/hotels/night-audit', component: 'hotels_cashier' },
    { key: 'guestRegister', label: t('crm.hotels.nav.guestRegister'), path: '/hotels/guest-register', component: 'hotels_guest_register' },
    { key: 'pricing', label: t('crm.hotels.nav.pricing'), path: '/hotels/pricing', component: 'hotels_pricing' },
    { key: 'calendar', label: t('crm.hotels.nav.calendar'), path: '/hotels/calendar', component: 'hotels_calendar' },
    { key: 'channels', label: t('crm.hotels.nav.channels'), path: '/hotels/channels', component: 'hotels_channels' },
    { key: 'reports', label: t('crm.hotels.nav.reports'), path: '/hotels/reports', component: 'hotels_analytics' },
    { key: 'analytics', label: t('crm.hotels.nav.analytics'), path: '/hotels/analytics', component: 'hotels_analytics' },
    { key: 'reviews', label: t('crm.hotels.nav.reviews'), path: '/hotels/reviews', component: 'hotels_reviews' },
  ];

  return (
    <div data-tour="hotels-subnav" className="px-subnav">
      {items.filter((item) => isEnabled('hotels') && isEnabled(item.component)).map((item) => (
        <button
          key={item.key}
          type="button"
          className={active === item.key ? 'active' : undefined}
          onClick={() => navigate(item.path)}
        >
          <span className="ic">{ICONS[item.key]}</span>
          {item.label}
        </button>
      ))}
    </div>
  );
};
