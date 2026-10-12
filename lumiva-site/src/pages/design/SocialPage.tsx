import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageSEO from '../../components/PageSEO'
import { useLangPath } from '../../hooks/useLangPath'

const PLATFORMS = [
  { name: 'Instagram', handle: '@brand', color: '#E1306C' },
  { name: 'Telegram', handle: 't.me/brand', color: '#2AABEE' },
  { name: 'VK', handle: 'vk.com/brand', color: '#4C75A3' },
  { name: 'LinkedIn', handle: 'linkedin.com/company', color: '#0077B5' },
]

const PROCESS = [
  { n: '01', ha: 'p0_ha', he: 'p0_he', d: 'p0_d' },
  { n: '02', ha: 'p1_ha', he: 'p1_he', d: 'p1_d' },
  { n: '03', ha: 'p2_ha', he: 'p2_he', d: 'p2_d' },
  { n: '04', ha: 'p3_ha', he: 'p3_he', d: 'p3_d' },
]

export default function SocialPage() {
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
        title={t('social.seo_title')}
        description={t('social.seo_desc')}
        path={p('/services/design/social')}
        jsonLd={{ '@context': 'https://schema.org', '@type': 'Service', name: 'Social Media Design', provider: { '@type': 'Organization', name: 'Lumiva Agency', url: 'https://lumiva.agency' }, areaServed: ['Turkey', 'Europe', 'CIS'], serviceType: 'Social Media Design' }}
      />
      <header className="page-hero">
        <div className="wrap">
          <div className="crumbs">
            <Link to={p('/')}>{t('crumbs.home')}</Link><span className="sep">/</span>
            <Link to={p('/services')}>{t('crumbs.services')}</Link><span className="sep">/</span>
            <Link to={p('/services/design')}>{t('crumbs.design')}</Link><span className="sep">/</span>
            <span>{t('social.crumb')}</span>
          </div>
          <div className="page-hero-grid">
            <div>
              <div className="page-eyebrow">D/08 · Social media design</div>
              <h1 className="page-title">{t('social.hero_title_pre')} <em>{t('social.hero_title_em')}</em></h1>
            </div>
            <div className="page-hero-side">
              <p>{t('social.hero_sub')}</p>
              <div className="page-hero-actions">
                <a href={h('#contact')} className="btn btn-primary">{t('cp.request_quote')}<span className="arrow">↗</span></a>
                <a href="#platforms" className="btn btn-ghost">{t('social.sec01_label')}<span className="arrow">↗</span></a>
              </div>
              <div className="hero-side-stats">
                <div className="s"><div className="num">500<em>+</em></div><div className="lbl">{t('social.stat1_lbl')}</div></div>
                <div className="s"><div className="num">4</div><div className="lbl">{t('social.stat2_lbl')}</div></div>
                <div className="s"><div className="num">+38<em>%</em></div><div className="lbl">{t('social.stat3_lbl')}</div></div>
                <div className="s"><div className="num">Figma</div><div className="lbl">{t('social.stat4_lbl')}</div></div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section id="platforms">
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">01</span>{t('social.sec01_label')}</div>
            <div>
              <h2 className="sec-title">{t('social.sec01_title_pre')} <em>{t('social.sec01_title_em')}</em></h2>
              <p className="sec-sub">{t('social.sec01_sub')}</p>
            </div>
            <a href={h('#contact')} className="show-all">{t('cp.request_quote')} <span className="arr">↗</span></a>
          </div>

          <div className="r1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {PLATFORMS.map((plat, i) => (
              <div key={i} className="reveal" style={{
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius)',
                overflow: 'hidden',
                transition: 'transform var(--t), box-shadow var(--t)',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-6px)'; (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-hover)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '' }}
              >
                <div style={{ height: 4, background: plat.color }} />
                <div style={{ padding: '32px 36px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                    <div>
                      <h3 style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: 28, letterSpacing: '-0.01em', margin: '0 0 4px' }}>{plat.name}</h3>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--muted)', letterSpacing: '0.04em' }}>{plat.handle}</div>
                    </div>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: `${plat.color}18`, display: 'grid', placeItems: 'center' }}>
                      <div style={{ width: 20, height: 20, borderRadius: 4, background: plat.color, opacity: 0.7 }} />
                    </div>
                  </div>
                  <p style={{ margin: '0 0 24px', color: '#444', fontSize: 15, lineHeight: 1.6 }}>{t(`social.plat${i}_desc`)}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {[0,1,2,3].map(j => (
                      <span key={j} style={{
                        padding: '6px 14px', fontSize: 12,
                        background: `${plat.color}12`,
                        border: `1px solid ${plat.color}30`,
                        borderRadius: 100, color: plat.color,
                      }}>{t(`social.plat${i}_fmt${j}`)}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ background: 'var(--ink)', color: 'var(--paper)', borderTop: '1px solid #000', borderBottom: '1px solid #000' }}>
        <div className="wrap" style={{ padding: '80px var(--pad-x)' }}>
          <div className="sec-head" style={{ marginBottom: 48 }}>
            <div className="sec-tag" style={{ color: 'rgba(255,255,255,0.5)' }}>
              <span className="num" style={{ borderColor: 'rgba(255,255,255,0.2)', color: 'var(--paper)' }}>02</span>
              {t('social.sec02_label')}
            </div>
            <div>
              <h2 className="sec-title">{t('social.sec02_title_pre')} <em>{t('social.sec02_title_em')}</em></h2>
              <p className="sec-sub" style={{ color: 'rgba(255,255,255,0.5)' }}>{t('social.sec02_sub')}</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {[0,1,2,3,4,5].map(i => (
              <div key={i} className="reveal" style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '32px 28px' }}>
                <h4 style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: 20, letterSpacing: '-0.01em', margin: '0 0 12px' }}>{t(`social.del${i}_title`)}</h4>
                <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>{t(`social.del${i}_desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">03</span>{t('social.sec03_label')}</div>
            <div><h2 className="sec-title">{t('social.sec03_title_pre')} <em>{t('social.sec03_title_em')}</em></h2></div>
          </div>
          <div className="pmini">
            {PROCESS.map((r, i) => (
              <div key={i} className="pmini-row reveal">
                <div className="pmini-num">{r.n}</div>
                <div className="pmini-h">{t(`social.${r.ha}`)}<em>{t(`social.${r.he}`)}</em></div>
                <div className="pmini-d">{t(`social.${r.d}`)}</div>
                <div className="pmini-arr">↗</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">04</span>{t('social.sec04_label')}</div>
            <div>
              <h2 className="sec-title">{t('social.sec04_title_pre')} <em>{t('social.sec04_title_em')}</em></h2>
              <p className="sec-sub">{t('social.sec04_sub')}</p>
            </div>
          </div>
          <div className="pricing">
            <div className="tier reveal">
              <div className="tier-badge">{t('social.t1_badge')}</div>
              <div className="tier-name">{t('social.t1_name')}</div>
              <div className="tier-sub">{t('social.t1_sub')}</div>
              <div className="tier-price">{priceFrom} 1 200<em>€</em></div>
              <ul className="tier-incl">
                {['t1_f1','t1_f2','t1_f3','t1_f4','t1_f5'].map(k => <li key={k}>{t(`social.${k}`)}</li>)}
              </ul>
              <a href={h('#contact')} className="btn btn-ghost">{t('cp.discuss')}<span className="arrow">↗</span></a>
            </div>
            <div className="tier featured reveal">
              <div className="tier-badge">{t('social.t2_badge')}</div>
              <div className="tier-name">{t('social.t2_name')}</div>
              <div className="tier-sub">{t('social.t2_sub')}</div>
              <div className="tier-price">{priceFrom} 4 500<em>€</em></div>
              <ul className="tier-incl">
                {['t2_f1','t2_f2','t2_f3','t2_f4','t2_f5','t2_f6'].map(k => <li key={k}>{t(`social.${k}`)}</li>)}
              </ul>
              <a href={h('#contact')} className="btn">{t('cp.request_quote')}<span className="arrow">↗</span></a>
            </div>
            <div className="tier reveal">
              <div className="tier-badge">{t('social.t3_badge')}</div>
              <div className="tier-name">{t('social.t3_name')}</div>
              <div className="tier-sub">{t('social.t3_sub')}</div>
              <div className="tier-price">{priceFrom} 1 500<em>€/{monthShort}</em></div>
              <ul className="tier-incl">
                {['t3_f1','t3_f2','t3_f3','t3_f4','t3_f5'].map(k => <li key={k}>{t(`social.${k}`)}</li>)}
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
              <h2>{t('social.cta_title_pre')} <em>{t('social.cta_title_em')}</em></h2>
              <p>{t('social.cta_sub')}</p>
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
