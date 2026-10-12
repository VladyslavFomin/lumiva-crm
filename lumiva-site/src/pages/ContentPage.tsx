import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageSEO from '../components/PageSEO'
import { useLangPath } from '../hooks/useLangPath'

export default function ContentPage() {
  const { t } = useTranslation()
  const { p, h } = useLangPath()

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

  const tools = ['Telegram', 'Instagram', 'YouTube', 'Adobe Premiere', 'After Effects', 'DaVinci Resolve', 'Figma', 'Notion', 'Brand24', 'SocialBlade']

  return (
    <>
      <PageSEO
        title={t('content.title')}
        description={t('content.sub')}
        path={p('/services/content')}
        jsonLd={{ '@context': 'https://schema.org', '@type': 'Service', name: 'Content Production', provider: { '@type': 'Organization', name: 'Lumiva Agency', url: 'https://lumiva.agency' }, areaServed: ['Turkey', 'Europe', 'CIS'], serviceType: 'Content Marketing' }}
      />
      <header className="page-hero">
        <div className="wrap">
          <div className="crumbs">
            <Link to={p('/')}>{t('crumbs.home')}</Link><span className="sep">/</span>
            <Link to={p('/services')}>{t('crumbs.services')}</Link><span className="sep">/</span>
            <span>{t('content.eyebrow')}</span>
          </div>
          <div className="page-hero-grid">
            <div>
              <div className="page-eyebrow">{t('content.eyebrow')}</div>
              <h1 className="page-title">{t('content.title')}</h1>
            </div>
            <div className="page-hero-side">
              <p>{t('content.sub')}</p>
              <div className="page-hero-actions">
                <a href={h('#contact')} className="btn btn-primary">{t('content.cta_btn')}<span className="arrow">↗</span></a>
                <a href={h('#cases')} className="btn btn-ghost">{t('common.cases')}<span className="arrow">↗</span></a>
              </div>
              <div className="hero-side-stats">
                <div className="s"><div className="num">14<em>M</em></div><div className="lbl">{t('content.stat1_lbl')}</div></div>
                <div className="s"><div className="num">+180<em>%</em></div><div className="lbl">{t('content.stat2_lbl')}</div></div>
                <div className="s"><div className="num">42<em>+</em></div><div className="lbl">{t('content.stat3_lbl')}</div></div>
                <div className="s"><div className="num">8<em>yr</em></div><div className="lbl">{t('content.stat4_lbl')}</div></div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">01</span>{t('content.sec01_tag').replace('01 ', '')}</div>
            <div>
              <h2 className="sec-title">{t('content.sec01_title')}</h2>
            </div>
            <a href={h('#contact')} className="show-all">{t('content.cta_btn')} <span className="arr">↗</span></a>
          </div>
          <div className="deliv">
            {[
              { n: 'D/01', titleKey: 'content.d01_title', descKey: 'content.d01_sub' },
              { n: 'D/02', titleKey: 'content.d02_title', descKey: 'content.d02_sub' },
              { n: 'D/03', titleKey: 'content.d03_title', descKey: 'content.d03_sub' },
              { n: 'D/04', titleKey: 'content.d04_title', descKey: 'content.d04_sub' },
              { n: 'D/05', titleKey: 'content.d05_title', descKey: 'content.d05_sub' },
              { n: 'D/06', titleKey: 'content.d06_title', descKey: 'content.d06_sub' },
            ].map((d, i) => (
              <div key={i} className="deliv-row">
                <div className="num">{d.n}</div>
                <div><h4>{t(d.titleKey)}</h4><p>{t(d.descKey)}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">02</span>{t('content.sec02_tag').replace('02 ', '')}</div>
            <div>
              <h2 className="sec-title">{t('content.sec02_title')}</h2>
            </div>
          </div>
          <div className="stack">
            {tools.map(c => <span key={c} className="chip"><span className="pip" />{c}</span>)}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">03</span>{t('content.sec03_tag').replace('03 ', '')}</div>
            <div>
              <h2 className="sec-title">{t('content.sec03_title')}</h2>
            </div>
          </div>
          <div className="pmini">
            {[
              { n: '01', hKey: 'content.proc01', dKey: 'content.proc01' },
              { n: '02', hKey: 'content.proc02', dKey: 'content.proc02' },
              { n: '03', hKey: 'content.proc03', dKey: 'content.proc03' },
              { n: '04', hKey: 'content.proc04', dKey: 'content.proc04' },
            ].map((r, i) => (
              <div key={i} className="pmini-row">
                <div className="pmini-num">{r.n}</div>
                <div className="pmini-h">{t(r.hKey)}</div>
                <div className="pmini-d">{t(r.dKey)}</div>
                <div className="pmini-arr">↗</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">04</span>{t('content.sec04_tag').replace('04 ', '')}</div>
            <div>
              <h2 className="sec-title">{t('content.sec04_title')}</h2>
            </div>
          </div>
          <div className="pricing">
            <div className="tier">
              <div className="tier-badge">{t('content.t1_badge')}</div>
              <div className="tier-name">{t('content.t1_name')}</div>
              <div className="tier-sub">{t('content.t1_sub')}</div>
              <div className="tier-price">{t('content.t1_price')}</div>
              <ul className="tier-incl">
                {[t('content.t1_f1'), t('content.t1_f2'), t('content.t1_f3'), t('content.t1_f4'), t('content.t1_f5')].map(l => <li key={l}>{l}</li>)}
              </ul>
              <a href={h('#contact')} className="btn btn-ghost">{t('content.tier_discuss')}<span className="arrow">↗</span></a>
            </div>
            <div className="tier featured">
              <div className="tier-badge">{t('content.t2_badge')}</div>
              <div className="tier-name">{t('content.t2_name')}</div>
              <div className="tier-sub">{t('content.t2_sub')}</div>
              <div className="tier-price">{t('content.t2_price')}</div>
              <ul className="tier-incl">
                {[t('content.t2_f1'), t('content.t2_f2'), t('content.t2_f3'), t('content.t2_f4'), t('content.t2_f5'), t('content.t2_f6')].map(l => <li key={l}>{l}</li>)}
              </ul>
              <a href={h('#contact')} className="btn">{t('content.cta_btn')}<span className="arrow">↗</span></a>
            </div>
            <div className="tier">
              <div className="tier-badge">{t('content.t3_badge')}</div>
              <div className="tier-name">{t('content.t3_name')}</div>
              <div className="tier-sub">{t('content.t3_sub')}</div>
              <div className="tier-price">{t('content.t3_price')}</div>
              <ul className="tier-incl">
                {[t('content.t3_f1'), t('content.t3_f2'), t('content.t3_f3'), t('content.t3_f4'), t('content.t3_f5'), t('content.t3_f6')].map(l => <li key={l}>{l}</li>)}
              </ul>
              <a href={h('#contact')} className="btn btn-ghost">{t('content.tier_discuss')}<span className="arrow">↗</span></a>
            </div>
          </div>
        </div>
      </section>

      <section id="cases">
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">05</span>{t('common.cases')}</div>
            <div><h2 className="sec-title">{t('home.sec02_title')}</h2></div>
            <a href={h('#cases')} className="show-all">{t('home.all_works')} <span className="arr">↗</span></a>
          </div>
          <div className="cases-mini">
            {[
              { bg: '#0f0f0f', label: 'Vesna', labelColor: '#fff', cat: 'Beauty · cosmetics', name: 'Vesna Cosmetics', result: '14M', resultSub: 'views/year' },
              { bg: '#e9e6dc', label: 'Maison', labelColor: '#222', cat: 'F&B · luxury', name: 'Maison Côte', result: '+180%', resultSub: 'reservations' },
              { bg: '#dcd9cf', label: 'NORD', labelColor: '#222', cat: 'Beauty · 2024', name: 'NORD/02', result: '×4.8', resultSub: 'ROAS' },
            ].map((c, i) => (
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
                  <div className="cm-result">{c.result}<em> {c.resultSub}</em></div>
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
              <h2>{t('content.cta_title')}</h2>
              <p>{t('content.cta_sub')}</p>
              <div className="cta-actions">
                <a href={h('#contact')} className="btn btn-primary">{t('content.cta_btn')}<span className="arrow">↗</span></a>
                <a href={`mailto:${t('common.email')}`} className="btn btn-ghost">{t('common.email')}<span className="arrow">↗</span></a>
              </div>
            </div>
            <div className="cta-side">
              <div className="row"><div className="lbl">{t('common.slots_q3')}</div><div className="val">{t('common.slots_val')}</div></div>
              <div className="row"><div className="lbl">{t('common.start')}</div><div className="val">{t('common.start_val')}</div></div>
              <div className="row" style={{ borderBottom: 0 }}><div className="lbl">{t('common.response_time')}</div><div className="val">{t('common.response_val')}</div></div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
