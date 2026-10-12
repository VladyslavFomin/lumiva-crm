import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getForms, updateForm, deleteForm, pushLeadToCrm } from '../api'
import { Trash2, Send, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'

const statuses = ['new', 'viewed', 'in_progress', 'done', 'spam']
const statusColors: Record<string, string> = {
  new: 'bg-orange-100 text-orange-700',
  viewed: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  done: 'bg-green-100 text-green-700',
  spam: 'bg-gray-100 text-gray-500',
}

export default function FormsPage() {
  const qc = useQueryClient()
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['forms', filterStatus, filterType],
    queryFn: () => getForms({ limit: 100, status: filterStatus || undefined, type: filterType || undefined }),
  })

  const update = useMutation({
    mutationFn: ({ id, data }: any) => updateForm(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forms'] }),
  })
  const del = useMutation({
    mutationFn: deleteForm,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['forms'] }); toast.success('Deleted') },
  })
  const push = useMutation({
    mutationFn: pushLeadToCrm,
    onSuccess: () => toast.success('Pushed to CRM'),
    onError: () => toast.error('CRM push failed'),
  })

  const forms = data?.items || []

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Form submissions</h1>
        <div className="flex gap-3">
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
            <option value="">All types</option>
            <option value="contact">Contact</option>
            <option value="newsletter">Newsletter</option>
            <option value="popup">Popup</option>
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
            <option value="">All statuses</option>
            {statuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {isLoading && <p className="text-gray-500">Loading…</p>}

      <div className="space-y-2">
        {forms.length === 0 && !isLoading && (
          <div className="bg-white rounded-xl border border-gray-200 py-12 text-center text-gray-400">No submissions found</div>
        )}
        {forms.map((f: any) => (
          <div key={f.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-4 px-5 py-3 cursor-pointer" onClick={() => setExpanded(expanded === f.id ? null : f.id)}>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${statusColors[f.status] || 'bg-gray-100 text-gray-600'}`}>{f.status}</span>
              <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600 shrink-0">{f.type}</span>
              <div className="flex-1 min-w-0">
                <span className="font-medium text-gray-900">{f.name || '—'}</span>
                <span className="text-gray-400 text-sm ml-2">{f.email}</span>
              </div>
              <span className="text-xs text-gray-400 shrink-0">{formatDistanceToNow(new Date(f.createdAt), { addSuffix: true })}</span>
              <ChevronDown size={16} className={`text-gray-400 shrink-0 transition-transform ${expanded === f.id ? 'rotate-180' : ''}`} />
            </div>

            {expanded === f.id && (
              <div className="border-t border-gray-100 px-5 py-4 space-y-4">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  {f.phone && <div><span className="text-gray-500">Phone:</span> {f.phone}</div>}
                  {f.company && <div><span className="text-gray-500">Company:</span> {f.company}</div>}
                  {f.budget && <div><span className="text-gray-500">Budget:</span> {f.budget}</div>}
                  {f.source && <div><span className="text-gray-500">Source:</span> {f.source}</div>}
                  {f.ip && <div><span className="text-gray-500">IP:</span> {f.ip}</div>}
                  {f.crmLeadId && <div><span className="text-gray-500">CRM Lead:</span> {f.crmLeadId}</div>}
                </div>
                {f.message && (
                  <div className="text-sm">
                    <span className="text-gray-500">Message:</span>
                    <p className="mt-1 text-gray-700 whitespace-pre-wrap">{f.message}</p>
                  </div>
                )}
                {f.notes && (
                  <div className="text-sm">
                    <span className="text-gray-500">Source details:</span>
                    <p className="mt-1 text-gray-700 whitespace-pre-wrap">{f.notes}</p>
                  </div>
                )}
                <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                  <select value={f.status} onChange={e => update.mutate({ id: f.id, data: { status: e.target.value } })}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none">
                    {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {!f.crmLeadId && (
                    <button onClick={() => push.mutate(f.id)} disabled={push.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700 disabled:opacity-50 transition-colors">
                      <Send size={12} />Push to CRM
                    </button>
                  )}
                  <button onClick={() => { if (confirm('Delete?')) del.mutate(f.id) }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-red-600 border border-red-200 rounded-lg text-sm hover:bg-red-50 transition-colors">
                    <Trash2 size={12} />Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
