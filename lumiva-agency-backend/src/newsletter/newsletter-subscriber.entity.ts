import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm'

@Entity('newsletter_subscribers')
export class NewsletterSubscriber {
  @PrimaryGeneratedColumn()
  id: number

  @Index({ unique: true })
  @Column({ unique: true })
  email: string

  @Column({ nullable: true })
  lang: string // 'ru' | 'en' | 'tr'

  @Column({ default: 'web' })
  source: string // 'blog' | 'landing' | 'footer' | etc.

  @Column({ default: 'active' })
  status: string // 'active' | 'unsubscribed'

  @Column({ nullable: true })
  ip: string

  @CreateDateColumn()
  createdAt: Date
}
