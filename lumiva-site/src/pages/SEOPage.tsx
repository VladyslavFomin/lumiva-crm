import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageSEO from '../components/PageSEO'
import RelatedServices from '../components/RelatedServices'
import RelatedCases from '../components/RelatedCases'
import { useLangPath } from '../hooks/useLangPath'

export default function SEOPage() {
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

  const tools = ['Semrush', 'Ahrefs', 'Screaming Frog', 'Google Search Console', 'Yandex Webmaster', 'DataForSEO', 'Surfer SEO', 'Yandex Metrica', 'GA4']

  return (
    <>
      <PageSEO
        title={t('seo.title')}
        description={t('seo.sub')}
        path={p('/services/seo')}
        jsonLd={[
          { '@context': 'https://schema.org', '@type': 'Service', name: 'SEO and Organic Growth', provider: { '@type': 'Organization', name: 'Lumiva Agency', url: 'https://lumiva.agency' }, areaServed: ['Turkey', 'Europe', 'CIS'], serviceType: 'SEO' },
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [1, 2, 3, 4, 5, 6].map(i => ({
              '@type': 'Question',
              name: t(`seo.faq${i}_q`),
              acceptedAnswer: { '@type': 'Answer', text: t(`seo.faq${i}_a`) },
            })),
          },
        ]}
      />
      <header className="page-hero">
        <div className="wrap">
          <div className="crumbs">
            <Link to={p('/')}>{t('crumbs.home')}</Link><span className="sep">/</span>
            <Link to={p('/services')}>{t('crumbs.services')}</Link><span className="sep">/</span>
            <span>{t('seo.eyebrow')}</span>
          </div>
          <div className="page-hero-grid">
            <div>
              <div className="page-eyebrow">{t('seo.eyebrow')}</div>
              <h1 className="page-title">{t('seo.title')}</h1>
            </div>
            <div className="page-hero-side">
              <p>{t('seo.sub')}</p>
              <div className="page-hero-actions">
                <a href={h('#contact')} className="btn btn-primary">{t('seo.cta_btn')}<span className="arrow">↗</span></a>
                <a href={h('#cases')} className="btn btn-ghost">{t('common.cases')}<span className="arrow">↗</span></a>
              </div>
              <div className="hero-side-stats">
                <div className="s"><div className="num">+340<em>%</em></div><div className="lbl">{t('seo.stat1_lbl')}</div></div>
                <div className="s"><div className="num">−55<em>%</em></div><div className="lbl">{t('seo.stat2_lbl')}</div></div>
                <div className="s"><div className="num">Top3</div><div className="lbl">{t('seo.stat3_lbl')}</div></div>
                <div className="s"><div className="num">3<em>mo</em></div><div className="lbl">{t('seo.stat4_lbl')}</div></div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">01</span>{t('seo.sec01_tag').replace('01 ', '')}</div>
            <div>
              <h2 className="sec-title">{t('seo.sec01_title')}</h2>
            </div>
            <a href={h('#contact')} className="show-all">{t('seo.cta_btn')} <span className="arr">↗</span></a>
          </div>
          <div className="deliv">
            {[
              { n: 'D/01', titleKey: 'seo.d01_title', descKey: 'seo.d01_sub' },
              { n: 'D/02', titleKey: 'seo.d02_title', descKey: 'seo.d02_sub' },
              { n: 'D/03', titleKey: 'seo.d03_title', descKey: 'seo.d03_sub' },
              { n: 'D/04', titleKey: 'seo.d04_title', descKey: 'seo.d04_sub' },
              { n: 'D/05', titleKey: 'seo.d05_title', descKey: 'seo.d05_sub' },
              { n: 'D/06', titleKey: 'seo.d06_title', descKey: 'seo.d06_sub' },
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
            <div className="sec-tag"><span className="num">02</span>{t('seo.sec02_tag').replace('02 ', '')}</div>
            <div>
              <h2 className="sec-title">{t('seo.sec02_title')}</h2>
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
            <div className="sec-tag"><span className="num">03</span>{t('seo.sec03_tag').replace('03 ', '')}</div>
            <div>
              <h2 className="sec-title">{t('seo.sec03_title')}</h2>
            </div>
          </div>
          <div className="pmini">
            {[
              { n: '01', hKey: 'seo.proc01', dKey: 'seo.proc01' },
              { n: '02', hKey: 'seo.proc02', dKey: 'seo.proc02' },
              { n: '03', hKey: 'seo.proc03', dKey: 'seo.proc03' },
              { n: '04', hKey: 'seo.proc04', dKey: 'seo.proc04' },
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
            <div className="sec-tag"><span className="num">04</span>{t('seo.sec04_tag').replace('04 ', '')}</div>
            <div>
              <h2 className="sec-title">{t('seo.sec04_title')}</h2>
            </div>
          </div>
          <div className="pricing">
            <div className="tier">
              <div className="tier-badge">{t('seo.t1_badge')}</div>
              <div className="tier-name">{t('seo.t1_name')}</div>
              <div className="tier-sub">{t('seo.t1_sub')}</div>
              <div className="tier-price">{t('seo.t1_price')}</div>
              <ul className="tier-incl">
                {[t('seo.t1_f1'), t('seo.t1_f2'), t('seo.t1_f3'), t('seo.t1_f4'), t('seo.t1_f5')].map(l => <li key={l}>{l}</li>)}
              </ul>
              <a href={h('#contact')} className="btn btn-ghost">{t('seo.tier_discuss')}<span className="arrow">↗</span></a>
            </div>
            <div className="tier featured">
              <div className="tier-badge">{t('seo.t2_badge')}</div>
              <div className="tier-name">{t('seo.t2_name')}</div>
              <div className="tier-sub">{t('seo.t2_sub')}</div>
              <div className="tier-price">{t('seo.t2_price')}</div>
              <ul className="tier-incl">
                {[t('seo.t2_f1'), t('seo.t2_f2'), t('seo.t2_f3'), t('seo.t2_f4'), t('seo.t2_f5'), t('seo.t2_f6')].map(l => <li key={l}>{l}</li>)}
              </ul>
              <a href={h('#contact')} className="btn">{t('seo.cta_btn')}<span className="arrow">↗</span></a>
            </div>
            <div className="tier">
              <div className="tier-badge">{t('seo.t3_badge')}</div>
              <div className="tier-name">{t('seo.t3_name')}</div>
              <div className="tier-sub">{t('seo.t3_sub')}</div>
              <div className="tier-price">{t('seo.t3_price')}</div>
              <ul className="tier-incl">
                {[t('seo.t3_f1'), t('seo.t3_f2'), t('seo.t3_f3'), t('seo.t3_f4'), t('seo.t3_f5'), t('seo.t3_f6')].map(l => <li key={l}>{l}</li>)}
              </ul>
              <a href={h('#contact')} className="btn btn-ghost">{t('seo.tier_discuss')}<span className="arrow">↗</span></a>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">05</span>{t('seo.audience_tag').replace('05 ', '')}</div>
            <div><h2 className="sec-title">{t('seo.audience_title')}</h2></div>
          </div>
          <div className="deliv">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="deliv-row">
                <div className="num">{`A/0${i}`}</div>
                <div><h4>{t(`seo.aud${i}_title`)}</h4><p>{t(`seo.aud${i}_desc`)}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">06</span>{t('seo.faq_tag').replace('06 ', '')}</div>
            <div><h2 className="sec-title">{t('seo.faq_title')}</h2></div>
          </div>
          <div className="faq">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="deliv-row">
                <div className="num">{`Q${i}`}</div>
                <div><h4>{t(`seo.faq${i}_q`)}</h4><p>{t(`seo.faq${i}_a`)}</p></div>
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
        keywords={['seo', 'organic', 'search']}
      />

      <RelatedServices
        num="08"
        tag={t('seo.rel_tag').replace('08 ', '')}
        heading={t('seo.rel_title')}
        items={[
          { title: t('seo.rel1_title'), desc: t('seo.rel1_desc'), to: p('/services/analytics') },
          { title: t('seo.rel2_title'), desc: t('seo.rel2_desc'), to: p('/services/performance') },
          { title: t('seo.rel3_title'), desc: t('seo.rel3_desc'), to: p('/services/content') },
        ]}
      />

      <section className="cta-strip" style={{ borderBottom: 0 }}>
        <div className="wrap">
          <div className="grid">
            <div>
              <h2>{t('seo.cta_title')}</h2>
              <p>{t('seo.cta_sub')}</p>
              <div className="cta-actions">
                <a href={h('#contact')} className="btn btn-primary">{t('seo.cta_btn')}<span className="arrow">↗</span></a>
                <a href={`mailto:${t('common.email')}`} className="btn btn-ghost">{t('common.email')}<span className="arrow">↗</span></a>
              </div>
            </div>
            <div className="cta-side">
              <div className="row"><div className="lbl">{t('seo.audit_free')}</div><div className="val">{t('seo.audit_time')}</div></div>
              <div className="row"><div className="lbl">{t('common.start')}</div><div className="val">{t('common.start_val')}</div></div>
              <div className="row" style={{ borderBottom: 0 }}><div className="lbl">{t('common.response_time')}</div><div className="val">{t('common.response_val')}</div></div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
