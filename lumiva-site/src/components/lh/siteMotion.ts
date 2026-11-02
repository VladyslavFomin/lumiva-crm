/* Моушн для внутренних страниц без правки каждой страницы: после рендера маршрута находит общие блоки
 * старой вёрстки и даёт им появление с каскадом (.lh-rv → useRevealAll), счётчики цифр, подсветку за курсором
 * и параллакс свечения в шапке. Тексты React не трогаем — только классы/стили и nodeValue числа, который
 * в конце возвращается к исходному значению. */
import { useEffect } from 'react'

const REVEAL = [
  '.sec-head', '.deliv-row', '.stack .chip', '.pmini-row', '.tier', '.svc-card', '.cm', '.ind-cell',
  '.hero-side-stats .s', '.policy-block', '.faq-item', '.cta-strip .grid > *', '.rel-svc a', '.seo-art-toc', '.seo-art-b > *',
  '.chap', '.case-grid .case', '.post-card', '.rel',
].join(',')
const SPOT = '.deliv-row, .rel-svc a, .svc-card, .tier:not(.featured)'
const COUNT = '.hero-side-stats .num, .stat-cell .num, .ag-num-x'
const GROUPS = '.pmini, .deliv, .stack, .pricing'

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function countUp(el: Element) {
  const node = Array.from(el.childNodes).find(n => n.nodeType === 3 && /\d/.test(n.nodeValue || '')) as Text | undefined
  if (!node) return
  const orig = node.nodeValue || ''
  const m = orig.match(/^(\D*?)(\d+(?:[.,]\d+)?)(.*)$/)
  if (!m) return
  const [, pre, num, post] = m
  const sep = num.includes(',') ? ',' : '.'
  const to = parseFloat(num.replace(',', '.'))
  if (!isFinite(to) || to === 0) return
  const dec = (num.split(/[.,]/)[1] || '').length
  const dur = 1300
  let t0 = 0
  let last = orig
  const step = (t: number) => {
    if (node.nodeValue !== last) return // React обновил текст (смена языка) — не мешаем
    if (!t0) t0 = t
    const p = Math.min(1, (t - t0) / dur)
    const v = to * (1 - Math.pow(1 - p, 3))
    last = p < 1 ? pre + v.toFixed(dec).replace('.', sep) + post : orig
    node.nodeValue = last
    if (p < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

export function useSiteMotion(path: string) {
  useEffect(() => {
    if (reduced()) return
    const root = document.querySelector('.site-content')
    if (!root) return

    const countIO = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { countIO.unobserve(e.target); countUp(e.target) }
    }), { threshold: 0.4 })
    const groupIO = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); groupIO.unobserve(e.target) }
    }), { threshold: 0.15 })

    const enhance = () => {
      root.querySelectorAll(REVEAL).forEach(el => {
        if ((el as HTMLElement).dataset.mo || el.closest('.lh')) return
        ;(el as HTMLElement).dataset.mo = '1'
        el.classList.add('lh-rv')
        const parent = el.parentElement
        if (parent) {
          const sib = Array.from(parent.children).filter(c => c.matches(REVEAL))
          const i = sib.indexOf(el)
          const cols = el.matches('.stack .chip') ? 12 : 4
          ;(el as HTMLElement).style.transitionDelay = `${Math.min(i % cols, 11) * (cols > 4 ? 0.035 : 0.07)}s`
        }
      })
      root.querySelectorAll(SPOT).forEach(el => el.classList.add('v2-spot'))
      root.querySelectorAll(COUNT).forEach(el => {
        if ((el as HTMLElement).dataset.cnt) return
        ;(el as HTMLElement).dataset.cnt = '1'
        countIO.observe(el)
      })
      root.querySelectorAll(GROUPS).forEach(el => {
        if ((el as HTMLElement).dataset.grp) return
        ;(el as HTMLElement).dataset.grp = '1'
        groupIO.observe(el)
      })
      // RelatedServices / pmini: описание, совпадающее с заголовком, прячем
      root.querySelectorAll('.pmini-row').forEach(r => {
        const h = r.querySelector('.pmini-h')?.textContent?.trim()
        const d = r.querySelector('.pmini-d') as HTMLElement | null
        if (d) d.style.display = h && d.textContent?.trim() === h ? 'none' : ''
      })
    }

    let raf = 0
    const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(enhance) }
    schedule()
    const mo = new MutationObserver(schedule)
    mo.observe(root, { childList: true, subtree: true })

    const onMove = (e: PointerEvent) => {
      const t = e.target as Element | null
      const card = t?.closest?.('.v2-spot') as HTMLElement | null
      if (card) {
        const r = card.getBoundingClientRect()
        card.style.setProperty('--x', e.clientX - r.left + 'px')
        card.style.setProperty('--y', e.clientY - r.top + 'px')
      }
      const hero = t?.closest?.('.page-hero, .case-hero') as HTMLElement | null
      if (hero) {
        const r = hero.getBoundingClientRect()
        hero.style.setProperty('--hx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3))
        hero.style.setProperty('--hy', ((e.clientY - r.top) / r.height - 0.5).toFixed(3))
      }
    }
    document.addEventListener('pointermove', onMove, { passive: true })

    return () => {
      cancelAnimationFrame(raf)
      mo.disconnect(); countIO.disconnect(); groupIO.disconnect()
      document.removeEventListener('pointermove', onMove)
    }
  }, [path])
}
