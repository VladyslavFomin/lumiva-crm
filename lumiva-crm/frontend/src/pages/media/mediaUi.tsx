// src/pages/media/mediaUi.tsx — иконки и мелкие элементы «Медиа» (порт components/media-data.jsx)
import React from 'react';
import type { MediaFile, MediaShareFile } from '../../api/media';
import { mediaUrl } from '../../api/media';

export const MIC = {
  folder: <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />,
  folderUp: <><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><path d="M12 16v-5" /><path d="M9.5 13.5L12 11l2.5 2.5" /></>,
  folderPlus: <><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><path d="M12 11v5" /><path d="M9.5 13.5h5" /></>,
  upload: <><path d="M12 16V4" /><path d="M7 9l5-5 5 5" /><path d="M4 20h16" /></>,
  dl: <><path d="M12 4v12" /><path d="M7 11l5 5 5-5" /><path d="M4 20h16" /></>,
  link: <><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  list: <><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" /></>,
  lock: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  building: <><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M9 7h1" /><path d="M14 7h1" /><path d="M9 11h1" /><path d="M14 11h1" /><path d="M10 21v-4h4v4" /></>,
  hotel: <><path d="M3 21V8l9-5 9 5v13" /><path d="M9 21v-6h6v6" /></>,
  chevR: <path d="M9 6l6 6-6 6" />,
  chevL: <path d="M15 6l-6 6 6 6" />,
  check: <path d="M5 12l4 4 10-10" />,
  x: <><path d="M6 6l12 12" /><path d="M6 18L18 6" /></>,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="1.5" /><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3" /></>,
  ext: <><path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" /></>,
  trash: <><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" /></>,
  move: <><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><path d="M10 13h6" /><path d="M13.5 10.5L16 13l-2.5 2.5" /></>,
  form: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8" /><path d="M8 12h8" /><path d="M8 16h5" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.5-4.5" /></>,
  play: <path d="M7 4l13 8-13 8z" />,
  up: <path d="M6 15l6-6 6 6" />,
  down: <path d="M6 9l6 6 6-6" />,
  edit: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M14 6l4 4" /></>,
  drag: <><circle cx="9" cy="6" r="1" fill="currentColor" /><circle cx="9" cy="12" r="1" fill="currentColor" /><circle cx="9" cy="18" r="1" fill="currentColor" /><circle cx="15" cy="6" r="1" fill="currentColor" /><circle cx="15" cy="12" r="1" fill="currentColor" /><circle cx="15" cy="18" r="1" fill="currentColor" /></>,
  zip: <><path d="M6 2h9l5 5v15H6z" /><path d="M11 2v2" /><path d="M11 6v2" /><path d="M11 10v2" /><rect x="9.5" y="14" width="3" height="4" rx=".5" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M3 20c0-3 3-5.5 6-5.5s6 2.5 6 5.5" /><circle cx="17" cy="9" r="2.5" /><path d="M15 14.5c2.5 0 5 1.5 5 4" /></>,
  layers: <><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></>,
  dots: <><circle cx="5" cy="12" r="1.2" fill="currentColor" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /><circle cx="19" cy="12" r="1.2" fill="currentColor" /></>,
};

export const Ic: React.FC<{ d: React.ReactNode; size?: number; sw?: number }> = ({ d, size = 14, sw = 1.6 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d}
  </svg>
);

export const cx = (...a: Array<string | false | null | undefined>) => a.filter(Boolean).join(' ');

export function fmtBytes(n: number, lang: string): string {
  const u = lang === 'en' ? ['B', 'KB', 'MB', 'GB', 'TB'] : lang === 'tr' ? ['B', 'KB', 'MB', 'GB', 'TB'] : ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];
  let i = 0;
  let v = Number(n) || 0;
  while (v >= 1000 && i < u.length - 1) { v /= 1024; i++; }
  const s = i === 0 ? String(Math.round(v)) : v.toFixed(v >= 100 ? 0 : 1);
  return `${lang === 'en' ? s : s.replace('.', ',')} ${u[i]}`;
}

export const fmtNum = (n: number, lang: string) => (Number(n) || 0).toLocaleString(lang === 'en' ? 'en-US' : lang === 'tr' ? 'tr-TR' : 'ru-RU');

export function fmtDur(sec: number | null | undefined): string | null {
  if (!sec) return null;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function fmtDate(d: string | Date | null | undefined, lang: string, withTime = false): string {
  if (!d) return '—';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '—';
  const loc = lang === 'en' ? 'en-GB' : lang === 'tr' ? 'tr-TR' : 'ru-RU';
  return x.toLocaleString(loc, withTime ? { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export const dims = (f: { width: number | null; height: number | null; kind: string }) => (f.width && f.height ? `${f.width} × ${f.height}` : f.kind === 'pdf' ? 'PDF' : '—');

type AnyFile = Pick<MediaFile | MediaShareFile, 'kind' | 'ext' | 'thumbUrl' | 'durationSec' | 'name'>;

/** Превью: миниатюра (сделана браузером при загрузке) или заглушка по типу — как в макете. */
export const Thumb: React.FC<{ f: AnyFile; local?: string | null }> = ({ f, local }) => {
  const src = local || mediaUrl(f.thumbUrl);
  const svg = f.ext === 'svg';
  return (
    <div className={cx('mf-th', 'k-' + f.kind, svg && 'fit')}>
      {src ? <img src={src} alt="" loading="lazy" draggable={false} /> : f.kind === 'pdf' ? (
        <span className="pg"><i /><i /><i /><b>PDF</b></span>
      ) : (
        <span className="ext">{(f.ext || '').toUpperCase()}</span>
      )}
      {f.kind === 'video' && <span className="play"><Ic d={MIC.play} size={12} /></span>}
      {f.kind === 'video' && fmtDur(f.durationSec) && <span className="dur">{fmtDur(f.durationSec)}</span>}
    </div>
  );
};

export const FolderGlyph: React.FC<{ n: number; shared?: boolean }> = ({ n, shared }) => (
  <div className="mf-fg">
    <div className="tab" />
    <div className="body">
      <span className="n">{n}</span>
      {shared && <span className="sh"><Ic d={MIC.link} size={13} /></span>}
    </div>
  </div>
);

export const Sw: React.FC<{ on: boolean; set?: (v: boolean) => void; dis?: boolean; label?: string }> = ({ on, set, dis, label }) => (
  <span
    role="switch"
    aria-checked={on}
    aria-label={label}
    tabIndex={dis ? -1 : 0}
    className={cx('sw', on && 'on', dis && 'dis')}
    onClick={(e) => { e.stopPropagation(); if (!dis && set) set(!on); }}
    onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !dis && set) { e.preventDefault(); set(!on); } }}
  >
    <i />
  </span>
);

export const Spark: React.FC<{ d: number[]; w?: number; h?: number }> = ({ d, w = 90, h = 26 }) => {
  const m = Math.max(1, ...d);
  const pts = d.map((v, i) => `${(i / Math.max(1, d.length - 1)) * w},${h - 2 - (v / m) * (h - 4)}`).join(' ');
  return (
    <svg width={w} height={h} className="mf-spark" aria-hidden>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
};

export async function copyText(s: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(s);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = s;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}
