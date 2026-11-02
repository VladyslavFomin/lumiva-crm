// src/pages/media/MediaSharePage.tsx — публичная страница медиа-ссылки (порт Claude Design media-share.html)
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import i18n, { ensureLanguageLoaded } from '../../i18n';
import { ApiError, resolvePublicAssetUrl } from '../../api/client';
import { mediaAccess, mediaPublic, mediaUrl, startBrowserDownload, type MediaFormField, type MediaShareFile, type MediaSharePage as PageData } from '../../api/media';
import { MIC, cx, fmtBytes, fmtDate, fmtDur } from './mediaUi';
import './media-share.css';

const Ico: React.FC<{ d: React.ReactNode; s?: number; w?: number }> = ({ d, s = 16, w = 1.6 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>
);

type Folder = NonNullable<PageData['folders']>[number];
const SELECTED = '__selected';
type L3 = 'ru' | 'en' | 'tr';
const LANG_KEY = 'lumiva-media-lang';
const pickLang = (v?: string | null): L3 | null => (v === 'ru' || v === 'en' || v === 'tr' ? v : null);
const browserLang = (): L3 | null => {
  try {
    for (const l of navigator.languages || [navigator.language]) { const p = pickLang((l || '').slice(0, 2).toLowerCase()); if (p) return p; }
  } catch { /* ignore */ }
  return null;
};
const savedLang = (): L3 | null => { try { return pickLang(localStorage.getItem(LANG_KEY)); } catch { return null; } };
/** Нейтральная иконка вкладки (вместо иконки CRM), если у компании нет логотипа. */
const NEUTRAL_ICON = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#0c0c0d"/><circle cx="16" cy="16" r="7" fill="none" stroke="#f3f3f1" stroke-width="2.4"/></svg>');
const tall = (f: MediaShareFile) => !!f.width && !!f.height && f.height > f.width * 1.1;
const stripNo = (s: string) => s.replace(/^\d+\s*[-–.]\s*/, '');

const Art: React.FC<{ f: MediaShareFile; big?: boolean }> = ({ f, big }) => {
  const src = big && f.kind === 'image' && f.ext !== 'heic' && f.ext !== 'tif' && f.ext !== 'tiff' ? mediaUrl(f.viewUrl) : mediaUrl(f.thumbUrl);
  return (
    <div className={cx('sh-art', 'k-' + f.kind, f.ext === 'svg' && 'fit')}>
      {src ? <img src={src} alt="" loading="lazy" draggable={false} /> : f.kind === 'pdf' ? <span className="pg"><i /><i /><i /><i /><b>PDF</b></span> : <span className="ext">{f.ext.toUpperCase()}</span>}
      {f.kind === 'video' && <span className="pl"><Ico d={MIC.play} s={big ? 22 : 14} /></span>}
    </div>
  );
};

function useReveal(dep: unknown) {
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      document.querySelectorAll('.msh .rv').forEach((el) => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 });
    const scan = () => document.querySelectorAll('.msh .rv:not(.in)').forEach((el) => io.observe(el));
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); };
  }, [dep]);
}

const FolderCard: React.FC<{ f: Folder; i: number; files: MediaShareFile[]; count: number; onOpen: () => void; lang: string; t: (k: string, o?: any) => string }> = ({ f, i, files, count, onOpen, lang, t }) => {
  const ref = useRef<HTMLDivElement>(null);
  const prev = files.slice(0, 3);
  const move = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty('--rx', `${-y * 8}deg`);
    el.style.setProperty('--ry', `${x * 10}deg`);
    el.style.setProperty('--mx', `${(x + 0.5) * 100}%`);
    el.style.setProperty('--my', `${(y + 0.5) * 100}%`);
  };
  const leave = () => { ref.current?.style.setProperty('--rx', '0deg'); ref.current?.style.setProperty('--ry', '0deg'); };
  return (
    <div className="sh-fold rv" style={{ transitionDelay: `${Math.min(i, 10) * 60}ms` }} ref={ref} onMouseMove={move} onMouseLeave={leave} onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      <div className="stack">
        {prev.length ? prev.map((p, j) => <div key={p.id} className={`card c${j}`}><Art f={p} /></div>) : <div className="empty"><Ico d={MIC.folder} s={22} /></div>}
      </div>
      <div className="info">
        <div className="no mono">{String(i + 1).padStart(2, '0')}</div>
        <div className="nm">{f.id === SELECTED ? f.name : stripNo(f.name)}</div>
        <div className="mt mono">{t('publicPages.media.filesN', { count })}{f.createdAt ? ` · ${fmtDate(f.createdAt, lang)}` : ''}</div>
      </div>
      <span className="go"><Ico d={MIC.chevR} s={14} /></span>
    </div>
  );
};

