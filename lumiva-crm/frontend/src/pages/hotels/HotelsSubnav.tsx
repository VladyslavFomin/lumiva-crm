import React from 'react';
import { useNavigate } from 'react-router-dom';

type SubnavKey = 'overview' | 'hotels' | 'reservations' | 'frontdesk' | 'pricing' | 'calendar' | 'analytics';

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
};

export const HotelsSubnav: React.FC<{ active: SubnavKey }> = ({ active }) => {
  const navigate = useNavigate();

  const items: Array<{ key: SubnavKey; label: string; path: string }> = [
    { key: 'overview', label: 'Обзор', path: '/hotels' },
    { key: 'hotels', label: 'Отели', path: '/hotels/list' },
    { key: 'reservations', label: 'Брони', path: '/hotels/reservations' },
    { key: 'frontdesk', label: 'Сегодня', path: '/hotels/frontdesk' },
    { key: 'pricing', label: 'Цены и рынки', path: '/hotels/pricing' },
    { key: 'calendar', label: 'Календарь номеров', path: '/hotels/calendar' },
    { key: 'analytics', label: 'Аналитика', path: '/hotels/analytics' },
  ];

  return (
    <div className="px-subnav">
      {items.map((item) => (
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
