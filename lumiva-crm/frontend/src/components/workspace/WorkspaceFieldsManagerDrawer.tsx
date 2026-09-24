import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { updateCustomObjectField, type CustomObjectField } from '../../api/customObjects';
import { WsFieldTypeIcon } from './WorkspaceFieldTypePicker';

/**
 * "Управление колонками" — все поля таблицы в одном списке: drag-реордер + быстрые действия
 * (скрыть/показать, дублировать, удалить) прямо в карточке, плюс переход в уже существующий
 * подробный редактор поля (openEditColumn в WorkspaceTableViewPage) для типа/привязок/ИИ-конфига —
 * не дублирует ту сложную логику здесь, только реордер + быстрые действия, как в CustomFieldsManager
 * (Projects), но на светлой теме ws-* вместо тёмной Tailwind-темы оригинала.
 */
export function WorkspaceFieldsManagerDrawer({
  objectId,
  fields,
  onClose,
  onChanged,
  onEditField,
  onAddField,
  onDuplicateField,
  onDeleteField,
}: {
  objectId: string;
  fields: CustomObjectField[];
  onClose: () => void;
  onChanged: () => void;
  onEditField: (field: CustomObjectField) => void;
  onAddField: () => void;
  onDuplicateField: (field: CustomObjectField) => void;
  onDeleteField: (field: CustomObjectField) => void;
}) {
  const { t } = useTranslation();
  const [ordered, setOrdered] = useState<CustomObjectField[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setOrdered([...fields].sort((a, b) => a.order - b.order));
  }, [fields]);

  const persistOrder = async (next: CustomObjectField[]) => {
    setOrdered(next);
    setSavingOrder(true);
    setError('');
    try {
      await Promise.all(
        next.map((field, index) =>
          field.order === index ? Promise.resolve() : updateCustomObjectField(objectId, field.id, { order: index }),
        ),
      );
      onChanged();
    } catch (e: any) {
      setError(e?.message || t('crm.workspace.table.saveRecordFailed'));
    } finally {
      setSavingOrder(false);
    }
  };

  const moveField = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const next = [...ordered];
    const fromIndex = next.findIndex((f) => f.id === sourceId);
    const toIndex = next.findIndex((f) => f.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    void persistOrder(next);
  };

  const toggleActive = async (field: CustomObjectField) => {
    setBusyId(field.id);
    setError('');
    try {
      await updateCustomObjectField(objectId, field.id, { isActive: !field.isActive });
      setOrdered((prev) => prev.map((f) => (f.id === field.id ? { ...f, isActive: !f.isActive } : f)));
      onChanged();
    } catch (e: any) {
      setError(e?.message || t('crm.workspace.table.saveRecordFailed'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="ws-page ws-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ws-drawer">
        <div className="ws-drawer-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2>{t('crm.workspace.table.manageFieldsTitle')}</h2>
            <div className="s">{t('crm.workspace.table.manageFieldsHint')}</div>
          </div>
          <button type="button" onClick={onClose} className="tb-icon-btn">
            {t('crm.workspace.table.cancel')}
          </button>
        </div>
        <div className="ws-drawer-body">
          {error ? <p className="ws-note" style={{ color: '#9c2338' }}>{error}</p> : null}
          <div className="ws-fields-list">
            {ordered.map((field) => (
              <div
                key={field.id}
                draggable
                onDragStart={() => setDragId(field.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragId) moveField(dragId, field.id);
                  setDragId(null);
                }}
                className={`ws-field-row${field.isActive ? '' : ' off'}`}
              >
                <span className="drag" aria-hidden>⋮⋮</span>
                <span className="ic">
                  <WsFieldTypeIcon typeKey={field.type} />
                </span>
                <div className="info">
                  <div className="lbl">
                    {field.label}
                    {!field.isActive ? <span className="badge">{t('crm.workspace.table.fieldHiddenBadge')}</span> : null}
                  </div>
                  <div className="key">
                    {field.key} · {t(`crm.workspace.table.fieldTypes.${field.type}`, { defaultValue: field.type })}
                  </div>
                </div>
                <div className="actions">
                  <button type="button" className="tb-icon-btn" onClick={() => onEditField(field)}>
                    {t('crm.workspace.table.editColumnTitle')}
                  </button>
                  <button
                    type="button"
                    className="tb-icon-btn"
                    disabled={busyId === field.id}
                    onClick={() => void toggleActive(field)}
                  >
                    {field.isActive ? t('crm.workspace.table.hideColumn') : t('crm.workspace.table.showColumn')}
                  </button>
                  <button type="button" className="tb-icon-btn" onClick={() => onDuplicateField(field)}>
                    {t('crm.workspace.table.duplicateColumn')}
                  </button>
                  <button type="button" className="tb-icon-btn danger" onClick={() => onDeleteField(field)}>
                    {t('crm.workspace.table.bulkDelete')}
                  </button>
                </div>
              </div>
            ))}
            {!ordered.length ? <p className="ws-note">{t('crm.workspace.table.manageFieldsEmpty')}</p> : null}
          </div>
        </div>
        <div className="ws-drawer-foot">
          {savingOrder ? <span className="cnt">{t('crm.workspace.table.saving')}</span> : null}
          <span className="sp" />
          <button type="button" className="btn btn-primary btn-sm" onClick={onAddField}>
            {t('crm.workspace.table.addField')}
          </button>
        </div>
      </div>
    </div>
  );
}
