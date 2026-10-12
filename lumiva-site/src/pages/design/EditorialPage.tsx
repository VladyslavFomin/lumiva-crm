import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageSEO from '../../components/PageSEO'
import { useLangPath } from '../../hooks/useLangPath'

const FORMAT_CODES = ['ED/01', 'ED/02', 'ED/03', 'ED/04', 'ED/05', 'ED/06']
const PROCESS = [
  { n: '01', ha: 'p0_ha', he: 'p0_he', d: 'p0_d' },
  { n: '02', ha: 'p1_ha', he: 'p1_he', d: 'p1_d' },
  { n: '03', ha: 'p2_ha', he: 'p2_he', d: 'p2_d' },
  { n: '04', ha: 'p3_ha', he: 'p3_he', d: 'p3_d' },
]

export default function EditorialPage() {
  const { t, i18n } = useTranslation()
  const { p, h } = useLangPath()
  const langKey = i18n.language?.startsWith('ru') ? 'ru' : i18n.language?.startsWith('tr') ? 'tr' : 'en'
  const priceFrom = langKey === 'ru' ? 'от' : langKey === 'tr' ? 'baslangic' : 'from'
  const monthShort = langKey === 'ru' ? 'мес' : langKey === 'tr' ? 'ay' : 'mo'

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
        title={t('editorial.seo_title')}
        description={t('editorial.seo_desc')}
        path={p('/services/design/editorial')}
        jsonLd={{ '@context': 'https://schema.org', '@type': 'Service', name: 'Editorial Design', provider: { '@type': 'Organization', name: 'Lumiva Agency', url: 'https://lumiva.agency' }, areaServed: ['Turkey', 'Europe', 'CIS'], serviceType: 'Editorial Design' }}
      />
      <header className="page-hero">
        <div className="wrap">
          <div className="crumbs">
            <Link to={p('/')}>{t('crumbs.home')}</Link><span className="sep">/</span>
            <Link to={p('/services')}>{t('crumbs.services')}</Link><span className="sep">/</span>
            <Link to={p('/services/design')}>{t('crumbs.design')}</Link><span className="sep">/</span>
            <span>{t('editorial.crumb')}</span>
          </div>
          <div className="page-hero-grid">
            <div>
              <div className="page-eyebrow">D/06 · Editorial design</div>
              <h1 className="page-title">{t('editorial.hero_title_pre')} <em>{t('editorial.hero_title_em')}</em></h1>
            </div>
            <div className="page-hero-side">
              <p>{t('editorial.hero_sub')}</p>
              <div className="page-hero-actions">
                <a href={h('#contact')} className="btn btn-primary">{t('cp.request_quote')}<span className="arrow">↗</span></a>
                <a href="#formats" className="btn btn-ghost">{t('editorial.sec01_label')}<span className="arrow">↗</span></a>
              </div>
              <div className="hero-side-stats">
                <div className="s"><div className="num">150<em>+</em></div><div className="lbl">{t('editorial.stat1_lbl')}</div></div>
                <div className="s"><div className="num">500<em>+</em></div><div className="lbl">{t('editorial.stat2_lbl')}</div></div>
                <div className="s"><div className="num">PDF<em>+</em></div><div className="lbl">{t('editorial.stat3_lbl')}</div></div>
                <div className="s"><div className="num">B2B<em>+</em></div><div className="lbl">{t('editorial.stat4_lbl')}</div></div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section style={{ background: 'var(--ink)', color: 'var(--paper)', overflow: 'hidden' }}>
        <div style={{ padding: 'clamp(60px, 8vw, 120px) var(--pad-x)', maxWidth: 'var(--maxw)', margin: '0 auto' }}>
          <div className="r1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'clamp(32px, 6vw, 96px)', alignItems: 'end' }}>
            <div>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', marginBottom: 32 }}>
                {t('editorial.typo_label')}
              </p>
              <div style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 'clamp(64px, 9vw, 130px)', lineHeight: 0.9, letterSpacing: '-0.03em', color: 'var(--paper)' }}>
                Aa
              </div>
              <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[0,1,2,3].map(i => (
                  <div key={i} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: `rgba(255,255,255,${0.7 - i * 0.12})` }}>{t(`editorial.typo_scale${i}`)}</div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 24 }}>
                <p style={{ fontFamily: "'Instrument Serif', serif", fontSize: 24, lineHeight: 1.4, color: 'rgba(255,255,255,0.85)', margin: '0 0 12px', letterSpacing: '-0.01em' }}>
                  {t('editorial.typo_quote')}
                </p>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', margin: 0, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.05em' }}>{t('editorial.typo_attr')}</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                {[0,1,2,3].map(i => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: '16px 20px' }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: "'JetBrains Mono', monospace", marginBottom: 6 }}>{t(`editorial.grid${i}_k`)}</div>
                    <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.75)' }}>{t(`editorial.grid${i}_v`)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="formats">
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">01</span>{t('editorial.sec01_label')}</div>
            <div>
              <h2 className="sec-title">{t('editorial.sec01_title_pre')} <em>{t('editorial.sec01_title_em')}</em></h2>
              <p className="sec-sub">{t('editorial.sec01_sub')}</p>
            </div>
            <a href={h('#contact')} className="show-all">{t('cp.request_quote')} <span className="arr">↗</span></a>
          </div>

          <div className="r1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 0, borderTop: '1px solid var(--line)', borderLeft: '1px solid var(--line)' }}>
            {FORMAT_CODES.map((code, i) => (
              <div key={i} className="reveal" style={{
                borderRight: '1px solid var(--line)',
                borderBottom: '1px solid var(--line)',
                padding: '40px 44px',
                display: 'grid', gridTemplateColumns: '1fr', gap: 12,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--muted)', letterSpacing: '0.1em', marginBottom: 8 }}>{code}</div>
                    <h3 style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: 24, letterSpacing: '-0.01em', margin: 0 }}>{t(`editorial.f${i}_title`)}</h3>
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--muted)', letterSpacing: '0.06em', textAlign: 'right', marginTop: 6 }}>{t(`editorial.f${i}_sub`)}</div>
                </div>
                <p style={{ margin: 0, color: '#555', fontSize: 14.5, lineHeight: 1.6 }}>{t(`editorial.f${i}_desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ background: 'var(--paper-2)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div className="wrap" style={{ padding: '80px var(--pad-x)' }}>
          <div className="sec-head" style={{ marginBottom: 56 }}>
            <div className="sec-tag"><span className="num">02</span>{t('editorial.sec02_label')}</div>
            <div><h2 className="sec-title">{t('editorial.sec02_title_pre')} <em>{t('editorial.sec02_title_em')}</em></h2></div>
          </div>
          <div className="pmini">
            {PROCESS.map((r, i) => (
              <div key={i} className="pmini-row reveal">
                <div className="pmini-num">{r.n}</div>
                <div className="pmini-h">{t(`editorial.${r.ha}`)}<em>{t(`editorial.${r.he}`)}</em></div>
                <div className="pmini-d">{t(`editorial.${r.d}`)}</div>
                <div className="pmini-arr">↗</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">03</span>{t('editorial.sec03_label')}</div>
            <div>
              <h2 className="sec-title">{t('editorial.sec03_title_pre')} <em>{t('editorial.sec03_title_em')}</em></h2>
              <p className="sec-sub">{t('editorial.sec03_sub')}</p>
            </div>
          </div>
          <div className="pricing">
            <div className="tier reveal">
              <div className="tier-badge">{t('editorial.t1_badge')}</div>
              <div className="tier-name">{t('editorial.t1_name')}</div>
              <div className="tier-sub">{t('editorial.t1_sub')}</div>
              <div className="tier-price">{priceFrom} 1 200<em>€</em></div>
              <ul className="tier-incl">
                {['t1_f1','t1_f2','t1_f3','t1_f4'].map(k => <li key={k}>{t(`editorial.${k}`)}</li>)}
              </ul>
              <a href={h('#contact')} className="btn btn-ghost">{t('cp.discuss')}<span className="arrow">↗</span></a>
            </div>
            <div className="tier featured reveal">
              <div className="tier-badge">{t('editorial.t2_badge')}</div>
              <div className="tier-name">{t('editorial.t2_name')}</div>
              <div className="tier-sub">{t('editorial.t2_sub')}</div>
              <div className="tier-price">{priceFrom} 5 000<em>€</em></div>
              <ul className="tier-incl">
                {['t2_f1','t2_f2','t2_f3','t2_f4','t2_f5'].map(k => <li key={k}>{t(`editorial.${k}`)}</li>)}
              </ul>
              <a href={h('#contact')} className="btn">{t('cp.request_quote')}<span className="arrow">↗</span></a>
            </div>
            <div className="tier reveal">
              <div className="tier-badge">{t('editorial.t3_badge')}</div>
              <div className="tier-name">{t('editorial.t3_name')}</div>
              <div className="tier-sub">{t('editorial.t3_sub')}</div>
              <div className="tier-price">{priceFrom} 2 000<em>€/{monthShort}</em></div>
              <ul className="tier-incl">
                {['t3_f1','t3_f2','t3_f3','t3_f4','t3_f5'].map(k => <li key={k}>{t(`editorial.${k}`)}</li>)}
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
              <h2>{t('editorial.cta_title_pre')} <em>{t('editorial.cta_title_em')}</em></h2>
              <p>{t('editorial.cta_sub')}</p>
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
