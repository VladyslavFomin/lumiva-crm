import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** База знаний компании для ИИ-сотрудников: то, на чём они отвечают клиентам вместо выдумывания. */
@Entity('ai_knowledge_items')
@Index('IDX_ai_knowledge_tenant', ['tenantId', 'enabled'])
export class AiKnowledgeItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  tags: string[];

  /** Всегда попадает в промпт (правила, тон, цены-основа) — независимо от темы запроса. */
  @Column({ name: 'always_on', type: 'boolean', default: false })
  alwaysOn: boolean;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
