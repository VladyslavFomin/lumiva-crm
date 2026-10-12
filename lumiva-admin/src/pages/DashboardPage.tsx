import { useQuery } from '@tanstack/react-query'
import { getDashboard } from '../api'
import { FileText, Briefcase, Mail, AlertCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

function Stat({ label, value, sub, icon: Icon, color }: any) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard })

  if (isLoading) return <div className="p-8 text-gray-500">Loading…</div>
  if (!data) return null

  return (
    <div className="p-8 max-w-6xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Stat label="Blog posts" value={data.blog.total} sub={`${data.blog.published} published`} icon={FileText} color="bg-violet-500" />
        <Stat label="Cases" value={data.cases.total} sub={`${data.cases.published} published`} icon={Briefcase} color="bg-blue-500" />
        <Stat label="Form submissions" value={data.forms.total} sub={`${data.forms.last24h} today`} icon={Mail} color="bg-emerald-500" />
        <Stat label="New leads" value={data.forms.new} sub="awaiting review" icon={AlertCircle} color="bg-orange-500" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Recent form submissions</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100">
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium">Type</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Time</th>
            </tr>
          </thead>
          <tbody>
            {data.recentForms.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400">No submissions yet</td></tr>
            )}
            {data.recentForms.map((f: any) => (
              <tr key={f.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-5 py-3 font-medium text-gray-900">{f.name || '—'}</td>
                <td className="px-5 py-3 text-gray-600">{f.email || '—'}</td>
                <td className="px-5 py-3">
                  <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">{f.type}</span>
                </td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    f.status === 'new' ? 'bg-orange-100 text-orange-700' :
                    f.status === 'done' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>{f.status}</span>
                </td>
                <td className="px-5 py-3 text-gray-400">
                  {formatDistanceToNow(new Date(f.createdAt), { addSuffix: true })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
