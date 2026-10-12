// Статья блога — дизайн Claude Design blog-v2.html (lh-blog.jsx BlPost). Данные — из CMS pl2 (blogApi.ts),
// блоки рендерит BlogBlocks (тот же формат, что на lumiva.agency).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Icon } from '../landing/LandingSections';
import { BLOG_UI, catLabel, fetchBlogPost, fetchBlogPosts, fmtDate, postBlocks, postDate, readMinutes, type BlogPostT } from './blogApi';
import { BlogBlocks, blogToc } from './BlogBlocks';
import { BlCard, BlCover, BlSideBoxes, useBlogLang } from './BlogPage';
import { SolutionShell } from './solutionKit';

export default function BlogPostPage() {
  const { slug = '' } = useParams();
  const lang = useBlogLang();
  const ui = BLOG_UI[lang];
  const [post, setPost] = useState<BlogPostT | null | undefined>(undefined);
  const [all, setAll] = useState<BlogPostT[]>([]);
  const [err, setErr] = useState(false);
  const [pr, setPr] = useState(0);
  const [copied, setCopied] = useState(false);
  const art = useRef<HTMLElement>(null);

  useEffect(() => {
    const ac = new AbortController();
    setPost(undefined);
    setErr(false);
    fetchBlogPost(slug, lang, ac.signal)
      .then(setPost)
      .catch((e) => {
        if (e?.name !== 'AbortError') setErr(true);
      });
    fetchBlogPosts(lang, ac.signal)
      .then(setAll)
      .catch(() => {});
    window.scrollTo(0, 0);
    return () => ac.abort();
  }, [slug, lang]);

  useEffect(() => {
    if (post) document.title = (post.seoTitle || post.title) + ' — Lumiva CRM';
  }, [post]);

  useEffect(() => {
    const f = () => {
      const el = art.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPr(Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - window.innerHeight * 0.6))));
    };
    f();
    window.addEventListener('scroll', f, { passive: true });
    window.addEventListener('resize', f);
    return () => {
      window.removeEventListener('scroll', f);
      window.removeEventListener('resize', f);
    };
  }, [post]);

  const blocks = useMemo(() => (post ? postBlocks(post) : []), [post]);
  const toc = useMemo(() => blogToc(blocks), [blocks]);
  const rt = post ? readMinutes(post) : 1;
  const others = all.filter((x) => x.slug !== slug);
  const idx = all.findIndex((x) => x.slug === slug);
  const next = all.length > 1 ? all[(idx + 1) % all.length] : undefined;
  const rel = post
    ? others
        .filter((x) => x.category && x.category === post.category)
        .concat(others.filter((x) => !x.category || x.category !== post.category))
        .filter((x) => x.slug !== next?.slug)
        .slice(0, 3)
    : [];

  const share = () => {
    navigator.clipboard?.writeText(window.location.href).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  if (post === null || err) {
    return (
      <SolutionShell activeKey="blog">
        <section className="in-hero pg-hero bl-phero">
          <div className="lh-glow" />
          <div className="in-hero-c bl-phero-c">
            <h1 className="bl-h1">{err ? ui.error : ui.notFound}</h1>
            <p className="in-sub">
              <Link className="lh-btn" to="/blog">
                {ui.toBlog}
                <Icon name="arrow" size={14} stroke={2} />
              </Link>
            </p>
          </div>
        </section>
      </SolutionShell>
    );
  }

  return (
    <SolutionShell activeKey="blog">
      <div className="bl-prog">
        <span style={{ transform: `scaleX(${pr})` }} />
      </div>
      <section className="in-hero pg-hero bl-phero">
        <div className="lh-glow" />
        <div className="in-hero-c bl-phero-c">
          <Link to="/blog" className="bl-back">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M15 6l-6 6 6 6" />
            </svg>
            {ui.back}
          </Link>
          {post ? (
            <>
              <div className="bl-meta">
                {post.category && <span className="bl-cat">{catLabel(post.category, lang)}</span>}
                <span>{fmtDate(postDate(post), lang)}</span>
                <span>·</span>
                <span>
                  {rt} {ui.min}
                </span>
              </div>
              <h1 className="bl-h1">{post.title}</h1>
              {post.excerpt && <p className="in-sub">{post.excerpt}</p>}
            </>
          ) : (
            <div className="bl-state">{ui.loading}</div>
          )}
        </div>
      </section>

      {post && (
        <section className="lp-sec bl-art-w">
          <article className="bl-art" ref={art}>
            <BlCover p={post} big lang={lang} />
            <div className="bl-body">
              <BlogBlocks blocks={blocks} />
            </div>
            <div className="bl-share">
              <span>{ui.share}</span>
              <a className="lh-btn gh sm" href={'https://t.me/share/url?url=' + encodeURIComponent(window.location.href)} target="_blank" rel="noopener noreferrer">
                Telegram
              </a>
              <a className="lh-btn gh sm" href={'https://wa.me/?text=' + encodeURIComponent(post.title + ' ' + window.location.href)} target="_blank" rel="noopener noreferrer">
                WhatsApp
              </a>
              <button type="button" className="lh-btn gh sm" onClick={share}>
                {copied ? ui.copied : ui.copy}
              </button>
            </div>
          </article>
          <aside className="bl-side bl-art-side">
            <BlSideBoxes lang={lang} />
            <div className="bl-stick">
              <div className="bl-box bl-toc">
                <h4>{ui.progress}</h4>
                <div className="bl-toc-r">
                  <svg viewBox="0 0 36 36" aria-hidden>
                    <circle cx="18" cy="18" r="15.9" className="bg" pathLength={100} />
                    <circle cx="18" cy="18" r="15.9" className="fg" pathLength={100} style={{ strokeDasharray: `${pr * 100} 100` }} />
                  </svg>
                  <b>{Math.round(pr * 100)}%</b>
                </div>
                <span>{ui.left(Math.max(0, Math.ceil(rt * (1 - pr))))}</span>
              </div>
              {toc.length > 1 && (
                <div className="bl-box bl-toc-l">
                  <h4>{ui.toc}</h4>
                  {toc.map((h) => (
                    <a key={h.id} href={'#' + h.id}>
                      {h.text}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </section>
      )}

      {post && next && (
        <section className="lp-sec">
          <Link to={'/blog/' + next.slug} className="bl-next">
            <span className="lp-kick">
              <span className="lp-dot" />
              {ui.next}
            </span>
            <b>{next.title}</b>
            <Icon name="arrow" size={18} />
          </Link>
          {rel.length > 0 && (
            <>
              <div className="lp-kick bl-rel-h">
                <span className="lp-dot" />
                {ui.also}
              </div>
              <div className="bl-posts bl-rel">
                {rel.map((x, k) => (
                  <BlCard key={x.slug} p={x} lang={lang} i={k} short />
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </SolutionShell>
  );
}
