import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, Between, MoreThanOrEqual } from 'typeorm'
import { ConfigService } from '@nestjs/config'
import { HttpService } from '@nestjs/axios'
import * as nodemailer from 'nodemailer'
import { FormSubmission } from './form-submission.entity'
import { NewsletterService } from '../newsletter/newsletter.service'

@Injectable()
export class FormsService {
  private transporter: any

  constructor(
    @InjectRepository(FormSubmission) private repo: Repository<FormSubmission>,
    private cfg: ConfigService,
    private http: HttpService,
    private newsletterService: NewsletterService,
  ) {
    this.transporter = nodemailer.createTransport({
      host: cfg.get('SMTP_HOST'),
      port: +cfg.get('SMTP_PORT', '465'),
      secure: cfg.get('SMTP_SECURE') === 'true',
      auth: { user: cfg.get('SMTP_USER'), pass: cfg.get('SMTP_PASS') },
    })
  }

  async submit(data: Partial<FormSubmission>, ip: string, userAgent: string) {
    const sub = await this.repo.save(this.repo.create({ ...data, ip, userAgent, status: 'new' }))
    this.sendNotification(sub).catch(() => {})
    this.pushToCrm(sub).catch(() => {})
    this.triggerN8n(sub).catch(() => {})
    if (sub.type === 'newsletter' && sub.email) {
      this.newsletterService.subscribe(sub.email, (data as any).lang || 'en', sub.source || 'web', ip).catch(() => {})
    }
    return { ok: true, id: sub.id }
  }

  private async sendNotification(sub: FormSubmission) {
    const to = this.cfg.get('NOTIFY_EMAIL')
    if (!to) return
    await this.transporter.sendMail({
      from: this.cfg.get('MAIL_FROM'),
      to,
      subject: `[Lumiva] Новая заявка: ${sub.type} от ${sub.name || sub.email}`,
      html: `
        <h2>Новая заявка с сайта</h2>
        <p><b>Тип:</b> ${sub.type}</p>
        <p><b>Имя:</b> ${sub.name || '—'}</p>
        <p><b>Email:</b> ${sub.email || '—'}</p>
        <p><b>Телефон:</b> ${sub.phone || '—'}</p>
        <p><b>Компания:</b> ${sub.company || '—'}</p>
        <p><b>Бюджет:</b> ${sub.budget || '—'}</p>
        <p><b>Сообщение:</b> ${sub.message || '—'}</p>
        <p><b>Источник:</b> ${sub.source || '—'}</p>
        <p><b>Детали источника:</b><br>${(sub.notes || '—').replace(/\n/g, '<br>')}</p>
        <hr>
        <a href="https://pl2.lumiva.agency/forms">Открыть в админке</a>
      `,
    })
  }

  private async pushToCrm(sub: FormSubmission) {
    const url = this.cfg.get('CRM_API_URL')
    const token = this.cfg.get('CRM_API_TOKEN')
    if (!url || !token) return
    try {
      const res = await this.http.axiosRef.post(
        `${url}/v1/public/inbound-lead`,
        {
          name: sub.name,
          email: sub.email,
          phone: sub.phone,
          source: sub.source || 'lumiva.agency',
          meta: {
            company: sub.company,
            message: sub.message,
            budget: sub.budget,
            sourceDetails: sub.notes,
            formType: sub.type,
          },
        },
        { headers: { 'X-Api-Token': token }, timeout: 5000 },
      )
      await this.repo.update(sub.id, { crmLeadId: String(res.data?.id || '') })
    } catch {}
  }

  private async triggerN8n(sub: FormSubmission) {
    const url = this.cfg.get('N8N_WEBHOOK_URL')
    if (!url || this.cfg.get('N8N_ENABLED') !== 'true') return
    await this.http.axiosRef.post(url, sub, { timeout: 5000 }).catch(() => {})
  }

  async findAll(query: any) {
    const { type, status, page = 1, limit = 30, from, to } = query
    const where: any = {}
    if (type) where.type = type
    if (status) where.status = status
    if (from && to) where.createdAt = Between(new Date(from), new Date(to))
    else if (from) where.createdAt = MoreThanOrEqual(new Date(from))
    const [items, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: +limit,
    })
    return { items, total, page: +page, limit: +limit }
  }

  async getStats(days = 30) {
    const since = new Date()
    since.setDate(since.getDate() - days)
    const all = await this.repo.find({ where: { createdAt: MoreThanOrEqual(since) }, order: { createdAt: 'ASC' } })
    const byType: Record<string, number> = {}
    const byStatus: Record<string, number> = {}
    const byDay: Record<string, number> = {}
    for (const s of all) {
      byType[s.type] = (byType[s.type] || 0) + 1
      byStatus[s.status] = (byStatus[s.status] || 0) + 1
      const day = s.createdAt.toISOString().slice(0, 10)
      byDay[day] = (byDay[day] || 0) + 1
    }
    return { total: all.length, byType, byStatus, byDay }
  }

  async update(id: number, data: Partial<FormSubmission>) {
    await this.repo.update(id, data)
    return this.repo.findOne({ where: { id } })
  }

  async remove(id: number) {
    await this.repo.delete(id)
    return { ok: true }
  }

  async pushLeadToCrm(id: number) {
    const sub = await this.repo.findOne({ where: { id } })
    if (!sub) return { ok: false, error: 'Not found' }
    await this.pushToCrm(sub)
    return { ok: true, crmLeadId: sub.crmLeadId }
  }

  async getFormStats() {
    const total = await this.repo.count()
    const newCount = await this.repo.count({ where: { status: 'new' } })
    const since24h = new Date(); since24h.setHours(since24h.getHours() - 24)
    const last24h = await this.repo.count({ where: { createdAt: MoreThanOrEqual(since24h) } })
    return { total, newCount, last24h }
  }
}
