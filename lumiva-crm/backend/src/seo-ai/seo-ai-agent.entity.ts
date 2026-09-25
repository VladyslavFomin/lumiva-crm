import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * ИИ-SEO-ассистент сайта: кому и когда шлёт еженедельный отчёт, какие запросы отслеживает.
 * Свой на каждый сайт тенанта (сайт выбирается переключателем «Ресурс» на странице SEO).
 */
@Entity('seo_ai_agents')
@Index(['tenantId', 'siteHost'], { unique: true })
export class SeoAiAgent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  /** Еженедельный отчёт включён. Ручной запуск работает и без этого. */
  @Column({ type: 'boolean', default: false })
  enabled: boolean;

  /** Домен без www — ключ ассистента внутри тенанта. */
  @Column({ type: 'varchar', length: 255 })
  siteHost: string;

  @Column({ type: 'text', nullable: true })
  siteUrl: string | null;

  /** Доп. страницы, за которыми следить (кроме главной и топ-страниц из Search Console). */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  pages: string[];

  /** Целевые запросы — ассистент отслеживает по ним позиции неделя к неделе. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  keywords: string[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  recipients: string[];

  /** 0 = воскресенье … 6 = суббота (как Date.getDay). */
  @Column({ type: 'int', default: 1 })
  weekday: number;

  @Column({ type: 'int', default: 9 })
  hour: number;

  @Column({ type: 'varchar', length: 64, default: 'Europe/Istanbul' })
  timezone: string;

  /** Язык отчёта: ru | en | tr. */
  @Column({ type: 'varchar', length: 8, default: 'ru' })
  language: string;

  /** Контекст бизнеса для ИИ: ниша, регион, аудитория, приоритеты. */
  @Column({ type: 'text', nullable: true })
  focus: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastRunAt: Date | null;

  /** Превращать приоритетные рекомендации отчёта в задачи (через действия ИИ-сотрудника). */
  @Column({ type: 'boolean', default: true })
  tasksEnabled: boolean;

  /** Проект, куда падают SEO-задачи; пусто — создаётся «SEO · сайт» при первой задаче. */
  @Column({ type: 'uuid', nullable: true })
  taskProjectId: string | null;

  /** Ответственный (StaffUser id) для SEO-задач. */
  @Column({ type: 'uuid', nullable: true })
  taskAssigneeId: string | null;

  /** Сигналы о проблемах: уведомление + письмо + срочная задача. */
  @Column({ type: 'boolean', default: true })
  alertsEnabled: boolean;

  /** Отпечаток рекомендации → когда по ней ставилась задача (не дублировать 30 дней). */
  @Column({ type: 'jsonb', default: () => "'{}'" })
  taskLog: Record<string, string>;

  /** Ключ сигнала → когда о нём сообщили (повтор не раньше чем через 7 дней, пока проблема есть). */
  @Column({ type: 'jsonb', default: () => "'{}'" })
  alertState: Record<string, string>;

  /** Последняя ежедневная лёгкая проверка (без ИИ). */
  @Column({ type: 'timestamptz', nullable: true })
  lastCheckAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
