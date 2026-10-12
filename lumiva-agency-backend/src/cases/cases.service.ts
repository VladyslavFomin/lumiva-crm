import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Case } from './case.entity'

const TRANSLATABLE_FIELDS = [
  'industry', 'shortResult', 'segment', 'markets', 'duration', 'teamSize',
  'leadText', 'coverCaption', 'coverRibbon', 'beforeText', 'beforeDescription',
  'afterDescription', 'lineChartTitle', 'lineChartValue', 'lineChartDelta', 'nextCaseTitle',
  'seoTitle', 'seoDescription', 'services', 'tags', 'kpis', 'chapters',
  'testimonials', 'challenges', 'approachItems', 'timeline', 'colors',
  'deliverables', 'funnelData', 'nextCaseMeta',
]

function applyLang(item: Case, lang: string): Case {
  if (!lang || lang === 'ru') return item
  const tr: Record<string, any> = item.translations?.[lang] ?? {}
  const result: any = { ...item }
  for (const field of TRANSLATABLE_FIELDS) {
    const value = tr[field]
    const hasValue = Array.isArray(value) ? value.length > 0 : !!value
    if (hasValue) result[field] = value
  }
  return result
}

@Injectable()
export class CasesService {
  constructor(@InjectRepository(Case) private repo: Repository<Case>) {}

  async findAll(query: any) {
    const { status, industry, featured, lang, page = 1, limit = 20 } = query
    const where: any = {}
    if (status) where.status = status
    if (industry) where.industry = industry
    if (featured !== undefined) where.featured = featured === 'true'
    const [items, total] = await this.repo.findAndCount({
      where,
      order: { year: 'DESC', createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: +limit,
    })
    const filtered = lang && lang !== 'ru'
      ? items.filter(item => Array.isArray(item.langs) && item.langs.includes(lang))
      : items
    const localized = filtered.map(item => applyLang(item, lang))
    return { items: localized, total: localized.length, page: +page, limit: +limit }
  }

  async findFeatured(lang?: string) {
    const items = await this.repo.find({ where: { status: 'published', featured: true }, order: { year: 'DESC' } })
    const filtered = lang && lang !== 'ru'
      ? items.filter(item => Array.isArray(item.langs) && item.langs.includes(lang))
      : items
    return filtered.map(item => applyLang(item, lang || 'ru'))
  }

  async findById(id: number) {
    const item = await this.repo.findOne({ where: { id } })
    if (!item) throw new NotFoundException('Case not found')
    return item
  }

  async findBySlug(slug: string, lang?: string) {
    const item = await this.repo.findOne({ where: { slug } })
    if (!item) throw new NotFoundException('Case not found')
    return applyLang(item, lang || 'ru')
  }

  async create(data: Partial<Case>) {
    if (!data.slug && data.clientName) {
      data.slug = data.clientName.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-').replace(/(^-|-$)/g, '')
    }
    return this.repo.save(this.repo.create(data))
  }

  async update(id: number, data: Partial<Case>) {
    const item = await this.repo.findOne({ where: { id } })
    if (!item) throw new NotFoundException()
    return this.repo.save({ ...item, ...data })
  }

  async remove(id: number) {
    await this.repo.delete(id)
    return { ok: true }
  }

  async getStats() {
    const total = await this.repo.count()
    const published = await this.repo.count({ where: { status: 'published' } })
    return { total, published }
  }
}
