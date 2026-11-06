/**
 * Какие сущности и блоки «Структуры CRM» вообще есть у компании — по модулям, включённым в pl1.
 * Один справочник и для Настроек (выключенный в pl1 модуль не показывается даже тумблером), и для
 * самих карточек (блок модуля, выключенного в pl1, не рисуется независимо от настройки).
 */
import type { CrmEntity } from './useCrmLayout';

type IsEnabled = (key: string) => boolean;

/** Каналы переписки в карточке лида; Telegram/WhatsApp/Instagram живут внутри «Инструментов». */
const messagingOn = (on: IsEnabled) =>
  on('email') || (on('tools') && (on('telegram') || on('whatsapp') || on('instagram')));

/** Модуль сущности целиком. */
export const ENTITY_COMPONENT: Record<CrmEntity, string> = { lead: 'leads', project: 'projects', deal: 'deals' };

/** Блоки, которые зависят от модулей pl1 (остальные — часть самой сущности и есть всегда). */
const BLOCK_RULES: Record<CrmEntity, Record<string, (on: IsEnabled) => boolean>> = {
  lead: {
    company: (on) => on('companies'),
    contacts: (on) => on('contacts'),
    projects: (on) => on('projects'),
    deals: (on) => on('deals'),
    sales: (on) => on('sales'),
    bookings: (on) => on('bookings'),
    chat: messagingOn,
    calls: (on) => on('phone_system'),
  },
  project: {},
  deal: {},
};

export function entityAvailable(entity: CrmEntity, isEnabled: IsEnabled): boolean {
  return isEnabled(ENTITY_COMPONENT[entity]);
}

export function blockAvailable(entity: CrmEntity, block: string, isEnabled: IsEnabled): boolean {
  const rule = BLOCK_RULES[entity][block];
  return rule ? rule(isEnabled) : true;
}
