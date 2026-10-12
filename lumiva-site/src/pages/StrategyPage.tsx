import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageSEO from '../components/PageSEO'
import { useLangPath } from '../hooks/useLangPath'

export default function StrategyPage() {
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

  const tools = ['Miro', 'Notion', 'Typeform', 'Google Analytics 4', 'Hotjar', 'SimilarWeb', 'Brand24', 'Amplitude', 'Yandex Metrica']

  return (
    <>
      <PageSEO
        title={t('strategy.title')}
        description={t('strategy.sub')}
        path={p('/services/strategy')}
        jsonLd={{ '@context': 'https://schema.org', '@type': 'Service', name: 'Marketing Strategy', provider: { '@type': 'Organization', name: 'Lumiva Agency', url: 'https://lumiva.agency' }, areaServed: ['Turkey', 'Europe', 'CIS'], serviceType: 'Marketing Strategy' }}
      />
      <header className="page-hero">
        <div className="wrap">
          <div className="crumbs">
            <Link to={p('/')}>{t('crumbs.home')}</Link><span className="sep">/</span>
            <Link to={p('/services')}>{t('crumbs.services')}</Link><span className="sep">/</span>
            <span>{t('strategy.eyebrow')}</span>
          </div>
          <div className="page-hero-grid">
            <div>
              <div className="page-eyebrow">{t('strategy.eyebrow')}</div>
              <h1 className="page-title">{t('strategy.title')}</h1>
            </div>
            <div className="page-hero-side">
              <p>{t('strategy.sub')}</p>
              <div className="page-hero-actions">
                <a href={h('#contact')} className="btn btn-primary">{t('strategy.cta_btn')}<span className="arrow">↗</span></a>
                <a href={h('#cases')} className="btn btn-ghost">{t('common.cases')}<span className="arrow">↗</span></a>
              </div>
              <div className="hero-side-stats">
                <div className="s"><div className="num">47<em>+</em></div><div className="lbl">{t('strategy.stat1_lbl')}</div></div>
                <div className="s"><div className="num">×3.2</div><div className="lbl">{t('strategy.stat2_lbl')}</div></div>
                <div className="s"><div className="num">4<em>wk</em></div><div className="lbl">{t('strategy.stat3_lbl')}</div></div>
                <div className="s"><div className="num">94<em>%</em></div><div className="lbl">{t('strategy.stat4_lbl')}</div></div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">01</span>{t('strategy.sec01_tag').replace('01 ', '')}</div>
            <div>
              <h2 className="sec-title">{t('strategy.sec01_title')}</h2>
            </div>
            <a href={h('#contact')} className="show-all">{t('strategy.cta_btn')} <span className="arr">↗</span></a>
          </div>
          <div className="deliv">
            {[
              { n: 'D/01', titleKey: 'strategy.d01_title', descKey: 'strategy.d01_sub' },
              { n: 'D/02', titleKey: 'strategy.d02_title', descKey: 'strategy.d02_sub' },
              { n: 'D/03', titleKey: 'strategy.d03_title', descKey: 'strategy.d03_sub' },
              { n: 'D/04', titleKey: 'strategy.d04_title', descKey: 'strategy.d04_sub' },
              { n: 'D/05', titleKey: 'strategy.d05_title', descKey: 'strategy.d05_sub' },
              { n: 'D/06', titleKey: 'strategy.d06_title', descKey: 'strategy.d06_sub' },
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
            <div className="sec-tag"><span className="num">02</span>{t('strategy.sec02_tag').replace('02 ', '')}</div>
            <div>
              <h2 className="sec-title">{t('strategy.sec02_title')}</h2>
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
            <div className="sec-tag"><span className="num">03</span>{t('strategy.sec03_tag').replace('03 ', '')}</div>
            <div>
              <h2 className="sec-title">{t('strategy.sec03_title')}</h2>
            </div>
          </div>
          <div className="pmini">
            {[
              { n: '01', hKey: 'strategy.proc01', dKey: 'strategy.proc01' },
              { n: '02', hKey: 'strategy.proc02', dKey: 'strategy.proc02' },
              { n: '03', hKey: 'strategy.proc03', dKey: 'strategy.proc03' },
              { n: '04', hKey: 'strategy.proc04', dKey: 'strategy.proc04' },
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
            <div className="sec-tag"><span className="num">04</span>{t('strategy.sec04_tag').replace('04 ', '')}</div>
            <div>
              <h2 className="sec-title">{t('strategy.sec04_title')}</h2>
            </div>
          </div>
          <div className="pricing">
            <div className="tier">
              <div className="tier-badge">{t('strategy.t1_badge')}</div>
              <div className="tier-name">{t('strategy.t1_name')}</div>
              <div className="tier-sub">{t('strategy.t1_sub')}</div>
              <div className="tier-price">{t('strategy.t1_price')}</div>
              <ul className="tier-incl">
                {[t('strategy.t1_f1'), t('strategy.t1_f2'), t('strategy.t1_f3'), t('strategy.t1_f4'), t('strategy.t1_f5')].map(l => <li key={l}>{l}</li>)}
              </ul>
              <a href={h('#contact')} className="btn btn-ghost">{t('strategy.tier_discuss')}<span className="arrow">↗</span></a>
            </div>
            <div className="tier featured">
              <div className="tier-badge">{t('strategy.t2_badge')}</div>
              <div className="tier-name">{t('strategy.t2_name')}</div>
              <div className="tier-sub">{t('strategy.t2_sub')}</div>
              <div className="tier-price">{t('strategy.t2_price')}</div>
              <ul className="tier-incl">
                {[t('strategy.t2_f1'), t('strategy.t2_f2'), t('strategy.t2_f3'), t('strategy.t2_f4'), t('strategy.t2_f5'), t('strategy.t2_f6')].map(l => <li key={l}>{l}</li>)}
              </ul>
              <a href={h('#contact')} className="btn">{t('strategy.cta_btn')}<span className="arrow">↗</span></a>
            </div>
            <div className="tier">
              <div className="tier-badge">{t('strategy.t3_badge')}</div>
              <div className="tier-name">{t('strategy.t3_name')}</div>
              <div className="tier-sub">{t('strategy.t3_sub')}</div>
              <div className="tier-price">{t('strategy.t3_price')}</div>
              <ul className="tier-incl">
                {[t('strategy.t3_f1'), t('strategy.t3_f2'), t('strategy.t3_f3'), t('strategy.t3_f4'), t('strategy.t3_f5')].map(l => <li key={l}>{l}</li>)}
              </ul>
              <a href={h('#contact')} className="btn btn-ghost">{t('strategy.tier_discuss')}<span className="arrow">↗</span></a>
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
              { bg: '#1a1a1a', label: 'Northwind', labelColor: '#fff', cat: 'Finance · private banking', name: 'Northwind Capital', result: '+62%', resultSub: 'leads' },
              { bg: '#f5f3ee', label: 'Helios', labelColor: '#222', cat: 'B2B · energy', name: 'Helios Energy', result: '−41%', resultSub: 'CAC' },
              { bg: '#f6f3ec', label: 'Foster', labelColor: '#222', cat: 'B2B · consulting', name: 'Foster & Ko', result: '+55%', resultSub: 'inbound leads' },
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
              <h2>{t('strategy.cta_title')}</h2>
              <p>{t('strategy.cta_sub')}</p>
              <div className="cta-actions">
                <a href={h('#contact')} className="btn btn-primary">{t('strategy.cta_btn')}<span className="arrow">↗</span></a>
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
