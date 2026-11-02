/* Главная lumiva.agency — по Claude Design «lumiva-agency-home-v2» (ag-home-a.jsx / ag-home-b.jsx).
 * Тексты — существующие ключи home.* (что было на сайте), новые строки — components/lh/agText.ts. */
import { Fragment, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageSEO from '../components/PageSEO'
import { useLangPath } from '../hooks/useLangPath'
import { trackEvent } from '../lib/analytics'
import { buildContactSource, CONTACT_ENDPOINT } from '../components/Layout'
import { LIc, LI, Cnt, LhDoing, useInView } from '../components/lh/kit'
import { AG_TEXT, agLang } from '../components/lh/agText'
import { AiCharacter, AI_ROLE_PALETTE } from '../components/lh/AiCharacter'

type T = (typeof AG_TEXT)['en']

const tilt = (k: number, ky: number) => ({
  onMouseMove: (e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget
    const r = el.getBoundingClientRect()
    el.style.setProperty('--rx', ((e.clientY - r.top) / r.height - 0.5) * -k + 'deg')
    el.style.setProperty('--ry', ((e.clientX - r.left) / r.width - 0.5) * ky + 'deg')
  },
  onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.setProperty('--rx', '0deg')
    e.currentTarget.style.setProperty('--ry', '0deg')
  },
})

function AgHead({ k, t, d, id }: { k: string; t: string; d?: string; id?: string }) {
  return (
    <div className="lh-sh lh-rv" id={id}>
      <div className="lh-k">{k}</div>
      <h2>{t}</h2>
      {d && <p>{d}</p>}
    </div>
  )
}

/* ───────── Hero ───────── */
const ROAS = [1.2, 1.5, 1.9, 2.4, 2.9, 3.4]
function AgDash({ on, T }: { on: boolean; T: T }) {
  const X = (i: number) => 30 + i * 104
  const Y = (v: number) => 130 - v * 30
  const d = ROAS.map((v, i) => (i ? 'L' : 'M') + X(i) + ' ' + Y(v)).join(' ')
  const [ch, setCh] = useState([62, 48, 36, 22])
  useEffect(() => {
    const t = setInterval(() => setCh(c => c.map(x => Math.max(14, Math.min(92, x + (Math.random() * 14 - 7))))), 2400)
    return () => clearInterval(t)
  }, [])
  const D = T.dash
  return (
    <div className="ag-dash">
      <div className="ag-tile"><span className="lh-k">{D.projects}</span><b><Cnt to={142} on={on} />+</b><em>{D.projectsSub}</em></div>
      <div className="ag-tile"><span className="lh-k">{D.roas}</span><b>×<Cnt to={4.8} dec={1} on={on} /></b><em>{D.roasSub}</em></div>
      <div className="ag-tile"><span className="lh-k">{D.cac}</span><b>−<Cnt to={38} on={on} />%</b><em>{D.cacSub}</em></div>
      <div className="ag-tile dk"><span className="lh-k">{D.nps}</span><b><Cnt to={9.4} dec={1} on={on} />/10</b><em style={{ color: '#c8f560' }}>{D.npsSub}</em></div>
      <div className="ag-tile w3">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span className="lh-k">{D.chart}</span>
          <span className="lh-live" style={{ fontSize: 11.5, color: '#127046' }}><i />1.2 → 3.4</span>
        </div>
        <svg className="ag-ch" viewBox="0 0 580 150" preserveAspectRatio="none" aria-hidden="true">
          {[0, 1, 2, 3].map(k => <line key={k} className="g" x1="30" x2="560" y1={130 - k * 30} y2={130 - k * 30} />)}
          {[0, 1, 2, 3].map(k => <text key={'t' + k} x="0" y={134 - k * 30}>{k}.0</text>)}
          <line className="l2" x1="30" x2="550" y1={Y(1.2)} y2={Y(1.2)} />
          <path className={'l ag-drw' + (on ? ' in' : '')} pathLength={1} d={d} />
          {on && (
            <g style={{ animation: 'lhUp .6s 2.2s both' }}>
              <circle cx={X(5)} cy={Y(3.4)} r="5" fill="#c8f560" stroke="#111113" strokeWidth="2" />
              <circle cx={X(5)} cy={Y(3.4)} r="5" className="lh-hub-ring" style={{ stroke: '#9fdc3c' }} />
            </g>
          )}
        </svg>
      </div>
      <div className="ag-tile">
        <span className="lh-k">{D.leads}</span><b>+62%</b>
        <div className="ag-fun">{[30, 44, 40, 58, 72, 100].map((h, i) => <i key={i} style={{ height: h + '%', animationDelay: 0.6 + i * 0.08 + 's' }} />)}</div>
      </div>
      <div className="ag-tile w4">
        <span className="lh-k">{D.mix}</span>
        <div className="ag-chb">
          {D.mixNames.map((n, i) => (
            <div key={n}><span>{n}</span><i><span style={{ width: (on ? ch[i] : 0) + '%' }} /></i><b>{Math.round(ch[i])}%</b></div>
          ))}
        </div>
      </div>
    </div>
  )
}

