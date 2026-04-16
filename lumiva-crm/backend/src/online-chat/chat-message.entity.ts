// src/online-chat/chat-message.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Index,
} from 'typeorm';
import { ChatSession } from './chat-session.entity';

export type ChatMessageSender = 'visitor' | 'staff' | 'assistant';

export interface ChatAttachment {
  id: string;
  name: string;
  url: string;
}

@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  tenantId: string;

  @Index()
  @Column({ type: 'uuid' })
  sessionId: string;

  @ManyToOne(() => ChatSession, (s) => s.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sessionId' })
  session: ChatSession;

  @Column({ type: 'varchar', length: 16 })
  sender: ChatMessageSender;

  // на будущее: кто из сотрудников писал
  @Column({ type: 'uuid', nullable: true })
  staffUserId: string | null;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'boolean', default: false })
  isInternal: boolean;

  @Column({ type: 'jsonb', nullable: true })
  attachments: ChatAttachment[] | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}