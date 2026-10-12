import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageSEO from '../../components/PageSEO'
import { useLangPath } from '../../hooks/useLangPath'

export default function BrandIdentityPage() {
  const { t } = useTranslation()
  const { p, h } = useLangPath()

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

  const axes = [
    { code: 'BR/S', titleKey: 'brand_identity.ax1_title', items: t('brand_identity.ax1_items', { returnObjects: true }) as string[] },
    { code: 'BR/V', titleKey: 'brand_identity.ax2_title', items: t('brand_identity.ax2_items', { returnObjects: true }) as string[] },
    { code: 'BR/A', titleKey: 'brand_identity.ax3_title', items: t('brand_identity.ax3_items', { returnObjects: true }) as string[] },
  ]

  const works = [
    { bg: '#1a1a1a', label: 'NW', lc: '#fff', catKey: 'brand_identity.w1_cat', nameKey: 'brand_identity.w1_name', r: '+62%', rsKey: 'brand_identity.w1_rs' },
    { bg: '#e9e6dc', label: 'MC', lc: '#222', catKey: 'brand_identity.w2_cat', nameKey: 'brand_identity.w2_name', r: '+180%', rsKey: 'brand_identity.w2_rs' },
    { bg: '#222', label: 'FK', lc: '#fff', catKey: 'brand_identity.w3_cat', nameKey: 'brand_identity.w3_name', r: '+55%', rsKey: 'brand_identity.w3_rs' },
  ]

  return (
    <>
      <PageSEO
        title={t('brand_identity.title')}
        description={t('brand_identity.sub')}
        path={p('/services/design/brand-identity')}
        jsonLd={{ '@context': 'https://schema.org', '@type': 'Service', name: 'Brand Identity Design', provider: { '@type': 'Organization', name: 'Lumiva Agency', url: 'https://lumiva.agency' }, areaServed: ['Turkey', 'Europe', 'CIS'], serviceType: 'Branding' }}
      />
      <header className="page-hero">
        <div className="wrap">
          <div className="crumbs">
            <Link to={p('/')}>{t('crumbs.home')}</Link><span className="sep">/</span>
            <Link to={p('/services')}>{t('crumbs.services')}</Link><span className="sep">/</span>
            <Link to={p('/services/design')}>{t('crumbs.design')}</Link><span className="sep">/</span>
            <span>{t('brand_identity.eyebrow')}</span>
          </div>
          <div className="page-hero-grid">
            <div>
              <div className="page-eyebrow">{t('brand_identity.eyebrow')}</div>
              <h1 className="page-title">{t('brand_identity.title')}</h1>
            </div>
            <div className="page-hero-side">
              <p>{t('brand_identity.sub')}</p>
              <div className="page-hero-actions">
                <a href={h('#contact')} className="btn btn-primary">{t('design.cta_btn')}<span className="arrow">↗</span></a>
                <a href={h('#cases')} className="btn btn-ghost">{t('common.cases')}<span className="arrow">↗</span></a>
              </div>
              <div className="hero-side-stats">
                <div className="s"><div className="num">63</div><div className="lbl">{t('brand_identity.stat1_lbl')}</div></div>
                <div className="s"><div className="num">22</div><div className="lbl">{t('brand_identity.stat2_lbl')}</div></div>
                <div className="s"><div className="num">4<em>+</em></div><div className="lbl">{t('brand_identity.stat3_lbl')}</div></div>
                <div className="s"><div className="num">2.4<em>y</em></div><div className="lbl">{t('brand_identity.stat4_lbl')}</div></div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* THREE AXES */}
      <section style={{ borderBottom: '1px solid var(--line)' }}>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">01</span>{t('brand_identity.sec01_tag').replace('01 ', '')}</div>
            <div>
              <h2 className="sec-title">{t('brand_identity.sec01_title')}</h2>
              <p className="sec-sub">{t('brand_identity.sec01_sub')}</p>
            </div>
          </div>
          <div className="r1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', borderTop: '1px solid var(--line)', borderLeft: '1px solid var(--line)' }}>
            {axes.map((a, i) => (
              <div key={i} className="reveal" style={{ borderRight: '1px solid var(--line)', borderBottom: '1px solid var(--line)', padding: '40px 36px' }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', marginBottom: 20 }}>{a.code}</div>
                <h3 style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: 28, letterSpacing: '-0.01em', margin: '0 0 24px' }}>{t(a.titleKey)}</h3>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {a.items.map(item => (
                    <li key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, color: '#444' }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--ink)', flexShrink: 0, display: 'inline-block' }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ALTERNATING DELIVERABLES */}
      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">02</span>{t('brand_identity.sec02_tag').replace('02 ', '')}</div>
            <div>
              <h2 className="sec-title">{t('brand_identity.sec02_title')}</h2>
              <p className="sec-sub">{t('brand_identity.sec02_sub')}</p>
            </div>
            <a href={h('#contact')} className="show-all">{t('design.cta_btn')} <span className="arr">↗</span></a>
          </div>

          {[
            {
              n: '01', titleKey: 'brand_identity.d01_title',
              desc: 'We research the market, audience and competitors. We articulate the brand essence, values and voice — a foundation that lasts.',
              tags: ['Positioning', 'Archetype', 'Naming', 'Tagline', 'Tone of Voice'],
              dark: false,
            },
            {
              n: '02', titleKey: 'brand_identity.d02_title',
              desc: 'Primary mark, symbol, monogram, carrier adaptations. All variants — dark/light/mono. Works on screen and embossed.',
              tags: ['Primary logo', 'Adaptations', 'Monogram', 'Clear space', 'Prohibited uses'],
              dark: true,
            },
            {
              n: '03', titleKey: 'brand_identity.d03_title',
              desc: 'Primary and secondary palette with precise codes (HEX, Pantone, CMYK, RAL). Type pair with heading, body and accent hierarchy.',
              tags: ['Primary palette', 'Secondary colours', 'Type pair', 'Hierarchy', 'Usage examples'],
              dark: false,
            },
            {
              n: '04', titleKey: 'brand_identity.d04_title',
              desc: 'Patterns, textures, icons, shapes — everything that makes the brand world rich and recognisable without the logo.',
              tags: ['Patterns', 'Textures', 'Iconography', 'Photo style', 'Illustration'],
              dark: true,
            },
            {
              n: '05', titleKey: 'brand_identity.d05_title',
              desc: 'Complete visual system documentation. PDF + Figma library. Your team and contractors always know how to use the brand correctly.',
              tags: ['Brandbook PDF', 'Figma Kit', 'Templates', 'Editable carriers'],
              dark: false,
            },
          ].map((item, i) => (
            <div key={i} className="reveal sub-deliv" style={{
              background: item.dark ? 'var(--ink)' : 'transparent',
              color: item.dark ? 'var(--paper)' : 'var(--ink)',
            }}>
              <div className="sub-deliv-l" style={{ order: i % 2 === 0 ? 0 : 1 }}>
                <div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: item.dark ? 'rgba(255,255,255,0.4)' : 'var(--muted)', letterSpacing: '0.1em', marginBottom: 20 }}>
                    BR/0{item.n}
                  </div>
                  <h3 style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: 'clamp(24px, 2.5vw, 38px)', letterSpacing: '-0.015em', margin: '0 0 16px', lineHeight: 1.1 }}>
                    {t(item.titleKey)}
                  </h3>
                  <p style={{ margin: 0, color: item.dark ? 'rgba(255,255,255,0.65)' : '#444', fontSize: 16, lineHeight: 1.65 }}>
                    {item.desc}
                  </p>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {item.tags.map(tag => (
                    <span key={tag} style={{
                      padding: '6px 14px', fontSize: 12,
                      border: `1px solid ${item.dark ? 'rgba(255,255,255,0.2)' : 'var(--line-2)'}`,
                      borderRadius: 100, color: item.dark ? 'rgba(255,255,255,0.7)' : 'var(--muted)',
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="sub-deliv-r" style={{
                order: i % 2 === 0 ? 1 : 0,
                background: item.dark ? 'rgba(255,255,255,0.04)' : 'var(--paper-2)',
              }}>
                <span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 'clamp(80px, 10vw, 140px)', color: item.dark ? 'rgba(255,255,255,0.07)' : 'rgba(34,34,34,0.07)', letterSpacing: '-0.04em', userSelect: 'none' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">03</span>{t('brand_identity.sec03_tag').replace('03 ', '')}</div>
            <div>
              <h2 className="sec-title">{t('brand_identity.sec03_title')}</h2>
              <p className="sec-sub">{t('brand_identity.sec03_sub')}</p>
            </div>
          </div>
          <div className="pricing">
            <div className="tier reveal">
              <div className="tier-badge">{t('design.t1_badge')}</div>
              <div className="tier-name">{t('design.t1_name')}</div>
              <div className="tier-sub">{t('design.t1_sub')}</div>
              <div className="tier-price">{t('design.t1_price')}</div>
              <ul className="tier-incl">
                {[t('design.t1_f1'), t('design.t1_f2'), t('design.t1_f3'), t('design.t1_f4'), t('design.t1_f5')].map(l => <li key={l}>{l}</li>)}
              </ul>
              <a href={h('#contact')} className="btn btn-ghost">{t('brand_identity.tier_discuss')}<span className="arrow">↗</span></a>
            </div>
            <div className="tier featured reveal">
              <div className="tier-badge">{t('design.t2_badge')}</div>
              <div className="tier-name">{t('design.t2_name')}</div>
              <div className="tier-sub">{t('design.t2_sub')}</div>
              <div className="tier-price">{t('design.t2_price')}</div>
              <ul className="tier-incl">
                {[t('design.t2_f1'), t('design.t2_f2'), t('design.t2_f3'), t('design.t2_f4'), t('design.t2_f5'), t('design.t2_f6')].map(l => <li key={l}>{l}</li>)}
              </ul>
              <a href={h('#contact')} className="btn">{t('design.cta_btn')}<span className="arrow">↗</span></a>
            </div>
            <div className="tier reveal">
              <div className="tier-badge">{t('design.t3_badge')}</div>
              <div className="tier-name">{t('design.t3_name')}</div>
              <div className="tier-sub">{t('design.t3_sub')}</div>
              <div className="tier-price">{t('design.t3_price')}</div>
              <ul className="tier-incl">
                {[t('design.t3_f1'), t('design.t3_f2'), t('design.t3_f3'), t('design.t3_f4'), t('design.t3_f5')].map(l => <li key={l}>{l}</li>)}
              </ul>
              <a href={h('#contact')} className="btn btn-ghost">{t('brand_identity.tier_discuss')}<span className="arrow">↗</span></a>
            </div>
          </div>
        </div>
      </section>

      <section id="cases">
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">04</span>{t('common.cases')}</div>
            <div><h2 className="sec-title">{t('home.sec02_title')}</h2></div>
            <a href={h('#cases')} className="show-all">{t('home.all_works')} <span className="arr">↗</span></a>
          </div>
          <div className="cases-mini">
            {works.map((c, i) => (
              <div key={i} className="cm reveal">
                <div className="cm-thumb">
                  <div className="cm-art" style={{ background: c.bg }}>
                    <div className="grid-deco" />
                    <div className="label serif italic" style={{ color: c.lc, fontSize: 72, letterSpacing: '-0.03em' }}>{c.label}</div>
                  </div>
                </div>
                <div className="cm-meta">
                  <div><div className="cm-name">{t(c.nameKey)}</div><div className="cm-cat">{t(c.catKey)}</div></div>
                  <div className="cm-result">{c.r}<em> {t(c.rsKey)}</em></div>
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
              <h2>{t('brand_identity.cta_title')}</h2>
              <p>{t('brand_identity.cta_sub')}</p>
              <div className="cta-actions">
                <a href={h('#contact')} className="btn btn-primary">{t('design.cta_btn')}<span className="arrow">↗</span></a>
                <a href={`mailto:${t('common.email')}`} className="btn btn-ghost">{t('common.email')}<span className="arrow">↗</span></a>
              </div>
            </div>
            <div className="cta-side">
              <div className="row"><div className="lbl">{t('common.slots_q3')}</div><div className="val">{t('common.slots_val')}</div></div>
              <div className="row"><div className="lbl">{t('common.start')}</div><div className="val">{t('common.start_val')}</div></div>
              <div className="row" style={{ borderBottom: 0 }}><div className="lbl">{t('common.nda')}</div><div className="val">{t('common.nda_val')}</div></div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
