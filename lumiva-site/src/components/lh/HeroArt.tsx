/* Анимированные иллюстрации в шапке внутренних страниц (по разделу). Чисто декоративные (aria-hidden),
 * монтируются порталом в `.page-hero .wrap` после рендера страницы — сами страницы не меняются.
 * Цифры внутри — пример интерфейса, подписано «example» в адресной строке. */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LIc, LI } from './kit'
import { agLang, type AgLang } from './agText'

type Kind = 'hub' | 'seo' | 'perf' | 'analytics' | 'design' | 'dev' | 'content' | 'smm' | 'strategy' | 'crm' | 'hotel'

export function artKind(path: string): Kind | null {
  const p = path.replace(/^\/(ru|tr)(?=\/|$)/, '').replace(/\/+$/, '') || '/'
  if (p === '/services') return 'hub'
  if (p.startsWith('/services/seo') || p === '/seo-agency-antalya') return 'seo'
  if (p.startsWith('/services/performance') || p === '/digital-marketing-agency-antalya') return 'perf'
  if (p.startsWith('/services/analytics')) return 'analytics'
  if (p.startsWith('/services/design')) return 'design'
  if (p.startsWith('/services/development') || p === '/web-development-antalya') return 'dev'
  if (p.startsWith('/services/content')) return 'content'
  if (p.startsWith('/services/smm')) return 'smm'
  if (p.startsWith('/services/strategy')) return 'strategy'
  if (p === '/crm-development-turkey') return 'crm'
  if (p === '/hotel-marketing-agency-turkey') return 'hotel'
  return null
}

const EX: Record<AgLang, string> = { en: 'example', ru: 'пример', tr: 'örnek' }

function useTick(ms: number, n: number) {
  const [i, setI] = useState(0)
  useEffect(() => { const t = setInterval(() => setI(x => (x + 1) % n), ms); return () => clearInterval(t) }, [ms, n])
  return i
}

function Shell({ url, lang, children, fl }: { url: string; lang: AgLang; children: ReactNode; fl?: ReactNode }) {
  return (
    <>
      <div className="v2-art-shot">
        <div className="lh-chrome"><i /><i /><i /><span>{url}</span><em>{EX[lang]}</em></div>
        <div className="v2-art-b">{children}</div>
      </div>
      {fl}
    </>
  )
}

const Fl = ({ c, icon, b, s, ok }: { c: string; icon: ReactNode; b: string; s: string; ok?: boolean }) => (
  <div className={'lh-fl v2-fl ' + c}>
    <div className={ok ? 'lh-fl-ok' : 'lh-fl-ic'}><LIc d={icon} size={15} sw={ok ? 2.4 : 1.8} /></div>
    <div><b>{b}</b><span>{s}</span></div>
  </div>
)

