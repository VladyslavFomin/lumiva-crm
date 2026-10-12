import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Setting } from './setting.entity'

@Injectable()
export class SettingsService {
  constructor(@InjectRepository(Setting) private repo: Repository<Setting>) {}

  async findAll(): Promise<Setting[]> {
    return this.repo.find({ order: { group: 'ASC', key: 'ASC' } })
  }

  async get(key: string): Promise<string | null> {
    const s = await this.repo.findOne({ where: { key } })
    return s?.value ?? null
  }

  async set(key: string, value: string, label?: string, group?: string): Promise<Setting> {
    let s = await this.repo.findOne({ where: { key } })
    if (s) {
      s.value = value
      if (label !== undefined) s.label = label
      if (group !== undefined) s.group = group
    } else {
      s = this.repo.create({ key, value, label, group })
    }
    return this.repo.save(s)
  }

  async bulkSet(entries: { key: string; value: string; label?: string; group?: string }[]): Promise<Setting[]> {
    return Promise.all(entries.map(e => this.set(e.key, e.value, e.label, e.group)))
  }

  async remove(key: string): Promise<{ ok: boolean }> {
    await this.repo.delete({ key })
    return { ok: true }
  }
}
