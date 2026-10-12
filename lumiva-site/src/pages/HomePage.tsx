import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageSEO from '../components/PageSEO'
import { useLangPath } from '../hooks/useLangPath'

function useSvcMouseTracking() {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const el = (e.currentTarget as HTMLElement)
      const r = el.getBoundingClientRect()
      el.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%')
      el.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%')
    }
    document.querySelectorAll<HTMLElement>('[data-svc]').forEach(el => {
      el.addEventListener('mousemove', handler)
    })
    return () => {
      document.querySelectorAll<HTMLElement>('[data-svc]').forEach(el => {
        el.removeEventListener('mousemove', handler)
      })
    }
  }, [])
}

function useRevealOnScroll() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('.svc, .case, .stat-cell, .step, .person, .quote, .award')
    els.forEach(el => el.classList.add('reveal'))
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in') }),
      { threshold: 0.08 }
    )
    els.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])
}

const CASE_COLORS = ['#1f3a2f', '#222', '#2a2a4a', '#3a1f2f', '#1f2a3a', '#2a1f3a', '#1a2a2a', '#2f2a1f']

function HomeCases() {
  const { t, i18n } = useTranslation()
  const { p } = useLangPath()
  const [cases, setCases] = useState<any[]>([])
  const langKey = i18n.language?.startsWith('ru') ? 'ru' : i18n.language?.startsWith('tr') ? 'tr' : 'en'
  useEffect(() => {
    fetch(`https://pl2.lumiva.agency/api/cases?status=published&limit=8&lang=${langKey}`)
      .then(r => r.json()).then(r => setCases(r.items || [])).catch(() => {})
  }, [langKey])
  if (cases.length === 0) return null
  const spans = [8, 4, 4, 8, 6, 6, 6, 6]
  return (
    <div className="case-grid">
      {cases.map((c, idx) => {
        const span = spans[idx % spans.length]
        const result = c.resultValue || c.shortResult || ''
        return (
          <Link key={c.id} to={p(`/cases/${c.slug}`)} className={`case span-${span}`}>
            <div className="case-thumb">
              <div className="case-thumb-inner" style={{ background: c.coverUrl ? 'var(--paper-2)' : CASE_COLORS[idx % CASE_COLORS.length], overflow: 'hidden' }}>
                {c.coverUrl
                  ? <img src={c.coverUrl} alt={c.clientName} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  : (
                    <>
                      <div className="grid-deco" />
                      <div className="label serif italic" style={{ color: 'rgba(255,255,255,.7)' }}>{c.clientName?.[0] || '✦'}</div>
                    </>
                  )
                }
              </div>
              <div className="case-overlay">
                <div className="case-tags-mini">
                  {(Array.isArray(c.tags) ? c.tags : []).slice(0, 3).map((tag: string) => (
                    <span key={tag} className="case-tag-mini">{tag}</span>
                  ))}
                </div>
                <span className="case-cta">{t('common.open_case')}</span>
              </div>
            </div>
            <div className="case-meta">
              <div>
                <h3 className="case-name">{c.clientName}</h3>
                <div className="case-cat">{c.industry}</div>
              </div>
              {result && (
                <div className="case-result">{result}</div>
              )}
            </div>
          </Link>
        )
      })}
    </div>
  )
}

