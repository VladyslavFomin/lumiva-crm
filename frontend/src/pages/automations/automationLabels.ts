// src/pages/automations/automationLabels.ts

export const getTriggerLabel = (event: string): string => {
  const labels: Record<string, string> = {
    'contact.created': 'Контакт создан',
    'contact.updated': 'Контакт обновлен',
    'company.created': 'Компания создана',
    'company.updated': 'Компания обновлена',
    'lead.created': 'Лид создан',
    'lead.updated': 'Лид обновлен',
    'lead.status_changed': 'Статус лида изменен',
    'lead.assigned': 'Лид назначен',
    'sale.created': 'Продажа создана',
    'sale.updated': 'Продажа обновлена',
    'sale.status_changed': 'Статус продажи изменен',
    'project.created': 'Проект создан',
    'project.status_changed': 'Статус проекта изменен',
    'task.created': 'Задача создана',
    'task.updated': 'Задача обновлена',
    'task.status_changed': 'Статус задачи изменен',
    'report.scheduled': 'Отчёт по расписанию',
    'email.sent': 'Email отправлен',
    'email.received': 'Email получен',
    'telegram.message_received': 'Telegram сообщение получено',
    'note.created': 'Заметка создана',
  };
  return labels[event] || event;
};

export const getActionLabel = (type: string): string => {
  const labels: Record<string, string> = {
    trigger_webhook: 'Webhook',
    send_email: 'Email',
    send_telegram: 'Telegram',
    create_note: 'Заметка',
    update_field: 'Обновить поле',
    add_tag: 'Добавить тег',
    remove_tag: 'Удалить тег',
    change_status: 'Изменить статус',
    create_task: 'Создать задачу',
    assign_task: 'Назначить задачу',
    assign_user: 'Назначить сотрудника',
    send_notification: 'Уведомление',
    send_report: 'Отправить отчёт',
  };
  return labels[type] || type;
};
