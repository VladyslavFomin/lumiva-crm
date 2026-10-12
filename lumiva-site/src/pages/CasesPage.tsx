import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLangPath } from '../hooks/useLangPath'
import PageSEO from '../components/PageSEO'

const API = 'https://pl2.lumiva.agency/api'

const COLORS = ['#1f3a2f', '#222', '#2a2a4a', '#3a1f2f', '#1f2a3a']

export default function CasesPage() {
  const { t, i18n } = useTranslation()
  const { p } = useLangPath()
  const [cases, setCases] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const langKey = i18n.language?.startsWith('ru') ? 'ru' : i18n.language?.startsWith('tr') ? 'tr' : 'en'

  useEffect(() => {
    setLoading(true)
    fetch(`${API}/cases?status=published&limit=50&lang=${langKey}`)
      .then(r => r.json())
      .then(r => { setCases(r.items || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [langKey])

  const industries = ['all', ...Array.from(new Set(cases.map(c => c.industry).filter(Boolean)))]

  const filtered = filter === 'all' ? cases : cases.filter(c => c.industry === filter)

  return (
    <>
      <PageSEO
        title={t('cases.seo_title', 'Portfolio')}
        description={t('cases.seo_desc', 'Case studies of our work in branding, web, performance and analytics.')}
        path={p('/cases')}
      />

      {/* Hero */}
      <header style={{ padding: '80px 0 64px', borderBottom: '1px solid var(--line)' }}>
        <div className="wrap">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginBottom: 32 }}>
            <div>
              <div className="sec-tag" style={{ marginBottom: 16 }}>
                <span className="num" style={{ borderColor: 'var(--ink)' }}>{cases.length || '—'}</span>
                {t('cases.eyebrow', 'Case studies')}
              </div>
              <h1 style={{
                fontFamily: '"Instrument Serif", serif', fontWeight: 400,
                fontSize: 'clamp(48px,7vw,112px)', lineHeight: .95, letterSpacing: '-.03em', margin: 0
              }}>
                {t('cases.title', 'Portfolio')}
              </h1>
            </div>
            <p style={{
              fontFamily: '"Instrument Serif", serif', fontStyle: 'italic',
              fontSize: 'clamp(18px,2vw,24px)', lineHeight: 1.4, color: '#444',
              maxWidth: '36ch', margin: 0, alignSelf: 'flex-end'
            }}>
              {t('cases.sub', 'Measurable results — from brand identity to performance campaigns.')}
            </p>
          </div>

          {/* Filter pills */}
          {industries.length > 1 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {industries.map(ind => (
                <button key={ind} onClick={() => setFilter(ind)}
                  style={{
                    padding: '7px 16px', borderRadius: 999,
                    border: `1px solid ${filter === ind ? 'var(--ink)' : 'var(--line-2)'}`,
                    background: filter === ind ? 'var(--ink)' : 'transparent',
                    color: filter === ind ? 'var(--paper)' : 'var(--ink)',
                    fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
                    textTransform: 'uppercase', letterSpacing: '.1em',
                    cursor: 'pointer', transition: 'all .25s',
                  }}>
                  {ind === 'all' ? t('cases.filter_all', 'All') : ind}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Grid */}
      <main style={{ padding: '80px 0 120px' }}>
        <div className="wrap">
          {loading && (
            <div className="r1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px, 1fr))', gap: 24 }}>
              {[1, 2, 3].map(i => (
                <div key={i} className="skel" style={{ height: 420, borderRadius: 'var(--radius-lg)' }} />
              ))}
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--muted)' }}>
              <p style={{ fontSize: 18 }}>{t('cases.empty', 'No cases yet.')}</p>
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="r1" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill,minmax(360px, 1fr))',
              gap: 24,
            }}>
              {filtered.map((c, idx) => (
                <Link key={c.id} to={p(`/cases/${c.slug}`)}
                  style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column' }}>
                  <div className="case-card-wrap" style={{
                    display: 'flex', flexDirection: 'column',
                    borderRadius: 'var(--radius-lg)', overflow: 'hidden',
                    border: '1px solid var(--line)',
                    transition: 'transform var(--t), box-shadow var(--t)',
                    cursor: 'pointer',
                  }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.transform = 'translateY(-6px)'
                      ;(e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-hover)'
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.transform = ''
                      ;(e.currentTarget as HTMLElement).style.boxShadow = ''
                    }}
                  >
                    {/* Thumb */}
                    <div style={{
                      aspectRatio: '16/9', position: 'relative', overflow: 'hidden',
                      background: c.coverUrl ? 'var(--paper-2)' : COLORS[idx % COLORS.length],
                    }}>
                      {c.coverUrl
                        ? <img src={c.coverUrl} alt={c.clientName} loading="lazy"
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        : (
                          <>
                            <div style={{
                              position: 'absolute', inset: 0,
                              backgroundImage: 'linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px)',
                              backgroundSize: '40px 40px',
                            }} />
                            <div style={{
                              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontFamily: '"Instrument Serif", serif', fontStyle: 'italic',
                              fontSize: 'clamp(64px,8vw,96px)', color: 'rgba(255,255,255,.7)',
                              letterSpacing: '-.04em', lineHeight: 1,
                            }}>
                              {c.clientName?.[0] || '✦'}
                            </div>
                          </>
                        )
                      }
                      {/* Result badge */}
                      {(c.resultValue || c.shortResult) && (
                        <div style={{
                          position: 'absolute', bottom: 16, right: 16,
                          background: 'rgba(255,255,255,.12)', backdropFilter: 'blur(8px)',
                          border: '1px solid rgba(255,255,255,.2)',
                          padding: '6px 14px', borderRadius: 999,
                          fontFamily: '"Instrument Serif", serif', fontSize: 22,
                          color: '#fff', letterSpacing: '-.01em',
                        }}>
                          {c.resultValue || c.shortResult}
                        </div>
                      )}
                    </div>

                    {/* Body */}
                    <div style={{ padding: '24px 28px 28px', background: 'var(--paper)', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                        <h2 style={{
                          fontFamily: '"Instrument Serif", serif', fontWeight: 400,
                          fontSize: 24, lineHeight: 1.1, letterSpacing: '-.01em', margin: 0,
                        }}>
                          {c.clientName}
                        </h2>
                        {c.year && (
                          <span style={{
                            fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
                            color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em',
                            flexShrink: 0, paddingTop: 4,
                          }}>{c.year}</span>
                        )}
                      </div>

                      {c.industry && (
                        <p style={{ margin: 0, fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.4 }}>
                          {c.industry}
                        </p>
                      )}

                      {/* Tags */}
                      {Array.isArray(c.tags) && c.tags.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 'auto', paddingTop: 8 }}>
                          {c.tags.map((tag: string) => (
                            <span key={tag} style={{
                              padding: '3px 10px', border: '1px solid var(--line-2)',
                              borderRadius: 999, fontFamily: '"JetBrains Mono", monospace',
                              fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em',
                              color: 'var(--muted)',
                            }}>{tag}</span>
                          ))}
                        </div>
                      )}

                      {/* Arrow */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>
                          {t('cases.view', 'View case')}
                        </span>
                        <span style={{
                          display: 'inline-grid', placeItems: 'center',
                          width: 22, height: 22, borderRadius: '50%',
                          background: 'var(--ink)', color: 'var(--paper)', fontSize: 11,
                        }}>→</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
