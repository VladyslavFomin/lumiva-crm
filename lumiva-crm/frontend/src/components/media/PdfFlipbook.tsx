import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PageFlip } from 'page-flip/dist/js/page-flip.module.js';
import { openPdf, renderPage, type PdfDoc } from './pdfRender';
import './pdf-flipbook.css';

export interface PdfFlipbookLabels {
  book: string;
  scroll: string;
  prev: string;
  next: string;
  thumbs: string;
  fullscreen: string;
  exitFullscreen: string;
  zoomIn: string;
  zoomOut: string;
  loading: string;
  error: string;
  download: string;
  first: string;
  last: string;
  pageShort: string;
  search: string;
  searchPlaceholder: string;
  nothingFound: string;
  spread: string;
  singlePage: string;
}

type Mode = 'book' | 'scroll';
const MODE_KEY = 'lumiva-pdf-mode';
type Spread = 'auto' | 'on' | 'off';
const SPREAD_KEY = 'lumiva-pdf-spread';
const savedSpread = (): Spread => {
  try { const v = localStorage.getItem(SPREAD_KEY); return v === 'on' || v === 'off' ? v : 'auto'; } catch { return 'auto'; }
};
const savedMode = (): Mode => {
  try { return localStorage.getItem(MODE_KEY) === 'scroll' ? 'scroll' : 'book'; } catch { return 'book'; }
};

/**
 * PDF как журнал: «Книга» — развороты с анимацией перелистывания (StPageFlip; на узком экране — по одной странице,
 * листание свайпом / клавишами / кликом по краю), «Лента» — страницы одна под другой. Страницы рисует pdf.js в браузере
 * по мере перелистывания (соседние — заранее), файл подгружается частями. Миниатюры, переход к странице, полный экран.
 */