function AgHero({ T }: { T: T }) {
  const { t } = useTranslation()
  const { h } = useLangPath()
  const wrap = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    const tm = setTimeout(() => setOn(true), 600)
    const f = () => wrap.current?.style.setProperty('--p', String(Math.min(1, window.scrollY / 520)))
    f()
    window.addEventListener('scroll', f, { passive: true })
    return () => { clearTimeout(tm); window.removeEventListener('scroll', f) }
  }, [])
  const mv = (e: React.MouseEvent) => {
    const el = stage.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3))
    el.style.setProperty('--my', ((e.clientY - r.top) / r.height - 0.5).toFixed(3))
  }
  const reset = () => { stage.current?.style.setProperty('--mx', '0'); stage.current?.style.setProperty('--my', '0') }
  const title = t('home.hero_title')
  const cut = title.lastIndexOf(' ')
  const pal = AI_ROLE_PALETTE.marketing_analyst

  return (
    <section className="lh-hero" id="hero">
      <div className="lh-glow" />
      <div className="lh-hero-c">
        <a className="lh-pill" href={h('#contact')}><span className="lh-pill-b">{T.pillTag}</span>{t('topbar.slots')}<LIc d={LI.arrow} size={13} /></a>
        <div className="ag-kick">{t('home.hero_eyebrow')}</div>
        <h1 className="lh-h1">{cut > 0 ? <>{title.slice(0, cut)} <span className="ag-grad">{title.slice(cut + 1)}</span></> : title}</h1>
        <p className="lh-sub">{t('home.hero_seo_copy')}</p>
        <div className="lh-cta">
          <a className="lh-btn lg" href={h('#contact')}>{t('home.hero_cta_discuss')}<LIc d={LI.ne} size={15} sw={2} /></a>
          <a className="lh-btn lg gh" href={h('#cases')}>{t('home.hero_cta_cases')}<LIc d={LI.ne} size={15} /></a>
        </div>
      </div>
      <div className="lh-stage" ref={stage} onMouseMove={mv} onMouseLeave={reset}>
        <div ref={wrap}>
          <div className="lh-shot" aria-hidden="true">
            <div className="lh-chrome"><i /><i /><i /><span>lumiva.agency/report</span></div>
            <AgDash on={on} T={T} />
          </div>
        </div>
        <div className="lh-fl lh-fl-a">
          <div className="lh-fl-av" style={{ background: pal.bg }}><AiCharacter role="marketing_analyst" mood="on" /></div>
          <div><b>Mira AI</b><span className="lh-live"><i /><LhDoing list={T.fl.aiDoing} ms={2600} /></span></div>
        </div>
        <div className="lh-fl lh-fl-b"><div className="lh-fl-ok"><LIc d={LI.check} size={16} sw={2.4} /></div><div><b>ROAS 1.2 → 3.4</b><span>{T.fl.roasSub}</span></div></div>
        <div className="lh-fl lh-fl-c"><div className="lh-fl-ic"><LIc d={LI.trend} size={16} /></div><div><b>CAC −41%</b><span>{T.fl.cacSub}</span></div></div>
      </div>
    </section>
  )
}

function AgLogos({ T }: { T: T }) {
  const { t } = useTranslation()
  const n = ['Northwind Capital', 'Atelier Volta', 'RIGEL Athletics', 'Maison Côte', 'PALOMA Coffee', 'Foster & Ko', 'Helios Energy', 'NORD/02', 'Vesna Cosmetics', 'Forge Ventures']
  const row = (k: string) => <div key={k}>{n.map(x => <span key={x}><i />{x}</span>)}</div>
  return (
    <div className="lh-logos">
      <div className="lh-logos-in">
        <div className="lh-logos-l"><div className="lh-k">{T.clients}</div><span>{t('home.stat1_num')} {t('home.stat1_lbl')}</span></div>
        <div className="lh-logos-m" aria-hidden="true"><div className="lh-logos-t">{row('a')}{row('b')}</div></div>
      </div>
    </div>
  )
}

