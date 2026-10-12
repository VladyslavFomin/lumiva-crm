import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getNewsletterSubscribers, getNewsletterStats, unsubscribeEmail, exportNewsletterCsv } from '../api'
import { Download, UserX } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'

const langLabels: Record<string, string> = { ru: 'RU', en: 'EN', tr: 'TR' }
const langColors: Record<string, string> = {
  ru: 'bg-blue-100 text-blue-700',
  en: 'bg-green-100 text-green-700',
  tr: 'bg-orange-100 text-orange-700',
}

export default function NewsletterPage() {
  const qc = useQueryClient()
  const [filterLang, setFilterLang] = useState('')
  const [filterStatus, setFilterStatus] = useState('active')

  const { data: stats } = useQuery({
    queryKey: ['newsletter-stats'],
    queryFn: getNewsletterStats,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['newsletter', filterLang, filterStatus],
    queryFn: () => getNewsletterSubscribers({
      limit: 200,
      lang: filterLang || undefined,
      status: filterStatus || undefined,
    }),
  })

  const unsub = useMutation({
    mutationFn: unsubscribeEmail,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['newsletter'] })
      qc.invalidateQueries({ queryKey: ['newsletter-stats'] })
      toast.success('Unsubscribed')
    },
    onError: () => toast.error('Error'),
  })

  const subscribers = data?.items || []

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Newsletter subscribers</h1>
          {stats && (
            <p className="text-sm text-gray-500 mt-1">
              {stats.active} active · {stats.unsubscribed} unsubscribed · {stats.total} total
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportNewsletterCsv(filterLang || undefined).catch(() => toast.error('Export failed'))}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            <Download size={14} />
            Export CSV{filterLang ? ` (${filterLang.toUpperCase()})` : ''}
          </button>
        </div>
      </div>

      {/* Stats by lang */}
      {stats?.byLang?.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {stats.byLang.map((r: any) => (
            <div key={r.lang} className="bg-white border border-gray-200 rounded-xl px-5 py-4">
              <div className="text-xs text-gray-400 mb-1 font-mono uppercase">{langLabels[r.lang] || r.lang || 'Unknown'}</div>
              <div className="text-2xl font-bold text-gray-900">{r.count}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select
          value={filterLang}
          onChange={e => setFilterLang(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="">All languages</option>
          <option value="ru">RU</option>
          <option value="en">EN</option>
          <option value="tr">TR</option>
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="active">Active</option>
          <option value="unsubscribed">Unsubscribed</option>
          <option value="">All</option>
        </select>
      </div>

      {isLoading && <p className="text-gray-500">Loading…</p>}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {subscribers.length === 0 && !isLoading && (
          <div className="py-12 text-center text-gray-400">No subscribers found</div>
        )}
        {subscribers.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-400 font-mono uppercase tracking-wide">
                <th className="px-5 py-3">Email</th>
                <th className="px-3 py-3">Lang</th>
                <th className="px-3 py-3">Source</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Subscribed</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {subscribers.map((s: any) => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-gray-900">{s.email}</td>
                  <td className="px-3 py-3">
                    {s.lang && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${langColors[s.lang] || 'bg-gray-100 text-gray-600'}`}>
                        {langLabels[s.lang] || s.lang}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-gray-500">{s.source || '—'}</td>
                  <td className="px-3 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-gray-400 text-xs">
                    {formatDistanceToNow(new Date(s.createdAt), { addSuffix: true })}
                  </td>
                  <td className="px-3 py-3">
                    {s.status === 'active' && (
                      <button
                        onClick={() => { if (confirm(`Unsubscribe ${s.email}?`)) unsub.mutate(s.email) }}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        <UserX size={12} /> Unsub
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-4">
        Showing {subscribers.length} of {data?.total || 0}
      </p>
    </div>
  )
}
