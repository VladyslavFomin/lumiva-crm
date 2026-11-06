import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * «Кто может просматривать этот столбец» для встроенных таблиц CRM (Лиды, Проекты).
 * Одна строка = одна ограниченная колонка; нет строки — колонку видят все, как раньше.
 * Рабочие таблицы (custom objects) хранят то же самое в field.meta.viewers.
 */
@Entity('table_column_restrictions')
@Index(['tenantId', 'tableKey', 'columnId'], { unique: true })
export class TableColumnRestriction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  /** 'leads' | 'projects' */
  @Column({ type: 'varchar', length: 32 })
  tableKey!: string;

  /** id колонки как во фронтенде: 'amount', 'utmSource', 'cf:<customFieldId>' … */
  @Column({ type: 'varchar', length: 160 })
  columnId!: string;

  /** staff_users.id, которым колонка видна (владелец компании видит всегда). */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  viewerStaffIds!: string[];

  @Column({ type: 'uuid', nullable: true })
  updatedByUserId!: string | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
