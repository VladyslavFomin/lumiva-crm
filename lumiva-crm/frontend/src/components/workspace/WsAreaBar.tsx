import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { NAV_ICON_MAP, type NavIconKey } from '../layout/NavSidebarIcons';

const ChevronRight: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M9 6l6 6-6 6" />
  </svg>
);

type Props = {
  areaId: string;
  areaName: string;
  areaIconKey?: string;
  /** Название текущей таблицы/страницы — если не задано, показывается «Все таблицы». */
  current?: string;
  /** true/false — бейдж «Основная»/«Данные» рядом с названием таблицы. */
  kind?: 'board' | 'data' | null;
};

export const WsAreaBar: React.FC<Props> = ({ areaId, areaName, areaIconKey, current, kind }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const Icon = areaIconKey && areaIconKey in NAV_ICON_MAP ? NAV_ICON_MAP[areaIconKey as NavIconKey] : NAV_ICON_MAP.folder;
  return (
    <div className="ws-bar">
      <button type="button" className="ws-bar-a" onClick={() => navigate(`/workspace/areas/${areaId}`)}>
        <Icon className="!h-[13px] !w-[13px]" /> {areaName}
      </button>
      <ChevronRight className="sep" />
      <span className="ws-bar-cur">{current || t('crm.workspace.areaBar.allTables')}</span>
      {kind && (
        <span className={`ws-badge${kind === 'board' ? ' board' : ''}`} style={{ marginLeft: 4 }}>
          {kind === 'board' ? t('crm.workspace.kindBadge.shortBoard') : t('crm.workspace.kindBadge.shortData')}
        </span>
      )}
      <span style={{ flex: 1 }} />
      <button type="button" className="ws-bar-a" onClick={() => navigate('/workspace/areas')}>
        {t('crm.workspace.area.allAreas', { defaultValue: 'Все области' })}
      </button>
    </div>
  );
};
