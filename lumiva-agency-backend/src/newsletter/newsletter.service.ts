import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ConfigService } from '@nestjs/config'
import { HttpService } from '@nestjs/axios'
import { NewsletterSubscriber } from './newsletter-subscriber.entity'

@Injectable()
export class NewsletterService {
  constructor(
    @InjectRepository(NewsletterSubscriber)
    private repo: Repository<NewsletterSubscriber>,
    private cfg: ConfigService,
    private http: HttpService,
  ) {}

  async subscribe(email: string, lang: string, source: string, ip: string) {
    if (!email || !email.includes('@')) return { ok: false, error: 'Invalid email' }

    const existing = await this.repo.findOne({ where: { email: email.toLowerCase().trim() } })
    if (existing) {
      if (existing.status === 'unsubscribed') {
        await this.repo.update(existing.id, { status: 'active', lang, source })
        return { ok: true, resubscribed: true }
      }
      return { ok: true, alreadySubscribed: true }
    }

    await this.repo.save(
      this.repo.create({ email: email.toLowerCase().trim(), lang, source, ip, status: 'active' }),
    )

    this.pushToCrm(email, source, ip).catch(() => {})

    return { ok: true }
  }

  private async pushToCrm(email: string, source: string, ip: string) {
    const url = this.cfg.get('CRM_API_URL')
    const token = this.cfg.get('CRM_API_TOKEN')
    if (!url || !token) return
    await this.http.axiosRef.post(
      `${url}/v1/public/inbound-lead`,
      {
        email,
        source: source || 'newsletter',
        meta: { formType: 'newsletter', ip },
      },
      { headers: { 'X-Api-Token': token }, timeout: 5000 },
    )
  }

  async unsubscribe(email: string) {
    if (!email) return { ok: false }
    await this.repo.update({ email: email.toLowerCase().trim() }, { status: 'unsubscribed' })
    return { ok: true }
  }

  async findAll(query: any) {
    const { status, lang, page = 1, limit = 50 } = query
    const where: any = {}
    if (status) where.status = status
    if (lang) where.lang = lang
    const [items, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * +limit,
      take: +limit,
    })
    return { items, total, page: +page, limit: +limit }
  }

  async getStats() {
    const total = await this.repo.count()
    const active = await this.repo.count({ where: { status: 'active' } })
    const byLang = await this.repo
      .createQueryBuilder('s')
      .select('s.lang', 'lang')
      .addSelect('COUNT(*)', 'count')
      .where('s.status = :status', { status: 'active' })
      .groupBy('s.lang')
      .getRawMany()
    return { total, active, unsubscribed: total - active, byLang }
  }

  async exportCsv(lang?: string) {
    const where: any = { status: 'active' }
    if (lang) where.lang = lang
    return this.repo.find({ where, order: { createdAt: 'DESC' } })
  }
}
