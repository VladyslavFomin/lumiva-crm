import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageSEO from '../components/PageSEO'
import { useLangPath } from '../hooks/useLangPath'

function FAQ() {
  const { t } = useTranslation()
  const [open, setOpen] = useState<number | null>(null)
  const items = [
    { q: t('services.faq1_q'), a: t('services.faq1_a') },
    { q: t('services.faq2_q'), a: t('services.faq2_a') },
    { q: t('services.faq3_q'), a: t('services.faq3_a') },
    { q: t('services.faq4_q'), a: t('services.faq4_a') },
  ]
  return (
    <div className="faq">
      {items.map((item, i) => (
        <div key={i} className={`faq-item${open === i ? ' open' : ''}`} onClick={() => setOpen(open === i ? null : i)}>
          <div className="faq-q">
            <span className="faq-num">[{String(i + 1).padStart(2, '0')}]</span>
            <div className="faq-text">{item.q}</div>
            <div className="faq-toggle" />
          </div>
          <div className="faq-a"><div className="faq-a-inner">{item.a}</div></div>
        </div>
      ))}
    </div>
  )
}

export default function ServicesPage() {
  const { t } = useTranslation()
  const { p, h } = useLangPath()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const el = e.currentTarget as HTMLElement
      const r = el.getBoundingClientRect()
      el.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%')
      el.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%')
    }
    const cards = document.querySelectorAll<HTMLElement>('[data-svc]')
    cards.forEach(el => el.addEventListener('mousemove', handler))

    const els = document.querySelectorAll<HTMLElement>('.svc-card, .ind-cell, .faq-item, .sec-head')
    els.forEach(el => el.classList.add('reveal'))
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in') }),
      { threshold: 0.08 }
    )
    els.forEach(el => observer.observe(el))
    window.scrollTo(0, 0)
    return () => {
      cards.forEach(el => el.removeEventListener('mousemove', handler))
      observer.disconnect()
    }
  }, [])

  const svcCards = [
    { num: 'S/01', titleKey: 'services.s01_title', subKey: 'services.s01_sub', bioKey: 'services.s01_sub', stack: ['Next.js', 'React', 'TypeScript', 'Webflow', 'Headless CMS', 'Mobile'], statKey: 'services.s01_stat', to: p('/services/development') },
    { num: 'S/02', titleKey: 'services.s02_title', subKey: 'services.s02_sub', stack: ['Brand', 'UI/UX', 'Packaging', 'Motion', '3D', 'Editorial'], statKey: 'services.s02_stat', to: p('/services/design') },
    { num: 'S/03', titleKey: 'services.s03_title', subKey: 'services.s03_sub', stack: ['GA4', 'Yandex Metrica', 'Roistat', 'Amplitude', 'Tableau', 'dbt'], statKey: 'services.s03_stat', to: p('/services/analytics') },
    { num: 'S/04', titleKey: 'services.s04_title', subKey: 'services.s04_sub', stack: ['JTBD', 'CJM', 'Positioning', 'Research', 'Workshops'], statKey: 'services.s04_stat', to: p('/services/strategy') },
    { num: 'S/05', titleKey: 'services.s05_title', subKey: 'services.s05_sub', stack: ['Google Ads', 'Meta', 'Programmatic', 'CRM', 'Email'], statKey: 'services.s05_stat', to: p('/services/performance') },
    { num: 'S/06', titleKey: 'services.s06_title', subKey: 'services.s06_sub', stack: ['Photo', 'Video', 'Instagram', 'YouTube', 'Influence'], statKey: 'services.s06_stat', to: p('/services/content') },
    { num: 'S/07', titleKey: 'services.s07_title', subKey: 'services.s07_sub', stack: ['Semrush', 'Ahrefs', 'Core Web Vitals', 'Google'], statKey: 'services.s07_stat', to: p('/services/seo') },
    { num: 'S/08', titleKey: 'services.s08_title', subKey: 'services.s08_sub', stack: ['Lumiva CRM', 'Custom', 'Integrations', 'Auto-funnels', 'Analytics'], statCtaKey: 'services.s08_stat_cta', href: 'https://crm.lumiva.agency/' },
  ]

  const industries = [
    ['ind01', 'ind01_ct'], ['ind02', 'ind02_ct'], ['ind03', 'ind03_ct'],
    ['ind04', 'ind04_ct'], ['ind05', 'ind05_ct'], ['ind06', 'ind06_ct'],
    ['ind07', 'ind07_ct'], ['ind08', 'ind08_ct'], ['ind09', 'ind09_ct'],
    ['ind10', 'ind10_ct'], ['ind11', 'ind11_ct'], ['ind12', 'ind12_ct'],
  ]

  return (
    <>
      <PageSEO
        title={t('services.seo_title')}
        description={t('services.seo_desc')}
        path={p('/services')}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: [
            { '@type': 'Question', name: t('services.faq1_q'), acceptedAnswer: { '@type': 'Answer', text: t('services.faq1_a') } },
            { '@type': 'Question', name: t('services.faq2_q'), acceptedAnswer: { '@type': 'Answer', text: t('services.faq2_a') } },
            { '@type': 'Question', name: t('services.faq3_q'), acceptedAnswer: { '@type': 'Answer', text: t('services.faq3_a') } },
            { '@type': 'Question', name: t('services.faq4_q'), acceptedAnswer: { '@type': 'Answer', text: t('services.faq4_a') } },
          ],
        }}
      />
      <header className="page-hero">
        <div className="wrap">
          <div className="crumbs">
            <Link to={p('/')}>{t('crumbs.home')}</Link><span className="sep">/</span><span>{t('crumbs.services')}</span>
          </div>
          <div className="page-hero-grid">
            <div>
              <div className="page-eyebrow">{t('services.eyebrow')}</div>
              <h1 className="page-title">{t('services.title')}</h1>
            </div>
            <div className="page-hero-side">
              <p>{t('services.hero_sub')}</p>
              <div className="page-hero-actions">
                <a href={h('#contact')} className="btn btn-primary">{t('services.hero_cta_discuss')}<span className="arrow">↗</span></a>
                <a href={h('#cases')} className="btn btn-ghost">{t('services.hero_cta_cases')}<span className="arrow">↗</span></a>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">01</span>{t('services.sec01_tag').replace('01 ', '')}</div>
            <div>
              <h2 className="sec-title">{t('services.sec01_title')}</h2>
              <p className="sec-sub">{t('services.sec01_sub')}</p>
            </div>
          </div>

          <div className="svc-index">
            {svcCards.map((svc, i) => {
              const inner = (
                <>
                  <div className="svc-head">
                    <span>{svc.num} · {t(svc.titleKey)}</span>
                    <span className="live">{t('services.s01_badge')}</span>
                  </div>
                  <h3 className="svc-name">{t(svc.subKey)}</h3>
                  <div className="svc-list">
                    {svc.stack.map(tag => <span key={tag} className="tg">{tag}</span>)}
                  </div>
                  <div className="svc-foot">
                    {svc.statCtaKey
                      ? <div className="svc-stat" style={{ fontSize: 18 }}>crm.lumiva.agency<span className="lbl">{t(svc.statCtaKey)}</span></div>
                      : <div className="svc-stat">{t(svc.statKey!)}</div>
                    }
                    <div className="svc-link">{t('services.learn_more')} <span className="arr">↗</span></div>
                  </div>
                </>
              )
              if ((svc as any).href) {
                return <a key={i} href={(svc as any).href} target="_blank" rel="noopener noreferrer" className="svc-card" data-svc>{inner}</a>
              }
              return <Link key={i} to={(svc as any).to} className="svc-card" data-svc>{inner}</Link>
            })}
          </div>
        </div>
      </section>

      {/* INDUSTRIES */}
      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">02</span>{t('services.sec02_tag').replace('02 ', '')}</div>
            <div>
              <h2 className="sec-title">{t('services.sec02_title')}</h2>
              <p className="sec-sub">{t('services.sec02_sub')} {t('services.sec02_hint')}</p>
            </div>
            <a href={h('#cases')} className="show-all">{t('services.cases_link')} <span className="arr">↗</span></a>
          </div>
          <div className="ind-grid">
            {industries.map(([nmKey, ctKey]) => (
              <div key={nmKey} className="ind-cell">
                <div className="nm">{t(`services.${nmKey}`)}</div>
                <div className="ct">{t(`services.${ctKey}`)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">03</span>{t('services.sec03_tag').replace('03 ', '')}</div>
            <div><h2 className="sec-title">{t('services.sec03_title')}</h2></div>
          </div>
          <FAQ />
        </div>
      </section>

      {/* CTA STRIP */}
      <section className="cta-strip" style={{ borderBottom: 0 }}>
        <div className="wrap">
          <div className="grid">
            <div>
              <h2>{t('services.cta_title')}</h2>
              <p>{t('services.cta_sub')}</p>
              <div className="cta-actions">
                <a href={h('#contact')} className="btn btn-primary">{t('services.cta_btn')}<span className="arrow">↗</span></a>
                <a href={`mailto:${t('common.email')}`} className="btn btn-ghost">{t('common.email')}<span className="arrow">↗</span></a>
              </div>
            </div>
            <div className="cta-side">
              <div className="row"><div className="lbl">{t('common.slots_q3')}</div><div className="val">{t('common.slots_val')}</div></div>
              <div className="row"><div className="lbl">{t('common.start')}</div><div className="val">{t('common.start_val')}</div></div>
              <div className="row"><div className="lbl">{t('common.response_time')}</div><div className="val">{t('common.response_val')}</div></div>
              <div className="row" style={{ borderBottom: 0 }}><div className="lbl">{t('common.nda')}</div><div className="val">{t('common.nda_val')}</div></div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
