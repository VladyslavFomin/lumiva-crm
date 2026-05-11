import React, { useState } from 'react';
import { postAiFindDuplicates, type AiDuplicateGroup } from '../../api/ai';
import { useNavigate } from 'react-router-dom';

interface Props {
  onClose: () => void;
}

const CONF_COLOR = { high: '#dc2626', medium: '#d97706' };
const CONF_BG = { high: '#fef2f2', medium: '#fffbeb' };
const CONF_LABEL = { high: 'Высокая схожесть', medium: 'Средняя схожесть' };

export const AiDuplicatesModal: React.FC<Props> = ({ onClose }) => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<AiDuplicateGroup[]>([]);
  const [scanned, setScanned] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<number>>(() => new Set());

  const FF = 'inherit';
  const FM = 'inherit';
  const LINE = '#e7e7e7';
  const FG3 = '#888';

  async function runScan() {
    setLoading(true);
    setError(null);
    setDone(false);
    setGroups([]);
    setDismissed(new Set());
    try {
      const r = await postAiFindDuplicates();
      if (!r.ok) { setError('Не удалось проверить дубликаты'); return; }
      setGroups(r.groups ?? []);
      setScanned(r.scanned ?? 0);
      setDone(true);
    } catch { setError('Ошибка запроса'); }
    finally { setLoading(false); }
  }

  const visibleGroups = groups.filter((_, i) => !dismissed.has(i));

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 640,
        maxHeight: '88vh', display: 'flex', flexDirection: 'column',
        fontFamily: FF, boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${LINE}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: FM, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: FG3, marginBottom: 4 }}>✦ AI Анализ</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#111' }}>Поиск дублей лидов</div>
          </div>
          <button type="button" onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 20, color: FG3, cursor: 'pointer', lineHeight: 1, padding: 4 }}>×</button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Scan button */}
          {!done && !loading && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 13, color: '#444', marginBottom: 6 }}>
                AI проанализирует имена, email и телефоны всех лидов и найдёт вероятные дубликаты
              </div>
              <div style={{ fontSize: 11, color: FG3, marginBottom: 20 }}>Анализируются последние 150 лидов</div>
              <button type="button" onClick={runScan}
                style={{ padding: '10px 28px', fontSize: 13, fontWeight: 600, borderRadius: 10, border: '1px solid #111', background: '#111', color: '#fff', cursor: 'pointer' }}>
                ✦ Запустить сканирование
              </button>
            </div>
          )}

          {loading && (
            <div style={{ textAlign: 'center', padding: '32px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #e7e7e7', borderTopColor: '#7c3aed', animation: 'spin4 0.8s linear infinite' }} />
              <div style={{ fontSize: 13, color: FG3 }}>AI сканирует лиды…</div>
              <style>{`@keyframes spin4{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}

          {error && (
            <div style={{ fontSize: 12, color: '#ef4444', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px' }}>{error}</div>
          )}

          {done && (
            <>
              {/* Summary */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f9f9fb', border: `1px solid ${LINE}`, borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontFamily: FM, fontSize: 11, color: FG3 }}>Проверено: <b style={{ color: '#111' }}>{scanned}</b> лидов</div>
                <div style={{ width: 1, height: 14, background: LINE }} />
                <div style={{ fontFamily: FM, fontSize: 11, color: FG3 }}>Найдено групп: <b style={{ color: visibleGroups.length > 0 ? '#dc2626' : '#16a34a' }}>{visibleGroups.length}</b></div>
                {visibleGroups.length === 0 && (
                  <div style={{ fontSize: 11, color: '#16a34a' }}>— дублей нет</div>
                )}
              </div>

              {visibleGroups.map((group, gi) => {
                const conf = (group.confidence ?? 'medium') as 'high' | 'medium';
                return (
                  <div key={gi} style={{ border: `1px solid ${CONF_COLOR[conf]}40`, borderRadius: 10, overflow: 'hidden' }}>
                    {/* Group header */}
                    <div style={{ background: CONF_BG[conf], padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: CONF_COLOR[conf] }}>● {CONF_LABEL[conf]}</span>
                        <span style={{ fontFamily: FM, fontSize: 9.5, color: FG3 }}>{group.leads.length} записи</span>
                      </div>
                      <button type="button" onClick={() => setDismissed(prev => new Set([...prev, gi]))}
                        style={{ fontSize: 10, color: FG3, background: 'none', border: 'none', cursor: 'pointer', fontFamily: FM }}>
                        Игнорировать
                      </button>
                    </div>
                    {/* Reason */}
                    <div style={{ padding: '6px 14px', borderBottom: `1px solid ${LINE}`, fontSize: 11, color: '#555', background: '#fff', fontStyle: 'italic' }}>
                      {group.reason}
                    </div>
                    {/* Leads */}
                    <div>
                      {group.leads.map((lead, li) => (
                        <div key={lead.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderBottom: li < group.leads.length - 1 ? `1px solid ${LINE}` : 'none', background: '#fff' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.name || '(без имени)'}</div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                              {lead.email && <span style={{ fontFamily: FM, fontSize: 10, color: FG3 }}>{lead.email}</span>}
                              {lead.phone && <span style={{ fontFamily: FM, fontSize: 10, color: FG3 }}>{lead.phone}</span>}
                            </div>
                          </div>
                          <button type="button"
                            onClick={() => { navigate(`/leads/${lead.id}`); onClose(); }}
                            style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, border: `1px solid ${LINE}`, background: '#fff', color: '#555', cursor: 'pointer', flexShrink: 0, fontFamily: FM }}>
                            Открыть →
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {done && (
                <button type="button" onClick={runScan}
                  style={{ alignSelf: 'flex-start', fontSize: 11, padding: '6px 14px', borderRadius: 8, border: `1px solid ${LINE}`, background: '#fff', color: '#555', cursor: 'pointer', fontFamily: FM }}>
                  ↻ Повторить сканирование
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
