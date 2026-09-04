import React from 'react';

export const SL_ICON = {
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></>,
  bolt: <><path d="M13 3L5 14h6l-1 7 8-11h-6z" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  down: <><path d="M12 4v12M7 12l5 5 5-5" /><path d="M4 20h16" /></>,
  bag: <><path d="M5 8h14l-1 12H6z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>,
  ext: <><path d="M14 4h6v6" /><path d="M20 4l-8 8" /><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" /></>,
  cols: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16M15 4v16" /></>,
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
