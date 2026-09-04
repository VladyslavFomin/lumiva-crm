import React from 'react';

export const TG_ICON = {
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  x: <><path d="M6 6l12 12" /><path d="M6 18L18 6" /></>,
  check: <path d="M5 12l4 4 10-10" />,
  chevR: <path d="M9 6l6 6-6 6" />,
  more: <><circle cx="6" cy="12" r="1.5" fill="currentColor" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /><circle cx="18" cy="12" r="1.5" fill="currentColor" /></>,
  flag: <><path d="M4 3v18" /><path d="M4 4h13l-2.5 4L17 12H4" /></>,
  copy: <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 012-2h10" /></>,
  doc: <><path d="M6 2h9l3 3v17H6z" /><path d="M15 2v3h3" /></>,
  bolt: <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />,
  trash: <><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" /></>,
  send: <><path d="M21 4L3 11l6 3 3 6 9-16z" /><path d="M9 14l4-4" /></>,
  bot: <><rect x="4" y="8" width="16" height="12" rx="3" /><path d="M12 4v4" /><circle cx="9" cy="14" r="1.2" fill="currentColor" /><circle cx="15" cy="14" r="1.2" fill="currentColor" /><path d="M2 13v3" /><path d="M22 13v3" /></>,
  msg: <><rect x="3" y="4" width="18" height="14" rx="3" /><path d="M8 20l3-2h5" /></>,
  buttons: <><rect x="3" y="5" width="18" height="6" rx="2" /><rect x="3" y="14" width="10" height="5" rx="2" /></>,
  ask: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 015 0c0 1.8-2.5 1.9-2.5 3.5" /><path d="M12 17v.01" /></>,
  ai: <><path d="M12 3v3" /><path d="M12 18v3" /><path d="M4 12H1" /><path d="M23 12h-3" /><rect x="6" y="6" width="12" height="12" rx="3" /><circle cx="12" cy="12" r="2" /></>,
  cond: <><path d="M12 3v6" /><path d="M12 9l-6 6v6" /><path d="M12 9l6 6v6" /></>,
  crm: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18" /><path d="M9 10v10" /></>,
  human: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-4 3-7 7-7s7 3 7 7" /></>,
  delay: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  hook: <><path d="M8 6l-6 6 6 6" /><path d="M16 6l6 6-6 6" /><path d="M14 4l-4 16" /></>,
  pay: <><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M2 10h20" /><path d="M6 15h4" /></>,
  file: <><path d="M6 2h9l3 3v17H6z" /><path d="M15 2v3h3" /></>,
  broadcast: <><path d="M4 11a8 8 0 0116 0" /><path d="M7.5 13a4.5 4.5 0 019 0" /><circle cx="12" cy="17" r="1.5" fill="currentColor" /></>,
  shield: <path d="M12 2l8 3v7c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V5l8-3z" />,
  refresh: <><path d="M21 12a9 9 0 01-15 6.7L3 16" /><path d="M3 12a9 9 0 0115-6.7L21 8" /><path d="M3 21v-5h5" /><path d="M21 3v5h-5" /></>,
  link: <><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7L11 7" /><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7L13 17" /></>,
  book: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8" /><path d="M8 12h8" /><path d="M8 16h5" /></>,
  eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" /><circle cx="12" cy="12" r="3" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2 20c0-4 3-7 7-7s7 3 7 7" /><path d="M16 4.5a3.5 3.5 0 010 7" /><path d="M22 20c0-2.6-1.4-4.8-3.5-6" /></>,
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
