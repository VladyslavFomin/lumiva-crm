import React, { useState, useEffect } from 'react';
import { postAiEnrich, type AiEnrichSuggestion, type AiEnrichResult } from '../../api/ai';

interface Props {
  entityType: 'lead' | 'company';
  entityId: string;
  onApply?: (field: string, value: string) => void;
}

const CONF_COLOR: Record<string, string> = { high: '#16a34a', medium: '#d97706' };
const CONF_LABEL: Record<string, string> = { high: 'Высокая', medium: 'Средняя' };

function lsKey(entityType: string, entityId: string) {
  return `ai_enrich_${entityType}_${entityId}`;
}

function loadCached(entityType: string, entityId: string): AiEnrichResult | null {
  try {
    const raw = localStorage.getItem(lsKey(entityType, entityId));
    return raw ? (JSON.parse(raw) as AiEnrichResult) : null;
  } catch { return null; }
}

function saveCached(entityType: string, entityId: string, result: AiEnrichResult) {
  try { localStorage.setItem(lsKey(entityType, entityId), JSON.stringify(result)); } catch {}
}

export const AiEnrichPanel: React.FC<Props> = ({ entityType, entityId, onApply }) => {
  const [result, setResult] = useState<AiEnrichResult | null>(() => loadCached(entityType, entityId));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const cached = loadCached(entityType, entityId);
    setResult(cached);
    setApplied(new Set());
  }, [entityType, entityId]);

  const FF = 'inherit';
  const FM = 'inherit';
  const LINE = '#e7e7e7';
  const FG3 = '#888';
  const BG = '#fafafa';

  async function enrich() {
    setLoading(true);
    setError(null);
    try {
      const r = await postAiEnrich(entityType, entityId);
      if (!r.ok) { setError('Не удалось получить подсказки'); return; }
      const SKIP = new Set(['score', 'priority', 'aiScore', 'leadScore', 'rating', 'id', 'tenantId']);
      const filtered = { ...r, suggestions: r.suggestions?.filter(s => !SKIP.has(s.field)) };
      setResult(filtered);
      saveCached(entityType, entityId, filtered);
      setApplied(new Set());
    } catch {
      setError('Ошибка запроса');
    } finally {
      setLoading(false);
    }
  }

  function handleApply(s: AiEnrichSuggestion) {
    onApply?.(s.field, s.suggestedValue);
    setApplied(prev => new Set([...prev, s.field]));
    if (result) {
      const updated = { ...result, suggestions: result.suggestions?.map(x => x.field === s.field ? { ...x, currentValue: s.suggestedValue } : x) };
      saveCached(entityType, entityId, updated);
    }
  }

  return (
    <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 16, fontFamily: FF }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontFamily: FM, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: FG3 }}>
          ✦ AI Инсайты
        </span>
        <button
          type="button"
          onClick={enrich}
          disabled={loading}
          style={{ fontFamily: FM, fontSize: 10, color: '#7c3aed', background: 'none', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, letterSpacing: '0.06em' }}
        >
          {loading ? 'Анализ...' : result ? '↻ Обновить' : 'Обогатить данные'}
        </button>
      </div>

      {error && <div style={{ fontSize: 11, color: '#ef4444', marginBottom: 8 }}>{error}</div>}

      {!result && !loading && (
        <div style={{ fontSize: 12, color: FG3, fontStyle: 'italic' }}>
          AI проанализирует доступные данные и предложит дополнения
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid #e7e7e7', borderTopColor: '#7c3aed', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: FG3 }}>AI обогащает данные…</span>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {result?.ok && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {result.insight && (
            <div style={{ fontSize: 12, color: '#222', background: BG, border: `1px solid ${LINE}`, borderRadius: 8, padding: '8px 10px', lineHeight: 1.5 }}>
              {result.insight}
            </div>
          )}
          {result.suggestions && result.suggestions.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {result.suggestions.map((s) => (
                <div key={s.field} style={{ border: `1px solid ${applied.has(s.field) ? '#16a34a50' : LINE}`, borderRadius: 8, padding: '8px 10px', background: applied.has(s.field) ? '#f0fdf4' : '#fff', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ fontFamily: FM, fontSize: 9.5, color: FG3, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{s.label}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: 9.5, color: CONF_COLOR[s.confidence] ?? FG3 }}>
                        ● {CONF_LABEL[s.confidence] ?? s.confidence}
                      </span>
                      {!applied.has(s.field) && onApply ? (
                        <button
                          type="button"
                          onClick={() => handleApply(s)}
                          style={{ fontSize: 10, color: '#7c3aed', background: 'none', border: '1px solid #7c3aed40', borderRadius: 4, padding: '1px 7px', cursor: 'pointer', fontFamily: FM }}
                        >
                          Применить
                        </button>
                      ) : applied.has(s.field) ? (
                        <span style={{ fontSize: 10, color: '#16a34a', fontFamily: FM }}>✓ Применено</span>
                      ) : null}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#222', fontWeight: 500 }}>{s.suggestedValue}</div>
                  {s.reasoning && <div style={{ fontSize: 11, color: FG3, lineHeight: 1.4 }}>{s.reasoning}</div>}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: FG3, fontStyle: 'italic' }}>Предложений нет — данные уже заполнены</div>
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
