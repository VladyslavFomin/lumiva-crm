import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCases, deleteCase, updateCase } from '../api'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, Star } from 'lucide-react'
import toast from 'react-hot-toast'

export default function CasesListPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['cases'], queryFn: () => getCases({ limit: 100 }) })
  const del = useMutation({
    mutationFn: deleteCase,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cases'] }); toast.success('Deleted') },
  })
  const toggle = useMutation({
    mutationFn: ({ id, data }: any) => updateCase(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cases'] }),
  })

  const cases = data?.items || []

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Case studies</h1>
        <Link to="/cases/new" className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors">
          <Plus size={16} />New case
        </Link>
      </div>

      {isLoading && <p className="text-gray-500">Loading…</p>}

      <div className="bg-white rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100">
              <th className="px-5 py-3 font-medium">Client</th>
              <th className="px-5 py-3 font-medium">Industry</th>
              <th className="px-5 py-3 font-medium">Result</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Featured</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {cases.length === 0 && !isLoading && (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-400">No cases yet. <Link to="/cases/new" className="text-violet-600">Create one →</Link></td></tr>
            )}
            {cases.map((c: any) => (
              <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-5 py-3">
                  <p className="font-medium text-gray-900">{c.clientName}</p>
                  <p className="text-gray-400 text-xs">{c.slug}</p>
                </td>
                <td className="px-5 py-3 text-gray-600">{c.industry || '—'}</td>
                <td className="px-5 py-3 text-gray-600">
                  {c.resultValue ? `${c.resultValue} ${c.resultUnit || ''}` : c.shortResult || '—'}
                </td>
                <td className="px-5 py-3">
                  <button
                    onClick={() => toggle.mutate({ id: c.id, data: { status: c.status === 'published' ? 'draft' : 'published' } })}
                    className={`px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer ${
                      c.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >{c.status}</button>
                </td>
                <td className="px-5 py-3">
                  <button onClick={() => toggle.mutate({ id: c.id, data: { featured: !c.featured } })}
                    className={`p-1.5 rounded transition-colors ${c.featured ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'}`}>
                    <Star size={16} fill={c.featured ? 'currentColor' : 'none'} />
                  </button>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <Link to={`/cases/${c.id}`} className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded transition-colors">
                      <Pencil size={14} />
                    </Link>
                    <button
                      onClick={() => { if (confirm('Delete this case?')) del.mutate(c.id) }}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    ><Trash2 size={14} /></button>
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