/* ───────── Services ───────── */
function AgServices() {
  const { t } = useTranslation()
  const { p } = useLangPath()
  const S: [string, React.ReactNode, string[], string | null][] = [
    ['strategy', LI.target, ['JTBD', 'CJM', 'Brand strategy', 'Research'], p('/services/strategy')],
    ['design', LI.pen, ['Naming', 'Identity', 'Guidelines', 'Packaging'], p('/services/design')],
    ['performance', LI.trend, ['Google Ads', 'Meta', 'Programmatic', 'CRM'], p('/services/performance')],
    ['development', LI.web, ['UX', 'UI', 'Webflow', 'Next.js'], p('/services/development')],
    ['content', LI.cam, ['Photo', 'Video', 'Motion', '3D'], p('/services/content')],
    ['smm', LI.users, ['Telegram', 'Instagram', 'YouTube', 'Influence'], p('/services/smm')],
    ['seo', LI.search, ['Semrush', 'Google', 'Core Web Vitals'], p('/services/seo')],
    ['crm', LI.flow, ['Lumiva CRM', 'Custom', 'Integrations', 'Auto-funnels'], null],
  ]
  const mv = (e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.setProperty('--x', e.clientX - r.left + 'px')
    e.currentTarget.style.setProperty('--y', e.clientY - r.top + 'px')
  }
  return (
    <section className="lh-sec" id="services">
      <AgHead k={t('home.sec01_tag').replace(/^(\d+)\s/, '$1 · ')} t={t('home.sec01_title')} d={t('home.sec01_sub')} />
      <div className="lh-feats">
        {S.map(([s, ic, tags, to], i) => {
          const n = String(i + 1).padStart(2, '0')
          const inner = (
            <>
              <span className="ag-svc-ic"><LIc d={ic} size={18} /></span>
              <span className="lh-feat-n">S/{n}</span>
              <b>{t('home.svc' + n)}</b>
              <p>{t('home.svc' + n + '_desc')}</p>
              <div className="ag-tags">{tags.map(x => <span key={x}>{x}</span>)}</div>
            </>
          )
          const style = { transitionDelay: (i % 4) * 0.06 + 's' }
          return to
            ? <Link key={s} to={to} className="lh-feat lh-rv" style={style} onMouseMove={mv}>{inner}</Link>
            : <a key={s} href="https://crm.lumiva.agency/" target="_blank" rel="noopener noreferrer" className="lh-feat lh-rv" style={style} onMouseMove={mv}>{inner}</a>
        })}
      </div>
      <div className="lh-center lh-rv"><Link className="lh-btn gh" to={p('/services')}>{t('common.all_services')}<LIc d={LI.ne} size={14} /></Link></div>
    </section>
  )
}

/* ───────── AI ───────── */
function AgAIDemo({ T }: { T: T }) {
  const box = useRef<HTMLDivElement>(null)
  const vis = useInView(box)
  const [st, setSt] = useState({ i: 0, ph: 'type' as 'type' | 'think' | 'build' | 'hold', c: 0, s: 0, r: 0 })
  const A = T.ai
  const cur = A.prompts[st.i]
  useEffect(() => {
    if (!vis) return
    let tm: ReturnType<typeof setTimeout>
    if (st.ph === 'type') tm = setTimeout(() => setSt(s => (s.c >= cur.p.length ? { ...s, ph: 'think', s: 0 } : { ...s, c: s.c + 1 })), st.c >= cur.p.length ? 400 : 28)
    else if (st.ph === 'think') tm = setTimeout(() => setSt(s => (s.s >= A.steps.length - 1 ? { ...s, ph: 'build', r: 0 } : { ...s, s: s.s + 1 })), 480)
    else if (st.ph === 'build') tm = setTimeout(() => setSt(s => (s.r >= cur.rows.length ? { ...s, ph: 'hold' } : { ...s, r: s.r + 1 })), 380)
    else tm = setTimeout(() => setSt(s => ({ i: (s.i + 1) % A.prompts.length, ph: 'type', c: 0, s: 0, r: 0 })), 3400)
    return () => clearTimeout(tm)
  }, [st, vis])
  const res = st.ph === 'build' || st.ph === 'hold'
  return (
    <div className="lh-aura lh-rv" ref={box}>
      <div className="lh-prompt"><div className="lh-prompt-in">
        <span className="lh-prompt-ic"><LIc d={LI.spark} size={15} /></span>
        <span className="lh-prompt-t">{cur.p.slice(0, st.c)}{st.ph === 'type' && <i className="lh-caret" />}</span>
        <span className={'lh-prompt-go' + (st.ph !== 'type' ? ' on' : '')}><LIc d={LI.arrow} size={14} sw={2} /></span>
      </div></div>
      <div className="lh-aura-steps">
        {A.steps.map((s, i) => {
          const done = res || (st.ph === 'think' && i < st.s)
          const c = st.ph === 'think' && i === st.s
          return <span key={s} className={(done ? 'done' : '') + (c ? ' cur' : '')}><i>{done && <LIc d={LI.check} size={9} sw={3} />}</i>{s}</span>
        })}
      </div>
      <div className="ag-ai-res">
        <div className="ag-ai-res-h"><span className="lh-prompt-ic"><LIc d={LI.spark} size={15} /></span><div><b>{cur.who}</b><br /><span>{A.note}</span></div></div>
        {res
          ? cur.rows.slice(0, st.r).map((r, k) => <div key={st.i + '-' + k} className="ag-ai-row"><span className="d"><LIc d={LI.check} size={12} sw={2.4} /></span><span>{r[0]}</span><b className={r[2]}>{r[1]}</b></div>)
          : <div className="ag-ai-wait"><span className="lh-think"><i /><i /><i /></span>{A.working}</div>}
      </div>
      <div className="lh-aura-tabs">
        {A.tabs.map((n, i) => <button key={n} type="button" className={i === st.i ? 'on' : ''} onClick={() => setSt({ i, ph: 'type', c: 0, s: 0, r: 0 })}>{n}</button>)}
      </div>
    </div>
  )
}

