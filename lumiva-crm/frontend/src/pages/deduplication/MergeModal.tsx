import React, { useState } from 'react';
import { mergeDuplicates, type DuplicatePair, type DedupEntityType } from '../../api/deduplication';

type AnyRecord = Record<string, any> & { id: string };

interface Props {
  pair: DuplicatePair;
  recordA: AnyRecord | undefined;
  recordB: AnyRecord | undefined;
  onClose: () => void;
  onMerged: () => void;
}

const FIELDS_BY_TYPE: Record<DedupEntityType, { key: string; label: string }[]> = {
  contact: [
    { key: 'firstName', label: 'Имя' },
    { key: 'lastName', label: 'Фамилия' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Телефон' },
    { key: 'position', label: 'Должность' },
  ],
  lead: [
    { key: 'name', label: 'Имя' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Телефон' },
  ],
  company: [
    { key: 'name', label: 'Название' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Телефон' },
    { key: 'website', label: 'Сайт' },
  ],
  sale: [
    { key: 'guestName', label: 'Гость' },
    { key: 'hotel', label: 'Отель' },
    { key: 'externalId', label: 'Внешний ID' },
    { key: 'externalOrderNo', label: 'Номер брони' },
  ],
  segment: [
    { key: 'name', label: 'Название' },
    { key: 'description', label: 'Описание' },
  ],
};

export const MergeModal: React.FC<Props> = ({ pair, recordA, recordB, onClose, onMerged }) => {
  const [winnerId, setWinnerId] = useState<string>(pair.entityAId);
  const [fieldMap, setFieldMap] = useState<Record<string, 'winner' | 'loser'>>({});
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loserId = winnerId === pair.entityAId ? pair.entityBId : pair.entityAId;
  const winnerRecord = winnerId === pair.entityAId ? recordA : recordB;
  const loserRecord = winnerId === pair.entityAId ? recordB : recordA;

  const fields = FIELDS_BY_TYPE[pair.entityType];

  const getValue = (rec: AnyRecord | undefined, key: string): string => {
    if (!rec) return '';
    return String(rec[key] ?? '') || '—';
  };

  const handleMerge = async () => {
    setMerging(true);
    setError(null);
    try {
      await mergeDuplicates({ entityType: pair.entityType, winnerId, loserId, fieldMap });
      onMerged();
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message);
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Объединить записи</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Winner selection */}
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Какую запись оставить основной?
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[{ id: pair.entityAId, rec: recordA }, { id: pair.entityBId, rec: recordB }].map(({ id, rec }) => (
                <button
                  key={id}
                  onClick={() => setWinnerId(id)}
                  className={`text-left rounded-xl border p-3 transition ${
                    winnerId === id
                      ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${winnerId === id ? 'border-slate-900' : 'border-slate-300'}`}>
                      {winnerId === id && <div className="h-2 w-2 rounded-full bg-slate-900" />}
                    </div>
                    <span className="text-sm font-medium text-slate-900 truncate">
                      {rec ? getValue(rec, pair.entityType === 'contact' ? 'firstName' : (pair.entityType === 'sale' ? 'guestName' : 'name')) || id.slice(0, 8) : id.slice(0, 8)}
                    </span>
                  </div>
                  {winnerId === id && <div className="text-[10px] text-slate-500 mt-1 ml-6">Основная запись (сохранится)</div>}
                  {winnerId !== id && <div className="text-[10px] text-red-400 mt-1 ml-6">Будет удалена</div>}
                </button>
              ))}
            </div>
          </div>

          {/* Field-by-field comparison */}
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Выберите значения для каждого поля
            </div>
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium w-28">Поле</th>
                    <th className="px-4 py-2 text-left font-medium">Основная запись</th>
                    <th className="px-4 py-2 text-left font-medium">Удаляемая запись</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map(({ key, label }) => {
                    const wVal = getValue(winnerRecord, key);
                    const lVal = getValue(loserRecord, key);
                    const choice = fieldMap[key] ?? 'winner';
                    return (
                      <tr key={key} className="border-t border-slate-100">
                        <td className="px-4 py-2 text-slate-500 font-medium">{label}</td>
                        <td className="px-4 py-2">
                          <button
                            onClick={() => setFieldMap((prev) => ({ ...prev, [key]: 'winner' }))}
                            className={`text-left w-full rounded-lg px-2 py-1 transition ${
                              choice === 'winner' ? 'bg-slate-900 text-white' : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            {wVal}
                          </button>
                        </td>
                        <td className="px-4 py-2">
                          <button
                            onClick={() => setFieldMap((prev) => ({ ...prev, [key]: 'loser' }))}
                            className={`text-left w-full rounded-lg px-2 py-1 transition ${
                              choice === 'loser' ? 'bg-slate-900 text-white' : 'hover:bg-slate-50 text-slate-700'
                            } ${lVal === '—' ? 'opacity-40 cursor-default' : ''}`}
                            disabled={lVal === '—'}
                          >
                            {lVal}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              Нажмите на значение чтобы выбрать его. По умолчанию берутся значения основной записи.
            </p>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Удаляемая запись будет мягко удалена. Восстановить можно через поддержку.
          </p>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700">
              Отмена
            </button>
            <button onClick={handleMerge} disabled={merging} className="btn-primary">
              {merging ? 'Объединяем…' : 'Объединить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
