import type { CallTopic } from '../../api/telephony';

export const SENTIMENT_LABEL: Record<string, string> = {
  positive: 'Позитивный тон', neutral: 'Нейтральный тон', negative: 'Клиент недоволен',
};

export const SENTIMENT_CLASS: Record<string, string> = { positive: 'ok', neutral: 'warn', negative: 'bad' };

export const TOPIC_LABEL: Record<CallTopic, string> = {
  pricing: 'Цена', scheduling: 'Расписание/перенос', service_quality: 'Качество обслуживания',
  technical_issue: 'Техническая проблема', wait_time: 'Долгое ожидание', other: 'Другое',
};
