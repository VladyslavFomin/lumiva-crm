import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageSEO from '../components/PageSEO'
import BlockRenderer, { extractBlockToc } from '../components/BlockRenderer'
import { useLangPath } from '../hooks/useLangPath'

const API = 'https://pl2.lumiva.agency/api'

// ─── Category labels (all languages) ─────────────────────────────────────────

const CAT_LABELS: Record<string, Record<string, string>> = {
  ru: {
    brand:       'Бренд & идентика',
    performance: 'Performance & ROI',
    strategy:    'Стратегия & рынки',
    web:         'Web & UX',
    content:     'Контент & продакшн',
    smm:         'SMM & комьюнити',
    analytics:   'Аналитика & данные',
    culture:     'Культура & команда',
  },
  en: {
    brand:       'Brand & Identity',
    performance: 'Performance & ROI',
    strategy:    'Strategy & Markets',
    web:         'Web & UX',
    content:     'Content & Production',
    smm:         'SMM & Community',
    analytics:   'Analytics & Data',
    culture:     'Culture & Team',
  },
  tr: {
    brand:       'Marka & Kimlik',
    performance: 'Performans & ROI',
    strategy:    'Strateji & Pazarlar',
    web:         'Web & UX',
    content:     'İçerik & Prodüksiyon',
    smm:         'SMM & Topluluk',
    analytics:   'Analitik & Veri',
    culture:     'Kültür & Ekip',
  },
}

// ─── UI strings (all languages) ───────────────────────────────────────────────

