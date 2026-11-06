/**
 * Структура CRM (Настройки → «Структура CRM»): какие блоки показывать в карточках лида, проекта и
 * сделки, и есть ли у проектов бюджет. Хранится в tenants.crmLayout; всё, чего нет, — включено
 * (так старые тенанты видят CRM ровно как раньше).
 */
export const LEAD_BLOCKS = [
  'contact', 'amount', 'company', 'contacts', 'projects', 'deals', 'sales', 'bookings',
  'customFields', 'utm', 'notes', 'chat', 'calls', 'comments', 'history', 'ai', 'tasks', 'meetings',
] as const;
export const PROJECT_BLOCKS = [
  'budget', 'progress', 'links', 'tags', 'customFields', 'notes', 'files', 'tasks', 'comments', 'history', 'watchers',
] as const;
export const DEAL_BLOCKS = [
  'progress', 'links', 'tags', 'customFields', 'notes', 'files', 'tasks', 'comments', 'history', 'watchers',
] as const;

export type CrmLayout = {
  lead: Record<string, boolean>;
  project: Record<string, boolean>;
  deal: Record<string, boolean>;
};

const pick = (keys: readonly string[], raw: unknown): Record<string, boolean> => {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out: Record<string, boolean> = {};
  for (const k of keys) out[k] = src[k] !== false;
  return out;
};

export function readCrmLayout(raw: unknown): CrmLayout {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    lead: pick(LEAD_BLOCKS, r.lead),
    project: pick(PROJECT_BLOCKS, r.project),
    deal: pick(DEAL_BLOCKS, r.deal),
  };
}

/** Слияние частичного обновления (неизвестные ключи отбрасываются). */
export function mergeCrmLayout(current: unknown, patch: unknown): CrmLayout {
  const cur = readCrmLayout(current);
  const p = patch && typeof patch === 'object' ? (patch as Record<string, any>) : {};
  return readCrmLayout({
    lead: { ...cur.lead, ...(p.lead || {}) },
    project: { ...cur.project, ...(p.project || {}) },
    deal: { ...cur.deal, ...(p.deal || {}) },
  });
}