function FAQ() {
  const { t } = useTranslation()
  const [open, setOpen] = useState<number | null>(null)
  const items = [
    { q: t('home.faq1_q'), a: t('home.faq1_a') },
    { q: t('home.faq2_q'), a: t('home.faq2_a') },
    { q: t('home.faq3_q'), a: t('home.faq3_a') },
    { q: t('home.faq4_q'), a: t('home.faq4_a') },
    { q: t('home.faq5_q'), a: t('home.faq5_a') },
  ]
  return (
    <div className="faq" id="faqList">
      {items.map((item, i) => (
        <div key={i} className={`faq-item${open === i ? ' open' : ''}`} onClick={() => setOpen(open === i ? null : i)}>
          <div className="faq-q">
            <span className="faq-num">[{String(i + 1).padStart(2, '0')}]</span>
            <div className="faq-text">{item.q}</div>
            <div className="faq-toggle" />
          </div>
          <div className="faq-a">
            <div className="faq-a-inner">{item.a}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function ContactForm() {
  const { t } = useTranslation()
  const { p } = useLangPath()
  const [budget, setBudget] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const budgetOptions = [
    t('contact_modal.budget_opt1'),
    t('contact_modal.budget_opt2'),
    t('contact_modal.budget_opt3'),
    t('contact_modal.budget_opt4'),
  ]

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const data = {
      name: (form.elements.namedItem('name') as HTMLInputElement).value,
      company: (form.elements.namedItem('company') as HTMLInputElement).value,
      email: (form.elements.namedItem('email') as HTMLInputElement).value,
      task: (form.elements.namedItem('task') as HTMLTextAreaElement).value,
      budget,
    }
    try {
      await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
    } catch {}
    setSent(true)
  }

  return (
    <div className="form-card">
      <h3>{t('home.cta_form_title')}</h3>
      <div className="muted">{t('home.cta_form_sub')}</div>

      {sent ? (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: 48, marginBottom: 12 }}>{t('home.form_sent')}</div>
          <p style={{ color: 'var(--muted)' }}>{t('home.form_sent_text')}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="name">{t('home.form_name')}</label>
            <input id="name" name="name" type="text" placeholder={t('home.form_name')} required />
          </div>
          <div className="field">
            <label htmlFor="company">{t('home.form_company')}</label>
            <input id="company" name="company" type="text" placeholder={t('home.form_company')} />
          </div>
          <div className="field">
            <label htmlFor="email">{t('home.form_email')}</label>
            <input id="email" name="email" type="email" placeholder="you@company.com" required />
          </div>
          <div className="field">
            <label htmlFor="task">{t('contact_modal.message')}</label>
            <textarea id="task" name="task" placeholder={t('home.form_task')} />
          </div>
          <div className="field">
            <label>{t('contact_modal.budget')}</label>
            <div className="budgets">
              {budgetOptions.map(b => (
                <button
                  key={b} type="button"
                  className={`budget${budget === b ? ' active' : ''}`}
                  onClick={() => setBudget(budget === b ? null : b)}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" className="btn btn-primary">
            {t('home.form_submit')}<span className="arrow">↗</span>
          </button>
          <p className="form-legal">
            <Link to={p('/privacy-policy')}>{t('footer.privacy')}</Link>
          </p>
        </form>
      )}
    </div>
  )
}

function LatestPosts() {
  const { t, i18n } = useTranslation()
  const { p } = useLangPath()
  const lang = i18n.language as 'en' | 'ru' | 'tr'
  const [posts, setPosts] = useState<any[]>([])

  useEffect(() => {
    fetch(`https://pl2.lumiva.agency/api/blog?status=published&limit=3&lang=${lang}`)
      .then(r => r.json())
      .then(r => setPosts(r.items || []))
      .catch(() => {})
  }, [lang])

  if (posts.length === 0) return null

  return (
    <section>
      <div className="wrap">
        <div className="rel-head">
          <div className="rel-tag">
            <span className="num">10</span>
            {t('home.sec10_tag')}
          </div>
          <h2 className="rel-title">{t('home.sec10_title')}</h2>
          <Link to={p('/blog')} className="rel-all">
            {t('blog.all')} <span className="arr">→</span>
          </Link>
        </div>
        <div className="rel-grid">
          {posts.map((post: any) => (
            <Link key={post.slug} to={p(`/blog/${post.slug}`)} className="rel">
              <div className={`rel-thumb${post.coverUrl ? ' has-img' : ''}`}>
                <div className={`rel-thumb-inner${post.coverUrl ? '' : ' lt'}`}>
                  {post.coverUrl
                    ? <img src={post.coverUrl} alt={post.title} loading="lazy" />
                    : <span className="glyph">{post.title?.[0] || '✦'}</span>
                  }
                </div>
              </div>
              <h3>{post.title}</h3>
              {post.excerpt && <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>{post.excerpt}</p>}
              <div className="m">
                <span>{post.category || ''}</span>
                <span>{post.readMin ? `${post.readMin} min` : ''}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

export default function HomePage() {
  const { t, i18n } = useTranslation()
  const { p, h } = useLangPath()
  const lang = i18n.language || 'en'

  useSvcMouseTracking()
  useRevealOnScroll()

  const marqueeItems = [
    'Northwind Capital', 'Atelier Volta', 'RIGEL Athletics', 'Maison Côte',
    'PALOMA Coffee', 'Foster & Ko', 'Helios Energy', 'NORD/02',
    'Vesna Cosmetics', 'Forge Ventures',
  ]

  const services = [
    { num: 'S/01', titleKey: 'home.svc01', descKey: 'home.svc01_desc', tags: ['JTBD', 'CJM', 'Brand strategy', 'Research'], to: p('/services/strategy') },
    { num: 'S/02', titleKey: 'home.svc02', descKey: 'home.svc02_desc', tags: ['Naming', 'Identity', 'Guidelines', 'Packaging'], to: p('/services/design') },
    { num: 'S/03', titleKey: 'home.svc03', descKey: 'home.svc03_desc', tags: ['Google Ads', 'Meta', 'Programmatic', 'CRM'], to: p('/services/performance') },
    { num: 'S/04', titleKey: 'home.svc04', descKey: 'home.svc04_desc', tags: ['UX', 'UI', 'Webflow', 'Next.js'], to: p('/services/development') },
    { num: 'S/05', titleKey: 'home.svc05', descKey: 'home.svc05_desc', tags: ['Photo', 'Video', 'Motion', '3D'], to: p('/services/content') },
    { num: 'S/06', titleKey: 'home.svc06', descKey: 'home.svc06_desc', tags: ['Telegram', 'Instagram', 'YouTube', 'Influence'], to: p('/services/smm') },
    { num: 'S/07', titleKey: 'home.svc07', descKey: 'home.svc07_desc', tags: ['Semrush', 'Google', 'Core Web Vitals'], to: p('/services/seo') },
    { num: 'S/08', titleKey: 'home.svc08', descKey: 'home.svc08_desc', tags: ['Lumiva CRM', 'Custom', 'Integrations', 'Auto-funnels'], href: 'https://crm.lumiva.agency/' },
  ]

  const stats3 = [
    { num: '142', suffix: '+', lblKey: 'home.sec03_stat1_lbl', corner: 'P/01' },
    { num: '×4.8', suffix: '', lblKey: 'home.sec03_stat2_lbl', corner: 'P/02' },
    { num: '−38', suffix: '%', lblKey: 'home.sec03_stat3_lbl', corner: 'P/03' },
    { num: '9.4', suffix: '', lblKey: 'home.sec03_stat4_lbl', corner: 'P/04' },
  ]

  const process = [
    { n: '01', titleKey: 'home.proc01_title', descKey: 'home.proc01_text' },
    { n: '02', titleKey: 'home.proc02_title', descKey: 'home.proc02_text' },
    { n: '03', titleKey: 'home.proc03_title', descKey: 'home.proc03_text' },
    { n: '04', titleKey: 'home.proc04_title', descKey: 'home.proc04_text' },
  ]

  const manifPillars = [
    { titleKey: 'home.manif01_title', textKey: 'home.manif01_text' },
    { titleKey: 'home.manif02_title', textKey: 'home.manif02_text' },
    { titleKey: 'home.manif03_title', textKey: 'home.manif03_text' },
  ]

  const team = [
    { initials: 'AK', bg: 'b1', tag: 'CEO',  nameKey: 'home.team1_name', roleKey: 'home.team1_role', bioKey: 'home.team1_bio' },
    { initials: 'MS', bg: 'b2', tag: 'CD',   nameKey: 'home.team2_name', roleKey: 'home.team2_role', bioKey: 'home.team2_bio' },
    { initials: 'DN', bg: 'b3', tag: 'Perf', nameKey: 'home.team3_name', roleKey: 'home.team3_role', bioKey: 'home.team3_bio' },
    { initials: 'EV', bg: 'b4', tag: 'Data', nameKey: 'home.team4_name', roleKey: 'home.team4_role', bioKey: 'home.team4_bio' },
  ]

  const testimonials = [
    { textKey: 'home.test1_text', nameKey: 'home.test1_name', roleKey: 'home.test1_role', initials: 'IS', dk: false },
    { textKey: 'home.test2_text', nameKey: 'home.test2_name', roleKey: 'home.test2_role', initials: 'AB', dk: true },
    { textKey: 'home.test3_text', nameKey: 'home.test3_name', roleKey: 'home.test3_role', initials: 'RG', dk: false },
  ]

  const awards = [
    { yrKey: 'home.award1_year', nmKey: 'home.award1_name', plKey: 'home.award1_result' },
    { yrKey: 'home.award2_year', nmKey: 'home.award2_name', plKey: 'home.award2_result' },
    { yrKey: 'home.award3_year', nmKey: 'home.award3_name', plKey: 'home.award3_result' },
    { yrKey: 'home.award4_year', nmKey: 'home.award4_name', plKey: 'home.award4_result' },
    { yrKey: 'home.award5_year', nmKey: 'home.award5_name', plKey: 'home.award5_result' },
    { yrKey: 'home.award6_year', nmKey: 'home.award6_name', plKey: 'home.award6_result' },
  ]

  return (
    <>
      <PageSEO
        title={t('home.seo_title')}
        description={t('home.seo_desc')}
        path={p('/')}
        noSuffix
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'Lumiva Agency',
            url: 'https://lumiva.agency/',
            logo: 'https://lumiva.agency/favicon.svg',
            telephone: '+90 538 365 96 78',
            contactPoint: { '@type': 'ContactPoint', telephone: '+90-538-365-96-78', contactType: 'customer service', availableLanguage: ['Russian', 'English', 'Turkish'] },
            sameAs: ['https://t.me/lumiva', 'https://linkedin.com/company/lumiva'],
            address: { '@type': 'PostalAddress', addressLocality: 'Antalya', addressCountry: 'TR' },
          },
          {
            '@context': 'https://schema.org',
            '@type': 'LocalBusiness',
            name: 'Lumiva Agency',
            url: 'https://lumiva.agency/',
            image: 'https://lumiva.agency/og-image.svg',
            logo: 'https://lumiva.agency/favicon.svg',
            telephone: '+90-538-365-96-78',
            email: 'vlad@lumiva.agency',
            address: { '@type': 'PostalAddress', addressLocality: 'Antalya', addressCountry: 'TR' },
            areaServed: [
              { '@type': 'City', name: 'Antalya' },
              { '@type': 'Country', name: 'Turkey' },
              { '@type': 'Continent', name: 'Europe' },
            ],
            sameAs: ['https://t.me/lumiva', 'https://linkedin.com/company/lumiva'],
            priceRange: '€€€',
          },
          {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'Lumiva Agency',
            url: 'https://lumiva.agency/',
            potentialAction: { '@type': 'SearchAction', target: 'https://lumiva.agency/blog?q={search_term_string}', 'query-input': 'required name=search_term_string' },
          },
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              { '@type': 'Question', name: t('home.faq1_q'), acceptedAnswer: { '@type': 'Answer', text: t('home.faq1_a') } },
              { '@type': 'Question', name: t('home.faq2_q'), acceptedAnswer: { '@type': 'Answer', text: t('home.faq2_a') } },
              { '@type': 'Question', name: t('home.faq3_q'), acceptedAnswer: { '@type': 'Answer', text: t('home.faq3_a') } },
              { '@type': 'Question', name: t('home.faq4_q'), acceptedAnswer: { '@type': 'Answer', text: t('home.faq4_a') } },
              { '@type': 'Question', name: t('home.faq5_q'), acceptedAnswer: { '@type': 'Answer', text: t('home.faq5_a') } },
            ],
          },
        ]}
      />

      {/* HERO */}
      <header className="hero">
        <div className="wrap">
          <div className="eyebrow">{t('home.hero_eyebrow')}</div>
          <div className="hero-grid">
            <div>
              <h1 className="hero-title">
                <span className="line">{t('home.hero_title')}</span>
              </h1>
            </div>
            <div className="hero-side">
              <p className="hero-seo-copy">{t('home.hero_seo_copy')}</p>
              <div className="hero-actions">
                <a href={h('#contact')} className="btn btn-primary">{t('home.hero_cta_discuss')}<span className="arrow">↗</span></a>
                <a href={h('#cases')} className="btn btn-ghost">{t('home.hero_cta_cases')}<span className="arrow">↗</span></a>
              </div>
            </div>
          </div>

          <div className="hero-meta">
            <div className="stat">
              <span className="num">{t('home.stat1_num')}</span>
              <span className="lbl">{t('home.stat1_lbl')}</span>
            </div>
            <div className="stat">
              <span className="num">{t('home.stat2_num')}</span>
              <span className="lbl">{t('home.stat2_lbl')}</span>
            </div>
            <div className="stat">
              <span className="num">{t('home.stat3_num')}<em>%</em></span>
              <span className="lbl">{t('home.stat3_lbl')}</span>
            </div>
            <div className="stat">
              <span className="num">{t('home.stat4_num')}</span>
              <span className="lbl">{t('home.stat4_lbl')}</span>
            </div>
          </div>


        </div>
      </header>

      {/* MARQUEE */}
      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {[...marqueeItems, ...marqueeItems].map((name, i) => (
            <span key={i} className={`ml${i % 3 === 1 ? ' italic serif' : i % 3 === 2 ? ' serif' : ''}`}>
              {name}{i % 3 !== 1 && <span className="dot" />}
            </span>
          ))}
        </div>
      </div>

      {/* SERVICES */}
      <section id="services">
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">01</span>{t('home.sec01_tag').replace('01 ', '')}</div>
            <div>
              <h2 className="sec-title">{t('home.sec01_title')}</h2>
              <p className="sec-sub">{t('home.sec01_sub')}</p>
            </div>
            <Link to={p('/services')} className="show-all">{t('common.all_services')} <span className="arr">↗</span></Link>
          </div>

          <div className="services">
            {services.map((svc, i) => {
              const inner = (
                <>
                  <div className="svc-num">
                    <span>{svc.num}</span>
                    <span className="plus">+</span>
                  </div>
                  <div>
                    <h3 className="svc-title">{t(svc.titleKey)}</h3>
                    <p className="svc-desc">{t(svc.descKey)}</p>
                  </div>
                  <div className="svc-tags">
                    {svc.tags.map(tag => <span key={tag} className="svc-tag">{tag}</span>)}
                  </div>
                </>
              )
              if ((svc as any).href) {
                return <a key={i} className="svc" data-svc href={(svc as any).href} target="_blank" rel="noopener noreferrer">{inner}</a>
              }
              return <Link key={i} className="svc" data-svc to={(svc as any).to} style={{ textDecoration: 'none', color: 'inherit' }}>{inner}</Link>
            })}
          </div>
        </div>
      </section>

      {/* LOCAL EXPERTISE — Antalya / Turkey landing pages */}
      {lang === 'en' && (
        <section>
          <div className="wrap">
            <div className="sec-head">
              <div className="sec-tag"><span className="num">★</span>Local Expertise</div>
              <div>
                <h2 className="sec-title">Specialised for Antalya and Turkey</h2>
                <p className="sec-sub">Deep dives into the services and industries we know best — written for businesses operating specifically in Antalya and across Turkey.</p>
              </div>
            </div>
            <div className="deliv">
              {[
                { title: 'Digital Marketing Agency in Antalya', desc: 'The full marketing stack for businesses based in or targeting Antalya.', to: '/digital-marketing-agency-antalya' },
                { title: 'SEO Agency in Antalya', desc: 'Multilingual SEO in Turkish, English, and Russian for local and international brands.', to: '/seo-agency-antalya' },
                { title: 'Web Development in Antalya', desc: 'Fast, SEO-ready websites and e-commerce built for the Turkish market.', to: '/web-development-antalya' },
                { title: 'CRM Development in Turkey', desc: 'Custom CRM systems integrated with local payment and booking platforms.', to: '/crm-development-turkey' },
                { title: 'Hotel Marketing Agency in Turkey', desc: 'Direct booking growth for hotels and resorts across Antalya, Bodrum, and beyond.', to: '/hotel-marketing-agency-turkey' },
              ].map((item, i) => (
                <Link key={i} to={item.to} className="deliv-row" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="num">L/{String(i + 1).padStart(2, '0')}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div><h4>{item.title}</h4><p>{item.desc}</p></div>
                    <span style={{ color: 'var(--muted)', fontSize: 18, flexShrink: 0, marginTop: 6 }}>↗</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CASES */}
      <section id="cases">
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">02</span>{t('home.sec02_tag').replace('02 ', '')}</div>
            <div>
              <h2 className="sec-title">{t('home.sec02_title')}</h2>
              <p className="sec-sub">{t('home.sec02_sub')}</p>
            </div>
            <Link to={p('/cases')} className="show-all">{t('home.all_works')} <span className="arr">↗</span></Link>
          </div>

          <HomeCases />
        </div>
      </section>

      {/* STATS */}
      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">03</span>{t('home.sec03_tag').replace('03 ', '')}</div>
            <div>
              <h2 className="sec-title">{t('home.sec03_title')}</h2>
              <p className="sec-sub">{t('home.sec03_sub')}</p>
            </div>
          </div>

          <div className="stats">
            {stats3.map((s, i) => (
              <div key={i} className="stat-cell">
                <span className="corner">{s.corner}</span>
                <div className="num serif">{s.num}<em>{s.suffix}</em></div>
                <div className="lbl">{t(s.lblKey)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROCESS */}
      <section id="process">
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">04</span>{t('home.sec04_tag').replace('04 ', '')}</div>
            <div>
              <h2 className="sec-title">{t('home.sec04_title')}</h2>
              <p className="sec-sub">{t('home.sec04_sub')}</p>
            </div>
          </div>

          <div className="process">
            {process.map((s, i) => (
              <div key={i} className="step">
                <div className="step-num">{s.n}</div>
                <div className="step-title">{t(s.titleKey)}</div>
                <div className="step-desc">{t(s.descKey)}</div>
                <div className="step-arrow">↗</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MANIFESTO */}
      <section id="manifesto" className="manifesto" style={{ border: 'none' }}>
        <div className="manifesto-deco" aria-hidden="true">L</div>
        <div className="wrap">
          <div className="sec-tag" style={{ marginBottom: 48 }}>
            <span className="num">05</span>{t('home.sec05_tag').replace('05 ', '')}
          </div>
          <div className="manifesto-text">
            {t('home.manif_text')}
          </div>

          <div className="manifesto-pillars">
            {manifPillars.map((p, i) => (
              <div key={i} className="pillar">
                <h4><span className="num">{String(i + 1).padStart(2, '0')}</span>{t(p.titleKey)}</h4>
                <p>{t(p.textKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TEAM */}
      <section id="team">
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">06</span>{t('home.sec06_tag').replace('06 ', '')}</div>
            <div>
              <h2 className="sec-title">{t('home.sec06_title')}</h2>
              <p className="sec-sub">{t('home.sec06_sub')}</p>
            </div>
          </div>

          <div className="team">
            {team.map((member, i) => (
              <div key={i} className="person">
                <div className="person-face">
                  <div className={`person-bg ${member.bg}`}>
                    <div className="person-initials">{member.initials}</div>
                  </div>
                  <div className="person-tag">{member.tag}</div>
                  <div className="person-bio"><p>{t(member.bioKey)}</p></div>
                </div>
                <div className="person-meta">
                  <div>
                    <div className="person-name">{t(member.nameKey)}</div>
                    <div className="person-role">{t(member.roleKey)}</div>
                  </div>
                  <a href="#" className="person-soc">↗</a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">07</span>{t('home.sec07_tag').replace('07 ', '')}</div>
            <div>
              <h2 className="sec-title">{t('home.sec07_title')}</h2>
            </div>
          </div>

          <div className="testimonials">
            {testimonials.map((q, i) => (
              <div key={i} className="quote">
                <p className="quote-text">{t(q.textKey)}</p>
                <div className="quote-author">
                  <div className={`qa-avatar${q.dk ? ' dk' : ''}`}>{q.initials}</div>
                  <div>
                    <div className="qa-name">{t(q.nameKey)}</div>
                    <div className="qa-role">{t(q.roleKey)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AWARDS */}
      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">08</span>{t('home.sec08_tag').replace('08 ', '')}</div>
            <div>
              <h2 className="sec-title">{t('home.sec08_title')}</h2>
            </div>
          </div>
          <div className="awards">
            {awards.map((a, i) => (
              <div key={i} className="award">
                <div className="yr">{t(a.yrKey)}</div>
                <div className="nm">{t(a.nmKey)}</div>
                <div className="pl">{t(a.plKey)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq">
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">09</span>{t('home.sec09_tag').replace('09 ', '')}</div>
            <div>
              <h2 className="sec-title">{t('home.sec09_title')}</h2>
            </div>
          </div>
          <FAQ />
        </div>
      </section>

      {/* LATEST BLOG POSTS */}
      <LatestPosts />

      {/* CTA / CONTACT */}
      <section id="contact" className="cta" style={{ padding: '120px 0' }}>
        <div className="wrap">
          <div className="cta-grid">
            <div>
              <h2>{t('home.cta_title')}</h2>
              <p className="cta-sub">{t('home.cta_sub')}</p>
              <div className="contact-extras">
                <div className="extra">
                  <div className="lbl">{t('common.response_time')}</div>
                  <div className="val">{t('common.response_val')}</div>
                </div>
                <div className="extra">
                  <div className="lbl">{t('common.slots_q3')}</div>
                  <div className="val">{t('common.slots_val')}</div>
                </div>
                <div className="extra">
                  <div className="lbl">{t('home.cta_email')}</div>
                  <div className="val">{t('common.email')}</div>
                </div>
                <div className="extra">
                  <div className="lbl">{t('home.cta_phone')}</div>
                  <div className="val">{t('common.phone')}</div>
                </div>
              </div>
            </div>
            <ContactForm />
          </div>
        </div>
      </section>
    </>
  )
}
