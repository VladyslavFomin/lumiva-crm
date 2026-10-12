import { useEffect, useRef } from 'react'

// ─── Block types ─────────────────────────────────────────────────────────────

export type Block =
  | { type: 'paragraph'; data: { text: string } }
  | { type: 'heading'; data: { level: 2 | 3; text: string } }
  | { type: 'image'; data: { url: string; caption?: string; alt?: string } }
  | { type: 'figure'; data: { figNum?: string; title: string; subtitle?: string; caption?: string; note?: string; bars: { label: string; value: number; color?: string }[] } }
  | { type: 'callout'; data: { label?: string; text: string } }
  | { type: 'quote'; data: { text: string; author?: string } }
  | { type: 'divider'; data: Record<string, never> }
  | { type: 'table'; data: { headers: string[]; rows: string[][] } }

// ─── Inline text ─────────────────────────────────────────────────────────────

function inline(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
}

// ─── Heading slugifier ────────────────────────────────────────────────────────

let h2Counter = 0
function resetCounter() { h2Counter = 0 }
function nextH2Id() { return `s${++h2Counter}` }

// ─── Individual block renderers ───────────────────────────────────────────────

function Paragraph({ data }: { data: { text: string } }) {
  return <p dangerouslySetInnerHTML={{ __html: inline(data.text) }} />
}

function Heading({ data, id }: { data: { level: 2 | 3; text: string }; id?: string }) {
  const Tag = `h${data.level}` as 'h2' | 'h3'
  return <Tag id={id} dangerouslySetInnerHTML={{ __html: inline(data.text) }} />
}

function ImageBlock({ data }: { data: { url: string; caption?: string; alt?: string } }) {
  return (
    <figure>
      <img src={data.url} alt={data.alt || data.caption || ''} loading="lazy" />
      {data.caption && <figcaption>{data.caption}</figcaption>}
    </figure>
  )
}

function FigureBlock({ data }: { data: { figNum?: string; title: string; subtitle?: string; caption?: string; note?: string; bars: { label: string; value: number; color?: string }[] } }) {
  const max = Math.max(...data.bars.map(b => b.value), 1)
  return (
    <div className="b-figure">
      <div className="b-figure-head">
        {data.figNum && <span className="b-fig-num">{data.figNum}</span>}
        <span className="b-fig-title">{data.title}</span>
        {data.subtitle && <span className="b-fig-sub">{data.subtitle}</span>}
      </div>
      <div className="b-bars">
        {data.bars.map((bar, i) => (
          <div key={i} className="b-bar-row">
            <span className="b-bar-label">{bar.label}</span>
            <div className="b-bar-track">
              <div
                className="b-bar-fill"
                style={{ width: `${(bar.value / max) * 100}%`, background: bar.color || 'var(--ink)' }}
              />
            </div>
            <span className="b-bar-val">{bar.value}</span>
          </div>
        ))}
      </div>
      {data.caption && <p className="b-fig-caption" dangerouslySetInnerHTML={{ __html: inline(data.caption) }} />}
      {data.note && <p className="b-fig-note" dangerouslySetInnerHTML={{ __html: inline(data.note) }} />}
    </div>
  )
}

function Callout({ data }: { data: { label?: string; text: string } }) {
  return (
    <div className="b-callout">
      <div className="b-callout-ic">i</div>
      <div className="b-callout-body">
        {data.label && <div className="b-callout-label">{data.label}</div>}
        <p dangerouslySetInnerHTML={{ __html: inline(data.text) }} />
      </div>
    </div>
  )
}

function Quote({ data }: { data: { text: string; author?: string } }) {
  return (
    <blockquote>
      <p dangerouslySetInnerHTML={{ __html: inline(data.text) }} />
      {data.author && <cite>{data.author}</cite>}
    </blockquote>
  )
}

function Divider() {
  return <hr />
}

function TableBlock({ data }: { data: { headers: string[]; rows: string[][] } }) {
  return (
    <div className="b-table-wrap">
      <table>
        {data.headers.length > 0 && (
          <thead>
            <tr>{data.headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
          </thead>
        )}
        <tbody>
          {data.rows.map((row, i) => (
            <tr key={i}>{row.map((cell, j) => <td key={j} dangerouslySetInnerHTML={{ __html: inline(cell) }} />)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── TOC extractor ────────────────────────────────────────────────────────────

export function extractBlockToc(blocks: Block[]): { id: string; text: string }[] {
  let count = 0
  return blocks
    .filter(b => b.type === 'heading' && (b as any).data.level === 2)
    .map(b => {
      count++
      return { id: `s${count}`, text: (b as any).data.text }
    })
}

// ─── Main renderer ────────────────────────────────────────────────────────────

interface BlockRendererProps {
  blocks: Block[]
  className?: string
}

export default function BlockRenderer({ blocks, className }: BlockRendererProps) {
  const countRef = useRef(0)
  countRef.current = 0

  return (
    <div className={className}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'paragraph':
            return <Paragraph key={i} data={block.data} />
          case 'heading': {
            let id: string | undefined
            if (block.data.level === 2) {
              countRef.current++
              id = `s${countRef.current}`
            }
            return <Heading key={i} data={block.data} id={id} />
          }
          case 'image':
            return <ImageBlock key={i} data={block.data} />
          case 'figure':
            return <FigureBlock key={i} data={block.data} />
          case 'callout':
            return <Callout key={i} data={block.data} />
          case 'quote':
            return <Quote key={i} data={block.data} />
          case 'divider':
            return <Divider key={i} />
          case 'table':
            return <TableBlock key={i} data={block.data} />
          default:
            return null
        }
      })}
    </div>
  )
}
