import { Lead } from './lead.entity';

/**
 * Лиды с meta.deleted (корзина) не показываем в связях контакта/компании —
 * строка в БД остаётся с contactId до окончательного DELETE.
 */
export function excludeTrashedLeads(leads: Lead[]): Lead[] {
  return leads.filter((l) => {
    const m = l.meta as { deleted?: boolean } | null | undefined;
    return !m?.deleted;
  });
}