const UI: Record<string, {
  journal: string; home: string; journalCrumb: string; articleFallback: string
  toc: string; darkMode: string; bigFont: string; toTop: string
  share: string; copyLink: string; copied: string
  sectionLabel: string; dateLabel: string; readLabel: string; viewsLabel: string
  published: string; minSuffix: string
  authorRole: string; authorBio: string; allArticles: string
  ctaTitle: string; ctaText: string; ctaMeeting: string; ctaAll: string
  ctaSlotsLabel: string; ctaSlotsVal: string
  ctaStartLabel: string; ctaStartVal: string
  ctaReplyLabel: string; ctaReplyVal: string
  ctaNdaLabel: string; ctaNdaVal: string
  relNext: string; relTitle: string; relAll: string
  notFound: string; allPosts: string
  unavailable: string; unavailableSub: string
  emailLabel: string
}> = {
  ru: {
    journal:        'Журнал Lumiva',
    home:           'Главная',
    journalCrumb:   'Журнал',
    articleFallback:'Статья',
    toc:            'Оглавление',
    darkMode:       'Тёмная тема',
    bigFont:        'Крупнее текст',
    toTop:          '↑ Наверх',
    share:          'Поделиться',
    copyLink:       'Копировать ссылку',
    copied:         'Скопировано',
    sectionLabel:   'Раздел',
    dateLabel:      'Дата',
    readLabel:      'Чтение',
    viewsLabel:     'Просмотров',
    published:      'Опубликовано',
    minSuffix:      'мин',
    authorRole:     'Журнал Lumiva',
    authorBio:      'Автор материалов о маркетинге, дизайне и бизнесе в Lumiva.',
    allArticles:    'Все материалы',
    ctaTitle:       'Обсудим ваш проект?',
    ctaText:        'За 45 минут разберём задачи, покажем релевантные кейсы и предложим стратегию — конкретно для вашего бизнеса.',
    ctaMeeting:     'Запросить встречу',
    ctaAll:         'Весь журнал',
    ctaSlotsLabel:  'Слотов на Q3',
    ctaSlotsVal:    '3 из 12',
    ctaStartLabel:  'Старт',
    ctaStartVal:    'июль 2026',
    ctaReplyLabel:  'Ответ',
    ctaReplyVal:    '≤ 1 рабочего дня',
    ctaNdaLabel:    'NDA',
    ctaNdaVal:      'по запросу',
    relNext:        'Дальше',
    relTitle:       'Что ещё почитать.',
    relAll:         'Весь журнал',
    notFound:       'Статья не найдена',
    allPosts:       'Все публикации',
    unavailable:    'Статья пока недоступна.',
    unavailableSub: '',
    emailLabel:     'На почту',
  },
  en: {
    journal:        'Lumiva Journal',
    home:           'Home',
    journalCrumb:   'Journal',
    articleFallback:'Article',
    toc:            'Contents',
    darkMode:       'Dark mode',
    bigFont:        'Larger text',
    toTop:          '↑ Top',
    share:          'Share',
    copyLink:       'Copy link',
    copied:         'Copied',
    sectionLabel:   'Category',
    dateLabel:      'Date',
    readLabel:      'Read time',
    viewsLabel:     'Views',
    published:      'Published',
    minSuffix:      'min',
    authorRole:     'Lumiva Journal',
    authorBio:      'Author of articles on marketing, design and business at Lumiva.',
    allArticles:    'All articles',
    ctaTitle:       'Discuss your project?',
    ctaText:        'In 45 minutes we\'ll review your goals, show relevant cases and propose a strategy — tailored to your business.',
    ctaMeeting:     'Request a meeting',
    ctaAll:         'All articles',
    ctaSlotsLabel:  'Q3 slots',
    ctaSlotsVal:    '3 of 12',
    ctaStartLabel:  'Start',
    ctaStartVal:    'July 2026',
    ctaReplyLabel:  'Reply',
    ctaReplyVal:    '≤ 1 business day',
    ctaNdaLabel:    'NDA',
    ctaNdaVal:      'on request',
    relNext:        'Next',
    relTitle:       'More to read.',
    relAll:         'All articles',
    notFound:       'Article not found',
    allPosts:       'All posts',
    unavailable:    'This article is not available in English yet.',
    unavailableSub: 'You can browse available English posts in the journal.',
    emailLabel:     'Email',
  },
  tr: {
    journal:        'Lumiva Dergisi',
    home:           'Ana Sayfa',
    journalCrumb:   'Dergi',
    articleFallback:'Makale',
    toc:            'İçindekiler',
    darkMode:       'Karanlık mod',
    bigFont:        'Daha büyük yazı',
    toTop:          '↑ Yukarı',
    share:          'Paylaş',
    copyLink:       'Bağlantıyı kopyala',
    copied:         'Kopyalandı',
    sectionLabel:   'Kategori',
    dateLabel:      'Tarih',
    readLabel:      'Okuma süresi',
    viewsLabel:     'Görüntülenme',
    published:      'Yayınlandı',
    minSuffix:      'dk',
    authorRole:     'Lumiva Dergisi',
    authorBio:      'Lumiva\'da pazarlama, tasarım ve iş dünyası üzerine makaleler yazan yazar.',
    allArticles:    'Tüm yazılar',
    ctaTitle:       'Projenizi konuşalım mı?',
    ctaText:        '45 dakikada hedeflerinizi ele alır, ilgili vakaları gösterir ve işletmenize özel bir strateji öneriririz.',
    ctaMeeting:     'Toplantı talep et',
    ctaAll:         'Tüm yazılar',
    ctaSlotsLabel:  'Q3 kontenjanı',
    ctaSlotsVal:    "12'den 3'ü",
    ctaStartLabel:  'Başlangıç',
    ctaStartVal:    'Temmuz 2026',
    ctaReplyLabel:  'Yanıt',
    ctaReplyVal:    '≤ 1 iş günü',
    ctaNdaLabel:    'NDA',
    ctaNdaVal:      'talep üzerine',
    relNext:        'Devam',
    relTitle:       'Daha fazla oku.',
    relAll:         'Tüm yazılar',
    notFound:       'Yazı bulunamadı',
    allPosts:       'Tüm yazılar',
    unavailable:    'Bu makale henüz Türkçe olarak mevcut değil.',
    unavailableSub: 'Dergide mevcut Türkçe yazıları inceleyebilirsiniz.',
    emailLabel:     'E-posta',
  },
}