/* ── SEO: позиция сайта в выдаче растёт ── */
const SEO_Q: Record<AgLang, string> = { en: 'digital marketing agency antalya', ru: 'маркетинговое агентство анталья', tr: 'antalya dijital pazarlama ajansı' }
function ArtSeo({ lang }: { lang: AgLang }) {
  const step = useTick(1500, 8)
  const pos = Math.max(1, 5 - step)
  const others = ['competitor-one.com', 'listing-site.com', 'old-agency.net', 'directory.io']
  const rows: { d: string; me?: boolean }[] = others.map(d => ({ d }))
  rows.splice(pos - 1, 0, { d: 'lumiva.agency', me: true })
  const q = SEO_Q[lang]
  const typed = Math.min(q.length, Math.round(((step + 1) / 3) * q.length))
  return (
    <Shell url="search · serp-tracker" lang={lang}
      fl={<><Fl c="a" icon={LI.trend} b={lang === 'ru' ? 'Органика ↑' : lang === 'tr' ? 'Organik ↑' : 'Organic ↑'} s="Search Console" /><Fl c="b" ok icon={LI.check} b={'#' + pos} s={lang === 'ru' ? 'позиция по запросу' : lang === 'tr' ? 'sorgu sırası' : 'position for query'} /></>}>
      <div className="v2-seo">
        <div className="v2-seo-l">
          <div className="v2-q"><LIc d={LI.search} size={14} /><span>{q.slice(0, typed)}<i className="lh-caret" /></span></div>
          <div className="v2-serp">
            {rows.map((r, i) => (
              <div key={r.d} className={'v2-res' + (r.me ? ' me' : '')} style={{ transform: `translateY(${i * 100}%)` }}>
                <span className="p">{i + 1}</span>
                <div><b>{r.me ? 'Lumiva Agency — Strategy, SEO, Performance' : r.d.split('.')[0].replace('-', ' ')}</b><u>{r.d}</u></div>
              </div>
            ))}
          </div>
        </div>
        <div className="v2-seo-r">
          <span className="lh-k">{lang === 'ru' ? 'Клики · 12 мес' : lang === 'tr' ? 'Tıklamalar · 12 ay' : 'Clicks · 12 mo'}</span>
          <svg viewBox="0 0 300 140" preserveAspectRatio="none" className="v2-area">
            <defs><linearGradient id="v2g1" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#9fdc3c" stopOpacity=".45" /><stop offset="1" stopColor="#9fdc3c" stopOpacity="0" /></linearGradient></defs>
            <path className="fill" d="M0 130 L0 118 C40 116 60 110 90 100 S150 84 180 64 S250 26 300 12 L300 130Z" fill="url(#v2g1)" />
            <path className="ln v2-drw" pathLength={1} d="M0 118 C40 116 60 110 90 100 S150 84 180 64 S250 26 300 12" />
          </svg>
          <div className="v2-kw">{['Top 3', 'Top 10', 'CWV'].map((k, i) => <span key={k} style={{ animationDelay: i * 0.4 + 's' }}><i />{k}</span>)}</div>
        </div>
      </div>
    </Shell>
  )
}

/* ── Performance: кампании и бюджеты ── */
function ArtPerf({ lang }: { lang: AgLang }) {
  const t = useTick(2200, 4)
  const C = [['Google Ads', 72, 3.4], ['Meta Ads', 58, 2.9], ['Yandex Direct', 41, 2.2], ['YouTube', 26, 1.8]] as const
  const L = lang === 'ru' ? ['Кампания', 'Бюджет', 'ROAS'] : lang === 'tr' ? ['Kampanya', 'Bütçe', 'ROAS'] : ['Campaign', 'Budget', 'ROAS']
  return (
    <Shell url="ads · campaigns" lang={lang}
      fl={<><Fl c="a" icon={LI.trend} b="ROAS ↑" s={lang === 'ru' ? 'бюджет в лучшую кампанию' : lang === 'tr' ? 'bütçe en iyi kampanyaya' : 'budget to best campaign'} /><Fl c="b" ok icon={LI.check} b="CPA ↓" s={lang === 'ru' ? 'после оптимизации' : lang === 'tr' ? 'optimizasyon sonrası' : 'after optimisation'} /></>}>
      <div className="v2-perf">
        <div className="v2-tbl">
          <div className="h"><span>{L[0]}</span><span>{L[1]}</span><span>{L[2]}</span></div>
          {C.map(([n, w, r], i) => {
            const ww = Math.max(12, Math.min(92, w + (((t + i) % 4) - 1.5) * 6))
            return (
              <div key={n} className="r" style={{ animationDelay: i * 0.12 + 's' }}>
                <span><i className={'dot d' + i} />{n}</span>
                <span className="bar"><i style={{ width: ww + '%' }} /></span>
                <b className={r > 2.5 ? 'up' : ''}>×{(r + ((t + i) % 3) * 0.1).toFixed(1)}</b>
              </div>
            )
          })}
        </div>
        <div className="v2-perf-ch">
          <span className="lh-k">{lang === 'ru' ? 'Выручка vs расход' : lang === 'tr' ? 'Gelir vs harcama' : 'Revenue vs spend'}</span>
          <svg viewBox="0 0 300 150" preserveAspectRatio="none">
            {[0, 1, 2, 3].map(k => <line key={k} x1="0" x2="300" y1={20 + k * 40} y2={20 + k * 40} className="g" />)}
            <path className="ln2" d="M0 120 L60 112 L120 108 L180 100 L240 96 L300 90" />
            <path className="ln v2-drw" pathLength={1} d="M0 124 L60 104 L120 92 L180 66 L240 48 L300 22" />
          </svg>
        </div>
      </div>
    </Shell>
  )
}

