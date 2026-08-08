import React from 'react';

export const ESN_ICON = {
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  x: <><path d="M6 6l12 12" /><path d="M6 18L18 6" /></>,
  check: <path d="M5 12l4 4 10-10" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.5-4.5" /></>,
  doc: <><path d="M6 2h9l3 3v17H6z" /><path d="M15 2v3h3" /><path d="M9 12h6" /><path d="M9 16h6" /></>,
  sign: <><path d="M3 17c2-4 3-6 5-6s2 4 4 4 2.5-5 4.5-5 1.5 3 3.5 3" /><path d="M4 21h16" /></>,
  email: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
  download: <><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M4 21h16" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="1.5" /><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3" /></>,
  trash: <><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" /></>,
  pencil: <><path d="M4 20h4l10-10-4-4L4 16z" /><path d="M14 6l4 4" /></>,
  link: <><path d="M9 15l6-6" /><path d="M13 5l1.5-1.5a3.5 3.5 0 015 5L18 10" /><path d="M11 19l-1.5 1.5a3.5 3.5 0 01-5-5L6 14" /></>,
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
