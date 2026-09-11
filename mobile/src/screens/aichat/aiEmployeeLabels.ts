import { Ionicons } from '@expo/vector-icons';

// Human-readable Russian labels for the raw permission keys / log event types the backend
// returns (AI_EMPLOYEE_PERMISSION_KEYS in ai-employee-role-catalog.ts, and AiAgentLog.eventType).
// Mirrors the same "curated map + underscore fallback" convention as
// screens/automations/triggerLabels.ts — cosmetic label formatting only, never invents keys or values.

const PERMISSION_RU: Record<string, string> = {
  read_leads: 'Просмотр лидов',
  read_contacts: 'Просмотр контактов',
  read_companies: 'Просмотр компаний',
  read_deals: 'Просмотр сделок',
  read_tasks: 'Просмотр задач',
  read_projects: 'Просмотр проектов',
  read_marketing: 'Просмотр маркетинга',
  read_campaigns: 'Просмотр кампаний',
  read_marketing_traffic: 'Просмотр трафика',
  read_marketing_costs: 'Просмотр расходов на маркетинг',
  read_marketing_roi: 'Просмотр ROI маркетинга',
  read_marketing_integrations: 'Просмотр интеграций маркетинга',
  read_attribution: 'Просмотр атрибуции',
  read_analytics: 'Просмотр аналитики',
  read_reports: 'Просмотр отчётов',
  read_sales: 'Просмотр продаж',
  read_messages: 'Просмотр сообщений',
  read_files: 'Просмотр файлов',
  read_notes: 'Просмотр заметок',
  create_task: 'Создание задач',
  update_task: 'Изменение задач',
  create_note: 'Создание заметок',
  update_lead_status: 'Изменение статуса лида',
  assign_lead: 'Назначение лида',
  draft_email: 'Черновики email',
  send_email: 'Отправка email',
  draft_whatsapp: 'Черновики WhatsApp',
  send_whatsapp: 'Отправка WhatsApp',
  send_telegram: 'Отправка в Telegram',
  create_report: 'Создание отчётов',
  create_project: 'Создание проектов',
  create_workspace_table: 'Создание таблиц воркспейса',
  manage_workspace_data: 'Управление данными воркспейса',
};

export function permissionLabel(key: string): string {
  return PERMISSION_RU[key] || key.replace(/_/g, ' ');
}

const LOG_EVENT_RU: Record<string, string> = {
  agent_created: 'Сотрудник создан',
  agent_updated: 'Сотрудник обновлён',
  agent_removed: 'Сотрудник удалён',
  agent_paused: 'Приостановлен',
  agent_resumed: 'Возобновлён',
  permissions_updated: 'Права изменены',
  report_generated: 'Отчёт сформирован',
  report_sent: 'Отчёт отправлен',
  run_now: 'Ручной запуск',
  proactive_cycle: 'Фоновый цикл',
};

export function logEventLabel(eventType: string): string {
  return LOG_EVENT_RU[eventType] || eventType.replace(/_/g, ' ');
}

export function logEventIcon(eventType: string): keyof typeof Ionicons.glyphMap {
  if (eventType.includes('pause')) return 'pause-circle-outline';
  if (eventType.includes('resume')) return 'play-circle-outline';
  if (eventType.includes('report')) return 'document-text-outline';
  if (eventType.includes('permission')) return 'key-outline';
  if (eventType.includes('created')) return 'add-circle-outline';
  if (eventType.includes('removed')) return 'trash-outline';
  if (eventType.includes('run') || eventType.includes('proactive')) return 'flash-outline';
  return 'ellipse-outline';
}

const STATUS_RU: Record<string, string> = {
  active: 'Активен',
  paused: 'Приостановлен',
  disabled: 'Отключён',
  setup_required: 'Нужна настройка',
  success: 'Успешно',
  warning: 'Предупреждение',
  error: 'Ошибка',
  generated: 'Сформирован',
  sent: 'Отправлен',
  failed: 'Ошибка',
  draft: 'Черновик',
};

export function agentStatusLabel(status: string): string {
  return STATUS_RU[status] || status.replace(/_/g, ' ');
}
