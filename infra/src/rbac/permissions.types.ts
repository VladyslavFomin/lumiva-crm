// src/rbac/permissions.types.ts

// Ключи прав — строго соответствуют строкам в UI таблицы "Права доступа"
export type PermissionKey =
  | 'leads'      // Лиды
  | 'projects'   // Проекты
  | 'staff'      // Сотрудники
  | 'finance'    // Финансы
  | 'analytics'  // Аналитика
  | 'settings'   // Настройки CRM
  | 'chat';      // Онлайн-чат
