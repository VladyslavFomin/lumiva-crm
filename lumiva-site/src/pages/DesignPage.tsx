import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageSEO from '../components/PageSEO'
import RelatedServices from '../components/RelatedServices'
import RelatedCases from '../components/RelatedCases'
import { useLangPath } from '../hooks/useLangPath'

export default function DesignPage() {
  const { t } = useTranslation()
  const { p, h } = useLangPath()

  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('.dt, .princ .p, .tier, .cm')
    els.forEach(el => el.classList.add('reveal'))
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in') }),
      { threshold: 0.08 }
    )
    els.forEach(el => observer.observe(el))
    window.scrollTo(0, 0)
    return () => observer.disconnect()
  }, [])

  const disciplines = [
    { id: 'dt-1', cls: 'dt-1', n: 'D/01', labelKey: 'design.d01_title', h: 'design.d01_title', subKey: 'design.d01_sub', metaKey: 'design.d01_stat', to: p('/services/design/brand-identity') },
    { id: 'dt-2', cls: 'dt-2 dark', n: 'D/02', labelKey: 'design.d02_title', h: 'design.d02_title', subKey: 'design.d02_sub', to: p('/services/design/product-ui') },
    { id: 'dt-3', cls: 'dt-3', n: 'D/03', labelKey: 'design.d03_title', h: 'design.d03_title', subKey: 'design.d03_sub', to: p('/services/design/packaging') },
    { id: 'dt-4', cls: 'dt-4', n: 'D/04', labelKey: 'design.d04_title', h: 'design.d04_title', subKey: 'design.d04_sub', metaKey: 'design.d04_tag', to: p('/services/design/motion') },
    { id: 'dt-5', cls: 'dt-5', n: 'D/05', labelKey: 'design.d05_title', h: 'design.d05_title', subKey: 'design.d05_sub', to: p('/services/design/visual-identity') },
    { id: 'dt-6', cls: 'dt-6 dark', n: 'D/06', labelKey: 'design.d06_title', h: 'design.d06_title', subKey: 'design.d06_sub', to: p('/services/design/editorial') },
    { id: 'dt-7', cls: 'dt-7', n: 'D/07', labelKey: 'design.d07_title', h: 'design.d07_title', subKey: 'design.d07_sub', to: p('/services/design/environmental') },
    { id: 'dt-8', cls: 'dt-8', n: 'D/08', labelKey: 'design.d08_title', h: 'design.d08_title', subKey: 'design.d08_sub', to: p('/services/design/social') },
    { id: 'dt-9', cls: 'dt-9 dark', n: 'BR', labelKey: 'design.dbr_title', h: 'design.dbr_title', subKey: 'design.dbr_sub', to: p('/services/design/brandbook') },
  ]

  const principles = [
    { n: '01', titleKey: 'design.p01_title', textKey: 'design.p01_text' },
    { n: '02', titleKey: 'design.p02_title', textKey: 'design.p02_text' },
    { n: '03', titleKey: 'design.p03_title', textKey: 'design.p03_text' },
    { n: '04', titleKey: 'design.p04_title', textKey: 'design.p04_text' },
  ]


  return (
    <>
      <PageSEO
        title={t('design.title')}
        description={t('design.sub')}
        path={p('/services/design')}
        jsonLd={[
          { '@context': 'https://schema.org', '@type': 'Service', name: 'Brand Design', provider: { '@type': 'Organization', name: 'Lumiva Agency', url: 'https://lumiva.agency' }, areaServed: ['Turkey', 'Europe', 'CIS'], serviceType: 'Branding' },
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [1, 2, 3, 4, 5, 6].map(i => ({
              '@type': 'Question',
              name: t(`design.faq${i}_q`),
              acceptedAnswer: { '@type': 'Answer', text: t(`design.faq${i}_a`) },
            })),
          },
        ]}
      />
      <header className="page-hero">
        <div className="wrap">
          <div className="crumbs">
            <Link to={p('/')}>{t('crumbs.home')}</Link><span className="sep">/</span>
            <Link to={p('/services')}>{t('crumbs.services')}</Link><span className="sep">/</span>
            <span>{t('crumbs.design')}</span>
          </div>
          <div className="page-hero-grid">
            <div>
              <div className="page-eyebrow">{t('design.eyebrow')}</div>
              <h1 className="page-title">{t('design.title')}</h1>
            </div>
            <div className="page-hero-side">
              <p>{t('design.sub')}</p>
              <div className="page-hero-actions">
                <a href={h('#contact')} className="btn btn-primary">{t('design.cta_btn')}<span className="arrow">↗</span></a>
                <a href={h('#cases')} className="btn btn-ghost">{t('common.cases')}<span className="arrow">↗</span></a>
              </div>
              <div className="hero-side-stats">
                <div className="s"><div className="num">{t('design.stat1_num')}</div><div className="lbl">{t('design.stat1_lbl')}</div></div>
                <div className="s"><div className="num">{t('design.stat2_num')}</div><div className="lbl">{t('design.stat2_lbl')}</div></div>
                <div className="s"><div className="num">{t('design.stat3_num')}<em>+</em></div><div className="lbl">{t('design.stat3_lbl')}</div></div>
                <div className="s"><div className="num">{t('design.stat4_num')}</div><div className="lbl">{t('design.stat4_lbl')}</div></div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* DISCIPLINES */}
      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">01</span>{t('design.sec01_tag').replace('01 ', '')}</div>
            <div>
              <h2 className="sec-title">{t('design.sec01_title')}</h2>
              <p className="sec-sub">{t('design.sec01_sub')}</p>
            </div>
          </div>

          <div className="disc">
            {disciplines.map((d) => (
              <Link key={d.id} to={d.to} className={`dt ${d.cls}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                {d.id === 'dt-1' && <div className="vis" />}
                <div className="top"><span>{d.n}</span></div>
                <h4>{t(d.h)}</h4>
                {d.id === 'dt-1' && <p>{t('design.d01_sub')}</p>}
                {d.id === 'dt-4' && <p>{t('design.d04_sub')}</p>}
                <div className="meta">
                  <span>{d.metaKey ? t(d.metaKey) : t(d.subKey)}</span>
                  <span className="arr">↗</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* PRINCIPLES */}
      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">02</span>{t('design.sec02_tag').replace('02 ', '')}</div>
            <div><h2 className="sec-title">{t('design.sec02_title')}</h2></div>
          </div>
          <div className="princ">
            {principles.map((pr, i) => (
              <div key={i} className="p">
                <div className="num">{pr.n}</div>
                <h4>{t(pr.titleKey)}</h4>
                <p>{t(pr.textKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">03</span>{t('design.sec03_tag').replace('03 ', '')}</div>
            <div>
              <h2 className="sec-title">{t('design.sec03_title')}</h2>
            </div>
          </div>
          <div className="pricing">
            <div className="tier">
              <div className="tier-badge">{t('design.t1_badge')}</div>
              <div className="tier-name">{t('design.t1_name')}</div>
              <div className="tier-sub">{t('design.t1_sub')}</div>
              <div className="tier-price">{t('design.t1_price')}</div>
              <ul className="tier-incl">
                {[t('design.t1_f1'), t('design.t1_f2'), t('design.t1_f3'), t('design.t1_f4'), t('design.t1_f5')].map(l => <li key={l}>{l}</li>)}
              </ul>
              <a href={h('#contact')} className="btn btn-ghost">{t('design.tier_discuss')}<span className="arrow">↗</span></a>
            </div>

            <div className="tier featured">
              <div className="tier-badge">{t('design.t2_badge')}</div>
              <div className="tier-name">{t('design.t2_name')}</div>
              <div className="tier-sub">{t('design.t2_sub')}</div>
              <div className="tier-price">{t('design.t2_price')}</div>
              <ul className="tier-incl">
                {[t('design.t2_f1'), t('design.t2_f2'), t('design.t2_f3'), t('design.t2_f4'), t('design.t2_f5'), t('design.t2_f6')].map(l => <li key={l}>{l}</li>)}
              </ul>
              <a href={h('#contact')} className="btn">{t('design.cta_btn')}<span className="arrow">↗</span></a>
            </div>

            <div className="tier">
              <div className="tier-badge">{t('design.t3_badge')}</div>
              <div className="tier-name">{t('design.t3_name')}</div>
              <div className="tier-sub">{t('design.t3_sub')}</div>
              <div className="tier-price">{t('design.t3_price')}</div>
              <ul className="tier-incl">
                {[t('design.t3_f1'), t('design.t3_f2'), t('design.t3_f3'), t('design.t3_f4'), t('design.t3_f5')].map(l => <li key={l}>{l}</li>)}
              </ul>
              <a href={h('#contact')} className="btn btn-ghost">{t('design.tier_discuss')}<span className="arrow">↗</span></a>
            </div>
          </div>
        </div>
      </section>

      {/* AUDIENCE / PROBLEMS */}
      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">04</span>{t('design.audience_tag').replace('05 ', '')}</div>
            <div><h2 className="sec-title">{t('design.audience_title')}</h2></div>
          </div>
          <div className="deliv">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="deliv-row">
                <div className="num">{`A/0${i}`}</div>
                <div><h4>{t(`design.aud${i}_title`)}</h4><p>{t(`design.aud${i}_desc`)}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">05</span>{t('design.faq_tag').replace('06 ', '')}</div>
            <div><h2 className="sec-title">{t('design.faq_title')}</h2></div>
          </div>
          <div className="faq">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="deliv-row">
                <div className="num">{`Q${i}`}</div>
                <div><h4>{t(`design.faq${i}_q`)}</h4><p>{t(`design.faq${i}_a`)}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CASES */}
      <RelatedCases
        num="06"
        tag={t('common.cases')}
        heading={t('home.sec02_title')}
        allLabel={t('home.all_works')}
        keywords={['design', 'brand', 'branding', 'identity']}
      />

      <RelatedServices
        num="07"
        tag={t('design.rel_tag').replace('07 ', '')}
        heading={t('design.rel_title')}
        items={[
          { title: t('design.rel1_title'), desc: t('design.rel1_desc'), to: p('/services/development') },
          { title: t('design.rel2_title'), desc: t('design.rel2_desc'), to: p('/services/content') },
          { title: t('design.rel3_title'), desc: t('design.rel3_desc'), to: p('/services/smm') },
        ]}
      />

      <section className="cta-strip" style={{ borderBottom: 0 }}>
        <div className="wrap">
          <div className="grid">
            <div>
              <h2>{t('design.cta_title')}</h2>
              <p>{t('design.cta_sub')}</p>
              <div className="cta-actions">
                <a href={h('#contact')} className="btn btn-primary">{t('design.cta_btn')}<span className="arrow">↗</span></a>
                <a href={`mailto:${t('common.email')}`} className="btn btn-ghost">{t('common.email')}<span className="arrow">↗</span></a>
              </div>
            </div>
            <div className="cta-side">
              <div className="row"><div className="lbl">{t('common.slots_q3')}</div><div className="val">{t('common.slots_val')}</div></div>
              <div className="row"><div className="lbl">{t('common.start')}</div><div className="val">{t('common.start_val')}</div></div>
              <div className="row" style={{ borderBottom: 0 }}><div className="lbl">{t('common.nda')}</div><div className="val">{t('common.nda_val')}</div></div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
