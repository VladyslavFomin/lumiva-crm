import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSettings, setSetting, getCrmStatus } from '../api'
import toast from 'react-hot-toast'
import { CheckCircle, XCircle } from 'lucide-react'

export default function SettingsPage() {
  const qc = useQueryClient()
  const { data: settings = [], isLoading } = useQuery({ queryKey: ['settings'], queryFn: getSettings })
  const { data: crmStatus } = useQuery({ queryKey: ['crm-status'], queryFn: getCrmStatus })
  const [values, setValues] = useState<Record<string, string>>({})

  useEffect(() => {
    if (settings.length) {
      const map: Record<string, string> = {}
      settings.forEach((s: any) => { map[s.key] = s.value || '' })
      setValues(map)
    }
  }, [settings])

  const save = useMutation({
    mutationFn: ({ key, value, label, group }: any) => setSetting(key, value, label, group),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); toast.success('Saved') },
  })

  function handleSave(key: string, label?: string, group?: string) {
    save.mutate({ key, value: values[key] || '', label, group })
  }

  const groups: Record<string, any[]> = {}
  settings.forEach((s: any) => {
    const g = s.group || 'general'
    if (!groups[g]) groups[g] = []
    groups[g].push(s)
  })

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      {isLoading && <p className="text-gray-500">Loading…</p>}

      <div className="space-y-8">
        {Object.entries(groups).map(([group, items]) => (
          <div key={group} className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 capitalize">{group}</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {items.map((s: any) => (
                <div key={s.key} className="flex items-center gap-4 px-5 py-3">
                  <label className="w-48 text-sm text-gray-600 shrink-0">{s.label || s.key}</label>
                  <input
                    value={values[s.key] ?? ''}
                    onChange={e => setValues(v => ({ ...v, [s.key]: e.target.value }))}
                    className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                  <button
                    onClick={() => handleSave(s.key, s.label, s.group)}
                    disabled={save.isPending}
                    className="px-3 py-1.5 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700 disabled:opacity-50 transition-colors shrink-0"
                  >Save</button>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">CRM status</h2>
          </div>
          <div className="px-5 py-4 flex items-center gap-3">
            {crmStatus?.connected ? (
              <><CheckCircle size={18} className="text-green-500" /><span className="text-sm text-green-700">Connected to {crmStatus.url}</span></>
            ) : (
              <><XCircle size={18} className="text-red-500" /><span className="text-sm text-red-700">{crmStatus?.reason || 'Not connected'}</span></>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
