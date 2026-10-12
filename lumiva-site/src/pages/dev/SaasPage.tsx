import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageSEO from '../../components/PageSEO'
import { useLangPath } from '../../hooks/useLangPath'

export default function SaasPage() {
  const { t, i18n } = useTranslation()
  const { p, h } = useLangPath()
  const langKey = i18n.language?.startsWith('ru') ? 'ru' : i18n.language?.startsWith('tr') ? 'tr' : 'en'
  const stat2Unit = langKey === 'ru' ? 'нед' : langKey === 'tr' ? 'hf' : 'w'
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
      Frontend: ['Next.js', 'React', 'TypeScript', 'Tailwind', 'Radix UI', 'Recharts', 'TanStack Query'],
      'Backend & Auth': ['Node.js', 'Python · FastAPI', 'Go', 'PostgreSQL', 'Redis', 'Prisma', 'JWT / OAuth2', 'Keycloak'],
      'Billing & Payments': ['Stripe', 'Paddle', 'LemonSqueezy', 'RevenueCat', 'Webhook infrastructure'],
      'Infra & Observability': ['Docker', 'Kubernetes', 'AWS / GCP', 'Sentry', 'OpenTelemetry', 'Grafana', 'PagerDuty'],
    },
    ru: {
      Frontend: ['Next.js', 'React', 'TypeScript', 'Tailwind', 'Radix UI', 'Recharts', 'TanStack Query'],
      'Backend и Auth': ['Node.js', 'Python · FastAPI', 'Go', 'PostgreSQL', 'Redis', 'Prisma', 'JWT / OAuth2', 'Keycloak'],
      'Billing и платежи': ['Stripe', 'Paddle', 'LemonSqueezy', 'RevenueCat', 'Webhook-инфраструктура'],
      'Infra и observability': ['Docker', 'Kubernetes', 'AWS / GCP', 'Sentry', 'OpenTelemetry', 'Grafana', 'PagerDuty'],
    },
    tr: {
      Frontend: ['Next.js', 'React', 'TypeScript', 'Tailwind', 'Radix UI', 'Recharts', 'TanStack Query'],
      'Backend ve Auth': ['Node.js', 'Python · FastAPI', 'Go', 'PostgreSQL', 'Redis', 'Prisma', 'JWT / OAuth2', 'Keycloak'],
      'Billing ve Odeme': ['Stripe', 'Paddle', 'LemonSqueezy', 'RevenueCat', 'Webhook altyapisi'],
      'Infra ve Gozlemlenebilirlik': ['Docker', 'Kubernetes', 'AWS / GCP', 'Sentry', 'OpenTelemetry', 'Grafana', 'PagerDuty'],
    },
  }
  const stacks = stacksByLang[langKey]

  const delivs = [
    { n: 'SS/01', ta: t('saas.d0_ta'), te: t('saas.d0_te'), desc: t('saas.d0_desc') },
    { n: 'SS/02', ta: t('saas.d1_ta'), te: t('saas.d1_te'), desc: t('saas.d1_desc') },
    { n: 'SS/03', ta: t('saas.d2_ta'), te: t('saas.d2_te'), desc: t('saas.d2_desc') },
    { n: 'SS/04', ta: t('saas.d3_ta'), te: t('saas.d3_te'), desc: t('saas.d3_desc') },
    { n: 'SS/05', ta: t('saas.d4_ta'), te: t('saas.d4_te'), desc: t('saas.d4_desc') },
    { n: 'SS/06', ta: t('saas.d5_ta'), te: t('saas.d5_te'), desc: t('saas.d5_desc') },
    { n: 'SS/07', ta: t('saas.d6_ta'), te: t('saas.d6_te'), desc: t('saas.d6_desc') },
    { n: 'SS/08', ta: t('saas.d7_ta'), te: t('saas.d7_te'), desc: t('saas.d7_desc') },
  ]

  const process = [
    { n: '01', ha: t('saas.p0_ha'), he: t('saas.p0_he'), d: t('saas.p0_d') },
    { n: '02', ha: t('saas.p1_ha'), he: t('saas.p1_he'), d: t('saas.p1_d') },
    { n: '03', ha: t('saas.p2_ha'), he: t('saas.p2_he'), d: t('saas.p2_d') },
    { n: '04', ha: t('saas.p3_ha'), he: t('saas.p3_he'), d: t('saas.p3_d') },
  ]

  const cases = [
    { bg: '#e9e6dc', label: 'Foster', labelColor: '#222', result: '×2.8', cat: t('saas.c0_cat'), name: t('saas.c0_name'), rsub: t('saas.c0_rsub') },
    { bg: '#1a1a1a', label: 'Volta', labelColor: '#fff', result: '−60%', cat: t('saas.c1_cat'), name: t('saas.c1_name'), rsub: t('saas.c1_rsub') },
    { bg: '#f5f3ee', label: 'Prism', labelColor: '#222', result: '+120%', cat: t('saas.c2_cat'), name: t('saas.c2_name'), rsub: t('saas.c2_rsub') },
  ]

  return (
    <>
      <PageSEO
        title={t('saas.seo_title')}
        description={t('saas.seo_desc')}
        path={p('/services/development/saas')}
        jsonLd={{ '@context': 'https://schema.org', '@type': 'Service', name: 'SaaS Product Development', provider: { '@type': 'Organization', name: 'Lumiva Agency', url: 'https://lumiva.agency' }, areaServed: ['Turkey', 'Europe', 'CIS'], serviceType: 'SaaS Development' }}
      />
      <header className="page-hero">
        <div className="wrap">
          <div className="crumbs">
            <Link to={p('/')}>{t('crumbs.home')}</Link><span className="sep">/</span>
            <Link to={p('/services')}>{t('crumbs.services')}</Link><span className="sep">/</span>
            <Link to={p('/services/development')}>{t('crumbs.development')}</Link><span className="sep">/</span>
            <span>{t('saas.crumb')}</span>
          </div>
          <div className="page-hero-grid">
            <div>
              <div className="page-eyebrow">D/03 · SaaS & web applications</div>
              <h1 className="page-title">{t('saas.hero_title_pre')} <em>{t('saas.hero_title_em')}</em></h1>
            </div>
            <div className="page-hero-side">
              <p>{t('saas.hero_sub')}</p>
              <div className="page-hero-actions">
                <a href={h('#contact')} className="btn btn-primary">{t('corporate_sites.cta_btn')}<span className="arrow">↗</span></a>
                <a href="#cases" className="btn btn-ghost">{t('cp.cases_link')}<span className="arrow">↗</span></a>
              </div>
              <div className="hero-side-stats">
                <div className="s"><div className="num">15<em>+</em></div><div className="lbl">{t('saas.stat1_lbl')}</div></div>
                <div className="s"><div className="num">6<em>{stat2Unit}</em></div><div className="lbl">{t('saas.stat2_lbl')}</div></div>
                <div className="s"><div className="num">99.95<em>%</em></div><div className="lbl">{t('saas.stat3_lbl')}</div></div>
                <div className="s"><div className="num">×4.1<em></em></div><div className="lbl">{t('saas.stat4_lbl')}</div></div>
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
              <h2 className="sec-title">{t('saas.sec01_title_pre')} <em>{t('saas.sec01_title_em')}</em></h2>
              <p className="sec-sub">{t('saas.sec01_sub')}</p>
            </div>
            <a href={h('#contact')} className="show-all">{t('corporate_sites.cta_btn')} <span className="arr">↗</span></a>
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
              <h2 className="sec-title">{t('saas.sec02_title_pre')} <em>{t('saas.sec02_title_em')}</em></h2>
              <p className="sec-sub">{t('saas.sec02_sub')}</p>
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
              <h2 className="sec-title">{t('saas.sec03_title_pre')} <em>{t('saas.sec03_title_em')}</em></h2>
              <p className="sec-sub">{t('saas.sec03_sub')}</p>
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
              <h2 className="sec-title">{t('saas.sec04_title_pre')} <em>{t('saas.sec04_title_em')}</em></h2>
              <p className="sec-sub">{t('saas.sec04_sub')}</p>
            </div>
          </div>
          <div className="pricing">
            <div className="tier">
              <div className="tier-badge">{t('saas.t1_badge')}</div>
              <div className="tier-name">{t('saas.t1_name')}</div>
              <div className="tier-sub">{t('saas.t1_sub')}</div>
              <div className="tier-price">{priceFrom} 8 000<em>€</em></div>
              <ul className="tier-incl">
                {[t('saas.t1_f1'), t('saas.t1_f2'), t('saas.t1_f3'), t('saas.t1_f4'), t('saas.t1_f5'), t('saas.t1_f6')].map(l => <li key={l}>{l}</li>)}
              </ul>
              <a href={h('#contact')} className="btn btn-ghost">{t('corporate_sites.tier_discuss')}<span className="arrow">↗</span></a>
            </div>
            <div className="tier featured">
              <div className="tier-badge">{t('saas.t2_badge')}</div>
              <div className="tier-name">{t('saas.t2_name')}</div>
              <div className="tier-sub">{t('saas.t2_sub')}</div>
              <div className="tier-price">{priceFrom} 25 000<em>€</em></div>
              <ul className="tier-incl">
                {[t('saas.t2_f1'), t('saas.t2_f2'), t('saas.t2_f3'), t('saas.t2_f4'), t('saas.t2_f5'), t('saas.t2_f6'), t('saas.t2_f7')].map(l => <li key={l}>{l}</li>)}
              </ul>
              <a href={h('#contact')} className="btn">{t('corporate_sites.cta_btn')}<span className="arrow">↗</span></a>
            </div>
            <div className="tier">
              <div className="tier-badge">{t('saas.t3_badge')}</div>
              <div className="tier-name">{t('saas.t3_name')}</div>
              <div className="tier-sub">{t('saas.t3_sub')}</div>
              <div className="tier-price">{priceFrom} 5 000<em>€/{monthShort}</em></div>
              <ul className="tier-incl">
                {[t('saas.t3_f1'), t('saas.t3_f2'), t('saas.t3_f3'), t('saas.t3_f4'), t('saas.t3_f5')].map(l => <li key={l}>{l}</li>)}
              </ul>
              <a href={h('#contact')} className="btn btn-ghost">{t('corporate_sites.tier_discuss')}<span className="arrow">↗</span></a>
            </div>
          </div>
        </div>
      </section>

      <section id="cases">
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">05</span>{t('cp.sec_cases')}</div>
            <div><h2 className="sec-title">{t('saas.sec05_title_pre')} <em>{t('saas.sec05_title_em')}</em></h2></div>
            <a href={h('#cases')} className="show-all">{t('cp.all_works')} <span className="arr">↗</span></a>
          </div>
          <div className="cases-mini">
            {cases.map((c, i) => (
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
                  <div className="cm-result">{c.result}<em> {c.rsub}</em></div>
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
              <h2>{t('saas.cta_title_pre')} <em>{t('saas.cta_title_em')}</em></h2>
              <p>{t('saas.cta_sub')}</p>
              <div className="cta-actions">
                <a href={h('#contact')} className="btn btn-primary">{t('corporate_sites.cta_btn')}<span className="arrow">↗</span></a>
                <a href={`mailto:${t('common.email')}`} className="btn btn-ghost">vlad@lumiva.agency<span className="arrow">↗</span></a>
              </div>
            </div>
            <div className="cta-side">
              <div className="row"><div className="lbl">{t('saas.slots_lbl')}</div><div className="val">{t('saas.slots_val')}</div></div>
              <div className="row"><div className="lbl">{t('saas.start_lbl')}</div><div className="val">{t('saas.start_val')}</div></div>
              <div className="row" style={{ borderBottom: 0 }}><div className="lbl">{t('saas.resp_lbl')}</div><div className="val">{t('saas.resp_val')}</div></div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
