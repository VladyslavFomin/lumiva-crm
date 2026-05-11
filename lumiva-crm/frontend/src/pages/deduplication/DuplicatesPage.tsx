import React, { useEffect, useState, useCallback } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import {
  fetchDuplicatePairs,
  scanDuplicates,
  ignoreDuplicatePair,
  type DuplicatePair,
  type DedupEntityType,
} from '../../api/deduplication';
import { fetchContact, type Contact } from '../../api/contacts';
import { fetchLeadById, type Lead } from '../../api/leads';
import { fetchCompany, type Company } from '../../api/companies';
import { MergeModal } from './MergeModal';
import { fetchSaleById, type Sale } from '../../api/sales';
import { fetchSegmentById, type MarketingSegment } from '../../api/marketing';

type EntityRecord = Contact | Lead | Company | Sale | MarketingSegment;

const ENTITY_TABS: { key: DedupEntityType; label: string; icon: string }[] = [
  { key: 'contact', label: 'Контакты', icon: '👤' },
  { key: 'lead',    label: 'Лиды',     icon: '🎯' },
  { key: 'company', label: 'Компании', icon: '🏢' },
  { key: 'sale',    label: 'Продажи',  icon: '💳' },
  { key: 'segment', label: 'Сегменты', icon: '📊' },
];

function scoreColor(score: number): string {
  if (score >= 100) return 'text-red-400 bg-red-500/10 border border-red-500/20';
  if (score >= 85)  return 'text-orange-400 bg-orange-500/10 border border-orange-500/20';
  return 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/20';
}

function entityLabel(record: EntityRecord, type: DedupEntityType): string {
  if (type === 'contact') {
    const c = record as Contact;
    return [c.firstName, c.lastName].filter(Boolean).join(' ') || (c as any).email || record.id.slice(0, 8);
  }
  if (type === 'lead')    return (record as Lead).name || (record as Lead).email || record.id.slice(0, 8);
  if (type === 'company') return (record as Company).name || record.id.slice(0, 8);
  if (type === 'sale')    return (record as Sale).guestName || (record as Sale).externalOrderNo || record.id.slice(0, 8);
  return (record as MarketingSegment).name || record.id.slice(0, 8);
}

function entitySub(record: EntityRecord, type: DedupEntityType): string {
  if (type === 'contact') {
    const c = record as Contact;
    return [(c as any).email, (c as any).phone].filter(Boolean).join(' · ');
  }
  if (type === 'lead') {
    const l = record as Lead;
    return [l.email, l.phone].filter(Boolean).join(' · ');
  }
  if (type === 'company') {
    const c = record as Company;
    return [(c as any).email, (c as any).phone].filter(Boolean).join(' · ');
  }
  if (type === 'sale') {
    const s = record as Sale;
    return [s.hotel, s.amount ? `${s.amount} ${s.currency}` : null].filter(Boolean).join(' · ');
  }
  return (record as MarketingSegment).description || '';
}

async function fetchEntityRecord(id: string, type: DedupEntityType): Promise<EntityRecord> {
  if (type === 'contact') return fetchContact(id);
  if (type === 'lead')    return fetchLeadById(id);
  if (type === 'company') return fetchCompany(id);
  if (type === 'sale')    return fetchSaleById(id);
  return fetchSegmentById(id);
}

