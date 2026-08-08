import React from 'react';
import { useNavigate } from 'react-router-dom';

type SubnavKey = 'calls' | 'sms' | 'analytics' | 'settings';

const ICONS: Record<SubnavKey, React.ReactNode> = {
  calls: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4 4h4l2 5-2.5 1.5a11 11 0 005 5L14 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />
    </svg>
  ),
  sms: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M21 12a8 8 0 11-3-6.2L21 5l-1 4" /><path d="M21 12a8 8 0 01-12 7l-5 1 1-4" />
    </svg>
  ),
  analytics: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" />
    </svg>
  ),
  settings: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 00-.1-1.2l2-1.6-2-3.4-2.4.8a7 7 0 00-2.1-1.2L14 3h-4l-.4 2.4a7 7 0 00-2.1 1.2L5.1 5.8l-2 3.4 2 1.6A7 7 0 005 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-.8a7 7 0 002.1 1.2L10 21h4l.4-2.4a7 7 0 002.1-1.2l2.4.8 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" />
    </svg>
  ),
};

export const TelephonySubnav: React.FC<{ active: SubnavKey }> = ({ active }) => {
  const navigate = useNavigate();

  const items: Array<{ key: SubnavKey; label: string; path: string }> = [
    { key: 'calls', label: 'Звонки', path: '/telephony' },
    { key: 'sms', label: 'SMS', path: '/telephony/sms' },
    { key: 'analytics', label: 'Аналитика', path: '/telephony/analytics' },
    { key: 'settings', label: 'Настройки', path: '/telephony/settings' },
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
