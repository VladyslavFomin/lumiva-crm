import React, { useState, useRef, useEffect } from 'react';
import { postAiSmartSearch, type AiSmartSearchFilters } from '../../api/ai';

interface Props {
  onFilters: (filters: AiSmartSearchFilters, description: string) => void;
  onClear: () => void;
  active: boolean;
}

const HINTS = [
  'горячие лиды без email',
  'лиды из России за последний месяц',
  'новые клиенты без телефона',
  'лиды в работе без ответа',
  'закрытые успешно в апреле',
];

export const AiSmartSearchBar: React.FC<Props> = ({ onFilters, onClear, active }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastDesc, setLastDesc] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const FF = 'inherit';
  const FM = 'inherit';

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  async function runSearch() {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const r = await postAiSmartSearch(query.trim());
      if (!r.ok || !r.filters) { setError('Не удалось разобрать запрос'); return; }
      setLastDesc(r.description ?? query);
      onFilters(r.filters, r.description ?? query);
      setOpen(false);
    } catch { setError('Ошибка запроса'); }
    finally { setLoading(false); }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); void runSearch(); }
    if (e.key === 'Escape') setOpen(false);
  }

  function clear() {
    setQuery('');
    setLastDesc('');
    setError(null);
    onClear();
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', fontFamily: FF }}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => { if (active) clear(); else setOpen(v => !v); }}
        title="AI умный поиск"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '5px 11px', borderRadius: 8, cursor: 'pointer',
          fontSize: 11, fontWeight: 500, fontFamily: FM,
          border: active ? '1px solid #7c3aed' : '1px solid #e0e0e0',
          background: active ? '#f5f3ff' : '#fff',
          color: active ? '#7c3aed' : '#555',
          transition: 'all 0.15s',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01"/>
          <circle cx="12" cy="12" r="10"/>
        </svg>
        {active ? `✕ ${lastDesc.length > 24 ? lastDesc.slice(0, 24) + '…' : lastDesc}` : 'AI Поиск'}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 500,
          background: '#fff', border: '1px solid #e0e0e0', borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)', width: 340, padding: 14,
        }}>
          <div style={{ fontFamily: FM, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#888', marginBottom: 8 }}>
            ✦ AI Умный поиск
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="опишите что ищете..."
              style={{
                flex: 1, fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8,
                padding: '7px 10px', outline: 'none', fontFamily: FF,
                transition: 'border-color 0.15s',
              }}
              onFocus={e => e.target.style.borderColor = '#7c3aed'}
              onBlur={e => e.target.style.borderColor = '#d1d5db'}
            />
            <button type="button" onClick={() => void runSearch()} disabled={loading || !query.trim()}
              style={{
                padding: '7px 14px', borderRadius: 8, border: '1px solid #111',
                background: loading ? '#888' : '#111', color: '#fff', fontSize: 12,
                cursor: loading || !query.trim() ? 'not-allowed' : 'pointer',
                fontFamily: FM, fontWeight: 600, opacity: loading || !query.trim() ? 0.6 : 1,
              }}>
              {loading ? '…' : '→'}
            </button>
          </div>

          {error && (
            <div style={{ fontSize: 11, color: '#ef4444', marginTop: 6 }}>{error}</div>
          )}

          {/* Hints */}
          {!loading && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontFamily: FM, fontSize: 9, color: '#aaa', marginBottom: 5, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Примеры</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {HINTS.map((h) => (
                  <button key={h} type="button"
                    onClick={() => { setQuery(h); setTimeout(() => { void (async () => {
                      setLoading(true); setError(null);
                      try {
                        const r = await postAiSmartSearch(h);
                        if (r.ok && r.filters) { setLastDesc(r.description ?? h); onFilters(r.filters, r.description ?? h); setOpen(false); }
                      } catch {} finally { setLoading(false); }
                    })(); }, 0); }}
                    style={{
                      fontSize: 11, padding: '3px 9px', borderRadius: 999,
                      border: '1px solid #e5e7eb', background: '#f9fafb', color: '#555',
                      cursor: 'pointer', fontFamily: FF,
                    }}>
                    {h}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
