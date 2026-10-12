import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageSEO from '../../components/PageSEO'
import { useLangPath } from '../../hooks/useLangPath'

const ZONE_CODES = ['Z01', 'Z02', 'Z03', 'Z04']
const DELIV_CODES = ['EV/01', 'EV/02', 'EV/03', 'EV/04', 'EV/05', 'EV/06']
const PROCESS = [
  { n: '01', ha: 'p0_ha', he: 'p0_he', d: 'p0_d' },
  { n: '02', ha: 'p1_ha', he: 'p1_he', d: 'p1_d' },
  { n: '03', ha: 'p2_ha', he: 'p2_he', d: 'p2_d' },
  { n: '04', ha: 'p3_ha', he: 'p3_he', d: 'p3_d' },
]

export default function EnvironmentalPage() {
  const { t, i18n } = useTranslation()
  const { p, h } = useLangPath()
  const langKey = i18n.language?.startsWith('ru') ? 'ru' : i18n.language?.startsWith('tr') ? 'tr' : 'en'
  const priceFrom = langKey === 'ru' ? 'от' : langKey === 'tr' ? 'baslangic' : 'from'

  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('.reveal')
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in') }),
      { threshold: 0.06 }
    )
    els.forEach(el => observer.observe(el))
    window.scrollTo(0, 0)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <PageSEO
        title={t('environmental.seo_title')}
        description={t('environmental.seo_desc')}
        path={p('/services/design/environmental')}
        jsonLd={{ '@context': 'https://schema.org', '@type': 'Service', name: 'Environmental Design and Wayfinding', provider: { '@type': 'Organization', name: 'Lumiva Agency', url: 'https://lumiva.agency' }, areaServed: ['Turkey', 'Europe', 'CIS'], serviceType: 'Environmental Design' }}
      />
      <header className="page-hero">
        <div className="wrap">
          <div className="crumbs">
            <Link to={p('/')}>{t('crumbs.home')}</Link><span className="sep">/</span>
            <Link to={p('/services')}>{t('crumbs.services')}</Link><span className="sep">/</span>
            <Link to={p('/services/design')}>{t('crumbs.design')}</Link><span className="sep">/</span>
            <span>{t('environmental.crumb')}</span>
          </div>
          <div className="page-hero-grid">
            <div>
              <div className="page-eyebrow">D/07 · Environmental & wayfinding</div>
              <h1 className="page-title">{t('environmental.hero_title_pre')} <em>{t('environmental.hero_title_em')}</em></h1>
            </div>
            <div className="page-hero-side">
              <p>{t('environmental.hero_sub')}</p>
              <div className="page-hero-actions">
                <a href={h('#contact')} className="btn btn-primary">{t('cp.request_quote')}<span className="arrow">↗</span></a>
                <a href="#zones" className="btn btn-ghost">{t('environmental.sec01_label')}<span className="arrow">↗</span></a>
              </div>
              <div className="hero-side-stats">
                <div className="s"><div className="num">80<em>+</em></div><div className="lbl">{t('environmental.stat1_lbl')}</div></div>
                <div className="s"><div className="num">3D</div><div className="lbl">{t('environmental.stat2_lbl')}</div></div>
                <div className="s"><div className="num">RU<em>+EU</em></div><div className="lbl">{t('environmental.stat3_lbl')}</div></div>
                <div className="s"><div className="num">∞</div><div className="lbl">{t('environmental.stat4_lbl')}</div></div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section id="zones">
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">01</span>{t('environmental.sec01_label')}</div>
            <div>
              <h2 className="sec-title">{t('environmental.sec01_title_pre')} <em>{t('environmental.sec01_title_em')}</em></h2>
              <p className="sec-sub">{t('environmental.sec01_sub')}</p>
            </div>
            <a href={h('#contact')} className="show-all">{t('cp.request_quote')} <span className="arr">↗</span></a>
          </div>

          <div className="r1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 2, background: 'var(--line)' }}>
            {ZONE_CODES.map((code, i) => (
              <div key={i} className="reveal" style={{ background: i === 1 ? 'var(--ink)' : 'var(--paper)', color: i === 1 ? 'var(--paper)' : 'var(--ink)', padding: '52px 48px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 28 }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: i === 1 ? 'rgba(255,255,255,0.4)' : 'var(--muted)', letterSpacing: '0.1em' }}>{code}</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: i === 1 ? 'rgba(255,255,255,0.25)' : 'var(--paper-3)', letterSpacing: '0.08em' }}>
                    {String(i + 1).padStart(2, '0')}/04
                  </div>
                </div>
                <h3 style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: 28, letterSpacing: '-0.01em', margin: '0 0 28px' }}>{t(`environmental.zone${i}_name`)}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[0,1,2,3].map(j => (
                    <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 15, color: i === 1 ? 'rgba(255,255,255,0.65)' : '#444' }}>
                      <div style={{ width: 20, height: 1, background: i === 1 ? 'rgba(255,255,255,0.25)' : 'var(--line-2)', flexShrink: 0 }} />
                      {t(`environmental.zone${i}_item${j}`)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ borderTop: '1px solid var(--line)' }}>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">02</span>{t('environmental.sec02_label')}</div>
            <div>
              <h2 className="sec-title">{t('environmental.sec02_title_pre')} <em>{t('environmental.sec02_title_em')}</em></h2>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {DELIV_CODES.map((code, i) => (
              <div key={i} className="reveal" style={{
                display: 'grid', gridTemplateColumns: '80px 1fr',
                gap: '0 28px', padding: '32px 0', borderBottom: '1px solid var(--line)',
                alignItems: 'start',
              }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--muted)', letterSpacing: '0.1em', paddingTop: 4 }}>{code}</div>
                <div>
                  <h4 style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: 22, letterSpacing: '-0.01em', margin: '0 0 8px' }}>{t(`environmental.d${i}_title`)}</h4>
                  <p style={{ margin: 0, color: '#555', fontSize: 14.5, lineHeight: 1.6 }}>{t(`environmental.d${i}_desc`)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ background: 'var(--paper-2)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div className="wrap" style={{ padding: '80px var(--pad-x)' }}>
          <div className="sec-head" style={{ marginBottom: 48 }}>
            <div className="sec-tag"><span className="num">03</span>{t('environmental.sec03_label')}</div>
            <div><h2 className="sec-title">{t('environmental.sec03_title_pre')} <em>{t('environmental.sec03_title_em')}</em></h2></div>
          </div>
          <div className="pmini">
            {PROCESS.map((r, i) => (
              <div key={i} className="pmini-row reveal">
                <div className="pmini-num">{r.n}</div>
                <div className="pmini-h">{t(`environmental.${r.ha}`)}<em>{t(`environmental.${r.he}`)}</em></div>
                <div className="pmini-d">{t(`environmental.${r.d}`)}</div>
                <div className="pmini-arr">↗</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">04</span>{t('environmental.sec04_label')}</div>
            <div>
              <h2 className="sec-title">{t('environmental.sec04_title_pre')} <em>{t('environmental.sec04_title_em')}</em></h2>
              <p className="sec-sub">{t('environmental.sec04_sub')}</p>
            </div>
          </div>
          <div className="pricing">
            <div className="tier reveal">
              <div className="tier-badge">{t('environmental.t1_badge')}</div>
              <div className="tier-name">{t('environmental.t1_name')}</div>
              <div className="tier-sub">{t('environmental.t1_sub')}</div>
              <div className="tier-price">{priceFrom} 3 000<em>€</em></div>
              <ul className="tier-incl">
                {['t1_f1','t1_f2','t1_f3','t1_f4','t1_f5'].map(k => <li key={k}>{t(`environmental.${k}`)}</li>)}
              </ul>
              <a href={h('#contact')} className="btn btn-ghost">{t('cp.discuss')}<span className="arrow">↗</span></a>
            </div>
            <div className="tier featured reveal">
              <div className="tier-badge">{t('environmental.t2_badge')}</div>
              <div className="tier-name">{t('environmental.t2_name')}</div>
              <div className="tier-sub">{t('environmental.t2_sub')}</div>
              <div className="tier-price">{priceFrom} 10 000<em>€</em></div>
              <ul className="tier-incl">
                {['t2_f1','t2_f2','t2_f3','t2_f4','t2_f5'].map(k => <li key={k}>{t(`environmental.${k}`)}</li>)}
              </ul>
              <a href={h('#contact')} className="btn">{t('cp.request_quote')}<span className="arrow">↗</span></a>
            </div>
            <div className="tier reveal">
              <div className="tier-badge">{t('environmental.t3_badge')}</div>
              <div className="tier-name">{t('environmental.t3_name')}</div>
              <div className="tier-sub">{t('environmental.t3_sub')}</div>
              <div className="tier-price">{priceFrom} 6 000<em>€</em></div>
              <ul className="tier-incl">
                {['t3_f1','t3_f2','t3_f3','t3_f4','t3_f5'].map(k => <li key={k}>{t(`environmental.${k}`)}</li>)}
              </ul>
              <a href={h('#contact')} className="btn btn-ghost">{t('cp.discuss')}<span className="arrow">↗</span></a>
            </div>
          </div>
        </div>
      </section>

      <section className="cta-strip" style={{ borderBottom: 0 }}>
        <div className="wrap">
          <div className="grid">
            <div>
              <h2>{t('environmental.cta_title_pre')} <em>{t('environmental.cta_title_em')}</em></h2>
              <p>{t('environmental.cta_sub')}</p>
              <div className="cta-actions">
                <a href={h('#contact')} className="btn btn-primary">{t('cp.request_quote')}<span className="arrow">↗</span></a>
                <a href={`mailto:${t('common.email')}`} className="btn btn-ghost">vlad@lumiva.agency<span className="arrow">↗</span></a>
              </div>
            </div>
            <div className="cta-side">
              <div className="row"><div className="lbl">{t('cp.slots_q3')}</div><div className="val">{t('cp.slots_val')}</div></div>
              <div className="row"><div className="lbl">{t('cp.start')}</div><div className="val">{t('cp.start_val')}</div></div>
              <div className="row" style={{ borderBottom: 0 }}><div className="lbl">{t('cp.nda')}</div><div className="val">{t('cp.nda_val')}</div></div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
