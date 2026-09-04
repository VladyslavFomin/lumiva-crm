import React, { useEffect, useMemo, useState } from 'react';
import {
  createCustomField,
  deleteCustomField,
  fetchCustomFields,
  type CreateCustomFieldDto,
  type CustomField,
  type EntityType,
  type FieldType,
  updateCustomField,
} from '../api/custom-fields';
import { LottieIcon } from './LottieIcon';
import { useAlertModal } from '../contexts/AlertModalContext';

const FIELD_TYPE_OPTIONS: Array<{ value: FieldType; label: string }> = [
  { value: 'text', label: 'Текст' },
  { value: 'textarea', label: 'Многострочный текст' },
  { value: 'number', label: 'Число' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Телефон' },
  { value: 'date', label: 'Дата' },
  { value: 'datetime', label: 'Дата и время' },
  { value: 'daterange', label: 'Диапазон дат' },
  { value: 'boolean', label: 'Да / Нет' },
  { value: 'select', label: 'Список' },
  { value: 'multiselect', label: 'Мульти‑список' },
  { value: 'url', label: 'Ссылка' },
];

type Props = {
  entityType: EntityType;
  title?: string;
  suggestedKeys?: string[];
  onClose: () => void;
  onUpdated?: (fields: CustomField[]) => void;
};

const normalizeKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);

const optionsToText = (options?: Array<{ value: string; label: string }> | null) =>
  options?.map((o) => o.label).join(', ') ?? '';

const textToOptions = (raw: string) => {
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts.map((label) => ({ value: normalizeKey(label) || label, label })) : null;
};

