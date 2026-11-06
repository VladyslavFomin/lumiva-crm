import React from 'react';
import type { Autonomy, Network, PostStatus, VariantStatus } from '../../api/content';

/** Монохромные значки сетей (цвет — только у статусов, см. md/design-system.md). */
const NET_PATH: Record<Network, React.ReactNode> = {
  instagram: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  facebook: <path d="M14.5 8H16V4.5h-2.3C11.2 4.5 10 6 10 8.4V10H8v3.4h2V20h3.5v-6.6h2.3l.4-3.4h-2.7V8.8c0-.5.3-.8 1-.8Z" />,
  telegram: <path d="M21 4 3 11l5.6 2.1L19 7l-7.9 7.4V20l3.1-3.4 3.8 2.8L21 4Z" />,
  linkedin: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
      <path d="M8 10.5V16M8 7.8v.1M11.5 16v-3.2c0-1.4.9-2.3 2-2.3s1.8.8 1.8 2.3V16M11.5 10.5V16" />
    </>
  ),
  threads: <path d="M16.6 11.3c-.1 0-.2-.1-.3-.1-.2-2.9-1.8-4.6-4.5-4.6-1.6 0-3 .7-3.8 2l1.5 1c.6-.9 1.5-1.1 2.3-1.1 1 0 1.7.3 2.1.9.3.4.5 1 .6 1.7-.8-.1-1.6-.2-2.5-.1-2.5.1-4.1 1.6-4 3.6.1 1 .6 1.9 1.4 2.4.7.5 1.6.7 2.5.6 1.2-.1 2.2-.5 2.8-1.4.5-.7.8-1.5 1-2.6.6.4 1 .8 1.3 1.4.4 1 .4 2.6-.9 3.9-1.1 1.1-2.5 1.6-4.6 1.6-2.3 0-4.1-.8-5.2-2.2-1.1-1.4-1.6-3.3-1.7-5.8.1-2.5.6-4.4 1.7-5.8 1.1-1.5 2.9-2.2 5.2-2.2 2.3 0 4.1.8 5.3 2.2.6.7 1 1.6 1.3 2.6l1.8-.5c-.4-1.3-.9-2.4-1.7-3.3C17.3 3.3 15 2.3 12.1 2.3c-2.9 0-5.1.9-6.6 2.8C4.1 6.8 3.4 9.1 3.4 12s.7 5.2 2.1 6.9c1.5 1.9 3.7 2.8 6.6 2.8 2.6 0 4.4-.7 5.9-2.1 2-2 1.9-4.4 1.3-5.9-.5-1.1-1.4-1.9-2.7-2.4Zm-4.4 4.2c-1 .1-2-.4-2.1-1.3 0-.7.5-1.4 2.1-1.5h.6c.6 0 1.2.1 1.7.2-.2 2.2-1.2 2.6-2.3 2.6Z" />,
  youtube: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="3.5" />
      <path d="M10 9.2v5.6l4.8-2.8L10 9.2Z" fill="currentColor" stroke="none" />
    </>
  ),
  tiktok: <path d="M14 3.5v11a3.5 3.5 0 1 1-3.5-3.5M14 3.5c.4 2.4 2 4 4.5 4.3" />,
  vk: <path d="M3.5 7.5h3c.3 2.6 1.6 5 3 5.6V7.5h2.8v3c1.3-.2 2.6-1.7 3.1-3h2.8c-.4 1.8-1.8 3.5-3 4.2 1.2.6 2.8 2 3.4 4.3h-3c-.6-1.5-1.9-2.8-3.3-3V16H11c-4 0-7.2-3-7.5-8.5Z" />,
};

export const NetIcon: React.FC<{ network: Network; size?: number }> = ({ network, size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {NET_PATH[network]}
  </svg>
);

export const NET_NAME: Record<Network, string> = { instagram: 'Instagram', facebook: 'Facebook', telegram: 'Telegram', linkedin: 'LinkedIn', vk: 'VK', threads: 'Threads', youtube: 'YouTube', tiktok: 'TikTok' };

/** Цвет статуса — из палитры статусов дизайн-системы. */
export const POST_STATUS_TONE: Record<PostStatus, 'neutral' | 'info' | 'warn' | 'ok' | 'err'> = {
  draft: 'neutral',
  review: 'warn',
  changes: 'warn',
  approved: 'info',
  scheduled: 'info',
  published: 'ok',
  partial: 'warn',
  failed: 'err',
  rejected: 'err',
};
export const VARIANT_STATUS_TONE: Record<VariantStatus, 'neutral' | 'info' | 'warn' | 'ok' | 'err'> = {
  pending: 'neutral',
  scheduled: 'info',
  publishing: 'warn',
  published: 'ok',
  failed: 'err',
  skipped: 'neutral',
};

export const Pill: React.FC<{ tone: 'neutral' | 'info' | 'warn' | 'ok' | 'err'; children: React.ReactNode }> = ({ tone, children }) => (
  <span className={`sc-pill t-${tone}`}>{children}</span>
);

export const AUTONOMY_ORDER: Autonomy[] = ['suggest', 'assisted', 'auto'];

export const fmtDateTime = (iso: string | null | undefined, locale: string) =>
  iso ? new Date(iso).toLocaleString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

/** ISO → значение для <input type="datetime-local"> в часовом поясе браузера. */
export const toLocalInput = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

export const localeOf = (lang: string) => (lang === 'tr' ? 'tr-TR' : lang === 'en' ? 'en-US' : 'ru-RU');

export const Ico: React.FC<{ d: string; size?: number }> = ({ d, size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

export const IC = {
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12l5 5L20 7',
  x: 'M6 6l12 12M18 6 6 18',
  spark: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z',
  image: 'M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9h.01',
  clock: 'M12 7v5l3 3M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  send: 'M21 4 3 11l7 3 3 7 8-17Z',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  link: 'M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
  edit: 'M12 20h9M16.5 3.5l4 4L7 21H3v-4L16.5 3.5Z',
  left: 'M15 18l-6-6 6-6',
  right: 'M9 18l6-6-6-6',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  plug: 'M9 7V3M15 7V3M7 7h10v4a5 5 0 0 1-10 0V7ZM12 16v5',
};
