import React from 'react';

export const HD_ICON = {
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  x: <><path d="M6 6l12 12" /><path d="M6 18L18 6" /></>,
  check: <path d="M5 12l4 4 10-10" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.5-4.5" /></>,
  flag: <><path d="M5 21V4" /><path d="M5 4h12l-2 4 2 4H5" /></>,
  staff: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-4 3-7 7-7s7 3 7 7" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="1.5" /><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3" /></>,
  doc: <><path d="M6 2h9l3 3v17H6z" /><path d="M15 2v3h3" /><path d="M9 12h6" /><path d="M9 16h6" /></>,
  email: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
  chat: <><path d="M21 12a8 8 0 11-3-6.2L21 5l-1 4" /><path d="M21 12a8 8 0 01-12 7l-5 1 1-4" /></>,
  telegram: <path d="M22 3L2 11l6 2.5M22 3L15.5 21l-5-6.5M22 3L8.5 14.5m0 0V20l3-3" />,
  whatsapp: <><path d="M4 20l1.4-4.1A8 8 0 1112 20a8 8 0 01-4-1.1z" /><path d="M8.5 9.5c0 3.5 3 6.5 6.5 6.5" /></>,
  sms: <><rect x="3" y="5" width="18" height="13" rx="2" /><path d="M8 21l3-3h6" /><path d="M7 9h10M7 12.5h6" /></>,
  building: <><rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1" /></>,
};

export const CHANNEL_ICON: Record<string, React.ReactNode> = {
  portal: HD_ICON.chat,
  email: HD_ICON.email,
  telegram: HD_ICON.telegram,
  whatsapp: HD_ICON.whatsapp,
  sms: HD_ICON.sms,
  internal: HD_ICON.building,
};

export const Ic: React.FC<{ d: React.ReactNode; size?: number; sw?: number; style?: React.CSSProperties; className?: string }> = ({
  d,
  size = 14,
  sw = 1.7,
  style,
  className,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={style} className={className}>
    {d}
  </svg>
);
