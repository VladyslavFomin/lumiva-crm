import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Видео/gif к подсказкам — общие для всей платформы (не по тенантам), заполняются в pl1 → «Контент».
 * stepId = '_page' — видео-гайд всей страницы (окно «?»), иначе id шага тура из tour-steps.ts.
 */
@Entity('help_media')
@Index(['topic', 'stepId'], { unique: true })
export class HelpMedia {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64 })
  topic: string;

  @Column({ type: 'varchar', length: 64 })
  stepId: string;

  /** 'video' | 'gif' */
  @Column({ type: 'varchar', length: 16 })
  kind: string;

  @Column({ type: 'text' })
  url: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
