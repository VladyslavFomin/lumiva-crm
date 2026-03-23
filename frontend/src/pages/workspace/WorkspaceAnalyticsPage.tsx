import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import {
  fetchCustomObjectFields,
  fetchCustomObjectRecords,
  fetchCustomObjects,
  type CustomObject,
  type CustomObjectField,
} from '../../api/customObjects';
import { ProjectsAnalyticsPage } from '../projects/ProjectsAnalyticsPage';
import type { Project } from '../projects/projectTypes';
import { WorkspaceViewTabs } from '../../components/workspace/WorkspaceViewTabs';
import { useWorkspaceViewAccess } from '../../workspace/useWorkspaceViewAccess';

const keyIncludes = (field: CustomObjectField, query: string) =>
  field.key.toLowerCase().includes(query) || field.label.toLowerCase().includes(query);

const pickField = (
  fields: CustomObjectField[],
  predicate: (field: CustomObjectField) => boolean,
) => fields.find(predicate);

const parseMulti = (raw: any): string[] => {
  if (Array.isArray(raw)) return raw.map((v) => String(v).trim()).filter(Boolean);
  return String(raw || '')
    .split(/[,;/]+/)
    .map((v) => v.trim())
    .filter(Boolean);
};

export const WorkspaceAnalyticsPage: React.FC = () => {
  const { t } = useTranslation();
  const { objectId = '' } = useParams();
  useWorkspaceViewAccess(objectId, 'analytics');
  const [fields, setFields] = useState<CustomObjectField[]>([]);
  const [items, setItems] = useState<Project[]>([]);
  const [objectName, setObjectName] = useState('');

  useEffect(() => {
    if (!objectId) return;
    let alive = true;
    Promise.all([
      fetchCustomObjectFields(objectId),
      fetchCustomObjectRecords(objectId),
      fetchCustomObjects().catch(() => [] as CustomObject[]),
    ])
      .then(([loadedFields, loadedRecords, loadedObjects]) => {
        if (!alive) return;
        setFields(loadedFields);
        const object = loadedObjects.find((item) => item.id === objectId);
        if (object?.name) setObjectName(object.name);

        const titleField =
          pickField(loadedFields, (field) => keyIncludes(field, 'name')) ||
          pickField(loadedFields, (field) => keyIncludes(field, 'title')) ||
          loadedFields[0];
        const statusField =
          pickField(loadedFields, (field) => field.type === 'status') ||
          pickField(loadedFields, (field) => keyIncludes(field, 'status'));
        const categoryField =
          pickField(loadedFields, (field) => keyIncludes(field, 'category')) ||
          pickField(loadedFields, (field) => keyIncludes(field, 'type'));
        const ownerField =
          pickField(loadedFields, (field) => keyIncludes(field, 'owner')) ||
          pickField(loadedFields, (field) => keyIncludes(field, 'assignee')) ||
          pickField(loadedFields, (field) => keyIncludes(field, 'responsible')) ||
          pickField(loadedFields, (field) => keyIncludes(field, 'person'));
        const amountField =
          pickField(loadedFields, (field) => field.type === 'number' && keyIncludes(field, 'amount')) ||
          pickField(loadedFields, (field) => field.type === 'number' && keyIncludes(field, 'price')) ||
          pickField(loadedFields, (field) => field.type === 'number' && keyIncludes(field, 'sum')) ||
          pickField(loadedFields, (field) => field.type === 'number' && keyIncludes(field, 'value')) ||
          pickField(loadedFields, (field) => field.type === 'number');
        const tagsField =
          pickField(loadedFields, (field) => field.type === 'multiselect' && keyIncludes(field, 'tag')) ||
          pickField(loadedFields, (field) => keyIncludes(field, 'tag')) ||
          pickField(loadedFields, (field) => field.type === 'multiselect');
        const currencyField =
          pickField(loadedFields, (field) => keyIncludes(field, 'currency')) ||
          pickField(loadedFields, (field) => keyIncludes(field, 'валют'));

        const mapped: Project[] = loadedRecords.items.map((record) => {
          const values = record.values || {};
          const name = String(
            (titleField && values[titleField.key]) || values.name || values.title || `Record ${record.id.slice(0, 6)}`,
          ).trim();
          const status = String(
            (statusField && values[statusField.key]) || values.status || 'new',
          );
          const category = String((categoryField && values[categoryField.key]) || values.category || '').trim();
          const owner = String((ownerField && values[ownerField.key]) || values.owner || '').trim();
          const amountRaw = (amountField && values[amountField.key]) ?? values.amount ?? values.price ?? 0;
          const amount =
            typeof amountRaw === 'number'
              ? amountRaw
              : Number(String(amountRaw).replace(',', '.')) || 0;
          const tagsRaw = (tagsField && values[tagsField.key]) ?? values.tags ?? '';
          const tags = parseMulti(tagsRaw);
          const currency = String((currencyField && values[currencyField.key]) || values.currency || 'EUR');

          return {
            id: record.id,
            name,
            description: String(values.description || ''),
            amount,
            currency,
            status: status as any,
            category: category || null,
            tags,
            owner: owner || null,
            leadId: null,
            leadName: null,
            leadEmail: null,
            ownerUserIds: [],
            customFields: values,
            tasks: [],
            comments: [],
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
          };
        });

        setItems(mapped);
      })
      .catch(() => {
        if (!alive) return;
        setFields([]);
        setItems([]);
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
    />
  );
};

