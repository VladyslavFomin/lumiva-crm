/**
 * Какие колонки встроенных таблиц можно ограничить и что именно вырезается из ответа API.
 * Только «скалярные» колонки и пользовательские поля: связи (компания, контакт, ответственный,
 * статус) ограничивать нельзя — на них держатся карточки, фильтры и права доступа к записи.
 */
export type ColumnStripSpec = {
  /** Свойства сущности, которые обнуляются в ответе и игнорируются во входящем PATCH. */
  props: string[];
  /** Ключи entity.meta с тем же значением (старые лиды хранят UTM в meta). */
  metaKeys?: string[];
};

export type ColumnAccessTable = {
  customFieldEntityType: string;
  /** Обёрнут ли customFields целиком при PATCH (лиды) — тогда скрытые ключи надо восстанавливать. */
  customFieldsReplacedOnUpdate: boolean;
  columns: Record<string, ColumnStripSpec>;
};

const utm = (prop: string, metaSnake: string): ColumnStripSpec => ({ props: [prop], metaKeys: [metaSnake, prop] });

export const COLUMN_ACCESS_TABLES: Record<string, ColumnAccessTable> = {
  leads: {
    customFieldEntityType: 'lead',
    customFieldsReplacedOnUpdate: true,
    columns: {
      utm: {
        props: ['utmSource', 'utmMedium', 'utmCampaign', 'utmTerm', 'utmContent'],
        metaKeys: [
          'utm_source', 'utmSource', 'utm_medium', 'utmMedium', 'utm_campaign', 'utmCampaign',
          'utm_term', 'utmTerm', 'utm_content', 'utmContent',
        ],
      },
      utmSource: utm('utmSource', 'utm_source'),
      utmMedium: utm('utmMedium', 'utm_medium'),
      utmCampaign: utm('utmCampaign', 'utm_campaign'),
      utmTerm: utm('utmTerm', 'utm_term'),
      utmContent: utm('utmContent', 'utm_content'),
    },
  },
  projects: {
    customFieldEntityType: 'project',
    customFieldsReplacedOnUpdate: false,
    columns: {
      amount: { props: ['amount'] },
    },
  },
};

export function isRestrictableColumn(tableKey: string, columnId: string): boolean {
  const t = COLUMN_ACCESS_TABLES[tableKey];
  if (!t) return false;
  return columnId in t.columns || /^cf:[0-9a-f-]{36}$/i.test(columnId);
}
