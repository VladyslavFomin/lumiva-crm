import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMedia, uploadMedia, deleteMedia } from '../api'
import { Upload, Trash2, Copy } from 'lucide-react'
import toast from 'react-hot-toast'

export default function MediaPage() {
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const { data: files = [], isLoading } = useQuery({ queryKey: ['media'], queryFn: getMedia })

  const del = useMutation({
    mutationFn: deleteMedia,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['media'] }); toast.success('Deleted') },
  })

  async function handleFiles(fileList: FileList | null) {
    if (!fileList?.length) return
    setUploading(true)
    try {
      for (const file of Array.from(fileList)) {
        await uploadMedia(file)
      }
      qc.invalidateQueries({ queryKey: ['media'] })
      toast.success('Uploaded')
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url)
    toast.success('URL copied')
  }

  const isImage = (f: string) => /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(f)

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Media library</h1>
        <button
          onClick={() => inputRef.current?.click()} disabled={uploading}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors"
        >
          <Upload size={16} />{uploading ? 'Uploading…' : 'Upload files'}
        </button>
        <input ref={inputRef} type="file" multiple className="hidden"
          accept="image/*,.pdf,.svg" onChange={e => handleFiles(e.target.files)} />
      </div>

      <div
        className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center mb-6 cursor-pointer hover:border-violet-400 transition-colors"
        onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
      >
        <Upload size={24} className="mx-auto text-gray-400 mb-2" />
        <p className="text-sm text-gray-500">Drag & drop files here or click to browse</p>
        <p className="text-xs text-gray-400 mt-1">Images (JPG, PNG, WebP, GIF, SVG) and PDFs up to 10MB</p>
      </div>

      {isLoading && <p className="text-gray-500">Loading…</p>}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {files.map((f: any) => (
          <div key={f.filename} className="group relative bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="aspect-square bg-gray-100 flex items-center justify-center">
              {isImage(f.filename) ? (
                <img src={f.url} alt={f.filename} className="w-full h-full object-cover" />
              ) : (
                <div className="text-xs text-gray-400 text-center p-2">
                  <div className="text-2xl mb-1">📄</div>
                  <div className="break-all">{f.filename}</div>
                </div>
              )}
            </div>
            <div className="p-2">
              <p className="text-xs text-gray-500 truncate">{f.filename}</p>
              <p className="text-xs text-gray-400">{(f.size / 1024).toFixed(1)} KB</p>
            </div>
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => copyUrl(f.url)}
                className="p-1.5 bg-white rounded-lg shadow text-gray-600 hover:text-violet-600 transition-colors">
                <Copy size={12} />
              </button>
              <button onClick={() => { if (confirm('Delete file?')) del.mutate(f.filename) }}
                className="p-1.5 bg-white rounded-lg shadow text-gray-600 hover:text-red-600 transition-colors">
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {files.length === 0 && !isLoading && (
        <div className="text-center text-gray-400 py-12">No files uploaded yet</div>
      )}
    </div>
  )
}
