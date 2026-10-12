import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm'

@Entity('blog_posts')
export class BlogPost {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ unique: true })
  slug: string

  @Column()
  title: string

  @Column({ type: 'text', nullable: true })
  excerpt: string

  @Column({ type: 'text', nullable: true })
  content: string

  @Column({ nullable: true })
  coverUrl: string

  @Column({ nullable: true })
  author: string

  @Column({ type: 'simple-array', nullable: true })
  tags: string[]

  @Column({ nullable: true })
  category: string

  @Column({ nullable: true })
  seoTitle: string

  @Column({ type: 'text', nullable: true })
  seoDescription: string

  @Column({ type: 'jsonb', nullable: true })
  blocks: any[] | null

  @Column({ type: 'jsonb', nullable: true })
  translations: Record<string, { title?: string; excerpt?: string; content?: string; blocks?: any[]; seoTitle?: string; seoDescription?: string; coverUrl?: string }> | null

  @Column({ type: 'simple-array', nullable: true })
  langs: string[]

  // На каких сайтах публикуется статья: 'agency' (lumiva.agency) и/или 'crm' (crm.lumiva.agency).
  // NULL у старых статей = только 'agency'.
  @Column({ type: 'simple-array', nullable: true })
  sites: string[] | null

  @Column({ default: 'draft' })
  status: string // draft | published | archived

  @Column({ nullable: true })
  publishedAt: Date

  @Column({ default: 0 })
  viewCount: number

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
