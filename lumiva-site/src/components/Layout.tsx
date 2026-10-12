import { Outlet, NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLangPath } from '../hooks/useLangPath'
import type { Lang } from '../i18n'
import { trackEvent } from '../lib/analytics'

const CONTACT_ENDPOINT = 'https://pl2.lumiva.agency/api/forms/submit'
const SITE_SOURCE = 'lumiva.agency'
const COOKIE_CONSENT_KEY = 'lumiva_cookie_consent_v1'

type ContactSourceMeta = {
  source: string
  notes: string
}

type ContactSourceInput = {
  block: string
  button: string
  tariff?: string
  tariffBadge?: string
  tariffSubtitle?: string
  price?: string
  href?: string
  utmMedium: string
  utmContent?: string
}

const cleanText = (el: Element | null | undefined) =>
  (el?.textContent || '').replace(/[↗✓]/g, '').replace(/\s+/g, ' ').trim()

const toUtmToken = (value: string) => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/https?:\/\//g, '')
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '')

  return encodeURIComponent(normalized || 'unknown')
}

function buildContactSource(input: ContactSourceInput): ContactSourceMeta {
  const pagePath = window.location.pathname || '/'
  const pageUrl = window.location.href
  const campaign = toUtmToken(pagePath === '/' ? 'home' : pagePath.replace(/^\//, ''))
  const content = toUtmToken(input.utmContent || input.tariff || input.button)
  const source = [SITE_SOURCE, pagePath, input.block, input.tariff].filter(Boolean).join(' | ')
  const notes = [
    `Page: ${pageUrl}`,
    `Block: ${input.block}`,
    input.tariff ? `Tariff: ${input.tariff}` : '',
    input.tariffBadge ? `Badge: ${input.tariffBadge}` : '',
    input.tariffSubtitle ? `Subtitle: ${input.tariffSubtitle}` : '',
    input.price ? `Price: ${input.price}` : '',
    `Button: ${input.button}`,
    input.href ? `Source link: ${input.href}` : '',
    `UTM: utm_source=${SITE_SOURCE}&utm_medium=${input.utmMedium}&utm_campaign=${campaign}&utm_content=${content}`,
  ].filter(Boolean).join('\n')

  return { source, notes }
}

function getPricingContactSource(anchor: HTMLAnchorElement): ContactSourceMeta | null {
  const tier = anchor.closest('.tier')
  if (!tier || !tier.closest('.pricing')) return null

  const tariff = cleanText(tier.querySelector('.tier-name'))
  const tariffBadge = cleanText(tier.querySelector('.tier-badge'))
  const tariffSubtitle = cleanText(tier.querySelector('.tier-sub'))
  const price = cleanText(tier.querySelector('.tier-price'))
  const button = cleanText(anchor) || 'Discuss'

  return buildContactSource({
    block: 'Pricing',
    button,
    tariff,
    tariffBadge,
    tariffSubtitle,
    price,
    href: anchor.getAttribute('href') || '',
    utmMedium: 'pricing',
    utmContent: tariff || button,
  })
}

function markPricingContactLinks() {
  document.querySelectorAll<HTMLAnchorElement>('.pricing .tier a[href="/#contact"], .pricing .tier a[href="#contact"]').forEach(anchor => {
    const tier = anchor.closest('.tier')
    const tariff = cleanText(tier?.querySelector('.tier-name'))
    anchor.dataset.utmSource = SITE_SOURCE
    anchor.dataset.utmMedium = 'pricing'
    anchor.dataset.utmCampaign = toUtmToken(window.location.pathname === '/' ? 'home' : window.location.pathname.replace(/^\//, ''))
    anchor.dataset.utmContent = toUtmToken(tariff || cleanText(anchor))
    anchor.dataset.sourceBlock = 'Pricing'
    if (tariff) anchor.dataset.sourceTariff = tariff
  })
}

function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()

  const switchTo = (targetLang: Lang) => {
    const currentPath = location.pathname
    let basePath = currentPath
    if (currentPath.startsWith('/ru')) basePath = currentPath.slice(3) || '/'
    else if (currentPath.startsWith('/tr')) basePath = currentPath.slice(3) || '/'

    let newPath: string
    if (targetLang === 'en') newPath = basePath || '/'
    else if (targetLang === 'ru') newPath = `/ru${basePath === '/' ? '' : basePath}`
    else newPath = `/tr${basePath === '/' ? '' : basePath}`

    i18n.changeLanguage(targetLang)
    navigate(newPath)
  }

  const current = i18n.language as Lang

  const langs: Lang[] = ['en', 'ru', 'tr']

  return (
    <div className="lang-switcher">
      {langs.map((lang, i) => (
        <span key={lang} className="lang-item">
          {i > 0 && <span className="lang-sep">·</span>}
          <button
            className={`lang-btn${current === lang ? ' active' : ''}`}
            onClick={() => switchTo(lang)}
            aria-label={lang.toUpperCase()}
          >
            {lang.toUpperCase()}
          </button>
        </span>
      ))}
    </div>
  )
}

function Topbar() {
  const { t } = useTranslation()
  const { h, p } = useLangPath()

  return (
    <div className="topbar">
      <div className="wrap topbar-inner">
        <div className="pulse">
          <span className="dot" />
          <span>{t('topbar.slots')}</span>
        </div>
        <div className="links">
          <Link to={p('/cases')}>{t('nav.cases')}</Link>
          <a href="tel:+905383659678">{t('common.phone')}</a>
          <a href="mailto:vlad@lumiva.agency">{t('common.email')}</a>
        </div>
      </div>
    </div>
  )
}

const MENU_SERVICES_KEYS = [
  { labelKey: 'menu.development', href: '/services/development' },
  { labelKey: 'menu.design', href: '/services/design' },
  { labelKey: 'menu.analytics', href: '/services/analytics' },
  { labelKey: 'menu.strategy', href: '/services/strategy' },
  { labelKey: 'menu.performance', href: '/services/performance' },
  { labelKey: 'menu.content_smm', href: '/services/content' },
  { labelKey: 'menu.seo', href: '/services/seo' },
  { labelKey: 'menu.crm', href: 'https://crm.lumiva.agency/', ext: true },
]

type SubPanel = 'services' | null

function Nav({ menuOpen, onToggle, onDiscuss }: { menuOpen: boolean; onToggle: () => void; onDiscuss: () => void }) {
  const navRef = useRef<HTMLElement>(null)
  const { t } = useTranslation()
  const { p, h } = useLangPath()
  const [caseCount, setCaseCount] = useState<number | null>(null)

  useEffect(() => {
    const onScroll = () => navRef.current?.classList.toggle('scrolled', window.scrollY > 8)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    fetch('https://pl2.lumiva.agency/api/cases?status=published&limit=1')
      .then(r => r.json()).then(r => { if (r.total != null) setCaseCount(r.total) }).catch(() => {})
  }, [])

  return (
    <nav className="main" ref={navRef}>
      <div className="wrap nav-inner">
        {/* LEFT: logo + nav links */}
        <div className="nav-left">
          <NavLink to={p('/')} className="logo">
            <span className="logo-mark" />
            Lumiva
          </NavLink>
          <div className="nav-links">
            <NavLink to={p('/services')} className={({ isActive }) => isActive ? 'active' : ''}>
              {t('nav.services')}
            </NavLink>
            <NavLink to={p('/cases')} className={({ isActive }) => isActive ? 'active' : ''}>{t('nav.cases')}{caseCount != null && <span className="badge">{caseCount}</span>}</NavLink>
            <a href={h('/#process')}>{t('nav.process')}</a>
            <a href={h('/#manifesto')}>{t('nav.about')}</a>
            <a href={h('/#team')}>{t('nav.team')}</a>
            <a href={h('/#faqList')}>{t('nav.faq')}</a>
            <NavLink to={p('/blog')} className={({ isActive }) => isActive ? 'active' : ''}>{t('nav.blog')}</NavLink>
          </div>
        </div>

        {/* CENTER: popup trigger */}
        <button className="btn btn-ghost nav-discuss" onClick={onDiscuss}>
          {t('nav.discuss')}<span className="arrow">↗</span>
        </button>

        {/* RIGHT: language switcher + burger */}
        <div className="nav-cta">
          <LanguageSwitcher />
          <button
            className={`burger${menuOpen ? ' open' : ''}`}
            onClick={onToggle}
            aria-label={t('nav.open_menu')}
            aria-expanded={menuOpen}
          >
            <span /><span /><span />
          </button>
        </div>
      </div>
    </nav>
  )
}

function MobileMenu({ open, onClose, onDiscuss }: { open: boolean; onClose: () => void; onDiscuss: () => void }) {
  const [sub, setSub] = useState<SubPanel>(null)
  const { t } = useTranslation()
  const { p, h } = useLangPath()

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    } else {
      document.body.style.overflow = ''
      const timer = setTimeout(() => setSub(null), 560)
      return () => clearTimeout(timer)
    }
  }, [open])

  return (
    <div className={`mob-menu${open ? ' open' : ''}`} aria-modal={open} role="dialog">

      {/* ── Top bar ─────────────────────────────── */}
      <div className="mob-top">
        <Link to={p('/')} className="mob-logo" onClick={onClose}>Lumiva</Link>

        <div className="mob-socials">
          <a href="https://t.me/" target="_blank" rel="noopener noreferrer" className="mob-social" aria-label="Telegram">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248-1.97 9.28c-.144.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.94z"/>
            </svg>
          </a>
          <a href="https://linkedin.com/" target="_blank" rel="noopener noreferrer" className="mob-social" aria-label="LinkedIn">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          </a>
          <a href="https://instagram.com/" target="_blank" rel="noopener noreferrer" className="mob-social" aria-label="Instagram">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
          </a>
        </div>

        <button className="mob-close" onClick={onClose} aria-label={t('nav.close_menu')}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="1" y1="1" x2="13" y2="13"/><line x1="13" y1="1" x2="1" y2="13"/>
          </svg>
        </button>
      </div>

      {/* ── Search ──────────────────────────────── */}
      <div className="mob-search">
        <label className="mob-search-inner">
          <svg className="mob-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="search" placeholder={t('nav.search')} />
        </label>
      </div>

      {/* ── Sliding panels ─────────────────────── */}
      <div className="mob-panels-wrap">
        <div className={`mob-panels${sub ? ' sub-open' : ''}`}>

          {/* LEFT PANEL — services submenu */}
          <div className="mob-panel">
            <button className="mob-back" onClick={() => setSub(null)}>
              <svg width="14" height="10" viewBox="0 0 14 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="13" y1="5" x2="1" y2="5"/><polyline points="5 1 1 5 5 9"/>
              </svg>
              {t('nav.back')}
            </button>
            <div className="mob-sub-head">{t('nav.services')}</div>
            {MENU_SERVICES_KEYS.map((s, i) =>
              s.ext ? (
                <a key={i} href={s.href} target="_blank" rel="noopener noreferrer" className="mob-sub-link" onClick={onClose}>
                  <span>{t(s.labelKey)}</span><span className="mob-arr-sm">↗</span>
                </a>
              ) : (
                <Link key={i} to={p(s.href)} className="mob-sub-link" onClick={onClose}>
                  <span>{t(s.labelKey)}</span><span className="mob-arr-sm">→</span>
                </Link>
              )
            )}
            <div className="mob-sub-all">
              <Link to={p('/services')} className="btn btn-ghost" onClick={onClose} style={{ width: '100%', justifyContent: 'center' }}>
                {t('nav.all_services')}<span className="arrow">↗</span>
              </Link>
            </div>
          </div>

          {/* RIGHT PANEL — main nav */}
          <div className="mob-panel">
            <button className="mob-nav-item" onClick={() => setSub('services')}>
              <span className="mob-nav-label">{t('menu.services')}</span>
              <span className="mob-nav-num">01</span>
              <span className="mob-nav-arr">↗</span>
            </button>
            <Link className="mob-nav-item" to={p('/cases')} onClick={onClose}>
              <span className="mob-nav-label">{t('nav.cases')}</span>
              <span className="mob-nav-num">02</span>
            </Link>
            <a className="mob-nav-item" href={h('/#manifesto')} onClick={onClose}>
              <span className="mob-nav-label">{t('menu.about')}</span>
              <span className="mob-nav-num">03</span>
            </a>
            <Link className="mob-nav-item" to={p('/blog')} onClick={onClose}>
              <span className="mob-nav-label">{t('nav.blog')}</span>
              <span className="mob-nav-num">04</span>
            </Link>
            <a className="mob-nav-item" href={h('/#contact')} onClick={onClose}>
              <span className="mob-nav-label">{t('menu.contacts')}</span>
              <span className="mob-nav-num">05</span>
            </a>
            <div className="mob-cta-wrap">
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => { onClose(); onDiscuss() }}
              >
                {t('nav.discuss')}<span className="arrow">↗</span>
              </button>
            </div>
            <div className="mob-lang-switcher">
              <LanguageSwitcher />
            </div>
          </div>

        </div>
      </div>

      {/* ── Bottom strip ────────────────────────── */}
      <div className="mob-foot">
        <span>{t('footer.copyright')}</span>
        <span>Antalya · Warsaw · Berlin</span>
      </div>
    </div>
  )
}

