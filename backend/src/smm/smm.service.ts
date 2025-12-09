// src/smm/smm.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { SmmProfile, SmmPlatform } from './smm-profile.entity';
import { SmmProfileStat } from './smm-profile-stat.entity';

export interface ImportSmmStatItem {
  platform: SmmPlatform;
  handle: string;
  url?: string;

  // YYYY-MM-DD (UTC)
  date: string;

  followers?: number;
  following?: number;
  posts?: number;

  impressions?: number;
  reach?: number;
  profileViews?: number;
  clicks?: number;
  likes?: number;
  comments?: number;
  saves?: number;
  videoViews?: number;

  extra?: Record<string, any>;
}

@Injectable()
export class SmmService {
  constructor(
    @InjectRepository(SmmProfile)
    private readonly profilesRepo: Repository<SmmProfile>,
    @InjectRepository(SmmProfileStat)
    private readonly statsRepo: Repository<SmmProfileStat>,
  ) {}

  // ===== ПРОФИЛИ =====

  async listProfilesWithLastStat(tenantId: string) {
    const profiles = await this.profilesRepo.find({
      where: { tenantId },
      order: { createdAt: 'ASC' },
    });

    if (!profiles.length) return [];

    const ids = profiles.map((p) => p.id);

    const stats = await this.statsRepo
      .createQueryBuilder('s')
      .where('s.tenantId = :tenantId', { tenantId })
      .andWhere('s.profileId IN (:...ids)', { ids })
      .orderBy('s.date', 'DESC')
      .getMany();

    const byProfile = new Map<string, SmmProfileStat>();
    for (const s of stats) {
      if (!byProfile.has(s.profileId)) {
        byProfile.set(s.profileId, s);
      }
    }

    return profiles.map((p) => ({
      ...p,
      lastStat: byProfile.get(p.id) || null,
    }));
  }

  async createProfile(
    tenantId: string,
    payload: {
      platform: SmmPlatform;
      handle: string;
      url?: string;
      note?: string;
    },
  ) {
    const platform = payload.platform;
    const handle = payload.handle.trim();

    if (!handle) {
      throw new Error('Handle is required');
    }

    const existing = await this.profilesRepo.findOne({
      where: { tenantId, platform, handle },
    });
    if (existing) return existing;

    const profile = this.profilesRepo.create({
      tenantId,
      platform,
      handle,
      url: payload.url || null,
      isActive: true,
      meta: payload.note ? { note: payload.note } : null,
    });

    return this.profilesRepo.save(profile);
  }

  async deleteProfile(tenantId: string, id: string) {
    await this.profilesRepo.delete({ tenantId, id });
  }

  // ===== СТАТИСТИКА =====

  async getStatsForTenant(
    tenantId: string,
    from?: string,
    to?: string,
  ) {
    const where: any = { tenantId };

    if (from && to) {
      where.date = Between(from, to);
    } else if (from) {
      where.date = Between(from, from);
    } else if (to) {
      where.date = Between(to, to);
    }

    return this.statsRepo.find({
      where,
      order: { date: 'ASC' },
    });
  }

  async importStats(tenantId: string, items: ImportSmmStatItem[]) {
    for (const raw of items) {
      const platform: SmmPlatform = raw.platform || 'other';
      const handle = raw.handle.trim();
      const date = raw.date;

      if (!handle || !date) {
        // пропускаем битые строки
        continue;
      }

      // 1) профиль (автосоздание)
      let profile = await this.profilesRepo.findOne({
        where: { tenantId, platform, handle },
      });

      if (!profile) {
        profile = this.profilesRepo.create({
          tenantId,
          platform,
          handle,
          url: raw.url || null,
          isActive: true,
        });
        profile = await this.profilesRepo.save(profile);
      } else if (!profile.url && raw.url) {
        profile.url = raw.url;
        await this.profilesRepo.save(profile);
      }

      // 2) статы на дату
      const existing = await this.statsRepo.findOne({
        where: {
          tenantId,
          profileId: profile.id,
          date,
        },
      });

      const base: Partial<SmmProfileStat> = {
        tenantId,
        profileId: profile.id,
        date,

        followers: raw.followers ?? 0,
        following: raw.following ?? 0,
        posts: raw.posts ?? 0,

        impressions: raw.impressions ?? 0,
        reach: raw.reach ?? 0,
        profileViews: raw.profileViews ?? 0,
        clicks: raw.clicks ?? 0,
        likes: raw.likes ?? 0,
        comments: raw.comments ?? 0,
        saves: raw.saves ?? 0,
        videoViews: raw.videoViews ?? 0,
        extra: raw.extra ?? null,
      };

      if (existing) {
        await this.statsRepo.save({ ...existing, ...base });
      } else {
        const row = this.statsRepo.create(base as SmmProfileStat);
        await this.statsRepo.save(row);
      }
    }
  }
}