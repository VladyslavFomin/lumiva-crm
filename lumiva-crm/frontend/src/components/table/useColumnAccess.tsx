import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  fetchColumnAccess,
  isRestrictableColumnId,
  setColumnViewers,
  type ColumnAccessInfo,
  type ColumnAccessTableKey,
} from '../../api/columnAccess';
import type { StaffUser } from '../../api/staff';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { ColumnViewersPopover, LockIcon } from './ColumnViewersPopover';

/**
 * «Кто может просматривать этот столбец» для встроенных таблиц (Лиды, Проекты).
 * - hiddenColumnIds: колонки, скрытые от текущего пользователя (их надо убрать из таблицы —
 *   сервер всё равно не отдаёт их значения);
 * - lockButton(col): кнопка-замок для панели «Колонки» (только у владельца компании);
 * - popover: сам поповер выбора сотрудников, рендерить где угодно в дереве.
 */
export function useColumnAccess(tableKey: ColumnAccessTableKey, staff: StaffUser[]) {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const [info, setInfo] = useState<ColumnAccessInfo | null>(null);
  const [open, setOpen] = useState<{ columnId: string; label: string; anchor: DOMRect } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchColumnAccess(tableKey)
      .then((r) => !cancelled && setInfo(r))
      .catch(() => !cancelled && setInfo(null));
    return () => {
      cancelled = true;
    };
  }, [tableKey]);

  const hiddenColumnIds = useMemo(() => new Set(info?.hiddenColumnIds ?? []), [info]);
  const viewersOf = useCallback(
    (columnId: string) => info?.restrictions.find((r) => r.columnId === columnId)?.viewerStaffIds ?? [],
    [info],
  );

  const save = async (columnId: string, ids: string[]) => {
    const prev = info;
    setInfo((cur) =>
      cur
        ? {
            ...cur,
            restrictions: [
              ...cur.restrictions.filter((r) => r.columnId !== columnId),
              ...(ids.length ? [{ columnId, viewerStaffIds: ids }] : []),
            ],
          }
        : cur,
    );
    setSaving(true);
    try {
      await setColumnViewers(tableKey, columnId, ids);
    } catch (e) {
      setInfo(prev);
      showAlert(e instanceof Error ? e.message : t('crm.columnAccess.saveError'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const lockButton = (col: { id: string; label: string }): React.ReactNode => {
    if (!info?.canManage || !isRestrictableColumnId(info, col.id)) return null;
    const count = viewersOf(col.id).length;
    return (
      <button
        type="button"
        className={`cva-lock-btn${count ? ' on' : ''}`}
        title={count ? t('crm.columnAccess.restrictedBadge', { count }) : t('crm.columnAccess.menuItem')}
        aria-label={t('crm.columnAccess.menuItem')}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen({ columnId: col.id, label: col.label, anchor: e.currentTarget.getBoundingClientRect() });
        }}
      >
        <LockIcon size={13} />
      </button>
    );
  };

  /** Маленький замок рядом с названием колонки в шапке таблицы (видно владельцу). */
  const headerBadge = (columnId: string): React.ReactNode => {
    const count = viewersOf(columnId).length;
    if (!count) return null;
    return (
      <span className="cva-lock-badge" title={t('crm.columnAccess.restrictedBadge', { count })} style={{ marginLeft: 4 }}>
        <LockIcon size={11} />
      </span>
    );
  };

  const popover = open ? (
    <ColumnViewersPopover
      anchor={open.anchor}
      columnLabel={open.label}
      staff={staff}
      selected={viewersOf(open.columnId)}
      saving={saving}
      onClose={() => setOpen(null)}
      onChange={(ids) => void save(open.columnId, ids)}
    />
  ) : null;

  return { info, hiddenColumnIds, lockButton, headerBadge, popover };
}
