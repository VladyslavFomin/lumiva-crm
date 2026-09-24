import {
  fetchCustomObjectFields,
  fetchCustomObjectRecords,
  fetchCustomObjects,
  type CustomObject,
  type CustomObjectField,
  type CustomObjectRecord,
} from '../api/customObjects';
import type { Project } from '../pages/projects/projectTypes';
import { getWorkspaceTableKind } from '../workspace/workspaceTableKind';

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

/** Совпадает с маппингом WorkspaceAnalyticsPage — приводит записи таблицы рабочей области
 * к тем же полям Project, что использует ProjectsAnalyticsWidgetEmbed. */
export function mapWorkspaceRecordsToItems(
  records: CustomObjectRecord[],
  fields: CustomObjectField[],
): Project[] {
  const titleField =
    pickField(fields, (field) => keyIncludes(field, 'name')) ||
    pickField(fields, (field) => keyIncludes(field, 'title')) ||
    fields[0];
  const statusField =
    pickField(fields, (field) => field.type === 'status') ||
    pickField(fields, (field) => keyIncludes(field, 'status'));
  const categoryField =
    pickField(fields, (field) => keyIncludes(field, 'category')) ||
    pickField(fields, (field) => keyIncludes(field, 'type'));
  const ownerField =
    pickField(fields, (field) => keyIncludes(field, 'owner')) ||
    pickField(fields, (field) => keyIncludes(field, 'assignee')) ||
    pickField(fields, (field) => keyIncludes(field, 'responsible')) ||
    pickField(fields, (field) => keyIncludes(field, 'person'));
  const amountField =
    pickField(fields, (field) => field.type === 'number' && keyIncludes(field, 'amount')) ||
    pickField(fields, (field) => field.type === 'number' && keyIncludes(field, 'price')) ||
    pickField(fields, (field) => field.type === 'number' && keyIncludes(field, 'sum')) ||
    pickField(fields, (field) => field.type === 'number' && keyIncludes(field, 'value')) ||
    pickField(fields, (field) => field.type === 'number' && keyIncludes(field, 'tutar')) ||
    pickField(fields, (field) => field.type === 'number' && keyIncludes(field, 'miktar')) ||
    pickField(fields, (field) => field.type === 'number');
  const tagsField =
    pickField(fields, (field) => field.type === 'multiselect' && keyIncludes(field, 'tag')) ||
    pickField(fields, (field) => keyIncludes(field, 'tag')) ||
    pickField(fields, (field) => field.type === 'multiselect');
  const currencyField =
    pickField(fields, (field) => keyIncludes(field, 'currency')) ||
    pickField(fields, (field) => keyIncludes(field, 'валют'));

  return records.map((record) => {
    const values = (record.values || {}) as Record<string, any>;
    const name = String(
      (titleField && values[titleField.key]) || values.name || values.title || `Record ${record.id.slice(0, 6)}`,
    ).trim();
    const status = String((statusField && values[statusField.key]) || values.status || 'new');
    const category = String((categoryField && values[categoryField.key]) || values.category || '').trim();
    const owner = String((ownerField && values[ownerField.key]) || values.owner || '').trim();
    const amountRaw = (amountField && values[amountField.key]) ?? values.amount ?? values.price ?? 0;
    const amount =
      typeof amountRaw === 'number' ? amountRaw : Number(String(amountRaw).replace(',', '.')) || 0;
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
    } as Project;
  });
}

/** Загружает поля + записи таблицы рабочей области и приводит их к Project[] —
 * общая логика для WorkspaceAnalyticsPage и блоков, переданных с неё на главную. */
export async function loadWorkspaceAnalyticsItems(
  objectId: string,
): Promise<{ items: Project[]; fields: CustomObjectField[] }> {
  const [loadedFields, loadedObjects] = await Promise.all([
    fetchCustomObjectFields(objectId),
    fetchCustomObjects().catch(() => [] as CustomObject[]),
  ]);
  const object = loadedObjects.find((item) => item.id === objectId);
  const enrich = getWorkspaceTableKind(object?.meta as Record<string, unknown> | null) === 'board';
  const loadedRecords = await fetchCustomObjectRecords(objectId, undefined, {
    enrichColumnBindings: enrich,
  });
  return {
    items: mapWorkspaceRecordsToItems(loadedRecords.items, loadedFields),
    fields: loadedFields,
  };
}
