import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCaseById, createCase, updateCase, uploadMedia, translateCaseContent } from '../api'
import toast from 'react-hot-toast'
import { Plus, Trash2, ChevronDown, ChevronUp, GripVertical, Upload, X, ExternalLink, RefreshCw, Languages } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

const LANGS = [
  { code: 'ru', label: 'Русский', flag: 'RU' },
  { code: 'en', label: 'English', flag: 'EN' },
  { code: 'tr', label: 'Türkçe', flag: 'TR' },
]

interface Kpi { value: string; prefix: string; suffix: string; label: string; source: string }
interface Chapter { id: string; num: string; title: string; lead: string }
interface Testimonial { quote: string; authorName: string; authorRole: string; authorInitials: string }
interface Challenge { index: string; category: string; title: string; body: string }
interface ApproachItem { num: string; title: string; body: string }
interface TimelineRow { week: string; phase: string; description: string }
interface Color { hex: string; label: string; dark: boolean }
interface Deliverable { name: string; category: string }
interface FunnelRow { name: string; width: string; label: string }
interface NextMeta { label: string; value: string }

interface Settings {
  showBrief: boolean; showChallenge: boolean; showApproach: boolean
  showTimeline: boolean; showIdentity: boolean; showDigital: boolean; showResults: boolean
  showLogomark: boolean; showTypography: boolean; showPalette: boolean
  showCardMock: boolean; showWebMock: boolean; showPrintSpread: boolean
  showBeforeAfter: boolean; showDeliverables: boolean
}

const DEFAULT_SETTINGS: Settings = {
  showBrief: true, showChallenge: true, showApproach: true,
  showTimeline: true, showIdentity: true, showDigital: true, showResults: true,
  showLogomark: true, showTypography: true, showPalette: true,
  showCardMock: true, showWebMock: true, showPrintSpread: true,
  showBeforeAfter: true, showDeliverables: true,
}

const emptyKpi = (): Kpi => ({ value: '', prefix: '', suffix: '', label: '', source: '' })
const emptyChapter = (): Chapter => ({ id: '', num: '', title: '', lead: '' })
const emptyTestimonial = (): Testimonial => ({ quote: '', authorName: '', authorRole: '', authorInitials: '' })
const emptyChallenge = (): Challenge => ({ index: '', category: '', title: '', body: '' })
const emptyApproach = (): ApproachItem => ({ num: '', title: '', body: '' })
const emptyTimeline = (): TimelineRow => ({ week: '', phase: '', description: '' })
const emptyColor = (): Color => ({ hex: '#222222', label: '', dark: false })
const emptyDeliverable = (): Deliverable => ({ name: '', category: '' })
const emptyFunnel = (): FunnelRow => ({ name: '', width: '', label: '' })
const emptyNextMeta = (): NextMeta => ({ label: '', value: '' })

// ─── UI primitives ────────────────────────────────────────────────────────────

const inp = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white'
const lbl = 'block text-xs font-medium text-gray-500 mb-1'
const ta = `${inp} resize-none`

function Field({ label, value, onChange, type = 'text', rows, placeholder }: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; rows?: number; placeholder?: string
}) {
  return (
    <div>
      <label className={lbl}>{label}</label>
      {rows
        ? <textarea rows={rows} value={value} onChange={e => onChange(e.target.value)} className={ta} placeholder={placeholder} />
        : <input type={type} value={value} onChange={e => onChange(e.target.value)} className={inp} placeholder={placeholder} />
      }
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onChange(!checked) }}
      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 focus:outline-none ${checked ? 'bg-violet-600' : 'bg-gray-200'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-150 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  )
}