export const CustomFieldsManager: React.FC<Props> = ({
  entityType,
  title,
  suggestedKeys,
  onClose,
  onUpdated,
}) => {
  const { showConfirm } = useAlertModal();
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingOrder, setSavingOrder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const [form, setForm] = useState<CreateCustomFieldDto>({
    entityType,
    key: '',
    label: '',
    type: 'text',
    required: false,
    placeholder: '',
    helpText: '',
    options: undefined,
    defaultValue: '',
    order: 0,
    isActive: true,
  });
  const [keyTouched, setKeyTouched] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const suggestedKeyOptions = useMemo(() => {
    const keys = new Set<string>();
    (suggestedKeys ?? [])
      .map((key) => key.trim())
      .filter(Boolean)
      .forEach((key) => keys.add(key));
    fields.forEach((field) => {
      if (field.key) keys.add(field.key);
    });
    return Array.from(keys);
  }, [suggestedKeys, fields]);
  const [customKeyMode, setCustomKeyMode] = useState(false);
  const needsOptions = form.type === 'select' || form.type === 'multiselect';
  const hasOptions = Boolean(form.options && form.options.length > 0);

  useEffect(() => {
    if (suggestedKeyOptions.length > 0) {
      setKeyTouched(true);
    }
  }, [suggestedKeyOptions]);

  const reload = () => {
    setLoading(true);
    setError(null);
    fetchCustomFields(entityType)
      .then((items) => {
        const sorted = [...items].sort((a, b) => a.order - b.order);
        setFields(sorted);
        onUpdated?.(sorted);
      })
      .catch((e) => {
        console.error(e);
        setError(e.message || 'Не удалось загрузить поля');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, [entityType]);

  const activeFields = useMemo(
    () => fields.filter((f) => f.isActive).length,
    [fields],
  );

  const handleReorder = async (next: CustomField[]) => {
    setFields(next);
    setSavingOrder(true);
    try {
      await Promise.all(
        next.map((field, index) =>
          field.order === index
            ? Promise.resolve()
            : updateCustomField(field.id, { order: index }),
        ),
      );
      const updated = next.map((f, idx) => ({ ...f, order: idx }));
      setFields(updated);
      onUpdated?.(updated);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Не удалось сохранить порядок');
    } finally {
      setSavingOrder(false);
    }
  };

  const moveField = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const next = [...fields];
    const fromIndex = next.findIndex((f) => f.id === sourceId);
    const toIndex = next.findIndex((f) => f.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    handleReorder(next);
  };

  const handleFormChange = (
    patch: Partial<CreateCustomFieldDto>,
    opts?: { touchKey?: boolean },
  ) => {
    if (patch.label !== undefined && !keyTouched && !opts?.touchKey) {
      const generated = normalizeKey(patch.label || '');
      setForm((prev) => ({
        ...prev,
        ...patch,
        key: generated ? `cf_${generated}` : '',
      }));
      return;
    }
    if (opts?.touchKey) setKeyTouched(true);
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const handleCreate = async () => {
    if (!form.label.trim() || !form.key.trim()) {
      setError('Укажите название и ключ поля');
      return;
    }
    if (needsOptions && !hasOptions) {
      setError('Для типа "Список" и "Мульти‑список" добавьте варианты через запятую');
      return;
    }
    setFormBusy(true);
    setError(null);
    try {
      const payload: CreateCustomFieldDto = {
        ...form,
        label: form.label.trim(),
        key: form.key.trim(),
        options:
          form.type === 'select' || form.type === 'multiselect'
            ? form.options ?? []
            : undefined,
        order: fields.length,
      };
      await createCustomField(payload);
      setForm((prev) => ({
        ...prev,
        label: '',
        key: '',
        type: 'text',
        required: false,
        placeholder: '',
        helpText: '',
        options: undefined,
        defaultValue: '',
      }));
      setKeyTouched(false);
      reload();
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Не удалось создать поле');
    } finally {
      setFormBusy(false);
    }
  };

  const handleToggleActive = async (field: CustomField) => {
    try {
      const updated = await updateCustomField(field.id, {
        isActive: !field.isActive,
      });
      const next = fields.map((f) => (f.id === field.id ? updated : f));
      setFields(next);
      onUpdated?.(next);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Не удалось изменить поле');
    }
  };

  const handleUpdateField = async (fieldId: string, patch: any) => {
    try {
      const updated = await updateCustomField(fieldId, patch);
      const next = fields.map((f) => (f.id === fieldId ? updated : f));
      setFields(next);
      onUpdated?.(next);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Не удалось сохранить поле');
    }
  };

  const handleDeleteField = async (field: CustomField) => {
    const confirmed = await showConfirm(`Удалить поле «${field.label}»? Значения этого поля будут потеряны у всех записей.`, {
      title: 'Удаление поля',
      confirmLabel: 'Удалить',
      cancelLabel: 'Отмена',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await deleteCustomField(field.id);
      const next = fields.filter((f) => f.id !== field.id);
      setFields(next);
      onUpdated?.(next);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Не удалось удалить поле');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-transparent flex items-stretch justify-end">
      <div className="w-full max-w-xl bg-slate-900 border-l border-slate-800 shadow-2xl overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div>
            <div className="text-xs text-slate-500">Кастомные поля</div>
            <div className="text-sm font-semibold text-slate-100">
              {title || 'Настройка полей'}
            </div>
            <div className="text-[11px] text-slate-500">
              Активных: {activeFields} · Всего: {fields.length}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700"
          >
            Закрыть
          </button>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className="text-xs text-red-300 bg-red-950/50 border border-red-800/60 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-xs text-slate-400">Загрузка...</div>
          ) : (
            <div className="space-y-2">
              {fields.map((field) => (
                <div
                  key={field.id}
                  draggable
                  onDragStart={() => setDragId(field.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragId) moveField(dragId, field.id);
                    setDragId(null);
                  }}
                  className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="text-slate-500 text-xs">⋮⋮</div>
                      <div>
                        <div className="text-sm text-slate-100">
                          {field.label}
                          {!field.isActive && (
                            <span className="ml-2 text-[10px] text-slate-500">
                              скрыто
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {field.key} · {field.type}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() =>
                          handleToggleActive(field)
                        }
                        className="px-2 py-1 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
                      >
                        {field.isActive ? 'Скрыть' : 'Показать'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateField(field.id, { required: !field.required })
                        }
                        className="px-2 py-1 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
                      >
                        {field.required ? 'Обязательное' : 'Необязательное'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteField(field)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#f0c8cf] bg-white px-2 py-1 text-[11px] font-medium text-[#9a1f31] hover:bg-[#fbecef] hover:border-[#e8b4bb] transition-colors"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                    <input
                      value={field.label}
                      onChange={(e) =>
                        handleUpdateField(field.id, { label: e.target.value })
                      }
                      className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200"
                      placeholder="Название"
                    />
                    <select
                      value={field.type}
                      onChange={(e) =>
                        handleUpdateField(field.id, { type: e.target.value })
                      }
                      className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200"
                    >
                      {FIELD_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <input
                      value={field.placeholder || ''}
                      onChange={(e) =>
                        handleUpdateField(field.id, {
                          placeholder: e.target.value,
                        })
                      }
                      className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200"
                      placeholder="Placeholder"
                    />
                    {(field.type === 'select' ||
                      field.type === 'multiselect') && (
                      <input
                        value={optionsToText(field.options)}
                        onChange={(e) =>
                          handleUpdateField(field.id, {
                            options: textToOptions(e.target.value),
                          })
                        }
                        className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 md:col-span-2"
                        placeholder="Опции через запятую"
                      />
                    )}
                    {(field.type === 'email' || field.type === 'phone') && (
                      <select
                        value={field.meta?.source || 'manual'}
                        onChange={(e) =>
                          handleUpdateField(field.id, {
                            meta: { ...(field.meta || {}), source: e.target.value },
                          })
                        }
                        className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200"
                        title="Откуда брать значение"
                      >
                        <option value="manual">Ручной ввод</option>
                        <option value="lead">Из лида</option>
                        <option value="company">Из компании</option>
                      </select>
                    )}
                    <input
                      value={field.defaultValue || ''}
                      onChange={(e) =>
                        handleUpdateField(field.id, {
                          defaultValue: e.target.value,
                        })
                      }
                      className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200"
                      placeholder="Значение по умолчанию"
                    />
                  </div>
                </div>
              ))}

              {fields.length === 0 && (
                <div className="flex items-center gap-2 text-xs text-slate-500 italic">
                  <LottieIcon name="drag-reorder" size={32} className="shrink-0" />
                  Полей пока нет.
                </div>
              )}
            </div>
          )}

          <div className="border-t border-slate-800 pt-4">
            <div className="text-xs text-slate-400 mb-2">
              Добавить новое поле
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input
                value={form.label}
                onChange={(e) => handleFormChange({ label: e.target.value })}
                className="px-2 py-2 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-200"
                placeholder="Название"
              />
              <select
                value={customKeyMode ? '__custom__' : form.key}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '__custom__') {
                    setCustomKeyMode(true);
                    handleFormChange({ key: '' }, { touchKey: true });
                    return;
                  }
                  setCustomKeyMode(false);
                  handleFormChange({ key: value }, { touchKey: true });
                }}
                className="px-2 py-2 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-200"
              >
                <option value="">Выберите ключ</option>
                {suggestedKeyOptions.map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
                <option value="__custom__">Новый ключ</option>
              </select>
              {customKeyMode && (
                <input
                  value={form.key}
                  onChange={(e) =>
                    handleFormChange({ key: e.target.value }, { touchKey: true })
                  }
                  className="px-2 py-2 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-200"
                  placeholder="Ключ (например, cf_budget)"
                />
              )}
              <select
                value={form.type}
                onChange={(e) =>
                  handleFormChange({
                    type: e.target.value as FieldType,
                    options:
                      e.target.value === 'select' || e.target.value === 'multiselect'
                        ? form.options && form.options.length
                          ? form.options
                          : textToOptions('Опция 1, Опция 2') ?? undefined
                        : undefined,
                  })
                }
                className="px-2 py-2 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-200"
              >
                {FIELD_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {(form.type === 'select' || form.type === 'multiselect') && (
                <div className="md:col-span-2 space-y-1">
                  <input
                    value={optionsToText(form.options)}
                    onChange={(e) =>
                      handleFormChange({
                        options: textToOptions(e.target.value) ?? undefined,
                      })
                    }
                    className="w-full px-2 py-2 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-200"
                    placeholder="Опции через запятую (например: Высокий, Обычный, Низкий)"
                  />
                  <div className="text-[10px] text-slate-500">
                    Для списков нужно минимум 1 значение
                  </div>
                </div>
              )}
              <input
                value={form.placeholder}
                onChange={(e) =>
                  handleFormChange({ placeholder: e.target.value })
                }
                className="px-2 py-2 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-200"
                placeholder="Placeholder"
              />
              <input
                value={form.defaultValue}
                onChange={(e) =>
                  handleFormChange({ defaultValue: e.target.value })
                }
                className="px-2 py-2 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-200"
                placeholder="Значение по умолчанию"
              />
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={Boolean(form.required)}
                  onChange={(e) =>
                    handleFormChange({ required: e.target.checked })
                  }
                />
                Обязательное поле
              </label>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={handleCreate}
                disabled={formBusy || (needsOptions && !hasOptions)}
                className="px-3 py-1.5 text-xs rounded-xl bg-lumiva-accent text-slate-950 font-semibold hover:bg-lumiva-accent-soft disabled:opacity-60"
              >
                {formBusy ? 'Сохраняем...' : 'Добавить поле'}
              </button>
              {savingOrder && (
                <div className="text-[11px] text-slate-500">
                  Сохраняем порядок...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


