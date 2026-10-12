import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('demo_requests')
export class DemoRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120 })
  firstName: string;

  @Column({ length: 120 })
  lastName: string;

  @Column({ length: 180 })
  email: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ordersPerMonth: string | null;

  @Column({ length: 32 })
  contactMethod: string;

  // Поля формы /contact (тема, компания, размер команды, сообщение) — добавлены 2026-10-12.
  @Column({ type: 'varchar', length: 32, nullable: true })
  topic: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  company: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  teamSize: string | null;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  utmSource: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  utmMedium: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  utmCampaign: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  utmContent: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  utmTerm: string | null;

  @Column({ length: 32, default: 'new' })
  status: string;

  @Column({ type: 'uuid', nullable: true })
  tenantId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  provisionedAt: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  telegramChatId: string | null;

  @Column({ type: 'int', nullable: true })
  telegramMessageId: number | null;

  @Column({ type: 'bigint', nullable: true })
  telegramUserId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
