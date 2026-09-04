// src/telegram-crm/telegram-flow.types.ts
// Generic conversation-flow graph: node vocabulary, per-bot flow storage shape, and the
// default example flows every bot is seeded with (editable/deletable, not read-only presets).

export type FlowNodeType =
  | 'msg'
  | 'buttons'
  | 'ask'
  | 'ai'
  | 'cond'
  | 'crm'
  | 'human'
  | 'delay'
  | 'hook'
  | 'pay';

export interface FlowButtonOption {
  id: string;
  label: string;
  nextNodeId?: string;
}

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  name: string;
  text: string;
  // msg
  nextNodeId?: string;
  // buttons
  options?: FlowButtonOption[];
  source?: 'static' | 'booking_services' | 'booking_staff' | 'booking_slots';
  // ask
  fieldTarget?: string; // 'contact.firstName' | 'contact.phone' | 'contact.telegram' | 'lead.customFields.<key>' | 'collected.<key>'
  validation?: 'none' | 'phone' | 'text';
  // ai
  aiNextNodeId?: string; // if absent, node stays in an open AI sub-conversation
  // cond
  condField?: string; // 'collected.<key>' | 'lead.status' | 'ai.escalated' | 'repeatCount'
  condOp?: 'eq' | 'exists' | 'gte';
  condValue?: string;
  trueNodeId?: string;
  falseNodeId?: string;
  // crm
  crmAction?: 'create_lead' | 'create_reservation' | 'update_lead_stage';
  // human
  department?: string;
  pauseMinutes?: number;
  // delay
  afterMinutes?: number;
  // hook
  targetFlowId?: string;
  // display-only children (mockup-style tree nesting for the builder UI)
  childIds?: string[];
}

export interface Flow {
  id: string;
  name: string;
  description?: string;
  startNodeId: string;
  nodes: Record<string, FlowNode>;
}

export type FlowsMap = Record<string, Flow>;

const n = (
  id: string,
  type: FlowNodeType,
  name: string,
  text: string,
  extra: Partial<FlowNode> = {},
): FlowNode => ({ id, type, name, text, ...extra });

/** Lead-magnet flow: greet → menu → collect name/phone → create lead, or "other question" AI branch. */
function leadFlow(): Flow {
  const nodes: Record<string, FlowNode> = {
    n1: n('n1', 'msg', 'Приветствие', 'Здравствуйте, {{first_name}}! Я помогу подобрать формат работы и записать вас к специалисту.', { nextNodeId: 'n2' }),
    n2: n('n2', 'buttons', 'Главное меню', 'Выберите, что вам нужно:', {
      options: [
        { id: 'o1', label: 'Оставить заявку', nextNodeId: 'n3' },
        { id: 'o2', label: 'Записаться', nextNodeId: 'n7' },
        { id: 'o3', label: 'Другой вопрос', nextNodeId: 'n8' },
      ],
      childIds: ['n3', 'n7', 'n8'],
    }),
    n3: n('n3', 'ask', 'Вопрос: имя', 'Как к вам обращаться?', { fieldTarget: 'contact.firstName', validation: 'text', nextNodeId: 'n4', childIds: ['n4'] }),
    n4: n('n4', 'ask', 'Вопрос: телефон', 'Оставьте телефон — пришлю прайс и подтверждение.', { fieldTarget: 'contact.phone', validation: 'phone', nextNodeId: 'n5', childIds: ['n5'] }),
    n5: n('n5', 'crm', 'Создать лид', 'Лид в воронке «Входящие Telegram», источник telegram.', { crmAction: 'create_lead', nextNodeId: 'n6', childIds: ['n6'] }),
    n6: n('n6', 'msg', 'Отдать материал', 'Спасибо! Мы получили вашу заявку и скоро свяжемся с вами.'),
    n7: n('n7', 'hook', 'Ветка «Записаться»', 'Переходим к записи на услугу.', { targetFlowId: 'booking' }),
    n8: n('n8', 'ai', 'Ветка «Другой вопрос»', 'Отвечай по базе знаний: услуги, цены, адреса, форматы работы. Если не уверен — вызови escalate_to_human.', { childIds: ['n9'] }),
    n9: n('n9', 'human', 'Передать менеджеру', 'Диалог уходит в инбокс отдела продаж.', { department: 'Продажи', pauseMinutes: 30 }),
  };
  return { id: 'lead', name: 'Лид-магнит', description: 'Приветствие, меню, сбор имени и телефона, отдача материала и создание лида в CRM.', startNodeId: 'n1', nodes };
}