/* ── Analytics: воронка + KPI ── */
function ArtAnalytics({ lang }: { lang: AgLang }) {
  const t = useTick(2600, 3)
  const F = lang === 'ru' ? ['Визиты', 'Лиды', 'Сделки', 'Выручка'] : lang === 'tr' ? ['Ziyaret', 'Lead', 'Satış', 'Gelir'] : ['Visits', 'Leads', 'Deals', 'Revenue']
  const W = [[100, 46, 22, 14], [100, 52, 27, 17], [100, 49, 25, 16]][t]
  return (
    <Shell url="analytics · dashboard" lang={lang}
      fl={<><Fl c="a" icon={LI.chart} b="GA4 + CRM" s={lang === 'ru' ? 'сквозная аналитика' : lang === 'tr' ? 'uçtan uca analitik' : 'end-to-end analytics'} /><Fl c="b" ok icon={LI.check} b={lang === 'ru' ? 'Отчёт готов' : lang === 'tr' ? 'Rapor hazır' : 'Report ready'} s="Looker Studio" /></>}>
      <div className="v2-an">
        <div className="v2-fun">
          {F.map((f, i) => <div key={f}><span>{f}</span><i><b style={{ width: W[i] + '%' }} /></i><em>{W[i]}%</em></div>)}
        </div>
        <div className="v2-donut">
          <svg viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="44" className="t" />
            {[[0.38, '#111113', 0], [0.27, '#9fdc3c', 0.38], [0.2, '#6e9fff', 0.65], [0.15, '#d4d4d8', 0.85]].map(([v, c, o], i) => (
              <circle key={i} cx="60" cy="60" r="44" pathLength={1} stroke={c as string} style={{ strokeDasharray: `${(v as number) - 0.012} 1`, strokeDashoffset: -(o as number) }} />
            ))}
          </svg>
          <div><b>4</b><span>{lang === 'ru' ? 'канала' : lang === 'tr' ? 'kanal' : 'channels'}</span></div>
        </div>
      </div>
    </Shell>
  )
}

/* ── Design: бренд-борд ── */
function ArtDesign({ lang }: { lang: AgLang }) {
  const t = useTick(1800, 4)
  const PAL = [['#111113', '#c8f560', '#f4f4f5', '#6e9fff', '#ff8a5b'], ['#1f3a2f', '#e9f5d0', '#f6f3ec', '#3f7d12', '#ffc670'], ['#2a2a4a', '#9db7ff', '#efe6ff', '#c4a8ff', '#111113'], ['#3a1f2f', '#ffd7ea', '#fff0d6', '#e2458f', '#111113']][t]
  return (
    <Shell url="brand · guidelines.pdf" lang={lang}
      fl={<><Fl c="a" icon={LI.pen} b={lang === 'ru' ? 'Логотип v3' : lang === 'tr' ? 'Logo v3' : 'Logo v3'} s={lang === 'ru' ? 'на согласовании' : lang === 'tr' ? 'onayda' : 'in review'} /><Fl c="b" ok icon={LI.check} b="Brandbook" s={lang === 'ru' ? '48 страниц' : lang === 'tr' ? '48 sayfa' : '48 pages'} /></>}>
      <div className="v2-ds">
        <div className="v2-aa" style={{ fontWeight: [400, 500, 600, 700][t] }}>Aa<span>Inter Tight · {[400, 500, 600, 700][t]}</span></div>
        <div className="v2-mark"><i className={'m' + t} /><i className={'m' + ((t + 1) % 4)} /><i className={'m' + ((t + 2) % 4)} /><i className={'m' + ((t + 3) % 4)} /></div>
        <div className="v2-pal">{PAL.map((c, i) => <span key={i} style={{ background: c, transitionDelay: i * 0.06 + 's' }}><em>{c}</em></span>)}</div>
        <div className="v2-scale">{[34, 24, 17, 13].map((s, i) => <span key={s} style={{ fontSize: s, animationDelay: i * 0.15 + 's' }}>{['Display', 'Heading', 'Body text', 'Caption'][i]}<em>{s}px</em></span>)}</div>
      </div>
    </Shell>
  )
}

