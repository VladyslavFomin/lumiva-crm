import React from 'react';

export const BI_ICON = {
  leads: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a8 8 0 0116 0v1" /></>,
  sales: <><path d="M3 3v18h18" /><path d="M7 15l4-5 3 3 5-7" /></>,
  products: <><path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></>,
  bookings: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18" /><path d="M8 3v4" /><path d="M16 3v4" /></>,
  hotels: <><path d="M3 21V7l6-4 6 4v14" /><path d="M15 21V11l6 3v7" /><path d="M9 9h.01M9 13h.01M9 17h.01" /></>,
  telephony: <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.362 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0122 16.92z" />,
  download: <><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M4 20h16" /></>,
  analytics: <><path d="M3 3v18h18" /><rect x="7" y="12" width="3" height="6" /><rect x="12" y="8" width="3" height="10" /><rect x="17" y="5" width="3" height="13" /></>,
  chevR: <path d="M9 6l6 6-6 6" />,
  chat: <><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></>,
  funnel: <path d="M3 4h18l-7 9v6l-4 2v-8z" />,
  companies: <><rect x="3" y="10" width="7" height="11" /><rect x="14" y="4" width="7" height="17" /><path d="M6 14h1M6 17h1M17 8h1M17 11h1M17 14h1" /></>,
  flag: <><path d="M5 3v18" /><path d="M5 4h13l-3 4.5L18 13H5" /></>,
  staff: <><circle cx="9" cy="7" r="4" /><path d="M2 21v-2a5 5 0 015-5h4a5 5 0 015 5v2" /><path d="M17 8a3 3 0 010 6" /><path d="M22 21v-2a4 4 0 00-3-3.87" /></>,
};

export const Ic: React.FC<{ d: React.ReactNode; size?: number; sw?: number; style?: React.CSSProperties }> = ({
  d,
  size = 14,
  sw = 1.7,
  style,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={style}>
    {d}
  </svg>
);
