import React, { useState, useEffect } from 'react';
import { postAiLeadScore, type AiLeadScoreResult } from '../../api/ai';

interface Props {
  leadId: string;
  onScored?: (result: AiLeadScoreResult) => void;
}

const PRIORITY_COLOR: Record<string, string> = {
  high: '#16a34a',
  medium: '#d97706',
  low: '#dc2626',
};

const PRIORITY_LABEL: Record<string, string> = {
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
};

function lsKey(leadId: string) { return `ai_lead_score_${leadId}`; }

function loadCached(leadId: string): AiLeadScoreResult | null {
  try {
    const raw = localStorage.getItem(lsKey(leadId));
    return raw ? (JSON.parse(raw) as AiLeadScoreResult) : null;
  } catch { return null; }
}

function saveCached(leadId: string, result: AiLeadScoreResult) {
  try { localStorage.setItem(lsKey(leadId), JSON.stringify(result)); } catch {}
}

function ScoreRing({ score }: { score: number }) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const color = score >= 70 ? '#16a34a' : score >= 40 ? '#d97706' : '#dc2626';
  return (
    <svg width={64} height={64} viewBox="0 0 64 64">
      <circle cx={32} cy={32} r={r} fill="none" stroke="#e7e7e7" strokeWidth={6} />
      <circle
        cx={32} cy={32} r={r} fill="none"
        stroke={color} strokeWidth={6}
        strokeDasharray={`${filled} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 32 32)"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      <text x={32} y={37} textAnchor="middle" fontSize={15} fontWeight={700} fill={color}>{score}</text>
    </svg>
  );
}

export const AiLeadScoreCard: React.FC<Props> = ({ leadId, onScored }) => {
  const [result, setResult] = useState<AiLeadScoreResult | null>(() => loadCached(leadId));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cached = loadCached(leadId);
    setResult(cached);
  }, [leadId]);

  const FF = 'inherit';
  const FM = 'inherit';
  const LINE = '#e7e7e7';
  const FG3 = '#888';

  async function analyze() {
    setLoading(true);
    setError(null);
    try {
      const r = await postAiLeadScore(leadId);
      if (!r.ok) { setError('Не удалось получить оценку'); return; }
      setResult(r);
      saveCached(leadId, r);
      onScored?.(r);
    } catch {
      setError('Ошибка запроса');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 16, fontFamily: FF }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontFamily: FM, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: FG3 }}>
          AI Score
        </span>
        <button
          type="button"
          onClick={analyze}
          disabled={loading}
          style={{ fontFamily: FM, fontSize: 10, color: '#7c3aed', background: 'none', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, letterSpacing: '0.06em' }}
        >
          {loading ? 'Анализ...' : result ? '↻ Обновить' : '✦ Анализировать'}
        </button>
      </div>

      {error && <div style={{ fontSize: 11, color: '#ef4444' }}>{error}</div>}

      {!result && !loading && (
        <div style={{ fontSize: 12, color: FG3, fontStyle: 'italic' }}>
          Нажмите «Анализировать» чтобы AI оценил приоритет лида
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', border: '6px solid #e7e7e7', borderTopColor: '#7c3aed', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ fontSize: 12, color: FG3 }}>AI анализирует лид…</span>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {result?.ok && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ScoreRing score={result.score ?? 0} />
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, background: `${PRIORITY_COLOR[result.priority ?? 'medium']}18`, border: `1px solid ${PRIORITY_COLOR[result.priority ?? 'medium']}40`, fontSize: 11, fontWeight: 600, color: PRIORITY_COLOR[result.priority ?? 'medium'], marginBottom: 4 }}>
                ● {PRIORITY_LABEL[result.priority ?? 'medium']} приоритет
              </div>
              <div style={{ fontSize: 12, color: '#222', lineHeight: 1.4 }}>{result.label}</div>
            </div>
          </div>
          {result.reasons && result.reasons.length > 0 && (
            <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {result.reasons.map((r, i) => (
                <li key={i} style={{ fontSize: 11.5, color: '#555', lineHeight: 1.4 }}>{r}</li>
              ))}
            </ul>
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
