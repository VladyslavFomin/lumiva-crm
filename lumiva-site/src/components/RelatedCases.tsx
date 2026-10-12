import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLangPath } from '../hooks/useLangPath'

const API = 'https://pl2.lumiva.agency/api'
const ART_COLORS = ['#f5f3ee', '#1a1a1a', '#222222', '#e9e6dc', '#f6f3ec', '#2a2a4a']

interface RelatedCasesProps {
  num: string
  tag: string
  heading: string
  allLabel: string
  keywords: string[]
}

export default function RelatedCases({ num, tag, heading, allLabel, keywords }: RelatedCasesProps) {
  const { p } = useLangPath()
  const { i18n } = useTranslation()
  const [cases, setCases] = useState<any[]>([])
  const langKey = i18n.language?.startsWith('ru') ? 'ru' : i18n.language?.startsWith('tr') ? 'tr' : 'en'

  useEffect(() => {
    fetch(`${API}/cases?status=published&limit=20&lang=${langKey}`)
      .then(r => r.json())
      .then(r => {
        const items = r.items || []
        const lower = keywords.map(k => k.toLowerCase())
        const matched = items.filter((c: any) =>
          (Array.isArray(c.tags) && c.tags.some((t: string) => lower.includes(String(t).toLowerCase()))) ||
          (c.industry && lower.includes(String(c.industry).toLowerCase()))
        )
        setCases((matched.length > 0 ? matched : items).slice(0, 3))
      })
      .catch(() => {})
  }, [langKey]) // eslint-disable-line react-hooks/exhaustive-deps

  if (cases.length === 0) return null

  return (
    <section id="cases">
      <div className="wrap">
        <div className="sec-head">
          <div className="sec-tag"><span className="num">{num}</span>{tag}</div>
          <div><h2 className="sec-title">{heading}</h2></div>
          <Link to={p('/cases')} className="show-all">{allLabel} <span className="arr">↗</span></Link>
        </div>
        <div className="cases-mini">
          {cases.map((c, i) => (
            <Link key={c.id} to={p(`/cases/${c.slug}`)} className="cm">
              <div className="cm-thumb">
                <div className="cm-art" style={{ background: c.coverUrl ? 'var(--paper-2)' : ART_COLORS[i % ART_COLORS.length], overflow: 'hidden' }}>
                  {c.coverUrl
                    ? <img src={c.coverUrl} alt={c.clientName} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    : (
                      <>
                        <div className="grid-deco" />
                        <div className="label serif italic" style={{ color: 'rgba(255,255,255,.7)', fontSize: 64, letterSpacing: '-0.03em' }}>{c.clientName?.[0] || '✦'}</div>
                      </>
                    )}
                </div>
              </div>
              <div className="cm-meta">
                <div>
                  <div className="cm-name">{c.clientName}</div>
                  <div className="cm-cat">{c.industry || (Array.isArray(c.tags) ? c.tags[0] : '') || ''}</div>
                </div>
                <div className="cm-result">{c.resultValue || ''}<em> {c.shortResult || ''}</em></div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
