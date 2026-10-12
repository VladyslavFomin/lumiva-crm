import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { auraApi, AURA_MENU_CHANGED_EVENT, type AuraCustomWidget, type AuraData, type AuraFilters, type AuraPeriod } from '../../api/aura';
import { AU_EMPTY, type AuDraft } from './auraModel';
import './aura.css';

/* Шрифты тем дашборда — неблокирующей ссылкой (не @import в CSS: тот задерживает показ ленивой страницы). */
const AURA_FONTS =
  'https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Condensed:wght@500;600&family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap';
if (typeof document !== 'undefined' && !document.querySelector('link[data-aura-fonts]')) {
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = AURA_FONTS;
  l.setAttribute('data-aura-fonts', '');
  document.head.appendChild(l);
}

/* ---------- иконки (из макета) ---------- */

export const AU_I = {
  send: (
    <>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  open: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4l-8 8" />
      <path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" />
    </>
  ),
  edit: <path d="M4 20h4L19 9l-4-4L4 16z" />,
  x: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </>
  ),
  check: <path d="M5 12l5 5 9-10" />,
  back: <path d="M15 6l-6 6 6 6" />,
  aura: (
    <>
      <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
    </>
  ),
  full: (
    <>
      <path d="M4 9V4h5" />
      <path d="M20 9V4h-5" />
      <path d="M4 15v5h5" />
      <path d="M20 15v5h-5" />
    </>
  ),
  panel: (
    <>
      <path d="M9 4v16" />
      <rect x="3" y="4" width="18" height="16" rx="1" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M10 11v6M14 11v6" />
      <path d="M6 7l1 13h10l1-13M9 7V4h6v3" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11a8 8 0 10-2.3 5.7" />
      <path d="M20 4v7h-7" />
    </>
  ),
};

export function AuIc({ d, size = 16, sw = 1.6 }: { d: React.ReactNode; size?: number; sw?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {d}
    </svg>
  );
}

/* ---------- черновик (localStorage, общий для страниц мастера) ---------- */

const DRAFT_KEY = 'lumiva_aura_draft_v1';
let draftState: AuDraft = (() => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? { ...AU_EMPTY, ...JSON.parse(raw) } : AU_EMPTY;
  } catch {
    return AU_EMPTY;
  }
})();
const listeners = new Set<() => void>();

export function setAuraDraft(next: AuDraft | ((p: AuDraft) => AuDraft)) {
  draftState = typeof next === 'function' ? (next as (p: AuDraft) => AuDraft)(draftState) : next;
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draftState));
  } catch {
    /* приватный режим — черновик живёт до перезагрузки */
  }
  listeners.forEach((l) => l());
}

export function useAuraDraft(): [AuDraft, typeof setAuraDraft] {
  const d = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => draftState,
  );
  return [d, setAuraDraft];
}

/* ---------- данные ---------- */

const cache = new Map<string, { at: number; data: AuraData }>();
const inflight = new Map<string, Promise<AuraData>>();
const CACHE_MS = 60_000;