/* ── Development: код + превью + Lighthouse ── */
const CODE = [
  ['k', 'export default', ' function ', 'f', 'Hero', '() {'],
  ['', '  return (', '', '', '', ''],
  ['t', '    <section', ' className=', 's', '"hero"', '>'],
  ['t', '      <h1>', 'Book direct', '', '', '</h1>'],
  ['t', '      <Button', ' size=', 's', '"lg"', ' />'],
  ['t', '    </section>', '', '', '', ''],
  ['', '  )', '', '', '', ''],
  ['', '}', '', '', '', ''],
]
function ArtDev({ lang }: { lang: AgLang }) {
  const n = useTick(500, CODE.length + 6)
  const shown = Math.min(CODE.length, n)
  return (
    <Shell url="app · hero.tsx" lang={lang}
      fl={<><Fl c="a" icon={LI.web} b="Next.js · React" s="TypeScript" /><Fl c="b" ok icon={LI.check} b="Lighthouse 100" s="Core Web Vitals" /></>}>
      <div className="v2-dev">
        <pre className="v2-code">{CODE.slice(0, shown).map((l, i) => (
          <div key={i}><em>{String(i + 1).padStart(2, ' ')}</em><span className={l[0]}>{l[1]}</span>{l[2]}<span className={l[3]}>{l[4]}</span>{l[5]}{i === shown - 1 && <i className="lh-caret" />}</div>
        ))}</pre>
        <div className="v2-prev">
          <div className="bar"><i /><i /><i /></div>
          <div className={'blk' + (shown > 2 ? ' on' : '')}><b /><b className="s" /></div>
          <div className={'h1' + (shown > 3 ? ' on' : '')}>Book direct</div>
          <div className={'btn' + (shown > 4 ? ' on' : '')} />
          <div className="lhx">{['Perf', 'A11y', 'BP', 'SEO'].map((k, i) => (
            <span key={k}><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" className="t" /><circle cx="18" cy="18" r="15" className={'v' + (shown >= CODE.length ? ' on' : '')} style={{ transitionDelay: i * 0.15 + 's' }} /></svg><b>{shown >= CODE.length ? 100 : '–'}</b><em>{k}</em></span>
          ))}</div>
        </div>
      </div>
    </Shell>
  )
}

/* ── Content: монтажный таймлайн ── */
function ArtContent({ lang }: { lang: AgLang }) {
  const T = lang === 'ru' ? ['Видео', 'Моушн', 'Звук'] : lang === 'tr' ? ['Video', 'Motion', 'Ses'] : ['Video', 'Motion', 'Audio']
  return (
    <Shell url="studio · edit-v4" lang={lang}
      fl={<><Fl c="a" icon={LI.cam} b="4K · 24 fps" s={lang === 'ru' ? 'съёмка in-house' : lang === 'tr' ? 'şirket içi çekim' : 'shot in-house'} /><Fl c="b" ok icon={LI.check} b={lang === 'ru' ? 'Рендер готов' : lang === 'tr' ? 'Render hazır' : 'Render ready'} s="Reels · Shorts · 16:9" /></>}>
      <div className="v2-ct">
        <div className="v2-scene"><i /><i /><i /><span>00:{'12'}:08</span></div>
        <div className="v2-tl">
          <div className="ph" />
          {T.map((tr, k) => (
            <div key={tr} className="trk"><span>{tr}</span><div>
              {k < 2 ? [[2, 22], [26, 30], [58, 18], [78, 20]].map(([l, w], i) => <i key={i} className={'c c' + ((i + k) % 3)} style={{ left: l + '%', width: w + '%' }} />)
                : <div className="wave">{Array.from({ length: 48 }, (_, i) => <b key={i} style={{ animationDelay: (i % 12) * 0.08 + 's', height: 20 + ((i * 37) % 70) + '%' }} />)}</div>}
            </div></div>
          ))}
        </div>
      </div>
    </Shell>
  )
}

