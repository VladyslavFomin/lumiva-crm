import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageSEO from '../../components/PageSEO'
import RelatedServices from '../../components/RelatedServices'
import RelatedCases from '../../components/RelatedCases'
import { useLangPath } from '../../hooks/useLangPath'

export default function LandingsPage() {
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
    'Frontend': ['Next.js', 'Astro', 'React', 'TypeScript', 'Tailwind', 'GSAP', 'Framer Motion', 'Three.js'],
    'A/B & Analytics': ['PostHog', 'GrowthBook', 'VWO', 'GA4', 'Yandex.Metrica', 'GTM', 'Hotjar', 'Clarity'],
    'Forms & CRM': ['HubSpot Forms', 'amoCRM', 'Bitrix24', 'Zapier', 'Make', 'SendGrid', 'Unisender'],
    'Infra & Speed': ['Vercel Edge', 'Cloudflare', 'ISR', 'WebP / AVIF', 'Critical CSS', 'Lazy loading'],
  }

  const delivs = [
    { n: 'LD/01', ta: 'd0_ta', te: 'd0_te', desc: 'd0_desc' },
    { n: 'LD/02', ta: 'd1_ta', te: 'd1_te', desc: 'd1_desc' },
    { n: 'LD/03', ta: 'd2_ta', te: 'd2_te', desc: 'd2_desc' },
    { n: 'LD/04', ta: 'd3_ta', te: 'd3_te', desc: 'd3_desc' },
    { n: 'LD/05', ta: 'd4_ta', te: 'd4_te', desc: 'd4_desc' },
    { n: 'LD/06', ta: 'd5_ta', te: 'd5_te', desc: 'd5_desc' },
    { n: 'LD/07', ta: 'd6_ta', te: 'd6_te', desc: 'd6_desc' },
    { n: 'LD/08', ta: 'd7_ta', te: 'd7_te', desc: 'd7_desc' },
  ]

  const process = [
    { n: '01', ha: 'p0_ha', he: 'p0_he', d: 'p0_d' },
    { n: '02', ha: 'p1_ha', he: 'p1_he', d: 'p1_d' },
    { n: '03', ha: 'p2_ha', he: 'p2_he', d: 'p2_d' },
    { n: '04', ha: 'p3_ha', he: 'p3_he', d: 'p3_d' },
  ]


  return (
    <>
      <PageSEO
        title={t('landings.seo_title')}
        description={t('landings.seo_desc')}
        path={p('/services/development/landings')}
        jsonLd={[
          { '@context': 'https://schema.org', '@type': 'Service', name: 'Landing Page Development', provider: { '@type': 'Organization', name: 'Lumiva Agency', url: 'https://lumiva.agency' }, areaServed: ['Turkey', 'Europe', 'CIS'], serviceType: 'Landing Page Development' },
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [1, 2, 3, 4, 5, 6].map(i => ({
              '@type': 'Question',
              name: t(`landings.faq${i}_q`),
              acceptedAnswer: { '@type': 'Answer', text: t(`landings.faq${i}_a`) },
            })),
          },
        ]}
      />
      <header className="page-hero">
        <div className="wrap">
          <div className="crumbs">
            <Link to={p('/')}>{t('crumbs.home')}</Link><span className="sep">/</span>
            <Link to={p('/services')}>{t('crumbs.services')}</Link><span className="sep">/</span>
            <Link to={p('/services/development')}>{t('crumbs.development')}</Link><span className="sep">/</span>
            <span>{t('landings.crumb')}</span>
          </div>
          <div className="page-hero-grid">
            <div>
              <div className="page-eyebrow">D/05 · Landings & conversion</div>
              <h1 className="page-title">{t('landings.hero_title_pre')} <em>{t('landings.hero_title_em')}</em></h1>
            </div>
            <div className="page-hero-side">
              <p>{t('landings.hero_sub')}</p>
              <div className="page-hero-actions">
                <a href={h('#contact')} className="btn btn-primary">{t('cp.request_quote')}<span className="arrow">↗</span></a>
                <a href="#cases" className="btn btn-ghost">{t('cp.cases_link')}<span className="arrow">↗</span></a>
              </div>
              <div className="hero-side-stats">
                <div className="s"><div className="num">+38<em>%</em></div><div className="lbl">{t('landings.stat1_lbl')}</div></div>
                <div className="s"><div className="num">98<em>+</em></div><div className="lbl">{t('landings.stat2_lbl')}</div></div>
                <div className="s"><div className="num">10<em>d</em></div><div className="lbl">{t('landings.stat3_lbl')}</div></div>
                <div className="s"><div className="num">&lt;0.8<em>s</em></div><div className="lbl">{t('landings.stat4_lbl')}</div></div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">01</span>{t('cp.sec_included')}</div>
            <div>
              <h2 className="sec-title">{t('landings.sec01_title_pre')} <em>{t('landings.sec01_title_em')}</em></h2>
              <p className="sec-sub">{t('landings.sec01_sub')}</p>
            </div>
            <a href={h('#contact')} className="show-all">{t('cp.request_quote')} <span className="arr">↗</span></a>
          </div>
          <div className="deliv">
            {delivs.map((d, i) => (
              <div key={i} className="deliv-row">
                <div className="num">{d.n}</div>
                <div><h4>{t(`landings.${d.ta}`)}<em>{t(`landings.${d.te}`)}</em></h4><p>{t(`landings.${d.desc}`)}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">02</span>{t('cp.sec_stack')}</div>
            <div>
              <h2 className="sec-title">{t('landings.sec02_title_pre')} <em>{t('landings.sec02_title_em')}</em></h2>
              <p className="sec-sub">{t('landings.sec02_sub')}</p>
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

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">03</span>{t('cp.sec_process')}</div>
            <div>
              <h2 className="sec-title">{t('landings.sec03_title_pre')} <em>{t('landings.sec03_title_em')}</em></h2>
              <p className="sec-sub">{t('landings.sec03_sub')}</p>
            </div>
          </div>
          <div className="pmini">
            {process.map((r, i) => (
              <div key={i} className="pmini-row">
                <div className="pmini-num">{r.n}</div>
                <div className="pmini-h">{t(`landings.${r.ha}`)}<em>{t(`landings.${r.he}`)}</em></div>
                <div className="pmini-d">{t(`landings.${r.d}`)}</div>
                <div className="pmini-arr">↗</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">04</span>{t('cp.sec_pricing')}</div>
            <div>
              <h2 className="sec-title">{t('landings.sec04_title_pre')} <em>{t('landings.sec04_title_em')}</em></h2>
              <p className="sec-sub">{t('landings.sec04_sub')}</p>
            </div>
          </div>
          <div className="pricing">
            <div className="tier">
              <div className="tier-badge">{t('landings.t1_badge')}</div>
              <div className="tier-name">{t('landings.t1_name')}</div>
              <div className="tier-sub">{t('landings.t1_sub')}</div>
              <div className="tier-price">{priceFrom} 1 800<em>€</em></div>
              <ul className="tier-incl">
                {['t1_f1','t1_f2','t1_f3','t1_f4','t1_f5','t1_f6'].map(k => <li key={k}>{t(`landings.${k}`)}</li>)}
              </ul>
              <a href={h('#contact')} className="btn btn-ghost">{t('cp.discuss')}<span className="arrow">↗</span></a>
            </div>
            <div className="tier featured">
              <div className="tier-badge">{t('landings.t2_badge')}</div>
              <div className="tier-name">{t('landings.t2_name')}</div>
              <div className="tier-sub">{t('landings.t2_sub')}</div>
              <div className="tier-price">{priceFrom} 5 500<em>€</em></div>
              <ul className="tier-incl">
                {['t2_f1','t2_f2','t2_f3','t2_f4','t2_f5','t2_f6'].map(k => <li key={k}>{t(`landings.${k}`)}</li>)}
              </ul>
              <a href={h('#contact')} className="btn">{t('cp.request_quote')}<span className="arrow">↗</span></a>
            </div>
            <div className="tier">
              <div className="tier-badge">{t('landings.t3_badge')}</div>
              <div className="tier-name">{t('landings.t3_name')}</div>
              <div className="tier-sub">{t('landings.t3_sub')}</div>
              <div className="tier-price">{priceFrom} 1 500<em>€/{monthShort}</em></div>
              <ul className="tier-incl">
                {['t3_f1','t3_f2','t3_f3','t3_f4','t3_f5'].map(k => <li key={k}>{t(`landings.${k}`)}</li>)}
              </ul>
              <a href={h('#contact')} className="btn btn-ghost">{t('cp.discuss')}<span className="arrow">↗</span></a>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">05</span>{t('landings.aud_tag').replace('06 ', '')}</div>
            <div><h2 className="sec-title">{t('landings.aud_title')}</h2></div>
          </div>
          <div className="deliv">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="deliv-row">
                <div className="num">{`A/0${i}`}</div>
                <div><h4>{t(`landings.aud${i}_title`)}</h4><p>{t(`landings.aud${i}_desc`)}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">06</span>{t('landings.faq_tag').replace('07 ', '')}</div>
            <div><h2 className="sec-title">{t('landings.faq_title')}</h2></div>
          </div>
          <div className="faq">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="deliv-row">
                <div className="num">{`Q${i}`}</div>
                <div><h4>{t(`landings.faq${i}_q`)}</h4><p>{t(`landings.faq${i}_a`)}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <RelatedCases
        num="07"
        tag={t('cp.sec_cases')}
        heading={`${t('landings.sec05_title_pre')} ${t('landings.sec05_title_em')}`}
        allLabel={t('cp.all_works')}
        keywords={['landing', 'landings', 'conversion']}
      />

      <RelatedServices
        num="08"
        tag={t('landings.rel_tag').replace('08 ', '')}
        heading={t('landings.rel_title')}
        items={[
          { title: t('landings.rel1_title'), desc: t('landings.rel1_desc'), to: p('/services/performance') },
          { title: t('landings.rel2_title'), desc: t('landings.rel2_desc'), to: p('/services/development/integrations') },
          { title: t('landings.rel3_title'), desc: t('landings.rel3_desc'), to: p('/services/development/ecommerce') },
        ]}
      />

      <section className="cta-strip" style={{ borderBottom: 0 }}>
        <div className="wrap">
          <div className="grid">
            <div>
              <h2>{t('landings.cta_title_pre')} <em>{t('landings.cta_title_em')}</em></h2>
              <p>{t('landings.cta_sub')}</p>
              <div className="cta-actions">
                <a href={h('#contact')} className="btn btn-primary">{t('cp.request_quote')}<span className="arrow">↗</span></a>
                <a href={`mailto:${t('common.email')}`} className="btn btn-ghost">vlad@lumiva.agency<span className="arrow">↗</span></a>
              </div>
            </div>
            <div className="cta-side">
              <div className="row"><div className="lbl">{t('cp.slots_q3')}</div><div className="val">{t('cp.slots_val')}</div></div>
              <div className="row"><div className="lbl">{t('cp.start')}</div><div className="val">{t('cp.start_val')}</div></div>
              <div className="row" style={{ borderBottom: 0 }}><div className="lbl">{t('cp.resp')}</div><div className="val">{t('cp.resp_val')}</div></div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