export const PdfFlipbook: React.FC<{ src: string; name: string; labels: PdfFlipbookLabels; onDownload?: () => void }> = ({ src, name, labels, onDownload }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const bookHostRef = useRef<HTMLDivElement>(null);
  const pfRef = useRef<PageFlip | null>(null);
  const pageEls = useRef<HTMLElement[]>([]);
  const cache = useRef(new Map<number, { url: string; width: number }>());
  const thumbCache = useRef(new Map<number, string>());
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [failed, setFailed] = useState(false);
  const [loadedMb, setLoadedMb] = useState(0);
  const [ratio, setRatio] = useState(1.414);
  const [pages, setPages] = useState(0);
  const [mode, setMode] = useState<Mode>(savedMode);
  const [page, setPage] = useState(0);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [landscape, setLandscape] = useState(false);
  const [spreadPref, setSpreadPref] = useState<Spread>(savedSpread);
  const [thumbsOpen, setThumbsOpen] = useState(false);
  const [fs, setFs] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [scrollImgs, setScrollImgs] = useState<Record<number, string>>({});
  const [thumbImgs, setThumbImgs] = useState<Record<number, string>>({});
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Array<{ page: number; snippet: string }> | null>(null);
  const [searching, setSearching] = useState(false);
  const texts = useRef(new Map<number, string>());

  // документ
  useEffect(() => {
    let alive = true;
    let loaded: PdfDoc | null = null;
    setDoc(null);
    setFailed(false);
    setLoadedMb(0);
    openPdf(src, (b) => alive && setLoadedMb(b / 1048576))
      .then(async (d) => {
        loaded = d;
        if (!alive) { void d.destroy(); return; }
        const p1 = await d.getPage(1);
        const vp = p1.getViewport({ scale: 1 });
        setRatio(vp.height / vp.width || 1.414);
        setPages(d.numPages);
        setDoc(d);
      })
      .catch(() => alive && setFailed(true));
    const c = cache.current;
    const tc = thumbCache.current;
    return () => {
      alive = false;
      for (const v of c.values()) URL.revokeObjectURL(v.url);
      for (const v of tc.values()) URL.revokeObjectURL(v);
      c.clear();
      tc.clear();
      if (loaded) void loaded.destroy();
    };
  }, [src]);

  // размер области просмотра
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStage({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setStage({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [thumbsOpen, fs]);

  // отрисовка по очереди: pdf.js не любит десятки страниц параллельно
  const ensure = useCallback((pageNo: number, width: number): Promise<string | null> => {
    if (!doc || pageNo < 1 || pageNo > doc.numPages) return Promise.resolve(null);
    const hit = cache.current.get(pageNo);
    if (hit && hit.width >= width * 0.9) return Promise.resolve(hit.url);
    const job = queue.current.then(async () => {
      const again = cache.current.get(pageNo);
      if (again && again.width >= width * 0.9) return again.url;
      const r = await renderPage(doc, pageNo, width);
      if (again) URL.revokeObjectURL(again.url);
      cache.current.set(pageNo, { url: r.url, width });
      return r.url;
    }).catch(() => null);
    queue.current = job;
    return job;
  }, [doc]);

  // ── «Книга» ──
  const bookSize = useCallback(() => {
    // по бокам — место под стрелки и обрез книги (стопку страниц), снизу — под «в начало / в конец»
    const roomy = stage.w >= 700;
    const availW = Math.max(200, stage.w - (roomy ? 150 : 16));
    const availH = Math.max(200, stage.h - (roomy ? 64 : 56));
    // разворот, если страницы в нём не мельче ~60% одиночной: книжный и альбомный A4 — разворотом,
    // широкие 16:9 — по одной странице на весь экран. Кнопка «Разворот» переключает вручную.
    const canSpread = pages > 1 && availW >= 700;
    const pwSpread = Math.min(availW / 2, availH / ratio);
    const pwSingle = Math.min(availW, availH / ratio);
    const wide = canSpread && (spreadPref === 'on' || (spreadPref === 'auto' && pwSpread >= pwSingle * 0.6));
    const pw = Math.floor(wide ? pwSpread : pwSingle);
    return { pw, ph: Math.floor(pw * ratio), wide, canSpread };
  }, [stage, ratio, pages, spreadPref]);

  useEffect(() => {
    if (!doc || mode !== 'book' || !stage.w || !bookHostRef.current) return;
    const host = bookHostRef.current;
    const { pw, ph, wide } = bookSize();
    setLandscape(wide);
    host.innerHTML = '';
    const book = document.createElement('div');
    book.className = 'pfb-book';
    book.style.width = `${wide ? pw * 2 : pw}px`;
    book.style.height = `${ph}px`;
    host.appendChild(book);
    const els: HTMLElement[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const p = document.createElement('div');
      p.className = 'pfb-page';
      p.dataset.density = 'soft';
      const img = document.createElement('img');
      img.alt = `${i}`;
      img.draggable = false;
      const cached = cache.current.get(i);
      if (cached) img.src = cached.url;
      p.appendChild(img);
      const num = document.createElement('span');
      num.className = 'pfb-num';
      num.textContent = String(i);
      p.appendChild(num);
      book.appendChild(p);
      els.push(p);
    }
    pageEls.current = els;
    const start = Math.min(page, doc.numPages - 1);
    const pf = new PageFlip(book, {
      width: pw, height: ph, size: 'fixed', startPage: start, showCover: doc.numPages > 2, usePortrait: !wide,
      drawShadow: true, maxShadowOpacity: 0.45, flippingTime: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 1 : 650, mobileScrollSupport: false, showPageCorners: true, autoSize: false,
    });
    pf.loadFromHTML(els);
    pf.on('flip', (e) => setPage(Number(e.data) || 0));
    pfRef.current = pf;
    return () => {
      pfRef.current = null;
      try { pf.destroy(); } catch { /* уже снят */ }
      host.innerHTML = '';
    };
    // page — только стартовая позиция при пересоздании; само перелистывание не пересоздаёт книгу
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, mode, stage.w, stage.h, ratio, spreadPref]);

  // картинки текущего разворота и соседних
  useEffect(() => {
    if (!doc || mode !== 'book') return;
    const { pw } = bookSize();
    const want = [page, page + 1, page - 1, page + 2, page + 3, page - 2, page + 4];
    for (const idx of want) {
      if (idx < 0 || idx >= doc.numPages) continue;
      void ensure(idx + 1, pw).then((url) => {
        const img = pageEls.current[idx]?.querySelector('img');
        if (url && img && img.src !== url) img.src = url;
      });
    }
  }, [doc, mode, page, ensure, bookSize]);

  // ── «Лента» ──
  const scrollRef = useRef<HTMLDivElement>(null);
  const colW = Math.max(200, Math.min(stage.w - 32, 980) * zoom);
  useEffect(() => {
    if (!doc || mode !== 'scroll' || !scrollRef.current) return;
    const root = scrollRef.current;
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        const n = Number((en.target as HTMLElement).dataset.page);
        void ensure(n, colW).then((url) => url && setScrollImgs((m) => (m[n] === url ? m : { ...m, [n]: url })));
      }
      // текущая — самая верхняя видимая
      const tops = [...root.querySelectorAll<HTMLElement>('.pfb-sp')].filter((x) => x.getBoundingClientRect().bottom > root.getBoundingClientRect().top + 60);
      if (tops[0]) setPage(Number(tops[0].dataset.page) - 1);
    }, { root, rootMargin: '600px 0px' });
    root.querySelectorAll('.pfb-sp').forEach((x) => io.observe(x));
    return () => io.disconnect();
  }, [doc, mode, colW, ensure]);

  // ── поиск по тексту (у сканов без текстового слоя ничего не найдётся) ──
  useEffect(() => { texts.current.clear(); }, [doc]);
  useEffect(() => {
    const q = query.trim().toLocaleLowerCase();
    if (!doc || q.length < 2) { setHits(null); setSearching(false); return; }
    let alive = true;
    setSearching(true);
    const h = setTimeout(async () => {
      const out: Array<{ page: number; snippet: string }> = [];
      for (let n = 1; n <= doc.numPages && alive && out.length < 60; n++) {
        let txt = texts.current.get(n);
        if (txt === undefined) {
          try {
            const tc = await (await doc.getPage(n)).getTextContent();
            txt = tc.items.map((it) => ('str' in it ? it.str : '')).join(' ').replace(/\s+/g, ' ');
          } catch { txt = ''; }
          texts.current.set(n, txt);
        }
        const i = txt.toLocaleLowerCase().indexOf(q);
        if (i >= 0) out.push({ page: n, snippet: `${i > 40 ? '…' : ''}${txt.slice(Math.max(0, i - 40), i + q.length + 60)}…` });
        if (alive && n % 10 === 0) setHits([...out]);
      }
      if (alive) { setHits(out); setSearching(false); }
    }, 300);
    return () => { alive = false; clearTimeout(h); };
  }, [doc, query]);

  // ── миниатюры ──
  const thumbsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!doc || !thumbsOpen || !thumbsRef.current) return;
    const root = thumbsRef.current;
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        const n = Number((en.target as HTMLElement).dataset.page);
        if (thumbCache.current.has(n)) continue;
        thumbCache.current.set(n, '');
        queue.current = queue.current.then(async () => {
          const r = await renderPage(doc, n, 90);
          thumbCache.current.set(n, r.url);
          setThumbImgs((m) => ({ ...m, [n]: r.url }));
        }).catch(() => undefined);
      }
    }, { root, rootMargin: '0px 300px' });
    root.querySelectorAll('.pfb-th').forEach((x) => io.observe(x));
    return () => io.disconnect();
  }, [doc, thumbsOpen]);

  const go = useCallback((idx: number) => {
    if (!doc) return;
    const i = Math.max(0, Math.min(doc.numPages - 1, idx));
    if (mode === 'book') pfRef.current?.flip(i);
    else scrollRef.current?.querySelector(`[data-page="${i + 1}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setPage(i);
  }, [doc, mode]);
  const prev = useCallback(() => (mode === 'book' ? pfRef.current?.flipPrev() : go(page - 1)), [mode, go, page]);
  const next = useCallback(() => (mode === 'book' ? pfRef.current?.flipNext() : go(page + 1)), [mode, go, page]);

  // клавиши: листаем страницы (а не файлы лайтбокса — ловим раньше него)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') e.stopPropagation(); return; }
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.stopPropagation(); e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.stopPropagation(); e.preventDefault(); prev(); }
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [next, prev]);

  useEffect(() => {
    const h = () => setFs(document.fullscreenElement === rootRef.current);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);
  const toggleFs = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen?.();
  };
  const toggleSpread = () => {
    const v: Spread = landscape ? 'off' : 'on';
    setSpreadPref(v);
    try { localStorage.setItem(SPREAD_KEY, v); } catch { /* приватный режим */ }
  };
  const setModeSaved = (m: Mode) => {
    setMode(m);
    try { localStorage.setItem(MODE_KEY, m); } catch { /* приватный режим */ }
  };

  // разворот: «2–3 / 24»; обложка и последняя — по одной
  const label = (() => {
    if (!pages) return '';
    if (mode === 'book' && landscape && pages > 2 && page > 0 && page < pages - 1) {
      const left = page % 2 === 1 ? page : page - 1;
      return `${labels.pageShort} ${left + 1}–${Math.min(pages, left + 2)} / ${pages}`;
    }
    return `${labels.pageShort} ${page + 1} / ${pages}`;
  })();
  // зоны клика по краям — только если рядом с книгой есть место, иначе они перекрывают углы страниц (листание пальцем)
  const geo = bookSize();
  const edges = (stage.w - (geo.wide ? geo.pw * 2 : geo.pw)) / 2 >= 48;
  // видимая часть книги (обложка — только правая половина, последняя чётная — левая): под ней тень и обрез
  const frame = (() => {
    const full = landscape ? geo.pw * 2 : geo.pw;
    const cover = landscape && pages > 2;
    if (cover && page === 0) return { left: geo.pw, width: geo.pw, full };
    if (cover && pages % 2 === 0 && page === pages - 1) return { left: 0, width: geo.pw, full };
    return { left: 0, width: full, full };
  })();
  const stackMax = Math.min(12, Math.max(3, pages / 5));
  const stackL = pages > 1 ? (stackMax * page) / (pages - 1) : 0;
  const stackR = pages > 1 ? (stackMax * (pages - 1 - page)) / (pages - 1) : 0;
  const fsOk = typeof document !== 'undefined' && !!document.fullscreenEnabled;

  const mark = (txt: string) => {
    const q = query.trim();
    const i = q ? txt.toLocaleLowerCase().indexOf(q.toLocaleLowerCase()) : -1;
    return i < 0 ? txt : <>{txt.slice(0, i)}<mark>{txt.slice(i, i + q.length)}</mark>{txt.slice(i + q.length)}</>;
  };
  const I = (d: React.ReactNode, w = 16) => <svg viewBox="0 0 24 24" width={w} height={w} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d}</svg>;

  return (
    <div ref={rootRef} className={`pfb${fs ? ' fs' : ''}${landscape && mode === 'book' ? ' spread' : ''}`} onClick={(e) => e.stopPropagation()}>
      <div className="pfb-bar">
        <div className="pfb-title">
          <b title={name}>{name.replace(/\.pdf$/i, '')}</b>
          {!!pages && <span className="pfb-count">{label}</span>}
        </div>
        <div className="pfb-tools">
          <div className="pfb-seg" role="tablist">
            <button type="button" className={mode === 'book' ? 'on' : ''} onClick={() => setModeSaved('book')}>
              {I(<><path d="M3 5c3-1 6-1 9 1v14c-3-2-6-2-9-1z" /><path d="M21 5c-3-1-6-1-9 1v14c3-2 6-2 9-1z" /></>, 14)}
              <span>{labels.book}</span>
            </button>
            <button type="button" className={mode === 'scroll' ? 'on' : ''} onClick={() => setModeSaved('scroll')}>
              {I(<><rect x="6" y="3" width="12" height="8" rx="1" /><rect x="6" y="13" width="12" height="8" rx="1" /></>, 14)}
              <span>{labels.scroll}</span>
            </button>
          </div>
          {mode === 'scroll' && (
            <span className="pfb-zoomer">
              <button type="button" onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))} aria-label={labels.zoomOut}>−</button>
              <span className="mono pfb-zoom">{Math.round(zoom * 100)}%</span>
              <button type="button" onClick={() => setZoom((z) => Math.min(2.5, Math.round((z + 0.25) * 100) / 100))} aria-label={labels.zoomIn}>+</button>
            </span>
          )}
          {mode === 'book' && geo.canSpread && (
            <button type="button" className={`pfb-spread${landscape ? ' on' : ''}`} onClick={toggleSpread} aria-pressed={landscape} aria-label={labels.spread} title={landscape ? labels.singlePage : labels.spread}>
              {I(landscape ? <><rect x="3" y="5" width="8.5" height="14" rx="1" /><rect x="12.5" y="5" width="8.5" height="14" rx="1" /></> : <rect x="6" y="5" width="12" height="14" rx="1" />, 15)}
            </button>
          )}
          <button type="button" className={searchOpen ? 'on' : ''} onClick={() => setSearchOpen((x) => !x)} aria-label={labels.search} title={labels.search}>
            {I(<><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></>)}
          </button>
          <button type="button" className={thumbsOpen ? 'on' : ''} onClick={() => setThumbsOpen((x) => !x)} aria-label={labels.thumbs} title={labels.thumbs}>
            {I(<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>, 15)}
          </button>
          {fsOk && (
            <button type="button" onClick={toggleFs} aria-label={fs ? labels.exitFullscreen : labels.fullscreen} title={fs ? labels.exitFullscreen : labels.fullscreen}>
              {I(fs ? <path d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6" /> : <path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6" />, 15)}
            </button>
          )}
          {onDownload && (
            <button type="button" onClick={onDownload} aria-label={labels.download} title={labels.download}>
              {I(<path d="M12 4v11M7 10l5 5 5-5M5 20h14" />, 15)}
            </button>
          )}
        </div>
        {searchOpen && (
          <div className="pfb-search">
            {I(<><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></>, 14)}
            <input autoFocus value={query} placeholder={labels.searchPlaceholder} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setSearchOpen(false); } }} />
            {searching && <i className="pfb-spin sm" />}
            {hits && (
              <div className="pfb-hits">
                {!hits.length && !searching ? <div className="pfb-hit none">{labels.nothingFound}</div> : hits.map((h) => (
                  <button key={h.page} type="button" className="pfb-hit" onClick={() => go(h.page - 1)}>
                    <span className="mono">{labels.pageShort} {h.page}</span>
                    <em>{mark(h.snippet)}</em>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div ref={stageRef} className={`pfb-stage ${mode}`}>
        {failed ? (
          <div className="pfb-msg"><b>{labels.error}</b><span>{name}</span>{onDownload && <button type="button" className="pfb-btn" onClick={onDownload}>{labels.download}</button>}</div>
        ) : !doc ? (
          <div className="pfb-msg"><i className="pfb-spin" /><span>{labels.loading}</span>{loadedMb >= 0.1 && <span className="mono pfb-mb">{loadedMb.toFixed(1)} MB</span>}</div>
        ) : mode === 'book' ? (
          <>
            {/* тень под книгой и обрез (стопка страниц слева/справа) — за книгой, по видимой части */}
            <div className="pfb-frame" style={{ width: frame.full, height: geo.ph }} aria-hidden>
              <div className="pfb-body" style={{ left: frame.left, width: frame.width }}>
                {stackL > 0.5 && <i className="pfb-stack l" style={{ width: stackL }} />}
                {stackR > 0.5 && <i className="pfb-stack r" style={{ width: stackR }} />}
              </div>
            </div>
            <div ref={bookHostRef} className="pfb-host" />
            {edges && (
              <>
                <button type="button" className="pfb-arrow l" onClick={prev} disabled={page <= 0} aria-label={labels.prev}>{I(<path d="M15 4l-8 8 8 8" />, 34)}</button>
                <button type="button" className="pfb-arrow r" onClick={next} disabled={page >= pages - 1} aria-label={labels.next}>{I(<path d="M9 4l8 8-8 8" />, 34)}</button>
                <button type="button" className="pfb-jump l" onClick={() => go(0)} disabled={page <= 0} aria-label={labels.first} title={labels.first}>{I(<path d="M6 5v14M18 6l-7 6 7 6" />, 16)}</button>
                <button type="button" className="pfb-jump r" onClick={() => go(pages - 1)} disabled={page >= pages - 1} aria-label={labels.last} title={labels.last}>{I(<path d="M18 5v14M6 6l7 6-7 6" />, 16)}</button>
              </>
            )}
          </>
        ) : (
          <div ref={scrollRef} className="pfb-scroll">
            {Array.from({ length: pages }, (_, i) => (
              <div key={i} className="pfb-sp" data-page={i + 1} style={{ width: colW, height: Math.round(colW * ratio) }}>
                {scrollImgs[i + 1] ? <img src={scrollImgs[i + 1]} alt={`${i + 1}`} draggable={false} /> : <i className="pfb-spin" />}
                <span className="pfb-num">{i + 1}</span>
              </div>
            ))}
          </div>
        )}
        {!edges && mode === 'book' && doc && pages > 1 && (
          <div className="pfb-mpager">
            <button type="button" onClick={prev} disabled={page <= 0} aria-label={labels.prev}>{I(<path d="M15 6l-6 6 6 6" />)}</button>
            <button type="button" onClick={next} disabled={page >= pages - 1} aria-label={labels.next}>{I(<path d="M9 6l6 6-6 6" />)}</button>
          </div>
        )}
      </div>

      {thumbsOpen && doc && (
        <div ref={thumbsRef} className="pfb-thumbs">
          {Array.from({ length: pages }, (_, i) => (
            <button key={i} type="button" data-page={i + 1} className={`pfb-th${i === page || (mode === 'book' && landscape && page % 2 === 1 && i === page + 1) ? ' on' : ''}`} onClick={() => go(i)} style={{ aspectRatio: `${1 / ratio}` }}>
              {thumbImgs[i + 1] ? <img src={thumbImgs[i + 1]} alt="" /> : null}
              <span>{i + 1}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default PdfFlipbook;