function ContactPopup({ open, onClose, sourceMeta }: { open: boolean; onClose: () => void; sourceMeta: ContactSourceMeta | null }) {
  const [done, setDone] = useState(false)
  const { t } = useTranslation()
  const { p } = useLangPath()

  useEffect(() => {
    if (!open) { setDone(false); return }
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const fallbackSource = buildContactSource({
      block: 'Popup',
      button: t('contact_modal.submit'),
      utmMedium: 'popup',
      utmContent: 'contact-popup',
    })
    try {
      await fetch(CONTACT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...Object.fromEntries(fd),
          type: 'contact',
          source: sourceMeta?.source || fallbackSource.source,
          notes: sourceMeta?.notes || fallbackSource.notes,
        }),
      })
      trackEvent('contact_form_submit', {
        page_path: window.location.pathname,
        source_block: sourceMeta?.source || fallbackSource.source,
      })
    } catch {}
    setDone(true)
  }

  if (!open) return null

  return (
    <div className="popup-overlay" onClick={onClose} role="dialog" aria-modal>
      <div className="popup" onClick={e => e.stopPropagation()}>
        <button className="popup-close" onClick={onClose} aria-label={t('contact_modal.close')}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="1" y1="1" x2="13" y2="13"/><line x1="13" y1="1" x2="1" y2="13"/>
          </svg>
        </button>

        {done ? (
          <div className="popup-done">
            <div className="popup-done-check">✓</div>
            <h3>{t('contact_modal.success_title')}</h3>
            <p>{t('contact_modal.success_text')}</p>
            <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={onClose}>{t('contact_modal.close')}</button>
          </div>
        ) : (
          <div className="popup-inner-grid">
            <div className="popup-left">
              <div className="popup-eyebrow">{t('contact_modal.title')}</div>
              <h2 className="popup-title">{t('contact_modal.title')}</h2>
              <p className="popup-sub">{t('contact_modal.subtitle')}</p>
              <a href="https://t.me/" target="_blank" rel="noopener noreferrer" className="popup-tg-btn">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248-1.97 9.28c-.144.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.94z"/>
                </svg>
                Telegram
              </a>
              <div className="popup-contacts">
                <a href="mailto:vlad@lumiva.agency">{t('common.email')}</a>
                <a href="tel:+905383659678">{t('common.phone')}</a>
              </div>
            </div>

            <div className="popup-right">
              <form className="popup-form" onSubmit={handleSubmit}>
                <div className="popup-row-2">
                  <div className="popup-field">
                    <input name="name" placeholder={t('contact_modal.name')} required />
                  </div>
                  <div className="popup-field">
                    <input name="phone" placeholder={t('contact_modal.phone')} type="tel" />
                  </div>
                </div>
                <div className="popup-row-2">
                  <div className="popup-field">
                    <input name="company" placeholder={t('contact_modal.company')} />
                  </div>
                  <div className="popup-field">
                    <input name="email" placeholder={t('contact_modal.email')} type="email" required />
                  </div>
                </div>
                <div className="popup-field popup-select-wrap">
                  <select name="budget" defaultValue="">
                    <option value="" disabled>{t('contact_modal.budget')}</option>
                    <option>{t('contact_modal.budget_opt1')}</option>
                    <option>{t('contact_modal.budget_opt2')}</option>
                    <option>{t('contact_modal.budget_opt3')}</option>
                    <option>{t('contact_modal.budget_opt4')}</option>
                    <option>{t('contact_modal.budget_opt5')}</option>
                  </select>
                </div>
                <div className="popup-field">
                  <textarea name="message" placeholder={t('contact_modal.message')} rows={4} />
                </div>
                <button type="submit" className="btn btn-primary popup-submit">
                  {t('contact_modal.submit')}<span className="arrow">↗</span>
                </button>
                <p className="popup-legal">
                  <Link to={p('/privacy-policy')} onClick={onClose}>{t('footer.privacy')}</Link>
                </p>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CookieBanner() {
  const [visible, setVisible] = useState(false)
  const { t } = useTranslation()
  const { p } = useLangPath()

  useEffect(() => {
    try {
      setVisible(localStorage.getItem(COOKIE_CONSENT_KEY) !== 'accepted')
    } catch {
      setVisible(false)
    }
  }, [])

  const acceptCookies = () => {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted')
    } catch {}
    setVisible(false)
  }

  // Online chat bubble (lumiva-chat.js) lives in the same corner — lift it above the banner.
  const bannerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const w = window as unknown as {
      LumivaChatConfig?: { bottom?: number }
      LumivaChat?: { setBottom: (px: number) => void }
    }
    const apply = (px: number) => {
      w.LumivaChatConfig = { ...(w.LumivaChatConfig || {}), bottom: px }
      w.LumivaChat?.setBottom(px)
    }
    const el = bannerRef.current
    if (!visible || !el) {
      apply(20)
      return
    }
    const update = () => apply(Math.round(window.innerHeight - el.getBoundingClientRect().top) + 12)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    window.addEventListener('resize', update)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [visible])

  if (!visible) return null

  return (
    <div className="cookie-banner" role="dialog" aria-live="polite" ref={bannerRef}>
      <div className="cookie-banner-inner">
        <h2>{t('cookies.title')}</h2>
        <p>
          {t('cookies.text')}{' '}
          <Link to={p('/privacy-policy')} className="cookie-policy-link">
            {t('cookies.policy')}
          </Link>
          .
        </p>
        <button type="button" className="cookie-accept" onClick={acceptCookies}>
          {t('cookies.ok')}
        </button>
      </div>
    </div>
  )
}

function Footer() {
  const [newsletterDone, setNewsletterDone] = useState(false)
  const { t, i18n } = useTranslation()
  const { p, h } = useLangPath()
  const langKey = i18n.language?.startsWith('ru') ? 'ru' : i18n.language?.startsWith('tr') ? 'tr' : 'en'

  const handleNewsletter = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const email = (e.currentTarget.elements.namedItem('email') as HTMLInputElement).value
    try {
      await fetch('https://pl2.lumiva.agency/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, lang: langKey, source: 'footer' }),
      })
      trackEvent('newsletter_submit', { page_path: window.location.pathname })
    } catch {}
    setNewsletterDone(true)
  }

  return (
    <footer>
      <div className="foot-big">
        <div className="foot-wm">Lumiva.</div>
      </div>
      <div className="wrap">
        <div className="foot-cols">
          <div>
            <h5>Lumiva — Brand &amp; Marketing Studio</h5>
            <p style={{ maxWidth: '42ch', color: 'rgba(255,255,255,.7)', marginTop: 0 }}>
              {t('blog.subscribe_sub2')}
            </p>
            <form className="foot-newsletter" onSubmit={handleNewsletter}>
              <input type="email" name="email" placeholder={t('footer.newsletter_placeholder')} required />
              <button type="submit">{newsletterDone ? t('footer.subscribed') : t('footer.subscribe')}</button>
            </form>
            <p className="foot-legal">
              <Link to={p('/privacy-policy')}>{t('footer.privacy')}</Link>
            </p>
          </div>

          <div>
            <h5>{t('footer.services')}</h5>
            <ul>
              <li><Link to={p('/services')}>{t('nav.all_services')}</Link></li>
              <li><Link to={p('/services/development')}>{t('footer.development')}</Link></li>
              <li><Link to={p('/services/design')}>{t('footer.design')}</Link></li>
              <li><Link to={p('/services/analytics')}>{t('footer.analytics')}</Link></li>
              <li><Link to={p('/services/seo')}>{t('footer.seo')}</Link></li>
              <li><a href="https://crm.lumiva.agency/" target="_blank" rel="noopener noreferrer">CRM</a></li>
            </ul>
          </div>

          <div>
            <h5>{t('footer.studio')}</h5>
            <ul>
              <li><Link to={p('/cases')}>{t('footer.cases')}</Link></li>
              <li><Link to={p('/blog')}>{t('nav.blog')}</Link></li>
              <li><a href={h('/#manifesto')}>{t('footer.manifesto')}</a></li>
              <li><a href={h('/#team')}>{t('nav.team')}</a></li>
            </ul>
          </div>

          <div>
            <h5>Antalya &amp; Turkey</h5>
            <ul>
              <li><Link to="/digital-marketing-agency-antalya">Digital Marketing Antalya</Link></li>
              <li><Link to="/seo-agency-antalya">SEO Agency Antalya</Link></li>
              <li><Link to="/web-development-antalya">Web Development Antalya</Link></li>
              <li><Link to="/crm-development-turkey">CRM Development Turkey</Link></li>
              <li><Link to="/hotel-marketing-agency-turkey">Hotel Marketing Turkey</Link></li>
            </ul>
          </div>

          <div>
            <h5>{t('menu.contacts')}</h5>
            <ul>
              <li><a href="mailto:vlad@lumiva.agency">vlad@lumiva.agency</a></li>
              <li><a href="tel:+905383659678">+90 538 365 96 78</a></li>
              <li>Antalya, Turkey</li>
              <li><a href="https://t.me/" target="_blank" rel="noopener noreferrer">Telegram</a></li>
              <li><a href="https://linkedin.com/" target="_blank" rel="noopener noreferrer">LinkedIn</a></li>
              <li><Link to={p('/privacy-policy')}>{t('footer.privacy')}</Link></li>
              <li><Link to={p('/terms-of-service')}>Terms of Service</Link></li>
              <li><Link to={p('/cookie-policy')}>Cookie Policy</Link></li>
            </ul>
          </div>
        </div>

        <div className="foot-bot">
          <div>{t('footer.copyright')}</div>
          <div>{t('footer.offices')}</div>
        </div>
      </div>
    </footer>
  )
}