function ArrayEditor<T extends object>({ label, items, onChange, emptyItem, renderRow }: {
  label: string; items: T[]; onChange: (items: T[]) => void; emptyItem: () => T
  renderRow: (item: T, update: (patch: Partial<T>) => void, remove: () => void, idx: number) => React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
        <button type="button" onClick={() => onChange([...items, emptyItem()])}
          className="flex items-center gap-1 px-2.5 py-1 text-xs text-violet-600 border border-violet-200 rounded-lg hover:bg-violet-50 transition-colors">
          <Plus size={12} />Добавить
        </button>
      </div>
      <div className="space-y-3">
        {items.map((item, idx) => renderRow(
          item,
          (patch) => onChange(items.map((x, i) => i === idx ? { ...x, ...patch } : x)),
          () => onChange(items.filter((_, i) => i !== idx)),
          idx,
        ))}
        {items.length === 0 && (
          <div className="text-xs text-gray-400 py-3 text-center border border-dashed border-gray-200 rounded-lg">
            Нет элементов. Нажмите «Добавить».
          </div>
        )}
      </div>
    </div>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-gray-50 border border-gray-200 rounded-xl p-4 ${className}`}>{children}</div>
}

function ItemRow({ onRemove, children }: { onRemove: () => void; children: React.ReactNode }) {
  return (
    <Card>
      <div className="flex gap-2">
        <div className="flex-1 space-y-2">{children}</div>
        <button type="button" onClick={onRemove}
          className="self-start p-1.5 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
          <Trash2 size={14} />
        </button>
      </div>
    </Card>
  )
}

// ─── Section wrapper with toggle ──────────────────────────────────────────────

function Section({ id, title, icon, children, defaultOpen = true, enabled, onToggle }: {
  id: string; title: string; icon: string; children: React.ReactNode; defaultOpen?: boolean
  enabled?: boolean; onToggle?: () => void
}) {
  const [open, setOpen] = useState(defaultOpen)
  const isDisabled = enabled === false
  return (
    <div id={id} className={`bg-white rounded-2xl border overflow-hidden ${isDisabled ? 'opacity-60 border-gray-100' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors">
        <button type="button" onClick={() => setOpen(o => !o)} className="flex items-center gap-3 flex-1 text-left min-w-0">
          <span className="text-base">{icon}</span>
          <span className={`font-semibold text-sm truncate ${isDisabled ? 'text-gray-400' : 'text-gray-900'}`}>{title}</span>
          {isDisabled && <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full flex-shrink-0">скрыт</span>}
        </button>
        <div className="flex items-center gap-3 flex-shrink-0">
          {onToggle && <Toggle checked={!isDisabled} onChange={() => onToggle()} />}
          <button type="button" onClick={() => setOpen(o => !o)} className="text-gray-400 hover:text-gray-600">
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>
      {open && <div className="px-6 pb-6 space-y-4 border-t border-gray-100 pt-4">{children}</div>}
    </div>
  )
}

// ─── Main editor ─────────────────────────────────────────────────────────────

export default function CaseEditorPage() {
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [basic, setBasic] = useState({
    clientName: '', slug: '', industry: '', year: String(new Date().getFullYear()),
    shortResult: '', resultValue: '', resultUnit: '', coverUrl: '',
    tags: '', services: '', status: 'draft', featured: false,
  })
  const [hero, setHero] = useState({
    segment: '', markets: '', duration: '', teamSize: '', leadText: '',
    coverWatermark: '', coverCaption: '', coverRibbon: '',
  })
  const [kpis, setKpis] = useState<Kpi[]>([emptyKpi(), emptyKpi(), emptyKpi(), emptyKpi()])
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [testimonials, setTestimonials] = useState<Testimonial[]>([emptyTestimonial(), emptyTestimonial()])
  const [challenges, setChallenges] = useState<Challenge[]>([emptyChallenge(), emptyChallenge(), emptyChallenge()])
  const [approachItems, setApproachItems] = useState<ApproachItem[]>([emptyApproach(), emptyApproach(), emptyApproach(), emptyApproach()])
  const [timeline, setTimeline] = useState<TimelineRow[]>([])
  const [identity, setIdentity] = useState({ primaryFont: '', bodyFont: '', wordmark: '', cardNumber: '' })
  const [colors, setColors] = useState<Color[]>([])
  const [deliverables, setDeliverables] = useState<Deliverable[]>([])
  const [beforeAfter, setBeforeAfter] = useState({ beforeText: '', beforeDescription: '', afterDescription: '' })
  const [metrics, setMetrics] = useState({ lineChartTitle: '', lineChartValue: '', lineChartDelta: '' })
  const [funnelData, setFunnelData] = useState<FunnelRow[]>([])
  const [nextCase, setNextCase] = useState({ nextCaseSlug: '', nextCaseTitle: '', nextCaseDeco: '' })
  const [nextCaseMeta, setNextCaseMeta] = useState<NextMeta[]>([])
  const [seo, setSeo] = useState({ seoTitle: '', seoDescription: '' })
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS })
  const [customHtml, setCustomHtml] = useState('')
  const [customCss, setCustomCss] = useState('')
  const [coverUploading, setCoverUploading] = useState(false)
  const [previewKey, setPreviewKey] = useState(0)
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop')
  const [translations, setTranslations] = useState<Record<string, any>>({})
  const [langs, setLangs] = useState<string[]>(['ru'])
  const [translatingLang, setTranslatingLang] = useState<string | null>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  function setSetting(key: keyof Settings) {
    setSettings(s => ({ ...s, [key]: !s[key] }))
  }

  async function handleCoverFile(file: File) {
    if (!file.type.startsWith('image/')) { toast.error('Только изображения'); return }
    setCoverUploading(true)
    try {
      const result = await uploadMedia(file)
      setBasic(f => ({ ...f, coverUrl: result.url }))
    } catch { toast.error('Ошибка загрузки') } finally { setCoverUploading(false) }
  }

  // ─── Load existing ─────────────────────────────────────────────────────────

  const { data } = useQuery({
    queryKey: ['case', id],
    queryFn: () => getCaseById(Number(id)),
    enabled: !isNew,
  })

  useEffect(() => {
    if (!isNew && data) {
      const c = data
      setBasic({
        clientName: c.clientName || '', slug: c.slug || '', industry: c.industry || '',
        year: String(c.year || new Date().getFullYear()),
        shortResult: c.shortResult || '', resultValue: c.resultValue || '',
        resultUnit: c.resultUnit || '', coverUrl: c.coverUrl || '',
        tags: Array.isArray(c.tags) ? c.tags.join(', ') : '',
        services: Array.isArray(c.services) ? c.services.join(', ') : '',
        status: c.status || 'draft', featured: c.featured || false,
      })
      setHero({
        segment: c.segment || '', markets: c.markets || '', duration: c.duration || '',
        teamSize: c.teamSize || '', leadText: c.leadText || '',
        coverWatermark: c.coverWatermark || '', coverCaption: c.coverCaption || '', coverRibbon: c.coverRibbon || '',
      })
      if (Array.isArray(c.kpis) && c.kpis.length) setKpis(c.kpis)
      if (Array.isArray(c.chapters) && c.chapters.length) setChapters(c.chapters)
      if (Array.isArray(c.testimonials) && c.testimonials.length) setTestimonials(c.testimonials)
      if (Array.isArray(c.challenges) && c.challenges.length) setChallenges(c.challenges)
      if (Array.isArray(c.approachItems) && c.approachItems.length) setApproachItems(c.approachItems)
      if (Array.isArray(c.timeline) && c.timeline.length) setTimeline(c.timeline)
      setIdentity({
        primaryFont: c.primaryFont || '', bodyFont: c.bodyFont || '',
        wordmark: c.wordmark || '', cardNumber: c.cardNumber || '',
      })
      if (Array.isArray(c.colors) && c.colors.length) setColors(c.colors)
      if (Array.isArray(c.deliverables) && c.deliverables.length) setDeliverables(c.deliverables)
      setBeforeAfter({
        beforeText: c.beforeText || '', beforeDescription: c.beforeDescription || '', afterDescription: c.afterDescription || '',
      })
      setMetrics({
        lineChartTitle: c.lineChartTitle || '', lineChartValue: c.lineChartValue || '', lineChartDelta: c.lineChartDelta || '',
      })
      if (Array.isArray(c.funnelData) && c.funnelData.length) setFunnelData(c.funnelData)
      setNextCase({ nextCaseSlug: c.nextCaseSlug || '', nextCaseTitle: c.nextCaseTitle || '', nextCaseDeco: c.nextCaseDeco || '' })
      if (Array.isArray(c.nextCaseMeta) && c.nextCaseMeta.length) setNextCaseMeta(c.nextCaseMeta)
      setSeo({ seoTitle: c.seoTitle || '', seoDescription: c.seoDescription || '' })
      if (c.settings && typeof c.settings === 'object') setSettings({ ...DEFAULT_SETTINGS, ...c.settings })
      setCustomHtml(c.customHtml || '')
      setCustomCss(c.customCss || '')
      if (c.translations && typeof c.translations === 'object') setTranslations(c.translations)
      if (Array.isArray(c.langs) && c.langs.length) setLangs(c.langs)
    }
  }, [id, data, isNew])

  // ─── Auto-translate ────────────────────────────────────────────────────────
  // Translating a single language runs on-demand — as soon as a language is
  // switched on (or refreshed), not as one combined EN+TR batch action.

  async function translateLang(langCode: 'en' | 'tr') {
    if (!basic.clientName.trim()) { toast.error('Сначала заполните кейс на русском'); return }
    setTranslatingLang(langCode)
    try {
      const content = buildPayload()
      const result = await translateCaseContent({
        ...content,
        targetLangs: [langCode],
        existing: translations,
      })
      if (result[langCode]) {
        setTranslations(t => ({ ...t, [langCode]: result[langCode] }))
        setLangs(ls => Array.from(new Set([...ls, langCode])))
        toast.success(`Переведено на ${langCode.toUpperCase()}`)
      }
    } catch {
      toast.error('Ошибка перевода. Попробуйте ещё раз.')
    } finally {
      setTranslatingLang(null)
    }
  }

  function toggleLang(langCode: 'en' | 'tr', enabled: boolean) {
    if (enabled) {
      setLangs(ls => Array.from(new Set([...ls, langCode])))
      // Only kick off a translation if we don't already have saved content for it
      const hasContent = translations[langCode] && Object.keys(translations[langCode]).length > 0
      if (!hasContent) translateLang(langCode)
    } else {
      setLangs(ls => ls.filter(l => l !== langCode))
    }
  }

  // ─── Save ──────────────────────────────────────────────────────────────────

  const save = useMutation({
    mutationFn: (payload: any) => isNew ? createCase(payload) : updateCase(Number(id), payload),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['cases'] })
      if (!isNew) qc.invalidateQueries({ queryKey: ['case', id] })
      toast.success(isNew ? 'Кейс создан' : 'Сохранено')
      setPreviewKey(k => k + 1)
      if (isNew) navigate(`/cases/${res.id}`)
    },
    onError: () => toast.error('Ошибка сохранения'),
  })

  function buildPayload(status?: string) {
    const finalStatus = status || basic.status
    const autoSeoTitle = seo.seoTitle || `${basic.clientName} — Lumiva Agency`
    const autoSeoDesc = seo.seoDescription || hero.leadText || basic.shortResult || ''
    return {
      ...basic, ...hero, ...identity, ...beforeAfter, ...metrics, ...nextCase,
      seoTitle: autoSeoTitle, seoDescription: autoSeoDesc,
      year: Number(basic.year),
      tags: basic.tags.split(',').map(t => t.trim()).filter(Boolean),
      services: basic.services.split(',').map(s => s.trim()).filter(Boolean),
      status: finalStatus,
      kpis, chapters, testimonials, challenges, approachItems, timeline,
      colors, deliverables, funnelData, nextCaseMeta,
      settings, customHtml, customCss,
      translations, langs,
    }
  }

  // ─── Sidebar nav ──────────────────────────────────────────────────────────

  const sidebarSections = [
    { id: 's-basic', label: 'Основное', icon: '📋' },
    { id: 's-hero', label: 'Герой', icon: '🎯' },
    { id: 's-kpi', label: 'KPI', icon: '📊' },
    { id: 's-chapters', label: 'Главы', icon: '📑' },
    { id: 's-brief', label: 'Бриф & цитата', icon: '💬' },
    { id: 's-challenges', label: 'Вызовы', icon: '⚡' },
    { id: 's-approach', label: 'Подход', icon: '🧩' },
    { id: 's-timeline', label: 'Хронология', icon: '📅' },
    { id: 's-identity', label: 'Идентика', icon: '🎨' },
    { id: 's-ba', label: 'До / После', icon: '🔄' },
    { id: 's-metrics', label: 'Метрики', icon: '📈' },
    { id: 's-results', label: 'Результаты', icon: '🏆' },
    { id: 's-nextcase', label: 'Следующий кейс', icon: '➡️' },
    { id: 's-custom', label: 'HTML / CSS', icon: '🖥️' },
    { id: 's-seo', label: 'SEO', icon: '🔍' },
  ]

  const previewUrl = basic.slug ? `https://lumiva.agency/cases/${basic.slug}` : ''

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">

      {/* ── LEFT HALF: editor ── */}
      <div className="flex overflow-hidden flex-shrink-0 w-full md:w-1/2">

        {/* Sidebar nav — desktop only */}
        <aside className="hidden md:flex w-44 flex-shrink-0 bg-white border-r border-gray-200 flex-col">
          <div className="p-4 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Разделы</p>
          </div>
          <nav className="flex-1 overflow-y-auto py-2">
            {sidebarSections.map(s => (
              <button key={s.id} type="button"
                onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="w-full flex items-center gap-2 px-4 py-2 text-xs text-gray-600 hover:bg-violet-50 hover:text-violet-700 transition-colors text-left">
                <span>{s.icon}</span>
                <span className="truncate">{s.label}</span>
              </button>
            ))}
          </nav>
          <div className="p-3 border-t border-gray-100 space-y-2">
            <button type="button" onClick={() => save.mutate(buildPayload('draft'))} disabled={save.isPending}
              className="w-full px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs hover:bg-gray-50 disabled:opacity-50 transition-colors">
              Черновик
            </button>
            <button type="button" onClick={() => save.mutate(buildPayload('published'))} disabled={save.isPending}
              className="w-full px-3 py-2 bg-violet-600 text-white rounded-lg text-xs font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors">
              {save.isPending ? 'Сохраняем…' : 'Опубликовать'}
            </button>
          </div>
        </aside>

        {/* Form */}
        <main className="flex-1 overflow-y-auto min-w-0">
          {/* Top bar */}
          <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between gap-2">
            <h1 className="text-sm font-bold text-gray-900 truncate">
              {isNew ? 'Новый кейс' : (basic.clientName || '…')}
            </h1>
            <div className="flex items-center gap-2 flex-shrink-0">
              {previewUrl && (
                <a href={previewUrl} target="_blank" rel="noopener noreferrer"
                  className="md:hidden flex items-center gap-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                  <ExternalLink size={12} /> Сайт
                </a>
              )}
              <select value={basic.status} onChange={e => setBasic(f => ({ ...f, status: e.target.value }))}
                className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="draft">Черновик</option>
                <option value="published">Опубликован</option>
              </select>
              <div className="flex items-center gap-1 px-1 py-1 border border-gray-200 rounded-lg" title="Включите язык — перевод запустится автоматически">
                <Languages size={12} className="text-gray-400 ml-1" />
                {LANGS.map(l => {
                  const isRu = l.code === 'ru'
                  const isEnabled = isRu || langs.includes(l.code)
                  const isTranslating = translatingLang === l.code
                  const hasContent = isRu || (translations[l.code] && Object.keys(translations[l.code]).length > 0)
                  return (
                    <button key={l.code} type="button"
                      disabled={isRu || isTranslating}
                      onClick={() => !isRu && toggleLang(l.code as 'en' | 'tr', !isEnabled)}
                      title={isRu ? 'Всегда включён' : isEnabled ? `Выключить ${l.label}` : `Включить и перевести на ${l.label}`}
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-mono font-medium transition-colors disabled:cursor-wait"
                      style={{
                        background: isEnabled ? '#111827' : 'transparent',
                        color: isEnabled ? '#fff' : '#9ca3af',
                        opacity: isRu ? 0.55 : 1,
                      }}>
                      {isTranslating
                        ? <div className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(255,255,255,.35)', borderTopColor: '#fff' }} />
                        : l.flag}
                      {isEnabled && !isRu && hasContent && !isTranslating && (
                        <RefreshCw size={10} className="opacity-60 hover:opacity-100"
                          onClick={e => { e.stopPropagation(); translateLang(l.code as 'en' | 'tr') }} />
                      )}
                    </button>
                  )
                })}
              </div>
              <button type="button" onClick={() => save.mutate(buildPayload())} disabled={save.isPending}
                className="px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors">
                {save.isPending ? 'Сохраняем…' : 'Сохранить'}
              </button>
            </div>
          </div>

          {/* Mobile section nav — scrollable pill strip */}
          <div className="md:hidden flex overflow-x-auto gap-2 px-4 py-2 bg-white border-b border-gray-100 no-scrollbar">
            {sidebarSections.map(sec => (
              <button key={sec.id} type="button"
                onClick={() => document.getElementById(sec.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="flex-shrink-0 px-3 py-1.5 text-xs bg-gray-100 hover:bg-violet-100 hover:text-violet-700 rounded-full transition-colors whitespace-nowrap">
                {sec.icon} {sec.label}
              </button>
            ))}
          </div>

          <div className="px-4 py-5 space-y-4">

            {/* ── BASIC ── */}
            <Section id="s-basic" title="Основное" icon="📋">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Название клиента *" value={basic.clientName} onChange={v => setBasic(f => ({ ...f, clientName: v }))} placeholder="Northwind Capital" />
                <Field label="Slug (URL)" value={basic.slug} onChange={v => setBasic(f => ({ ...f, slug: v }))} placeholder="northwind-capital" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Индустрия" value={basic.industry} onChange={v => setBasic(f => ({ ...f, industry: v }))} placeholder="Private banking" />
                <Field label="Год" value={basic.year} onChange={v => setBasic(f => ({ ...f, year: v }))} type="number" />
                <div>
                  <label className={lbl}>Теги (через запятую)</label>
                  <input value={basic.tags} onChange={e => setBasic(f => ({ ...f, tags: e.target.value }))}
                    placeholder="Brand, Web, Print" className={inp} />
                </div>
              </div>
              <div>
                <label className={lbl}>Услуги (через запятую)</label>
                <input value={basic.services} onChange={e => setBasic(f => ({ ...f, services: e.target.value }))}
                  placeholder="Strategy, Identity, Web, Print" className={inp} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Короткий результат" value={basic.shortResult} onChange={v => setBasic(f => ({ ...f, shortResult: v }))} placeholder="+62% заявок" />
                <Field label="Значение" value={basic.resultValue} onChange={v => setBasic(f => ({ ...f, resultValue: v }))} placeholder="+62" />
                <Field label="Единица" value={basic.resultUnit} onChange={v => setBasic(f => ({ ...f, resultUnit: v }))} placeholder="%" />
              </div>

              {/* Cover upload */}
              <div>
                <label className={lbl}>Обложка (cover image)</label>
                {basic.coverUrl ? (
                  <div className="relative rounded-lg overflow-hidden" style={{ maxHeight: 180 }}>
                    <img src={basic.coverUrl} alt="cover" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block' }} />
                    <button type="button" onClick={() => setBasic(f => ({ ...f, coverUrl: '' }))}
                      className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full"
                      style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <div onClick={() => coverInputRef.current?.click()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleCoverFile(f) }}
                    onDragOver={e => e.preventDefault()}
                    className="rounded-lg p-6 text-center cursor-pointer transition-all"
                    style={{ border: '2px dashed #e5e7eb', background: '#fafafa' }}>
                    <Upload className="mx-auto mb-2" size={20} style={{ color: '#d1d5db' }} />
                    <p className="text-xs" style={{ color: '#6b7280' }}>
                      Перетащите или <span className="text-violet-600 font-medium">выберите файл</span>
                    </p>
                    <p className="text-xs mt-1" style={{ color: '#d1d5db' }}>JPG, PNG, WebP</p>
                  </div>
                )}
                {coverUploading && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-violet-600">
                    <div className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: '#ddd6fe', borderTopColor: '#7c3aed' }} />
                    Загрузка…
                  </div>
                )}
                <input ref={coverInputRef} type="file" accept="image/*" className="hidden"
                  onChange={e => e.target.files?.[0] && handleCoverFile(e.target.files[0])} />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={basic.featured} onChange={e => setBasic(f => ({ ...f, featured: e.target.checked }))}
                  className="rounded accent-violet-600" />
                <span className="text-sm text-gray-700">Показывать в избранных (featured)</span>
              </label>
            </Section>

            {/* ── HERO ── */}
            <Section id="s-hero" title="Герой" icon="🎯">
              <p className="text-xs text-gray-400">Метаданные в сайдбаре, lead-текст и оформление cover.</p>
              <Field label="Lead-текст (под заголовком)" value={hero.leadText}
                onChange={v => setHero(f => ({ ...f, leadText: v }))} rows={3}
                placeholder="Короткое описание проекта и результата…" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Сегмент" value={hero.segment} onChange={v => setHero(f => ({ ...f, segment: v }))} placeholder="Private banking · HNWI" />
                <Field label="Рынки" value={hero.markets} onChange={v => setHero(f => ({ ...f, markets: v }))} placeholder="Швеция, Норвегия" />
                <Field label="Срок проекта" value={hero.duration} onChange={v => setHero(f => ({ ...f, duration: v }))} placeholder="19 недель" />
                <Field label="Размер команды" value={hero.teamSize} onChange={v => setHero(f => ({ ...f, teamSize: v }))} placeholder="9 человек" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Водяной знак на cover" value={hero.coverWatermark} onChange={v => setHero(f => ({ ...f, coverWatermark: v }))} placeholder="N/W" />
                <Field label="Ribbon (плашка)" value={hero.coverRibbon} onChange={v => setHero(f => ({ ...f, coverRibbon: v }))} placeholder="Case study · 2025" />
                <Field label="Подпись cover" value={hero.coverCaption} onChange={v => setHero(f => ({ ...f, coverCaption: v }))} placeholder="+62% private inquiries" />
              </div>
            </Section>

            {/* ── KPI ── */}
            <Section id="s-kpi" title="KPI — метрики (4 блока)" icon="📊">
              <p className="text-xs text-gray-400">Анимированные счётчики под hero. prefix + value + suffix, например: <code>+</code>, <code>62</code>, <code>%</code></p>
              <div className="space-y-3">
                {kpis.map((k, idx) => (
                  <Card key={idx}>
                    <div className="flex items-center gap-2 mb-2">
                      <GripVertical size={14} className="text-gray-300" />
                      <span className="text-xs font-semibold text-gray-400">KPI {idx + 1}</span>
                    </div>
                    <div className="grid grid-cols-5 gap-2 mb-2">
                      {[
                        ['Префикс', 'prefix', '+'], ['Значение', 'value', '62'],
                        ['Суффикс', 'suffix', '%'], ['Источник (×2)', 'source', 'CRM / 2025'],
                      ].map(([label, key, ph]) => (
                        <div key={key} className={key === 'source' ? 'col-span-2' : ''}>
                          <label className={lbl}>{label}</label>
                          <input value={(k as any)[key]} placeholder={ph}
                            onChange={e => setKpis(arr => arr.map((x, i) => i === idx ? { ...x, [key]: e.target.value } : x))}
                            className={inp} />
                        </div>
                      ))}
                    </div>
                    <div>
                      <label className={lbl}>Подпись метрики</label>
                      <input value={k.label}
                        onChange={e => setKpis(arr => arr.map((x, i) => i === idx ? { ...x, label: e.target.value } : x))}
                        placeholder="рост заявок за первые 6 месяцев" className={inp} />
                    </div>
                  </Card>
                ))}
              </div>
            </Section>

            {/* ── CHAPTERS ── */}
            <Section id="s-chapters" title="Главы (навигация)" icon="📑" defaultOpen={false}>
              <p className="text-xs text-gray-400">
                Элементы левого оглавления. Если не заполнить — секции отображаются с заголовками по умолчанию.
              </p>
              <ArrayEditor label="Главы" items={chapters} onChange={setChapters} emptyItem={emptyChapter}
                renderRow={(item, update, remove) => (
                  <ItemRow onRemove={remove}>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="ID (якорь)" value={item.id} onChange={v => update({ id: v })} placeholder="brief" />
                      <Field label="Номер" value={item.num} onChange={v => update({ num: v })} placeholder="§ 01" />
                    </div>
                    <Field label="Заголовок" value={item.title} onChange={v => update({ title: v })} placeholder="Контекст и бриф." />
                    <Field label="Lead-текст главы" value={item.lead} onChange={v => update({ lead: v })} rows={2} />
                  </ItemRow>
                )} />
            </Section>

            {/* ── BRIEF ── */}
            <Section id="s-brief" title="Бриф & цитата" icon="💬"
              enabled={settings.showBrief} onToggle={() => setSetting('showBrief')}>
              <Card>
                <p className="text-xs font-semibold text-gray-500 mb-3">Цитата клиента (в разделе «Бриф»)</p>
                <Field label="Текст цитаты" value={testimonials[0]?.quote || ''} rows={3}
                  onChange={v => setTestimonials(arr => arr.map((x, i) => i === 0 ? { ...x, quote: v } : x))} />
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <Field label="Имя" value={testimonials[0]?.authorName || ''}
                    onChange={v => setTestimonials(arr => arr.map((x, i) => i === 0 ? { ...x, authorName: v } : x))} />
                  <Field label="Должность" value={testimonials[0]?.authorRole || ''}
                    onChange={v => setTestimonials(arr => arr.map((x, i) => i === 0 ? { ...x, authorRole: v } : x))} />
                  <Field label="Инициалы (аватар)" value={testimonials[0]?.authorInitials || ''}
                    onChange={v => setTestimonials(arr => arr.map((x, i) => i === 0 ? { ...x, authorInitials: v } : x))} />
                </div>
              </Card>
            </Section>

            {/* ── CHALLENGES ── */}
            <Section id="s-challenges" title="Вызовы" icon="⚡"
              enabled={settings.showChallenge} onToggle={() => setSetting('showChallenge')}>
              <div className="space-y-3">
                {challenges.map((ch, idx) => (
                  <Card key={idx}>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <Field label="Индекс" value={ch.index}
                        onChange={v => setChallenges(arr => arr.map((x, i) => i === idx ? { ...x, index: v } : x))} placeholder="C/01" />
                      <Field label="Категория" value={ch.category}
                        onChange={v => setChallenges(arr => arr.map((x, i) => i === idx ? { ...x, category: v } : x))} placeholder="Доверие" />
                    </div>
                    <Field label="Заголовок (*курсив*)" value={ch.title}
                      onChange={v => setChallenges(arr => arr.map((x, i) => i === idx ? { ...x, title: v } : x))} placeholder="Не *потерять* сегмент 50+" />
                    <Field label="Описание" value={ch.body}
                      onChange={v => setChallenges(arr => arr.map((x, i) => i === idx ? { ...x, body: v } : x))} rows={2} />
                  </Card>
                ))}
              </div>
              <button type="button" onClick={() => setChallenges(arr => [...arr, emptyChallenge()])}
                className="flex items-center gap-1 text-xs text-violet-600 mt-1 hover:underline">
                <Plus size={12} />Добавить вызов
              </button>
            </Section>

            {/* ── APPROACH ── */}
            <Section id="s-approach" title="Подход" icon="🧩" defaultOpen={false}
              enabled={settings.showApproach} onToggle={() => setSetting('showApproach')}>
              <div className="space-y-3">
                {approachItems.map((a, idx) => (
                  <Card key={idx}>
                    <div className="grid grid-cols-4 gap-2">
                      <Field label="Номер" value={a.num}
                        onChange={v => setApproachItems(arr => arr.map((x, i) => i === idx ? { ...x, num: v } : x))} placeholder="01" />
                      <div className="col-span-3">
                        <Field label="Заголовок (*курсив*)" value={a.title}
                          onChange={v => setApproachItems(arr => arr.map((x, i) => i === idx ? { ...x, title: v } : x))} placeholder="*Меньше,* чем банк" />
                      </div>
                    </div>
                    <div className="mt-2">
                      <Field label="Описание" value={a.body}
                        onChange={v => setApproachItems(arr => arr.map((x, i) => i === idx ? { ...x, body: v } : x))} rows={2} />
                    </div>
                  </Card>
                ))}
              </div>
            </Section>

            {/* ── TIMELINE ── */}
            <Section id="s-timeline" title="Хронология" icon="📅" defaultOpen={false}
              enabled={settings.showTimeline} onToggle={() => setSetting('showTimeline')}>
              <ArrayEditor label="Этапы" items={timeline} onChange={setTimeline} emptyItem={emptyTimeline}
                renderRow={(item, update, remove) => (
                  <ItemRow onRemove={remove}>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Период" value={item.week} onChange={v => update({ week: v })} placeholder="Wk 01–02" />
                      <Field label="Фаза (*курсив*)" value={item.phase} onChange={v => update({ phase: v })} placeholder="*Discovery* & интервью" />
                    </div>
                    <Field label="Описание" value={item.description} onChange={v => update({ description: v })} rows={2} />
                  </ItemRow>
                )} />
            </Section>

            {/* ── IDENTITY ── */}
            <Section id="s-identity" title="Идентика" icon="🎨" defaultOpen={false}
              enabled={settings.showIdentity} onToggle={() => setSetting('showIdentity')}>
              <p className="text-xs text-gray-400">Включите только те блоки, которые есть у этого проекта.</p>

              <Card>
                <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">Видимые блоки</p>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    ['showLogomark', 'Логомарк (SVG)'],
                    ['showTypography', 'Типографика'],
                    ['showPalette', 'Палитра'],
                    ['showCardMock', 'Карта (card mock)'],
                    ['showWebMock', 'Web-макет'],
                    ['showPrintSpread', 'Print / годовой отчёт'],
                    ['showBeforeAfter', 'До / После'],
                    ['showDeliverables', 'Артефакты'],
                  ] as [keyof Settings, string][]).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <Toggle checked={settings[key] as boolean} onChange={() => setSetting(key)} />
                      <span className="text-xs text-gray-700">{label}</span>
                    </label>
                  ))}
                </div>
              </Card>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Display-шрифт" value={identity.primaryFont} onChange={v => setIdentity(f => ({ ...f, primaryFont: v }))} placeholder="Instrument Serif" />
                <Field label="Body-шрифт" value={identity.bodyFont} onChange={v => setIdentity(f => ({ ...f, bodyFont: v }))} placeholder="Geist" />
                <Field label="Вордмарк / название" value={identity.wordmark} onChange={v => setIdentity(f => ({ ...f, wordmark: v }))} placeholder="Northwind" />
                {settings.showCardMock && (
                  <Field label="Номер карты (mock)" value={identity.cardNumber} onChange={v => setIdentity(f => ({ ...f, cardNumber: v }))} placeholder="5482 ··· ··· 0124" />
                )}
              </div>

              {settings.showPalette && (
                <ArrayEditor label="Палитра" items={colors} onChange={setColors} emptyItem={emptyColor}
                  renderRow={(item, update, remove) => (
                    <ItemRow onRemove={remove}>
                      <div className="flex items-center gap-3">
                        <input type="color" value={item.hex} onChange={e => update({ hex: e.target.value })}
                          className="w-10 h-10 rounded cursor-pointer border border-gray-200 flex-shrink-0" />
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <Field label="HEX" value={item.hex} onChange={v => update({ hex: v })} placeholder="#222222" />
                          <Field label="Метка" value={item.label} onChange={v => update({ label: v })} placeholder="#222" />
                        </div>
                        <label className="flex items-center gap-1 text-xs text-gray-500 flex-shrink-0">
                          <input type="checkbox" checked={item.dark} onChange={e => update({ dark: e.target.checked })} className="accent-violet-600" />
                          Тёмный
                        </label>
                      </div>
                    </ItemRow>
                  )} />
              )}

              {settings.showDeliverables && (
                <ArrayEditor label="Артефакты (deliverables)" items={deliverables} onChange={setDeliverables} emptyItem={emptyDeliverable}
                  renderRow={(item, update, remove) => (
                    <ItemRow onRemove={remove}>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Название (*курсив*)" value={item.name} onChange={v => update({ name: v })} placeholder="*38* страниц брендбука" />
                        <Field label="Категория" value={item.category} onChange={v => update({ category: v })} placeholder="PDF + Figma" />
                      </div>
                    </ItemRow>
                  )} />
              )}
            </Section>

            {/* ── BEFORE/AFTER ── */}
            <Section id="s-ba" title="До / После" icon="🔄" defaultOpen={false}
              enabled={settings.showBeforeAfter} onToggle={() => setSetting('showBeforeAfter')}>
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <p className="text-xs font-semibold text-gray-400 mb-2">ДО (старый бренд)</p>
                  <Field label="Текст-логотип (большой)" value={beforeAfter.beforeText}
                    onChange={v => setBeforeAfter(f => ({ ...f, beforeText: v }))} placeholder="NordBank" />
                  <div className="mt-2">
                    <Field label="Описание" value={beforeAfter.beforeDescription} rows={2}
                      onChange={v => setBeforeAfter(f => ({ ...f, beforeDescription: v }))} />
                  </div>
                </Card>
                <Card>
                  <p className="text-xs font-semibold text-gray-400 mb-2">ПОСЛЕ (новый бренд)</p>
                  <p className="text-xs text-gray-400 mb-2">SVG логомарк рисуется автоматически</p>
                  <Field label="Описание" value={beforeAfter.afterDescription} rows={2}
                    onChange={v => setBeforeAfter(f => ({ ...f, afterDescription: v }))} />
                </Card>
              </div>
            </Section>

            {/* ── METRICS ── */}
            <Section id="s-metrics" title="Метрики" icon="📈" defaultOpen={false}
              enabled={settings.showDigital} onToggle={() => setSetting('showDigital')}>
              <Card>
                <p className="text-xs font-semibold text-gray-400 mb-2">График (линейный)</p>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Заголовок" value={metrics.lineChartTitle} onChange={v => setMetrics(f => ({ ...f, lineChartTitle: v }))} placeholder="Заявки на private" />
                  <Field label="Значение" value={metrics.lineChartValue} onChange={v => setMetrics(f => ({ ...f, lineChartValue: v }))} placeholder="+62%" />
                  <Field label="Дельта" value={metrics.lineChartDelta} onChange={v => setMetrics(f => ({ ...f, lineChartDelta: v }))} placeholder="vs. 2024" />
                </div>
              </Card>
              <ArrayEditor label="Воронка (funnel bars)" items={funnelData} onChange={setFunnelData} emptyItem={emptyFunnel}
                renderRow={(item, update, remove) => (
                  <ItemRow onRemove={remove}>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <Field label="Название" value={item.name} onChange={v => update({ name: v })} placeholder="Уникальные посетители" />
                      </div>
                      <Field label="Ширина %" value={item.width} onChange={v => update({ width: v })} placeholder="100" />
                    </div>
                    <Field label="Метка значения" value={item.label} onChange={v => update({ label: v })} placeholder="42 180" />
                  </ItemRow>
                )} />
            </Section>

            {/* ── RESULTS ── */}
            <Section id="s-results" title="Результаты & цитата" icon="🏆" defaultOpen={false}
              enabled={settings.showResults} onToggle={() => setSetting('showResults')}>
              <Card>
                <p className="text-xs font-semibold text-gray-500 mb-3">Цитата (в разделе «Результаты»)</p>
                <Field label="Текст цитаты" value={testimonials[1]?.quote || ''} rows={3}
                  onChange={v => setTestimonials(arr => arr.map((x, i) => i === 1 ? { ...x, quote: v } : x))} />
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <Field label="Имя" value={testimonials[1]?.authorName || ''}
                    onChange={v => setTestimonials(arr => arr.map((x, i) => i === 1 ? { ...x, authorName: v } : x))} />
                  <Field label="Должность" value={testimonials[1]?.authorRole || ''}
                    onChange={v => setTestimonials(arr => arr.map((x, i) => i === 1 ? { ...x, authorRole: v } : x))} />
                  <Field label="Инициалы" value={testimonials[1]?.authorInitials || ''}
                    onChange={v => setTestimonials(arr => arr.map((x, i) => i === 1 ? { ...x, authorInitials: v } : x))} />
                </div>
              </Card>
            </Section>

            {/* ── NEXT CASE ── */}
            <Section id="s-nextcase" title="Следующий кейс" icon="➡️" defaultOpen={false}>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Slug следующего кейса" value={nextCase.nextCaseSlug}
                  onChange={v => setNextCase(f => ({ ...f, nextCaseSlug: v }))} placeholder="maison-cote" />
                <Field label="Декоративная буква" value={nextCase.nextCaseDeco}
                  onChange={v => setNextCase(f => ({ ...f, nextCaseDeco: v }))} placeholder="M" />
              </div>
              <Field label="Заголовок (*курсив*)" value={nextCase.nextCaseTitle}
                onChange={v => setNextCase(f => ({ ...f, nextCaseTitle: v }))} placeholder="Maison Côte — упаковка *удвоившая* средний чек." />
              <ArrayEditor label="Строки мета-блока" items={nextCaseMeta} onChange={setNextCaseMeta} emptyItem={emptyNextMeta}
                renderRow={(item, update, remove) => (
                  <ItemRow onRemove={remove}>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Метка" value={item.label} onChange={v => update({ label: v })} placeholder="Индустрия" />
                      <Field label="Значение" value={item.value} onChange={v => update({ value: v })} placeholder="Beauty · ритейл" />
                    </div>
                  </ItemRow>
                )} />
            </Section>

            {/* ── CUSTOM HTML / CSS ── */}
            <Section id="s-custom" title="Кастомный HTML / CSS" icon="🖥️" defaultOpen={false}>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                Контент вставляется напрямую в страницу кейса. Используйте для уникального дизайна секций.
              </div>
              <div>
                <label className={lbl}>CSS (добавляется в &lt;style&gt; на странице)</label>
                <textarea rows={8} value={customCss} onChange={e => setCustomCss(e.target.value)}
                  className={`${ta} font-mono text-xs`}
                  placeholder={`.my-section { background: #f5f3ee; padding: 80px 0; }\n.my-title { font-size: 48px; }`} />
              </div>
              <div>
                <label className={lbl}>HTML (вставляется после основных секций)</label>
                <textarea rows={12} value={customHtml} onChange={e => setCustomHtml(e.target.value)}
                  className={`${ta} font-mono text-xs`}
                  placeholder={`<section class="my-section">\n  <div class="wrap">\n    <h2 class="my-title">Заголовок</h2>\n  </div>\n</section>`} />
              </div>
            </Section>

            {/* ── SEO ── */}
            <Section id="s-seo" title="SEO" icon="🔍" defaultOpen={false}>
              <p className="text-xs text-gray-400">
                Если оставить пустым — заголовок = «{basic.clientName || 'Название'} — Lumiva Agency», описание = lead-текст.
              </p>
              <Field label="SEO заголовок (пусто = авто)" value={seo.seoTitle}
                onChange={v => setSeo(f => ({ ...f, seoTitle: v }))} placeholder={`${basic.clientName || 'Название'} — Lumiva Agency`} />
              <Field label="SEO описание (пусто = авто)" value={seo.seoDescription}
                onChange={v => setSeo(f => ({ ...f, seoDescription: v }))} rows={2}
                placeholder={hero.leadText || 'Описание подтянется из lead-текста'} />
            </Section>

            <div className="h-16" />
          </div>
        </main>

      </div>

      {/* ── RIGHT HALF: live preview iframe — desktop only ── */}
      <div className="hidden md:flex md:flex-col border-l border-gray-200 bg-white flex-shrink-0 md:w-1/2">

        {/* Preview header */}
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0 gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${basic.status === 'published' ? 'bg-green-400' : 'bg-yellow-400'}`} />
            <span className="text-sm font-semibold text-gray-700 truncate">
              {basic.clientName || 'Предпросмотр'}
            </span>
          </div>

          {/* Desktop / Mobile toggle */}
          <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden flex-shrink-0">
            <button type="button" onClick={() => setPreviewMode('desktop')}
              className={`px-3 py-1.5 text-xs flex items-center gap-1 transition-colors ${previewMode === 'desktop' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
              🖥 Desktop
            </button>
            <button type="button" onClick={() => setPreviewMode('mobile')}
              className={`px-3 py-1.5 text-xs flex items-center gap-1 transition-colors border-l border-gray-200 ${previewMode === 'mobile' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
              📱 Mobile
            </button>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {previewUrl && (
              <>
                <button type="button" onClick={() => setPreviewKey(k => k + 1)}
                  title="Обновить предпросмотр"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-600">
                  <RefreshCw size={12} />
                </button>
                <a href={previewUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors">
                  <ExternalLink size={12} />
                  Открыть
                </a>
              </>
            )}
          </div>
        </div>

        {/* iframe or placeholder */}
        <div className="flex-1 overflow-hidden bg-gray-100">
          {previewUrl ? (
            previewMode === 'mobile' ? (
              <div className="flex items-start justify-center h-full overflow-auto py-6">
                <div style={{
                  width: 375, flexShrink: 0,
                  border: '10px solid #1c1c1e', borderRadius: 44,
                  overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.45)',
                  height: 780,
                }}>
                  <iframe
                    key={`${previewKey}-mob`}
                    src={previewUrl}
                    style={{ width: '100%', height: '100%', border: 0, display: 'block', background: '#fff' }}
                    title="Mobile preview"
                  />
                </div>
              </div>
            ) : (
              <iframe
                key={`${previewKey}-desk`}
                src={previewUrl}
                className="w-full h-full border-0 bg-white"
                title="Desktop preview"
              />
            )
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-400">
                <div style={{ fontSize: 48, marginBottom: 16 }}>✦</div>
                <p className="text-sm font-medium text-gray-500">Введите slug и сохраните кейс</p>
                <p className="text-xs text-gray-400 mt-1">Предпросмотр появится здесь</p>
              </div>
            </div>
          )}
        </div>

      </div>

    </div>
  )
}
