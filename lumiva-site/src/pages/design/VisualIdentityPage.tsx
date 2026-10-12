import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageSEO from '../../components/PageSEO'
import { useLangPath } from '../../hooks/useLangPath'

const ELEMENT_CODES = ['VI/01','VI/02','VI/03','VI/04','VI/05','VI/06','VI/07','VI/08']

export default function VisualIdentityPage() {
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

  const process = [
    { n: '01', w: 'p0_w', h: 'p0_h', d: 'p0_d' },
    { n: '02', w: 'p1_w', h: 'p1_h', d: 'p1_d' },
    { n: '03', w: 'p2_w', h: 'p2_h', d: 'p2_d' },
    { n: '04', w: 'p3_w', h: 'p3_h', d: 'p3_d' },
  ]

  return (
    <>
      <PageSEO
        title={t('visual_identity.seo_title')}
        description={t('visual_identity.seo_desc')}
        path={p('/services/design/visual-identity')}
        jsonLd={{ '@context': 'https://schema.org', '@type': 'Service', name: 'Visual Identity Design', provider: { '@type': 'Organization', name: 'Lumiva Agency', url: 'https://lumiva.agency' }, areaServed: ['Turkey', 'Europe', 'CIS'], serviceType: 'Visual Identity' }}
      />
      <header className="page-hero">
        <div className="wrap">
          <div className="crumbs">
            <Link to={p('/')}>{t('crumbs.home')}</Link><span className="sep">/</span>
            <Link to={p('/services')}>{t('crumbs.services')}</Link><span className="sep">/</span>
            <Link to={p('/services/design')}>{t('crumbs.design')}</Link><span className="sep">/</span>
            <span>{t('visual_identity.crumb')}</span>
          </div>
          <div className="page-hero-grid">
            <div>
              <div className="page-eyebrow">D/VI · Visual identity</div>
              <h1 className="page-title">{t('visual_identity.hero_title_pre')} <em>{t('visual_identity.hero_title_em')}</em></h1>
            </div>
            <div className="page-hero-side">
              <p>{t('visual_identity.hero_sub')}</p>
              <div className="page-hero-actions">
                <a href={h('#contact')} className="btn btn-primary">{t('cp.request_quote')}<span className="arrow">↗</span></a>
                <a href="#elements" className="btn btn-ghost">{t('visual_identity.sec01_label')}<span className="arrow">↗</span></a>
              </div>
              <div className="hero-side-stats">
                <div className="s"><div className="num">8</div><div className="lbl">{t('visual_identity.stat1_lbl')}</div></div>
                <div className="s"><div className="num">100<em>+</em></div><div className="lbl">{t('visual_identity.stat2_lbl')}</div></div>
                <div className="s"><div className="num">6<em>{t('visual_identity.stat3_unit')}</em></div><div className="lbl">{t('visual_identity.stat3_lbl')}</div></div>
                <div className="s"><div className="num">∞</div><div className="lbl">{t('visual_identity.stat4_lbl')}</div></div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div style={{ height: 8, display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)' }}>
        {['#222222', '#ff4d14', '#e9e6dc', '#6b6b6b', '#f5f3ee', '#0f0f0f'].map(c => (
          <div key={c} style={{ background: c }} />
        ))}
      </div>

      <section style={{ background: 'var(--paper-2)', borderBottom: '1px solid var(--line)' }}>
        <div className="wrap" style={{ padding: '80px var(--pad-x)' }}>
          <blockquote style={{
            margin: 0,
            fontFamily: "'Instrument Serif', serif",
            fontStyle: 'italic',
            fontSize: 'clamp(28px, 4vw, 54px)',
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
            color: 'var(--ink)',
            maxWidth: '18em',
          }}>
            {t('visual_identity.quote')}
          </blockquote>
          <div style={{ marginTop: 24, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--muted)', letterSpacing: '0.08em' }}>
            {t('visual_identity.quote_attr')}
          </div>
        </div>
      </section>

      <section id="elements">
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">01</span>{t('visual_identity.sec01_label')}</div>
            <div>
              <h2 className="sec-title">{t('visual_identity.sec01_title_pre')} <em>{t('visual_identity.sec01_title_em')}</em></h2>
              <p className="sec-sub">{t('visual_identity.sec01_sub')}</p>
            </div>
            <a href={h('#contact')} className="show-all">{t('cp.request_quote')} <span className="arr">↗</span></a>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 0, borderTop: '1px solid var(--line)', borderLeft: '1px solid var(--line)' }}>
            {ELEMENT_CODES.map((code, i) => (
              <div key={i} className="reveal" style={{
                borderRight: '1px solid var(--line)',
                borderBottom: '1px solid var(--line)',
                padding: '32px 28px',
                display: 'flex', flexDirection: 'column', gap: 14,
                transition: 'background 0.3s var(--ease)',
                cursor: 'default',
              }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--ink)'}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                onMouseOver={e => {
                  const el = e.currentTarget as HTMLDivElement
                  el.querySelectorAll('*').forEach(child => (child as HTMLElement).style.color = 'var(--paper)')
                }}
                onMouseOut={e => {
                  const el = e.currentTarget as HTMLDivElement
                  el.querySelectorAll('*').forEach(child => (child as HTMLElement).style.color = '')
                }}
              >
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--muted)', letterSpacing: '0.1em' }}>{code}</div>
                <div style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: 20, letterSpacing: '-0.01em', lineHeight: 1.2 }}>{t(`visual_identity.el${i}_name`)}</div>
                <div style={{ fontSize: 13.5, color: '#555', lineHeight: 1.55 }}>{t(`visual_identity.el${i}_desc`)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ background: 'var(--paper-2)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div className="wrap" style={{ padding: '80px var(--pad-x)' }}>
          <div className="sec-head" style={{ marginBottom: 56 }}>
            <div className="sec-tag"><span className="num">02</span>{t('visual_identity.sec02_label')}</div>
            <div><h2 className="sec-title">{t('visual_identity.sec02_title_pre')} <em>{t('visual_identity.sec02_title_em')}</em></h2></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 0, position: 'relative' }}>
            <div style={{ position: 'absolute', top: 18, left: 0, right: 0, height: 1, background: 'var(--line-2)' }} />
            {process.map((s, i) => (
              <div key={i} className="reveal" style={{ padding: '40px 32px 32px', position: 'relative' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ink)', border: '2px solid var(--paper)', position: 'absolute', top: 14, left: 32 }} />
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--muted)', letterSpacing: '0.08em', marginBottom: 12 }}>{t(`visual_identity.${s.w}`)}</div>
                <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22, letterSpacing: '-0.01em', marginBottom: 10 }}>{t(`visual_identity.${s.h}`)}</div>
                <div style={{ fontSize: 14, color: '#555', lineHeight: 1.55 }}>{t(`visual_identity.${s.d}`)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">03</span>{t('visual_identity.sec03_label')}</div>
            <div>
              <h2 className="sec-title">{t('visual_identity.sec03_title_pre')} <em>{t('visual_identity.sec03_title_em')}</em></h2>
              <p className="sec-sub">{t('visual_identity.sec03_sub')}</p>
            </div>
          </div>
          <div className="pricing">
            <div className="tier reveal">
              <div className="tier-badge">{t('visual_identity.t1_badge')}</div>
              <div className="tier-name">{t('visual_identity.t1_name')}</div>
              <div className="tier-sub">{t('visual_identity.t1_sub')}</div>
              <div className="tier-price">{priceFrom} 3 500<em>€</em></div>
              <ul className="tier-incl">
                {['t1_f1','t1_f2','t1_f3','t1_f4','t1_f5'].map(k => <li key={k}>{t(`visual_identity.${k}`)}</li>)}
              </ul>
              <a href={h('#contact')} className="btn btn-ghost">{t('cp.discuss')}<span className="arrow">↗</span></a>
            </div>
            <div className="tier featured reveal">
              <div className="tier-badge">{t('visual_identity.t2_badge')}</div>
              <div className="tier-name">{t('visual_identity.t2_name')}</div>
              <div className="tier-sub">{t('visual_identity.t2_sub')}</div>
              <div className="tier-price">{priceFrom} 8 000<em>€</em></div>
              <ul className="tier-incl">
                {['t2_f1','t2_f2','t2_f3','t2_f4','t2_f5','t2_f6'].map(k => <li key={k}>{t(`visual_identity.${k}`)}</li>)}
              </ul>
              <a href={h('#contact')} className="btn">{t('cp.request_quote')}<span className="arrow">↗</span></a>
            </div>
            <div className="tier reveal">
              <div className="tier-badge">{t('visual_identity.t3_badge')}</div>
              <div className="tier-name">{t('visual_identity.t3_name')}</div>
              <div className="tier-sub">{t('visual_identity.t3_sub')}</div>
              <div className="tier-price">{priceFrom} 1 800<em>€/{monthShort}</em></div>
              <ul className="tier-incl">
                {['t3_f1','t3_f2','t3_f3','t3_f4','t3_f5'].map(k => <li key={k}>{t(`visual_identity.${k}`)}</li>)}
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
              <h2>{t('visual_identity.cta_title_pre')} <em>{t('visual_identity.cta_title_em')}</em></h2>
              <p>{t('visual_identity.cta_sub')}</p>
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
