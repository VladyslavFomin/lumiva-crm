import React, { useState, useEffect } from 'react';
import { postAiOutreachEmail, type AiOutreachEmailResult } from '../../api/ai';

interface Props {
  leadId: string;
  leadEmail?: string | null;
  leadName?: string | null;
  onSend?: (subject: string, body: string, to: string) => void;
}

function lsKey(leadId: string) { return `ai_outreach_email_${leadId}`; }
function loadCached(leadId: string): AiOutreachEmailResult | null {
  try { const r = localStorage.getItem(lsKey(leadId)); return r ? JSON.parse(r) : null; } catch { return null; }
}
function saveCached(leadId: string, r: AiOutreachEmailResult) {
  try { localStorage.setItem(lsKey(leadId), JSON.stringify(r)); } catch {}
}

export const AiOutreachEmailCard: React.FC<Props> = ({ leadId, leadEmail, leadName, onSend }) => {
  const [result, setResult] = useState<AiOutreachEmailResult | null>(() => loadCached(leadId));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const cached = loadCached(leadId);
    setResult(cached);
    if (cached?.ok) {
      setEditSubject(cached.subject ?? '');
      setEditBody(cached.body ?? '');
      setExpanded(true);
    }
  }, [leadId]);

  const FF = 'inherit';
  const FM = 'inherit';
  const LINE = '#e7e7e7';
  const FG3 = '#888';

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const r = await postAiOutreachEmail(leadId);
      if (!r.ok) { setError('Не удалось сгенерировать письмо'); return; }
      setResult(r);
      saveCached(leadId, r);
      setEditSubject(r.subject ?? '');
      setEditBody(r.body ?? '');
      setExpanded(true);
      setEditing(false);
    } catch { setError('Ошибка запроса'); }
    finally { setLoading(false); }
  }

  function handleCopy() {
    const text = `Тема: ${editSubject}\n\n${editBody}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const email = leadEmail || result?.leadEmail || '';
  const canSend = Boolean(email && onSend);

  return (
    <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 16, fontFamily: FF }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: result?.ok ? 10 : 12 }}>
        <span style={{ fontFamily: FM, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: FG3 }}>
          ✉ Письмо клиенту
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {result?.ok && (
            <button type="button" onClick={() => setExpanded(v => !v)}
              style={{ fontFamily: FM, fontSize: 10, color: FG3, background: 'none', border: 'none', cursor: 'pointer' }}>
              {expanded ? '▲ Свернуть' : '▼ Развернуть'}
            </button>
          )}
          <button type="button" onClick={generate} disabled={loading}
            style={{ fontFamily: FM, fontSize: 10, color: '#7c3aed', background: 'none', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, letterSpacing: '0.06em' }}>
            {loading ? 'Генерация...' : result ? '↻ Новый вариант' : 'Создать письмо'}
          </button>
        </div>
      </div>

      {error && <div style={{ fontSize: 11, color: '#ef4444' }}>{error}</div>}

      {!result && !loading && (
        <div style={{ fontSize: 12, color: FG3, fontStyle: 'italic' }}>
          AI напишет персональное первое письмо на основе данных лида
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid #e7e7e7', borderTopColor: '#7c3aed', animation: 'spin3 0.8s linear infinite', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: FG3 }}>AI пишет письмо…</span>
          <style>{`@keyframes spin3{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {result?.ok && !loading && expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Subject */}
          <div>
            <div style={{ fontFamily: FM, fontSize: 9.5, color: FG3, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Тема</div>
            {editing ? (
              <input
                value={editSubject}
                onChange={e => setEditSubject(e.target.value)}
                style={{ width: '100%', fontSize: 12, border: `1px solid #7c3aed60`, borderRadius: 6, padding: '5px 8px', fontFamily: FF, outline: 'none', boxSizing: 'border-box' }}
              />
            ) : (
              <div style={{ fontSize: 12, fontWeight: 600, color: '#111', background: '#fafafa', border: `1px solid ${LINE}`, borderRadius: 6, padding: '5px 8px' }}>{editSubject}</div>
            )}
          </div>

          {/* Body */}
          <div>
            <div style={{ fontFamily: FM, fontSize: 9.5, color: FG3, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Текст</div>
            {editing ? (
              <textarea
                value={editBody}
                onChange={e => setEditBody(e.target.value)}
                rows={8}
                style={{ width: '100%', fontSize: 12, border: `1px solid #7c3aed60`, borderRadius: 6, padding: '6px 8px', fontFamily: FF, outline: 'none', resize: 'vertical', lineHeight: 1.5, boxSizing: 'border-box' }}
              />
            ) : (
              <div style={{ fontSize: 12, color: '#333', background: '#fafafa', border: `1px solid ${LINE}`, borderRadius: 6, padding: '6px 8px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {editBody}
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
            <button type="button" onClick={() => setEditing(v => !v)}
              style={{ fontSize: 11, padding: '5px 12px', borderRadius: 8, border: `1px solid ${LINE}`, background: editing ? '#7c3aed' : '#fff', color: editing ? '#fff' : '#555', cursor: 'pointer', fontFamily: FM }}>
              {editing ? '✓ Готово' : '✏ Редактировать'}
            </button>
            <button type="button" onClick={handleCopy}
              style={{ fontSize: 11, padding: '5px 12px', borderRadius: 8, border: `1px solid ${LINE}`, background: '#fff', color: copied ? '#16a34a' : '#555', cursor: 'pointer', fontFamily: FM }}>
              {copied ? '✓ Скопировано' : '⎘ Копировать'}
            </button>
            {canSend && (
              <button type="button" onClick={() => onSend!(editSubject, editBody, email)}
                style={{ fontSize: 11, padding: '5px 14px', borderRadius: 8, border: '1px solid #111', background: '#111', color: '#fff', cursor: 'pointer', fontFamily: FM, fontWeight: 600 }}>
                → Отправить {email}
              </button>
            )}
          </div>
        </div>
      )}

      {result?.ok && !loading && !expanded && (
        <div style={{ fontSize: 11, color: FG3 }}>
          Тема: <span style={{ color: '#333', fontWeight: 500 }}>{editSubject}</span>
        </div>
      )}
    </div>
  );
};
