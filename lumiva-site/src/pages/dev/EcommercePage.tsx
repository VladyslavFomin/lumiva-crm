import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageSEO from '../../components/PageSEO'
import RelatedServices from '../../components/RelatedServices'
import RelatedCases from '../../components/RelatedCases'
import { useLangPath } from '../../hooks/useLangPath'

export default function EcommercePage() {
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

  const stacksByLang: Record<'en' | 'ru' | 'tr', Record<string, string[]>> = {
    en: {
      Frontend: ['Next.js', 'React', 'TypeScript', 'Tailwind', 'Stripe', 'PayPal', 'Framer Motion'],
      Backend: ['Node.js', 'PostgreSQL', 'Redis', 'Elasticsearch', 'Kafka', 'BullMQ'],
      'CRM & Integrations': ['Lumiva CRM', '1C:Trade', 'MyWarehouse', 'OZON', 'Wildberries', 'Yandex Market', 'CDEK', 'Boxberry'],
      'Infra & Payments': ['Docker', 'Kubernetes', 'Cloudflare', 'YuKassa', 'Tinkoff Pay', 'SBP', 'PayKeeper'],
    },
    ru: {
      Frontend: ['Next.js', 'React', 'TypeScript', 'Tailwind', 'Stripe', 'PayPal', 'Framer Motion'],
      Backend: ['Node.js', 'PostgreSQL', 'Redis', 'Elasticsearch', 'Kafka', 'BullMQ'],
      'CRM и интеграции': ['Lumiva CRM', '1С:Торговля', 'МойСклад', 'OZON', 'Wildberries', 'Яндекс.Маркет', 'СДЭК', 'Boxberry'],
      'Инфраструктура и платежи': ['Docker', 'Kubernetes', 'Cloudflare', 'ЮKassa', 'Тинькофф Pay', 'SBP', 'PayKeeper'],
    },
    tr: {
      Frontend: ['Next.js', 'React', 'TypeScript', 'Tailwind', 'Stripe', 'PayPal', 'Framer Motion'],
      Backend: ['Node.js', 'PostgreSQL', 'Redis', 'Elasticsearch', 'Kafka', 'BullMQ'],
      'CRM ve Entegrasyonlar': ['Lumiva CRM', '1C:Ticaret', 'MyWarehouse', 'OZON', 'Wildberries', 'Yandex Market', 'CDEK', 'Boxberry'],
      'Altyapi ve Odeme': ['Docker', 'Kubernetes', 'Cloudflare', 'YuKassa', 'Tinkoff Pay', 'SBP', 'PayKeeper'],
    },
  }
  const stacks = stacksByLang[langKey]

  const crmItems = [
    { icon: '⚡', title: t('ecommerce.crm_i0_t'), desc: t('ecommerce.crm_i0_d') },
    { icon: '🔗', title: t('ecommerce.crm_i1_t'), desc: t('ecommerce.crm_i1_d') },
    { icon: '📦', title: t('ecommerce.crm_i2_t'), desc: t('ecommerce.crm_i2_d') },
    { icon: '🛠', title: t('ecommerce.crm_i3_t'), desc: t('ecommerce.crm_i3_d') },
  ]

  const delivs = [
    { n: 'EC/01', ta: t('ecommerce.d0_ta'), te: t('ecommerce.d0_te'), desc: t('ecommerce.d0_desc') },
    { n: 'EC/02', ta: t('ecommerce.d1_ta'), te: t('ecommerce.d1_te'), desc: t('ecommerce.d1_desc') },
    { n: 'EC/03', ta: t('ecommerce.d2_ta'), te: t('ecommerce.d2_te'), desc: t('ecommerce.d2_desc') },
    { n: 'EC/04', ta: t('ecommerce.d3_ta'), te: t('ecommerce.d3_te'), desc: t('ecommerce.d3_desc') },
    { n: 'EC/05', ta: t('ecommerce.d4_ta'), te: t('ecommerce.d4_te'), desc: t('ecommerce.d4_desc') },
    { n: 'EC/06', ta: t('ecommerce.d5_ta'), te: t('ecommerce.d5_te'), desc: t('ecommerce.d5_desc') },
    { n: 'EC/07', ta: t('ecommerce.d6_ta'), te: t('ecommerce.d6_te'), desc: t('ecommerce.d6_desc') },
    { n: 'EC/08', ta: t('ecommerce.d7_ta'), te: t('ecommerce.d7_te'), desc: t('ecommerce.d7_desc') },
  ]

  const process = [
    { n: '01', ha: t('ecommerce.p0_ha'), he: t('ecommerce.p0_he'), d: t('ecommerce.p0_d') },
    { n: '02', ha: t('ecommerce.p1_ha'), he: t('ecommerce.p1_he'), d: t('ecommerce.p1_d') },
    { n: '03', ha: t('ecommerce.p2_ha'), he: t('ecommerce.p2_he'), d: t('ecommerce.p2_d') },
    { n: '04', ha: t('ecommerce.p3_ha'), he: t('ecommerce.p3_he'), d: t('ecommerce.p3_d') },
  ]


  return (
    <>
      <PageSEO
        title={t('ecommerce.seo_title')}
        description={t('ecommerce.seo_desc')}
        path={p('/services/development/ecommerce')}
        jsonLd={[
          { '@context': 'https://schema.org', '@type': 'Service', name: 'E-commerce Development', provider: { '@type': 'Organization', name: 'Lumiva Agency', url: 'https://lumiva.agency' }, areaServed: ['Turkey', 'Europe', 'CIS'], serviceType: 'E-commerce Development' },
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [1, 2, 3, 4, 5, 6].map(i => ({
              '@type': 'Question',
              name: t(`ecommerce.faq${i}_q`),
              acceptedAnswer: { '@type': 'Answer', text: t(`ecommerce.faq${i}_a`) },
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
            <span>{t('ecommerce.crumb')}</span>
          </div>
          <div className="page-hero-grid">
            <div>
              <div className="page-eyebrow">D/02 · E-commerce & marketplace</div>
              <h1 className="page-title">{t('ecommerce.hero_title_pre')} <em>{t('ecommerce.hero_title_em')}</em></h1>
            </div>
            <div className="page-hero-side">
              <p>{t('ecommerce.hero_sub')}</p>
              <div className="page-hero-actions">
                <a href={h('#contact')} className="btn btn-primary">{t('cp.request_quote')}<span className="arrow">↗</span></a>
                <a href="#cases" className="btn btn-ghost">{t('cp.cases_link')}<span className="arrow">↗</span></a>
              </div>
              <div className="hero-side-stats">
                <div className="s"><div className="num">200K<em>+</em></div><div className="lbl">{t('ecommerce.stat1_lbl')}</div></div>
                <div className="s"><div className="num">99.97<em>%</em></div><div className="lbl">{t('ecommerce.stat2_lbl')}</div></div>
                <div className="s"><div className="num">40<em>+</em></div><div className="lbl">{t('ecommerce.stat3_lbl')}</div></div>
                <div className="s"><div className="num">×3.2<em></em></div><div className="lbl">{t('ecommerce.stat4_lbl')}</div></div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section style={{ background: 'var(--paper-2)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div className="wrap">
          <div className="r1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 48, alignItems: 'center' }}>
            <div>
              <div className="sec-tag" style={{ marginBottom: 16 }}><span className="num">★</span>{t('ecommerce.crm_tag')}</div>
              <h2 className="sec-title" style={{ marginBottom: 16 }}>{t('ecommerce.crm_title_pre')} <em>{t('ecommerce.crm_title_em')}</em></h2>
              <p style={{ color: '#444', lineHeight: 1.65, marginBottom: 12 }}>{t('ecommerce.crm_p1')}</p>
              <p style={{ color: '#444', lineHeight: 1.65 }}>{t('ecommerce.crm_p2')}</p>
            </div>
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {crmItems.map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 16, padding: '16px 20px', background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 8 }}>
                    <div style={{ fontSize: 22 }}>{item.icon}</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{item.title}</div>
                      <div style={{ fontSize: 13.5, color: '#555', lineHeight: 1.5 }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">01</span>{t('cp.sec_included')}</div>
            <div>
              <h2 className="sec-title">{t('ecommerce.sec01_title_pre')} <em>{t('ecommerce.sec01_title_em')}</em></h2>
              <p className="sec-sub">{t('ecommerce.sec01_sub')}</p>
            </div>
            <a href={h('#contact')} className="show-all">{t('cp.request_quote')} <span className="arr">↗</span></a>
          </div>
          <div className="deliv">
            {delivs.map((d, i) => (
              <div key={i} className="deliv-row">
                <div className="num">{d.n}</div>
                <div><h4>{d.ta}<em>{d.te}</em></h4><p>{d.desc}</p></div>
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
              <h2 className="sec-title">{t('ecommerce.sec02_title_pre')} <em>{t('ecommerce.sec02_title_em')}</em></h2>
              <p className="sec-sub">{t('ecommerce.sec02_sub')}</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {Object.entries(stacks).map(([label, chips]) => (
              <div key={label}>
                <div className="sec-tag" style={{ marginBottom: 14 }}><span className="num">{label[0]}</span>{label}</div>
                <div className="stack">{chips.map(c => <span key={c} className="chip"><span className="pip" />{c}</span>)}</div>
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
              <h2 className="sec-title">{t('ecommerce.sec03_title_pre')} <em>{t('ecommerce.sec03_title_em')}</em></h2>
              <p className="sec-sub">{t('ecommerce.sec03_sub')}</p>
            </div>
          </div>
          <div className="pmini">
            {process.map((r, i) => (
              <div key={i} className="pmini-row">
                <div className="pmini-num">{r.n}</div>
                <div className="pmini-h">{r.ha}<em>{r.he}</em></div>
                <div className="pmini-d">{r.d}</div>
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
              <h2 className="sec-title">{t('ecommerce.sec04_title_pre')} <em>{t('ecommerce.sec04_title_em')}</em></h2>
              <p className="sec-sub">{t('ecommerce.sec04_sub')}</p>
            </div>
          </div>
          <div className="pricing">
            <div className="tier">
              <div className="tier-badge">{t('ecommerce.t1_badge')}</div>
              <div className="tier-name">{t('ecommerce.t1_name')}</div>
              <div className="tier-sub">{t('ecommerce.t1_sub')}</div>
              <div className="tier-price">{priceFrom} 5 000<em>€</em></div>
              <ul className="tier-incl">
                {[t('ecommerce.t1_f1'), t('ecommerce.t1_f2'), t('ecommerce.t1_f3'), t('ecommerce.t1_f4'), t('ecommerce.t1_f5'), t('ecommerce.t1_f6')].map(l => <li key={l}>{l}</li>)}
              </ul>
              <a href={h('#contact')} className="btn btn-ghost">{t('cp.discuss')}<span className="arrow">↗</span></a>
            </div>
            <div className="tier featured">
              <div className="tier-badge">{t('ecommerce.t2_badge')}</div>
              <div className="tier-name">{t('ecommerce.t2_name')}</div>
              <div className="tier-sub">{t('ecommerce.t2_sub')}</div>
              <div className="tier-price">{priceFrom} 18 000<em>€</em></div>
              <ul className="tier-incl">
                {[t('ecommerce.t2_f1'), t('ecommerce.t2_f2'), t('ecommerce.t2_f3'), t('ecommerce.t2_f4'), t('ecommerce.t2_f5'), t('ecommerce.t2_f6'), t('ecommerce.t2_f7')].map(l => <li key={l}>{l}</li>)}
              </ul>
              <a href={h('#contact')} className="btn">{t('cp.request_quote')}<span className="arrow">↗</span></a>
            </div>
            <div className="tier">
              <div className="tier-badge">{t('ecommerce.t3_badge')}</div>
              <div className="tier-name">{t('ecommerce.t3_name')}</div>
              <div className="tier-sub">{t('ecommerce.t3_sub')}</div>
              <div className="tier-price">{priceFrom} 3 500<em>€/{monthShort}</em></div>
              <ul className="tier-incl">
                {[t('ecommerce.t3_f1'), t('ecommerce.t3_f2'), t('ecommerce.t3_f3'), t('ecommerce.t3_f4'), t('ecommerce.t3_f5')].map(l => <li key={l}>{l}</li>)}
              </ul>
              <a href={h('#contact')} className="btn btn-ghost">{t('cp.discuss')}<span className="arrow">↗</span></a>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">05</span>{t('ecommerce.aud_tag').replace('06 ', '')}</div>
            <div><h2 className="sec-title">{t('ecommerce.aud_title')}</h2></div>
          </div>
          <div className="deliv">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="deliv-row">
                <div className="num">{`A/0${i}`}</div>
                <div><h4>{t(`ecommerce.aud${i}_title`)}</h4><p>{t(`ecommerce.aud${i}_desc`)}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">06</span>{t('ecommerce.faq_tag').replace('07 ', '')}</div>
            <div><h2 className="sec-title">{t('ecommerce.faq_title')}</h2></div>
          </div>
          <div className="faq">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="deliv-row">
                <div className="num">{`Q${i}`}</div>
                <div><h4>{t(`ecommerce.faq${i}_q`)}</h4><p>{t(`ecommerce.faq${i}_a`)}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <RelatedCases
        num="07"
        tag={t('cp.sec_cases')}
        heading={`${t('ecommerce.sec05_title_pre')} ${t('ecommerce.sec05_title_em')}`}
        allLabel={t('cp.all_works')}
        keywords={['ecommerce', 'e-commerce', 'marketplace', 'shop']}
      />

      <RelatedServices
        num="08"
        tag={t('ecommerce.rel_tag').replace('08 ', '')}
        heading={t('ecommerce.rel_title')}
        items={[
          { title: t('ecommerce.rel1_title'), desc: t('ecommerce.rel1_desc'), to: p('/services/performance') },
          { title: t('ecommerce.rel2_title'), desc: t('ecommerce.rel2_desc'), to: p('/services/analytics') },
          { title: t('ecommerce.rel3_title'), desc: t('ecommerce.rel3_desc'), to: p('/services/development/landings') },
        ]}
      />

      <section className="cta-strip" style={{ borderBottom: 0 }}>
        <div className="wrap">
          <div className="grid">
            <div>
              <h2>{t('ecommerce.cta_title_pre')} <em>{t('ecommerce.cta_title_em')}</em></h2>
              <p>{t('ecommerce.cta_sub')}</p>
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