/* ── SMM: лента постов ── */
function ArtSmm({ lang }: { lang: AgLang }) {
  const t = useTick(900, 1000)
  const P = [['#ffe1d2', '#ff6a33'], ['#dbe5ff', '#3a6ff0'], ['#e6f4c2', '#6f9a0c']]
  return (
    <Shell url="social · content-plan" lang={lang}
      fl={<><Fl c="a" icon={LI.users} b="Instagram · Telegram" s="YouTube · TikTok" /><Fl c="b" ok icon={LI.check} b={lang === 'ru' ? 'Пост опубликован' : lang === 'tr' ? 'Gönderi yayında' : 'Post published'} s={lang === 'ru' ? 'по контент-плану' : lang === 'tr' ? 'içerik planına göre' : 'per content plan'} /></>}>
      <div className="v2-smm">
        {P.map(([bg, c], i) => (
          <div key={i} className="post" style={{ '--pb': bg, '--pc': c, animationDelay: i * 0.6 + 's' } as React.CSSProperties}>
            <div className="hd"><span className="av" /><b /><i /></div>
            <div className="img"><span /><span /><span /></div>
            <div className="ft">
              <span className="lk">♥ {(1200 + i * 830 + ((t * (7 + i * 3)) % 400)).toLocaleString('en-US')}</span>
              <span>{['💬', '↗', '⌁'][i]} {80 + i * 41 + (t % 9)}</span>
            </div>
            {t % 3 === i && <i className="heart" key={t}>♥</i>}
          </div>
        ))}
      </div>
    </Shell>
  )
}

/* ── Strategy: карта позиционирования ── */
function ArtStrategy({ lang }: { lang: AgLang }) {
  const t = useTick(2400, 3)
  const ax = lang === 'ru' ? ['Цена', 'Сервис', 'Масс', 'Премиум'] : lang === 'tr' ? ['Fiyat', 'Hizmet', 'Kitle', 'Premium'] : ['Price', 'Service', 'Mass', 'Premium']
  const you = [[30, 70], [55, 40], [76, 22]][t]
  return (
    <Shell url="strategy · positioning-map" lang={lang}
      fl={<><Fl c="a" icon={LI.target} b="JTBD · CJM" s={lang === 'ru' ? '12 интервью с клиентами' : lang === 'tr' ? '12 müşteri görüşmesi' : '12 customer interviews'} /><Fl c="b" ok icon={LI.check} b={lang === 'ru' ? 'Свободная ниша' : lang === 'tr' ? 'Boş niş' : 'White space'} s={lang === 'ru' ? 'найдена' : lang === 'tr' ? 'bulundu' : 'found'} /></>}>
      <div className="v2-st">
        <div className="v2-map">
          <span className="ax x">{ax[2]} ← → {ax[3]}</span><span className="ax y">{ax[0]} ↕ {ax[1]}</span>
          {[[20, 30], [34, 58], [62, 64], [48, 76], [24, 82]].map(([x, y], i) => <i key={i} className="c" style={{ left: x + '%', top: y + '%', animationDelay: i * 0.3 + 's' }} />)}
          <b className="you" style={{ left: you[0] + '%', top: you[1] + '%' }}><span>You</span></b>
          <svg className="ring" viewBox="0 0 100 100" preserveAspectRatio="none"><ellipse cx="76" cy="22" rx="14" ry="14" /></svg>
        </div>
        <div className="v2-notes">
          {(lang === 'ru' ? ['Когда я выбираю отель, я хочу…', 'Боль: не доверяю отзывам', 'Триггер: сравнение цен'] : lang === 'tr' ? ['Otel seçerken istiyorum ki…', 'Sorun: yorumlara güvenmiyorum', 'Tetikleyici: fiyat karşılaştırma'] : ['When I choose a hotel, I want to…', 'Pain: I don’t trust reviews', 'Trigger: price comparison']).map((n, i) => (
            <span key={n} className={'n' + i} style={{ animationDelay: i * 0.25 + 's' }}>{n}</span>
          ))}
        </div>
      </div>
    </Shell>
  )
}

