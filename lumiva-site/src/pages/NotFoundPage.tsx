import { useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLangPath } from '../hooks/useLangPath'

export default function NotFoundPage() {
  const { t } = useTranslation()
  const { p } = useLangPath()
  const navigate = useNavigate()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.scrollTo(0, 0)

    if (barRef.current) {
      barRef.current.style.transition = 'width 8s linear'
      barRef.current.style.width = '100%'
    }
    timerRef.current = setTimeout(() => navigate(p('/')), 8000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [navigate, p])

  const links = [
    { to: p('/'), label: t('not_found.nav_home') },
    { to: p('/services'), label: t('not_found.nav_services') },
    { to: p('/services/development'), label: t('not_found.nav_dev') },
    { to: p('/services/design'), label: t('not_found.nav_design') },
  ]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--paper)' }}>

      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(40px, 8vw, 120px) clamp(24px, 4vw, 72px)',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>

        <div aria-hidden style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -52%)',
          fontFamily: "'Instrument Serif', serif",
          fontStyle: 'italic',
          fontSize: 'clamp(260px, 35vw, 520px)',
          fontWeight: 400,
          lineHeight: 1,
          color: 'var(--paper-2)',
          letterSpacing: '-0.04em',
          userSelect: 'none',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}>
          404
        </div>

        <div aria-hidden style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          opacity: 0.35,
        }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 560 }}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
            color: 'var(--muted)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: 24,
          }}>
            {t('not_found.error')}
          </div>

          <h1 style={{
            fontFamily: "'Instrument Serif', serif",
            fontWeight: 400,
            fontSize: 'clamp(36px, 5vw, 64px)',
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
            margin: '0 0 20px',
          }}>
            {t('not_found.title')}
          </h1>

          <p style={{ fontSize: 18, color: '#555', lineHeight: 1.6, margin: '0 0 40px' }}>
            {t('not_found.text')} {t('not_found.redirect')}
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 48 }}>
            <Link to={p('/')} className="btn btn-primary" onClick={() => { if (timerRef.current) clearTimeout(timerRef.current) }}>
              {t('not_found.home')}<span className="arrow">↗</span>
            </Link>
            <Link to={p('/services')} className="btn btn-ghost" onClick={() => { if (timerRef.current) clearTimeout(timerRef.current) }}>
              {t('not_found.services')}<span className="arrow">↗</span>
            </Link>
          </div>

          <div style={{
            display: 'flex',
            gap: 0,
            justifyContent: 'center',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius)',
            overflow: 'hidden',
          }}>
            {links.map((l, i) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => { if (timerRef.current) clearTimeout(timerRef.current) }}
                style={{
                  padding: '14px 22px',
                  fontSize: 14,
                  color: 'var(--muted)',
                  borderRight: i < links.length - 1 ? '1px solid var(--line)' : 'none',
                  transition: 'background 0.2s, color 0.2s',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = 'var(--paper-2)'
                  ;(e.currentTarget as HTMLElement).style.color = 'var(--ink)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = 'transparent'
                  ;(e.currentTarget as HTMLElement).style.color = 'var(--muted)'
                }}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div style={{
        height: 3,
        background: 'var(--paper-3)',
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
      }}>
        <div
          ref={barRef}
          style={{
            height: '100%',
            width: 0,
            background: 'var(--ink)',
          }}
        />
      </div>

    </div>
  )
}
