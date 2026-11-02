/* Общие примитивы дизайна lumiva-agency-home-v2 (Claude Design, components/lh-parts.jsx + ag-home-a.jsx). */
import { useEffect, useState, type ReactNode, type RefObject } from 'react'

export const LIc = ({ d, size = 16, sw = 1.6 }: { d: ReactNode; size?: number; sw?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
)

export const LI = {
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  spark: <><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></>,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12l5 5 9-10" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
  web: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 13h8M8 16h5" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></>,
  pen: <><path d="M12 19l7-7 3 3-7 7z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18z" /><circle cx="11" cy="11" r="2" /></>,
  trend: <><path d="M22 7l-8.5 8.5-5-5L2 17" /><path d="M16 7h6v6" /></>,
  cam: <><path d="M14.5 4h-5L7 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2h-3z" /><circle cx="12" cy="13" r="3" /></>,
  users: <><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
  flow: <><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="13" width="8" height="8" rx="2" /><path d="M7 11v4a2 2 0 002 2h4" /></>,
  award: <><circle cx="12" cy="9" r="6" /><path d="M8.5 14L7 22l5-3 5 3-1.5-8" /></>,
  ne: <path d="M7 17L17 7M8 7h9v9" />,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
}

export function useInView(ref: RefObject<Element | null>, once = false) {
  const [v, setV] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => {
      setV(e.isIntersecting)
      if (once && e.isIntersecting) io.disconnect()
    }, { threshold: 0.2 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return v
}

export function useCountUp(to: number, on: boolean, dur = 1400) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!on) return
    let raf = 0
    let t0 = 0
    const f = (t: number) => {
      if (!t0) t0 = t
      const p = Math.min(1, (t - t0) / dur)
      setV(to * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(f)
    }
    raf = requestAnimationFrame(f)
    return () => cancelAnimationFrame(raf)
  }, [on, to])
  return v
}

export const Cnt = ({ to, dec = 0, on = true, dur }: { to: number; dec?: number; on?: boolean; dur?: number }) => {
  const v = useCountUp(to, on, dur)
  return <>{v.toFixed(dec)}</>
}

export const LhDoing = ({ list, ms = 2800 }: { list: string[]; ms?: number }) => {
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI(x => (x + 1) % list.length), ms)
    return () => clearInterval(t)
  }, [list.length, ms])
  return <span key={i} className="lh-doing-t">{list[i % list.length]}</span>
}

/** Появление .lh-rv при прокрутке — один наблюдатель на весь документ (как в макете). */
export function useRevealAll(dep: unknown) {
  useEffect(() => {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return
      const el = e.target as HTMLElement
      el.classList.add('in')
      io.unobserve(el)
      // после появления снимаем lh-rv и задержку, чтобы hover-трансформации карточек снова работали
      const d = parseFloat(el.style.transitionDelay) || 0
      setTimeout(() => { el.classList.remove('lh-rv'); el.style.transitionDelay = '' }, 1000 + d * 1000)
    }), { threshold: 0.12 })
    const scan = () => document.querySelectorAll('.lh-rv:not([data-rv])').forEach(el => { el.setAttribute('data-rv', ''); io.observe(el) })
    scan()
    const mo = new MutationObserver(scan)
    mo.observe(document.body, { childList: true, subtree: true })
    return () => { mo.disconnect(); io.disconnect() }
  }, [dep])
}

