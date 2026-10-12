declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    ym?: (...args: unknown[]) => void
  }
}

const YANDEX_METRIKA_ID = 109183320

export function trackEvent(name: string, params: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return

  if (typeof window.gtag === 'function') {
    window.gtag('event', name, params)
  }

  if (typeof window.ym === 'function') {
    window.ym(YANDEX_METRIKA_ID, 'reachGoal', name, params)
  }
}
