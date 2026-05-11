import React, { useState, useEffect } from 'react';
import { postAiNextAction, type AiNextActionResult } from '../../api/ai';

interface Props {
  leadId: string;
}

const URGENCY_COLOR = { hot: '#dc2626', warm: '#d97706', cold: '#3b82f6' };
const URGENCY_BG = { hot: '#fef2f2', warm: '#fffbeb', cold: '#eff6ff' };
const URGENCY_LABEL = { hot: 'Горячий', warm: 'Тёплый', cold: 'Холодный' };

const CHANNEL_ICON: Record<string, React.ReactNode> = {
  phone: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.25 1.09 2 2 0 012.25 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
    </svg>
  ),
  email: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <path d="M2 7l10 7 10-7"/>
    </svg>
  ),
  meeting: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/>
    </svg>
  ),
  message: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  ),
};

function lsKey(leadId: string) { return `ai_next_action_${leadId}`; }

function loadCached(leadId: string): AiNextActionResult | null {
  try { const r = localStorage.getItem(lsKey(leadId)); return r ? JSON.parse(r) : null; } catch { return null; }
}
function saveCached(leadId: string, r: AiNextActionResult) {
  try { localStorage.setItem(lsKey(leadId), JSON.stringify(r)); } catch {}
}

export const AiNextActionCard: React.FC<Props> = ({ leadId }) => {
  const [result, setResult] = useState<AiNextActionResult | null>(() => loadCached(leadId));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setResult(loadCached(leadId)); }, [leadId]);

  const FF = 'inherit';
  const FM = 'inherit';
  const LINE = '#e7e7e7';
  const FG3 = '#888';

  async function analyze() {
    setLoading(true);
    setError(null);
    try {
      const r = await postAiNextAction(leadId);
      if (!r.ok) { setError('Не удалось получить рекомендацию'); return; }
      setResult(r);
      saveCached(leadId, r);
    } catch { setError('Ошибка запроса'); }
    finally { setLoading(false); }
  }

  const urgency = (result?.urgency ?? 'warm') as 'hot' | 'warm' | 'cold';
  const channel = result?.channel ?? 'email';

  return (
    <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 16, fontFamily: FF }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontFamily: FM, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: FG3 }}>
          ✦ Следующий шаг
        </span>
        <button type="button" onClick={analyze} disabled={loading}
          style={{ fontFamily: FM, fontSize: 10, color: '#7c3aed', background: 'none', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, letterSpacing: '0.06em' }}>
          {loading ? 'Анализ...' : result ? '↻ Обновить' : 'Рекомендовать'}
        </button>
      </div>

      {error && <div style={{ fontSize: 11, color: '#ef4444' }}>{error}</div>}

      {!result && !loading && (
        <div style={{ fontSize: 12, color: FG3, fontStyle: 'italic' }}>
          AI определит приоритетное действие для этого лида
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid #e7e7e7', borderTopColor: '#7c3aed', animation: 'spin2 0.8s linear infinite', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: FG3 }}>AI анализирует лид…</span>
          <style>{`@keyframes spin2{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {result?.ok && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Action header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 34, height: 34, borderRadius: 8,
              background: URGENCY_BG[urgency], color: URGENCY_COLOR[urgency], flexShrink: 0,
            }}>
              {CHANNEL_ICON[channel]}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111', lineHeight: 1.3 }}>{result.action}</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 3, padding: '1px 7px', borderRadius: 999, background: URGENCY_BG[urgency], border: `1px solid ${URGENCY_COLOR[urgency]}30`, fontSize: 10, fontWeight: 600, color: URGENCY_COLOR[urgency] }}>
                ● {URGENCY_LABEL[urgency]}
              </div>
            </div>
          </div>

          {result.reason && (
            <div style={{ fontSize: 12, color: '#444', lineHeight: 1.5, background: '#fafafa', border: `1px solid ${LINE}`, borderRadius: 8, padding: '7px 10px' }}>
              {result.reason}
            </div>
          )}

          {result.steps && result.steps.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {result.steps.map((step, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                  <span style={{ fontFamily: FM, fontSize: 9, color: '#7c3aed', marginTop: 3, flexShrink: 0 }}>{i + 1}.</span>
                  <span style={{ fontSize: 11.5, color: '#555', lineHeight: 1.4 }}>{step}</span>
                </div>
              ))}
            </div>
          )}

          {result.updatedAt && (
            <div style={{ fontFamily: FM, fontSize: 9.5, color: '#b5b5b5' }}>
              Обновлено: {new Date(result.updatedAt).toLocaleString('ru-RU')}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
