import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageSEO from '../components/PageSEO'
import RelatedServices from '../components/RelatedServices'
import RelatedCases from '../components/RelatedCases'
import { useLangPath } from '../hooks/useLangPath'

export default function PerformancePage() {
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

  const tools = ['Google Ads', 'Meta Ads', 'LinkedIn Ads', 'TikTok Ads', 'Roistat', 'Calltouch', 'GA4', 'DoubleClick', 'DV360']

  return (
    <>
      <PageSEO
        title={t('performance.title')}
        description={t('performance.sub')}
        path={p('/services/performance')}
        jsonLd={[
          { '@context': 'https://schema.org', '@type': 'Service', name: 'Performance Marketing', provider: { '@type': 'Organization', name: 'Lumiva Agency', url: 'https://lumiva.agency' }, areaServed: ['Turkey', 'Europe', 'CIS'], serviceType: 'Performance Marketing' },
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [1, 2, 3, 4, 5, 6].map(i => ({
              '@type': 'Question',
              name: t(`performance.faq${i}_q`),
              acceptedAnswer: { '@type': 'Answer', text: t(`performance.faq${i}_a`) },
            })),
          },
        ]}
      />
      <header className="page-hero">
        <div className="wrap">
          <div className="crumbs">
            <Link to={p('/')}>{t('crumbs.home')}</Link><span className="sep">/</span>
            <Link to={p('/services')}>{t('crumbs.services')}</Link><span className="sep">/</span>
            <span>{t('performance.eyebrow')}</span>
          </div>
          <div className="page-hero-grid">
            <div>
              <div className="page-eyebrow">{t('performance.eyebrow')}</div>
              <h1 className="page-title">{t('performance.title')}</h1>
            </div>
            <div className="page-hero-side">
              <p>{t('performance.sub')}</p>
              <div className="page-hero-actions">
                <a href={h('#contact')} className="btn btn-primary">{t('performance.cta_btn')}<span className="arrow">↗</span></a>
                <a href={h('#cases')} className="btn btn-ghost">{t('common.cases')}<span className="arrow">↗</span></a>
              </div>
              <div className="hero-side-stats">
                <div className="s"><div className="num">×4.8</div><div className="lbl">{t('performance.stat1_lbl')}</div></div>
                <div className="s"><div className="num">−38<em>%</em></div><div className="lbl">{t('performance.stat2_lbl')}</div></div>
                <div className="s"><div className="num">€4<em>M+</em></div><div className="lbl">{t('performance.stat3_lbl')}</div></div>
                <div className="s"><div className="num">8<em>wk</em></div><div className="lbl">{t('performance.stat4_lbl')}</div></div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">01</span>{t('performance.sec01_tag').replace('01 ', '')}</div>
            <div>
              <h2 className="sec-title">{t('performance.sec01_title')}</h2>
            </div>
            <a href={h('#contact')} className="show-all">{t('performance.cta_btn')} <span className="arr">↗</span></a>
          </div>
          <div className="deliv">
            {[
              { n: 'D/01', titleKey: 'performance.d01_title', descKey: 'performance.d01_sub' },
              { n: 'D/02', titleKey: 'performance.d02_title', descKey: 'performance.d02_sub' },
              { n: 'D/03', titleKey: 'performance.d03_title', descKey: 'performance.d03_sub' },
              { n: 'D/04', titleKey: 'performance.d04_title', descKey: 'performance.d04_sub' },
              { n: 'D/05', titleKey: 'performance.d05_title', descKey: 'performance.d05_sub' },
              { n: 'D/06', titleKey: 'performance.d06_title', descKey: 'performance.d06_sub' },
            ].map((d, i) => (
              <div key={i} className="deliv-row">
                <div className="num">{d.n}</div>
                <div><h4>{t(d.titleKey)}</h4><p>{t(d.descKey)}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">02</span>{t('performance.sec02_tag').replace('02 ', '')}</div>
            <div>
              <h2 className="sec-title">{t('performance.sec02_title')}</h2>
            </div>
          </div>
          <div className="stack">
            {tools.map(c => <span key={c} className="chip"><span className="pip" />{c}</span>)}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">03</span>{t('performance.sec03_tag').replace('03 ', '')}</div>
            <div>
              <h2 className="sec-title">{t('performance.sec03_title')}</h2>
            </div>
          </div>
          <div className="pmini">
            {[
              { n: '01', hKey: 'performance.proc01', dKey: 'performance.proc01' },
              { n: '02', hKey: 'performance.proc02', dKey: 'performance.proc02' },
              { n: '03', hKey: 'performance.proc03', dKey: 'performance.proc03' },
              { n: '04', hKey: 'performance.proc04', dKey: 'performance.proc04' },
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

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">04</span>{t('performance.sec04_tag').replace('04 ', '')}</div>
            <div>
              <h2 className="sec-title">{t('performance.sec04_title')}</h2>
            </div>
          </div>
          <div className="pricing">
            <div className="tier">
              <div className="tier-badge">{t('performance.t1_badge')}</div>
              <div className="tier-name">{t('performance.t1_name')}</div>
              <div className="tier-sub">{t('performance.t1_sub')}</div>
              <div className="tier-price">{t('performance.t1_price')}</div>
              <ul className="tier-incl">
                {[t('performance.t1_f1'), t('performance.t1_f2'), t('performance.t1_f3'), t('performance.t1_f4'), t('performance.t1_f5'), t('performance.t1_f6')].map(l => <li key={l}>{l}</li>)}
              </ul>
              <a href={h('#contact')} className="btn btn-ghost">{t('performance.tier_discuss')}<span className="arrow">↗</span></a>
            </div>
            <div className="tier featured">
              <div className="tier-badge">{t('performance.t2_badge')}</div>
              <div className="tier-name">{t('performance.t2_name')}</div>
              <div className="tier-sub">{t('performance.t2_sub')}</div>
              <div className="tier-price">{t('performance.t2_price')}</div>
              <ul className="tier-incl">
                {[t('performance.t2_f1'), t('performance.t2_f2'), t('performance.t2_f3'), t('performance.t2_f4'), t('performance.t2_f5'), t('performance.t2_f6'), t('performance.t2_f7')].map(l => <li key={l}>{l}</li>)}
              </ul>
              <a href={h('#contact')} className="btn">{t('performance.cta_btn')}<span className="arrow">↗</span></a>
            </div>
            <div className="tier">
              <div className="tier-badge">{t('performance.t3_badge')}</div>
              <div className="tier-name">{t('performance.t3_name')}</div>
              <div className="tier-sub">{t('performance.t3_sub')}</div>
              <div className="tier-price">{t('performance.t3_price')}</div>
              <ul className="tier-incl">
                {[t('performance.t3_f1'), t('performance.t3_f2'), t('performance.t3_f3'), t('performance.t3_f4'), t('performance.t3_f5'), t('performance.t3_f6')].map(l => <li key={l}>{l}</li>)}
              </ul>
              <a href={h('#contact')} className="btn btn-ghost">{t('performance.tier_discuss')}<span className="arrow">↗</span></a>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">05</span>{t('performance.audience_tag').replace('05 ', '')}</div>
            <div><h2 className="sec-title">{t('performance.audience_title')}</h2></div>
          </div>
          <div className="deliv">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="deliv-row">
                <div className="num">{`A/0${i}`}</div>
                <div><h4>{t(`performance.aud${i}_title`)}</h4><p>{t(`performance.aud${i}_desc`)}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">06</span>{t('performance.faq_tag').replace('06 ', '')}</div>
            <div><h2 className="sec-title">{t('performance.faq_title')}</h2></div>
          </div>
          <div className="faq">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="deliv-row">
                <div className="num">{`Q${i}`}</div>
                <div><h4>{t(`performance.faq${i}_q`)}</h4><p>{t(`performance.faq${i}_a`)}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <RelatedCases
        num="07"
        tag={t('common.cases')}
        heading={t('home.sec02_title')}
        allLabel={t('home.all_works')}
        keywords={['performance', 'ads', 'ppc', 'paid']}
      />

      <RelatedServices
        num="08"
        tag={t('performance.rel_tag').replace('08 ', '')}
        heading={t('performance.rel_title')}
        items={[
          { title: t('performance.rel1_title'), desc: t('performance.rel1_desc'), to: p('/services/development/landings') },
          { title: t('performance.rel2_title'), desc: t('performance.rel2_desc'), to: p('/services/analytics') },
          { title: t('performance.rel3_title'), desc: t('performance.rel3_desc'), to: p('/services/seo') },
        ]}
      />

      <section className="cta-strip" style={{ borderBottom: 0 }}>
        <div className="wrap">
          <div className="grid">
            <div>
              <h2>{t('performance.cta_title')}</h2>
              <p>{t('performance.cta_sub')}</p>
              <div className="cta-actions">
                <a href={h('#contact')} className="btn btn-primary">{t('performance.cta_btn')}<span className="arrow">↗</span></a>
                <a href={`mailto:${t('common.email')}`} className="btn btn-ghost">{t('common.email')}<span className="arrow">↗</span></a>
              </div>
            </div>
            <div className="cta-side">
              <div className="row"><div className="lbl">{t('performance.audit_free')}</div><div className="val">{t('performance.audit_time')}</div></div>
              <div className="row"><div className="lbl">{t('common.start')}</div><div className="val">{t('common.start_val')}</div></div>
              <div className="row" style={{ borderBottom: 0 }}><div className="lbl">{t('common.response_time')}</div><div className="val">{t('common.response_val')}</div></div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
