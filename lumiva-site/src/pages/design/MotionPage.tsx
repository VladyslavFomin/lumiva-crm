import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageSEO from '../../components/PageSEO'
import { useLangPath } from '../../hooks/useLangPath'

const REEL_DURS = ['0:05–0:15', '0:15–0:60', '0:06–0:15', '0:03–0:08', '∞', '0:30–2:00']
const TOOLS = ['After Effects', 'Premiere Pro', 'GSAP', 'Lottie', 'Framer Motion', 'Cinema 4D']

export default function MotionPage() {
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
    { n: '01', ha: 'p0_ha', he: 'p0_he', d: 'p0_d' },
    { n: '02', ha: 'p1_ha', he: 'p1_he', d: 'p1_d' },
    { n: '03', ha: 'p2_ha', he: 'p2_he', d: 'p2_d' },
    { n: '04', ha: 'p3_ha', he: 'p3_he', d: 'p3_d' },
  ]

  return (
    <>
      <PageSEO
        title={t('motion.seo_title')}
        description={t('motion.seo_desc')}
        path={p('/services/design/motion')}
        jsonLd={{ '@context': 'https://schema.org', '@type': 'Service', name: 'Motion Design and Animation', provider: { '@type': 'Organization', name: 'Lumiva Agency', url: 'https://lumiva.agency' }, areaServed: ['Turkey', 'Europe', 'CIS'], serviceType: 'Motion Design' }}
      />
      <header className="page-hero">
        <div className="wrap">
          <div className="crumbs">
            <Link to={p('/')}>{t('crumbs.home')}</Link><span className="sep">/</span>
            <Link to={p('/services')}>{t('crumbs.services')}</Link><span className="sep">/</span>
            <Link to={p('/services/design')}>{t('crumbs.design')}</Link><span className="sep">/</span>
            <span>Motion &amp; video</span>
          </div>
          <div className="page-hero-grid">
            <div>
              <div className="page-eyebrow">D/04 · Motion & video</div>
              <h1 className="page-title">{t('motion.hero_title_pre')} <em>{t('motion.hero_title_em')}</em></h1>
            </div>
            <div className="page-hero-side">
              <p>{t('motion.hero_sub')}</p>
              <div className="page-hero-actions">
                <a href={h('#contact')} className="btn btn-primary">{t('cp.request_quote')}<span className="arrow">↗</span></a>
                <a href="#reel" className="btn btn-ghost">{t('motion.sec01_label')}<span className="arrow">↗</span></a>
              </div>
              <div className="hero-side-stats">
                <div className="s"><div className="num">300<em>+</em></div><div className="lbl">{t('motion.stat1_lbl')}</div></div>
                <div className="s"><div className="num">60<em>fps</em></div><div className="lbl">{t('motion.stat2_lbl')}</div></div>
                <div className="s"><div className="num">Lottie</div><div className="lbl">{t('motion.stat3_lbl')}</div></div>
                <div className="s"><div className="num">4K</div><div className="lbl">{t('motion.stat4_lbl')}</div></div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div style={{ background: 'var(--ink)', overflow: 'hidden', height: 80, display: 'flex', alignItems: 'center', borderTop: '1px solid #000' }}>
        <div style={{
          display: 'flex', gap: 48, paddingLeft: 48,
          fontFamily: "'Instrument Serif', serif", fontStyle: 'italic',
          fontSize: 28, color: 'rgba(255,255,255,0.18)', whiteSpace: 'nowrap',
          animation: 'none', letterSpacing: '-0.01em',
        }}>
          {['Motion', '·', 'Animation', '·', 'Video', '·', 'Lottie', '·', 'After Effects', '·', 'GSAP', '·', 'Brand film', '·', 'Explainer', '·', 'UI motion', '·', 'Reels', '·', 'Motion guidelines', '·'].map((item, i) => (
            <span key={i}>{item}</span>
          ))}
        </div>
      </div>

      <section id="reel">
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">01</span>{t('motion.sec01_label')}</div>
            <div>
              <h2 className="sec-title">{t('motion.sec01_title_pre')} <em>{t('motion.sec01_title_em')}</em></h2>
              <p className="sec-sub">{t('motion.sec01_sub')}</p>
            </div>
            <a href={h('#contact')} className="show-all">{t('cp.request_quote')} <span className="arr">↗</span></a>
          </div>

          <div style={{ borderTop: '1px solid var(--line)' }}>
            {REEL_DURS.map((dur, i) => (
              <div key={i} className="reveal sub-motion-reel" style={{
                transition: 'background 0.3s var(--ease)',
                cursor: 'default',
              }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--paper-2)'}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
              >
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 13,
                  color: 'var(--muted)', letterSpacing: '0.05em',
                  background: 'var(--paper-3)', padding: '6px 12px', borderRadius: 6,
                  textAlign: 'center', width: 'fit-content',
                }}>
                  {dur}
                </div>
                <h3 style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: 22, letterSpacing: '-0.01em', margin: 0 }}>
                  {t(`motion.reel${i}_type`)}
                </h3>
                <p className="sub-motion-reel-desc" style={{ margin: 0, color: '#555', fontSize: 14.5, lineHeight: 1.55 }}>{t(`motion.reel${i}_desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ background: 'var(--paper-2)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div className="wrap" style={{ padding: '72px var(--pad-x)' }}>
          <div className="r1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 48, alignItems: 'center' }}>
            <div>
              <div className="sec-tag" style={{ marginBottom: 20 }}><span className="num">02</span>{t('motion.sec02_label')}</div>
              <h2 className="sec-title" style={{ marginBottom: 20 }}>{t('motion.sec02_title_pre')} <em>{t('motion.sec02_title_em')}</em></h2>
              <p style={{ color: '#444', lineHeight: 1.65, fontSize: 16 }}>{t('motion.sec02_desc')}</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              {TOOLS.map((tool, i) => (
                <div key={tool} className="reveal" style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 10, padding: '20px 22px' }}>
                  <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 18, marginBottom: 6 }}>{tool}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.4 }}>{t(`motion.tool${i}_use`)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">03</span>{t('motion.sec03_label')}</div>
            <div><h2 className="sec-title">{t('motion.sec03_title_pre')} <em>{t('motion.sec03_title_em')}</em></h2></div>
          </div>
          <div className="pmini">
            {process.map((r, i) => (
              <div key={i} className="pmini-row reveal">
                <div className="pmini-num">{r.n}</div>
                <div className="pmini-h">{t(`motion.${r.ha}`)}<em>{t(`motion.${r.he}`)}</em></div>
                <div className="pmini-d">{t(`motion.${r.d}`)}</div>
                <div className="pmini-arr">↗</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">04</span>{t('motion.sec04_label')}</div>
            <div>
              <h2 className="sec-title">{t('motion.sec04_title_pre')} <em>{t('motion.sec04_title_em')}</em></h2>
              <p className="sec-sub">{t('motion.sec04_sub')}</p>
            </div>
          </div>
          <div className="pricing">
            <div className="tier reveal">
              <div className="tier-badge">{t('motion.t1_badge')}</div>
              <div className="tier-name">{t('motion.t1_name')}</div>
              <div className="tier-sub">{t('motion.t1_sub')}</div>
              <div className="tier-price">{priceFrom} 1 500<em>€</em></div>
              <ul className="tier-incl">
                {['t1_f1','t1_f2','t1_f3','t1_f4','t1_f5'].map(k => <li key={k}>{t(`motion.${k}`)}</li>)}
              </ul>
              <a href={h('#contact')} className="btn btn-ghost">{t('cp.discuss')}<span className="arrow">↗</span></a>
            </div>
            <div className="tier featured reveal">
              <div className="tier-badge">{t('motion.t2_badge')}</div>
              <div className="tier-name">{t('motion.t2_name')}</div>
              <div className="tier-sub">{t('motion.t2_sub')}</div>
              <div className="tier-price">{priceFrom} 6 000<em>€</em></div>
              <ul className="tier-incl">
                {['t2_f1','t2_f2','t2_f3','t2_f4','t2_f5'].map(k => <li key={k}>{t(`motion.${k}`)}</li>)}
              </ul>
              <a href={h('#contact')} className="btn">{t('cp.request_quote')}<span className="arrow">↗</span></a>
            </div>
            <div className="tier reveal">
              <div className="tier-badge">{t('motion.t3_badge')}</div>
              <div className="tier-name">{t('motion.t3_name')}</div>
              <div className="tier-sub">{t('motion.t3_sub')}</div>
              <div className="tier-price">{priceFrom} 2 500<em>€/{monthShort}</em></div>
              <ul className="tier-incl">
                {['t3_f1','t3_f2','t3_f3','t3_f4','t3_f5'].map(k => <li key={k}>{t(`motion.${k}`)}</li>)}
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
              <h2>{t('motion.cta_title_pre')} <em>{t('motion.cta_title_em')}</em></h2>
              <p>{t('motion.cta_sub')}</p>
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
