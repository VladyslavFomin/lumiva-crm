import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageSEO from '../components/PageSEO'
import { useLangPath } from '../hooks/useLangPath'

const API = 'https://pl2.lumiva.agency/api'

const THEMES = ['t1','t2 dk','t3','t4 dk','t5','t6','t7 dk','t8','t9 dk']

function glyph(post: any, idx: number) {
  if (post.coverUrl) return null
  const glyphs = ['№47', '×4.8', 'JTBD', 'A/B', 'Côte', '14M', 'CAC', '64', 'RTB']
  return post.tags?.[0]?.slice(0, 4).toUpperCase() || glyphs[idx % glyphs.length]
}

function readMins(post: any, suffix: string) {
  const words = (post.content || '').split(/\s+/).length
  return Math.max(3, Math.round(words / 200)) + ' ' + suffix
}

function formatDate(d: string) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function BlogPage() {
  const { t, i18n } = useTranslation()
  const { p } = useLangPath()
  const langKey = i18n.language?.startsWith('ru') ? 'ru' : i18n.language?.startsWith('tr') ? 'tr' : 'en'
  const locale = langKey === 'ru' ? 'ru-RU' : langKey === 'tr' ? 'tr-TR' : 'en-GB'
  const issueAbbr = langKey === 'ru' ? 'вып.' : langKey === 'tr' ? 'sayi' : 'issue'
  const articleFallback = langKey === 'ru' ? 'Статья' : langKey === 'tr' ? 'Yazi' : 'Article'

  const hasCyrillic = (v: string) => /[А-Яа-яЁё]/.test(v || '')

  function formatDateByLocale(d: string) {
    if (!d) return ''
    return new Date(d).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
  }

  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [nlDone, setNlDone] = useState(false)
  const nlRef = useRef<HTMLFormElement>(null)

  const CATEGORIES = [
    { key: 'all', label: t('blog.cat_all') },
    { key: 'brand', label: t('blog.cat_brand') },
    { key: 'performance', label: t('blog.cat_perf') },
    { key: 'strategy', label: t('blog.cat_strategy') },
    { key: 'web', label: t('blog.cat_web') },
    { key: 'content', label: t('blog.cat_content') },
    { key: 'smm', label: t('blog.cat_smm') },
    { key: 'analytics', label: t('blog.cat_analytics') },
    { key: 'culture', label: t('blog.cat_culture') },
  ]

  const TOPICS = [
    { label: t('blog.topic1'), filter: 'brand' },
    { label: t('blog.topic2'), filter: 'performance' },
    { label: t('blog.topic3'), filter: 'strategy' },
    { label: t('blog.topic4'), filter: 'web' },
    { label: t('blog.topic5'), filter: 'content' },
    { label: t('blog.topic6'), filter: 'smm' },
    { label: t('blog.topic7'), filter: 'analytics' },
    { label: t('blog.topic8'), filter: 'culture' },
  ]

  useEffect(() => {
    fetch(`${API}/blog?status=published&limit=100&lang=${langKey}`)
      .then(r => r.json())
      .then(d => {
        const items = d.items || []
        // Hide clearly untranslated RU content on EN/TR listings.
        const filtered = langKey === 'ru'
          ? items
          : items.filter((post: any) => !hasCyrillic(`${post.title || ''} ${post.excerpt || ''}`))
        setPosts(filtered)
      })
      .catch(() => setPosts([]))
      .finally(() => setLoading(false))
  }, [langKey])

  // Reveal on scroll — re-run when filter/search changes so newly rendered
  // grid items (that may have previously been in the hero section) get observed.
  useEffect(() => {
    const ro = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) e.target.classList.add('in')
    }), { threshold: 0.1 })
    // Small delay so React has committed the new DOM nodes before we query them.
    const id = setTimeout(() => {
      document.querySelectorAll('.reveal').forEach(el => ro.observe(el))
    }, 50)
    return () => { clearTimeout(id); ro.disconnect() }
  }, [posts, filter, search])

  const featured = posts[0]
  const minis = posts.slice(1, 4)
  const gridPosts = posts.slice(4)

  // "All" with no search: show only posts beyond the hero block (4+) to avoid
  // duplicating the featured/mini cards above. When a category/search is active,
  // scan ALL posts so results include articles that appear in the hero section.
  const filterSource = (filter !== 'all' || search.trim()) ? posts : gridPosts
  const filtered = filterSource.filter(post => {
    const matchCat = filter === 'all' || (post.category || '').toLowerCase() === filter || (post.tags || []).some((tag: string) => tag.toLowerCase() === filter)
    const q = search.trim().toLowerCase()
    const matchQ = !q || (post.title + post.excerpt + (post.tags || []).join(' ')).toLowerCase().includes(q)
    return matchCat && matchQ
  })

  async function handleNl(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const email = (e.currentTarget.elements.namedItem('email') as HTMLInputElement).value
    try {
      await fetch(`${API}/newsletter/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, lang: langKey, source: 'blog' }),
      })
    } catch {}
    setNlDone(true)
  }

  return (
    <>
      <PageSEO
        title={t('blog.eyebrow')}
        description={t('blog.sub')}
        path={p('/blog')}
      />

      {/* HERO */}
      <header className="page-hero">
        <div className="wrap">
          <div className="crumbs">
            <Link to={p('/')}>{t('crumbs.home')}</Link>
            <span className="sep">/</span>
            <span>{t('blog.eyebrow')}</span>
          </div>
          <div className="page-hero-grid">
            <div>
              <div className="page-eyebrow">{t('blog.eyebrow')} · {issueAbbr} {posts.length || '—'}</div>
              <h1 className="page-title">{t('blog.eyebrow')} <em>Lumiva.</em></h1>
            </div>
            <div className="page-hero-side">
              <p>{t('blog.sub')}</p>
              <div className="page-hero-actions">
                <a href="#archive" className="btn btn-primary">{t('blog.fresh')}<span className="arrow">↗</span></a>
                <a href="#newsletter" className="btn btn-ghost">{t('blog.subscribe_btn')}<span className="arrow">↗</span></a>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* FEATURED + SIDE */}
      <section style={{ padding: '88px 0' }}>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">01</span>{t('blog.fresh')}</div>
            <div><h2 className="sec-title">{t('blog.fresh_sub')}</h2></div>
            <a href="#archive" className="btn btn-ghost show-all">{t('blog.all')}<span className="arrow">↗</span></a>
          </div>

          {loading && <p style={{ color: 'var(--muted)', marginTop: 48 }}>{t('blog.loading')}</p>}

          {!loading && posts.length === 0 && (
            <p style={{ color: 'var(--muted)', marginTop: 48 }}>{t('blog.coming_soon')}</p>
          )}

          {!loading && featured && (
            <div className="blog-top">
              <Link className="featured reveal" to={p(`/blog/${featured.slug}`)}>
                <div className="art">
                  <div className="grid-deco"></div>
                  <div className="blob b1"></div>
                  <div className="blob b2"></div>
                  <div className="word">№{posts.length}</div>
                </div>
                <div className="feat-go">↗</div>
                <div className="inner">
                  <span className="feat-tag">
                    {featured.category || featured.tags?.[0] || articleFallback} · {formatDateByLocale(featured.publishedAt || featured.createdAt)}
                  </span>
                  <h2 dangerouslySetInnerHTML={{ __html: featured.title }} />
                  {featured.excerpt && <p>{featured.excerpt}</p>}
                  <div className="feat-meta">
                    <span>{featured.seoTitle || t('blog.by')}</span>
                    <span className="dot"></span>
                    <span>{readMins(featured, t('blog.read_min'))}</span>
                    {featured.category && <><span className="dot"></span><span>{featured.category}</span></>}
                  </div>
                </div>
              </Link>

              <div className="top-side">
                {minis.map((post, i) => (
                  <Link key={post.id} className="mini reveal" to={p(`/blog/${post.slug}`)} style={{ animationDelay: `${i * 80}ms` }}>
                    <div className="mini-head">
                      <span className="cat">{post.category || post.tags?.[0] || articleFallback}</span>
                      <span>{formatDateByLocale(post.publishedAt || post.createdAt)}</span>
                    </div>
                    <h3 className="mini-title">{post.title}</h3>
                    <div className="mini-foot">
                      <span>{readMins(post, t('blog.read_min'))}</span>
                      <span className="arr">→</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ARTICLES + FILTER */}
      <section id="archive" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="cat-bar">
            <div className="cat-tabs">
              {CATEGORIES.map(c => (
                <button
                  key={c.key}
                  className={`cat-tab${filter === c.key ? ' active' : ''}`}
                  onClick={() => setFilter(c.key)}
                >
                  {c.label}
                  <span className="ct">
                    {c.key === 'all' ? posts.length : posts.filter(post =>
                      (post.category || '').toLowerCase() === c.key ||
                      (post.tags || []).some((tag: string) => tag.toLowerCase() === c.key)
                    ).length || ''}
                  </span>
                </button>
              ))}
            </div>
            <label className="cat-search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7"/><path d="m20 20-3-3"/>
              </svg>
              <input
                type="search"
                placeholder={`${t('blog.search')} — ${posts.length}`}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </label>
          </div>

          <div className="articles">
            {filtered.map((post, i) => {
              const theme = THEMES[i % THEMES.length]
              const isDk = theme.includes('dk')
              return (
                <Link key={post.id} className="article reveal" to={p(`/blog/${post.slug}`)}>
                  <div className="article-thumb">
                    {post.coverUrl ? (
                      <img src={post.coverUrl} alt={post.title}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div className={`article-thumb-inner ${theme}`}>
                        <div className="grid-deco"></div>
                        <div className={`glyph serif${isDk ? '' : ''}`}>{glyph(post, i)}</div>
                      </div>
                    )}
                    <span className="a-pill">{post.category || post.tags?.[0] || articleFallback}</span>
                    <span className="a-mins">{readMins(post, t('blog.read_min'))}</span>
                  </div>
                  <h3>{post.title}</h3>
                  {post.excerpt && <p>{post.excerpt}</p>}
                  <div className="article-meta">
                    <span className="author">
                      <span className={`av${isDk ? ' dk' : ''}`}>{(post.seoTitle || 'K').charAt(0)}</span>
                      {t('blog.by')}
                    </span>
                    <span>{formatDateByLocale(post.publishedAt || post.createdAt)}</span>
                  </div>
                </Link>
              )
            })}
            {!loading && filtered.length === 0 && (search.trim() || filter !== 'all' || posts.length === 0) && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '64px 0', color: 'var(--muted)' }}>
                {posts.length === 0 ? t('blog.coming_soon') : t('blog.not_found')}
              </div>
            )}
          </div>

          {filtered.length > 0 && (
            <div className="load-row">
              <span className="meta">{t('blog.shown')} {filtered.length} / {posts.length}</span>
              {filter === 'all' && !search && (
                <button className="btn btn-ghost">{t('blog.show_more')}<span className="arrow">↓</span></button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* TOPICS */}
      <section style={{ padding: '120px 0' }}>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">02</span>{t('blog.topics_tag')}</div>
            <div>
              <h2 className="sec-title">{t('blog.topics_title')}</h2>
              <p className="sec-sub">{t('blog.topics_sub')}</p>
            </div>
            <a href="#archive" className="btn btn-ghost show-all">{t('blog.all')}<span className="arrow">↗</span></a>
          </div>
          <div className="topics-grid">
            {TOPICS.map(topic => {
              const cnt = posts.filter(post =>
                (post.category || '').toLowerCase() === topic.filter ||
                (post.tags || []).some((tg: string) => tg.toLowerCase() === topic.filter)
              ).length
              return (
                <button key={topic.filter} className="topic reveal" onClick={() => { setFilter(topic.filter); document.getElementById('archive')?.scrollIntoView({ behavior: 'smooth' }) }}>
                  <span className="arr">→</span>
                  <div className="nm">{topic.label}</div>
                  <div className="ct">{cnt || 0}</div>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* NEWSLETTER */}
      <section id="newsletter" style={{ borderBottom: 0 }}>
        <div className="wrap">
          <div className="nl-band reveal">
            <div>
              <h3>{t('blog.subscribe_title')}</h3>
              <p>{t('blog.subscribe_sub2')}</p>
            </div>
            <form className="nl-form" ref={nlRef} onSubmit={handleNl}>
              {nlDone ? (
                <p style={{ color: '#3ee07d', fontFamily: "'JetBrains Mono',monospace", fontSize: 14 }}>{t('blog.subscribed')}</p>
              ) : (
                <>
                  <div className="nl-input">
                    <input type="email" name="email" placeholder={t('blog.subscribe_placeholder')} required />
                    <button type="submit">{t('blog.subscribe_btn')}<span style={{ fontSize: 14 }}>↗</span></button>
                  </div>
                  <div className="nl-checks">
                    <span>{t('blog.frequency')}</span>
                    <span>{t('blog.no_spam')}</span>
                    <span>{t('blog.unsubscribe')}</span>
                  </div>
                  <p className="nl-legal">
                    {t('blog.subscribe_btn')}, <Link to={p('/privacy-policy')}>Privacy Policy</Link>.
                  </p>
                </>
              )}
            </form>
          </div>
        </div>
      </section>
    </>
  )
}