export default function Layout() {
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [popupOpen, setPopupOpen] = useState(false)
  const [popupSource, setPopupSource] = useState<ContactSourceMeta | null>(null)

  const openContactPopup = (source: ContactSourceMeta) => {
    trackEvent('contact_popup_open', { source_block: source.source, page_path: window.location.pathname })
    setPopupSource(source)
    setPopupOpen(true)
  }

  const openHeaderPopup = () => openContactPopup(buildContactSource({
    block: 'Header',
    button: 'Discuss Project',
    utmMedium: 'header',
    utmContent: 'discuss-project',
  }))

  useEffect(() => {
    markPricingContactLinks()
    const observer = new MutationObserver(markPricingContactLinks)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [location.pathname])

  useEffect(() => {
    const handleContactClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return
      const anchor = event.target.closest('a[href]') as HTMLAnchorElement | null
      if (!anchor) return
      const href = anchor.getAttribute('href') || ''

      if (href.startsWith('tel:')) {
        trackEvent('phone_click', { page_path: window.location.pathname, href })
      } else if (href.startsWith('mailto:')) {
        trackEvent('email_click', { page_path: window.location.pathname, href })
      } else if (href.includes('t.me/')) {
        trackEvent('telegram_click', { page_path: window.location.pathname, href })
      } else if (href === '/#contact' || href === '#contact') {
        trackEvent('cta_click', { page_path: window.location.pathname, label: cleanText(anchor) })
      }

      if (href !== '/#contact' && href !== '#contact') return

      const pricingSource = getPricingContactSource(anchor)
      if (!pricingSource) return

      event.preventDefault()
      openContactPopup(pricingSource)
    }

    document.addEventListener('click', handleContactClick)
    return () => document.removeEventListener('click', handleContactClick)
  }, [])

  return (
    <>
      <Topbar />
      <Nav menuOpen={menuOpen} onToggle={() => setMenuOpen(m => !m)} onDiscuss={openHeaderPopup} />
      <div className="site-content">
        <Outlet />
        <Footer />
      </div>
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} onDiscuss={openHeaderPopup} />
      <ContactPopup open={popupOpen} onClose={() => setPopupOpen(false)} sourceMeta={popupSource} />
      <CookieBanner />
    </>
  )
}
