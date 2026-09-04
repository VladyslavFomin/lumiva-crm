import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Lead } from '../leads/lead.entity';
import { LeadActivity } from '../leads/lead-activity.entity';
import { StaffUser } from '../staff/staff-user.entity';

export type ProfileCompletionStepId =
  | 'display_name'
  | 'phone'
  | 'avatar'
  | 'first_lead'
  | 'team_invited';

export interface DashboardHomeDto {
  profileCompletion: {
    percent: number;
    steps: { id: ProfileCompletionStepId; done: boolean }[];
  };
  /** Последние события по лидам (вся команда тенанта) — для блока «Активность» */
  leadActivityStream: {
    id: string;
    createdAt: string;
    type: string;
    leadId: string;
    leadName: string | null;
    summary: string | null;
  }[];
  /** Slugs записей блога для блока «Учитесь» (порядок) */
  learnSlugs: string[];
  /** Кол-во встреч сегодня (из leadMeetings) */
  todayMeetingsCount: number;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(Lead)
    private readonly leadsRepo: Repository<Lead>,
    @InjectRepository(LeadActivity)
    private readonly leadActivityRepo: Repository<LeadActivity>,
    @InjectRepository(StaffUser)
    private readonly staffRepo: Repository<StaffUser>,
  ) {}

  async getHome(tenantId: string, userId: string): Promise<DashboardHomeDto> {
    const user = await this.usersRepo.findOne({ where: { id: userId, tenantId } });
    if (!user) {
      return {
        profileCompletion: { percent: 0, steps: [] },
        leadActivityStream: [],
        learnSlugs: defaultLearnSlugs(),
        todayMeetingsCount: 0,
      };
    }

    const [leadCount, staffCount] = await Promise.all([
      this.leadsRepo.count({ where: { tenantId } }),
      this.staffRepo.count({ where: { tenantId } }),
    ]);

    const nameOk = !!user.name?.trim();
    const phoneOk = !!user.phone?.trim();
    const avatarOk = !!user.avatarUrl?.trim();
    const firstLeadOk = leadCount > 0;
    // Team is considered "invited" when there are at least 2 active staff members
    const teamInvitedOk = staffCount >= 2;

    const steps: { id: ProfileCompletionStepId; done: boolean }[] = [
      { id: 'display_name', done: nameOk },
      { id: 'phone', done: phoneOk },
      { id: 'avatar', done: avatarOk },
      { id: 'first_lead', done: firstLeadOk },
      { id: 'team_invited', done: teamInvitedOk },
    ];
    const doneN = steps.filter((s) => s.done).length;
    const percent = Math.round((doneN / steps.length) * 100);

    const activities = await this.leadActivityRepo.find({
      where: { tenantId },
      relations: ['lead'],
      order: { createdAt: 'DESC' },
      take: 20,
    });

    const leadActivityStream = activities.map((a) => ({
      id: a.id,
      createdAt: a.createdAt.toISOString(),
      type: a.type,
      leadId: a.leadId,
      leadName: a.lead?.name?.trim() || null,
      summary: activitySummary(a),
    }));

    // Встречи хранятся в Lead.meta.meetings[] (см. calendar.service.ts), а не в lead_activity —
    // там нет и никогда не было типа 'meeting' (LeadActivityType этого не поддерживает), поэтому
    // прежний запрос по lead_activity всегда возвращал 0 независимо от реальных встреч.
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const leadsWithMeetings = await this.leadsRepo
      .createQueryBuilder('l')
      .where('l.tenantId = :tenantId', { tenantId })
      .andWhere("l.meta -> 'meetings' IS NOT NULL")
      .select(['l.meta'])
      .getMany();

    let todayMeetingsCount = 0;
    for (const l of leadsWithMeetings) {
      const meetings = (l.meta as { meetings?: unknown[] } | null)?.meetings;
      if (!Array.isArray(meetings)) continue;
      for (const m of meetings) {
        const meeting = m as { startsAt?: string; closedAt?: string } | null;
        if (!meeting?.startsAt || meeting.closedAt) continue;
        const date = new Date(meeting.startsAt);
        if (!Number.isNaN(date.getTime()) && date >= todayStart && date < todayEnd) {
          todayMeetingsCount++;
        }
      }
    }

    return {
      profileCompletion: { percent, steps },
      leadActivityStream,
      learnSlugs: defaultLearnSlugs(),
      todayMeetingsCount,
    };
  }
}

function defaultLearnSlugs() {
  return ['crm-adoption', 'analytics-dashboards', 'automation-triggers'];
}

function activitySummary(a: LeadActivity): string | null {
  switch (a.type) {
    case 'created':
      return a.comment || null;
    case 'status_changed':
      if (a.fromValue && a.toValue) return `${a.fromValue} → ${a.toValue}`;
      if (a.toValue) return a.toValue;
      return null;
    case 'assignee_changed':
      return a.toValue || a.fromValue || null;
    case 'comment':
      return a.comment;
    default:
      return a.comment;
  }
}
