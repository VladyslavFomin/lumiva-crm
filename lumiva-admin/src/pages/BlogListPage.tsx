import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getBlogPosts, deleteBlogPost, updateBlogPost } from '../api'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'

const LANG_LABELS: Record<string, string> = { ru: 'РУ', en: 'EN', tr: 'TR' }

function LangBadges({ langs }: { langs?: string[] }) {
  if (!Array.isArray(langs) || langs.length === 0) {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full"
        style={{ background: '#f3f4f6', color: '#9ca3af', fontFamily: 'JetBrains Mono, monospace' }}>
        РУ
      </span>
    )
  }
  return (
    <div className="flex gap-1 flex-wrap">
      {langs.map(l => (
        <span key={l} className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{
            background: l === 'ru' ? '#0f0f0f' : l === 'en' ? '#fff5f2' : '#f0fdf4',
            color:      l === 'ru' ? '#fff'    : l === 'en' ? '#ff4d14' : '#16a34a',
            border:     l === 'ru' ? 'none'    : l === 'en' ? '1px solid #ffd5c8' : '1px solid #bbf7d0',
            fontFamily: 'JetBrains Mono, monospace',
          }}>
          {LANG_LABELS[l] ?? l.toUpperCase()}
        </span>
      ))}
    </div>
  )
}

const SITE_LABEL: Record<string, string> = { agency: 'lumiva.agency', crm: 'CRM' }

function SiteBadges({ sites }: { sites?: string[] | null }) {
  const list = sites && sites.length ? sites : ['agency']
  return (
    <div className="flex gap-1 flex-wrap">
      {list.map(s => (
        <span key={s} className="text-xs px-1.5 py-0.5 rounded whitespace-nowrap"
          style={s === 'crm'
            ? { background: '#111113', color: '#c8f560' }
            : { background: '#fff5f2', color: 'var(--orange)', border: '1px solid #ffd5c8' }}>
          {SITE_LABEL[s] || s}
        </span>
      ))}
    </div>
  )
}

const SITE_FILTERS = [
  { key: 'all', label: 'Все' },
  { key: 'agency', label: 'lumiva.agency' },
  { key: 'crm', label: 'Блог CRM' },
]

export default function BlogListPage() {
  const qc = useQueryClient()
  const [site, setSite] = useState('all')
  const { data, isLoading } = useQuery({ queryKey: ['blog', site], queryFn: () => getBlogPosts({ limit: 100, site }) })
  const del = useMutation({
    mutationFn: deleteBlogPost,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['blog'] }); toast.success('Deleted') },
  })
  const toggle = useMutation({
    mutationFn: ({ id, status }: any) => updateBlogPost(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['blog'] }),
  })

  const posts = data?.items || []

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#0f0f0f' }}>Blog posts</h1>
        <Link
          to="/blog/new"
          className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors"
          style={{ background: 'var(--orange)' }}
        >
          <Plus size={16} />New post
        </Link>
      </div>

      <div className="flex gap-2 mb-4">
        {SITE_FILTERS.map(f => (
          <button key={f.key} onClick={() => setSite(f.key)}
            className="px-3 py-1.5 rounded-lg text-sm transition-colors"
            style={site === f.key
              ? { background: '#111', color: '#fff' }
              : { background: '#fff', color: '#6b7280', border: '1px solid var(--cream-border)' }}>
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && <p style={{ color: '#9ca3af' }}>Loading…</p>}

      <div className="rounded-xl" style={{ background: '#fff', border: '1px solid var(--cream-border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ borderBottom: '1px solid var(--cream-border)', color: '#9ca3af' }}>
              <th className="px-5 py-3 font-medium">Title</th>
              <th className="px-5 py-3 font-medium">Сайты</th>
              <th className="px-5 py-3 font-medium">Langs</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Views</th>
              <th className="px-5 py-3 font-medium">Updated</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {posts.length === 0 && !isLoading && (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center" style={{ color: '#9ca3af' }}>
                  No blog posts yet.{' '}
                  <Link to="/blog/new" style={{ color: 'var(--orange)' }}>Create one →</Link>
                </td>
              </tr>
            )}
            {posts.map((p: any) => (
              <tr key={p.id} className="border-b transition-colors"
                style={{ borderColor: '#f9f8f6' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#fafaf9')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td className="px-5 py-3">
                  <p className="font-medium" style={{ color: '#111' }}>{p.title}</p>
                  <p className="text-xs" style={{ color: '#9ca3af', fontFamily: 'JetBrains Mono, monospace' }}>{p.slug}</p>
                </td>
                <td className="px-5 py-3">
                  <SiteBadges sites={p.sites} />
                </td>
                <td className="px-5 py-3">
                  <LangBadges langs={p.langs} />
                </td>
                <td className="px-5 py-3">
                  <button
                    onClick={() => toggle.mutate({ id: p.id, status: p.status === 'published' ? 'draft' : 'published' })}
                    className="px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors"
                    style={{
                      background: p.status === 'published' ? '#ecfdf5' : p.status === 'archived' ? '#f3f4f6' : '#fffbeb',
                      color:      p.status === 'published' ? '#059669' : p.status === 'archived' ? '#6b7280' : '#d97706',
                    }}
                  >
                    {p.status}
                  </button>
                </td>
                <td className="px-5 py-3" style={{ color: '#9ca3af' }}>
                  <Eye size={12} className="inline mr-1" />{p.viewCount}
                </td>
                <td className="px-5 py-3 text-xs" style={{ color: '#9ca3af' }}>
                  {formatDistanceToNow(new Date(p.updatedAt), { addSuffix: true })}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <Link
                      to={`/blog/${p.id}`}
                      className="p-1.5 rounded transition-colors"
                      style={{ color: '#9ca3af' }}
                      onMouseEnter={e => {
                        const el = e.currentTarget as HTMLElement
                        el.style.color = 'var(--orange)'
                        el.style.background = '#fff5f2'
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget as HTMLElement
                        el.style.color = '#9ca3af'
                        el.style.background = 'transparent'
                      }}
                    >
                      <Pencil size={14} />
                    </Link>
                    <button
                      onClick={() => { if (confirm('Delete this post?')) del.mutate(p.id) }}
                      className="p-1.5 rounded transition-colors"
                      style={{ color: '#9ca3af' }}
                      onMouseEnter={e => {
                        const el = e.currentTarget as HTMLElement
                        el.style.color = '#ef4444'
                        el.style.background = '#fef2f2'
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget as HTMLElement
                        el.style.color = '#9ca3af'
                        el.style.background = 'transparent'
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
