/**
 * Мост ИИ-сотрудник → движок контента (content/content.service.ts). ContentService регистрирует себя
 * при старте, чтобы модуль сотрудников не импортировал модуль контента (цикл DI).
 */
export const CONTENT_POST_ACTION = 'content_post';

export type ContentChannelBrief = { id: string; network: string; accountName: string; autonomy: string };

export interface EmployeeContentHooks {
  /** Каналы, куда сотрудник может готовить посты (общие или отданные его отделу). */
  channelsFor(tenantId: string, departmentId: string | null): Promise<ContentChannelBrief[]>;
  /** Посты сотрудника → план «на согласовании» в движке. Бросает ошибку, если ничего не создано. */
  createPosts(
    tenantId: string,
    agent: { id: string; departmentId: string | null; name: string },
    payload: Record<string, any>,
  ): Promise<{ planId: string; posts: number }>;
  /** Лучшее время по метрикам компании для промпта ('' если данных мало). */
  bestTimesLine(tenantId: string, timezone: string): Promise<string>;
  /** Брендовые шаблоны Canva для промпта ('' если Canva не подключена). */
  canvaLine(tenantId: string): Promise<string>;
}
