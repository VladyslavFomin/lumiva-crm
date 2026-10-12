import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageSEO from '../components/PageSEO'
import RelatedServices from '../components/RelatedServices'
import RelatedCases from '../components/RelatedCases'
import { useLangPath } from '../hooks/useLangPath'

export default function DevelopmentPage() {
  const { t } = useTranslation()
  const { p, h } = useLangPath()

  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('.deliv-row, .chip, .tier, .pmini-row, .cm')
    els.forEach(el => el.classList.add('reveal'))
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in') }),
      { threshold: 0.08 }
    )
    els.forEach(el => observer.observe(el))
    window.scrollTo(0, 0)
    return () => observer.disconnect()
  }, [])

  const stacks = {
    Frontend: ['Next.js', 'React', 'TypeScript', 'Vue / Nuxt', 'Astro', 'Webflow', 'Tailwind', 'GSAP', 'Three.js'],
    'Backend & data': ['Node.js', 'Python · FastAPI', 'Go', 'PostgreSQL', 'Redis', 'ClickHouse', 'Kafka', 'Elasticsearch'],
    'Infra & DevOps': ['Docker', 'Kubernetes', 'Terraform', 'AWS', 'Vercel', 'Cloudflare', 'GitHub Actions', 'Sentry'],
    CMS: ['Sanity', 'Contentful', 'Strapi', 'Directus', 'WordPress (headless)'],
  }

  const deliverables = [
    { n: 'D/01', titleKey: 'dev.d01_title', descKey: 'dev.d01_sub', to: p('/services/development/corporate-sites') },
    { n: 'D/02', titleKey: 'dev.d02_title', descKey: 'dev.d02_sub', to: p('/services/development/landings') },
    { n: 'D/03', titleKey: 'dev.d03_title', descKey: 'dev.d03_sub', to: p('/services/development/ecommerce') },
    { n: 'D/04', titleKey: 'dev.d04_title', descKey: 'dev.d04_sub', to: p('/services/development/configurators') },
    { n: 'D/05', titleKey: 'dev.d05_title', descKey: 'dev.d05_sub', to: p('/services/development/saas') },
    { n: 'D/06', titleKey: 'dev.d06_title', descKey: 'dev.d06_sub', to: p('/services/development/mobile') },
    { n: 'D/07', titleKey: 'dev.d07_title', descKey: 'dev.d07_sub', to: p('/services/development/integrations') },
    { n: 'D/08', titleKey: 'dev.d08_title', descKey: 'dev.d08_sub', to: p('/services/development/devops') },
  ]

  const process = [
    { n: '01', titleKey: 'dev.proc01_title', descKey: 'dev.proc01_text' },
    { n: '02', titleKey: 'dev.proc02_title', descKey: 'dev.proc02_text' },
    { n: '03', titleKey: 'dev.proc03_title', descKey: 'dev.proc03_text' },
    { n: '04', titleKey: 'dev.proc04_title', descKey: 'dev.proc04_text' },
  ]


  return (
    <>
      <PageSEO
        title={t('dev.title')}
        description={t('dev.sub')}
        path={p('/services/development')}
        jsonLd={[
          { '@context': 'https://schema.org', '@type': 'Service', name: 'Web Development', provider: { '@type': 'Organization', name: 'Lumiva Agency', url: 'https://lumiva.agency' }, areaServed: ['Turkey', 'Europe', 'CIS'], serviceType: 'Web Development' },
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [1, 2, 3, 4, 5, 6].map(i => ({
              '@type': 'Question',
              name: t(`dev.faq${i}_q`),
              acceptedAnswer: { '@type': 'Answer', text: t(`dev.faq${i}_a`) },
            })),
          },
        ]}
      />
      <header className="page-hero">
        <div className="wrap">
          <div className="crumbs">
            <Link to={p('/')}>{t('crumbs.home')}</Link><span className="sep">/</span>
            <Link to={p('/services')}>{t('crumbs.services')}</Link><span className="sep">/</span>
            <span>{t('crumbs.development')}</span>
          </div>
          <div className="page-hero-grid">
            <div>
              <div className="page-eyebrow">{t('dev.eyebrow')}</div>
              <h1 className="page-title">{t('dev.title')}</h1>
            </div>
            <div className="page-hero-side">
              <p>{t('dev.sub')}</p>
              <div className="page-hero-actions">
                <a href={h('#contact')} className="btn btn-primary">{t('dev.cta_btn')}<span className="arrow">↗</span></a>
                <a href={h('#cases')} className="btn btn-ghost">{t('common.cases')}<span className="arrow">↗</span></a>
              </div>
              <div className="hero-side-stats">
                <div className="s"><div className="num">{t('dev.stat1_num')}</div><div className="lbl">{t('dev.stat1_lbl')}</div></div>
                <div className="s"><div className="num">{t('dev.stat2_num')}<em>%</em></div><div className="lbl">{t('dev.stat2_lbl')}</div></div>
                <div className="s"><div className="num">{t('dev.stat3_num')}</div><div className="lbl">{t('dev.stat3_lbl')}</div></div>
                <div className="s"><div className="num">{t('dev.stat4_num')}</div><div className="lbl">{t('dev.stat4_lbl')}</div></div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* DELIVERABLES */}
      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">01</span>{t('dev.sec01_tag').replace('01 ', '')}</div>
            <div>
              <h2 className="sec-title">{t('dev.sec01_title')}</h2>
              <p className="sec-sub">{t('dev.sec01_sub')}</p>
            </div>
            <a href={h('#contact')} className="show-all">{t('dev.cta_btn')} <span className="arr">↗</span></a>
          </div>
          <div className="deliv">
            {deliverables.map((d, i) => (
              <Link key={i} className="deliv-row reveal" to={d.to} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="num">{d.n}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div><h4>{t(d.titleKey)}</h4><p>{t(d.descKey)}</p></div>
                  <span style={{ color: 'var(--muted)', fontSize: 18, flexShrink: 0, marginTop: 6 }}>↗</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* TECH STACK */}
      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">02</span>{t('dev.sec02_tag').replace('02 ', '')}</div>
            <div>
              <h2 className="sec-title">{t('dev.sec02_title')}</h2>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {Object.entries(stacks).map(([label, chips]) => (
              <div key={label}>
                <div className="sec-tag" style={{ marginBottom: 14 }}>
                  <span className="num">{label[0]}</span>{label}
                </div>
                <div className="stack">
                  {chips.map(c => (
                    <span key={c} className="chip"><span className="pip" />{c}</span>
                  ))}
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
            <div className="sec-tag"><span className="num">03</span>{t('dev.sec03_tag').replace('03 ', '')}</div>
            <div>
              <h2 className="sec-title">{t('dev.sec03_title')}</h2>
            </div>
          </div>
          <div className="pmini">
            {process.map((r, i) => (
              <div key={i} className="pmini-row">
                <div className="pmini-num">{r.n}</div>
                <div className="pmini-h">{t(r.titleKey)}</div>
                <div className="pmini-d">{t(r.descKey)}</div>
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
            <div className="sec-tag"><span className="num">04</span>{t('dev.sec04_tag').replace('04 ', '')}</div>
            <div>
              <h2 className="sec-title">{t('dev.sec04_title')}</h2>
            </div>
          </div>
          <div className="pricing">
            <div className="tier">
              <div className="tier-badge">{t('dev.t1_badge')}</div>
              <div className="tier-name">{t('dev.t1_name')}</div>
              <div className="tier-sub">{t('dev.t1_sub')}</div>
              <div className="tier-price">{t('dev.t1_price')}</div>
              <ul className="tier-incl">
                {[t('dev.t1_f1'), t('dev.t1_f2'), t('dev.t1_f3'), t('dev.t1_f4')].map(l => <li key={l}>{l}</li>)}
              </ul>
              <a href={h('#contact')} className="btn btn-ghost">{t('dev.tier_discuss')}<span className="arrow">↗</span></a>
            </div>

            <div className="tier featured">
              <div className="tier-badge">{t('dev.t2_badge')}</div>
              <div className="tier-name">{t('dev.t2_name')}</div>
              <div className="tier-sub">{t('dev.t2_sub')}</div>
              <div className="tier-price">{t('dev.t2_price')}</div>
              <ul className="tier-incl">
                {[t('dev.t2_f1'), t('dev.t2_f2'), t('dev.t2_f3'), t('dev.t2_f4'), t('dev.t2_f5')].map(l => <li key={l}>{l}</li>)}
              </ul>
              <a href={h('#contact')} className="btn">{t('dev.cta_btn')}<span className="arrow">↗</span></a>
            </div>

            <div className="tier">
              <div className="tier-badge">{t('dev.t3_badge')}</div>
              <div className="tier-name">{t('dev.t3_name')}</div>
              <div className="tier-sub">{t('dev.t3_sub')}</div>
              <div className="tier-price">{t('dev.t3_price')}</div>
              <ul className="tier-incl">
                {[t('dev.t3_f1'), t('dev.t3_f2'), t('dev.t3_f3'), t('dev.t3_f4')].map(l => <li key={l}>{l}</li>)}
              </ul>
              <a href={h('#contact')} className="btn btn-ghost">{t('dev.tier_discuss')}<span className="arrow">↗</span></a>
            </div>
          </div>
        </div>
      </section>

      {/* AUDIENCE / PROBLEMS */}
      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">06</span>{t('dev.audience_tag').replace('06 ', '')}</div>
            <div><h2 className="sec-title">{t('dev.audience_title')}</h2></div>
          </div>
          <div className="deliv">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="deliv-row">
                <div className="num">{`A/0${i}`}</div>
                <div><h4>{t(`dev.aud${i}_title`)}</h4><p>{t(`dev.aud${i}_desc`)}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">07</span>{t('dev.faq_tag').replace('07 ', '')}</div>
            <div><h2 className="sec-title">{t('dev.faq_title')}</h2></div>
          </div>
          <div className="faq">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="deliv-row">
                <div className="num">{`Q${i}`}</div>
                <div><h4>{t(`dev.faq${i}_q`)}</h4><p>{t(`dev.faq${i}_a`)}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED CASES */}
      <RelatedCases
        num="08"
        tag={t('common.cases')}
        heading={t('home.sec02_title')}
        allLabel={t('home.all_works')}
        keywords={['development', 'website', 'web']}
      />

      <RelatedServices
        num="09"
        tag={t('dev.rel_tag').replace('09 ', '')}
        heading={t('dev.rel_title')}
        items={[
          { title: t('dev.rel1_title'), desc: t('dev.rel1_desc'), to: p('/services/analytics') },
          { title: t('dev.rel2_title'), desc: t('dev.rel2_desc'), to: p('/services/design') },
          { title: t('dev.rel3_title'), desc: t('dev.rel3_desc'), to: p('/services/seo') },
        ]}
      />

      <section className="cta-strip" style={{ borderBottom: 0 }}>
        <div className="wrap">
          <div className="grid">
            <div>
              <h2>{t('dev.cta_title')}</h2>
              <p>{t('dev.cta_sub')}</p>
              <div className="cta-actions">
                <a href={h('#contact')} className="btn btn-primary">{t('dev.cta_btn')}<span className="arrow">↗</span></a>
                <a href={`mailto:${t('common.email')}`} className="btn btn-ghost">{t('common.email')}<span className="arrow">↗</span></a>
              </div>
            </div>
            <div className="cta-side">
              <div className="row"><div className="lbl">{t('common.slots_q3')}</div><div className="val">{t('common.slots_val')}</div></div>
              <div className="row"><div className="lbl">{t('common.start')}</div><div className="val">{t('common.start_val')}</div></div>
              <div className="row" style={{ borderBottom: 0 }}><div className="lbl">{t('common.response_time')}</div><div className="val">{t('common.response_val')}</div></div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