/** Booking flow: greet → service → staff → slot → confirm → create reservation → reminder/prepay. */
function bookingFlow(): Flow {
  const nodes: Record<string, FlowNode> = {
    m1: n('m1', 'msg', 'Приветствие', 'Подберём удобное время. Записываю к специалистам студии.', { nextNodeId: 'm2' }),
    m2: n('m2', 'buttons', 'Выбор услуги', 'Выберите услугу:', { source: 'booking_services', options: [], nextNodeId: undefined, childIds: ['m3'] }),
    m3: n('m3', 'buttons', 'Выбор специалиста', 'Выберите специалиста (или «Любой свободный»):', { source: 'booking_staff', options: [], childIds: ['m4'] }),
    m4: n('m4', 'buttons', 'Свободные слоты', 'Ближайшие свободные окна:', { source: 'booking_slots', options: [], childIds: ['m5'] }),
    m5: n('m5', 'ask', 'Подтверждение', 'Проверьте выбранное время и напишите «да» для подтверждения.', { fieldTarget: 'collected.confirm', validation: 'text', nextNodeId: 'm6', childIds: ['m6'] }),
    m6: n('m6', 'crm', 'Создать бронь', 'Резервация в CRM, источник telegram.', { crmAction: 'create_reservation', nextNodeId: 'm7', childIds: ['m7', 'm8'] }),
    m7: n('m7', 'delay', 'Напоминание за 24 часа', 'Напомню вам о записи за сутки.', { afterMinutes: 24 * 60 }),
    m8: n('m8', 'pay', 'Предоплата', 'Для подтверждения брони можно внести предоплату (реквизиты пришлёт администратор).'),
  };
  return { id: 'booking', name: 'Запись на услугу', description: 'Выбор услуги и специалиста, свободные слоты, подтверждение и создание брони.', startNodeId: 'm1', nodes };
}

/** Support flow: AI answers from the knowledge base, escalates on low confidence / stop-words. */
function supportFlow(): Flow {
  const nodes: Record<string, FlowNode> = {
    s1: n('s1', 'msg', 'Приветствие', 'Опишите проблему своими словами — отвечу по базе знаний.', { nextNodeId: 's2' }),
    s2: n('s2', 'ai', 'ИИ-ответ по базе знаний', 'Отвечай по базе знаний. Если не можешь помочь или клиент недоволен — вызови escalate_to_human.', { childIds: ['s3', 's4'] }),
    s3: n('s3', 'crm', 'Функция: статус заявки', 'Бот может проверить статус обращения по номеру телефона (helpdesk.ticket.read).'),
    s4: n('s4', 'human', 'Тикет + менеджер', 'Создаёт тикет и уводит диалог в хэлпдеск.', { department: 'Поддержка', pauseMinutes: 30 }),
  };
  return { id: 'support', name: 'Поддержка с ИИ', description: 'ИИ отвечает по базе знаний, при низкой уверенности эскалирует на менеджера.', startNodeId: 's1', nodes };
}

/** Ops flow: illustrates outbound event notifications + daily digest (not a reply-driven chat). */
function opsFlow(): Flow {
  const nodes: Record<string, FlowNode> = {
    o1: n('o1', 'hook', 'Событие CRM', 'Новый лид, оплата, просроченная задача, отмена брони — уходят через существующие уведомления сотрудникам.'),
    o2: n('o2', 'msg', 'Дневная сводка', 'В 09:00 — лиды, брони и оплаты за прошлый день (включается флагом «Дневная сводка» в Настройках).'),
  };
  return { id: 'ops', name: 'Уведомления команде', description: 'Односторонний канал: события CRM и дневная сводка уходят сотрудникам в личку.', startNodeId: 'o1', nodes };
}

export function buildDefaultFlows(): FlowsMap {
  const flows = [leadFlow(), bookingFlow(), supportFlow(), opsFlow()];
  const map: FlowsMap = {};
  for (const f of flows) map[f.id] = f;
  return map;
}

export const FLOW_NODE_TYPES: FlowNodeType[] = ['msg', 'buttons', 'ask', 'ai', 'cond', 'crm', 'human', 'delay', 'hook', 'pay'];

export function flattenFlow(flow: Flow): FlowNode[] {
  return Object.values(flow.nodes);
}