/* ── Services hub: орбита услуг ── */
function ArtHub({ lang }: { lang: AgLang }) {
  const S = lang === 'ru' ? ['Стратегия', 'Бренд', 'Реклама', 'Сайты', 'Контент', 'SMM', 'SEO', 'CRM'] : lang === 'tr' ? ['Strateji', 'Marka', 'Reklam', 'Web', 'İçerik', 'SMM', 'SEO', 'CRM'] : ['Strategy', 'Brand', 'Ads', 'Web', 'Content', 'SMM', 'SEO', 'CRM']
  const IC = [LI.target, LI.pen, LI.trend, LI.web, LI.cam, LI.users, LI.search, LI.flow]
  const on = useTick(900, 8)
  return (
    <div className="v2-hub">
      <svg className="rings" viewBox="0 0 1000 340" preserveAspectRatio="xMidYMid meet">
        <ellipse cx="500" cy="170" rx="430" ry="130" /><ellipse cx="500" cy="170" rx="300" ry="90" className="r2" /><ellipse cx="500" cy="170" rx="170" ry="52" className="r3" />
      </svg>
      <div className="core"><span className="lh-logo-m"><i /></span><b>Lumiva</b><em>{lang === 'ru' ? 'один договор' : lang === 'tr' ? 'tek sözleşme' : 'one contract'}</em></div>
      {S.map((s, i) => {
        const a = (i / S.length) * Math.PI * 2 - Math.PI / 2
        return (
          <div key={s} className={'node' + (on === i ? ' on' : '')} style={{ left: 50 + Math.cos(a) * 43 + '%', top: 50 + Math.sin(a) * 38 + '%', animationDelay: i * 0.4 + 's' }}>
            <span><LIc d={IC[i]} size={15} /></span>{s}
          </div>
        )
      })}
    </div>
  )
}

/* ── CRM: воронка-канбан ── */
function ArtCrm({ lang }: { lang: AgLang }) {
  const t = useTick(1700, 4)
  const COL = lang === 'ru' ? ['Новый', 'Квалификация', 'Предложение', 'Оплачено'] : lang === 'tr' ? ['Yeni', 'Nitelendirme', 'Teklif', 'Ödendi'] : ['New', 'Qualified', 'Proposal', 'Won']
  return (
    <Shell url="crm · pipeline" lang={lang}
      fl={<><Fl c="a" icon={LI.flow} b="WhatsApp → CRM" s={lang === 'ru' ? 'лид создан автоматически' : lang === 'tr' ? 'lead otomatik oluşturuldu' : 'lead created automatically'} /><Fl c="b" ok icon={LI.check} b="iyzico · PayTR" s={lang === 'ru' ? 'оплата прошла' : lang === 'tr' ? 'ödeme alındı' : 'payment received'} /></>}>
      <div className="v2-crm">
        {COL.map((c, k) => (
          <div key={c} className="col"><span className="h">{c}<em>{[3, 2, 2, 1][k] + (k === t ? 1 : 0)}</em></span>
            {Array.from({ length: [2, 2, 1, 1][k] }, (_, j) => <div key={j} className="card"><b /><i /></div>)}
            {k === t && <div className="card mv" key={'mv' + t}><b /><i /><span className="tag">Hotel · TR</span></div>}
          </div>
        ))}
      </div>
    </Shell>
  )
}

