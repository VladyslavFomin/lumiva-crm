import type { TFunction } from 'i18next';
import type { CallTopic } from '../../api/telephony';

export const SENTIMENT_CLASS: Record<string, string> = { positive: 'ok', neutral: 'warn', negative: 'bad' };

export const sentimentLabel = (t: TFunction, sentiment: string): string => t(`crm.telephony.sentiment.${sentiment}`);

export const topicLabel = (t: TFunction, topic: CallTopic): string => t(`crm.telephony.topic.${topic}`);
