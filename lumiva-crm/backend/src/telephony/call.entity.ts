// src/telephony/call.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export type CallDirection = 'inbound' | 'outbound';
export type CallStatus = 'queued' | 'ringing' | 'in-progress' | 'completed' | 'no-answer' | 'busy' | 'failed' | 'canceled';
export type TranscriptStatus = 'pending' | 'done' | 'failed';
export type CallSentiment = 'positive' | 'neutral' | 'negative';
export type CallTopic = 'pricing' | 'scheduling' | 'service_quality' | 'technical_issue' | 'wait_time' | 'other';
export type SentimentStatus = 'pending' | 'done' | 'failed';
export type CallSource = 'twilio' | 'upload';
export type CallAnalysisStatus = 'transcribing' | 'analyzing' | 'done' | 'failed';

/** Полный AI-разбор звонка. Все тексты — на языке интерфейса тенанта. */
export interface CallAiAnalysis {
  summary: string;
  /** Конкретные договорённости и следующие шаги; dueInDays — если в разговоре прозвучал срок. */
  nextSteps: { text: string; dueInDays: number | null }[];
  /** Возражения и сомнения клиента, дословно по смыслу. */
  objections: string[];
  /** Насколько клиент готов купить по итогам разговора. */
  clientIntent: 'hot' | 'warm' | 'cold';
  /** Оценка работы менеджера 0–100 (выявление потребности, ответы на возражения, договорённость о шаге). */
  managerScore: number;
  strengths: string[];
  improvements: string[];
  /** Язык разговора (ISO 639-1), как его определил Whisper. */
  language: string | null;
}

@Entity('calls')
@Index(['tenantId', 'createdAt'])
@Index(['tenantId', 'twilioCallSid'])
@Index(['tenantId', 'linkedLeadId'])
export class Call {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 16 })
  direction: CallDirection;

  @Column({ type: 'varchar', length: 32, nullable: true })
  fromNumber: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  toNumber: string | null;

  @Column({ type: 'varchar', length: 24, default: 'queued' })
  status: CallStatus;

  @Column({ type: 'int', nullable: true })
  durationSeconds: number | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  twilioCallSid: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  recordingSid: string | null;

  /** Our own proxy path (not Twilio's raw URL — that needs Twilio auth to fetch) */
  @Column({ type: 'text', nullable: true })
  recordingUrl: string | null;

  @Column({ type: 'text', nullable: true })
  transcript: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  transcriptStatus: TranscriptStatus | null;

  /** AI classification of the transcript (same AiOpenAiService as transcription — inherits its
   * insufficient_quota outage caveat). Null until a transcript exists to analyze. */
  @Column({ type: 'varchar', length: 16, nullable: true })
  sentiment: CallSentiment | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  sentimentTopic: CallTopic | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  sentimentStatus: SentimentStatus | null;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  tags: string[];

  @Column({ type: 'uuid', nullable: true })
  linkedLeadId: string | null;

  @Column({ type: 'uuid', nullable: true })
  staffUserId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  endedAt: Date | null;

  /** twilio — звонок через интеграцию; upload — запись загружена вручную в карточку лида. */
  @Column({ type: 'varchar', length: 16, default: 'twilio' })
  source: CallSource;

  /** Путь к загруженной записи относительно uploads-root (только для source='upload'). */
  @Column({ type: 'text', nullable: true })
  recordingPath: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  originalFilename: string | null;

  @Column({ type: 'jsonb', nullable: true })
  aiAnalysis: CallAiAnalysis | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  analysisStatus: CallAnalysisStatus | null;

  @Column({ type: 'text', nullable: true })
  analysisError: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  analyzedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  uploadedByStaffId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