function load(key: string, fetcher: () => Promise<AuraData>, force = false): Promise<AuraData> {
  const hit = cache.get(key);
  if (!force && hit && Date.now() - hit.at < CACHE_MS) return Promise.resolve(hit.data);
  const running = inflight.get(key);
  if (running && !force) return running;
  const p = fetcher()
    .then((data) => {
      cache.set(key, { at: Date.now(), data });
      return data;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** Загрузка с кэшем, автообновлением и сохранением прошлых данных на время перезапроса. */
export function useAuraFetch(key: string | null, fetcher: () => Promise<AuraData>, refreshSec?: number) {
  const { t } = useTranslation();
  const [data, setData] = useState<AuraData | null>(() => (key ? cache.get(key)?.data ?? null : null));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchRef = useRef(fetcher);
  fetchRef.current = fetcher;
  const run = useCallback(
    (force = false) => {
      if (!key) return;
      setLoading(true);
      load(key, () => fetchRef.current(), force)
        .then((d) => {
          setData(d);
          setError(null);
        })
        .catch((e: Error) => setError(e?.message || t('crm.aura.err.load')))
        .finally(() => setLoading(false));
    },
    [key, t],
  );
  useEffect(() => {
    run(false);
  }, [run]);
  useEffect(() => {
    if (!key || !refreshSec) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') run(true);
    }, refreshSec * 1000);
    return () => window.clearInterval(id);
  }, [key, refreshSec, run]);
  return { data, loading, error, reload: () => run(true) };
}

export function useAuraPreview(
  input: { widgets: string[]; period: AuraPeriod; breakdown?: string[]; goals?: { team_goal?: number | null }; custom?: AuraCustomWidget[] } | null,
  filters?: AuraFilters,
  refreshSec?: number,
) {
  const key = input && input.widgets.length ? `p:${JSON.stringify([input.widgets.slice().sort(), input.period, input.breakdown || [], input.goals?.team_goal || null, filters || {}, input.custom || []])}` : null;
  return useAuraFetch(
    key,
    () => auraApi.previewData({ widgets: input!.widgets, period: input!.period, breakdown: (input!.breakdown || []) as any, goals: input!.goals, custom: input!.custom || [] }, input!.period, filters),
    refreshSec,
  );
}

export function useAuraAppData(appId: string | null, period: AuraPeriod | null, filters: AuraFilters, refreshSec?: number) {
  const key = appId && period ? `a:${appId}:${period}:${JSON.stringify(filters)}` : null;
  return useAuraFetch(key, () => auraApi.appData(appId!, period!, filters), refreshSec);
}

/** Сбросить кэш (после сохранения приложения). */
export function auraInvalidate() {
  cache.clear();
  window.dispatchEvent(new Event(AURA_MENU_CHANGED_EVENT));
}

/* ---------- обёртка страниц Aura внутри CRM ---------- */

export function AuraShell({ children, route, flush }: { children: React.ReactNode; route: string; flush?: boolean }) {
  return (
    <MainLayout fullBleed>
      <div className={'aura au-content au-r-' + route + (flush ? ' au-flush' : '')}>{children}</div>
    </MainLayout>
  );
}

/** Относительное время обновления. */
export function useAgo() {
  const { t, i18n } = useTranslation();
  return (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.round(diff / 60000);
    if (min < 1) return t('crm.aura.ago.now');
    if (min < 60) return t('crm.aura.ago.min', { count: min });
    const h = Math.round(min / 60);
    if (h < 24) return t('crm.aura.ago.hour', { count: h });
    return new Date(iso).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' });
  };
}

/** Появление при прокрутке (.au-rv → .in), как в макете. Глобальный наблюдатель: контент страниц
 * монтируется позже эффектов (MainLayout сначала грузит права), поэтому следим за всем документом. */
let revealReady = false;
function initReveal() {
  if (revealReady || typeof window === 'undefined') return;
  revealReady = true;
  if (!('IntersectionObserver' in window)) {
    document.documentElement.classList.add('au-rv-off');
    return;
  }
  const io = new IntersectionObserver(
    (es) =>
      es.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      }),
    { threshold: 0.12 },
  );
  const scan = () =>
    document.querySelectorAll('.au-rv:not(.in):not([data-rv])').forEach((el) => {
      el.setAttribute('data-rv', '');
      io.observe(el);
    });
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  scan();
}

export function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => initReveal(), []);
  return ref;
}

/** Высота «до низа окна» для экранов-приложений (бриф, редактор): над ними могут быть баннеры CRM. */
export function useFitHeight<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      if (window.innerWidth <= 1100) {
        el.style.removeProperty('--au-fit');
        return;
      }
      const top = el.getBoundingClientRect().top + (el.closest('[class*="overflow"]')?.scrollTop || 0);
      el.style.setProperty('--au-fit', `${Math.max(480, window.innerHeight - Math.max(0, top))}px`);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(document.body);
    window.addEventListener('resize', fit);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, []);
  return ref;
}
