import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getBlogPosts, createBlogPost, updateBlogPost, uploadMedia, translateBlogContent } from '../api'
import toast from 'react-hot-toast'
import BlockEditor, { type Block } from '../components/BlockEditor'
import {
  ArrowLeft, Upload, X, ChevronDown, ChevronUp, User, Tag, Globe,
  ImageIcon, CheckCircle2, Clock, Languages,
} from 'lucide-react'

// ─── Constants ───────────────────────────────────────────────────────────────

const LANGS = [
  { code: 'ru', label: 'Русский', flag: 'РУ' },
  { code: 'en', label: 'English', flag: 'EN' },
  { code: 'tr', label: 'Türkçe', flag: 'TR' },
]

const CATEGORIES = [
  { key: 'brand',       label: 'Бренд & идентика' },
  { key: 'performance', label: 'Performance & ROI' },
  { key: 'strategy',   label: 'Стратегия & рынки' },
  { key: 'web',        label: 'Web & UX' },
  { key: 'content',    label: 'Контент & продакшн' },
  { key: 'smm',        label: 'SMM & комьюнити' },
  { key: 'analytics',  label: 'Аналитика & данные' },
  { key: 'culture',    label: 'Культура & команда' },
  // рубрики блога CRM (crm.lumiva.agency); «Аналитика» общая
  { key: 'sales',          label: 'Продажи',       crm: true },
  { key: 'automation',     label: 'Автоматизация', crm: true },
  { key: 'implementation', label: 'Внедрение',     crm: true },
  { key: 'integrations',   label: 'Интеграции',    crm: true },
]

