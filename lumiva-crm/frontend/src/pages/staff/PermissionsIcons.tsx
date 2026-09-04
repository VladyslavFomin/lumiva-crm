// src/pages/staff/PermissionsIcons.tsx
import React from 'react';

export const Ic: React.FC<{ d: React.ReactNode; size?: number; sw?: number; className?: string }> = ({
  d,
  size = 16,
  sw = 1.6,
  className,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {typeof d === 'string' ? <path d={d} /> : d}
  </svg>
);

export const PMIC: Record<string, React.ReactNode> = {
  shield: <path d="M12 2l8 3v7c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V5l8-3z" />,
  crown: (
    <>
      <path d="M3 18h18" />
      <path d="M4 8l4 4 4-8 4 8 4-4-2 8H6L4 8z" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 018 0v3" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2 20c0-4 3-7 7-7s7 3 7 7" />
      <path d="M16 4.5a3.5 3.5 0 010 7" />
      <path d="M22 20c0-2.6-1.4-4.8-3.5-6" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l9-9" />
      <path d="M17 3l3 3" />
      <path d="M14 6l3 3" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  money: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10" />
      <path d="M9.5 9.5h5" />
      <path d="M9.5 14h5" />
    </>
  ),
  bell: (
    <>
      <path d="M6 8a6 6 0 0112 0c0 7 3 8 3 8H3s3-1 3-8" />
      <path d="M10 21a2 2 0 004 0" />
    </>
  ),
  doc: (
    <>
      <path d="M6 2h9l3 3v17H6z" />
      <path d="M15 2v3h3" />
      <path d="M9 12h6" />
      <path d="M9 16h6" />
    </>
  ),
  export: (
    <>
      <path d="M12 15V3" />
      <path d="M7 8l5-5 5 5" />
      <path d="M4 21h16" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.5-4.5" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  check: <path d="M5 12l4 4 10-10" />,
  chev: <path d="M6 9l6 6 6-6" />,
  chevR: <path d="M9 6l6 6-6 6" />,
  flag: (
    <>
      <path d="M5 21V4" />
      <path d="M5 4h12l-2 4 2 4H5" />
    </>
  ),
  // module-row icons, ported verbatim from components/cabinet.jsx's ICON set for a 1:1
  // semantic match with the app's own sidebar icons
  leads: (
    <>
      <path d="M3 12c0-5 4-9 9-9s9 4 9 9-4 9-9 9" />
      <path d="M3 12l4-4" />
      <path d="M3 12l4 4" />
    </>
  ),
  projects: (
    <>
      <rect x="3" y="5" width="18" height="15" rx="2" />
      <path d="M3 9h18" />
      <path d="M9 5V3" />
      <path d="M15 5V3" />
    </>
  ),
  sales: (
    <>
      <path d="M4 7h16" />
      <path d="M6 7v11a2 2 0 002 2h8a2 2 0 002-2V7" />
      <path d="M9 7V5a3 3 0 016 0v2" />
    </>
  ),
  contacts: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20c0-3 3-5.5 6-5.5s6 2.5 6 5.5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M15 14.5c2.5 0 5 1.5 5 4" />
    </>
  ),
  companies: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="1.5" />
      <path d="M9 8h2" />
      <path d="M13 8h2" />
      <path d="M9 12h2" />
      <path d="M13 12h2" />
      <path d="M9 16h6" />
    </>
  ),
  marketing: (
    <>
      <path d="M3 11l16-7v16L3 13z" />
      <path d="M7 13v4a2 2 0 002 2" />
    </>
  ),
  email: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
  chat: (
    <>
      <path d="M21 12a8 8 0 11-3-6.2L21 5l-1 4" />
      <path d="M21 12a8 8 0 01-12 7l-5 1 1-4" />
    </>
  ),
  analytics: (
    <>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M22 20H2" />
    </>
  ),
  automations: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3" />
      <path d="M12 19v3" />
      <path d="M2 12h3" />
      <path d="M19 12h3" />
      <path d="M5 5l2 2" />
      <path d="M17 17l2 2" />
      <path d="M19 5l-2 2" />
      <path d="M7 17l-2 2" />
    </>
  ),
  settingsGear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 00-.1-1.2l2-1.6-2-3.4-2.4.8a7 7 0 00-2.1-1.2L14 3h-4l-.4 2.4a7 7 0 00-2.1 1.2L5.1 5.8l-2 3.4 2 1.6A7 7 0 005 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-.8a7 7 0 002.1 1.2L10 21h4l.4-2.4a7 7 0 002.1-1.2l2.4.8 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" />
    </>
  ),
  staffPeople: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-4 3-7 7-7s7 3 7 7" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 015 0c0 2-2.5 2-2.5 4" />
      <path d="M12 17v.01" />
    </>
  ),
  telegramPlane: (
    <>
      <path d="M21 4L3 11l5.5 2.5L11 20l3-4.5" />
      <path d="M8.5 13.5L20 5" />
      <path d="M8.5 13.5v4l2.5-2" />
    </>
  ),
  bookIc: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18" />
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <path d="M8 13h3" />
      <path d="M8 17h6" />
    </>
  ),
  hotel: (
    <>
      <path d="M3 21V8l9-5 9 5v13" />
      <path d="M9 21v-6h6v6" />
      <path d="M9 11h1" />
      <path d="M14 11h1" />
      <path d="M9 15h1" />
      <path d="M14 15h1" />
    </>
  ),
  phone: <path d="M4 4h4l2 5-2.5 1.5a11 11 0 005 5L14 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />,
  sign: (
    <>
      <path d="M3 17c2-4 3-6 5-6s2 4 4 4 2.5-5 4.5-5 1.5 3 3.5 3" />
      <path d="M4 21h16" />
    </>
  ),
  table: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <path d="M3 10h18" />
      <path d="M3 16h18" />
      <path d="M9 4v16" />
    </>
  ),
};

/** Base module key → icon in PMIC above, purely decorative (mirrors the sidebar's own icons). */
export const MODULE_ICON: Record<string, keyof typeof PMIC> = {
  leads: 'leads',
  sales: 'sales',
  contacts: 'contacts',
  notes: 'doc',
  companies: 'companies',
  products: 'table',
  bookings: 'bookIc',
  hotels: 'hotel',
  projects: 'projects',
  analytics: 'analytics',
  finance: 'money',
  chat: 'chat',
  helpdesk: 'help',
  esign: 'sign',
  email: 'email',
  marketing: 'marketing',
  telegram: 'telegramPlane',
  whatsapp: 'chat',
  telephony: 'phone',
  tools_automation: 'automations',
  custom_objects: 'table',
  staff: 'staffPeople',
  settings: 'settingsGear',
};
