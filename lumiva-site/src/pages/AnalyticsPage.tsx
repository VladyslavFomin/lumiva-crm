import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageSEO from '../components/PageSEO'
import RelatedServices from '../components/RelatedServices'
import RelatedCases from '../components/RelatedCases'
import { useLangPath } from '../hooks/useLangPath'

function AnimCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [val, setVal] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true
        let v = 0
        const step = Math.max(1, Math.ceil(target / 60))
        const id = setInterval(() => {
          v += step
          if (v >= target) { setVal(target); clearInterval(id) }
          else setVal(v)
        }, 20)
      }
    }, { threshold: 0.5 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [target])

  return <div ref={ref}>{val}{suffix}</div>
}

export default function AnalyticsPage() {
  const { t } = useTranslation()
  const { p, h } = useLangPath()

  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('.deliv-row, .tier, .cm, .pmini-row')
    els.forEach(el => el.classList.add('reveal'))
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in') }),
      { threshold: 0.08 }
    )
    els.forEach(el => observer.observe(el))
    window.scrollTo(0, 0)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <PageSEO
        title={t('analytics.title')}
        description={t('analytics.sub')}
        path={p('/services/analytics')}
        jsonLd={[
          { '@context': 'https://schema.org', '@type': 'Service', name: 'Marketing Analytics', provider: { '@type': 'Organization', name: 'Lumiva Agency', url: 'https://lumiva.agency' }, areaServed: ['Turkey', 'Europe', 'CIS'], serviceType: 'Analytics' },
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [1, 2, 3, 4, 5, 6].map(i => ({
              '@type': 'Question',
              name: t(`analytics.faq${i}_q`),
              acceptedAnswer: { '@type': 'Answer', text: t(`analytics.faq${i}_a`) },
            })),
          },
        ]}
      />
      <header className="page-hero">
        <div className="wrap">
          <div className="crumbs">
            <Link to={p('/')}>{t('crumbs.home')}</Link><span className="sep">/</span>
            <Link to={p('/services')}>{t('crumbs.services')}</Link><span className="sep">/</span>
            <span>{t('analytics.eyebrow')}</span>
          </div>
          <div className="page-hero-grid">
            <div>
              <div className="page-eyebrow">{t('analytics.eyebrow')}</div>
              <h1 className="page-title">{t('analytics.title')}</h1>
            </div>
            <div className="page-hero-side">
              <p>{t('analytics.sub')}</p>
              <div className="page-hero-actions">
                <a href={h('#contact')} className="btn btn-primary">{t('analytics.cta_btn')}<span className="arrow">↗</span></a>
                <a href="#dashboard" className="btn btn-ghost">{t('analytics.sec01_title')}<span className="arrow">↗</span></a>
              </div>
              <div className="hero-side-stats">
                <div className="s"><div className="num">−41<em>%</em></div><div className="lbl">{t('analytics.stat1_lbl')}</div></div>
                <div className="s"><div className="num">×4.8</div><div className="lbl">{t('analytics.stat2_lbl')}</div></div>
                <div className="s"><div className="num">89<em>%</em></div><div className="lbl">{t('analytics.stat3_lbl')}</div></div>
                <div className="s"><div className="num">48<em>h</em></div><div className="lbl">{t('analytics.stat4_lbl')}</div></div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* LIVE DASHBOARD MOCK */}
      <section id="dashboard">
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">01</span>{t('analytics.sec01_tag').replace('01 ', '')}</div>
            <div>
              <h2 className="sec-title">{t('analytics.sec01_title')}</h2>
              <p className="sec-sub">{t('analytics.sec01_sub')}</p>
            </div>
          </div>

          <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'var(--paper-2)' }}>
            {/* Dashboard header */}
            <div style={{ background: 'var(--ink)', color: 'var(--paper)', padding: '20px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 24 }}>Performance Dashboard <em style={{ opacity: 0.5, fontSize: 18, fontStyle: 'italic' }}>· live</em></div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                <span className="dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#3ee07d', display: 'inline-block' }} />
                updated: just now
              </div>
            </div>

            {/* KPI row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', borderBottom: '1px solid var(--line)' }}>
              {[
                { label: 'ROAS', val: 4.8, suffix: '×', trend: '+12%', up: true },
                { label: 'CAC', val: 1847, suffix: '€', trend: '−18%', up: true },
                { label: 'LTV', val: 24600, suffix: '€', trend: '+9%', up: true },
                { label: t('analytics.dash_conv'), val: 3.4, suffix: '%', trend: '+0.6 pp', up: true },
              ].map((k, i) => (
                <div key={i} style={{ padding: '28px 32px', borderRight: i < 3 ? '1px solid var(--line)' : 'none' }}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{k.label}</div>
                  <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 48, lineHeight: 1, letterSpacing: '-0.02em' }}>
                    <AnimCounter target={k.val % 1 !== 0 ? Math.round(k.val * 10) / 10 : k.val} suffix={k.suffix} />
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, color: k.up ? '#1a8a4f' : '#c0392b', fontFamily: 'JetBrains Mono, monospace' }}>{k.trend} {t('analytics.dash_prev')}</div>
                </div>
              ))}
            </div>

            {/* Chart area mock */}
            <div style={{ padding: '32px', borderBottom: '1px solid var(--line)' }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>ROAS · last 30 days</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120 }}>
                {[65, 72, 68, 80, 75, 90, 85, 92, 88, 95, 100, 94, 98, 88, 92, 96, 100, 95, 88, 92, 96, 100, 98, 104, 100, 96, 108, 104, 100, 112].map((h2, i) => (
                  <div key={i} style={{ flex: 1, background: 'var(--ink)', opacity: 0.15 + (h2 / 112) * 0.75, height: `${(h2 / 112) * 100}%`, borderRadius: '3px 3px 0 0', transition: 'opacity 0.3s' }} />
                ))}
              </div>
            </div>

            {/* Funnel */}
            <div className="r1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', borderBottom: '1px solid var(--line)' }}>
              <div style={{ padding: '32px', borderRight: '1px solid var(--line)' }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>Funnel</div>
                {[
                  { stage: 'Reach', val: 124800, pct: 100 },
                  { stage: 'Clicks', val: 8736, pct: 7 },
                  { stage: 'Leads', val: 1247, pct: 1 },
                  { stage: 'Sales', val: 287, pct: 0.23 },
                ].map((f, i) => (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span>{f.stage}</span>
                      <span style={{ fontFamily: 'Instrument Serif, serif', fontSize: 18 }}>{f.val.toLocaleString()}</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--line)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${f.pct === 100 ? 100 : f.pct * 10}%`, background: 'var(--ink)', borderRadius: 2, transition: 'width 1s var(--ease)' }} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ padding: '32px' }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>Channels by ROAS</div>
                {[
                  { ch: 'Meta Ads', roas: 6.2, share: 38 },
                  { ch: 'Google Ads', roas: 4.1, share: 28 },
                  { ch: 'LinkedIn', roas: 3.8, share: 19 },
                  { ch: 'Email', roas: 12.4, share: 15 },
                ].map((c, i) => (
                  <div key={i} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span>{c.ch}</span>
                      <span style={{ fontFamily: 'Instrument Serif, serif', fontSize: 18 }}>×{c.roas}</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--line)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${c.share}%`, background: 'var(--ink)', borderRadius: 2 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* DELIVERABLES */}
      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">02</span>{t('analytics.sec02_tag').replace('02 ', '')}</div>
            <div>
              <h2 className="sec-title">{t('analytics.sec02_title')}</h2>
            </div>
            <a href={h('#contact')} className="show-all">{t('analytics.cta_btn')} <span className="arr">↗</span></a>
          </div>
          <div className="deliv">
            {[
              { n: 'A/01', titleKey: 'analytics.a01_title', descKey: 'analytics.a01_sub' },
              { n: 'A/02', titleKey: 'analytics.a02_title', descKey: 'analytics.a02_sub', tag: 'analytics.a02_tag' },
              { n: 'A/03', titleKey: 'analytics.a03_title', descKey: 'analytics.a03_sub', tag: 'analytics.a03_tag' },
              { n: 'A/04', titleKey: 'analytics.a04_title', descKey: 'analytics.a04_sub' },
              { n: 'A/05', titleKey: 'analytics.a05_title', descKey: 'analytics.a05_sub', tag: 'analytics.a05_tag' },
              { n: 'A/06', titleKey: 'analytics.a06_title', descKey: 'analytics.a06_sub' },
            ].map((d, i) => (
              <div key={i} className="deliv-row">
                <div className="num">{d.n}</div>
                <div><h4>{t(d.titleKey)}</h4><p>{t(d.descKey)}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TECH STACK */}
      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">03</span>{t('analytics.sec03_tag').replace('03 ', '')}</div>
            <div>
              <h2 className="sec-title">{t('analytics.sec03_title')}</h2>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            {[
              { label: 'Collection', chips: ['GA4', 'Yandex Metrica', 'Amplitude', 'Segment', 'Mixpanel', 'Roistat', 'AppsFlyer'] },
              { label: 'Storage', chips: ['BigQuery', 'ClickHouse', 'PostgreSQL', 'Snowflake', 'Redshift'] },
              { label: 'Transform', chips: ['dbt', 'Apache Airflow', 'Spark', 'Python', 'SQL'] },
              { label: 'Visualise', chips: ['Looker Studio', 'Tableau', 'Metabase', 'Power BI', 'Superset'] },
              { label: 'ML & AI', chips: ['scikit-learn', 'PyTorch', 'Vertex AI', 'MLflow', 'Feast'] },
            ].map(({ label, chips }) => (
              <div key={label}>
                <div className="sec-tag" style={{ marginBottom: 12 }}><span className="num">{label[0]}</span>{label}</div>
                <div className="stack">
                  {chips.map(c => <span key={c} className="chip"><span className="pip" />{c}</span>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROCESS */}
      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">04</span>{t('analytics.sec04_tag').replace('04 ', '')}</div>
            <div><h2 className="sec-title">{t('analytics.sec04_title')}</h2></div>
          </div>
          <div className="pmini">
            {[
              { n: '01', hKey: 'analytics.proc01', dKey: 'analytics.proc01' },
              { n: '02', hKey: 'analytics.proc02', dKey: 'analytics.proc02' },
              { n: '03', hKey: 'analytics.proc03', dKey: 'analytics.proc03' },
              { n: '04', hKey: 'analytics.proc04', dKey: 'analytics.proc04' },
            ].map((r, i) => (
              <div key={i} className="pmini-row">
                <div className="pmini-num">{r.n}</div>
                <div className="pmini-h">{t(r.hKey)}</div>
                <div className="pmini-d">{t(r.dKey)}</div>
                <div className="pmini-arr">↗</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">05</span>{t('analytics.sec05_tag').replace('05 ', '')}</div>
            <div><h2 className="sec-title">{t('analytics.sec05_title')}</h2></div>
          </div>
          <div className="pricing">
            <div className="tier">
              <div className="tier-badge">{t('analytics.t1_badge')}</div>
              <div className="tier-name">{t('analytics.t1_name')}</div>
              <div className="tier-sub">{t('analytics.t1_sub')}</div>
              <div className="tier-price">{t('analytics.t1_price')}</div>
              <ul className="tier-incl">
                {[t('analytics.t1_f1'), t('analytics.t1_f2'), t('analytics.t1_f3'), t('analytics.t1_f4'), t('analytics.t1_f5')].map(l => <li key={l}>{l}</li>)}
              </ul>
              <a href={h('#contact')} className="btn btn-ghost">{t('analytics.tier_discuss')}<span className="arrow">↗</span></a>
            </div>

            <div className="tier featured">
              <div className="tier-badge">{t('analytics.t2_badge')}</div>
              <div className="tier-name">{t('analytics.t2_name')}</div>
              <div className="tier-sub">{t('analytics.t2_sub')}</div>
              <div className="tier-price">{t('analytics.t2_price')}</div>
              <ul className="tier-incl">
                {[t('analytics.t2_f1'), t('analytics.t2_f2'), t('analytics.t2_f3'), t('analytics.t2_f4'), t('analytics.t2_f5'), t('analytics.t2_f6')].map(l => <li key={l}>{l}</li>)}
              </ul>
              <a href={h('#contact')} className="btn">{t('analytics.cta_btn')}<span className="arrow">↗</span></a>
            </div>

            <div className="tier">
              <div className="tier-badge">{t('analytics.t3_badge')}</div>
              <div className="tier-name">{t('analytics.t3_name')}</div>
              <div className="tier-sub">{t('analytics.t3_sub')}</div>
              <div className="tier-price">{t('analytics.t3_price')}</div>
              <ul className="tier-incl">
                {[t('analytics.t3_f1'), t('analytics.t3_f2'), t('analytics.t3_f3'), t('analytics.t3_f4'), t('analytics.t3_f5')].map(l => <li key={l}>{l}</li>)}
              </ul>
              <a href={h('#contact')} className="btn btn-ghost">{t('analytics.tier_discuss')}<span className="arrow">↗</span></a>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">06</span>{t('analytics.audience_tag').replace('06 ', '')}</div>
            <div><h2 className="sec-title">{t('analytics.audience_title')}</h2></div>
          </div>
          <div className="deliv">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="deliv-row">
                <div className="num">{`A/0${i}`}</div>
                <div><h4>{t(`analytics.aud${i}_title`)}</h4><p>{t(`analytics.aud${i}_desc`)}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">07</span>{t('analytics.faq_tag').replace('07 ', '')}</div>
            <div><h2 className="sec-title">{t('analytics.faq_title')}</h2></div>
          </div>
          <div className="faq">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="deliv-row">
                <div className="num">{`Q${i}`}</div>
                <div><h4>{t(`analytics.faq${i}_q`)}</h4><p>{t(`analytics.faq${i}_a`)}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <RelatedCases
        num="08"
        tag={t('common.cases')}
        heading={t('home.sec02_title')}
        allLabel={t('home.all_works')}
        keywords={['analytics', 'data', 'tracking', 'crm']}
      />

      <RelatedServices
        num="09"
        tag={t('analytics.rel_tag').replace('08 ', '')}
        heading={t('analytics.rel_title')}
        items={[
          { title: t('analytics.rel1_title'), desc: t('analytics.rel1_desc'), to: p('/services/seo') },
          { title: t('analytics.rel2_title'), desc: t('analytics.rel2_desc'), to: p('/services/performance') },
          { title: t('analytics.rel3_title'), desc: t('analytics.rel3_desc'), to: p('/services/development/integrations') },
        ]}
      />

      <section className="cta-strip" style={{ borderBottom: 0 }}>
        <div className="wrap">
          <div className="grid">
            <div>
              <h2>{t('analytics.cta_title')}</h2>
              <p>{t('analytics.cta_sub')}</p>
              <div className="cta-actions">
                <a href={h('#contact')} className="btn btn-primary">{t('analytics.cta_btn')}<span className="arrow">↗</span></a>
                <a href={`mailto:${t('common.email')}`} className="btn btn-ghost">{t('common.email')}<span className="arrow">↗</span></a>
              </div>
            </div>
            <div className="cta-side">
              <div className="row"><div className="lbl">{t('analytics.audit_free')}</div><div className="val">{t('analytics.audit_time')}</div></div>
              <div className="row"><div className="lbl">{t('common.start')}</div><div className="val">{t('common.start_val')}</div></div>
              <div className="row" style={{ borderBottom: 0 }}><div className="lbl">{t('common.nda')}</div><div className="val">{t('common.nda_val')}</div></div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
