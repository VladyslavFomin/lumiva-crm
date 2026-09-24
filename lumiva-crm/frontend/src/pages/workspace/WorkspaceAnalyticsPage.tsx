import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { fetchCustomObjects, type CustomObject, type CustomObjectField } from '../../api/customObjects';
import { ProjectsAnalyticsPage } from '../projects/ProjectsAnalyticsPage';
import type { Project } from '../projects/projectTypes';
import { WorkspaceViewTabs } from '../../components/workspace/WorkspaceViewTabs';
import { useWorkspaceViewAccess } from '../../workspace/useWorkspaceViewAccess';
import { loadWorkspaceAnalyticsItems } from '../../dashboard/workspaceAnalyticsItems';
import { WorkspaceAiAnalyticsPanel } from '../../components/workspace/WorkspaceAiAnalyticsPanel';
import './WorkspaceArea.css';

export const WorkspaceAnalyticsPage: React.FC = () => {
  const { t } = useTranslation();
  const { objectId = '' } = useParams();
  useWorkspaceViewAccess(objectId, 'analytics');
  const [fields, setFields] = useState<CustomObjectField[]>([]);
  const [items, setItems] = useState<Project[]>([]);
  const [objectName, setObjectName] = useState('');
  // Пока поля таблицы ещё не загружены, ProjectsAnalyticsPage получил бы analyticsFields=[] и
  // на секунду решил бы, что это НЕ workspace-режим — посчитал бы generic-дефолты «как у
  // Проектов» (Всего проектов/Ответственные/Статусы) и тут же записал их в localStorage раньше,
  // чем узнал реальную схему таблицы; при следующей загрузке уже читал бы эту неверную заглушку
  // вместо пересчёта под реальные поля. Не монтируем ProjectsAnalyticsPage, пока поля не пришли.
  const [fieldsLoaded, setFieldsLoaded] = useState(false);

  useEffect(() => {
    if (!objectId) return;
    let alive = true;
    Promise.all([loadWorkspaceAnalyticsItems(objectId), fetchCustomObjects().catch(() => [] as CustomObject[])])
      .then(([{ items: mapped, fields: loadedFields }, loadedObjects]) => {
        if (!alive) return;
        const object = loadedObjects.find((item) => item.id === objectId);
        setFields(loadedFields);
        if (object?.name) setObjectName(object.name);
        setItems(mapped);
        setFieldsLoaded(true);
      })
      .catch(() => {
        if (!alive) return;
        setFields([]);
        setItems([]);
        setFieldsLoaded(true);
      });

    return () => {
      alive = false;
    };
  }, [objectId]);

  const displayName = objectName || t('crm.workspace.analytics.defaultName');

  const header = useMemo(
    () => ({
      kicker: t('crm.workspace.analytics.kicker'),
      title: t('crm.workspace.analytics.title', { name: displayName }),
      subtitle: t('crm.workspace.analytics.subtitle'),
    }),
    [displayName, t],
  );

  if (!fieldsLoaded) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-neutral-400">
        {t('crm.common.loading', { defaultValue: 'Загрузка…' })}
      </div>
    );
  }

  return (
    <ProjectsAnalyticsPage
      externalItems={items}
      analyticsFields={fields.map((field) => ({
        key: field.key,
        label: field.label,
        type: field.type,
      }))}
      storageNamespace={`workspace_analytics_${objectId}`}
      header={header}
      toolbarSlot={<WorkspaceViewTabs objectId={objectId} active="analytics" />}
      workspaceObjectId={objectId}
      dashboardPresetSource="workspace"
      dashboardPresetRef={objectId}
      beforeContentSlot={<WorkspaceAiAnalyticsPanel objectId={objectId} />}
    />
  );
};

