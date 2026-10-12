import { useEffect, useRef } from 'react'

export function useReveal() {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const targets = el.querySelectorAll<HTMLElement>(
      '.svc, .case, .stat-cell, .step, .person, .quote, .award, .extra, .svc-card, .ind-cell, .faq-item, .dt, .princ .p, .sec-head, .deliv-row, .tier, .cm'
    )

    targets.forEach(t => t.classList.add('reveal'))

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) e.target.classList.add('in')
        })
      },
      { threshold: 0.1 }
    )

    targets.forEach(t => observer.observe(t))
    return () => observer.disconnect()
  }, [])

  return ref
}
