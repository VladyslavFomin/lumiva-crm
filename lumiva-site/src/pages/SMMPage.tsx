import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageSEO from '../components/PageSEO'
import RelatedServices from '../components/RelatedServices'
import RelatedCases from '../components/RelatedCases'
import { useLangPath } from '../hooks/useLangPath'

const PLATFORMS = [
  { id: 'TG', name: 'Telegram', color: '#2AABEE', stat: '48M', statSub: 'audience' },
  { id: 'VK', name: 'Instagram', color: '#4C75A3', stat: '1B+', statSub: 'users' },
  { id: 'YT', name: 'YouTube', color: '#FF0000', stat: '×2.3', statSub: 'CPM vs TV' },
  { id: 'IN', name: 'Influence', color: '#8B5CF6', stat: '3–5×', statSub: 'reach vs targeted' },
]

export default function SMMPage() {
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

  return (
    <>
      <PageSEO
        title={t('smm.title')}
        description={t('smm.sub')}
        path={p('/services/smm')}
        jsonLd={[
          { '@context': 'https://schema.org', '@type': 'Service', name: 'Social Media Marketing', provider: { '@type': 'Organization', name: 'Lumiva Agency', url: 'https://lumiva.agency' }, areaServed: ['Turkey', 'Europe', 'CIS'], serviceType: 'SMM' },
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [1, 2, 3, 4, 5, 6].map(i => ({
              '@type': 'Question',
              name: t(`smm.faq${i}_q`),
              acceptedAnswer: { '@type': 'Answer', text: t(`smm.faq${i}_a`) },
            })),
          },
        ]}
      />
      <header className="page-hero">
        <div className="wrap">
          <div className="crumbs">
            <Link to={p('/')}>{t('crumbs.home')}</Link><span className="sep">/</span>
            <Link to={p('/services')}>{t('crumbs.services')}</Link><span className="sep">/</span>
            <span>{t('smm.eyebrow')}</span>
          </div>
          <div className="page-hero-grid">
            <div>
              <div className="page-eyebrow">{t('smm.eyebrow')}</div>
              <h1 className="page-title">{t('smm.title')}</h1>
            </div>
            <div className="page-hero-side">
              <p>{t('smm.sub')}</p>
              <div className="page-hero-actions">
                <a href={h('#contact')} className="btn btn-primary">{t('smm.cta_btn')}<span className="arrow">↗</span></a>
                <a href="#channels" className="btn btn-ghost">{t('smm.sec01_tag').replace('01 ', '')}<span className="arrow">↗</span></a>
              </div>
              <div className="hero-side-stats">
                <div className="s"><div className="num">+2.8<em>M</em></div><div className="lbl">{t('smm.stat1_lbl')}</div></div>
                <div className="s"><div className="num">×3.1</div><div className="lbl">{t('smm.stat2_lbl')}</div></div>
                <div className="s"><div className="num">40<em>+</em></div><div className="lbl">{t('smm.stat3_lbl')}</div></div>
                <div className="s"><div className="num">4</div><div className="lbl">{t('smm.stat4_lbl')}</div></div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* PLATFORM STRIPS */}
      <section id="channels" style={{ borderTop: '1px solid var(--line)' }}>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">01</span>{t('smm.sec01_tag').replace('01 ', '')}</div>
            <div>
              <h2 className="sec-title">{t('smm.sec01_title')}</h2>
            </div>
            <a href={h('#contact')} className="show-all">{t('smm.cta_btn')} <span className="arr">↗</span></a>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, background: 'var(--line)' }}>
            {[
              {
                id: 'TG', name: t('smm.tg_title'), color: '#2AABEE',
                services: [t('smm.tg_f1'), t('smm.tg_f2'), t('smm.tg_f3'), t('smm.tg_f4'), t('smm.tg_f5')],
                desc: t('smm.tg_reach'),
              },
              {
                id: 'IG', name: t('smm.vk_title'), color: '#4C75A3',
                services: [t('smm.vk_f1'), t('smm.vk_f2'), t('smm.vk_f3'), t('smm.vk_f4'), t('smm.vk_f5')],
                desc: t('smm.vk_reach'),
              },
              {
                id: 'YT', name: t('smm.yt_title'), color: '#FF0000',
                services: [t('smm.yt_f1'), t('smm.yt_f2'), t('smm.yt_f3'), t('smm.yt_f4'), t('smm.yt_f5')],
                desc: t('smm.yt_reach'),
              },
              {
                id: 'IN', name: t('smm.in_title'), color: '#8B5CF6',
                services: [t('smm.in_f1'), t('smm.in_f2'), t('smm.in_f3'), t('smm.in_f4'), t('smm.in_f5')],
                desc: t('smm.in_reach'),
              },
            ].map((pl, i) => (
              <div key={i} className="reveal sub-smm-platform" style={{
                background: 'var(--paper)',
              }}>
                <div style={{ background: pl.color, padding: '48px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.1em' }}>{pl.id} / 0{i + 1}</div>
                  <div>
                    <div style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 40, color: '#fff', lineHeight: 1, marginBottom: 4 }}>{pl.name}</div>
                  </div>
                </div>
                <div style={{ padding: '48px 52px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0 48px', alignContent: 'start' }}>
                  <p style={{ margin: '0 0 0', color: '#444', fontSize: 15, lineHeight: 1.6, gridColumn: '1 / -1', marginBottom: 28 }}>{pl.desc}</p>
                  {pl.services.map(s => (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, color: 'var(--ink)', paddingBottom: 10, borderBottom: '1px solid var(--line)' }}>
                      <div style={{ width: 16, height: 1, background: pl.color, flexShrink: 0 }} />
                      {s}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHAT WE BUILD */}
      <section style={{ background: 'var(--paper-2)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div className="wrap" style={{ padding: '80px var(--pad-x)' }}>
          <div className="sec-head" style={{ marginBottom: 48 }}>
            <div className="sec-tag"><span className="num">02</span>{t('smm.sec02_tag').replace('02 ', '')}</div>
            <div>
              <h2 className="sec-title">{t('smm.sec02_title')}</h2>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 1, background: 'var(--line)' }}>
            {[
              { n: '01', titleKey: 'smm.b01_title' },
              { n: '02', titleKey: 'smm.b02_title' },
              { n: '03', titleKey: 'smm.b03_title' },
              { n: '04', titleKey: 'smm.b04_title' },
              { n: '05', titleKey: 'smm.b05_title' },
              { n: '06', titleKey: 'smm.b06_title' },
            ].map((item, i) => (
              <div key={i} className="reveal" style={{ background: 'var(--paper)', padding: '40px 36px' }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--muted)', letterSpacing: '0.1em', marginBottom: 20 }}>{item.n}</div>
                <h4 style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: 22, letterSpacing: '-0.01em', margin: '0 0 12px' }}>{t(item.titleKey)}</h4>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROCESS */}
      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">03</span>{t('smm.sec03_tag').replace('03 ', '')}</div>
            <div><h2 className="sec-title">{t('smm.sec03_title')}</h2></div>
          </div>
          <div className="pmini">
            {[
              { n: '01', hKey: 'smm.proc01', dKey: 'smm.proc01' },
              { n: '02', hKey: 'smm.proc02', dKey: 'smm.proc02' },
              { n: '03', hKey: 'smm.proc03', dKey: 'smm.proc03' },
              { n: '04', hKey: 'smm.proc04', dKey: 'smm.proc04' },
            ].map((r, i) => (
              <div key={i} className="pmini-row reveal">
                <div className="pmini-num">{r.n}</div>
                <div className="pmini-h">{t(r.hKey)}</div>
                <div className="pmini-d">{t(r.dKey)}</div>
                <div className="pmini-arr">↗</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLATFORM STATS STRIP */}
      <section style={{ background: 'var(--ink)', color: 'var(--paper)', borderTop: '1px solid #000', borderBottom: '1px solid #000' }}>
        <div className="wrap" style={{ padding: '64px var(--pad-x)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 1, background: 'rgba(255,255,255,0.1)' }}>
            {PLATFORMS.map((pl) => (
              <div key={pl.id} className="reveal" style={{ background: 'var(--ink)', padding: '40px 36px', borderBottom: '4px solid ' + pl.color }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', marginBottom: 16 }}>{pl.id}</div>
                <div style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 40, color: '#fff', lineHeight: 1, marginBottom: 6 }}>{pl.stat}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{pl.statSub}</div>
                <div style={{ marginTop: 20, fontFamily: "'Instrument Serif', serif", fontSize: 18, color: pl.color }}>{pl.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">04</span>{t('smm.sec04_tag').replace('04 ', '')}</div>
            <div>
              <h2 className="sec-title">{t('smm.sec04_title')}</h2>
            </div>
          </div>
          <div className="pricing">
            <div className="tier reveal">
              <div className="tier-badge">{t('smm.t1_badge')}</div>
              <div className="tier-name">{t('smm.t1_name')}</div>
              <div className="tier-sub">{t('smm.t1_sub')}</div>
              <div className="tier-price">{t('smm.t1_price')}</div>
              <ul className="tier-incl">
                {[t('smm.t1_f1'), t('smm.t1_f2'), t('smm.t1_f3'), t('smm.t1_f4'), t('smm.t1_f5')].map(l => <li key={l}>{l}</li>)}
              </ul>
              <a href={h('#contact')} className="btn btn-ghost">{t('smm.tier_discuss')}<span className="arrow">↗</span></a>
            </div>
            <div className="tier featured reveal">
              <div className="tier-badge">{t('smm.t2_badge')}</div>
              <div className="tier-name">{t('smm.t2_name')}</div>
              <div className="tier-sub">{t('smm.t2_sub')}</div>
              <div className="tier-price">{t('smm.t2_price')}</div>
              <ul className="tier-incl">
                {[t('smm.t2_f1'), t('smm.t2_f2'), t('smm.t2_f3'), t('smm.t2_f4'), t('smm.t2_f5'), t('smm.t2_f6')].map(l => <li key={l}>{l}</li>)}
              </ul>
              <a href={h('#contact')} className="btn">{t('smm.cta_btn')}<span className="arrow">↗</span></a>
            </div>
            <div className="tier reveal">
              <div className="tier-badge">{t('smm.t3_badge')}</div>
              <div className="tier-name">{t('smm.t3_name')}</div>
              <div className="tier-sub">{t('smm.t3_sub')}</div>
              <div className="tier-price">{t('smm.t3_price')}</div>
              <ul className="tier-incl">
                {[t('smm.t3_f1'), t('smm.t3_f2'), t('smm.t3_f3'), t('smm.t3_f4'), t('smm.t3_f5'), t('smm.t3_f6')].map(l => <li key={l}>{l}</li>)}
              </ul>
              <a href={h('#contact')} className="btn btn-ghost">{t('smm.tier_discuss')}<span className="arrow">↗</span></a>
            </div>
          </div>
        </div>
      </section>

      {/* AUDIENCE / PROBLEMS */}
      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">05</span>{t('smm.audience_tag').replace('06 ', '')}</div>
            <div><h2 className="sec-title">{t('smm.audience_title')}</h2></div>
          </div>
          <div className="deliv">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="deliv-row reveal">
                <div className="num">{`A/0${i}`}</div>
                <div><h4>{t(`smm.aud${i}_title`)}</h4><p>{t(`smm.aud${i}_desc`)}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">06</span>{t('smm.faq_tag').replace('07 ', '')}</div>
            <div><h2 className="sec-title">{t('smm.faq_title')}</h2></div>
          </div>
          <div className="faq">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="deliv-row reveal">
                <div className="num">{`Q${i}`}</div>
                <div><h4>{t(`smm.faq${i}_q`)}</h4><p>{t(`smm.faq${i}_a`)}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CASES */}
      <RelatedCases
        num="07"
        tag={t('common.cases')}
        heading={t('home.sec02_title')}
        allLabel={t('home.all_works')}
        keywords={['smm', 'social', 'social media']}
      />

      <RelatedServices
        num="08"
        tag={t('smm.rel_tag').replace('08 ', '')}
        heading={t('smm.rel_title')}
        items={[
          { title: t('smm.rel1_title'), desc: t('smm.rel1_desc'), to: p('/services/content') },
          { title: t('smm.rel2_title'), desc: t('smm.rel2_desc'), to: p('/services/design') },
          { title: t('smm.rel3_title'), desc: t('smm.rel3_desc'), to: p('/services/performance') },
        ]}
      />

      <section className="cta-strip" style={{ borderBottom: 0 }}>
        <div className="wrap">
          <div className="grid">
            <div>
              <h2>{t('smm.cta_title')}</h2>
              <p>{t('smm.cta_sub')}</p>
              <div className="cta-actions">
                <a href={h('#contact')} className="btn btn-primary">{t('smm.cta_btn')}<span className="arrow">↗</span></a>
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
