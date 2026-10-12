import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ConfigService } from '@nestjs/config'
import { HttpService } from '@nestjs/axios'
import { FormSubmission } from '../forms/form-submission.entity'

@Injectable()
export class CrmService {
  constructor(
    @InjectRepository(FormSubmission) private repo: Repository<FormSubmission>,
    private cfg: ConfigService,
    private http: HttpService,
  ) {}

  async getStatus() {
    const url = this.cfg.get('CRM_API_URL')
    if (!url) return { connected: false, reason: 'CRM_API_URL not configured' }
    try {
      await this.http.axiosRef.get(`${url}/v1/health`, { timeout: 4000 })
      return { connected: true, url }
    } catch (e: any) {
      return { connected: false, url, reason: e.message }
    }
  }

  async pushLead(id: number) {
    const sub = await this.repo.findOne({ where: { id } })
    if (!sub) return { ok: false, error: 'Submission not found' }
    const url = this.cfg.get('CRM_API_URL')
    const token = this.cfg.get('CRM_API_TOKEN')
    if (!url || !token) return { ok: false, error: 'CRM not configured' }
    try {
      const res = await this.http.axiosRef.post(
        `${url}/v1/public/inbound-lead`,
        {
          name: sub.name,
          email: sub.email,
          phone: sub.phone,
          source: sub.source || 'lumiva.agency',
          meta: { company: sub.company, message: sub.message, budget: sub.budget, formType: sub.type },
        },
        { headers: { 'X-Api-Token': token }, timeout: 8000 },
      )
      const crmLeadId = String(res.data?.id || '')
      await this.repo.update(id, { crmLeadId })
      return { ok: true, crmLeadId }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  }
}
