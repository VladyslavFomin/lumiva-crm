import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLangPath } from '../hooks/useLangPath'
import PageSEO from '../components/PageSEO'
import { trackEvent } from '../lib/analytics'

const API = 'https://pl2.lumiva.agency/api'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Kpi { value: string | number; prefix?: string; suffix?: string; label: string; source: string }
interface Chapter { id: string; num: string; title: string; lead?: string }
interface Testimonial { quote: string; authorName: string; authorRole: string; authorInitials: string }
interface Challenge { index: string; category: string; title: string; body: string }
interface ApproachItem { num: string; title: string; body: string }
interface TimelineRow { week: string; phase: string; description: string }
interface Color { hex: string; label: string; dark?: boolean }
interface Deliverable { name: string; category: string }
interface FunnelRow { name: string; width: string | number; label: string }
interface NextCaseMeta { label: string; value: string }

interface CaseData {
  id: number; slug: string; clientName: string; industry?: string; services?: string[]
  tags?: string[]; year?: number; shortResult?: string; resultValue?: string; resultUnit?: string
  seoTitle?: string; seoDescription?: string; coverUrl?: string
  segment?: string; markets?: string; duration?: string; teamSize?: string; leadText?: string
  coverWatermark?: string; coverCaption?: string; coverRibbon?: string
  kpis?: Kpi[]; chapters?: Chapter[]; testimonials?: Testimonial[]
  challenges?: Challenge[]; approachItems?: ApproachItem[]; timeline?: TimelineRow[]
  colors?: Color[]; primaryFont?: string; bodyFont?: string; wordmark?: string; cardNumber?: string
  beforeText?: string; beforeDescription?: string; afterDescription?: string
  deliverables?: Deliverable[]; funnelData?: FunnelRow[]
  lineChartTitle?: string; lineChartValue?: string; lineChartDelta?: string
  nextCaseSlug?: string; nextCaseTitle?: string; nextCaseMeta?: NextCaseMeta[]; nextCaseDeco?: string
  settings?: Record<string, boolean>; customHtml?: string; customCss?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseHtml(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
}

function renderTitle(text: string) {
  const parts = text.split(/(\*[^*]+\*)/g)
  return parts.map((p, i) =>
    p.startsWith('*') && p.endsWith('*') ? <em key={i}>{p.slice(1, -1)}</em> : p
  )
}

// ─── KPI Cell ────────────────────────────────────────────────────────────────

function KpiCell({ kpi, index }: { kpi: Kpi; index: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const played = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const animEl = el
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !played.current) {
          played.current = true
          const target = parseFloat(String(kpi.value))
          const decimals = (String(kpi.value).split('.')[1] || '').length
          const suf = kpi.suffix || ''
          const pref = kpi.prefix || ''
          const dur = 1400, t0 = performance.now()
          function tick(now: number) {
            const t = Math.min(1, (now - t0) / dur)
            const e = 1 - Math.pow(1 - t, 3)
            animEl.textContent = pref + (target * e).toFixed(decimals) + suf
            if (t < 1) requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
        }
      })
    }, { threshold: 0.3 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [kpi])

  const initial = (kpi.prefix || '') + '0' + (kpi.suffix || '')

  return (
    <div className="k reveal">
      <span className="corner">[0{index + 1}]</span>
      <div className="v" ref={ref}>{initial}</div>
      <div className="kpi-lbl">{kpi.label}</div>
      <div className="kpi-src">{kpi.source}</div>
    </div>
  )
}

// ─── Funnel ──────────────────────────────────────────────────────────────────

