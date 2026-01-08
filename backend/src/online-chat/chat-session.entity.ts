// src/online-chat/chat-session.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ChatMessage } from './chat-message.entity';

export type ChatSessionStatus = 'open' | 'closed';

@Entity('chat_sessions')
export class ChatSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 255 })
  siteHost: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  visitorName: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  visitorEmail: string | null;

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

  @Index()
  @Column({ type: 'varchar', length: 16, default: 'open' })
  status: ChatSessionStatus;

  @Index()
  @Column({ type: 'timestamptz', nullable: true })
  lastMessageAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => ChatMessage, (m) => m.session)
  messages: ChatMessage[];
}
