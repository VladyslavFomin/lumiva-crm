const ENTITY_RU: Record<string, string> = {
  contact: 'Контакт', company: 'Компания', lead: 'Лид', sale: 'Сделка', project: 'Проект',
  task: 'Задача', email: 'Email', telegram: 'Telegram', note: 'Заметка', report: 'Отчёт',
  custom_object: 'Объект', shopify: 'Shopify', booking: 'Бронирование', hotel: 'Отель', product: 'Товар',
  scheduled: 'Расписание',
};

const EVENT_RU: Record<string, string> = {
  created: 'создание', updated: 'обновление', status_changed: 'смена статуса', tag_added: 'добавление тега',
  assigned: 'назначение', received: 'получение', sent: 'отправка', scheduled: 'по расписанию',
  rescheduled: 'перенос', record_created: 'создание записи', record_updated: 'обновление записи',
  payment_received: 'оплата получена', reservation_created: 'создание брони', reservation_status_changed: 'смена статуса брони',
  reservation_rescheduled: 'перенос брони', waitlist_entry_created: 'запись в лист ожидания', price_changed: 'изменение цены',
  stop_sale_set: 'остановка продаж', low_availability: 'мало доступности', stock_low: 'мало на складе', stale: 'давно без движения',
};

/** Turns a raw `entity.event` trigger key (e.g. "lead.status_changed") into a readable Russian label. */
export function triggerLabel(triggerEvent: string): string {
  const [entity, ...rest] = triggerEvent.split('.');
  const event = rest.join('.');
  const entityLabel = ENTITY_RU[entity] || entity;
  const eventLabel = EVENT_RU[event] || event.replace(/_/g, ' ');
  return event ? `${entityLabel} · ${eventLabel}` : entityLabel;
}

const ACTION_TYPE_RU: Record<string, string> = {
  send_email: 'Отправить email', send_telegram: 'Отправить в Telegram', send_sms: 'Отправить SMS',
  create_task: 'Создать задачу', assign_user: 'Назначить сотрудника', update_field: 'Изменить поле',
  create_jira_issue: 'Создать задачу в Jira', webhook: 'Вызвать webhook', add_tag: 'Добавить тег',
  create_note: 'Добавить заметку',
};

export function actionTypeLabel(type: string): string {
  return ACTION_TYPE_RU[type] || type.replace(/_/g, ' ');
}