// ─── Markdown ─────────────────────────────────────────────────────────────────

function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function inlineMd(line: string) {
  return line
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy"/>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

function extractHeadings(content: string): { id: string; text: string }[] {
  let count = 0
  return content.split('\n')
    .filter(l => /^## /.test(l))
    .map(l => {
      count++
      const text = l.slice(3).trim()
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/`[^`]+`/g, '')
      return { id: `s${count}`, text }
    })
}

type Seg = { type: 'html'; html: string } | { type: 'case'; slug: string }

function parseContent(text: string): Seg[] {
  const segs: Seg[] = []
  const lines = text.split('\n')
  let buf: string[] = []
  let inCode = false; let codeBuf: string[] = []
  let listType: 'ul' | 'ol' | null = null
  let h2Count = 0; let firstPara = true

  function flush() { if (buf.length) { segs.push({ type: 'html', html: buf.join('\n') }); buf = [] } }
  function closeList() { if (listType) { buf.push(`</${listType}>`); listType = null } }

  for (const line of lines) {
    if (/^```/.test(line)) {
      if (!inCode) { closeList(); inCode = true; codeBuf = [] }
      else { inCode = false; buf.push(`<pre><code>${codeBuf.map(escHtml).join('\n')}</code></pre>`) }
      continue
    }
    if (inCode) { codeBuf.push(line); continue }

    const cM = line.trim().match(/^::case\[(.+?)\]$/)
    if (cM) { closeList(); flush(); segs.push({ type: 'case', slug: cM[1] }); continue }

    if (/^### /.test(line)) { closeList(); buf.push(`<h3>${inlineMd(line.slice(4))}</h3>`); continue }
    if (/^## /.test(line)) {
      closeList(); h2Count++
      buf.push(`<h2 id="s${h2Count}">${inlineMd(line.slice(3))}</h2>`)
      continue
    }
    if (/^# /.test(line)) { closeList(); buf.push(`<h1>${inlineMd(line.slice(2))}</h1>`); continue }
    if (/^[-*]{3,}$/.test(line.trim())) { closeList(); buf.push('<hr>'); continue }
    if (/^> /.test(line)) {
      closeList()
      buf.push(`<blockquote><p>${inlineMd(line.slice(2))}</p></blockquote>`)
      continue
    }

    const imgM = line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
    if (imgM) { closeList(); buf.push(`<figure><img src="${imgM[2]}" alt="${imgM[1]}" loading="lazy"/></figure>`); continue }

    if (/^[-*] /.test(line)) {
      if (listType !== 'ul') { closeList(); buf.push('<ul>'); listType = 'ul' }
      buf.push(`<li>${inlineMd(line.replace(/^[-*] /, ''))}</li>`); continue
    }
    if (/^\d+\. /.test(line)) {
      if (listType !== 'ol') { closeList(); buf.push('<ol>'); listType = 'ol' }
      buf.push(`<li>${inlineMd(line.replace(/^\d+\. /, ''))}</li>`); continue
    }
    if (!line.trim()) { closeList(); continue }
    closeList()
    if (firstPara) { buf.push(`<p class="drop">${inlineMd(line)}</p>`); firstPara = false }
    else buf.push(`<p>${inlineMd(line)}</p>`)
  }
  closeList(); flush()
  return segs
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string, lang: string) {
  if (!d) return ''
  const locale = lang === 'en' ? 'en-GB' : lang === 'tr' ? 'tr-TR' : 'ru-RU'
  return new Date(d).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
}
function readMins(content: string) {
  return Math.max(2, Math.round((content || '').split(/\s+/).filter(Boolean).length / 200))
}

// ─── Case card ────────────────────────────────────────────────────────────────

function CaseCard({ slug }: { slug: string }) {
  const [data, setData] = useState<any>(null)
  const [done, setDone] = useState(false)
  useEffect(() => {
    fetch(`${API}/cases/${slug}`)
      .then(r => r.ok ? r.json() : null).then(d => { setData(d); setDone(true) }).catch(() => setDone(true))
  }, [slug])
  if (!done) return <div className="case-embed-skeleton" />
  if (!data) return null
  return (
    <a href={`/cases/${slug}`} className="case-embed-card">
      <div className="case-embed-img">
        {data.coverUrl ? <img src={data.coverUrl} alt={data.clientName} loading="lazy" /> : <div className="case-embed-img-ph" />}
        <span className="case-embed-cta">Смотреть кейс</span>
      </div>
      <div className="case-embed-body">
        {data.industry && <p className="case-embed-ind">{data.industry}</p>}
        <h4 className="case-embed-name">{data.clientName}</h4>
        {data.shortResult && <p className="case-embed-result">{data.shortResult}</p>}
        {(data.resultValue || data.resultUnit) && (
          <div className="case-embed-stat">
            {data.resultValue && <span className="case-embed-val">{data.resultValue}</span>}
            {data.resultUnit && <span className="case-embed-unit">{data.resultUnit}</span>}
          </div>
        )}
      </div>
    </a>
  )
}

// ─── Related card ─────────────────────────────────────────────────────────────

const REL_VARIANTS = ['dk', 'lt', 'cr'] as const
const REL_GLYPHS = ['×', 'i', '↗', '∞', '—', '·']

function RelCard({ post, idx, catLabel, minSuffix }: { post: any; idx: number; catLabel: string; minSuffix: string }) {
  const variant = REL_VARIANTS[idx % 3]
  const glyph = REL_GLYPHS[idx % REL_GLYPHS.length]
  const mins = readMins(post.content)
  return (
    <Link to={`/blog/${post.slug}`} className="rel">
      <div className="rel-thumb">
        {post.coverUrl
          ? <div className="rel-thumb-inner"><img src={post.coverUrl} alt={post.title} loading="lazy" /></div>
          : <div className={`rel-thumb-inner ${variant}`}><div className="glyph serif">{glyph}</div></div>
        }
      </div>
      <h3>{post.title}</h3>
      <div className="m">
        <span>{catLabel || post.category || ''} · {mins} {minSuffix}</span>
        {post.publishedAt && <span>{new Date(post.publishedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
      </div>
    </Link>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BlogPostPage() {
  const { i18n } = useTranslation()
  const { p } = useLangPath()
  const { slug } = useParams()
  const lang = i18n.language || 'ru'
  const langKey = lang.startsWith('ru') ? 'ru' : lang.startsWith('tr') ? 'tr' : 'en'
  const isRu = langKey === 'ru'

  const ui = UI[langKey] ?? UI.ru
  const cats = CAT_LABELS[langKey] ?? CAT_LABELS.ru


  // SSR-injected data
  const ssrData = typeof globalThis !== 'undefined' ? (globalThis as any).__SSR_BLOG_DATA__ : null

  const [post, setPost] = useState<any>(ssrData || null)
  const [loading, setLoading] = useState(!ssrData)
  const [notFound, setNotFound] = useState(false)
  const [related, setRelated] = useState<any[]>([])

  const [dark, setDark] = useState(false)
  const [bigFont, setBigFont] = useState(false)
  const [copied, setCopied] = useState(false)

  const articleRef = useRef<HTMLElement>(null)
  const barRef = useRef<HTMLElement>(null)

  // ── Load ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!slug) return
    if (ssrData && ssrData.slug === slug) return
    setLoading(true); setPost(null); setRelated([])
    fetch(`${API}/blog/${slug}?lang=${lang}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(d => { setPost(d) })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [slug, lang])

  useEffect(() => {
    if (!post || !slug) return
    const qs = `status=published&limit=4${post.category ? `&category=${post.category}` : ''}&lang=${lang}`
    fetch(`${API}/blog?${qs}`)
      .then(r => r.json())
      .then(r => setRelated((r.items || []).filter((x: any) => x.slug !== slug).slice(0, 3)))
      .catch(() => {})
  }, [post, lang])

  // ── Progress + TOC ────────────────────────────────────────────────────────

  useEffect(() => {
    const update = () => {
      const el = articleRef.current
      const bar = barRef.current
      if (el && bar) {
        const rect = el.getBoundingClientRect()
        const total = rect.height - window.innerHeight + 200
        const passed = -rect.top + 200
        bar.style.width = `${Math.max(0, Math.min(100, (passed / total) * 100))}%`
      }
      const sections = document.querySelectorAll('.a-prose h2[id]')
      if (sections.length > 0) {
        let activeId = (sections[0] as HTMLElement).id
        sections.forEach(s => { if (s.getBoundingClientRect().top - 140 <= 0) activeId = s.id })
        document.querySelectorAll('#toc a').forEach(a => {
          a.classList.toggle('active', a.getAttribute('href') === `#${activeId}`)
        })
      }
    }
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update) }
  }, [post])

  // ── Dark mode ─────────────────────────────────────────────────────────────

  useEffect(() => {
    document.body.classList.toggle('article-dim', dark)
    return () => document.body.classList.remove('article-dim')
  }, [dark])

  async function handleCopy() {
    try { await navigator.clipboard.writeText(window.location.href) } catch {}
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  // ── Loading states ────────────────────────────────────────────────────────

  if (loading) return (
    <div className="wrap" style={{ paddingTop: 80, paddingBottom: 80 }}>
      <div className="skeleton" style={{ height: 52, borderRadius: 8, marginBottom: 16 }} />
      <div className="skeleton" style={{ height: 320, borderRadius: 16 }} />
    </div>
  )
  if (notFound || !post) return (
    <div className="wrap" style={{ paddingTop: 80, paddingBottom: 80, textAlign: 'center' }}>
      <p style={{ color: 'var(--muted)' }}>{ui.notFound}</p>
      <Link to={p('/blog')} style={{ color: 'var(--accent)' }}>← {ui.allPosts}</Link>
    </div>
  )


  const blocks = Array.isArray(post.blocks) && post.blocks.length > 0 ? post.blocks : null
  const mins = readMins(post.content)
  const segs = blocks ? [] : parseContent(post.content || '')
  const toc = blocks ? extractBlockToc(blocks) : extractHeadings(post.content || '')
  const catLabel = cats[post.category] || post.category || ''
  const authorInitial = post.author ? post.author[0].toUpperCase() : 'L'
  const pageUrl = typeof window !== 'undefined' ? window.location.href : ''

  return (
    <>
      <PageSEO
        title={post.seoTitle || post.title}
        description={post.seoDescription || post.excerpt || ''}
        path={p(`/blog/${post.slug}`)}
        image={post.coverUrl || undefined}
        type="article"
        jsonLd={isRu ? {
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: post.seoTitle || post.title,
          description: post.seoDescription || post.excerpt || '',
          image: post.coverUrl ? [post.coverUrl] : [],
          datePublished: post.publishedAt,
          dateModified: post.updatedAt || post.publishedAt,
          author: { '@type': 'Organization', name: post.author || 'Lumiva Agency', url: 'https://lumiva.agency' },
          publisher: { '@type': 'Organization', name: 'Lumiva Agency', url: 'https://lumiva.agency', logo: { '@type': 'ImageObject', url: 'https://lumiva.agency/favicon.svg' } },
          mainEntityOfPage: { '@type': 'WebPage', '@id': `https://lumiva.agency${p(`/blog/${post.slug}`)}/` },
        } : undefined}
      />

      {/* Reading progress bar */}
      <div className="progress-bar"><i ref={barRef} /></div>

      {/* ── ARTICLE HERO ── */}
      <header className="a-hero">
        <div className="wrap">
          {isRu && (
            <div className="a-meta-row">
              <span className="a-pill dark"><span className="ic" />{ui.journal}</span>
              {catLabel && <span className="a-pill">{catLabel}</span>}
              {Array.isArray(post.tags) && post.tags.filter(Boolean).slice(0, 2).map((t: string) => (
                <span key={t} className="a-pill">{t}</span>
              ))}
            </div>
          )}

          <div className="a-crumbs">
            <Link to={p('/')}>{ui.home}</Link>
            <span className="sep">/</span>
            <Link to={p('/blog')}>{ui.journalCrumb}</Link>
            {isRu && <><span className="sep">/</span><span>{catLabel || ui.articleFallback}</span></>}
          </div>

          <h1 className="a-title">{post.title}</h1>
          {post.excerpt && <p className="a-lead">{post.excerpt}</p>}

          <div className="a-hero-foot">
            <div className="author-row">
              <div className="av">{authorInitial}</div>
              <div className="who">
                <span className="nm">{post.author || 'Lumiva'}</span>
                <span className="rl">{ui.journal}</span>
              </div>
            </div>
            <div className="a-stats">
              {post.publishedAt && (
                <div>
                  <span>{ui.published}</span>
                  <span className="v">{formatDate(post.publishedAt, langKey)}</span>
                </div>
              )}
              <div><span>{ui.readLabel}</span><span className="v">{mins} {ui.minSuffix}</span></div>
              {post.viewCount > 0 && (
                <div><span>{ui.viewsLabel}</span><span className="v">{post.viewCount}</span></div>
              )}
            </div>
          </div>

          <div className={`a-cover${post.coverUrl ? ' has-img' : ''}`}>
            {post.coverUrl
              ? <img src={post.coverUrl} alt={post.title} />
              : <>
                  <div className="grid-deco" />
                  <div className="blob b1" /><div className="blob b2" />
                  <div className="mark">{authorInitial}<span className="dim">.</span></div>
                  <span className="tag-tl">Lumiva · {catLabel || ui.journalCrumb}</span>
                  <div className="cap">
                    <span>{(post.title || '').slice(0, 56)}</span>
                    <span className="lg">{mins}&nbsp;{ui.minSuffix}</span>
                  </div>
                </>
            }
          </div>
        </div>
      </header>

      {/* ── 3-COLUMN BODY ── */}
      <div className="wrap a-body">

        {/* TOC */}
        <aside className="toc" id="toc">
          <div className="lbl">{ui.toc}</div>
          {toc.length > 0 && (
            <ol>
              {toc.map(h => (
                <li key={h.id}>
                  <a
                    href={`#${h.id}`}
                    onClick={e => {
                      e.preventDefault()
                      document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }}
                  >
                    {h.text}
                  </a>
                </li>
              ))}
            </ol>
          )}
          <div className="toc-foot">
            <button className={dark ? 'on' : ''} onClick={() => setDark(v => !v)}>
              <span className="ic">{dark ? '◐' : 'A'}</span>{ui.darkMode}
            </button>
            <button className={bigFont ? 'on' : ''} onClick={() => setBigFont(v => !v)}>
              <span className="ic">⇕</span>{ui.bigFont}
            </button>
            <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>{ui.toTop}</button>
          </div>
        </aside>

        {/* PROSE */}
        <article ref={articleRef} className={`prose a-prose${bigFont ? ' large' : ''}`}>
          {blocks
            ? <BlockRenderer blocks={blocks} />
            : segs.map((seg, i) =>
                seg.type === 'case'
                  ? <CaseCard key={i} slug={seg.slug} />
                  : <div key={i} dangerouslySetInnerHTML={{ __html: seg.html }} />
              )
          }

          {post.author && (
            <div className="a-bio">
              <div className="av">{authorInitial}</div>
              <div>
                <h4>{post.author}</h4>
                <div className="rl">{ui.journal}</div>
                <p>{ui.authorBio}</p>
              </div>
              <div className="follow">
                <Link to={p('/blog')}>{ui.allArticles} ↗</Link>
              </div>
            </div>
          )}
        </article>

        {/* RIGHT RAIL */}
        <aside className="rail">
          <div className="rail-share">
            <div className="lbl">{ui.share}</div>
            <button className={copied ? 'copied' : ''} onClick={handleCopy}>
              <span className="ic">{copied ? '✓' : '↗'}</span>
              {copied ? ui.copied : ui.copyLink}
            </button>
            <a href={`https://t.me/share/url?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(post.title || '')}`} target="_blank" rel="noopener">
              <span className="ic">TG</span>Telegram
            </a>
            <a href={`https://vk.com/share.php?url=${encodeURIComponent(pageUrl)}`} target="_blank" rel="noopener">
              <span className="ic">VK</span>VK
            </a>
            <a href={`mailto:?subject=${encodeURIComponent(post.title || '')}&body=${encodeURIComponent(pageUrl)}`}>
              <span className="ic">@</span>{ui.emailLabel}
            </a>
          </div>
          <div className="rail-meta">
            {catLabel && <div className="row"><span>{ui.sectionLabel}</span><span className="v">{catLabel}</span></div>}
            {post.publishedAt && <div className="row"><span>{ui.dateLabel}</span><span className="v">{new Date(post.publishedAt).toLocaleDateString(langKey === 'en' ? 'en-GB' : langKey === 'tr' ? 'tr-TR' : 'ru-RU', { month: 'short', year: 'numeric' })}</span></div>}
            <div className="row"><span>{ui.readLabel}</span><span className="v">{mins} {ui.minSuffix}</span></div>
            {post.viewCount > 0 && <div className="row"><span>{ui.viewsLabel}</span><span className="v">{post.viewCount}</span></div>}
          </div>
        </aside>
      </div>

      {/* ── ARTICLE CTA ── */}
      <section className="article-cta">
        <div className="wrap">
          <div className="grid">
            <div>
              <h2>{ui.ctaTitle.replace('?', '')} <em>{isRu ? 'проект?' : langKey === 'tr' ? 'mı?' : 'project?'}</em></h2>
              <p>{ui.ctaText}</p>
              <div className="actions">
                <Link to={p('/#contact')} className="btn btn-primary">{ui.ctaMeeting} <span className="arrow">↗</span></Link>
                <Link to={p('/blog')} className="btn btn-ghost">{ui.ctaAll} <span className="arrow">↗</span></Link>
              </div>
            </div>
            <div className="side">
              <div className="row"><div className="lbl">{ui.ctaSlotsLabel}</div><div className="val">{ui.ctaSlotsVal}</div></div>
              <div className="row"><div className="lbl">{ui.ctaStartLabel}</div><div className="val">{ui.ctaStartVal}</div></div>
              <div className="row"><div className="lbl">{ui.ctaReplyLabel}</div><div className="val">{ui.ctaReplyVal}</div></div>
              <div className="row" style={{ borderBottom: 0 }}><div className="lbl">{ui.ctaNdaLabel}</div><div className="val">{ui.ctaNdaVal}</div></div>
            </div>
          </div>
        </div>
      </section>

      {/* ── RELATED ── */}
      {related.length > 0 && (
        <section className="a-related">
          <div className="wrap">
            <div className="rel-head">
              <div className="rel-tag"><span className="num">→</span>{ui.relNext}</div>
              <h2 className="rel-title">{ui.relTitle.replace(/\.$/, '')} <em>.</em></h2>
              <Link to={p('/blog')} className="rel-all">{ui.relAll} <span className="arr">↗</span></Link>
            </div>
            <div className="rel-grid">
              {related.map((r, i) => (
                <RelCard key={r.id} post={r} idx={i} catLabel={cats[r.category] || r.category || ''} minSuffix={ui.minSuffix} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  )
}
