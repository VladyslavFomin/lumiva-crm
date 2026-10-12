import { useRef, useState } from 'react'
import { Upload, X, ChevronUp, ChevronDown, Plus, GripVertical } from 'lucide-react'
import { uploadMedia } from '../api'
import toast from 'react-hot-toast'

// ─── Types ───────────────────────────────────────────────────────────────────

export type Block =
  | { type: 'paragraph'; data: { text: string } }
  | { type: 'heading'; data: { level: 2 | 3; text: string } }
  | { type: 'image'; data: { url: string; caption: string; alt: string } }
  | { type: 'figure'; data: { figNum: string; title: string; subtitle: string; caption: string; note: string; bars: { label: string; value: number; color: string }[] } }
  | { type: 'callout'; data: { label: string; text: string } }
  | { type: 'quote'; data: { text: string; author: string } }
  | { type: 'divider'; data: Record<string, never> }
  | { type: 'table'; data: { headers: string[]; rows: string[][] } }

// ─── Default block factories ─────────────────────────────────────────────────

const defaults: Record<Block['type'], () => Block['data']> = {
  paragraph: () => ({ text: '' }),
  heading:   () => ({ level: 2, text: '' }),
  image:     () => ({ url: '', caption: '', alt: '' }),
  figure:    () => ({ figNum: 'FIG. 01', title: '', subtitle: '', caption: '', note: '', bars: [{ label: '', value: 0, color: '#222222' }] }),
  callout:   () => ({ label: '', text: '' }),
  quote:     () => ({ text: '', author: '' }),
  divider:   () => ({}),
  table:     () => ({ headers: ['', ''], rows: [['', '']] }),
}

const BLOCK_LABELS: Record<Block['type'], string> = {
  paragraph: 'Абзац',
  heading:   'Заголовок',
  image:     'Изображение',
  figure:    'График',
  callout:   'Примечание',
  quote:     'Цитата',
  divider:   'Разделитель',
  table:     'Таблица',
}

const BLOCK_TYPES = Object.keys(BLOCK_LABELS) as Block['type'][]

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = {
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
  } as React.CSSProperties,
  label: {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.07em',
    color: '#9ca3af',
    display: 'block',
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#111',
    outline: 'none',
    background: '#fafafa',
  } as React.CSSProperties,
  textarea: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#111',
    outline: 'none',
    background: '#fafafa',
    resize: 'vertical' as const,
    lineHeight: '1.6',
  } as React.CSSProperties,
}

// ─── Block preview (collapsed) ────────────────────────────────────────────────

function blockPreview(block: Block): string {
  switch (block.type) {
    case 'paragraph': return block.data.text.slice(0, 80) || '—'
    case 'heading':   return `H${block.data.level}: ${block.data.text.slice(0, 60)}` || '—'
    case 'image':     return block.data.url ? `📷 ${block.data.url.split('/').pop()}` : '📷 (нет изображения)'
    case 'figure':    return `📊 ${block.data.title || 'Без названия'}`
    case 'callout':   return `ℹ️ ${block.data.text.slice(0, 60)}` || '—'
    case 'quote':     return `❝ ${block.data.text.slice(0, 60)}` || '—'
    case 'divider':   return '─────────────'
    case 'table':     return `Таблица ${block.data.headers.length} кол. × ${block.data.rows.length} стр.`
    default: return '—'
  }
}

// ─── Block editors ────────────────────────────────────────────────────────────

function ParagraphEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  return (
    <div>
      <label style={s.label}>Текст</label>
      <textarea
        style={{ ...s.textarea, minHeight: '120px' }}
        value={data.text}
        onChange={e => onChange({ ...data, text: e.target.value })}
        placeholder="Введите текст. Поддерживается **жирный**, *курсив*, `код`, [ссылки](url)"
      />
      <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: 4 }}>
        **жирный** · *курсив* · `код` · [текст](url)
      </p>
    </div>
  )
}

function HeadingEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <label style={s.label}>Уровень</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {[2, 3].map(lv => (
            <button
              key={lv}
              onClick={() => onChange({ ...data, level: lv })}
              style={{
                padding: '6px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                border: '1px solid',
                cursor: 'pointer',
                background: data.level === lv ? '#111' : '#fff',
                color: data.level === lv ? '#fff' : '#6b7280',
                borderColor: data.level === lv ? '#111' : '#e5e7eb',
              }}
            >H{lv}</button>
          ))}
        </div>
      </div>
      <div>
        <label style={s.label}>Текст заголовка</label>
        <input
          style={{ ...s.input, fontSize: data.level === 2 ? '20px' : '16px', fontWeight: 700 }}
          value={data.text}
          onChange={e => onChange({ ...data, text: e.target.value })}
          placeholder="Заголовок раздела…"
        />
      </div>
    </div>
  )
}

function ImageEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) { toast.error('Только изображения'); return }
    setUploading(true)
    try {
      const res = await uploadMedia(file)
      onChange({ ...data, url: res.url })
    } catch { toast.error('Ошибка загрузки') }
    finally { setUploading(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <label style={s.label}>Изображение</label>
        {data.url ? (
          <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden' }}>
            <img src={data.url} alt={data.alt || ''} style={{ width: '100%', maxHeight: 240, objectFit: 'cover', display: 'block' }} />
            <button
              onClick={() => onChange({ ...data, url: '' })}
              style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
            ><X size={12} /></button>
          </div>
        ) : (
          <div
            onClick={() => fileRef.current?.click()}
            style={{ border: '2px dashed #e5e7eb', borderRadius: 8, padding: '32px 16px', textAlign: 'center', cursor: 'pointer', background: '#fafafa' }}
          >
            <Upload size={20} style={{ color: '#d1d5db', margin: '0 auto 8px' }} />
            <p style={{ fontSize: 13, color: '#9ca3af' }}>Нажмите или вставьте URL</p>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
        {uploading && <p style={{ fontSize: 12, color: '#f97316' }}>Загрузка…</p>}
      </div>
      <div>
        <label style={s.label}>URL (вручную)</label>
        <input style={s.input} value={data.url} onChange={e => onChange({ ...data, url: e.target.value })} placeholder="https://…" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <label style={s.label}>Подпись</label>
          <input style={s.input} value={data.caption} onChange={e => onChange({ ...data, caption: e.target.value })} placeholder="Описание под фото" />
        </div>
        <div>
          <label style={s.label}>Alt-текст</label>
          <input style={s.input} value={data.alt} onChange={e => onChange({ ...data, alt: e.target.value })} placeholder="для SEO" />
        </div>
      </div>
    </div>
  )
}

function FigureEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  function updateBar(idx: number, field: string, val: any) {
    const bars = [...data.bars]
    bars[idx] = { ...bars[idx], [field]: field === 'value' ? Number(val) : val }
    onChange({ ...data, bars })
  }
  function addBar() { onChange({ ...data, bars: [...data.bars, { label: '', value: 0, color: '#222222' }] }) }
  function removeBar(idx: number) { onChange({ ...data, bars: data.bars.filter((_: any, i: number) => i !== idx) }) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <label style={s.label}>Номер графика</label>
          <input style={s.input} value={data.figNum} onChange={e => onChange({ ...data, figNum: e.target.value })} placeholder="FIG. 01" />
        </div>
        <div>
          <label style={s.label}>Подзаголовок</label>
          <input style={s.input} value={data.subtitle} onChange={e => onChange({ ...data, subtitle: e.target.value })} placeholder="N = 142 · СТАНДАРТИЗИРОВАНО" />
        </div>
      </div>
      <div>
        <label style={s.label}>Заголовок графика</label>
        <input style={s.input} value={data.title} onChange={e => onChange({ ...data, title: e.target.value })} placeholder="Вклад факторов в итоговый CPA" />
      </div>

      <div>
        <label style={s.label}>Данные (строки)</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.bars.map((bar: any, i: number) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 50px 24px', gap: 8, alignItems: 'center' }}>
              <input style={s.input} value={bar.label} onChange={e => updateBar(i, 'label', e.target.value)} placeholder="Метка" />
              <input style={s.input} type="number" value={bar.value} onChange={e => updateBar(i, 'value', e.target.value)} placeholder="0.00" step="0.01" />
              <input type="color" value={bar.color || '#222222'} onChange={e => updateBar(i, 'color', e.target.value)}
                style={{ width: '100%', height: 36, borderRadius: 6, border: '1px solid #e5e7eb', cursor: 'pointer', padding: 2 }} />
              <button onClick={() => removeBar(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'grid', placeItems: 'center' }}>
                <X size={14} />
              </button>
            </div>
          ))}
          <button onClick={addBar} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#f97316', background: '#fff5f2', border: '1px solid #ffd5c8', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
            <Plus size={13} /> Добавить строку
          </button>
        </div>
      </div>

      <div>
        <label style={s.label}>Подпись к графику (курсив)</label>
        <textarea style={{ ...s.textarea, minHeight: 60 }} value={data.caption} onChange={e => onChange({ ...data, caption: e.target.value })} placeholder="Нормализованный коэффициент…" />
      </div>
      <div>
        <label style={s.label}>Примечание</label>
        <input style={s.input} value={data.note} onChange={e => onChange({ ...data, note: e.target.value })} placeholder="Дополнительная заметка…" />
      </div>
    </div>
  )
}

function CalloutEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <label style={s.label}>Заголовок примечания</label>
        <input style={s.input} value={data.label} onChange={e => onChange({ ...data, label: e.target.value })} placeholder="Методологическая оговорка" />
      </div>
      <div>
        <label style={s.label}>Текст</label>
        <textarea style={{ ...s.textarea, minHeight: 100 }} value={data.text} onChange={e => onChange({ ...data, text: e.target.value })} placeholder="Это не академическое исследование…" />
      </div>
    </div>
  )
}

function QuoteEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <label style={s.label}>Цитата</label>
        <textarea style={{ ...s.textarea, minHeight: 80 }} value={data.text} onChange={e => onChange({ ...data, text: e.target.value })} placeholder="Текст цитаты…" />
      </div>
      <div>
        <label style={s.label}>Автор (необязательно)</label>
        <input style={s.input} value={data.author} onChange={e => onChange({ ...data, author: e.target.value })} placeholder="Имя автора" />
      </div>
    </div>
  )
}

function TableEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  function setHeader(i: number, val: string) {
    const h = [...data.headers]; h[i] = val; onChange({ ...data, headers: h })
  }
  function setCell(r: number, c: number, val: string) {
    const rows = data.rows.map((row: string[]) => [...row])
    rows[r][c] = val; onChange({ ...data, rows })
  }
  function addCol() {
    onChange({ ...data, headers: [...data.headers, ''], rows: data.rows.map((r: string[]) => [...r, '']) })
  }
  function addRow() {
    onChange({ ...data, rows: [...data.rows, data.headers.map(() => '')] })
  }
  function removeRow(i: number) {
    onChange({ ...data, rows: data.rows.filter((_: any, idx: number) => idx !== i) })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {data.headers.map((h: string, i: number) => (
                <th key={i} style={{ padding: 4, border: '1px solid #e5e7eb' }}>
                  <input value={h} onChange={e => setHeader(i, e.target.value)} placeholder={`Колонка ${i + 1}`}
                    style={{ width: '100%', padding: '4px 6px', border: 'none', outline: 'none', fontWeight: 600, fontSize: 13, background: '#f9fafb' }} />
                </th>
              ))}
              <th style={{ padding: 4, border: '1px solid #e5e7eb', width: 24 }} />
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row: string[], r: number) => (
              <tr key={r}>
                {row.map((cell: string, c: number) => (
                  <td key={c} style={{ padding: 4, border: '1px solid #e5e7eb' }}>
                    <input value={cell} onChange={e => setCell(r, c, e.target.value)}
                      style={{ width: '100%', padding: '4px 6px', border: 'none', outline: 'none', fontSize: 13 }} />
                  </td>
                ))}
                <td style={{ padding: 4, border: '1px solid #e5e7eb', textAlign: 'center' }}>
                  <button onClick={() => removeRow(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
                    <X size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={addRow} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#f97316', background: '#fff5f2', border: '1px solid #ffd5c8', borderRadius: 8, padding: '5px 10px', cursor: 'pointer' }}>
          <Plus size={11} /> Строка
        </button>
        <button onClick={addCol} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#6b7280', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '5px 10px', cursor: 'pointer' }}>
          <Plus size={11} /> Колонка
        </button>
      </div>
    </div>
  )
}

// ─── Block item (collapsed + expanded) ──────────────────────────────────────

interface BlockItemProps {
  block: Block
  index: number
  total: number
  isActive: boolean
  onToggle: () => void
  onChange: (b: Block) => void
  onMove: (dir: -1 | 1) => void
  onDelete: () => void
}

function BlockItem({ block, index, total, isActive, onToggle, onChange, onMove, onDelete }: BlockItemProps) {
  const typeColor = {
    paragraph: '#6b7280',
    heading:   '#7c3aed',
    image:     '#0891b2',
    figure:    '#dc2626',
    callout:   '#d97706',
    quote:     '#059669',
    divider:   '#9ca3af',
    table:     '#1d4ed8',
  }[block.type] || '#6b7280'

  function editor() {
    const upd = (d: any) => onChange({ ...block, data: d } as Block)
    switch (block.type) {
      case 'paragraph': return <ParagraphEditor data={block.data} onChange={upd} />
      case 'heading':   return <HeadingEditor   data={block.data} onChange={upd} />
      case 'image':     return <ImageEditor      data={block.data} onChange={upd} />
      case 'figure':    return <FigureEditor     data={block.data} onChange={upd} />
      case 'callout':   return <CalloutEditor    data={block.data} onChange={upd} />
      case 'quote':     return <QuoteEditor      data={block.data} onChange={upd} />
      case 'divider':   return <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', margin: 0 }}>Горизонтальный разделитель</p>
      case 'table':     return <TableEditor      data={block.data} onChange={upd} />
      default: return null
    }
  }

  return (
    <div style={{ ...s.card, overflow: 'hidden', border: isActive ? `1px solid ${typeColor}` : '1px solid #e5e7eb' }}>
      {/* Header row */}
      <div
        onClick={onToggle}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', background: isActive ? `${typeColor}08` : '#fff', userSelect: 'none' }}
      >
        <GripVertical size={14} style={{ color: '#d1d5db', flexShrink: 0 }} />
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: typeColor, background: `${typeColor}15`, padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>
          {BLOCK_LABELS[block.type]}
        </span>
        <span style={{ fontSize: 13, color: '#6b7280', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {blockPreview(block)}
        </span>
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button disabled={index === 0} onClick={() => onMove(-1)} style={{ background: 'none', border: 'none', cursor: index === 0 ? 'default' : 'pointer', color: index === 0 ? '#e5e7eb' : '#9ca3af', padding: '2px 4px' }}>
            <ChevronUp size={14} />
          </button>
          <button disabled={index === total - 1} onClick={() => onMove(1)} style={{ background: 'none', border: 'none', cursor: index === total - 1 ? 'default' : 'pointer', color: index === total - 1 ? '#e5e7eb' : '#9ca3af', padding: '2px 4px' }}>
            <ChevronDown size={14} />
          </button>
          <button onClick={onDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '2px 4px' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
            onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Editor area */}
      {isActive && (
        <div style={{ padding: '16px 16px 20px', borderTop: `1px solid ${typeColor}20` }}>
          {editor()}
        </div>
      )}
    </div>
  )
}

// ─── Add block menu ──────────────────────────────────────────────────────────

function AddBlockMenu({ onAdd }: { onAdd: (type: Block['type']) => void }) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 16px', border: '2px dashed #e5e7eb', borderRadius: 10, background: '#fafafa', cursor: 'pointer', fontSize: 13, color: '#6b7280', justifyContent: 'center' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#f97316'; e.currentTarget.style.color = '#f97316' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = '#6b7280' }}
      >
        <Plus size={14} /> Добавить блок
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9 }} onClick={() => setOpen(false)} />
          <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 8, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 10, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#f3f4f6' }}>
              {BLOCK_TYPES.map(t => (
                <button
                  key={t}
                  onClick={() => { onAdd(t); setOpen(false) }}
                  style={{ padding: '10px 14px', background: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, color: '#374151', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#fff5f2')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                >
                  {BLOCK_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Main BlockEditor component ───────────────────────────────────────────────

interface BlockEditorProps {
  blocks: Block[]
  onChange: (blocks: Block[]) => void
}

export default function BlockEditor({ blocks, onChange }: BlockEditorProps) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null)

  function addBlock(type: Block['type']) {
    const newBlock = { type, data: defaults[type]() } as Block
    const updated = [...blocks, newBlock]
    onChange(updated)
    setActiveIdx(updated.length - 1)
  }

  function updateBlock(idx: number, block: Block) {
    const updated = [...blocks]
    updated[idx] = block
    onChange(updated)
  }

  function moveBlock(idx: number, dir: -1 | 1) {
    const updated = [...blocks]
    const target = idx + dir
    if (target < 0 || target >= updated.length) return
    ;[updated[idx], updated[target]] = [updated[target], updated[idx]]
    onChange(updated)
    setActiveIdx(target)
  }

  function deleteBlock(idx: number) {
    onChange(blocks.filter((_, i) => i !== idx))
    setActiveIdx(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {blocks.length === 0 && (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
          Нет блоков — добавьте первый ниже
        </div>
      )}
      {blocks.map((block, i) => (
        <BlockItem
          key={i}
          block={block}
          index={i}
          total={blocks.length}
          isActive={activeIdx === i}
          onToggle={() => setActiveIdx(activeIdx === i ? null : i)}
          onChange={b => updateBlock(i, b)}
          onMove={dir => moveBlock(i, dir)}
          onDelete={() => deleteBlock(i)}
        />
      ))}
      <AddBlockMenu onAdd={addBlock} />
    </div>
  )
}
