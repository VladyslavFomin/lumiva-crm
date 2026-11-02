/* Шапка и футер lumiva.agency по макету lumiva-agency-home-v2 (AgHeader / AgFooter). */
import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { createPortal } from 'react-dom'
import type { Lang } from '../../i18n'
import { useLangPath } from '../../hooks/useLangPath'
import { trackEvent } from '../../lib/analytics'
import { LIc, LI } from './kit'
import { AG_TEXT, agLang } from './agText'

const PHONE = '+90 538 365 96 78'
const PHONE_HREF = 'tel:+905383659678'
const EMAIL = 'vlad@lumiva.agency'

export function AgLogo({ onClick }: { onClick?: () => void }) {
  const { p } = useLangPath()
  return (
    <Link to={p('/')} className="lh-logo" onClick={onClick} aria-label="Lumiva Agency">
      <span className="lh-logo-m"><i /></span>Lumiva<span className="lh-logo-s">AGENCY</span>
    </Link>
  )
}

function useSwitchLang() {
  const { i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  return (target: Lang) => {
    const cur = location.pathname
    let base = cur
    if (cur.startsWith('/ru')) base = cur.slice(3) || '/'
    else if (cur.startsWith('/tr')) base = cur.slice(3) || '/'
    const next = target === 'en' ? base || '/' : `/${target}${base === '/' ? '' : base}`
    i18n.changeLanguage(target)
    navigate(next + location.hash)
  }
}

function LangPills() {
  const { i18n } = useTranslation()
  const sw = useSwitchLang()
  const cur = agLang(i18n.language)
  return (
    <div className="ag-lang" role="group" aria-label="Language">
      {(['en', 'ru', 'tr'] as Lang[]).map(l => (
        <button key={l} type="button" className={l === cur ? 'on' : ''} onClick={() => sw(l)} aria-pressed={l === cur}>{l.toUpperCase()}</button>
      ))}
    </div>
  )
}

function useNavLinks() {
  const { t, i18n } = useTranslation()
  const { p, h } = useLangPath()
  const T = AG_TEXT[agLang(i18n.language)]
  return [
    { l: t('nav.services'), to: p('/services') },
    { l: T.navAi, href: h('/#ai') },
    { l: t('nav.cases'), to: p('/cases') },
    { l: t('nav.process'), href: h('/#process') },
    { l: t('nav.about'), href: h('/#manifesto') },
    { l: t('nav.team'), href: h('/#team') },
    { l: t('nav.faq'), href: h('/#faqList') },
    { l: t('nav.blog'), to: p('/blog') },
  ] as { l: string; to?: string; href?: string }[]
}

export function SiteHeader({ onDiscuss }: { onDiscuss: () => void }) {
  const { t, i18n } = useTranslation()
  const T = AG_TEXT[agLang(i18n.language)]
  const links = useNavLinks()
  const location = useLocation()
  const [sc, setSc] = useState(false)
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const f = () => {
      setSc(window.scrollY > 10)
      const max = document.documentElement.scrollHeight - window.innerHeight
      document.documentElement.style.setProperty('--sp', max > 0 ? (window.scrollY / max).toFixed(4) : '0')
    }
    f()
    window.addEventListener('scroll', f, { passive: true })
    return () => window.removeEventListener('scroll', f)
  }, [])
  useEffect(() => { setOpen(false) }, [location.pathname])
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', k)
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', k) }
  }, [open])

  const close = () => setOpen(false)

  return (
    <>
      <header className={'lh-hd ag-hd' + (sc ? ' sc' : '') + (open ? ' open' : '')}>
        <div className="lh-hd-in">
          <AgLogo onClick={close} />
          <nav className="ag-nav" aria-label="Main">
            {links.map(x => x.to
              ? <NavLink key={x.l} to={x.to} className={({ isActive }) => (isActive ? 'active' : '')}>{x.l}</NavLink>
              : <a key={x.l} href={x.href}>{x.l}</a>)}
          </nav>
          <div className="ag-hd-r">
            <a className="ag-ph" href={PHONE_HREF}>{PHONE}</a>
            <LangPills />
            <button type="button" className="lh-btn sm" onClick={onDiscuss}>{t('nav.discuss')}<LIc d={LI.ne} size={13} sw={2} /></button>
            <button type="button" className="ag-burger" onClick={() => setOpen(o => !o)} aria-label={open ? t('nav.close_menu') : t('nav.open_menu')} aria-expanded={open}>
              <LIc d={open ? LI.x : LI.menu} size={18} />
            </button>
          </div>
        </div>
        <span className="ag-prog" aria-hidden="true" />
      </header>
      {mounted && open && createPortal(
        <>
          <div className="ag-drw-bg" onClick={close} />
          <div className="ag-drawer" role="dialog" aria-modal="true">
            {links.map((x, i) => x.to
              ? <Link key={x.l} className="it" to={x.to} onClick={close} style={{ animationDelay: i * 0.03 + 's' }}>{x.l}<span>0{i + 1}</span></Link>
              : <a key={x.l} className="it" href={x.href} onClick={close} style={{ animationDelay: i * 0.03 + 's' }}>{x.l}<span>0{i + 1}</span></a>)}
            <div className="row">
              <LangPills />
              <button type="button" className="lh-btn" onClick={() => { close(); onDiscuss() }}>{t('nav.discuss')}<LIc d={LI.ne} size={14} sw={2} /></button>
            </div>
            <div className="ct">
              <span className="lh-k" style={{ margin: 0 }}>{T.drawer.contacts}</span>
              <a href={PHONE_HREF}>{PHONE}</a>
              <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  )
}

export function SiteFooter() {
  const { t, i18n } = useTranslation()
  const { p, h } = useLangPath()
  const lang = agLang(i18n.language)
  const T = AG_TEXT[lang]
  const [done, setDone] = useState(false)

  const subscribe = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const email = (e.currentTarget.elements.namedItem('email') as HTMLInputElement).value
    try {
      await fetch('https://pl2.lumiva.agency/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, lang, source: 'footer' }),
      })
      trackEvent('newsletter_submit', { page_path: window.location.pathname })
    } catch {}
    setDone(true)
  }

  type L = [string, string, 'link' | 'a' | 'ext']
  const cols: [string, L[]][] = [
    [t('footer.services'), [
      [t('nav.all_services'), p('/services'), 'link'],
      [t('footer.development'), p('/services/development'), 'link'],
      [t('footer.design'), p('/services/design'), 'link'],
      [t('footer.analytics'), p('/services/analytics'), 'link'],
      [t('footer.seo'), p('/services/seo'), 'link'],
      ['CRM', 'https://crm.lumiva.agency/', 'ext'],
    ]],
    [T.footer.studio, [
      [t('footer.cases'), p('/cases'), 'link'],
      [t('nav.blog'), p('/blog'), 'link'],
      [t('footer.manifesto'), h('/#manifesto'), 'a'],
      [t('nav.team'), h('/#team'), 'a'],
    ]],
    [T.footer.local, [
      ['Digital Marketing Antalya', '/digital-marketing-agency-antalya', 'link'],
      ['SEO Agency Antalya', '/seo-agency-antalya', 'link'],
      ['Web Development Antalya', '/web-development-antalya', 'link'],
      ['CRM Development Turkey', '/crm-development-turkey', 'link'],
      ['Hotel Marketing Turkey', '/hotel-marketing-agency-turkey', 'link'],
    ]],
    [T.footer.contacts, [
      [EMAIL, `mailto:${EMAIL}`, 'a'],
      [PHONE, PHONE_HREF, 'a'],
      ['Telegram', 'https://t.me/', 'ext'],
      ['LinkedIn', 'https://linkedin.com/', 'ext'],
      ['Instagram', 'https://instagram.com/', 'ext'],
    ]],
  ]

  return (
    <footer className="lh-ft ag-ft">
      <div className="lh-ft-in">
        <div>
          <AgLogo />
          <p>{T.footer.tagline} {t('blog.subscribe_sub2')}</p>
          <form className="ag-sub" onSubmit={subscribe}>
            <input type="email" name="email" required placeholder={t('footer.newsletter_placeholder')} aria-label="Email" />
            <button className="lh-btn sm" type="submit">{done ? t('footer.subscribed') : t('footer.subscribe')}</button>
          </form>
        </div>
        {cols.map(([head, ls]) => (
          <div key={head} className="lh-ft-c">
            <h5>{head}</h5>
            {ls.map(([l, x, k]) => k === 'link'
              ? <Link key={l} to={x}>{l}</Link>
              : k === 'ext'
                ? <a key={l} href={x} target="_blank" rel="noopener noreferrer">{l}</a>
                : <a key={l} href={x}>{l}</a>)}
          </div>
        ))}
      </div>
      <div className="ag-big" aria-hidden="true">Lumiva</div>
      <div className="lh-ft-b">
        <span>{t('footer.copyright')}</span>
        <span>{t('footer.offices')}</span>
        <span style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Link to={p('/privacy-policy')}>{t('footer.privacy')}</Link>
          <Link to={p('/terms-of-service')}>Terms of Service</Link>
          <Link to={p('/cookie-policy')}>Cookie Policy</Link>
        </span>
      </div>
    </footer>
  )
}
