// src/leads/lead-access.service.ts
import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { LeadAccessGrant, LeadAccessScopeType, LeadAccessTier } from './lead-access-grant.entity';
import { Department } from '../departments/department.entity';
import { StaffUser, StaffRole } from '../staff/staff-user.entity';
import { Lead } from './lead.entity';

export type EffectiveTier = 'none' | LeadAccessTier;

const TIER_RANK: Record<EffectiveTier, number> = {
  none: 0,
  viewer: 1,
  analyst: 2,
  editor: 3,
  owner: 4,
};

// 'manager' deliberately removed (2026-09-01): it used to be treated as automatically privileged
// everywhere (here and in DataVisibilityService's PRIVILEGED_ROLES), which meant Data Visibility
// rules could never actually restrict a manager's data — the role was hardcoded as "sees
// everything" regardless of what the owner configured on that screen. Now only 'owner' is
// unconditionally full-access; a manager's real visibility is whatever the owner sets for the
// 'manager' role on the Data Visibility tab (now selectable there — see DV_ROLES on the
// frontend), same mechanism as every other non-owner role. Department heads still get full
// access via headsADepartment below, independent of role.
const FULL_ACCESS_ROLES: StaffRole[] = ['owner'];

@Injectable()
export class LeadAccessService {
  constructor(
    @InjectRepository(LeadAccessGrant)
    private readonly grantRepo: Repository<LeadAccessGrant>,
    @InjectRepository(Department)
    private readonly departmentRepo: Repository<Department>,
  ) {}

  /** Owner/manager roles, or whoever heads any department in this tenant, see every lead. */
  async hasFullAccess(tenantId: string, staff: StaffUser | null, role?: StaffRole | null): Promise<boolean> {
    if (role && FULL_ACCESS_ROLES.includes(role)) return true;
    if (!staff) return false;
    const headsADepartment = await this.departmentRepo.exists({
      where: { tenantId, managerId: staff.id },
    });
    return headsADepartment;
  }

  async getGrantsForStaff(tenantId: string, staffUserId: string): Promise<LeadAccessGrant[]> {
    return this.grantRepo.find({ where: { tenantId, staffUserId } });
  }

  isAssignedTo(lead: Pick<Lead, 'assignedUserId' | 'assignedUserIds' | 'assignedTo' | 'assignedToList'>, staff: StaffUser): boolean {
    const staffId = staff.id;
    const fullName = staff.fullName?.trim();
    if (Array.isArray(lead.assignedUserIds) && lead.assignedUserIds.includes(staffId)) return true;
    if (Array.isArray(lead.assignedToList) && fullName && lead.assignedToList.includes(fullName)) return true;
    if (lead.assignedUserId && lead.assignedUserId === staffId) return true;
    if (fullName && lead.assignedTo && lead.assignedTo === fullName) return true;
    return false;
  }

  /** Assigned leads behave like an implicit 'owner'-tier grant. Otherwise the highest tier among
   * grants matching scopeType='all' or (scopeType='source' && scopeValue === lead.source). */
  getEffectiveTier(
    lead: Pick<Lead, 'assignedUserId' | 'assignedUserIds' | 'assignedTo' | 'assignedToList' | 'source'>,
    staff: StaffUser | null,
    grants: LeadAccessGrant[],
  ): EffectiveTier {
    if (!staff) return 'none';
    if (this.isAssignedTo(lead, staff)) return 'owner';
    let best: EffectiveTier = 'none';
    for (const g of grants) {
      const matches = g.scopeType === 'all' || (g.scopeType === 'source' && g.scopeValue === lead.source);
      if (matches && TIER_RANK[g.tier] > TIER_RANK[best]) best = g.tier;
    }
    return best;
  }

  canView(tier: EffectiveTier): boolean {
    return TIER_RANK[tier] >= TIER_RANK.viewer;
  }

  canViewAnalytics(tier: EffectiveTier): boolean {
    return TIER_RANK[tier] >= TIER_RANK.analyst;
  }

  canEdit(tier: EffectiveTier): boolean {
    return TIER_RANK[tier] >= TIER_RANK.editor;
  }

  canManage(tier: EffectiveTier): boolean {
    return TIER_RANK[tier] >= TIER_RANK.owner;
  }

  // ── Grant management (full-access users only — checked by the caller) ──────────────────────

  async upsertGrant(
    tenantId: string,
    dto: { staffUserId: string; scopeType: LeadAccessScopeType; scopeValue?: string | null; tier: LeadAccessTier },
  ): Promise<LeadAccessGrant> {
    if (dto.scopeType === 'source' && !dto.scopeValue?.trim()) {
      throw new BadRequestException('scopeValue is required for scopeType="source"');
    }
    const scopeValue = dto.scopeType === 'all' ? null : dto.scopeValue!.trim();
    const existing = await this.grantRepo.findOne({
      where: {
        tenantId,
        staffUserId: dto.staffUserId,
        scopeType: dto.scopeType,
        scopeValue: scopeValue === null ? IsNull() : scopeValue,
      },
    });
    if (existing) {
      existing.tier = dto.tier;
      return this.grantRepo.save(existing);
    }
    return this.grantRepo.save(
      this.grantRepo.create({ tenantId, staffUserId: dto.staffUserId, scopeType: dto.scopeType, scopeValue, tier: dto.tier }),
    );
  }

  async deleteGrant(tenantId: string, id: string): Promise<void> {
    const grant = await this.grantRepo.findOne({ where: { id, tenantId } });
    if (!grant) throw new ForbiddenException('Grant not found');
    await this.grantRepo.remove(grant);
  }

  async listAllGrants(tenantId: string): Promise<LeadAccessGrant[]> {
    return this.grantRepo.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
  }
}
