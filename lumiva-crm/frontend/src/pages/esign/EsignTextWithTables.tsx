// src/pages/esign/EsignTextWithTables.tsx
import React from 'react';

const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', margin: '6px 0 10px', fontSize: 12, whiteSpace: 'normal' };
const cellStyle = (header: boolean, col: number): React.CSSProperties => ({
  padding: '6px 8px',
  borderBottom: '1px solid #e7e7e7',
  verticalAlign: 'top',
  background: header ? '#f4f4f4' : undefined,
  color: header ? '#666' : undefined,
  fontSize: header ? 11 : 12,
  textAlign: col >= 2 ? 'right' : 'left',
  whiteSpace: col >= 2 ? 'nowrap' : 'normal',
});

/** Document text in which consecutive tab-separated lines (the {QUOTE_ITEMS} table of a
 * commercial offer) are drawn as a real table — the same rule the PDF renderer uses
 * (backend esign-pdf.util.ts splitBodyBlocks). Expects a pre-wrap container. */
export const EsignTextWithTables: React.FC<{ text: string }> = ({ text }) => {
  const blocks: Array<{ table: boolean; lines: string[] }> = [];
  text.split('\n').forEach((line, idx, arr) => {
    const table = line.includes('\t');
    const last = blocks[blocks.length - 1];
    const withNl = !table && idx < arr.length - 1 ? `${line}\n` : line;
    if (last && last.table === table) last.lines.push(withNl);
    else blocks.push({ table, lines: [withNl] });
  });
  return (
    <>
      {blocks.map((b, bi) =>
        b.table ? (
          <div key={bi} style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <tbody>
                {b.lines.map((l, ri) => (
                  <tr key={ri}>
                    {l.split('\t').map((c, ci) => (
                      <td key={ci} style={cellStyle(ri === 0, ci)}>
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <React.Fragment key={bi}>{b.lines.join('')}</React.Fragment>
        ),
      )}
    </>
  );
};
