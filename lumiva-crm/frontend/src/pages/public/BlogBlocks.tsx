// Рендер блоков статьи из редактора pl2 (BlockEditor: paragraph/heading/image/figure/callout/quote/divider/table).
// Формат тот же, что у lumiva-site/src/components/BlockRenderer.tsx: inline-разметка **жирный**, *курсив*, `код`,
// [текст](ссылка). Внутри абзаца строки «* …» / «- …» превращаются в список.
import React from 'react';
import type { BlogBlock } from './blogApi';

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function inline(text: string): string {
  return esc(text || '')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, href: string) => {
      const ok = /^(https?:\/\/|\/|#|mailto:)/i.test(href);
      if (!ok) return label;
      const ext = /^https?:\/\//i.test(href) && !/^https?:\/\/crm\.lumiva\.agency/i.test(href);
      return `<a href="${href}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label}</a>`;
    });
}

const LIST_RE = /^\s*(?:[*•-]|\d+[.)])\s+/;

/** Абзац: обычные строки → <p> с переносами, подряд идущие «* …» → <ul>/<ol>. */
function Paragraph({ text }: { text: string }) {
  const lines = (text || '').split('\n');
  const out: React.ReactNode[] = [];
  let buf: string[] = [];
  let list: string[] = [];
  let ordered = false;
  const flushP = () => {
    const t = buf.join('\n').trim();
    if (t) out.push(<p key={out.length} dangerouslySetInnerHTML={{ __html: inline(t).replace(/\n/g, '<br/>') }} />);
    buf = [];
  };
  const flushL = () => {
    if (!list.length) return;
    const items = list.map((l, i) => <li key={i} dangerouslySetInnerHTML={{ __html: inline(l.replace(LIST_RE, '')) }} />);
    out.push(ordered ? <ol key={out.length}>{items}</ol> : <ul key={out.length}>{items}</ul>);
    list = [];
  };
  for (const l of lines) {
    if (LIST_RE.test(l)) {
      flushP();
      if (!list.length) ordered = /^\s*\d/.test(l);
      list.push(l);
    } else if (!l.trim()) {
      flushL();
      flushP();
    } else {
      flushL();
      buf.push(l);
    }
  }
  flushL();
  flushP();
  return <>{out}</>;
}

export function headingId(i: number) {
  return 's' + i;
}

/** Заголовки второго уровня для оглавления. */
export function blogToc(blocks: BlogBlock[]) {
  let n = 0;
  return blocks.flatMap((b) => (b.type === 'heading' && b.data.level === 2 ? [{ id: headingId(++n), text: b.data.text.replace(/[*`]/g, '') }] : []));
}

export function BlogBlocks({ blocks }: { blocks: BlogBlock[] }) {
  let h2 = 0;
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'paragraph':
            return <Paragraph key={i} text={b.data.text} />;
          case 'heading': {
            const Tag = b.data.level === 3 ? 'h3' : 'h2';
            const id = b.data.level === 2 ? headingId(++h2) : undefined;
            return <Tag key={i} id={id} dangerouslySetInnerHTML={{ __html: inline(b.data.text) }} />;
          }
          case 'image':
            return b.data.url ? (
              <figure key={i} className="bl-img">
                <img src={b.data.url} alt={b.data.alt || b.data.caption || ''} loading="lazy" />
                {b.data.caption && <figcaption>{b.data.caption}</figcaption>}
              </figure>
            ) : null;
          case 'figure': {
            const bars = b.data.bars || [];
            const max = Math.max(1, ...bars.map((x) => Number(x.value) || 0));
            return (
              <div key={i} className="bl-fig">
                <div className="bl-fig-h">
                  {b.data.figNum && <span>{b.data.figNum}</span>}
                  <b>{b.data.title}</b>
                  {b.data.subtitle && <em>{b.data.subtitle}</em>}
                </div>
                {bars.map((x, k) => (
                  <div key={k} className="bl-fig-r">
                    <span>{x.label}</span>
                    <i>
                      <s style={{ width: ((Number(x.value) || 0) / max) * 100 + '%', background: x.color || undefined }} />
                    </i>
                    <b>{x.value}</b>
                  </div>
                ))}
                {b.data.caption && <p dangerouslySetInnerHTML={{ __html: inline(b.data.caption) }} />}
                {b.data.note && <small dangerouslySetInnerHTML={{ __html: inline(b.data.note) }} />}
              </div>
            );
          }
          case 'callout':
            return (
              <div key={i} className="bl-callout">
                <span>i</span>
                <div>
                  {b.data.label && <b>{b.data.label}</b>}
                  <p dangerouslySetInnerHTML={{ __html: inline(b.data.text) }} />
                </div>
              </div>
            );
          case 'quote':
            return (
              <blockquote key={i} className="bl-quote">
                <p dangerouslySetInnerHTML={{ __html: inline(b.data.text) }} />
                {b.data.author && <cite>{b.data.author}</cite>}
              </blockquote>
            );
          case 'divider':
            return <hr key={i} className="bl-hr" />;
          case 'table':
            return (
              <div key={i} className="bl-table">
                <table>
                  {b.data.headers?.length > 0 && (
                    <thead>
                      <tr>
                        {b.data.headers.map((h, k) => (
                          <th key={k}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                  )}
                  <tbody>
                    {(b.data.rows || []).map((r, k) => (
                      <tr key={k}>
                        {r.map((c, j) => (
                          <td key={j} dangerouslySetInnerHTML={{ __html: inline(c) }} />
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          default:
            return null;
        }
      })}
    </>
  );
}
