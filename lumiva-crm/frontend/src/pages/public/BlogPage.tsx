// Блог — дизайн Claude Design blog-v2.html (lh-blog.jsx BlList, lh-blog.css → .bl-* в lp-kit.css).
// Статьи — из CMS pl2 (blogApi.ts): всё, что там отмечено «Блог CRM». Подписка из макета заменена
// ссылкой на Telegram (рассылки по блогу нет), «популярные» — по реальным просмотрам.
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '../landing/LandingSections';
import { AiCharacter, AI_ROLE_PALETTE } from '../ai-employees/AiCharacter';
import { BLOG_UI, catLabel, catRole, fetchBlogPosts, fmtDate, postDate, readMinutes, type BlogLang, type BlogPostT } from './blogApi';
import { SolutionShell } from './solutionKit';

export function useBlogLang(): BlogLang {
  const { i18n } = useTranslation();
  const c = (i18n.language || 'ru').slice(0, 2);
  return c === 'en' || c === 'tr' ? c : 'ru';
}

/** Обложка: картинка из pl2 или сгенерированная (персонаж ИИ-сотрудника по рубрике). */
export function BlCover({ p, big, lang }: { p: BlogPostT; big?: boolean; lang: BlogLang }) {
  if (p.coverUrl) {
    return (
      <div className={'bl-cov img' + (big ? ' big' : '')}>
        <img src={p.coverUrl} alt="" loading={big ? 'eager' : 'lazy'} />
      </div>
    );
  }
  const role = catRole(p.category);
  const pal = AI_ROLE_PALETTE[role] || AI_ROLE_PALETTE.crm_analyst;
  const tags = (p.tags || []).filter(Boolean).slice(0, 3);
  return (
    <div className={'bl-cov' + (big ? ' big' : '')} style={{ '--pbg': pal.bg, '--pd': pal.d } as React.CSSProperties}>
      <div className="bl-cov-bars">
        {[65, 40, 80, 55].map((w, i) => (
          <span key={i} style={{ width: w + '%', animationDelay: 0.3 + i * 0.1 + 's' }} />
        ))}
      </div>
      <div className="bl-cov-tags">
        {(tags.length ? tags : [catLabel(p.category, lang)].filter(Boolean)).map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
      <div className="bl-cov-fig">
        <AiCharacter role={role} mood="on" />
      </div>
    </div>
  );
}

export function BlCard({ p, lang, i, short }: { p: BlogPostT; lang: BlogLang; i: number; short?: boolean }) {
  const ui = BLOG_UI[lang];
  return (
    <Link to={'/blog/' + p.slug} className="bl-card" style={{ animationDelay: i * 0.07 + 's' }}>
      <BlCover p={p} lang={lang} />
      <div className="bl-card-b">
        <div className="bl-card-m">
          {p.category ? <span className="bl-cat">{catLabel(p.category, lang)}</span> : <span />}
          <span>
            {readMinutes(p)} {ui.min}
          </span>
        </div>
        <h3>{p.title}</h3>
        {!short && p.excerpt && <p>{p.excerpt}</p>}
        {!short && (
          <div className="bl-card-f">
            <span>{fmtDate(postDate(p), lang)}</span>
            <span className="bl-read">
              {ui.read}
              <Icon name="arrow" size={12} stroke={2} />
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

export function BlSideBoxes({ lang }: { lang: BlogLang }) {
  const ui = BLOG_UI[lang];
  const navigate = useNavigate();
  return (
    <>
      <div className="bl-box bl-sub">
        <h4>{ui.tryT}</h4>
        <p>{ui.tryD}</p>
        <button type="button" className="lh-btn block" onClick={() => navigate('/?mode=signup')}>
          {ui.tryBtn}
          <Icon name="arrow" size={14} stroke={2} />
        </button>
      </div>
      <div className="bl-box bl-sub">
        <h4>{ui.tgT}</h4>
        <p>{ui.tgD}</p>
        <a className="lh-btn gh block" href="https://t.me/lumiva_crm" target="_blank" rel="noopener noreferrer">
          {ui.tgBtn}
        </a>
      </div>
    </>
  );
}

function Chips({ cats, cat, setCat, lang }: { cats: string[]; cat: string | null; setCat: (c: string | null) => void; lang: BlogLang }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState({ l: 0, t: 0, w: 0, h: 0 });
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    const m = () => {
      const el = box.querySelector<HTMLElement>('button.on');
      if (el) setInd({ l: el.offsetLeft, t: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight });
    };
    m();
    const ro = new ResizeObserver(m);
    ro.observe(box);
    return () => ro.disconnect();
  }, [cat, cats.length, lang]);
  return (
    <div className="in-chips bl-chips" ref={ref}>
      <span className="in-chips-ind" style={{ transform: `translate(${ind.l}px,${ind.t}px)`, width: ind.w, height: ind.h }} />
      <button type="button" className={!cat ? 'on' : ''} onClick={() => setCat(null)}>
        {BLOG_UI[lang].all}
      </button>
      {cats.map((k) => (
        <button type="button" key={k} className={cat === k ? 'on' : ''} onClick={() => setCat(cat === k ? null : k)}>
          {catLabel(k, lang)}
        </button>
      ))}
    </div>
  );
}

export default function BlogPage() {
  const lang = useBlogLang();
  const ui = BLOG_UI[lang];
  const [posts, setPosts] = useState<BlogPostT[] | null>(null);
  const [err, setErr] = useState(false);
  const [cat, setCat] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const ac = new AbortController();
    setErr(false);
    fetchBlogPosts(lang, ac.signal)
      .then(setPosts)
      .catch((e) => {
        if (e?.name !== 'AbortError') setErr(true);
      });
    return () => ac.abort();
  }, [lang, tick]);

  useEffect(() => {
    document.title = `${ui.h1a} — Lumiva CRM`;
  }, [ui.h1a]);

  const list = posts || [];
  const cats = useMemo(() => Array.from(new Set(list.map((p) => p.category).filter((c): c is string => !!c))), [list]);
  const feat = list[0];
  const rest = list.slice(1).filter((p) => !cat || p.category === cat);
  const popular = [...list].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0)).slice(0, 3);

  return (
    <SolutionShell activeKey="blog">
      <section className="in-hero pg-hero bl-hero">
        <div className="lh-glow" />
        <div className="in-hero-c">
          <div className="in-kick">
            <span className="lh-live">
              <i />
            </span>
            {posts ? ui.kick(list.length) : 'Blog'}
          </div>
          <h1 className="in-h1">
            {ui.h1a}
            <br />
            <em>{ui.h1b}</em>
          </h1>
          <p className="in-sub">{ui.sub}</p>
        </div>
      </section>

      <section className="lp-sec bl">
        {!posts && !err && <div className="bl-state">{ui.loading}</div>}
        {err && (
          <div className="bl-state">
            {ui.error}{' '}
            <button type="button" className="lh-btn gh sm" onClick={() => setTick((x) => x + 1)}>
              {ui.retry}
            </button>
          </div>
        )}
        {posts && !list.length && <div className="bl-state">{ui.none}</div>}

        {feat && (
          <Link to={'/blog/' + feat.slug} className="bl-feat">
            <div className="bl-feat-t">
              <div className="bl-meta">
                <span className="bl-badge">{ui.featured}</span>
                <span>{fmtDate(postDate(feat), lang)}</span>
                <span>·</span>
                <span>
                  {readMinutes(feat)} {ui.min}
                </span>
              </div>
              <h2>{feat.title}</h2>
              {feat.excerpt && <p>{feat.excerpt}</p>}
              <span className="lh-btn">
                {ui.read}
                <Icon name="arrow" size={14} stroke={2} />
              </span>
            </div>
            <BlCover p={feat} big lang={lang} />
          </Link>
        )}

        {list.length > 1 && (
          <div className="bl-g">
            <div>
              {cats.length > 1 && <Chips cats={cats} cat={cat} setCat={setCat} lang={lang} />}
              <div className="bl-posts" key={cat || 'all'}>
                {rest.map((p, i) => (
                  <BlCard key={p.slug} p={p} lang={lang} i={i} />
                ))}
                {!rest.length && <div className="in-empty">{ui.emptyCat}</div>}
              </div>
            </div>
            <aside className="bl-side">
              <BlSideBoxes lang={lang} />
              {cats.length > 1 && (
                <div className="bl-box">
                  <h4>{ui.cats}</h4>
                  {cats.map((k) => (
                    <button type="button" key={k} className={'bl-cat-r' + (cat === k ? ' on' : '')} onClick={() => setCat(cat === k ? null : k)}>
                      <span>{catLabel(k, lang)}</span>
                      <em>{list.filter((p) => p.category === k).length}</em>
                    </button>
                  ))}
                </div>
              )}
              <div className="bl-box">
                <h4>{ui.popular}</h4>
                {popular.map((p, i) => (
                  <Link key={p.slug} to={'/blog/' + p.slug} className="bl-pop">
                    <b>{'0' + (i + 1)}</b>
                    <span>{p.title}</span>
                  </Link>
                ))}
              </div>
            </aside>
          </div>
        )}
      </section>
    </SolutionShell>
  );
}