function AgAI({ T }: { T: T }) {
  const A = T.ai
  const C = T.crew
  return (
    <>
      <section className="lh-sec" id="ai">
        <div className="lh-split">
          <div className="lh-split-t lh-rv">
            <div className="lh-k"><LIc d={LI.spark} size={13} />{A.kick}</div>
            <h2>{A.title}</h2>
            <p>{A.text}</p>
            <ul className="lh-list">{A.list.map(x => <li key={x}><LIc d={LI.check} size={14} sw={2} />{x}</li>)}</ul>
            <a className="lh-btn" href="https://crm.lumiva.agency/" target="_blank" rel="noopener noreferrer">{A.btn}<LIc d={LI.arrow} size={14} sw={2} /></a>
          </div>
          <AgAIDemo T={T} />
        </div>
      </section>
      <section className="lh-sec">
        <AgHead k={C.kick} t={C.title} d={C.text} />
        <div className="lh-crew" style={{ paddingTop: 0 }}>
          {C.items.map((c, i) => {
            const pal = AI_ROLE_PALETTE[c.role] || AI_ROLE_PALETTE.lead_manager
            return (
              <div key={c.role} className="lh-crew-c lh-rv" style={{ transitionDelay: i * 0.08 + 's', '--pbg': pal.bg, '--pd': pal.d } as React.CSSProperties} {...tilt(5, 6)}>
                <div className="lh-crew-p">
                  <div className="lh-crew-bg" />
                  <div className="lh-crew-fig"><AiCharacter role={c.role} mood="on" /></div>
                  <span className="lh-crew-st"><i />{C.status}</span>
                </div>
                <div className="lh-crew-b">
                  <div className="lh-crew-nm">{c.name}</div>
                  <div className="lh-crew-job">{c.job}</div>
                  <div className="lh-doing"><span className="lh-think"><i /><i /><i /></span><LhDoing list={c.list} ms={2600 + i * 400} /></div>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </>
  )
}

/* ───────── Local (EN-only pages) ───────── */
function AgLocal({ T }: { T: T }) {
  const L = [
    ['/digital-marketing-agency-antalya', 'Digital Marketing Agency in Antalya', 'The full marketing stack for businesses based in or targeting Antalya.'],
    ['/seo-agency-antalya', 'SEO Agency in Antalya', 'Multilingual SEO in Turkish, English, and Russian for local and international brands.'],
    ['/web-development-antalya', 'Web Development in Antalya', 'Fast, SEO-ready websites and e-commerce built for the Turkish market.'],
    ['/crm-development-turkey', 'CRM Development in Turkey', 'Custom CRM systems integrated with local payment and booking platforms.'],
    ['/hotel-marketing-agency-turkey', 'Hotel Marketing Agency in Turkey', 'Direct booking growth for hotels and resorts across Antalya, Bodrum, and beyond.'],
  ]
  return (
    <section className="lh-sec" id="local">
      <AgHead k={'★ · ' + T.local.kick} t="Specialised for Antalya and Turkey" d="Deep dives into the services and industries we know best — written for businesses operating specifically in Antalya and across Turkey." />
      <div className="ag-loc">
        {L.map(([u, t, d], i) => (
          <Link key={u} to={u} className="lh-rv" style={{ transitionDelay: i * 0.06 + 's' }}>
            <span className="n">L/0{i + 1}<LIc d={LI.ne} size={14} /></span><b>{t}</b><p>{d}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}

/* ───────── Cases (pl2 CMS) ───────── */
type CaseItem = { id: number; slug: string; clientName?: string; industry?: string; shortResult?: string; resultValue?: string; tags?: string[]; coverUrl?: string }
const CASE_BG = ['#1f3a2f', '#2a2a4a', '#3a1f2f', '#1f2a3a', '#2f2a1f']

function AgCases() {
  const { t, i18n } = useTranslation()
  const { p } = useLangPath()
  const lang = agLang(i18n.language)
  const [cases, setCases] = useState<CaseItem[]>([])
  useEffect(() => {
    const base = 'https://pl2.lumiva.agency/api/cases?status=published&limit=3'
    fetch(`${base}&lang=${lang}`).then(r => r.json())
      .then(r => (r.items?.length ? r.items : fetch(base).then(x => x.json()).then(x => x.items || [])))
      .then(setCases).catch(() => {})
  }, [lang])
  return (
    <section className="lh-sec" id="cases">
      <AgHead k={t('home.sec02_tag').replace(/^(\d+)\s/, '$1 · ')} t={t('home.sec02_title')} d={t('home.sec02_sub')} />
      {cases.length > 0 && (
        <div className={'ag-cases' + (cases.length === 1 ? ' one' : '')} style={cases.length < 3 ? { gridTemplateColumns: cases.length === 1 ? 'minmax(0,1fr)' : '1.3fr 1fr' } : undefined}>
          {cases.map((c, i) => (
            <Link key={c.id} to={p(`/cases/${c.slug}`)} className="ag-case lh-rv" style={{ transitionDelay: i * 0.08 + 's' }} {...tilt(4, 5)}>
              <div className="ag-case-img" style={!c.coverUrl ? { background: CASE_BG[i % CASE_BG.length] } : undefined}>
                {c.coverUrl ? <img src={c.coverUrl} alt={c.clientName || ''} loading="lazy" /> : <span className="ph">{c.clientName?.[0] || 'L'}</span>}
                {(c.tags?.length || c.industry) && <span className="ag-chip">{c.tags?.length ? c.tags.slice(0, 2).join(' · ') : c.industry}</span>}
                {c.shortResult && <div className="ag-metric" style={{ animationDelay: i * 0.7 + 's' }}><b>{c.shortResult}</b>{c.resultValue && <span>{c.resultValue}</span>}</div>}
              </div>
              <div className="ag-case-b">
                <div><h3>{c.clientName}</h3><span>{c.industry}</span></div>
                <span className="ag-case-go"><LIc d={LI.ne} size={16} /></span>
              </div>
            </Link>
          ))}
        </div>
      )}
      <div className="lh-center lh-rv"><Link className="lh-btn gh" to={p('/cases')}>{t('home.all_works')}<LIc d={LI.ne} size={14} /></Link></div>
    </section>
  )
}

/* ───────── Numbers ───────── */
function AgNumbers() {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  const on = useInView(ref, true)
  const mono = { font: '10px var(--ff-mono)', fill: '#888' }
  return (
    <section className="lh-sec" id="numbers">
      <AgHead k={t('home.sec03_tag').replace(/^(\d+)\s/, '$1 · ')} t={t('home.sec03_title')} d={t('home.sec03_sub')} />
      <div className={'ag-nums' + (on ? ' in' : '')} ref={ref}>
        <div className="lh-card ag-num lh-rv"><span className="lh-k">P/01</span><b><Cnt to={142} on={on} /><em>+</em></b><p>{t('home.sec03_stat1_lbl')}</p>
          <svg viewBox="0 0 200 90" className="ag-gb" aria-hidden="true">{[22, 30, 40, 50, 62, 76, 90].map((h, k) => <rect key={k} x={k * 29} y={90 - h} width="22" height={h} rx="5" fill={k === 6 ? '#111113' : '#ececef'} style={{ transitionDelay: k * 0.07 + 's' }} />)}</svg></div>
        <div className="lh-card ag-num lh-rv" style={{ transitionDelay: '.06s' }}><span className="lh-k">P/02</span><b><em>×</em><Cnt to={4.8} dec={1} on={on} /></b><p>{t('home.sec03_stat2_lbl')}</p>
          <svg viewBox="0 0 200 90" aria-hidden="true"><path d="M0 82 C50 80,70 70,100 52 S160 14,200 6" fill="none" stroke="#ececef" strokeWidth="10" strokeLinecap="round" /><path className={'ag-drw' + (on ? ' in' : '')} pathLength={1} d="M0 82 C50 80,70 70,100 52 S160 14,200 6" fill="none" stroke="#111113" strokeWidth="2.4" strokeLinecap="round" /><circle cx="200" cy="6" r="5" fill="#c8f560" stroke="#111113" strokeWidth="2" style={{ opacity: on ? 1 : 0, transition: 'opacity .4s 2.3s' }} /></svg></div>
        <div className="lh-card ag-num lh-rv" style={{ transitionDelay: '.12s' }}><span className="lh-k">P/03</span><b>−<Cnt to={38} on={on} /><em>%</em></b><p>{t('home.sec03_stat3_lbl')}</p>
          <svg viewBox="0 0 200 90" className="ag-gb" aria-hidden="true"><rect x="10" y="4" width="76" height="76" rx="8" fill="#ececef" /><rect x="114" y="33" width="76" height="47" rx="8" fill="#111113" style={{ transitionDelay: '.35s' }} /><text x="48" y="90" textAnchor="middle" style={mono}>BEFORE</text><text x="152" y="90" textAnchor="middle" style={mono}>AFTER</text></svg></div>
        <div className="lh-card ag-num dk lh-rv" style={{ transitionDelay: '.18s' }}><span className="lh-k" style={{ color: '#8a8a90' }}>P/04</span><b><Cnt to={9.4} dec={1} on={on} /><em>/10</em></b><p>{t('home.sec03_stat4_lbl')}</p>
          <svg viewBox="0 0 200 90" aria-hidden="true"><path d="M30 86 A70 70 0 0 1 170 86" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="10" strokeLinecap="round" /><path pathLength={1} d="M30 86 A70 70 0 0 1 170 86" fill="none" stroke="#c8f560" strokeWidth="10" strokeLinecap="round" style={{ strokeDasharray: 1, strokeDashoffset: on ? 0.06 : 1, transition: 'stroke-dashoffset 2s .3s cubic-bezier(.4,0,.2,1)' }} /></svg></div>
      </div>
    </section>
  )
}

/* ───────── Process ───────── */
function AgProcess({ T }: { T: T }) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  const vis = useInView(ref)
  const [i, setI] = useState(0)
  const W = T.procW
  useEffect(() => {
    if (!vis) return
    const tm = setTimeout(() => setI(x => (x + 1) % 4), 5000)
    return () => clearTimeout(tm)
  }, [i, vis])
  const P = [1, 2, 3, 4].map(n => [t(`home.proc0${n}_title`), t(`home.proc0${n}_text`)])
  return (
    <section className="lh-sec" id="process">
      <AgHead k={t('home.sec04_tag').replace(/^(\d+)\s/, '$1 · ')} t={t('home.sec04_title')} d={t('home.sec04_sub')} />
      <div className="lh-card ag-proc lh-rv" ref={ref}>
        <div className="lh-steps">
          <div className="lh-steps-line"><span style={{ width: (i / 3) * 100 + '%' }} /></div>
          {P.map(([tt], k) => (
            <button type="button" key={k} className={'lh-step' + (k < i ? ' done' : '') + (k === i ? ' cur' : '')} onClick={() => setI(k)}>
              <span className="lh-step-c">{k < i ? <LIc d={LI.check} size={16} sw={2.4} /> : '0' + (k + 1)}</span>
              <b>{tt}</b><em>{W[k]}</em>
            </button>
          ))}
        </div>
        <div className="ag-proc-d" key={i}>
          <b>0{i + 1}</b>
          <div><h3>{P[i][0]}</h3><p>{P[i][1]}</p></div>
          <svg className="ag-ring" viewBox="0 0 40 40" aria-hidden="true"><circle className="t" cx="20" cy="20" r="18" />{vis && <circle className="v" cx="20" cy="20" r="18" />}</svg>
        </div>
      </div>
    </section>
  )
}

/* ───────── Manifesto ───────── */
function AgManifesto() {
  const { t } = useTranslation()
  const q = t('home.manif_text').split(' ')
  const ref = useRef<HTMLParagraphElement>(null)
  const [lit, setLit] = useState(0)
  useEffect(() => {
    const f = () => {
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight
      const pr = Math.max(0, Math.min(1, (vh * 0.85 - r.top) / (r.height + vh * 0.3)))
      setLit(Math.round(pr * q.length))
    }
    f()
    window.addEventListener('scroll', f, { passive: true })
    return () => window.removeEventListener('scroll', f)
  }, [q.length])
  return (
    <section className="ag-mani" id="manifesto">
      <div className="lh-glow" />
      <div className="ag-mani-in">
        <div className="lh-k">{t('home.sec05_tag').replace(/^(\d+)\s/, '$1 · ')}</div>
        <p className="ag-mani-q" ref={ref}>
          {q.map((w, k) => <Fragment key={k}><span className={(k < lit ? 'lit' : '') + (/[.!]$/.test(w) ? ' k' : '')}>{w}</span>{' '}</Fragment>)}
        </p>
        <div className="ag-prin">
          {[1, 2, 3].map(n => (
            <div key={n} className="lh-rv" style={{ transitionDelay: (n - 1) * 0.08 + 's' }}>
              <span className="n">0{n}</span><h4>{t(`home.manif0${n}_title`)}</h4><p>{t(`home.manif0${n}_text`)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ───────── Team ───────── */
const TEAM = [
  { ini: 'AK', tag: 'CEO', bg: '#e9f5d0', orb: '#c8f560' },
  { ini: 'MS', tag: 'CD', bg: '#e6ecff', orb: '#9db7ff' },
  { ini: 'DN', tag: 'Perf', bg: '#fff0d6', orb: '#ffc670' },
  { ini: 'EV', tag: 'Data', bg: '#efe6ff', orb: '#c4a8ff' },
]
function AgTeam() {
  const { t } = useTranslation()
  return (
    <section className="lh-sec" id="team">
      <AgHead k={t('home.sec06_tag').replace(/^(\d+)\s/, '$1 · ')} t={t('home.sec06_title')} d={t('home.sec06_sub')} />
      <div className="lh-crew ag-team">
        {TEAM.map((m, i) => (
          <div key={m.ini} className="lh-crew-c lh-rv" style={{ transitionDelay: i * 0.08 + 's', '--pbg': m.bg, '--pd': m.orb } as React.CSSProperties} {...tilt(4, 5)}>
            <div className="lh-crew-p">
              <div className="lh-crew-bg">
                <i style={{ width: 140, height: 140, left: '12%', top: '18%', background: `radial-gradient(circle, ${m.orb}, transparent 70%)`, animationDelay: i * 1.3 + 's' }} />
                <i style={{ width: 90, height: 90, right: '10%', bottom: '8%', background: 'radial-gradient(circle, rgba(255,255,255,.9), transparent 70%)', animationDelay: i * 0.7 + 's' }} />
              </div>
              <span className="ag-ini" aria-hidden="true">{m.ini}</span>
              <span className="lh-crew-st"><i />{m.tag}</span>
              <span className="ag-ini-b" aria-hidden="true">{m.ini}</span>
            </div>
            <div className="lh-crew-b">
              <div className="lh-crew-nm">{t(`home.team${i + 1}_name`)}</div>
              <div className="lh-crew-job" style={{ minHeight: 0 }}>{t(`home.team${i + 1}_role`)}</div>
              <p>{t(`home.team${i + 1}_bio`)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ───────── Testimonials ───────── */
function AgQuotes() {
  const { t } = useTranslation()
  const [i, setI] = useState(0)
  const Q = [['IS', 1], ['AB', 2], ['RG', 3]] as const
  useEffect(() => {
    const tm = setTimeout(() => setI(x => (x + 1) % 3), 7000)
    return () => clearTimeout(tm)
  }, [i])
  return (
    <section className="lh-sec" id="testimonials">
      <AgHead k={t('home.sec07_tag').replace(/^(\d+)\s/, '$1 · ')} t={t('home.sec07_title')} />
      <div className="ag-tst lh-rv">
        <blockquote key={i}>{t(`home.test${Q[i][1]}_text`)}</blockquote>
        <div className="ag-tst-l">
          {Q.map(([a, n], k) => (
            <button type="button" key={a} className={k === i ? 'on' : ''} onClick={() => setI(k)}>
              <span className="av">{a}</span>
              <span><b>{t(`home.test${n}_name`)}</b><small>{t(`home.test${n}_role`)}</small></span>
              <span className="bar" key={k === i ? 'on' + i : 'off'} />
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ───────── Awards ───────── */
function AgAwards() {
  const { t } = useTranslation()
  return (
    <section className="lh-sec" id="awards">
      <AgHead k={t('home.sec08_tag').replace(/^(\d+)\s/, '$1 · ')} t={t('home.sec08_title')} />
      <div className="ag-aw lh-rv">
        {[1, 2, 3, 4, 5, 6].map(n => (
          <div key={n}>
            <span className="y">{t(`home.award${n}_year`)}</span>
            <span className="m"><LIc d={LI.award} size={18} /></span>
            <b>{t(`home.award${n}_name`)}</b>
            <span>{t(`home.award${n}_result`)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ───────── FAQ ───────── */
function AgFaq() {
  const { t } = useTranslation()
  const [o, setO] = useState(0)
  return (
    <section className="lh-sec" id="faq">
      <AgHead k={t('home.sec09_tag').replace(/^(\d+)\s/, '$1 · ')} t={t('home.sec09_title')} />
      <div className="ag-faq" id="faqList">
        {[1, 2, 3, 4, 5].map((n, k) => (
          <div key={n} className="lh-rv"><div className={'it' + (o === k ? ' open' : '')}>
            <button type="button" className="q" onClick={() => setO(o === k ? -1 : k)} aria-expanded={o === k}>
              <span className="n">[0{n}]</span><span>{t(`home.faq${n}_q`)}</span><span className="pm" />
            </button>
            <div className="a"><div><p>{t(`home.faq${n}_a`)}</p></div></div>
          </div></div>
        ))}
      </div>
    </section>
  )
}

/* ───────── Blog ───────── */
type Post = { slug: string; title?: string; excerpt?: string; coverUrl?: string; category?: string; readMin?: number }
function AgPosts() {
  const { t, i18n } = useTranslation()
  const { p } = useLangPath()
  const lang = agLang(i18n.language)
  const [posts, setPosts] = useState<Post[]>([])
  useEffect(() => {
    fetch(`https://pl2.lumiva.agency/api/blog?status=published&limit=3&lang=${lang}`)
      .then(r => r.json()).then(r => setPosts(r.items || [])).catch(() => {})
  }, [lang])
  if (!posts.length) return null
  return (
    <section className="lh-sec" id="blog">
      <AgHead k={'10 · ' + t('home.sec10_tag')} t={t('home.sec10_title')} />
      <div className="ag-posts">
        {posts.map((x, i) => (
          <Link key={x.slug} to={p(`/blog/${x.slug}`)} className="ag-post lh-rv" style={{ transitionDelay: i * 0.08 + 's' }}>
            <div className="ag-post-img">{x.coverUrl ? <img src={x.coverUrl} alt={x.title || ''} loading="lazy" /> : <span className="ph">{x.title?.[0] || 'L'}</span>}</div>
            <div className="ag-post-b">
              <h3>{x.title}</h3>
              {x.excerpt && <p>{x.excerpt}</p>}
              <div className="ag-post-m"><span>{x.category || ''}</span><span>{x.readMin ? `${x.readMin} min` : ''}</span></div>
            </div>
          </Link>
        ))}
      </div>
      <div className="lh-center lh-rv"><Link className="lh-btn gh" to={p('/blog')}>{t('blog.all')}<LIc d={LI.ne} size={14} /></Link></div>
    </section>
  )
}

/* ───────── Contact ───────── */
function AgContact({ T }: { T: T }) {
  const { t } = useTranslation()
  const { p } = useLangPath()
  const B = [1, 2, 3, 4].map(n => t(`contact_modal.budget_opt${n}`))
  const [b, setB] = useState<number | null>(null)
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'err'>('idle')

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const src = buildContactSource({ block: 'Contact section', button: t('home.form_submit'), utmMedium: 'home-contact', utmContent: 'contact-section' })
    setState('busy')
    try {
      const r = await fetch(CONTACT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...Object.fromEntries(fd), budget: b != null ? B[b] : '', type: 'contact', source: src.source, notes: src.notes }),
      })
      if (!r.ok) throw new Error(String(r.status))
      trackEvent('contact_form_submit', { page_path: window.location.pathname, source_block: src.source })
      setState('sent')
    } catch {
      setState('err')
    }
  }

  return (
    <section className="ag-ct" id="contact">
      <div className="lh-glow b" />
      <div className="ag-ct-in">
        <div className="lh-rv">
          <div className="lh-k">{T.contact.kick}</div>
          <h2>{(() => { const s = t('home.cta_title'); const c = s.lastIndexOf(' '); return c > 0 ? <>{s.slice(0, c)} <span className="ag-grad">{s.slice(c + 1)}</span></> : s })()}</h2>
          <p className="ag-ct-p">{t('home.cta_sub')}</p>
          <div className="ag-facts">
            <div><div className="lh-k">{t('common.response_time')}</div><b>{t('common.response_val')}</b></div>
            <div><div className="lh-k">{t('common.slots_q3')}</div><b>{t('common.slots_val')}</b><div className="ag-slots">{Array.from({ length: 12 }, (_, k) => <i key={k} className={k >= 9 ? 'f' : ''} />)}</div></div>
            <div><div className="lh-k">{t('home.cta_email')}</div><b><a href="mailto:vlad@lumiva.agency">vlad@lumiva.agency</a></b></div>
            <div><div className="lh-k">{t('home.cta_phone')}</div><b><a href="tel:+905383659678">+90 538 365 96 78</a></b></div>
          </div>
        </div>
        <form className="ag-form lh-rv" onSubmit={submit}>
          <h3>{t('home.cta_form_title')}</h3>
          <p>{t('home.cta_form_sub')}</p>
          {state === 'sent' ? (
            <div className="lh-ok"><LIc d={LI.check} size={16} sw={2.4} />{t('home.form_sent_text')}</div>
          ) : (
            <>
              <div className="f2">
                <label className="lh-fld"><input name="name" placeholder={t('home.form_name')} required aria-label={t('home.form_name')} /></label>
                <label className="lh-fld"><input name="company" placeholder={t('home.form_company')} aria-label={t('home.form_company')} /></label>
              </div>
              <label className="lh-fld"><LIc d={LI.mail} size={16} /><input type="email" name="email" placeholder={t('home.form_email')} required aria-label={t('home.form_email')} /></label>
              <label className="lh-fld ta"><textarea name="message" placeholder={t('home.form_task')} aria-label={t('contact_modal.message')} /></label>
              <span className="lab">{t('contact_modal.budget')}</span>
              <div className="ag-bud">{B.map((x, k) => <button type="button" key={x} className={k === b ? 'on' : ''} onClick={() => setB(k === b ? null : k)}>{x}</button>)}</div>
              {state === 'err' && <div className="lh-err">{T.contact.err}</div>}
              <button className="lh-btn lg block" type="submit" disabled={state === 'busy'}>{state === 'busy' ? T.contact.sending : t('home.form_submit')}<LIc d={LI.ne} size={15} sw={2} /></button>
            </>
          )}
          <Link className="priv" to={p('/privacy-policy')}>{t('footer.privacy')}</Link>
        </form>
      </div>
    </section>
  )
}

export default function HomePage() {
  const { t, i18n } = useTranslation()
  const { p } = useLangPath()
  const lang = agLang(i18n.language)
  const T = AG_TEXT[lang]

  return (
    <>
      <PageSEO
        title={t('home.seo_title')}
        description={t('home.seo_desc')}
        path={p('/')}
        noSuffix
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'Lumiva Agency',
            url: 'https://lumiva.agency/',
            logo: 'https://lumiva.agency/favicon.svg',
            telephone: '+90 538 365 96 78',
            contactPoint: { '@type': 'ContactPoint', telephone: '+90-538-365-96-78', contactType: 'customer service', availableLanguage: ['Russian', 'English', 'Turkish'] },
            sameAs: ['https://t.me/lumiva', 'https://linkedin.com/company/lumiva'],
            address: { '@type': 'PostalAddress', addressLocality: 'Antalya', addressCountry: 'TR' },
          },
          {
            '@context': 'https://schema.org',
            '@type': 'LocalBusiness',
            name: 'Lumiva Agency',
            url: 'https://lumiva.agency/',
            image: 'https://lumiva.agency/og-image.svg',
            logo: 'https://lumiva.agency/favicon.svg',
            telephone: '+90-538-365-96-78',
            email: 'vlad@lumiva.agency',
            address: { '@type': 'PostalAddress', addressLocality: 'Antalya', addressCountry: 'TR' },
            areaServed: [
              { '@type': 'City', name: 'Antalya' },
              { '@type': 'Country', name: 'Turkey' },
              { '@type': 'Continent', name: 'Europe' },
            ],
            sameAs: ['https://t.me/lumiva', 'https://linkedin.com/company/lumiva'],
            priceRange: '€€€',
          },
          {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'Lumiva Agency',
            url: 'https://lumiva.agency/',
            potentialAction: { '@type': 'SearchAction', target: 'https://lumiva.agency/blog?q={search_term_string}', 'query-input': 'required name=search_term_string' },
          },
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [1, 2, 3, 4, 5].map(n => ({ '@type': 'Question', name: t(`home.faq${n}_q`), acceptedAnswer: { '@type': 'Answer', text: t(`home.faq${n}_a`) } })),
          },
        ]}
      />
      <main className="lh">
        <AgHero T={T} />
        <AgLogos T={T} />
        <AgServices />
        <AgAI T={T} />
        {lang === 'en' && <AgLocal T={T} />}
        <AgCases />
        <AgNumbers />
        <AgProcess T={T} />
        <AgManifesto />
        <AgTeam />
        <AgQuotes />
        <AgAwards />
        <AgFaq />
        <AgPosts />
        <AgContact T={T} />
      </main>
    </>
  )
}
