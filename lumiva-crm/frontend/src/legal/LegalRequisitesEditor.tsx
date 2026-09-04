// src/legal/LegalRequisitesEditor.tsx
import React from 'react';
import {
  LEGAL_REQUISITE_TYPES,
  LEGAL_REQUISITE_LABEL,
  LEGAL_REQUISITE_REGION_LABEL,
  LEGAL_REQUISITE_REGION_ORDER,
  makeRequisiteId,
  type LegalRequisiteItem,
} from './legalRequisites';

const ACCENT = '#222222';

export interface LegalRequisitesEditorProps {
  value: LegalRequisiteItem[];
  onChange: (items: LegalRequisiteItem[]) => void;
  disabled?: boolean;
  /** Показать под списком короткую подсказку, куда идут эти данные (например, {ORG_TAX}). */
  hint?: string;
}

/**
 * Переиспользуемый редактор произвольного списка юр./банковских реквизитов: "+ добавить" →
 * выбор типа из каталога (сгруппирован по направлению) → строка [лейбл][значение][удалить].
 * Используется и в Настройки компании (реквизиты своей компании), и в карточке компании-клиента.
 */
export const LegalRequisitesEditor: React.FC<LegalRequisitesEditorProps> = ({
  value,
  onChange,
  disabled,
  hint,
}) => {
  const handleAdd = (typeId: string) => {
    if (!typeId) return;
    onChange([...value, { id: makeRequisiteId(), type: typeId, value: '' }]);
  };

  const handleValueChange = (id: string, newValue: string) => {
    onChange(value.map((item) => (item.id === id ? { ...item, value: newValue } : item)));
  };

  const handleRemove = (id: string) => {
    onChange(value.filter((item) => item.id !== id));
  };

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((item) => (
            <div key={item.id} className="flex items-center gap-2">
              <span className="w-[220px] shrink-0 truncate rounded-lg bg-zinc-100 px-2.5 py-2 text-[11px] font-medium text-zinc-700">
                {LEGAL_REQUISITE_LABEL[item.type] || item.type}
              </span>
              <input
                type="text"
                value={item.value}
                onChange={(e) => handleValueChange(item.id, e.target.value)}
                disabled={disabled}
                className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 transition focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
                placeholder="Значение"
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemove(item.id)}
                  className="shrink-0 rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs font-semibold text-zinc-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                  aria-label="Удалить"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!disabled && (
        <select
          value=""
          onChange={(e) => handleAdd(e.target.value)}
          className="w-full max-w-xs rounded-lg border border-dashed border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-600 transition hover:border-zinc-400 focus:border-zinc-400 focus:outline-none"
          style={{ color: value.length === 0 ? undefined : ACCENT }}
        >
          <option value="">+ Добавить реквизит</option>
          {LEGAL_REQUISITE_REGION_ORDER.map((region) => (
            <optgroup key={region} label={LEGAL_REQUISITE_REGION_LABEL[region]}>
              {LEGAL_REQUISITE_TYPES.filter((t) => t.region === region).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      )}

      {hint && <p className="text-[11px] leading-relaxed text-zinc-500">{hint}</p>}
    </div>
  );
};