function FunnelChart({ rows }: { rows: FunnelRow[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const barRefs = useRef<(HTMLElement | null | undefined)[]>([])
  const animated = useRef(false)

  useEffect(() => {
    const container = ref.current
    if (!container) return
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !animated.current) {
          animated.current = true
          barRefs.current.forEach((bar, i) => {
            if (bar) (bar as HTMLElement).style.width = parseFloat(String(rows[i]?.width ?? 0)) + '%'
          })
        }
      })
    }, { threshold: 0.3 })
    observer.observe(container)
    return () => observer.disconnect()
  }, [rows])

  return (
    <div className="seg-funnel" ref={ref}>
      {rows.map((row, i) => (
        <div className="row" key={i}>
          <div className="nm">{row.name}</div>
          <div className="bar"><i ref={(el: HTMLElement | null) => { barRefs.current[i] = el }} style={{ width: 0 }} /></div>
          <div className="pc">{row.label}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Testimonial ─────────────────────────────────────────────────────────────

function TestiBlock({ t }: { t: Testimonial }) {
  return (
    <div className="testi reveal">
      <q dangerouslySetInnerHTML={{ __html: parseHtml(t.quote) }} />
      <div className="from">
        <div className="av">{t.authorInitials || t.authorName?.[0] || '?'}</div>
        <div>
          <div className="nm">{t.authorName}</div>
          <div className="rl">{t.authorRole}</div>
        </div>
      </div>
    </div>
  )
}

// ─── Chapter head ─────────────────────────────────────────────────────────────

function ChapHead({ num, title }: { num: string; title: string }) {
  return (
    <div className="chap-head reveal">
      <span className="chap-num">{num}</span>
      <h2>{renderTitle(title)}</h2>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CasePage() {
  const { slug } = useParams<{ slug: string }>()
  const { p } = useLangPath()
  const { t, i18n } = useTranslation()
  const langKey = i18n.language?.startsWith('ru') ? 'ru' : i18n.language?.startsWith('tr') ? 'tr' : 'en'

  const [caseData, setCaseData] = useState<CaseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activeChap, setActiveChap] = useState<string>('')

  const chapRefs = useRef<Map<string, HTMLElement>>(new Map())

  useEffect(() => {
    if (!slug) return
    setLoading(true); setCaseData(null); setNotFound(false)
    fetch(`${API}/cases/${slug}?lang=${langKey}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(d => {
        setCaseData(d)
        trackEvent('case_view', { case_slug: slug, client_name: d?.clientName })
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [slug, langKey])

  const updateNav = useCallback(() => {
    const ids = Array.from(chapRefs.current.keys())
    let active = ids[0] || ''
    for (const id of ids) {
      const el = chapRefs.current.get(id)
      if (el && el.getBoundingClientRect().top - 140 <= 0) active = id
    }
    setActiveChap(active)
  }, [])

  useEffect(() => {
    window.addEventListener('scroll', updateNav, { passive: true })
    updateNav()
    return () => window.removeEventListener('scroll', updateNav)
  }, [updateNav, caseData])

  useEffect(() => {
    if (!caseData) return
    const ro = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in') }),
      { threshold: 0.12 }
    )
    document.querySelectorAll('.reveal:not(.in)').forEach(el => ro.observe(el))
    return () => ro.disconnect()
  }, [caseData])

  function scrollToChap(id: string) {
    const el = chapRefs.current.get(id) || document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function setChapRef(id: string) {
    return (el: HTMLElement | null) => { if (el) chapRefs.current.set(id, el) }
  }

  if (loading) {
    return (
      <div className="wrap" style={{ paddingTop: 80, paddingBottom: 80 }}>
        <div className="skel" style={{ height: 40, borderRadius: 8, marginBottom: 20, width: '60%' }} />
        <div className="skel" style={{ height: 80, borderRadius: 8, marginBottom: 16, width: '80%' }} />
        <div className="skel" style={{ height: 480, borderRadius: 16 }} />
      </div>
    )
  }

  if (notFound || !caseData) {
    return (
      <div className="wrap" style={{ paddingTop: 80, paddingBottom: 80, textAlign: 'center' }}>
        <p style={{ color: 'var(--muted)' }}>{t('case.not_found')}</p>
        <Link to={p('/cases')} style={{ color: 'var(--ink)' }}>{t('case.back_to_cases')}</Link>
      </div>
    )
  }

  const c = caseData
  const cfg = c.settings || {}
  const s = (key: string) => key in cfg ? cfg[key] : true

  const chapters = Array.isArray(c.chapters) ? c.chapters : []
  const kpis = Array.isArray(c.kpis) ? c.kpis : []
  const tags = Array.isArray(c.tags) ? c.tags : []
  const services = Array.isArray(c.services) ? c.services : []
  const challenges = Array.isArray(c.challenges) ? c.challenges : []
  const approachItems = Array.isArray(c.approachItems) ? c.approachItems : []
  const timelineRows = Array.isArray(c.timeline) ? c.timeline : []
  const colors = Array.isArray(c.colors) ? c.colors : []
  const deliverables = Array.isArray(c.deliverables) ? c.deliverables : []
  const funnelData = Array.isArray(c.funnelData) ? c.funnelData : []
  const testimonials = Array.isArray(c.testimonials) ? c.testimonials : []
  const nextCaseMeta = Array.isArray(c.nextCaseMeta) ? c.nextCaseMeta : []

  // Section definitions — ch() pulls title/num from chapters array if filled, else defaults
  const SECS = [
    { id: 'brief',     defaultNum: '§ 01', defaultTitle: t('case.sec01_title') },
    { id: 'challenge', defaultNum: '§ 02', defaultTitle: t('case.sec02_title') },
    { id: 'approach',  defaultNum: '§ 03', defaultTitle: t('case.sec03_title') },
    { id: 'timeline',  defaultNum: '§ 04', defaultTitle: t('case.sec04_title') },
    { id: 'identity',  defaultNum: '§ 05', defaultTitle: t('case.sec05_title') },
    { id: 'web',       defaultNum: '§ 06', defaultTitle: t('case.sec06_title') },
    { id: 'results',   defaultNum: '§ 07', defaultTitle: t('case.sec07_title') },
  ]

  function ch(idx: number) {
    const cap = chapters[idx]
    const def = SECS[idx]
    return {
      id: cap?.id || def.id,
      num: cap?.num || def.defaultNum,
      title: cap?.title || def.defaultTitle,
      lead: cap?.lead || '',
    }
  }

  // Which sections have content to show
  const hasIdentity = colors.length > 0 || deliverables.length > 0 || !!c.primaryFont || !!c.wordmark
  const hasDigital = !!c.lineChartTitle || funnelData.length > 0
  const hasResults = testimonials.length > 1

  // Nav: use chapters if defined, else build from content
  const navItems: { id: string; label: string }[] = chapters.length > 0
    ? chapters.map(cp => ({ id: cp.id, label: cp.title }))
    : [
        ...(testimonials[0] ? [{ id: 'brief', label: t('case.nav_brief') }] : []),
        ...(challenges.length > 0 ? [{ id: 'challenge', label: t('case.nav_challenge') }] : []),
        ...(approachItems.length > 0 ? [{ id: 'approach', label: t('case.nav_approach') }] : []),
        ...(timelineRows.length > 0 ? [{ id: 'timeline', label: t('case.nav_timeline') }] : []),
        ...(hasIdentity ? [{ id: 'identity', label: t('case.nav_identity') }] : []),
        ...(hasDigital ? [{ id: 'web', label: t('case.nav_web') }] : []),
        ...(hasResults ? [{ id: 'results', label: t('case.nav_results') }] : []),
      ]

  const yearTag = c.year ? t('case.badge_with_year', { year: c.year }) : t('case.badge')
  const ribbonText = c.coverRibbon || [c.duration, c.year].filter(Boolean).join(' · ')

  return (
    <>
      {c.customCss && <style dangerouslySetInnerHTML={{ __html: c.customCss }} />}

      <PageSEO
        title={c.seoTitle || c.clientName}
        description={c.seoDescription || c.leadText || ''}
        path={p(`/cases/${c.slug}`)}
        image={c.coverUrl || undefined}
        type="article"
        jsonLd={{
          '@context': 'https://schema.org', '@type': 'Article',
          headline: c.seoTitle || c.clientName, description: c.seoDescription || '',
          author: { '@type': 'Organization', name: 'Lumiva Agency', url: 'https://lumiva.agency' },
          publisher: { '@type': 'Organization', name: 'Lumiva Agency', url: 'https://lumiva.agency' },
        }}
      />

      {/* ── HERO ── */}
      <header className="case-hero">
        <div className="wrap">
          <div className="crumbs">
            <Link to={p('/')}>{t('crumbs.home')}</Link>
            <span className="sep">/</span>
            <Link to={p('/cases')}>{t('cases.eyebrow')}</Link>
            <span className="sep">/</span>
            <span>{c.clientName}</span>
          </div>

          <div className="case-pills">
            <span className="cp dark"><span className="ic" />{yearTag}</span>
            {tags.map((tag, i) => <span key={i} className="cp">{tag}</span>)}
            {c.industry && <span className="cp">{c.industry}</span>}
          </div>

          <div className="case-hero-grid">
            <div>
              <h1 className="case-title">{renderTitle(c.clientName)}</h1>
              {c.leadText && <p className="case-lead">{c.leadText}</p>}
            </div>
            <aside className="case-aside">
              <div className="row"><span className="lbl">{t('case.lbl_client')}</span><span className="val">{c.clientName}</span></div>
              {c.segment && <div className="row"><span className="lbl">{t('case.lbl_segment')}</span><span className="val">{c.segment}</span></div>}
              {c.markets && <div className="row"><span className="lbl">{t('case.lbl_markets')}</span><span className="val">{c.markets}</span></div>}
              {c.duration && <div className="row"><span className="lbl">{t('case.lbl_duration')}</span><span className="val">{c.duration}</span></div>}
              {c.teamSize && <div className="row"><span className="lbl">{t('case.lbl_team')}</span><span className="val">{c.teamSize}</span></div>}
              {services.length > 0 && (
                <div className="row tags">
                  <span className="lbl">{t('crumbs.services')}</span>
                  <span className="val">{services.map((s, i) => <span key={i}>{s}</span>)}</span>
                </div>
              )}
            </aside>
          </div>
        </div>

        {/* Cover */}
        <div className="case-cover">
          {c.coverUrl ? (
            <div className="inner has-photo" style={{ padding: '48px 0' }}>
              <img
                src={c.coverUrl} alt={c.clientName} loading="eager"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', position: 'absolute', inset: 0 }}
              />
              {ribbonText && <div className="ribbon">{ribbonText}</div>}
              <div className="wrap" style={{ position: 'relative', zIndex: 2 }}>
                <div className="cap">
                  <span>FIG. 01 · {c.industry || 'Portfolio'}</span>
                  {c.coverCaption && <span className="big">{c.coverCaption}</span>}
                </div>
              </div>
            </div>
          ) : (
            <div className="inner">
              <div className="grid-deco" />
              <div className="blob b1" />
              <div className="blob b2" />
              {c.coverWatermark && (
                <div className="wm">
                  {c.coverWatermark.split('/').map((part, i) => (
                    <span key={i}>{i > 0 && <span className="dim">/</span>}{part}</span>
                  ))}
                </div>
              )}
              {ribbonText && <div className="ribbon">{ribbonText}</div>}
              <div className="wrap" style={{ position: 'relative', zIndex: 2 }}>
                <div className="cap">
                  <span>FIG. 01 · {c.industry || 'Portfolio'}</span>
                  {c.coverCaption && <span className="big">{c.coverCaption}</span>}
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ── KPI STRIP ── */}
      {kpis.length > 0 && (
        <section style={{ padding: 0, borderBottom: 0 }}>
          <div className="wrap">
            <div className="kpi">
              {kpis.map((kpi, i) => <KpiCell key={i} kpi={kpi} index={i} />)}
            </div>
          </div>
        </section>
      )}

      {/* ── BODY ── */}
      <main>
        <div className="wrap case-body">

          {/* Chapter nav */}
          {navItems.length > 0 && (
            <aside className="chap-nav" id="chapNav">
              <div className="lbl">{t('case.badge')}</div>
              <ol>
                {navItems.map(item => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      className={activeChap === item.id ? 'active' : ''}
                      onClick={e => { e.preventDefault(); scrollToChap(item.id) }}
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ol>
            </aside>
          )}

          <article>

            {/* ── BRIEF ── */}
            {s('showBrief') && (testimonials[0] || c.leadText || chapters[0]) && (
              <section className="chap" id={ch(0).id} ref={setChapRef(ch(0).id)}>
                {ch(0).title && <ChapHead num={ch(0).num} title={ch(0).title} />}
                {ch(0).lead && (
                  <p className="chap-lead" dangerouslySetInnerHTML={{ __html: parseHtml(ch(0).lead) }} />
                )}
                {testimonials[0] && <TestiBlock t={testimonials[0]} />}
              </section>
            )}

            {/* ── CHALLENGES ── */}
            {s('showChallenge') && challenges.length > 0 && (
              <section className="chap" id={ch(1).id} ref={setChapRef(ch(1).id)}>
                <ChapHead num={ch(1).num} title={ch(1).title} />
                {ch(1).lead && <p className="chap-lead">{ch(1).lead}</p>}
                <div className="chal-grid">
                  {challenges.map((item, i) => (
                    <div key={i} className="chal reveal">
                      <div className="ix"><span>{item.index}</span><span>{item.category}</span></div>
                      <h4>{renderTitle(item.title)}</h4>
                      <p>{item.body}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── APPROACH ── */}
            {s('showApproach') && approachItems.length > 0 && (
              <section className="chap" id={ch(2).id} ref={setChapRef(ch(2).id)}>
                <ChapHead num={ch(2).num} title={ch(2).title} />
                {ch(2).lead && (
                  <p className="chap-lead" dangerouslySetInnerHTML={{ __html: parseHtml(ch(2).lead) }} />
                )}
                <div className="split">
                  {approachItems.map((item, i) => (
                    <div key={i} className="col reveal">
                      <div className="num">{item.num}</div>
                      <div><h4>{renderTitle(item.title)}</h4><p>{item.body}</p></div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── TIMELINE ── */}
            {s('showTimeline') && timelineRows.length > 0 && (
              <section className="chap" id={ch(3).id} ref={setChapRef(ch(3).id)}>
                <ChapHead num={ch(3).num} title={ch(3).title} />
                {ch(3).lead && <p className="chap-lead">{ch(3).lead}</p>}
                <div className="tl">
                  {timelineRows.map((row, i) => (
                    <div key={i} className="row reveal">
                      <div className="wk">{row.week}</div>
                      <div className="ph">{renderTitle(row.phase)}</div>
                      <div className="desc">{row.description}</div>
                      <div className="arr">→</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── IDENTITY ── */}
            {s('showIdentity') && hasIdentity && (
              <section className="chap" id={ch(4).id} ref={setChapRef(ch(4).id)}>
                <ChapHead num={ch(4).num} title={ch(4).title} />
                {ch(4).lead && <p className="chap-lead">{ch(4).lead}</p>}

                <div className="deck">
                  {/* Slot 1: Logomark SVG */}
                  {s('showLogomark') && (
                    <div className="slot s1 reveal">
                      <div className="grid-deco" />
                      <span className="corner-tag" style={{ background: 'rgba(255,255,255,.92)', color: '#222' }}>FIG. 02 · Logomark</span>
                      <div className="mark">
                        <svg viewBox="0 0 200 200" fill="none" aria-hidden="true">
                          <path d="M40 160 L40 40 L160 160 L160 40" stroke="#fff" strokeWidth="14" strokeLinejoin="miter" />
                          <line x1="20" y1="180" x2="180" y2="180" stroke="#fff" strokeWidth="3" />
                        </svg>
                      </div>
                      <div className="label">
                        <span className="nm" style={{ color: '#fff' }}>{c.wordmark || c.clientName}</span>
                        <span style={{ color: 'rgba(255,255,255,.6)' }}>Primary mark · 1:1 grid</span>
                      </div>
                    </div>
                  )}

                  {/* Slot 2: Typography */}
                  {s('showTypography') && (
                    <div className="slot s2 reveal">
                      <span className="corner-tag">FIG. 03 · Type</span>
                      <div className="type">
                        <small>Display · {c.primaryFont || 'Instrument Serif'}</small>
                        Aa<em>Aa</em>
                      </div>
                      <div className="label">
                        <span className="nm">Aa</span>
                        <span>Body · {c.bodyFont || 'Geist'} · 16/24</span>
                      </div>
                    </div>
                  )}

                  {/* Row: palette + card + web */}
                  {(s('showPalette') || s('showCardMock') || s('showWebMock')) && (
                    <div className="deck-row">
                      {/* Slot 3: Palette */}
                      {s('showPalette') && (
                        <div className="slot s3 reveal">
                          <span className="corner-tag">FIG. 04 · Palette</span>
                          <div className="sw">
                            {colors.length > 0 ? colors.map((col, i) => (
                              <div key={i} className={`c${col.dark ? '' : ' l'}`} style={{ background: col.hex }}>
                                {col.label}
                              </div>
                            )) : (
                              <>
                                <div className="c" style={{ background: '#222' }}>#222</div>
                                <div className="c l" style={{ background: '#f5f3ee' }}>#F5F3EE</div>
                                <div className="c l" style={{ background: '#dcd6c4' }}>#DCD6C4</div>
                                <div className="c" style={{ background: '#1f3a2f' }}>#1F3A2F</div>
                                <div className="c" style={{ background: '#ff4d14' }}>#FF4D14</div>
                              </>
                            )}
                          </div>
                          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                            Core · Accent · Signal
                          </div>
                        </div>
                      )}

                      {/* Slot 4: Card mock */}
                      {s('showCardMock') && (
                        <div className="slot s4 dk reveal">
                          <div className="card-bg" />
                          <span className="corner-tag">FIG. 05 · Card</span>
                          <div className="cardmock">
                            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'rgba(255,255,255,.55)', textTransform: 'uppercase', letterSpacing: '.12em' }}>
                              {c.clientName} / Private
                            </div>
                            <div>
                              <div className="chip" />
                              <div className="num">{c.cardNumber || '•••• •••• •••• ••••'}</div>
                              <div className="nb">{c.wordmark || c.clientName}</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Slot 5: Web mock */}
                      {s('showWebMock') && (
                        <div className="slot s5 reveal">
                          <span className="corner-tag">FIG. 06 · Web</span>
                          <div className="browser"><span /><span /><span /></div>
                          <div className="web">
                            <div className="hh">{renderTitle(c.leadText?.slice(0, 50) || t('case.mock_web_headline'))}</div>
                            <div className="ln m" /><div className="ln s" />
                            <span className="btn-m">{t('case.mock_web_cta')}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Slot 6: Print spread */}
                  {s('showPrintSpread') && (
                    <div className="deck-row" style={{ gridTemplateColumns: '1fr' }}>
                      <div className="slot s6 reveal">
                        <span className="corner-tag">FIG. 07 · Annual report {c.year || 2025}</span>
                        <div className="spread">
                          <div className="pg">
                            <h5>{renderTitle(t('case.mock_year_numbers'))}</h5>
                            <div className="ln m" /><div className="ln s" /><div className="ln m" /><div className="ln s" />
                            <div className="num">— 04 / 38</div>
                          </div>
                          <div className="pg">
                            <h5 style={{ fontSize: 48, lineHeight: .9 }}>
                              {c.resultValue || '+62'}<em>{c.resultUnit || '%'}</em>
                            </h5>
                            <div className="ln m" /><div className="ln s" />
                            <div className="num">— 05 / 38</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Before / After */}
                {s('showBeforeAfter') && (c.beforeText || c.beforeDescription || c.afterDescription) && (
                  <div style={{ marginTop: 48 }}>
                    <div className="sec-tag" style={{ marginBottom: 18 }}>
                      <span className="num" style={{ borderColor: 'var(--ink)' }}>B/A</span>
                      {t('case.before_after_label')}
                    </div>
                    <div className="ba">
                      <div className="pane before reveal">
                        <span className="tag">{t('case.before_tag')}</span>
                        <div className="old">{c.beforeText || c.clientName}</div>
                      </div>
                      <div className="pane after dk reveal">
                        <span className="tag">{t('case.after_tag')}</span>
                        <svg viewBox="0 0 200 200" fill="none" aria-hidden="true">
                          <path d="M40 160 L40 40 L160 160 L160 40" stroke="#fff" strokeWidth="14" strokeLinejoin="miter" />
                          <line x1="20" y1="180" x2="180" y2="180" stroke="#fff" strokeWidth="3" />
                        </svg>
                      </div>
                    </div>
                    <div className="ba-foot">
                      {c.beforeDescription && <div className="c"><strong>{t('case.before_strong')}</strong> {c.beforeDescription}</div>}
                      {c.afterDescription && <div className="c"><strong>{t('case.after_strong')}</strong> {c.afterDescription}</div>}
                    </div>
                  </div>
                )}

                {/* Deliverables */}
                {s('showDeliverables') && deliverables.length > 0 && (
                  <div className="deliv-mini">
                    {deliverables.map((d, i) => (
                      <div key={i} className="d reveal">
                        <span className="n" dangerouslySetInnerHTML={{ __html: parseHtml(d.name) }} />
                        <span className="ct">{d.category}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* ── DIGITAL PRODUCT ── */}
            {s('showDigital') && hasDigital && (
              <section className="chap" id={ch(5).id} ref={setChapRef(ch(5).id)}>
                <ChapHead num={ch(5).num} title={ch(5).title} />
                {ch(5).lead && (
                  <p className="chap-lead" dangerouslySetInnerHTML={{ __html: parseHtml(ch(5).lead) }} />
                )}
                <div className="ch">
                  {c.lineChartTitle && (
                    <div className="ch-card reveal">
                      <div className="ch-head">
                        <div className="t">{renderTitle(c.lineChartTitle)}</div>
                        <div>
                          <span className="v">{renderTitle(c.lineChartValue || '')}</span>
                          {c.lineChartDelta && <span className="delta">{c.lineChartDelta}</span>}
                        </div>
                      </div>
                      <div className="ch-body">
                        <svg viewBox="0 0 600 200" preserveAspectRatio="none">
                          <defs>
                            <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
                              <stop offset="0%" stopColor="#222" stopOpacity=".18" />
                              <stop offset="100%" stopColor="#222" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          <line className="ch-grid" x1="0" y1="40" x2="600" y2="40" />
                          <line className="ch-grid" x1="0" y1="100" x2="600" y2="100" />
                          <line className="ch-grid" x1="0" y1="160" x2="600" y2="160" />
                          <text className="ch-axis" x="0" y="34">140</text>
                          <text className="ch-axis" x="0" y="94">90</text>
                          <text className="ch-axis" x="0" y="154">40</text>
                          <text className="ch-axis" x="0" y="196">Q1 24</text>
                          <text className="ch-axis" x="285" y="196">Q3 24</text>
                          <text className="ch-axis" x="555" y="196">Q4 25</text>
                          <path d="M0,160 C60,156 100,150 140,142 C180,134 220,124 260,118 C300,110 340,96 380,80 C420,66 460,52 500,40 C540,30 580,26 600,24" stroke="#222" strokeWidth="2" fill="none" />
                          <path d="M0,160 C60,156 100,150 140,142 C180,134 220,124 260,118 C300,110 340,96 380,80 C420,66 460,52 500,40 C540,30 580,26 600,24 L600,200 L0,200 Z" fill="url(#g1)" />
                          <circle cx="500" cy="40" r="4" fill="#222" />
                        </svg>
                      </div>
                    </div>
                  )}
                  {funnelData.length > 0 && (
                    <div className="ch-card reveal">
                      <div className="ch-head">
                        <div className="t">{renderTitle(t('case.funnel_title'))}</div>
                      </div>
                      <FunnelChart rows={funnelData} />
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ── RESULTS ── */}
            {s('showResults') && hasResults && (
              <section className="chap" id={ch(6).id} ref={setChapRef(ch(6).id)}>
                <ChapHead num={ch(6).num} title={ch(6).title} />
                {ch(6).lead && <p className="chap-lead">{ch(6).lead}</p>}
                <TestiBlock t={testimonials[testimonials.length - 1]} />
              </section>
            )}

          </article>
        </div>
      </main>

      {/* ── CUSTOM HTML ── */}
      {c.customHtml && (
        <div className="custom-html-block wrap" dangerouslySetInnerHTML={{ __html: c.customHtml }} />
      )}

      {/* ── CTA STRIP ── */}
      <section className="cta-strip" style={{ borderBottom: 0 }}>
        <div className="wrap">
          <div className="cta-grid">
            <div>
              <h2 className="cta-strip-h" style={{ fontFamily: "'Instrument Serif',serif", fontWeight: 400, fontSize: 'clamp(36px,4vw,64px)', lineHeight: 1.05, letterSpacing: '-.02em', margin: '0 0 16px' }}>
                {renderTitle(t('case.cta_title'))}
              </h2>
              <p style={{ color: '#444', fontSize: 18, lineHeight: 1.55, maxWidth: '44ch', margin: '0 0 28px' }}>
                {t('case.cta_sub')}
              </p>
              <div className="cta-actions" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Link to={p('/#contact')} className="btn btn-primary">{t('case.cta_brief_btn')} <span className="arrow">↗</span></Link>
                <Link to={p('/cases')} className="btn btn-ghost">{t('case.cta_all_cases_btn')} <span className="arrow">↗</span></Link>
              </div>
            </div>
            <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              {[
                { lbl: t('case.cta_slots_lbl'), val: t('case.cta_slots_val') },
                { lbl: t('case.cta_start_lbl'), val: t('case.cta_start_val') },
                { lbl: t('case.cta_response_lbl'), val: t('case.cta_response_val') },
                { lbl: t('case.cta_nda_lbl'), val: t('case.cta_nda_val') },
              ].map((row, i, arr) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : 'none', fontSize: 14 }}>
                  <span style={{ color: 'var(--muted)', fontFamily: "'JetBrains Mono',monospace", fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em' }}>{row.lbl}</span>
                  <span style={{ fontWeight: 500 }}>{row.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── NEXT CASE ── */}
      {c.nextCaseSlug && (
        <section className="next-case" style={{ borderBottom: 0 }}>
          {c.nextCaseDeco && <div className="deco">{c.nextCaseDeco}</div>}
          <div className="wrap">
            <div className="lab">{t('case.next_case_label')}</div>
            <div className="nc-row">
              <h3>{renderTitle(c.nextCaseTitle || '')}</h3>
              {nextCaseMeta.length > 0 && (
                <div className="meta">
                  {nextCaseMeta.map((m, i) => (
                    <div key={i} className="line"><span>{m.label}</span><span className="v">{m.value}</span></div>
                  ))}
                </div>
              )}
            </div>
            <div className="nc-cta">
              <span className="preview">{t('case.next_case_preview')}</span>
              <Link to={p(`/cases/${c.nextCaseSlug}`)} className="nc-go">
                {t('case.next_case_open')} <span className="ar">↗</span>
              </Link>
            </div>
          </div>
        </section>
      )}
    </>
  )
}