const CYRILLIC_MAP: Record<string, string> = {
  а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',й:'y',
  к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',
  х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya',
}
function toSlug(str: string) {
  return str.toLowerCase()
    .split('').map(c => CYRILLIC_MAP[c] ?? c).join('')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface LangContent {
  title: string
  excerpt: string
  content: string
  blocks: Block[]
  seoTitle: string
  seoDescription: string
  coverUrl: string
}

interface FormState {
  langs: string[]
  langContent: Record<string, LangContent>
  slug: string
  author: string
  tags: string[]
  category: string
  status: string
  sites: string[]
}

const SITES = [
  { key: 'agency', label: 'Сайт агентства', host: 'lumiva.agency/blog' },
  { key: 'crm',    label: 'Блог CRM',       host: 'crm.lumiva.agency/blog' },
]

const emptyLang = (): LangContent => ({
  title: '', excerpt: '', content: '', blocks: [], seoTitle: '', seoDescription: '', coverUrl: '',
})

const EMPTY: FormState = {
  langs: ['ru'],
  langContent: { ru: emptyLang(), en: emptyLang(), tr: emptyLang() },
  slug: '', author: '', tags: [], category: '', status: 'draft', sites: ['agency'],
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BlogEditorPage() {
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()
  const qc = useQueryClient()
  const coverInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<FormState>(EMPTY)
  const [activeLang, setActiveLang] = useState('ru')
  const [tagInput, setTagInput] = useState('')
  const [coverUploading, setCoverUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [seoOpen, setSeoOpen] = useState(false)
  const [slugManual, setSlugManual] = useState(false)
  const [translating, setTranslating] = useState(false)

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const set = (patch: Partial<FormState>) => setForm(f => ({ ...f, ...patch }))

  const setLang = (lang: string, patch: Partial<LangContent>) =>
    setForm(f => ({
      ...f,
      langContent: {
        ...f.langContent,
        [lang]: { ...f.langContent[lang], ...patch },
      },
    }))

  const cur = form.langContent[activeLang] ?? emptyLang()

  // ── Load existing post ────────────────────────────────────────────────────────

  const { data: posts } = useQuery({
    queryKey: ['blog', 'all'],
    queryFn: () => getBlogPosts({ limit: 200, site: 'all' }),
    enabled: !isNew,
  })

  useEffect(() => {
    if (!isNew && posts) {
      const post = posts.items?.find((p: any) => String(p.id) === id)
      if (post) {
        function toBlocks(blocks: any, content: string): Block[] {
          if (Array.isArray(blocks) && blocks.length > 0) return blocks
          if (content?.trim()) return [{ type: 'paragraph', data: { text: content.trim() } }]
          return []
        }
        const ruContent: LangContent = {
          title:          post.title          || '',
          excerpt:        post.excerpt         || '',
          content:        '',
          blocks:         toBlocks(post.blocks, post.content),
          seoTitle:       post.seoTitle        || '',
          seoDescription: post.seoDescription  || '',
          coverUrl:       post.coverUrl        || '',
        }
        const enContent: LangContent = {
          ...emptyLang(),
          ...(post.translations?.en ?? {}),
          content: '',
          blocks: toBlocks(post.translations?.en?.blocks, post.translations?.en?.content),
        }
        const trContent: LangContent = {
          ...emptyLang(),
          ...(post.translations?.tr ?? {}),
          content: '',
          blocks: toBlocks(post.translations?.tr?.blocks, post.translations?.tr?.content),
        }
        setForm({
          langs:       Array.isArray(post.langs) ? post.langs.filter(Boolean) : ['ru'],
          langContent: { ru: ruContent, en: enContent, tr: trContent },
          slug:        post.slug        || '',
          author:      post.author      || '',
          tags:        Array.isArray(post.tags) ? post.tags.filter(Boolean) : [],
          category:    post.category    || '',
          status:      post.status      || 'draft',
          sites:       Array.isArray(post.sites) && post.sites.filter(Boolean).length ? post.sites.filter(Boolean) : ['agency'],
        })
        setSlugManual(true)
      }
    }
  }, [id, posts, isNew])

  // ── Auto-slug from RU title ───────────────────────────────────────────────────

  useEffect(() => {
    if (isNew && !slugManual && form.langContent.ru.title) {
      set({ slug: toSlug(form.langContent.ru.title) })
    }
  }, [form.langContent.ru.title, isNew, slugManual])

  // ── Cover handling ────────────────────────────────────────────────────────────

  async function handleCoverFile(file: File) {
    if (!file.type.startsWith('image/')) { toast.error('Только изображения'); return }
    setCoverUploading(true)
    try {
      const result = await uploadMedia(file)
      setLang(activeLang, { coverUrl: result.url })
    } catch {
      toast.error('Ошибка загрузки обложки')
    } finally {
      setCoverUploading(false)
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleCoverFile(file)
  }, [])

  function removeCover() {
    setLang(activeLang, { coverUrl: '' })
    if (coverInputRef.current) coverInputRef.current.value = ''
  }


  // ── Tags ──────────────────────────────────────────────────────────────────────

  function addTag() {
    const t = tagInput.trim()
    if (t && !form.tags.includes(t)) set({ tags: [...form.tags, t] })
    setTagInput('')
  }
  function removeTag(tag: string) { set({ tags: form.tags.filter(t => t !== tag) }) }

  // ── Auto-translate ────────────────────────────────────────────────────────────
  // Shared by the bulk "Автоперевод" button (both langs) and per-language toggles
  // (one lang, fired the moment that language is switched on).

  async function runTranslate(targetLangs: Array<'en' | 'tr'>) {
    const ru = form.langContent.ru
    if (!ru.title.trim() && !ru.blocks.length) {
      toast.error('Сначала заполните контент на русском')
      return
    }
    setTranslating(true)
    try {
      const existing: Record<string, any> = {}
      for (const lang of ['en', 'tr'] as const) {
        const lc = form.langContent[lang]
        if (lc && (lc.title?.trim() || lc.blocks?.length)) {
          existing[lang] = { title: lc.title, excerpt: lc.excerpt, seoTitle: lc.seoTitle, seoDescription: lc.seoDescription, blocks: lc.blocks }
        }
      }
      const result = await translateBlogContent({
        title: ru.title,
        excerpt: ru.excerpt,
        seoTitle: ru.seoTitle,
        seoDescription: ru.seoDescription,
        blocks: ru.blocks,
        targetLangs,
        existing,
      })
      const newLangContent = { ...form.langContent }
      const newLangs = [...form.langs]
      for (const lang of targetLangs) {
        if (result[lang]) {
          newLangContent[lang] = {
            ...emptyLang(),
            ...result[lang],
            coverUrl: ru.coverUrl,
          }
          if (!newLangs.includes(lang)) newLangs.push(lang)
        }
      }
      setForm(f => ({ ...f, langContent: newLangContent, langs: newLangs }))
      toast.success(`Переведено на ${targetLangs.map(l => l.toUpperCase()).join(' и ')}`)
    } catch {
      toast.error('Ошибка перевода. Попробуйте ещё раз.')
    } finally {
      setTranslating(false)
    }
  }

  function handleAutoTranslate() { runTranslate(['en', 'tr']) }

  // ── Language toggles ──────────────────────────────────────────────────────────
  // Switching a language on immediately triggers translation for just that
  // language, unless it already has content (e.g. loaded from a saved post).

  function toggleLang(code: string, enabled: boolean) {
    if (code === 'ru') return // RU always on
    const langs = enabled
      ? [...form.langs, code]
      : form.langs.filter(l => l !== code)
    set({ langs })
    if (!enabled && activeLang === code) setActiveLang('ru')
    if (enabled) {
      const lc = form.langContent[code]
      const hasContent = lc && (lc.title?.trim() || lc.blocks?.length)
      if (!hasContent) runTranslate([code as 'en' | 'tr'])
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────────

  const save = useMutation({
    mutationFn: (data: any) => isNew ? createBlogPost(data) : updateBlogPost(Number(id), data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['blog'] })
      toast.success(isNew ? 'Пост создан' : 'Пост сохранён')
      if (isNew) navigate('/blog')
    },
    onError: () => toast.error('Ошибка сохранения'),
  })

  function handleSubmit(statusOverride?: string) {
    if (!form.langContent.ru.title.trim()) { toast.error('Заголовок (RU) обязателен'); return }
    const payload = {
      slug:            form.slug,
      coverUrl:        form.langContent.ru.coverUrl,
      author:          form.author,
      tags:            form.tags.filter(Boolean),
      category:        form.category,
      status:          statusOverride ?? form.status,
      langs:           form.langs,
      sites:           form.sites,
      // RU base fields
      title:           form.langContent.ru.title,
      excerpt:         form.langContent.ru.excerpt,
      content:         '',
      blocks:          form.langContent.ru.blocks,
      seoTitle:        form.langContent.ru.seoTitle,
      seoDescription:  form.langContent.ru.seoDescription,
      // Other languages in translations
      translations: Object.fromEntries(
        ['en', 'tr']
          .filter(l => form.langs.includes(l))
          .map(l => [l, { ...form.langContent[l], content: '', blocks: form.langContent[l].blocks }])
      ),
    }
    save.mutate(payload)
  }

  // ── Status badge ──────────────────────────────────────────────────────────────

  const statusBadge = form.status === 'published'
    ? <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium"
        style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}>
        <CheckCircle2 size={11} />Опубликован
      </span>
    : <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium"
        style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }}>
        <Clock size={11} />Черновик
      </span>

  // ── Render ────────────────────────────────────────────────────────────────────

  const cardStyle = {
    background: '#fff',
    border: '1px solid var(--cream-border)',
    borderRadius: '12px',
  }

  const labelStyle = {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    color: '#9ca3af',
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--paper)' }}>

      {/* ── Sticky top bar ── */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-3"
        style={{ background: '#fff', borderBottom: '1px solid var(--cream-border)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/blog')}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: '#9ca3af' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#111')}
            onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}
          >
            <ArrowLeft size={18} />
          </button>
          <span className="text-sm font-medium" style={{ color: '#6b7280' }}>
            {isNew ? 'Новый пост' : 'Редактировать пост'}
          </span>
          {statusBadge}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSubmit('draft')}
            disabled={save.isPending}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            style={{ border: '1px solid var(--cream-border)', color: '#6b7280', background: '#fff' }}
          >
            Черновик
          </button>
          <button
            onClick={() => handleSubmit('published')}
            disabled={save.isPending}
            className="px-5 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
            style={{ background: 'var(--orange)' }}
          >
            {save.isPending ? 'Сохранение…' : 'Опубликовать'}
          </button>
        </div>
      </header>

      {/* ── Two-column layout ── */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-6 py-6 grid gap-6 items-start"
        style={{ gridTemplateColumns: '1fr 300px' }}>

        {/* ── LEFT: main content ── */}
        <div className="space-y-4">

          {/* Language tabs */}
          <div className="flex items-center gap-1"
            style={{ background: '#fff', border: '1px solid var(--cream-border)', borderRadius: '12px', padding: '6px' }}>
            {/* Auto-translate button */}
            {LANGS.filter(l => form.langs.includes(l.code)).map(lang => {
              const isActive = activeLang === lang.code
              return (
                <button
                  key={lang.code}
                  onClick={() => setActiveLang(lang.code)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: isActive ? 'var(--ink)' : 'transparent',
                    color: isActive ? '#fff' : '#9ca3af',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '13px',
                  }}
                >
                  {lang.flag}
                  {isActive && (
                    <span className="text-xs" style={{ color: 'var(--orange)', marginLeft: 2 }}>●</span>
                  )}
                </button>
              )
            })}
            {/* Auto-translate button — appears after lang tabs */}
            <div style={{ marginLeft: 'auto', paddingRight: 2 }}>
              <button
                onClick={handleAutoTranslate}
                disabled={translating}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-60"
                title="Перевести контент с RU на EN и TR автоматически"
                style={{
                  background: translating ? '#f3f4f6' : '#fff5f2',
                  color: translating ? '#9ca3af' : 'var(--orange)',
                  border: '1px solid',
                  borderColor: translating ? '#e5e7eb' : '#ffd5c8',
                  fontSize: '12px',
                  whiteSpace: 'nowrap',
                }}
              >
                {translating
                  ? <><div className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: '#ffd5c8', borderTopColor: 'var(--orange)' }} />Переводим…</>
                  : <><Languages size={13} />Автоперевод</>
                }
              </button>
            </div>

            {/* Show disabled tabs for inactive langs */}
            {LANGS.filter(l => !form.langs.includes(l.code)).map(lang => (
              <button
                key={lang.code}
                onClick={() => { toggleLang(lang.code, true); setActiveLang(lang.code) }}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm transition-all"
                title={`Включить ${lang.label}`}
                style={{
                  color: '#d1d5db',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '13px',
                  border: '1px dashed #e5e7eb',
                }}
              >
                {lang.flag} <span style={{ fontSize: '10px' }}>+</span>
              </button>
            ))}
          </div>

          {/* Title + Slug card */}
          <div style={{ ...cardStyle, padding: '24px' }}>
            <input
              value={cur.title}
              onChange={e => setLang(activeLang, { title: e.target.value })}
              placeholder={activeLang === 'ru' ? 'Заголовок поста…' : activeLang === 'en' ? 'Post title…' : 'Makale başlığı…'}
              className="w-full bg-transparent outline-none leading-tight"
              style={{ fontSize: '24px', fontWeight: 700, color: '#111', border: 'none' }}
            />
            {/* Slug row — only on RU tab */}
            {activeLang === 'ru' && (
              <div className="mt-4 flex items-center gap-2 pt-4" style={{ borderTop: '1px solid #f3f4f6' }}>
                <span className="shrink-0 text-xs" style={{ color: '#9ca3af' }}>slug:</span>
                <input
                  value={form.slug}
                  onChange={e => { setSlugManual(true); set({ slug: e.target.value }) }}
                  placeholder="auto-generated"
                  className="flex-1 rounded-md px-2.5 py-1.5 outline-none focus:ring-2 text-xs"
                  style={{
                    color: 'var(--orange)',
                    fontFamily: 'JetBrains Mono, monospace',
                    background: '#fff5f2',
                    border: '1px solid #ffd5c8',
                    '--tw-ring-color': 'var(--orange)',
                  } as React.CSSProperties}
                />
              </div>
            )}
          </div>

          {/* Excerpt */}
          <div style={{ ...cardStyle, padding: '24px' }}>
            <label style={labelStyle} className="block mb-3">
              {activeLang === 'ru' ? 'Краткое описание' : activeLang === 'en' ? 'Excerpt' : 'Özet'}
            </label>
            <textarea
              value={cur.excerpt}
              onChange={e => setLang(activeLang, { excerpt: e.target.value })}
              rows={3}
              placeholder={activeLang === 'ru'
                ? 'Краткое описание поста…'
                : activeLang === 'en' ? 'Short description of the post…'
                : 'Yazının kısa açıklaması…'}
              className="w-full bg-transparent outline-none resize-none leading-relaxed"
              style={{ fontSize: '14px', color: '#374151', border: 'none' }}
            />
          </div>

          {/* Content — block editor */}
          <div style={{ ...cardStyle, overflow: 'hidden' }}>
            <div className="px-5 pt-4 pb-3" style={{ borderBottom: '1px solid #f3f4f6' }}>
              <label style={labelStyle}>
                {activeLang === 'ru' ? 'Контент' : activeLang === 'en' ? 'Content' : 'İçerik'}
              </label>
            </div>
            <div style={{ padding: '16px' }}>
              <BlockEditor
                blocks={cur.blocks}
                onChange={blocks => setLang(activeLang, { blocks })}
              />
            </div>
          </div>
        </div>

        {/* ── RIGHT: sidebar ── */}
        <aside className="space-y-4">

          {/* Sites panel */}
          <div style={{ ...cardStyle, padding: '16px' }}>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Globe size={12} /> Где опубликовать
            </label>
            <div className="space-y-2">
              {SITES.map(site => {
                const checked = form.sites.includes(site.key)
                const last = checked && form.sites.length === 1
                return (
                  <label key={site.key} className="flex items-start gap-2.5 cursor-pointer" title={last ? 'Нужен хотя бы один сайт' : undefined}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={last}
                      onChange={e => set({ sites: e.target.checked ? [...form.sites, site.key] : form.sites.filter(x => x !== site.key) })}
                      className="rounded mt-0.5"
                      style={{ accentColor: 'var(--orange)', width: 14, height: 14 }}
                    />
                    <span>
                      <span className="text-sm block" style={{ color: '#374151' }}>{site.label}</span>
                      <span className="text-xs" style={{ color: '#9ca3af', fontFamily: 'JetBrains Mono, monospace' }}>{site.host}</span>
                    </span>
                  </label>
                )
              })}
            </div>
            <p className="text-xs mt-3" style={{ color: '#9ca3af' }}>
              Можно выбрать один сайт или оба — статья появится в блоге каждого выбранного сайта.
            </p>
          </div>

          {/* Languages panel */}
          <div style={{ ...cardStyle, padding: '16px' }}>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Globe size={12} /> Языки
            </label>
            <div className="space-y-2">
              {LANGS.map(lang => {
                const isRu = lang.code === 'ru'
                const checked = form.langs.includes(lang.code)
                return (
                  <label key={lang.code}
                    className="flex items-center gap-2.5 cursor-pointer"
                    style={{ opacity: isRu ? 0.6 : 1 }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isRu}
                      onChange={e => toggleLang(lang.code, e.target.checked)}
                      className="rounded"
                      style={{ accentColor: 'var(--orange)', width: 14, height: 14 }}
                    />
                    <span className="text-xs font-mono" style={{ fontFamily: 'JetBrains Mono, monospace', color: '#374151' }}>
                      {lang.flag}
                    </span>
                    <span className="text-sm" style={{ color: '#374151' }}>{lang.label}</span>
                    {isRu && <span className="text-xs" style={{ color: '#9ca3af' }}>основной</span>}
                  </label>
                )
              })}
            </div>
            <p className="text-xs mt-3" style={{ color: '#9ca3af' }}>
              RU — основной язык, всегда включён.
            </p>
          </div>

          {/* Cover upload */}
          <div style={{ ...cardStyle, padding: '16px' }}>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <ImageIcon size={12} /> Обложка
              <span style={{ marginLeft: 'auto', fontFamily: 'JetBrains Mono, monospace', color: 'var(--orange)', fontSize: '10px' }}>
                {LANGS.find(l => l.code === activeLang)?.flag}
              </span>
            </label>

            {cur.coverUrl ? (
              <div className="relative rounded-lg overflow-hidden group">
                <img src={cur.coverUrl} alt="cover" className="w-full h-44 object-cover" />
                <div className="absolute inset-0 transition-colors" style={{ background: 'rgba(0,0,0,0)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.15)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0)')} />
                <button
                  onClick={removeCover}
                  className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full transition-colors"
                  style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <div
                onDrop={onDrop}
                onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onClick={() => coverInputRef.current?.click()}
                className="rounded-lg p-6 text-center cursor-pointer select-none transition-all"
                style={{
                  border: isDragging ? '2px dashed var(--orange)' : '2px dashed var(--cream-border)',
                  background: isDragging ? '#fff5f2' : '#fafaf9',
                }}
              >
                <Upload className="mx-auto mb-2" size={22} style={{ color: '#d1d5db' }} />
                <p className="text-xs" style={{ color: '#6b7280' }}>
                  Перетащите или{' '}
                  <span style={{ color: 'var(--orange)', fontWeight: 500 }}>выберите файл</span>
                </p>
                <p className="text-xs mt-1" style={{ color: '#d1d5db' }}>JPG, PNG, WebP · до 10 МБ</p>
              </div>
            )}

            {coverUploading && (
              <div className="mt-2 flex items-center gap-2 text-xs" style={{ color: 'var(--orange)' }}>
                <div className="w-3 h-3 border-2 rounded-full animate-spin"
                  style={{ borderColor: '#ffd5c8', borderTopColor: 'var(--orange)' }} />
                Загрузка…
              </div>
            )}

            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => e.target.files?.[0] && handleCoverFile(e.target.files[0])}
            />
          </div>

          {/* Author */}
          <div style={{ ...cardStyle, padding: '16px' }}>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <User size={12} /> Автор
            </label>
            <input
              value={form.author}
              onChange={e => set({ author: e.target.value })}
              placeholder="Имя автора"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none transition"
              style={{
                background: '#fafaf9',
                border: '1px solid var(--cream-border)',
                color: '#374151',
              }}
            />
          </div>

          {/* Category */}
          <div style={{ ...cardStyle, padding: '16px' }}>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Tag size={12} /> Рубрика
            </label>
            <div className="space-y-1.5">
              {CATEGORIES.filter(cat => (cat.crm ? form.sites.includes('crm') : form.sites.includes('agency') || cat.key === 'analytics')).map(cat => {
                const active = form.category === cat.key
                return (
                  <label key={cat.key} className="flex items-center gap-2.5 cursor-pointer group">
                    <span className="w-4 h-4 shrink-0 rounded-full border-2 flex items-center justify-center transition-all"
                      style={{
                        borderColor: active ? 'var(--orange)' : '#d1d5db',
                        background: active ? 'var(--orange)' : 'transparent',
                      }}>
                      {active && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </span>
                    <input
                      type="radio"
                      name="category"
                      value={cat.key}
                      checked={active}
                      onChange={() => set({ category: cat.key })}
                      className="sr-only"
                    />
                    <span className="text-sm transition-colors"
                      style={{ color: active ? 'var(--orange)' : '#6b7280', fontWeight: active ? 500 : 400 }}>
                      {cat.label}
                    </span>
                  </label>
                )
              })}
            </div>
            {form.category && (
              <button
                onClick={() => set({ category: '' })}
                className="mt-3 text-xs transition-colors"
                style={{ color: '#9ca3af' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}
              >
                Снять выбор
              </button>
            )}
          </div>

          {/* Tags */}
          <div style={{ ...cardStyle, padding: '16px' }}>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Tag size={12} /> Теги
            </label>
            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {form.tags.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                    style={{ background: '#fff5f2', color: 'var(--orange)', border: '1px solid #ffd5c8' }}>
                    {tag}
                    <button onClick={() => removeTag(tag)} className="ml-0.5 hover:text-red-500 transition-colors">
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-1.5">
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() }
                }}
                placeholder="Добавить тег…"
                className="flex-1 rounded-lg px-3 py-2 text-sm outline-none transition"
                style={{ background: '#fafaf9', border: '1px solid var(--cream-border)', color: '#374151' }}
              />
              <button
                onClick={addTag}
                className="px-2.5 py-2 rounded-lg text-xs font-medium transition-colors"
                style={{ background: '#fff5f2', color: 'var(--orange)' }}
              >
                +
              </button>
            </div>
            <p className="text-xs mt-1.5" style={{ color: '#d1d5db' }}>Enter или запятая для добавления</p>
          </div>

          {/* SEO (collapsible) — per active language */}
          <div style={{ ...cardStyle, overflow: 'hidden' }}>
            <button
              onClick={() => setSeoOpen(!seoOpen)}
              className="w-full flex items-center justify-between px-4 py-3 transition-colors"
              style={{ background: 'transparent' }}
            >
              <span style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Globe size={12} /> SEO · {LANGS.find(l => l.code === activeLang)?.flag}
              </span>
              {seoOpen ? <ChevronUp size={14} style={{ color: '#9ca3af' }} /> : <ChevronDown size={14} style={{ color: '#9ca3af' }} />}
            </button>
            {seoOpen && (
              <div className="px-4 pb-4 pt-1 space-y-3" style={{ borderTop: '1px solid var(--cream-border)' }}>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: '#6b7280' }}>SEO заголовок</label>
                  <input
                    value={cur.seoTitle}
                    onChange={e => setLang(activeLang, { seoTitle: e.target.value })}
                    placeholder={cur.title}
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ background: '#fafaf9', border: '1px solid var(--cream-border)', color: '#374151' }}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: '#6b7280' }}>SEO описание</label>
                  <textarea
                    value={cur.seoDescription}
                    onChange={e => setLang(activeLang, { seoDescription: e.target.value })}
                    rows={3}
                    placeholder={cur.excerpt}
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
                    style={{ background: '#fafaf9', border: '1px solid var(--cream-border)', color: '#374151' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Status toggle */}
          <div style={{ ...cardStyle, padding: '16px' }}>
            <label style={{ ...labelStyle, display: 'block', marginBottom: 12 }}>Статус</label>
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--cream-border)' }}>
              {(['draft', 'published', 'archived'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => set({ status: s })}
                  className="flex-1 py-2 text-xs font-medium transition-colors"
                  style={{
                    background: form.status === s
                      ? s === 'published' ? '#10b981'
                      : s === 'archived' ? '#6b7280'
                      : '#f59e0b'
                      : '#fff',
                    color: form.status === s ? '#fff' : '#6b7280',
                  }}
                >
                  {s === 'draft' ? 'Черновик' : s === 'published' ? 'Опубликован' : 'Архив'}
                </button>
              ))}
            </div>
          </div>

        </aside>
      </div>
    </div>
  )
}