/* ── Hotel: загрузка по датам ── */
function ArtHotel({ lang }: { lang: AgLang }) {
  const t = useTick(700, 1000)
  const days = Array.from({ length: 35 }, (_, i) => i)
  return (
    <Shell url="hotel · occupancy" lang={lang}
      fl={<><Fl c="a" icon={LI.trend} b={lang === 'ru' ? 'Прямые брони ↑' : lang === 'tr' ? 'Direkt rezervasyon ↑' : 'Direct bookings ↑'} s={lang === 'ru' ? 'меньше комиссии OTA' : lang === 'tr' ? 'daha az OTA komisyonu' : 'less OTA commission'} /><Fl c="b" ok icon={LI.check} b={lang === 'ru' ? 'Новая бронь' : lang === 'tr' ? 'Yeni rezervasyon' : 'New booking'} s={lang === 'ru' ? 'с сайта отеля' : lang === 'tr' ? 'otel sitesinden' : 'from hotel website'} /></>}>
      <div className="v2-ht">
        <div className="cal">{days.map(d => {
          const v = ((d * 53 + 17) % 100) / 100
          const lit = (t % 35) >= d
          return <i key={d} style={{ opacity: lit ? 0.25 + v * 0.75 : 0.12, background: v > 0.66 ? '#111113' : v > 0.33 ? '#3f7d12' : '#c8f560' }} />
        })}</div>
        <div className="share">
          <span className="lh-k">{lang === 'ru' ? 'Каналы бронирования' : lang === 'tr' ? 'Rezervasyon kanalları' : 'Booking channels'}</span>
          {[['Direct', 42], ['Booking.com', 31], ['Expedia', 15], ['Tour operators', 12]].map(([n, v], i) => (
            <div key={n as string}><span>{n}</span><i><b style={{ width: (v as number) * 2 + '%', animationDelay: i * 0.15 + 's' }} className={i === 0 ? 'hl' : ''} /></i><em>{v}%</em></div>
          ))}
        </div>
      </div>
    </Shell>
  )
}

function Art({ kind, lang }: { kind: Kind; lang: AgLang }) {
  switch (kind) {
    case 'hub': return <ArtHub lang={lang} />
    case 'seo': return <ArtSeo lang={lang} />
    case 'perf': return <ArtPerf lang={lang} />
    case 'analytics': return <ArtAnalytics lang={lang} />
    case 'design': return <ArtDesign lang={lang} />
    case 'dev': return <ArtDev lang={lang} />
    case 'content': return <ArtContent lang={lang} />
    case 'smm': return <ArtSmm lang={lang} />
    case 'strategy': return <ArtStrategy lang={lang} />
    case 'crm': return <ArtCrm lang={lang} />
    case 'hotel': return <ArtHotel lang={lang} />
  }
}

/** Монтирует иллюстрацию в шапку текущей страницы. */
export function HeroArtMount() {
  const { pathname } = useLocation()
  const { i18n } = useTranslation()
  const lang = agLang(i18n.language)
  const kind = artKind(pathname)
  const [host, setHost] = useState<HTMLElement | null>(null)
  const wrap = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setHost(null)
    if (!kind) return
    let tries = 0
    let tm: ReturnType<typeof setTimeout>
    const find = () => {
      const w = document.querySelector('.site-content .page-hero > .wrap') as HTMLElement | null
      if (w) {
        let h = w.querySelector(':scope > .v2-art-host') as HTMLElement | null
        if (!h) { h = document.createElement('div'); h.className = 'v2-art-host'; w.appendChild(h) }
        setHost(h)
      } else if (tries++ < 40) tm = setTimeout(find, 100)
    }
    find()
    return () => clearTimeout(tm)
  }, [pathname, kind])

  useEffect(() => {
    if (!host) return
    const f = () => {
      const el = wrap.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const p = Math.max(0, Math.min(1, 1 - (r.top - window.innerHeight * 0.35) / (window.innerHeight * 0.6)))
      el.style.setProperty('--p', p.toFixed(3))
    }
    f()
    window.addEventListener('scroll', f, { passive: true })
    return () => window.removeEventListener('scroll', f)
  }, [host])

  const move = (e: React.MouseEvent) => {
    const el = wrap.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3))
    el.style.setProperty('--my', ((e.clientY - r.top) / r.height - 0.5).toFixed(3))
  }
  const reset = () => { wrap.current?.style.setProperty('--mx', '0'); wrap.current?.style.setProperty('--my', '0') }

  if (!host || !kind) return null
  return createPortal(
    <div ref={wrap} className={'v2-art k-' + kind} aria-hidden="true" onMouseMove={move} onMouseLeave={reset}>
      <Art kind={kind} lang={lang} />
    </div>,
    host,
  )
}