type DlReq = { files: MediaShareFile[]; body: { fileIds?: string[]; folderIds?: string[]; all?: boolean } };

const Gate: React.FC<{
  slug: string;
  req: DlReq;
  form: { title: string; fields: MediaFormField[] } | null;
  needForm: boolean;
  me: string | null;
  zipName: string;
  lang: string;
  t: (k: string, o?: any) => string;
  onClose: () => void;
  onFormDone: (name: string | null) => void;
}> = ({ slug, req, form, needForm, me, zipName, lang, t, onClose, onFormDone }) => {
  const fields = useMemo(() => (form?.fields || []).filter((f) => f.on), [form]);
  const [v, setV] = useState<Record<string, string | boolean>>({});
  const [err, setErr] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<'form' | 'pack' | 'done'>(needForm ? 'form' : 'pack');
  const [p, setP] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [fail, setFail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const total = req.files.reduce((s, f) => s + f.sizeBytes, 0);

  const start = useCallback(async () => {
    setPhase('pack');
    setFail(null);
    let x = 0;
    const timer = setInterval(() => { x = Math.min(92, x + 6 + Math.random() * 10); setP(x); }, 80);
    try {
      const r = await mediaPublic<{ url: string }>(slug, '/download', req.body);
      clearInterval(timer);
      setP(100);
      setUrl(r.url);
      startBrowserDownload(r.url);
      setTimeout(() => setPhase('done'), 300);
    } catch (e) {
      clearInterval(timer);
      if (e instanceof ApiError && e.code === 'MEDIA_FORM_REQUIRED') { setPhase('form'); return; }
      setFail(e instanceof Error ? e.message : String(e));
      setPhase('done');
    }
  }, [slug, req.body]);

  useEffect(() => { if (!needForm) void start(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    fields.forEach((f) => {
      const val = v[f.id];
      if (f.req && (f.type === 'check' ? !val : !String(val || '').trim())) er[f.id] = t('publicPages.media.required');
      else if (f.type === 'email' && val && !/^\S+@\S+\.\S+$/.test(String(val))) er[f.id] = t('publicPages.media.checkEmail');
    });
    setErr(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      const r = await mediaPublic<{ ok: true; name: string | null }>(slug, '/lead', { values: v, lang });
      onFormDone(r.name);
      await start();
    } catch (ex) {
      if (ex instanceof ApiError && ex.payload?.errors) {
        const m: Record<string, string> = {};
        Object.keys(ex.payload.errors).forEach((k) => { m[k] = ex.payload.errors[k] === 'email' ? t('publicPages.media.checkEmail') : t('publicPages.media.required'); });
        setErr(m);
      } else setFail(ex instanceof Error ? ex.message : String(ex));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sh-ov" onClick={phase === 'form' ? onClose : undefined}>
      <div className={cx('sh-gate', phase)} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="sh-gate-fan">{req.files.slice(0, 4).map((f, i) => <div key={f.id} className={`g g${i}`}><Art f={f} /></div>)}</div>
        {phase === 'form' && (
          <form onSubmit={submit} noValidate>
            <div className="k mono">{t('publicPages.media.filesN', { count: req.files.length })} · {fmtBytes(total, lang)}</div>
            <h3>{form?.title || t('publicPages.media.gateTitle')}</h3>
            <p>{t('publicPages.media.gateSub')}</p>
            {fields.map((f, i) => (
              <div key={f.id} className={cx('sh-f', err[f.id] && 'bad')} style={{ animationDelay: `${120 + i * 50}ms` }}>
                {f.type === 'check' ? (
                  <label className="ck">
                    <input type="checkbox" checked={!!v[f.id]} onChange={(e) => setV({ ...v, [f.id]: e.target.checked })} />
                    <span className="b"><Ico d={MIC.check} s={11} w={2.4} /></span>
                    <span>{f.label}{f.req && <em>*</em>}</span>
                  </label>
                ) : (
                  <>
                    <label htmlFor={`mf-${f.id}`}>{f.label}{f.req && <em>*</em>}</label>
                    {f.type === 'select' ? (
                      <select id={`mf-${f.id}`} value={String(v[f.id] || '')} onChange={(e) => setV({ ...v, [f.id]: e.target.value })}>
                        <option value="">{t('publicPages.media.choose')}</option>
                        {(f.options || []).map((o) => <option key={o}>{o}</option>)}
                      </select>
                    ) : f.type === 'textarea' ? (
                      <textarea id={`mf-${f.id}`} rows={2} placeholder={f.ph} value={String(v[f.id] || '')} onChange={(e) => setV({ ...v, [f.id]: e.target.value })} />
                    ) : (
                      <input
                        id={`mf-${f.id}`}
                        type={f.type}
                        placeholder={f.ph}
                        autoComplete={f.id === 'name' ? 'name' : f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : f.id === 'company' ? 'organization' : undefined}
                        value={String(v[f.id] || '')}
                        onChange={(e) => setV({ ...v, [f.id]: e.target.value })}
                      />
                    )}
                  </>
                )}
                {err[f.id] && <div className="er">{err[f.id]}</div>}
              </div>
            ))}
            {fail && <div className="sh-err">{fail}</div>}
            <button className="sh-btn pri wide" type="submit" disabled={busy}><Ico d={MIC.dl} s={15} />{t('publicPages.media.download')}</button>
            <button className="sh-x" type="button" onClick={onClose} aria-label={t('publicPages.media.close')}><Ico d={MIC.x} s={14} /></button>
          </form>
        )}
        {phase === 'pack' && (
          <div className="sh-pack">
            <div className="k mono">{me ? t('publicPages.media.welcomeBack', { name: (me || '').split(' ')[0] }) : t('publicPages.media.preparing')}</div>
            <h3>{p < 100 ? t('publicPages.media.packing') : t('publicPages.media.ready')}</h3>
            <div className="ring">
              <svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" /><circle cx="40" cy="40" r="34" className="v" style={{ strokeDashoffset: 214 - (214 * p) / 100 }} /></svg>
              <span className="mono">{Math.round(p)}%</span>
            </div>
            <div className="sub mono">{req.files.length > 1 ? `${zipName}.zip` : req.files[0]?.name}</div>
          </div>
        )}
        {phase === 'done' && (
          <div className="sh-pack">
            {fail ? (
              <>
                <div className="ok" style={{ background: '#3a2224', color: '#e8a0a0' }}><Ico d={MIC.x} s={26} w={2} /></div>
                <h3>{t('publicPages.media.failed')}</h3>
                <p>{fail}</p>
                <button className="sh-btn wide" onClick={() => void start()}>{t('publicPages.media.tryAgain')}</button>
              </>
            ) : (
              <>
                <div className="ok"><Ico d={MIC.check} s={26} w={2} /></div>
                <h3>{t('publicPages.media.started')}</h3>
                <p>{t('publicPages.media.notStarted')} <a href={mediaUrl(url) || '#'}>{t('publicPages.media.clickHere')}</a>.</p>
                <button className="sh-btn wide" onClick={onClose}>{t('publicPages.media.backToFiles')}</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const Lightbox: React.FC<{ list: MediaShareFile[]; idx: number; setIdx: (i: number | null) => void; onDl: (f: MediaShareFile) => void; lang: string; t: (k: string) => string }> = ({ list, idx, setIdx, onDl, lang, t }) => {
  const f = list[idx];
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIdx(null);
      if (e.key === 'ArrowRight') setIdx((idx + 1) % list.length);
      if (e.key === 'ArrowLeft') setIdx((idx - 1 + list.length) % list.length);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [idx, list.length, setIdx]);
  const view = mediaUrl(f.viewUrl) || undefined;
  const browserImage = f.kind === 'image' && !['heic', 'tif', 'tiff'].includes(f.ext);
  return (
    <div className="sh-lb" onClick={() => setIdx(null)}>
      <div className="sh-lb-top" onClick={(e) => e.stopPropagation()}>
        <span className="mono">{idx + 1} / {list.length}</span>
        <div className="nm">{f.name}<span className="mono">{[f.width && f.height ? `${f.width} × ${f.height}` : null, fmtDur(f.durationSec), fmtBytes(f.sizeBytes, lang)].filter(Boolean).join(' · ')}</span></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="sh-btn pri" onClick={() => onDl(f)}><Ico d={MIC.dl} s={14} />{t('publicPages.media.download')}</button>
          <button className="sh-btn ic" onClick={() => setIdx(null)} aria-label={t('publicPages.media.close')}><Ico d={MIC.x} s={15} /></button>
        </div>
      </div>
      {list.length > 1 && <button className="sh-lb-nav l" onClick={(e) => { e.stopPropagation(); setIdx((idx - 1 + list.length) % list.length); }}><Ico d={MIC.chevL} s={20} /></button>}
      <div key={f.id} className={cx('sh-lb-img', !browserImage && f.kind === 'image' && 'ph')} onClick={(e) => e.stopPropagation()}>
        {f.kind === 'video' ? <video src={view} poster={mediaUrl(f.thumbUrl) || undefined} controls autoPlay playsInline />
          : f.kind === 'pdf' ? <iframe src={view} title={f.name} />
          : browserImage ? <img src={view} alt={f.name} /> : <Art f={f} big />}
      </div>
      {list.length > 1 && <button className="sh-lb-nav r" onClick={(e) => { e.stopPropagation(); setIdx((idx + 1) % list.length); }}><Ico d={MIC.chevR} s={20} /></button>}
      {list.length > 1 && (
        <div className="sh-lb-strip" onClick={(e) => e.stopPropagation()}>
          {list.map((x, i) => <div key={x.id} className={cx('t', i === idx && 'on')} onClick={() => setIdx(i)}><Art f={x} /></div>)}
        </div>
      )}
    </div>
  );
};

export const MediaSharePage: React.FC = () => {
  const { slug = '' } = useParams<{ slug: string }>();
  // язык страницы: ?lang= → выбор посетителя → язык ссылки → язык браузера → английский
  const chosenRef = useRef<L3 | null>(pickLang(new URLSearchParams(window.location.search).get('lang')) || savedLang());
  const [lang, setLang] = useState<L3>(() => chosenRef.current || browserLang() || 'en');
  const [langReady, setLangReady] = useState(0);
  useEffect(() => { void ensureLanguageLoaded(lang).then(() => setLangReady((x) => x + 1)); }, [lang]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const t = useMemo(() => i18n.getFixedT(lang), [lang, langReady]);
  const chooseLang = (l: L3) => {
    chosenRef.current = l;
    try { localStorage.setItem(LANG_KEY, l); } catch { /* private mode */ }
    setLang(l);
  };
  const [data, setData] = useState<PageData | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'password' | 'closed' | 'expired' | 'notfound' | 'error'>('loading');
  const [pwd, setPwd] = useState('');
  const [pwdErr, setPwdErr] = useState<string | null>(null);
  const [cur, setCur] = useState<string | null>(() => (window.location.hash.slice(1) || null));
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [lb, setLb] = useState<number | null>(null);
  const [gate, setGate] = useState<DlReq | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [me, setMe] = useState<string | null>(null);
  const [needForm, setNeedForm] = useState(true);
  const spot = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await mediaPublic<PageData>(slug, `?lang=${lang}`);
      setData(r);
      if (!chosenRef.current) {
        const d = pickLang(r.link?.lang) || browserLang() || pickLang(r.brand?.lang) || 'en';
        if (d !== lang) setLang(d);
      }
      if (r.needPassword) { setState('password'); return; }
      setState('ok');
      setNeedForm(!!r.needForm);
      setMe(r.me?.name ?? null);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === 'MEDIA_CLOSED') return setState('closed');
        if (e.code === 'MEDIA_EXPIRED') return setState('expired');
        if (e.status === 404) return setState('notfound');
      }
      setState('error');
    }
  }, [slug, lang]);
  useEffect(() => { void load(); }, [load]);

  useReveal(`${state}:${cur}`);

  const folders = useMemo(() => {
    const list = [...(data?.folders || [])];
    if (data?.looseFolderId) list.unshift({ id: SELECTED, name: t('publicPages.media.selectedFiles'), hotelId: null, parentId: null, createdAt: '' });
    return list;
  }, [data, t]);
  const files = data?.files || [];
  const byId = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);
  const kidsOf = useCallback((id: string | null) => folders.filter((f) => f.parentId === id), [folders]);
  const filesOf = useCallback((id: string) => files.filter((f) => f.folderId === id), [files]);
  const deepFiles = useCallback((id: string): MediaShareFile[] => [...filesOf(id), ...kidsOf(id).flatMap((k) => deepFiles(k.id))], [filesOf, kidsOf]);
  const pathOf = (id: string | null) => { const out: Folder[] = []; let f = id ? byId.get(id) : undefined; while (f) { out.unshift(f); f = f.parentId ? byId.get(f.parentId) : undefined; } return out; };

  // хеш = текущая папка (кнопка «назад» браузера работает)
  useEffect(() => {
    const h = () => setCur(window.location.hash.slice(1) || null);
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  const openFolder = (id: string | null) => {
    if (id) window.location.hash = id;
    else window.history.pushState(null, '', window.location.pathname);
    setCur(id);
  };
  useEffect(() => {
    window.scrollTo({ top: 0 });
    setSel(new Set());
    setFilter('all');
    if (cur && cur !== SELECTED && state === 'ok') void mediaPublic(slug, '/event', { type: 'open', folderId: cur }).catch(() => undefined);
  }, [cur, state, slug]);

  useEffect(() => {
    const m = (e: PointerEvent) => { if (spot.current) spot.current.style.transform = `translate(${e.clientX - 400}px, ${e.clientY - 400 + window.scrollY}px)`; };
    window.addEventListener('pointermove', m);
    return () => window.removeEventListener('pointermove', m);
  }, []);

  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = '#0c0c0d';
    return () => { document.body.style.background = prev; };
  }, []);

  const unlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdErr(null);
    try {
      const r = await mediaPublic<{ access: string | null }>(slug, '/unlock', { password: pwd });
      if (r.access) mediaAccess.set(slug, r.access);
      setState('loading');
      await load();
    } catch (ex) {
      setPwdErr(ex instanceof ApiError && ex.code === 'MEDIA_BAD_PASSWORD' ? t('publicPages.media.badPassword') : ex instanceof Error ? ex.message : String(ex));
    }
  };

  const brand = data?.brand;
  const hotels = data?.hotels || [];
  const link = data?.link;
  const singleHotel = hotels.length === 1 ? hotels[0] : null;
  const onlyColl = !hotels.length && (data?.collections || []).length === 1 ? data!.collections![0].name : null;
  const title = link?.name || singleHotel?.name || onlyColl || brand?.name || t('publicPages.media.mediakit');
  // вкладка браузера — от имени компании/отеля, а не CRM: «Название · Медиакит», логотип компании
  const tabTitle = state === 'password' ? data?.name || title : title;
  const logoHref = brand?.logoUrl ? resolvePublicAssetUrl(brand.logoUrl) : null;
  useEffect(() => {
    document.title = `${tabTitle} · ${t('publicPages.media.mediakit')}`;
    document.documentElement.lang = lang;
  }, [tabTitle, t, lang]);
  useEffect(() => {
    const icons = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"], link[rel="apple-touch-icon"]'));
    const prev = icons.map((l) => [l, l.href, l.type] as const);
    const href = logoHref || NEUTRAL_ICON;
    if (!icons.length) {
      const l = document.createElement('link');
      l.rel = 'icon';
      document.head.appendChild(l);
      icons.push(l);
    }
    icons.forEach((l) => { l.href = href; l.removeAttribute('type'); });
    return () => prev.forEach(([l, h, ty]) => { l.href = h; if (ty) l.type = ty; });
  }, [logoHref]);

  const tops = folders.filter((f) => !f.parentId);
  const totalBytes = files.reduce((s, f) => s + f.sizeBytes, 0);
  const zipName = (title || 'media').replace(/[\\/:*?"<>|]+/g, '_');

  const askDownload = (req: DlReq) => {
    if (req.files.length > 1 && link && !link.allowZip) return;
    void mediaPublic(slug, '/event', { type: 'click' }).catch(() => undefined);
    setGate(req);
  };

  const frame = (body: React.ReactNode) => (
    <div className="msh">
      <div className="sh">
        <div className="sh-spot" ref={spot} />
        <header className="sh-hd">
          <a className="sh-brand" href="#" onClick={(e) => { e.preventDefault(); openFolder(null); }}>
            {brand?.logoUrl ? <img src={resolvePublicAssetUrl(brand.logoUrl) || undefined} alt="" /> : <span className="m" />}
            <span className="nm">{brand?.name || t('publicPages.media.mediakit')}</span>
            {singleHotel && brand?.name !== singleHotel.name && <><span className="sl">/</span><span className="h">{singleHotel.name}</span></>}
          </a>
          <div className="sh-hd-r">
            <div className="sh-lang" role="group" aria-label="Language">
              {(['ru', 'en', 'tr'] as L3[]).map((l) => (
                <button key={l} type="button" className={cx(lang === l && 'on')} onClick={() => chooseLang(l)}>{l.toUpperCase()}</button>
              ))}
            </div>
          {state === 'ok' && (
            <>
              <span className="mono dim">{t('publicPages.media.foldersN', { count: tops.length })} · {t('publicPages.media.filesN', { count: files.length })} · {fmtBytes(totalBytes, lang)}</span>
              {link?.allowZip && files.length > 1 && (
                <button className="sh-btn" onClick={() => askDownload({ files, body: { all: true } })}><Ico d={MIC.zip} s={14} />{t('publicPages.media.downloadAll')}</button>
              )}
            </>
          )}
          </div>
        </header>
        {body}
        <footer className="sh-ft2">
          <span className="mono dim">© {new Date().getFullYear()} {singleHotel?.name || brand?.name || ''}</span>
          {brand?.name ? <span className="mono dim">{t('publicPages.media.providedBy')} {brand.name}</span> : null}
        </footer>
      </div>
    </div>
  );

  if (state === 'loading') return frame(<div className="sh-center"><span className="mono dim">{t('publicPages.media.loading')}</span></div>);
  if (state !== 'ok' && state !== 'password') {
    const key = state === 'closed' ? 'closed' : state === 'expired' ? 'expired' : state === 'notfound' ? 'notFound' : 'error';
    return frame(
      <div className="sh-center">
        <div className="sh-card">
          <div className="ic"><Ico d={state === 'expired' ? MIC.clock : MIC.lock} s={22} /></div>
          <h3>{t(`publicPages.media.${key}Title`)}</h3>
          <p>{t(`publicPages.media.${key}Text`)}</p>
          {state === 'error' && <button className="sh-btn" onClick={() => { setState('loading'); void load(); }}>{t('publicPages.media.tryAgain')}</button>}
        </div>
      </div>,
    );
  }
  if (state === 'password') {
    return frame(
      <div className="sh-center">
        <form className="sh-card" onSubmit={unlock}>
          <div className="ic"><Ico d={MIC.lock} s={22} /></div>
          <h3>{data?.name || t('publicPages.media.mediakit')}</h3>
          <p>{t('publicPages.media.passwordText')}</p>
          <div className={cx('sh-f', pwdErr && 'bad')}>
            <input type="password" autoFocus value={pwd} placeholder={t('publicPages.media.passwordPh')} onChange={(e) => setPwd(e.target.value)} autoComplete="current-password" />
            {pwdErr && <div className="er">{pwdErr}</div>}
          </div>
          <button className="sh-btn pri wide" type="submit" disabled={!pwd}>{t('publicPages.media.open')}</button>
        </form>
      </div>,
    );
  }

  const folder = cur ? byId.get(cur) : undefined;
  const path = pathOf(cur);
  const subs = cur ? kidsOf(cur) : [];
  const own = cur ? filesOf(cur) : [];
  const kinds = [...new Set(own.map((f) => f.kind))];
  const shown = own.filter((f) => filter === 'all' || f.kind === filter);
  const tog = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const selFiles = files.filter((f) => sel.has(f.id));
  const strip = files.filter((f) => f.thumbUrl && f.kind === 'image').slice(0, 16);
  const KL: Record<string, string> = { image: t('publicPages.media.kindImage'), video: t('publicPages.media.kindVideo'), pdf: t('publicPages.media.kindPdf') };
  const dlOne = (f: MediaShareFile) => askDownload({ files: [f], body: { fileIds: [f.id] } });
  const folderReq = (id: string): DlReq => ({ files: deepFiles(id), body: { folderIds: [id] } });

  // группы корневых папок: по отелям, если ссылка — общий архив
  // группы корневых папок: по разделам и отелям, если ссылка — общий архив
  const colls = data?.collections || [];
  const rawGroups: Array<{ id: string; label: string | null; city: string | null; list: Folder[] }> = [
    ...(tops.some((f) => f.id === SELECTED) ? [{ id: SELECTED, label: null, city: null, list: tops.filter((f) => f.id === SELECTED) }] : []),
    ...colls.map((c) => ({ id: `c:${c.id}`, label: c.name, city: null, list: tops.filter((f) => f.collectionId === c.id && f.id !== SELECTED) })),
    ...hotels.map((h) => ({ id: h.id, label: h.name, city: h.city, list: tops.filter((f) => f.hotelId === h.id && f.id !== SELECTED) })),
    { id: 'none', label: brand?.name || t('publicPages.media.other'), city: null, list: tops.filter((f) => !f.hotelId && !f.collectionId && f.id !== SELECTED) },
  ].filter((g) => g.list.length);
  const groups = rawGroups.filter((g) => g.id !== SELECTED).length > 1 ? rawGroups : [{ id: 'all', label: null, city: null, list: tops }];
  let n = 0;

  return frame(
    <>
      {!folder ? (
        <main key="root" className="sh-root">
          <section className="sh-hero">
            <div className="k mono rv">{t('publicPages.media.kicker')}{link?.updatedAt ? ` · ${t('publicPages.media.updated', { date: fmtDate(link.updatedAt, lang) })}` : ''}</div>
            <h1>{title.split(/\s+/).map((w, i) => <span key={i} className="w" style={{ animationDelay: `${i * 110}ms` }}>{w}</span>)}</h1>
            <p className="rv">{link?.description || (hotels.length > 1 ? t('publicPages.media.introMulti', { n: hotels.length }) : t('publicPages.media.intro'))}</p>
            <div className="sh-hero-a rv">
              <button className="sh-btn pri" onClick={() => { const el = document.querySelector('.msh .sh-sec'); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 30, behavior: 'smooth' }); }}>
                {t('publicPages.media.seeFolders')}<Ico d={MIC.down} s={14} />
              </button>
              {singleHotel?.city && <span className="mono dim">{singleHotel.city}</span>}
              {hotels.length > 1 && <span className="mono dim">{hotels.map((h) => h.name).join(' · ')}</span>}
            </div>
          </section>
          {strip.length >= 4 && (
            <div className="sh-marq" aria-hidden>
              <div className="tr">{[...strip, ...strip].map((f, i) => <div key={i} className={cx('it', tall(f) && 'tall')} onClick={() => openFolder(f.folderId)}><Art f={f} /></div>)}</div>
            </div>
          )}
          {groups.map((g) => (
            <section key={g.id} className="sh-sec">
              <div className="sh-sec-h rv">
                <h2>{g.label || t('publicPages.media.folders')}</h2>
                {g.city && <span className="city">{g.city}</span>}
                <span className="mono dim">{g.list.length}</span>
              </div>
              <div className="sh-folders">
                {g.list.map((f) => { const i = n++; const df = deepFiles(f.id); return <FolderCard key={f.id} f={f} i={i} files={df} count={df.length} onOpen={() => openFolder(f.id)} lang={lang} t={t} />; })}
              </div>
            </section>
          ))}
          {tops.length === 0 && <div className="sh-empty">{t('publicPages.media.empty')}</div>}
        </main>
      ) : (
        <main key={cur} className="sh-folder">
          <div className="sh-crumbs">
            <button className="sh-btn ic" onClick={() => openFolder(folder.parentId)} aria-label={t('publicPages.media.back')}><Ico d={MIC.chevL} s={16} /></button>
            <span onClick={() => openFolder(null)}>{t('publicPages.media.allFolders')}</span>
            {path.map((p) => <React.Fragment key={p.id}><i>/</i><span className={p.id === cur ? 'on' : ''} onClick={() => openFolder(p.id)}>{p.id === SELECTED ? p.name : stripNo(p.name)}</span></React.Fragment>)}
          </div>
          <div className="sh-fh">
            <div style={{ minWidth: 0 }}>
              <h1 className="sh-ft">{(folder.id === SELECTED ? folder.name : stripNo(folder.name)).split('').map((c, i) => <span key={i} style={{ animationDelay: `${Math.min(i, 40) * 18}ms` }}>{c === ' ' ? ' ' : c}</span>)}</h1>
              <div className="mono dim">
                {t('publicPages.media.filesN', { count: deepFiles(folder.id).length })} · {fmtBytes(deepFiles(folder.id).reduce((s, f) => s + f.sizeBytes, 0), lang)}
                {folder.hotelId && hotels.length > 1 ? ` · ${hotels.find((h) => h.id === folder.hotelId)?.name ?? ''}` : ''}
              </div>
            </div>
            <div className="sh-fh-a">
              {kinds.length > 1 && (
                <div className="sh-seg">
                  {['all', ...kinds].map((k) => <button key={k} className={cx(filter === k && 'on')} onClick={() => setFilter(k)}>{k === 'all' ? t('publicPages.media.all') : KL[k]}</button>)}
                </div>
              )}
              {shown.length > 0 && (
                <button className="sh-btn" onClick={() => setSel(sel.size && shown.every((f) => sel.has(f.id)) ? new Set() : new Set(shown.map((f) => f.id)))}>
                  {sel.size && shown.every((f) => sel.has(f.id)) ? t('publicPages.media.unselect') : t('publicPages.media.selectAll')}
                </button>
              )}
              {deepFiles(folder.id).length > 0 && (link?.allowZip || deepFiles(folder.id).length === 1) && (
                <button className="sh-btn pri" onClick={() => askDownload(folder.id === SELECTED ? { files: filesOf(SELECTED), body: { folderIds: [SELECTED] } } : folderReq(folder.id))}>
                  <Ico d={MIC.zip} s={14} />{t('publicPages.media.wholeFolder')}
                </button>
              )}
            </div>
          </div>
          {subs.length > 0 && (
            <div className="sh-subs">
              {subs.map((s, i) => (
                <div key={s.id} className="sh-sub rv" style={{ transitionDelay: `${i * 60}ms` }} onClick={() => openFolder(s.id)}>
                  <div className="th">{deepFiles(s.id).slice(0, 3).map((p) => <div key={p.id}><Art f={p} /></div>)}</div>
                  <div><div className="nm">{stripNo(s.name)}</div><div className="mono dim">{t('publicPages.media.filesN', { count: deepFiles(s.id).length })}</div></div>
                  <Ico d={MIC.chevR} s={14} />
                </div>
              ))}
            </div>
          )}
          <div className={cx('sh-grid', shown.length > 0 && shown.every((f) => f.kind === 'pdf') && 'even', sel.size > 0 && 'selecting')}>
            {shown.map((f, i) => (
              <div key={f.id} className={cx('sh-tile', tall(f) && 'tall', 'k-' + f.kind, sel.has(f.id) && 'sel')} style={{ animationDelay: `${Math.min(i, 14) * 45}ms` }} onClick={() => setLb(i)}>
                <div className="im"><Art f={f} /></div>
                <button className={cx('ck', sel.has(f.id) && 'on')} onClick={(e) => { e.stopPropagation(); tog(f.id); }} aria-label={t('publicPages.media.select')}><Ico d={MIC.check} s={12} w={2.4} /></button>
                <div className="ov">
                  <div><div className="nm">{f.name}</div><div className="mono">{f.kind === 'video' && fmtDur(f.durationSec) ? `${fmtDur(f.durationSec)} · ` : ''}{fmtBytes(f.sizeBytes, lang)}</div></div>
                  <button className="dl" onClick={(e) => { e.stopPropagation(); dlOne(f); }} aria-label={t('publicPages.media.download')}><Ico d={MIC.dl} s={14} /></button>
                </div>
              </div>
            ))}
          </div>
          {shown.length === 0 && subs.length === 0 && <div className="sh-empty">{t('publicPages.media.emptyFolder')}</div>}
        </main>
      )}

      <div className={cx('sh-tray', sel.size > 0 && 'on')}>
        <div className="st">{selFiles.slice(-4).map((f, i) => <div key={f.id} style={{ zIndex: i }}><Art f={f} /></div>)}</div>
        <div className="tx"><b>{sel.size}</b> {t('publicPages.media.selected')}<span className="mono dim">{fmtBytes(selFiles.reduce((s, f) => s + f.sizeBytes, 0), lang)}</span></div>
        <button className="sh-btn ghost" onClick={() => setSel(new Set())}>{t('publicPages.media.clear')}</button>
        <button
          className="sh-btn pri"
          disabled={selFiles.length > 1 && !link?.allowZip}
          title={selFiles.length > 1 && !link?.allowZip ? t('publicPages.media.zipDisabled') : undefined}
          onClick={() => askDownload({ files: selFiles, body: { fileIds: selFiles.map((f) => f.id) } })}
        >
          <Ico d={MIC.dl} s={14} />{t('publicPages.media.download')}
        </button>
      </div>

      {lb !== null && shown[lb] && <Lightbox list={shown} idx={lb} setIdx={setLb} onDl={dlOne} lang={lang} t={t} />}
      {gate && data && (
        <Gate
          slug={slug}
          req={gate}
          form={data.form ?? null}
          needForm={needForm}
          me={me}
          zipName={gate.body.folderIds?.length === 1 ? stripNo(byId.get(gate.body.folderIds[0])?.name || zipName) : zipName}
          lang={lang}
          t={t}
          onClose={() => setGate(null)}
          onFormDone={(nm) => { setNeedForm(false); setMe(nm); }}
        />
      )}
    </>,
  );
};
