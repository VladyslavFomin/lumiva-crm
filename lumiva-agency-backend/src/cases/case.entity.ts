import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm'

@Entity('cases')
export class Case {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ unique: true })
  slug: string

  @Column()
  clientName: string

  @Column({ nullable: true })
  industry: string

  @Column({ type: 'simple-array', nullable: true })
  services: string[]

  @Column({ nullable: true })
  shortResult: string

  @Column({ nullable: true })
  resultValue: string

  @Column({ nullable: true })
  resultUnit: string

  @Column({ nullable: true })
  coverUrl: string

  @Column({ type: 'simple-array', nullable: true })
  galleryUrls: string[]

  @Column({ type: 'text', nullable: true })
  challenge: string

  @Column({ type: 'text', nullable: true })
  solution: string

  @Column({ type: 'text', nullable: true })
  outcome: string

  @Column({ type: 'simple-array', nullable: true })
  tags: string[]

  @Column({ nullable: true })
  year: number

  @Column({ default: false })
  featured: boolean

  @Column({ nullable: true })
  seoTitle: string

  @Column({ type: 'text', nullable: true })
  seoDescription: string

  @Column({ default: 'draft' })
  status: string // draft | published

  // ── Extended case study fields ──────────────────────────────────────────
  @Column({ nullable: true })
  segment: string // "Private banking · HNWI"

  @Column({ nullable: true })
  markets: string // "Швеция, Норвегия, СНГ"

  @Column({ nullable: true })
  duration: string // "19 недель"

  @Column({ nullable: true })
  teamSize: string // "9 человек"

  @Column({ type: 'text', nullable: true })
  leadText: string // hero lead paragraph

  @Column({ nullable: true })
  coverWatermark: string // "N/W" decorative text

  @Column({ nullable: true })
  coverCaption: string // bottom right caption in cover

  @Column({ nullable: true })
  coverRibbon: string // ribbon label text

  @Column({ type: 'jsonb', nullable: true })
  kpis: any[] // [{value, prefix, suffix, label, source}]

  @Column({ type: 'jsonb', nullable: true })
  chapters: any[] // [{id, num, title, lead}]

  @Column({ type: 'jsonb', nullable: true })
  testimonials: any[] // [{quote, authorName, authorRole, authorInitials}]

  @Column({ type: 'jsonb', nullable: true })
  challenges: any[] // [{index, category, title, body}]

  @Column({ type: 'jsonb', nullable: true })
  approachItems: any[] // [{num, title, body}]

  @Column({ type: 'jsonb', nullable: true })
  timeline: any[] // [{week, phase, description}]

  @Column({ type: 'jsonb', nullable: true })
  colors: any[] // [{hex, label, dark}]

  @Column({ nullable: true })
  primaryFont: string

  @Column({ nullable: true })
  bodyFont: string

  @Column({ nullable: true })
  wordmark: string

  @Column({ nullable: true })
  cardNumber: string

  @Column({ nullable: true })
  beforeText: string

  @Column({ nullable: true })
  beforeDescription: string

  @Column({ nullable: true })
  afterDescription: string

  @Column({ type: 'jsonb', nullable: true })
  deliverables: any[] // [{name, category}]

  @Column({ type: 'jsonb', nullable: true })
  funnelData: any[] // [{name, width, label}]

  @Column({ nullable: true })
  lineChartTitle: string

  @Column({ nullable: true })
  lineChartValue: string

  @Column({ nullable: true })
  lineChartDelta: string

  @Column({ nullable: true })
  nextCaseSlug: string

  @Column({ nullable: true })
  nextCaseTitle: string

  @Column({ type: 'jsonb', nullable: true })
  nextCaseMeta: any[] // [{label, value}]

  @Column({ nullable: true })
  nextCaseDeco: string // decorative letter

  @Column({ type: 'jsonb', nullable: true })
  settings: any // section + identity block visibility toggles

  @Column({ type: 'text', nullable: true })
  customHtml: string // raw HTML injected into case page

  @Column({ type: 'text', nullable: true })
  customCss: string // raw CSS injected into case page

  @Column({ type: 'jsonb', nullable: true })
  translations: Record<string, Record<string, any>> | null

  @Column({ type: 'simple-array', nullable: true })
  langs: string[]

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
