// src/sales/sales-import-session.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('sales_import_sessions')
export class SalesImportSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', nullable: true })
  originalFileName: string | null;

  // Полное содержимое файла (CSV) как текст.
  // Для MVP ок, если файлы не гигантские.
  @Column({ type: 'text' })
  rawContent: string;

  // Названия колонок
  @Column({ type: 'text', array: true })
  columns: string[];

  // Пример строк (первые N), чтобы показать в UI
  @Column({ type: 'jsonb', nullable: true })
  sample: Record<string, string>[];

  @Column({ type: 'int', default: 0 })
  totalRows: number;

  // Предложенный маппинг: systemField -> columnName
  @Column({ type: 'jsonb', nullable: true })
  suggestedMapping: Record<string, string | null>;

  @Column({ type: 'varchar', length: 32, default: 'preview' })
  status: 'preview' | 'applied' | 'error';

  @CreateDateColumn()
  createdAt: Date;
}