export const DuplicatesPage: React.FC = () => {
  const [entityType, setEntityType] = useState<DedupEntityType>('contact');
  const [pairs, setPairs]           = useState<DuplicatePair[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(true);
  const [scanning, setScanning]     = useState(false);
  const [scanResult, setScanResult] = useState<{ scanned: number; found: number } | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [records, setRecords]       = useState<Record<string, EntityRecord | undefined>>({});
  const [mergeTarget, setMergeTarget] = useState<DuplicatePair | null>(null);

  const loadPairs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { items, total: t } = await fetchDuplicatePairs({ entityType, status: 'pending', limit: 50 });
      setPairs(items);
      setTotal(t);
      const ids = new Set<string>();
      items.forEach((p) => { ids.add(p.entityAId); ids.add(p.entityBId); });
      const missing = [...ids].filter((id) => !records[id]);
      const fetched = await Promise.allSettled(missing.map((id) => fetchEntityRecord(id, entityType)));
      const next: Record<string, EntityRecord | undefined> = { ...records };
      missing.forEach((id, i) => {
        if (fetched[i].status === 'fulfilled') next[id] = (fetched[i] as PromiseFulfilledResult<EntityRecord>).value;
      });
      setRecords(next);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [entityType]);

  useEffect(() => { void loadPairs(); }, [loadPairs]);

  const handleScan = async () => {
    setScanning(true);
    setScanResult(null);
    setError(null);
    try {
      const result = await scanDuplicates(entityType);
      setScanResult(result);
      await loadPairs();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setScanning(false);
    }
  };

  const handleIgnore = async (id: string) => {
    try {
      await ignoreDuplicatePair(id);
      setPairs((prev) => prev.filter((p) => p.id !== id));
      setTotal((t) => t - 1);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleMerged = () => {
    setMergeTarget(null);
    void loadPairs();
  };

  const handleTabChange = (t: DedupEntityType) => {
    setEntityType(t);
    setPairs([]);
    setTotal(0);
    setScanResult(null);
    setError(null);
  };

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="page-header mb-0">
          <div>
            <h1 className="page-title">Дедупликация</h1>
            <p className="page-subtitle">Поиск и объединение дублирующихся записей в базе</p>
          </div>
          <button onClick={handleScan} disabled={scanning} className="btn-primary">
            {scanning ? 'Сканирование…' : 'Запустить сканирование'}
          </button>
        </div>

        {/* Entity type tabs */}
        <div className="flex gap-1.5 flex-wrap">
          {ENTITY_TABS.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => handleTabChange(key)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                entityType === key
                  ? 'bg-[#111827] text-white'
                  : 'bg-surface-secondary text-text-secondary hover:bg-surface-hover hover:text-[#111827]'
              }`}
            >
              <span>{icon}</span>
              {label}
            </button>
          ))}
        </div>

        {/* Scan result banner */}
        {scanResult && (
          <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            Просканировано: <strong>{scanResult.scanned}</strong> записей · Найдено новых пар: <strong>{scanResult.found}</strong>
          </div>
        )}

        {error && (
          <div className="text-xs text-status-error bg-status-error-bg border border-red-200 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="text-sm text-text-secondary py-12 text-center">Загрузка…</div>
        ) : pairs.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="text-3xl mb-3">✓</div>
            <div className="text-sm font-medium text-[#111827] mb-1">Дублей не найдено</div>
            <div className="text-xs text-text-secondary mt-1 max-w-xs mx-auto">
              Запустите сканирование, чтобы найти похожие записи среди{' '}
              {ENTITY_TABS.find((t) => t.key === entityType)?.label.toLowerCase()}
            </div>
            <button onClick={handleScan} disabled={scanning} className="btn-primary mt-5">
              {scanning ? 'Сканирование…' : 'Сканировать сейчас'}
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs text-text-secondary">Найдено пар: {total}</p>
            </div>

            <div className="space-y-3">
              {pairs.map((pair) => {
                const recA = records[pair.entityAId];
                const recB = records[pair.entityBId];
                return (
                  <div key={pair.id} className="card p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4">
                      <div className={`shrink-0 text-xs font-mono font-semibold px-2.5 py-1 rounded-lg ${scoreColor(pair.score)}`}>
                        {pair.score}%
                      </div>

                      <div className="flex-1 grid grid-cols-2 gap-4 min-w-0">
                        {([{ id: pair.entityAId, rec: recA }, { id: pair.entityBId, rec: recB }] as const).map(({ id, rec }) => (
                          <div key={id} className="min-w-0">
                            <div className="text-sm font-medium text-[#111827] truncate">
                              {rec ? entityLabel(rec, pair.entityType) : id.slice(0, 8) + '…'}
                            </div>
                            {rec && entitySub(rec, pair.entityType) && (
                              <div className="text-[11px] text-text-secondary truncate mt-0.5">
                                {entitySub(rec, pair.entityType)}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setMergeTarget(pair)}
                          className="btn-primary text-xs px-3 py-1.5"
                        >
                          Объединить
                        </button>
                        <button
                          onClick={() => handleIgnore(pair.id)}
                          className="text-xs text-text-secondary hover:text-[#111827] transition-colors"
                        >
                          Не дубль
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {mergeTarget && (
        <MergeModal
          pair={mergeTarget}
          recordA={records[mergeTarget.entityAId]}
          recordB={records[mergeTarget.entityBId]}
          onClose={() => setMergeTarget(null)}
          onMerged={handleMerged}
        />
      )}
    </MainLayout>
  );
};
