import React from 'react';

export { Ic } from './EmailSettingsIcons';

export const NI_ICON = {
  inbox: <><path d="M3 13h5l1.5 3h5L16 13h5" /><path d="M3 13l3-8h12l3 8v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></>,
  send: <><path d="M4 12l16-7-7 16-2.5-6.5z" /></>,
  draft: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></>,
  star: <><path d="M12 4l2.3 5 5.7.6-4.3 3.8 1.3 5.6L12 16.2 7 19l1.3-5.6L4 9.6 9.7 9z" /></>,
  arch: <><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" /><path d="M10 12h4" /></>,
  trash: <><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" /></>,
  spam: <><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></>,
  clip: <><path d="M20.5 11.5 12.3 19.7a4.8 4.8 0 0 1-6.8-6.8l8.2-8.2a3.2 3.2 0 0 1 4.5 4.5l-8.2 8.2a1.6 1.6 0 0 1-2.2-2.2l7.5-7.5" /></>,
  reply: <><path d="M9 8 4 12l5 4" /><path d="M4 12h9a6 6 0 0 1 6 6v2" /></>,
  replyAll: <><path d="M8 8 3 12l5 4" /><path d="M13 8l-5 4 5 4" /><path d="M8 12h7a5 5 0 0 1 5 5v2" /></>,
  fwd: <><path d="M15 8l5 4-5 4" /><path d="M20 12h-9a6 6 0 0 0-6 6v2" /></>,
  refresh: <><path d="M20 11A8 8 0 0 0 6.3 6.3L4 8.5" /><path d="M4 4v4.5h4.5" /><path d="M4 13a8 8 0 0 0 13.7 4.7L20 15.5" /><path d="M20 20v-4.5h-4.5" /></>,
  user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-4 3-7 7-7s7 3 7 7" /></>,
  deal: <><path d="M3 7h18v12H3z" /><path d="M8 7V5h8v2" /><path d="M3 12h18" /></>,
  bolt: <><path d="M13 3L5 14h6l-1 7 8-11h-6z" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  file: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></>,
  task: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></>,
  sparkle: <><path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6z" /></>,
  cal: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  folder: <><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></>,
  more: <><circle cx="6" cy="12" r="1.5" fill="currentColor" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /><circle cx="18" cy="12" r="1.5" fill="currentColor" /></>,
  chevL: <path d="M15 6l-6 6 6 6" />,
};

export const NI = NI_ICON;
