// src/pages/deduplication/DuplicatesIcons.tsx
import React from 'react';

export const Ic: React.FC<{ d: React.ReactNode; size?: number; sw?: number; className?: string; style?: React.CSSProperties }> = ({
  d,
  size = 16,
  sw = 1.6,
  className,
  style,
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
    style={style}
    aria-hidden="true"
  >
    {typeof d === 'string' ? <path d={d} /> : d}
  </svg>
);

export const UIC: Record<string, React.ReactNode> = {
  merge: (
    <>
      <path d="M6 3v6a6 6 0 006 6h6" />
      <path d="M15 12l3 3-3 3" />
    </>
  ),
  scan: (
    <>
      <path d="M3 7V5a2 2 0 012-2h2" />
      <path d="M17 3h2a2 2 0 012 2v2" />
      <path d="M21 17v2a2 2 0 01-2 2h-2" />
      <path d="M7 21H5a2 2 0 01-2-2v-2" />
      <path d="M3 12h18" />
    </>
  ),
  phone: <path d="M4 4h4l2 5-2.5 1.5a11 11 0 005 5L14 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />,
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-4 3-7 7-7s7 3 7 7" />
    </>
  ),
  company: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="1.5" />
      <path d="M9 8h2" />
      <path d="M13 8h2" />
      <path d="M9 12h2" />
      <path d="M9 16h6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  shield: <path d="M12 2l8 3v7c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V5l8-3z" />,
  wand: (
    <>
      <path d="M15 4V2" />
      <path d="M15 10V8" />
      <path d="M12 6h-2" />
      <path d="M20 6h-2" />
      <path d="M3 21l12-12" />
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
  download: (
    <>
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M4 21h16" />
    </>
  ),
};

/** Match-reason key (as stored on DuplicatePair.reasons) → icon in UIC above. */
export const REASON_ICON: Record<string, keyof typeof UIC> = {
  phone: 'phone',
  email: 'mail',
  name: 'user',
  name_company: 'user',
  fuzzy_name: 'wand',
  company_name: 'company',
  external_id: 'company',
  order_no: 'company',
  same_stay: 'clock',
};
