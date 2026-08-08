import React from 'react';
import { useNavigate } from 'react-router-dom';

type SubnavKey =
  | 'overview'
  | 'reservations'
  | 'waitlist'
  | 'resources'
  | 'locations'
  | 'services'
  | 'availability'
  | 'analytics'
  | 'logs'
  | 'roles'
  | 'settings';

const ICONS: Record<SubnavKey, React.ReactNode> = {
  overview: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  reservations: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18" /><path d="M8 3v4" /><path d="M16 3v4" />
    </svg>
  ),
  waitlist: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="12" cy="12" r="9" /><path d="M9 12h6" /><path d="M12 9v6" />
    </svg>
  ),
  resources: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="5" y="3" width="14" height="18" rx="1" /><circle cx="14.5" cy="12" r="1" />
    </svg>
  ),
  locations: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  ),
  services: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M8.5 8.5L20 20" /><path d="M20 4L8.5 15.5" />
    </svg>
  ),
  availability: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
    </svg>
  ),
  analytics: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M3 3v18h18" /><path d="M7 15l4-5 3 3 5-7" />
    </svg>
  ),
  logs: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4 4h16v16H4z" /><path d="M8 9h8" /><path d="M8 13h8" /><path d="M8 17h5" />
    </svg>
  ),
  settings: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  ),
  roles: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M12 3l8 4v5c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V7z" />
    </svg>
  ),
};

export const BookingsSubnav: React.FC<{ active: SubnavKey }> = ({ active }) => {
  const navigate = useNavigate();

  const items: Array<{ key: SubnavKey; label: string; path: string }> = [
    { key: 'overview', label: 'Обзор', path: '/bookings' },
    { key: 'reservations', label: 'Брони', path: '/bookings/reservations' },
    { key: 'waitlist', label: 'Лист ожидания', path: '/bookings/waitlist' },
    { key: 'resources', label: 'Кабинеты', path: '/bookings/resources' },
    { key: 'locations', label: 'Локации', path: '/bookings/locations' },
    { key: 'services', label: 'Услуги', path: '/bookings/services' },
    { key: 'availability', label: 'Расписание', path: '/bookings/availability' },
    { key: 'analytics', label: 'Аналитика', path: '/bookings/analytics' },
    { key: 'logs', label: 'Логи', path: '/bookings/logs' },
    { key: 'roles', label: 'Роли и доступ', path: '/staff/permissions' },
    { key: 'settings', label: 'Настройки', path: '/bookings/settings' },
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
