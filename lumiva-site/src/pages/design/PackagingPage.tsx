import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageSEO from '../../components/PageSEO'
import { useLangPath } from '../../hooks/useLangPath'

const MAT_CODES = ['G300', 'D250', 'K350', 'KR200', 'PL', 'SP']
const DELIV_CODES = ['PK/01', 'PK/02', 'PK/03', 'PK/04', 'PK/05', 'PK/06']

export default function PackagingPage() {
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
        title={t('packaging.seo_title')}
        description={t('packaging.seo_desc')}
        path={p('/services/design/packaging')}
        jsonLd={{ '@context': 'https://schema.org', '@type': 'Service', name: 'Packaging Design', provider: { '@type': 'Organization', name: 'Lumiva Agency', url: 'https://lumiva.agency' }, areaServed: ['Turkey', 'Europe', 'CIS'], serviceType: 'Packaging Design' }}
      />
      <header className="page-hero">
        <div className="wrap">
          <div className="crumbs">
            <Link to={p('/')}>{t('crumbs.home')}</Link><span className="sep">/</span>
            <Link to={p('/services')}>{t('crumbs.services')}</Link><span className="sep">/</span>
            <Link to={p('/services/design')}>{t('crumbs.design')}</Link><span className="sep">/</span>
            <span>{t('packaging.crumb')}</span>
          </div>
          <div className="page-hero-grid">
            <div>
              <div className="page-eyebrow">D/03 · Packaging & print</div>
              <h1 className="page-title">{t('packaging.hero_title_pre')} <em>{t('packaging.hero_title_em')}</em></h1>
            </div>
            <div className="page-hero-side">
              <p>{t('packaging.hero_sub')}</p>
              <div className="page-hero-actions">
                <a href={h('#contact')} className="btn btn-primary">{t('cp.request_quote')}<span className="arrow">↗</span></a>
                <a href="#materials" className="btn btn-ghost">{t('packaging.sec02_label')}<span className="arrow">↗</span></a>
              </div>
              <div className="hero-side-stats">
                <div className="s"><div className="num">200<em>+</em></div><div className="lbl">{t('packaging.stat1_lbl')}</div></div>
                <div className="s"><div className="num">3D</div><div className="lbl">{t('packaging.stat2_lbl')}</div></div>
                <div className="s"><div className="num">12<em>+</em></div><div className="lbl">{t('packaging.stat3_lbl')}</div></div>
                <div className="s"><div className="num">EU<em>+</em></div><div className="lbl">{t('packaging.stat4_lbl')}</div></div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">01</span>{t('packaging.sec01_label')}</div>
            <div>
              <h2 className="sec-title">{t('packaging.sec01_title_pre')} <em>{t('packaging.sec01_title_em')}</em></h2>
              <p className="sec-sub">{t('packaging.sec01_sub')}</p>
            </div>
            <a href={h('#contact')} className="show-all">{t('cp.request_quote')} <span className="arr">↗</span></a>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--line)' }}>
            {DELIV_CODES.map((code, i) => (
              <div key={i} className="reveal sub-pkg-row" style={{
                padding: '40px 0',
                borderBottom: '1px solid var(--line)',
              }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--muted)', paddingTop: 4 }}>{code}</div>
                <div>
                  <h3 style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: 26, letterSpacing: '-0.01em', margin: '0 0 10px' }}>{t(`packaging.d${i}_title`)}</h3>
                  <p style={{ margin: 0, color: '#555', fontSize: 15, lineHeight: 1.6 }}>{t(`packaging.d${i}_desc`)}</p>
                </div>
                <div className="sub-pkg-tags" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end', paddingTop: 4 }}>
                  {[0,1,2,3].map(j => (
                    <span key={j} style={{ padding: '5px 12px', fontSize: 11, border: '1px solid var(--line-2)', borderRadius: 100, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{t(`packaging.d${i}_tag${j}`)}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="materials" style={{ background: 'var(--paper-2)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div className="wrap" style={{ padding: '80px var(--pad-x)' }}>
          <div className="sec-head" style={{ marginBottom: 48 }}>
            <div className="sec-tag"><span className="num">02</span>{t('packaging.sec02_label')}</div>
            <div>
              <h2 className="sec-title">{t('packaging.sec02_title_pre')} <em>{t('packaging.sec02_title_em')}</em></h2>
              <p className="sec-sub">{t('packaging.sec02_sub')}</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 0, borderTop: '1px solid var(--line)', borderLeft: '1px solid var(--line)' }}>
            {MAT_CODES.map((code, i) => (
              <div key={i} className="reveal" style={{ borderRight: '1px solid var(--line)', borderBottom: '1px solid var(--line)', padding: '28px 32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: 18 }}>{t(`packaging.mat${i}_name`)}</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--muted)', alignSelf: 'center' }}>{code}</div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>{t('packaging.mat_finish_label')} {t(`packaging.mat${i}_finish`)}</div>
                <div style={{ fontSize: 13, color: '#555' }}>{t(`packaging.mat${i}_usage`)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">03</span>{t('packaging.sec03_label')}</div>
            <div>
              <h2 className="sec-title">{t('packaging.sec03_title_pre')} <em>{t('packaging.sec03_title_em')}</em></h2>
              <p className="sec-sub">{t('packaging.sec03_sub')}</p>
            </div>
          </div>
          <div className="pricing">
            <div className="tier reveal">
              <div className="tier-badge">{t('packaging.t1_badge')}</div>
              <div className="tier-name">{t('packaging.t1_name')}</div>
              <div className="tier-sub">{t('packaging.t1_sub')}</div>
              <div className="tier-price">{priceFrom} 900<em>€</em></div>
              <ul className="tier-incl">
                {['t1_f1','t1_f2','t1_f3','t1_f4','t1_f5'].map(k => <li key={k}>{t(`packaging.${k}`)}</li>)}
              </ul>
              <a href={h('#contact')} className="btn btn-ghost">{t('cp.discuss')}<span className="arrow">↗</span></a>
            </div>
            <div className="tier featured reveal">
              <div className="tier-badge">{t('packaging.t2_badge')}</div>
              <div className="tier-name">{t('packaging.t2_name')}</div>
              <div className="tier-sub">{t('packaging.t2_sub')}</div>
              <div className="tier-price">{priceFrom} 5 500<em>€</em></div>
              <ul className="tier-incl">
                {['t2_f1','t2_f2','t2_f3','t2_f4','t2_f5','t2_f6'].map(k => <li key={k}>{t(`packaging.${k}`)}</li>)}
              </ul>
              <a href={h('#contact')} className="btn">{t('cp.request_quote')}<span className="arrow">↗</span></a>
            </div>
            <div className="tier reveal">
              <div className="tier-badge">{t('packaging.t3_badge')}</div>
              <div className="tier-name">{t('packaging.t3_name')}</div>
              <div className="tier-sub">{t('packaging.t3_sub')}</div>
              <div className="tier-price">{priceFrom} 2 500<em>€</em></div>
              <ul className="tier-incl">
                {['t3_f1','t3_f2','t3_f3','t3_f4','t3_f5'].map(k => <li key={k}>{t(`packaging.${k}`)}</li>)}
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
              <h2>{t('packaging.cta_title_pre')} <em>{t('packaging.cta_title_em')}</em></h2>
              <p>{t('packaging.cta_sub')}</p>
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
