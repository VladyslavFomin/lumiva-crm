import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('ai_chat_messages')
@Index(['sessionId', 'createdAt'])
export class AiChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  sessionId: string;

  @Column({ type: 'varchar', length: 16 })
  role: 'user' | 'assistant' | 'system' | 'tool';

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  toolName: string | null;

  @Column({ type: 'text', nullable: true })
  toolCallId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  toolCalls: unknown[] | null;

  @Column({ type: 'jsonb', nullable: true })
  meta: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
