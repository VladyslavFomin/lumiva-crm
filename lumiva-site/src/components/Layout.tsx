import { Outlet, Link, useLocation } from 'react-router-dom'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLangPath } from '../hooks/useLangPath'
import { trackEvent } from '../lib/analytics'
import { SiteHeader, SiteFooter } from './lh/SiteChrome'
import { LIc, LI, useRevealAll } from './lh/kit'
import { useSiteMotion } from './lh/siteMotion'
import { HeroArtMount } from './lh/HeroArt'

export const CONTACT_ENDPOINT = 'https://pl2.lumiva.agency/api/forms/submit'
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

export function buildContactSource(input: ContactSourceInput): ContactSourceMeta {
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
    <div className="lh-modal-bg" onClick={onClose} role="dialog" aria-modal>
      <div className="lh-login" onClick={e => e.stopPropagation()}>
        <div className="lh-login-glow" />
        <button type="button" className="lh-x" onClick={onClose} aria-label={t('contact_modal.close')}><LIc d={LI.x} size={16} /></button>
        {done ? (
          <>
            <span className="lh-logo"><span className="lh-logo-m"><i /></span>Lumiva<span className="lh-logo-s">AGENCY</span></span>
            <h3>{t('contact_modal.success_title')}</h3>
            <p>{t('contact_modal.success_text')}</p>
            <button type="button" className="lh-btn lg block" onClick={onClose}>{t('contact_modal.close')}</button>
          </>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
            <span className="lh-logo"><span className="lh-logo-m"><i /></span>Lumiva<span className="lh-logo-s">AGENCY</span></span>
            <h3>{t('contact_modal.title')}</h3>
            <p>{t('contact_modal.subtitle')}</p>
            <div className="f2">
              <label className="lh-fld"><input name="name" placeholder={t('contact_modal.name')} required /></label>
              <label className="lh-fld"><input name="phone" placeholder={t('contact_modal.phone')} type="tel" /></label>
            </div>
            <div className="f2">
              <label className="lh-fld"><input name="company" placeholder={t('contact_modal.company')} /></label>
              <label className="lh-fld"><LIc d={LI.mail} size={15} /><input name="email" placeholder={t('contact_modal.email')} type="email" required /></label>
            </div>
            <label className="lh-fld">
              <select name="budget" defaultValue="" aria-label={t('contact_modal.budget')}>
                <option value="" disabled>{t('contact_modal.budget')}</option>
                <option>{t('contact_modal.budget_opt1')}</option>
                <option>{t('contact_modal.budget_opt2')}</option>
                <option>{t('contact_modal.budget_opt3')}</option>
                <option>{t('contact_modal.budget_opt4')}</option>
                <option>{t('contact_modal.budget_opt5')}</option>
              </select>
            </label>
            <label className="lh-fld ta"><textarea name="message" placeholder={t('contact_modal.message')} rows={4} /></label>
            <button type="submit" className="lh-btn lg block">{t('contact_modal.submit')}<LIc d={LI.ne} size={15} sw={2} /></button>
            <div className="ctl">
              <a href="https://t.me/" target="_blank" rel="noopener noreferrer">Telegram</a>
              <a href="mailto:vlad@lumiva.agency">{t('common.email')}</a>
              <a href="tel:+905383659678">{t('common.phone')}</a>
              <Link to={p('/privacy-policy')} onClick={onClose} style={{ marginLeft: 'auto' }}>{t('footer.privacy')}</Link>
            </div>
          </form>
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

export default function Layout() {
  const location = useLocation()
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

  useRevealAll(location.pathname)
  useSiteMotion(location.pathname)

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
      <SiteHeader onDiscuss={openHeaderPopup} />
      <div className="site-content">
        <Suspense fallback={<div style={{ minHeight: '100vh' }} />}>
          <Outlet />
        </Suspense>
        <SiteFooter />
      </div>
      <HeroArtMount />
      <ContactPopup open={popupOpen} onClose={() => setPopupOpen(false)} sourceMeta={popupSource} />
      <CookieBanner />
    </>
  )
}
