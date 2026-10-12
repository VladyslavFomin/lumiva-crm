import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageSEO from '../../components/PageSEO'
import { useLangPath } from '../../hooks/useLangPath'

export default function CorporateSitesPage() {
  const { t, i18n } = useTranslation()
  const { p, h } = useLangPath()
  const langKey = i18n.language?.startsWith('ru') ? 'ru' : i18n.language?.startsWith('tr') ? 'tr' : 'en'
  const priceFrom = langKey === 'ru' ? 'от' : langKey === 'tr' ? 'baslangic' : 'from'
  const monthShort = langKey === 'ru' ? 'мес' : langKey === 'tr' ? 'ay' : 'mo'

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
    Frontend: ['Next.js', 'React', 'Astro', 'Webflow', 'TypeScript', 'Tailwind', 'GSAP', 'Framer Motion'],
    CMS: ['Sanity', 'Contentful', 'Strapi', 'Directus', 'WordPress (headless)'],
    Integrations: ['HubSpot', 'Salesforce', 'Bitrix24', 'amoCRM', 'Google Analytics 4', 'GTM'],
    'Infra & SEO': ['Vercel', 'Cloudflare', 'Next.js ISR', 'Schema.org', 'Sitemaps', 'Core Web Vitals'],
  }

  return (
    <>
      <PageSEO
        title={t('corporate_sites.title')}
        description={t('corporate_sites.sub')}
        path={p('/services/development/corporate-sites')}
        jsonLd={{ '@context': 'https://schema.org', '@type': 'Service', name: 'Corporate Website Development', provider: { '@type': 'Organization', name: 'Lumiva Agency', url: 'https://lumiva.agency' }, areaServed: ['Turkey', 'Europe', 'CIS'], serviceType: 'Web Development' }}
      />
      <header className="page-hero">
        <div className="wrap">
          <div className="crumbs">
            <Link to={p('/')}>{t('crumbs.home')}</Link><span className="sep">/</span>
            <Link to={p('/services')}>{t('crumbs.services')}</Link><span className="sep">/</span>
            <Link to={p('/services/development')}>{t('crumbs.development')}</Link><span className="sep">/</span>
            <span>{t('corporate_sites.eyebrow')}</span>
          </div>
          <div className="page-hero-grid">
            <div>
              <div className="page-eyebrow">{t('corporate_sites.eyebrow')}</div>
              <h1 className="page-title">{t('corporate_sites.title')}</h1>
            </div>
            <div className="page-hero-side">
              <p>{t('corporate_sites.sub')}</p>
              <div className="page-hero-actions">
                <a href={h('#contact')} className="btn btn-primary">{t('corporate_sites.cta_btn')}<span className="arrow">↗</span></a>
                <a href={h('#cases')} className="btn btn-ghost">{t('common.cases')}<span className="arrow">↗</span></a>
              </div>
              <div className="hero-side-stats">
                <div className="s"><div className="num">38<em>+</em></div><div className="lbl">{t('corporate_sites.stat1_lbl')}</div></div>
                <div className="s"><div className="num">99.97<em>%</em></div><div className="lbl">{t('corporate_sites.stat2_lbl')}</div></div>
                <div className="s"><div className="num">5<em>wk</em></div><div className="lbl">{t('corporate_sites.stat3_lbl')}</div></div>
                <div className="s"><div className="num">&lt;1.2<em>s</em></div><div className="lbl">{t('corporate_sites.stat4_lbl')}</div></div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* DELIVERABLES */}
      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">01</span>{t('corporate_sites.sec01_tag').replace('01 ', '')}</div>
            <div>
              <h2 className="sec-title">{t('corporate_sites.sec01_title')}</h2>
            </div>
            <a href={h('#contact')} className="show-all">{t('corporate_sites.cta_btn')} <span className="arr">↗</span></a>
          </div>
          <div className="deliv">
            {[
              { n: 'CS/01', titleKey: 'corporate_sites.d01_title', descKey: 'corporate_sites.d01_sub' },
              { n: 'CS/02', titleKey: 'corporate_sites.d02_title', descKey: 'corporate_sites.d02_sub' },
              { n: 'CS/03', titleKey: 'corporate_sites.d03_title', descKey: 'corporate_sites.d03_sub' },
              { n: 'CS/04', titleKey: 'corporate_sites.d04_title', descKey: 'corporate_sites.d04_sub' },
              { n: 'CS/05', titleKey: 'corporate_sites.d05_title', descKey: 'corporate_sites.d05_sub' },
              { n: 'CS/06', titleKey: 'corporate_sites.d06_title', descKey: 'corporate_sites.d06_sub' },
              { n: 'CS/07', titleKey: 'corporate_sites.d07_title', descKey: 'corporate_sites.d07_sub' },
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
            <div className="sec-tag"><span className="num">02</span>{t('corporate_sites.sec02_tag').replace('02 ', '')}</div>
            <div>
              <h2 className="sec-title">{t('corporate_sites.sec02_title')}</h2>
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
            <div className="sec-tag"><span className="num">03</span>Process</div>
            <div>
              <h2 className="sec-title">From brief to launch in 5–12 weeks.</h2>
            </div>
          </div>
          <div className="pmini">
            {[
              { n: '01', h: 'Discovery & strategy', d: 'Business, competitor and audience audit. Forming TOR and priorities. 1–2 weeks.' },
              { n: '02', h: 'Design & prototype', d: 'UX prototype, design system, UI in Figma. Sign-off before a line of code. 2–3 weeks.' },
              { n: '03', h: 'Development & integrations', d: 'Layout, CMS, API, CRM. Two-week sprints with demos. 3–6 weeks.' },
              { n: '04', h: 'Launch & analytics', d: 'SEO checklist, speed tests, GTM and GA4 setup. Monitoring from minute one.' },
            ].map((r, i) => (
              <div key={i} className="pmini-row">
                <div className="pmini-num">{r.n}</div>
                <div className="pmini-h">{r.h}</div>
                <div className="pmini-d">{r.d}</div>
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
            <div className="sec-tag"><span className="num">04</span>Pricing</div>
            <div>
              <h2 className="sec-title">Transparent pricing.</h2>
            </div>
          </div>
          <div className="pricing">
            <div className="tier">
              <div className="tier-badge">{t('corporate_sites.t1_badge')}</div>
              <div className="tier-name">{t('corporate_sites.t1_name')}</div>
              <div className="tier-sub">{t('corporate_sites.t1_sub')}</div>
              <div className="tier-price">{priceFrom} 3,500<em>€</em></div>
              <ul className="tier-incl">
                {[t('corporate_sites.t1_f1'), t('corporate_sites.t1_f2'), t('corporate_sites.t1_f3'), t('corporate_sites.t1_f4')].map(l => <li key={l}>{l}</li>)}
              </ul>
              <a href={h('#contact')} className="btn btn-ghost">{t('corporate_sites.tier_discuss')}<span className="arrow">↗</span></a>
            </div>

            <div className="tier featured">
              <div className="tier-badge">{t('corporate_sites.t2_badge')}</div>
              <div className="tier-name">{t('corporate_sites.t2_name')}</div>
              <div className="tier-sub">{t('corporate_sites.t2_sub')}</div>
              <div className="tier-price">{priceFrom} 12,000<em>€</em></div>
              <ul className="tier-incl">
                {[t('corporate_sites.t2_f1'), t('corporate_sites.t2_f2'), t('corporate_sites.t2_f3'), t('corporate_sites.t2_f4')].map(l => <li key={l}>{l}</li>)}
              </ul>
              <a href={h('#contact')} className="btn">{t('corporate_sites.cta_btn')}<span className="arrow">↗</span></a>
            </div>

            <div className="tier">
              <div className="tier-badge">{t('corporate_sites.t3_badge')}</div>
              <div className="tier-name">{t('corporate_sites.t3_name')}</div>
              <div className="tier-sub">{t('corporate_sites.t3_sub')}</div>
              <div className="tier-price">{priceFrom} 2,200<em>€/{monthShort}</em></div>
              <ul className="tier-incl">
                {[t('corporate_sites.t3_f1'), t('corporate_sites.t3_f2'), t('corporate_sites.t3_f3'), t('corporate_sites.t3_f4')].map(l => <li key={l}>{l}</li>)}
              </ul>
              <a href={h('#contact')} className="btn btn-ghost">{t('corporate_sites.tier_discuss')}<span className="arrow">↗</span></a>
            </div>
          </div>
        </div>
      </section>

      {/* CASES */}
      <section id="cases">
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">05</span>{t('common.cases')}</div>
            <div><h2 className="sec-title">{t('home.sec02_title')}</h2></div>
            <a href={h('#cases')} className="show-all">{t('home.all_works')} <span className="arr">↗</span></a>
          </div>
          <div className="cases-mini">
            {[
              { bg: '#f5f3ee', label: 'Helios', labelColor: '#222', cat: 'B2B · energy', name: 'Helios Energy — corporate site', result: '−41%', resultSub: 'CAC' },
              { bg: '#1a1a1a', label: 'Foster', labelColor: '#fff', cat: 'B2B · consulting', name: 'Foster & Ko — site with CRM', result: '×2.8', resultSub: 'conv. rate' },
              { bg: '#e9e6dc', label: 'Arko', labelColor: '#222', cat: 'Manufacturing', name: 'Arko Group — multilingual site', result: '+67%', resultSub: 'organic traffic' },
            ].map((c, i) => (
              <div key={i} className="cm">
                <div className="cm-thumb">
                  <div className="cm-art" style={{ background: c.bg }}>
                    <div className="grid-deco" />
                    <div className="label serif italic" style={{ color: c.labelColor, fontSize: 64, letterSpacing: '-0.03em' }}>{c.label}</div>
                  </div>
                </div>
                <div className="cm-meta">
                  <div>
                    <div className="cm-name">{c.name}</div>
                    <div className="cm-cat">{c.cat}</div>
                  </div>
                  <div className="cm-result">{c.result}<em> {c.resultSub}</em></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-strip" style={{ borderBottom: 0 }}>
        <div className="wrap">
          <div className="grid">
            <div>
              <h2>{t('corporate_sites.cta_title')}</h2>
              <p>{t('corporate_sites.cta_sub')}</p>
              <div className="cta-actions">
                <a href={h('#contact')} className="btn btn-primary">{t('corporate_sites.cta_btn')}<span className="arrow">↗</span></a>
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
