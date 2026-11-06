import React from 'react';
import { useTranslation } from 'react-i18next';
import '../table/ColumnAccess.css';

const Icon: React.FC<{ d: React.ReactNode }> = ({ d }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d}
  </svg>
);

type Props = {
  top: number;
  left: number;
  viewersCount: number;
  rulesCount: number;
  canManageAccess: boolean;
  canEdit?: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onAccess: (anchor: DOMRect) => void;
  onRules: () => void;
  /** Только в группах доски: скрыть колонку в этой группе. */
  onHideInGroup?: () => void;
  onDelete: () => void;
};

/** Меню «⋯» колонки рабочей таблицы: общее для таблицы данных и групп доски. */
export const WorkspaceColumnMenu: React.FC<Props> = ({
  top,
  left,
  viewersCount,
  rulesCount,
  canManageAccess,
  canEdit = true,
  onEdit,
  onDuplicate,
  onAccess,
  onRules,
  onHideInGroup,
  onDelete,
}) => {
  const { t } = useTranslation();
  return (
    <div data-column-menu className="wcm-menu lv-pop" style={{ top, left }} role="menu">
      {canEdit && (
        <button type="button" role="menuitem" className="wcm-item" onClick={onEdit}>
          <Icon d={<><path d="M12 20h9" /><path d="m16.5 3.5 4 4L7 21H3v-4L16.5 3.5Z" /></>} />
          <span>{t('crm.workspace.table.editColumn')}</span>
        </button>
      )}
      {canEdit && (
        <button type="button" role="menuitem" className="wcm-item" onClick={onDuplicate}>
          <Icon d={<><rect x="9" y="9" width="11" height="11" rx="2" /><rect x="4" y="4" width="11" height="11" rx="2" /></>} />
          <span>{t('crm.workspace.table.duplicateColumn')}</span>
        </button>
      )}
      {onHideInGroup && (
        <button type="button" role="menuitem" className="wcm-item" onClick={onHideInGroup}>
          <Icon d={<><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" /><circle cx="12" cy="12" r="3" /></>} />
          <span>{t('crm.workspace.table.hideColumn')}</span>
        </button>
      )}
      {(canManageAccess || canEdit) && <div className="wcm-sep" />}
      {canManageAccess && (
        <button
          type="button"
          role="menuitem"
          className="wcm-item"
          onClick={(e) => onAccess((e.currentTarget as HTMLElement).getBoundingClientRect())}
        >
          <Icon d={<><rect x="4.5" y="10.5" width="15" height="10" rx="2.2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></>} />
          <span>{t('crm.columnAccess.menuItem')}</span>
          {viewersCount > 0 && <em>{viewersCount}</em>}
        </button>
      )}
      {canEdit && (
        <button type="button" role="menuitem" className="wcm-item" onClick={onRules}>
          <Icon d={<><rect x="3.5" y="3.5" width="17" height="17" rx="2.5" /><path d="m7.5 9 1.5 1.5 3-3M7.5 15.5h2M13.5 9h3M13.5 15.5h3" /></>} />
          <span>{t('crm.columnRules.menuItem')}</span>
          {rulesCount > 0 && <em>{rulesCount}</em>}
        </button>
      )}
      {canEdit && (
        <>
          <div className="wcm-sep" />
          <button type="button" role="menuitem" className="wcm-item danger" onClick={onDelete}>
            <Icon d={<><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /></>} />
            <span>{t('crm.workspace.table.deleteColumn')}</span>
          </button>
        </>
      )}
    </div>
  );
};
