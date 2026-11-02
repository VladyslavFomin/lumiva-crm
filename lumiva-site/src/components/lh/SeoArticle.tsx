/* Длинный SEO-текст страницы услуги: оглавление (sticky) + статья. Рендерится на сервере (пререндер),
 * тексты — src/content/seo/*.ts по slug и языку. */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { agLang, type AgLang } from './agText'

export type SeoPart = { h: string; p?: string[]; ul?: string[] }
export type SeoArt = { kick: string; title: string; lead: string; parts: SeoPart[]; facts?: [string, string][] }
export type SeoSet = Record<string, Record<AgLang, SeoArt>>

const TOC: Record<AgLang, string> = { en: 'On this page', ru: 'В этой статье', tr: 'Bu sayfada' }
const MIN: Record<AgLang, string> = { en: 'min read', ru: 'мин чтения', tr: 'dk okuma' }

const slugify = (s: string, i: number) => 'sa-' + i + '-' + s.toLowerCase().replace(/[^a-zа-яёçğıöşü0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 40)

export default function SeoArticle({ set, slug }: { set: SeoSet; slug: string }) {
  const { i18n } = useTranslation()
  const lang = agLang(i18n.language)
  const a = set[slug]?.[lang]
  const body = useRef<HTMLDivElement>(null)
  const [cur, setCur] = useState(0)
  const [prog, setProg] = useState(0)

  useEffect(() => {
    const f = () => {
      const el = body.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight
      setProg(Math.max(0, Math.min(1, (vh * 0.3 - r.top) / Math.max(1, r.height - vh * 0.4))))
      const hs = Array.from(el.querySelectorAll('h3'))
      let c = 0
      hs.forEach((h, i) => { if (h.getBoundingClientRect().top < vh * 0.35) c = i })
      setCur(c)
    }
    f()
    window.addEventListener('scroll', f, { passive: true })
    return () => window.removeEventListener('scroll', f)
  }, [slug, lang])

  if (!a) return null
  const words = [a.lead, ...a.parts.flatMap(p => [...(p.p || []), ...(p.ul || [])])].join(' ').split(/\s+/).length
  const ids = a.parts.map((p, i) => slugify(p.h, i))

  return (
    <section className="seo-art" aria-labelledby="seo-art-title">
      <div className="wrap">
        <div className="seo-art-in">
          <aside className="seo-art-toc">
            <span className="lh-k">{TOC[lang]}</span>
            <nav>
              {a.parts.map((p, i) => (
                <a key={ids[i]} href={'#' + ids[i]} className={i === cur ? 'on' : ''} onClick={e => { e.preventDefault(); document.getElementById(ids[i])?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}>
                  <em>{String(i + 1).padStart(2, '0')}</em>{p.h}
                </a>
              ))}
            </nav>
            <div className="seo-art-prog"><i style={{ transform: `scaleX(${prog})` }} /></div>
            <span className="seo-art-min">{Math.max(2, Math.round(words / 200))} {MIN[lang]}</span>
          </aside>
          <div className="seo-art-b" ref={body}>
            <span className="sec-tag"><span className="num">✦</span>{a.kick}</span>
            <h2 id="seo-art-title">{a.title}</h2>
            <p className="lead">{a.lead}</p>
            {a.facts && (
              <div className="seo-art-facts">{a.facts.map(([k, v]) => <div key={k}><b>{v}</b><span>{k}</span></div>)}</div>
            )}
            {a.parts.map((p, i) => (
              <div key={ids[i]} className="seo-art-part">
                <h3 id={ids[i]}><em>{String(i + 1).padStart(2, '0')}</em>{p.h}</h3>
                {p.p?.map((x, k) => <p key={k}>{x}</p>)}
                {p.ul && <ul>{p.ul.map(x => <li key={x}>{x}</li>)}</ul>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
