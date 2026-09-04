import React from 'react';

export const EM_ICON = {
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
  inbox: <><path d="M3 13h5l1.5 3h5L16 13h5" /><path d="M3 13l3-8h12l3 8v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></>,
  refresh: <><path d="M20 11A8 8 0 0 0 6.3 6.3L4 8.5" /><path d="M4 4v4.5h4.5" /><path d="M4 13a8 8 0 0 0 13.7 4.7L20 15.5" /><path d="M20 20v-4.5h-4.5" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" /></>,
  warn: <><path d="M12 4 2.9 20h18.2z" /><path d="M12 10v4" /><path d="M12 17h.01" /></>,
  shield: <><path d="M12 3l8 3v5c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6z" /><path d="M9 12l2 2 4-4" /></>,
  pen: <><path d="M4 20h4L20 8l-4-4L4 16z" /><path d="M14 6l4 4" /></>,
  user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-4 3-7 7-7s7 3 7 7" /></>,
  key: <><circle cx="8" cy="14" r="4" /><path d="M11 11l8-8" /><path d="M15 3h4v4" /></>,
  bolt: <><path d="M13 3L5 14h6l-1 7 8-11h-6z" /></>,
  ext: <><path d="M14 4h6v6" /><path d="M20 4l-8 8" /><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" /></>,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  more: <><circle cx="6" cy="12" r="1.5" fill="currentColor" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /><circle cx="18" cy="12" r="1.5" fill="currentColor" /></>,
  trash: <><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" /></>,
  check: <><path d="M4 12.5l5 5L20 6.5" /></>,
  eye: <><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z" /><circle cx="12" cy="12" r="2.8" /></>,
  back: <><path d="M10 6l-6 6 6 6" /><path d="M4 12h16" /></>,
};

export const Ic: React.FC<{ d: React.ReactNode; size?: number; sw?: number; style?: React.CSSProperties }> = ({
  d,
  size = 14,
  sw = 1.6,
  style,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">
    {d}
  </svg>
);
