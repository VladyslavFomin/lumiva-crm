// src/data-visibility/data-visibility.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ModuleRef } from '@nestjs/core';
import { Repository } from 'typeorm';
import { StaffDataVisibilityRule, DataVisibilityRuleKey } from './data-visibility-rule.entity';
import { TenantIpAllowlistEntry } from './tenant-ip-allowlist.entity';
import { StaffUser, StaffRole } from '../staff/staff-user.entity';
import { User } from '../users/user.entity';
import { Department } from '../departments/department.entity';
import { Contact } from '../contacts/contact.entity';
import { Company } from '../companies/company.entity';
import { Sale } from '../sales/sale.entity';
import { Lead } from '../leads/lead.entity';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { ipMatchesAnyCidr } from '../common/cidr.util';

type AuditLogService = import('../audit-log/audit-log.service').AuditLogService;

export type DataVisibilityMatrix = Record<StaffRole, Record<DataVisibilityRuleKey, string>>;

/** Absence of a row means "off" — same status-quo-preserving convention as RbacService's
 * DEFAULT_ROLE_PERMISSIONS: turning this feature on must never silently narrow anyone's access
 * until the owner explicitly configures a rule. */
const RULE_DEFAULTS: Record<DataVisibilityRuleKey, string> = {
  foreign_records: 'full',
  amounts_visibility: 'all',
  contact_masking: 'show',
  ip_mode: 'off',
};

const RULE_KEYS = Object.keys(RULE_DEFAULTS) as DataVisibilityRuleKey[];

const ROLES: StaffRole[] = ['owner', 'manager', 'viewer', 'finance', 'sales', 'developer', 'support'];

/** Who's exempt from every rule on this screen — same list as LeadAccessService.hasFullAccess
 * (owner, or head of any department; department-head is checked separately via getRequestContext/
 * isPrivileged, not here). 'manager' deliberately removed (2026-09-01): it used to be
 * unconditionally privileged, which meant these rules could never actually restrict a manager —
 * the owner could configure "own records only" for the role and it silently had no effect. Now a
 * manager's visibility is whatever's configured for 'manager' on this screen, like any other
 * role. */
const PRIVILEGED_ROLES: StaffRole[] = ['owner'];

export interface DataVisibilityActor {
  actorUserId?: string | null;
  actorName?: string | null;
}

export interface RequestVisibilityContext {
  staffId: string | null;
  privileged: boolean;
}

@Injectable()
export class DataVisibilityService {
  constructor(
    @InjectRepository(StaffDataVisibilityRule)
    private readonly ruleRepo: Repository<StaffDataVisibilityRule>,
    @InjectRepository(TenantIpAllowlistEntry)
    private readonly ipRepo: Repository<TenantIpAllowlistEntry>,
    @InjectRepository(StaffUser)
    private readonly staffRepo: Repository<StaffUser>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Department)
    private readonly departmentRepo: Repository<Department>,
    @InjectRepository(Contact)
    private readonly contactRepo: Repository<Contact>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(Sale)
    private readonly saleRepo: Repository<Sale>,
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
    private readonly moduleRef: ModuleRef,
  ) {}

  private auditLog(): AuditLogService | null {
    try {
      return this.moduleRef.get(
        require('../audit-log/audit-log.service').AuditLogService,
        { strict: false },
      );
    } catch {
      return null;
    }
  }

  // ── Rules matrix (mirrors RbacService.getRoleMatrixForTenant/saveRolePermissions) ──────────

  async getRulesForTenant(tenantId: string): Promise<DataVisibilityMatrix> {
    const rows = await this.ruleRepo.find({ where: { tenantId } });
    const result = {} as DataVisibilityMatrix;
    for (const role of ROLES) {
      result[role] = { ...RULE_DEFAULTS };
    }
    for (const row of rows) {
      if (!result[row.role]) continue;
      result[row.role][row.ruleKey] = row.value;
    }
    return result;
  }

  async getRuleValue(tenantId: string, role: StaffRole, ruleKey: DataVisibilityRuleKey): Promise<string> {
    if (PRIVILEGED_ROLES.includes(role)) return RULE_DEFAULTS[ruleKey];
    const row = await this.ruleRepo.findOne({ where: { tenantId, role, ruleKey } });
    return row?.value ?? RULE_DEFAULTS[ruleKey];
  }

  async saveRules(
    tenantId: string,
    matrix: DataVisibilityMatrix,
    actor?: DataVisibilityActor,
  ): Promise<DataVisibilityMatrix> {
    const before = await this.getRulesForTenant(tenantId);

    await this.ruleRepo.delete({ tenantId });

    const toSave: StaffDataVisibilityRule[] = [];
    for (const role of ROLES) {
      const roleRules = matrix[role];
      if (!roleRules) continue;
      for (const ruleKey of RULE_KEYS) {
        const value = roleRules[ruleKey];
        if (!value || value === RULE_DEFAULTS[ruleKey]) continue; // don't store the default — keeps "no row = off" true
        toSave.push(this.ruleRepo.create({ tenantId, role, ruleKey, value }));
      }
    }
    if (toSave.length) await this.ruleRepo.save(toSave);

    const after = await this.getRulesForTenant(tenantId);
    await this.logChanges(tenantId, before, after, actor);
    return after;
  }

  private async logChanges(
    tenantId: string,
    before: DataVisibilityMatrix,
    after: DataVisibilityMatrix,
    actor?: DataVisibilityActor,
  ): Promise<void> {
    const auditLog = this.auditLog();
    if (!auditLog) return;
    for (const role of ROLES) {
      const changed = RULE_KEYS.filter((k) => before[role]?.[k] !== after[role]?.[k]);
      if (!changed.length) continue;
      await auditLog.log({
        tenantId,
        entityType: 'rbac_role',
        entityId: role,
        entityLabel: role,
        action: 'update',
        summary: `Роль «${role}»: правила видимости данных — ${changed
          .map((k) => `${k} → ${after[role][k]}`)
          .join(', ')}`,
        changes: changed.map((k) => ({
          field: `data_visibility.${k}`,
          oldValue: before[role]?.[k] ?? null,
          newValue: after[role]?.[k] ?? null,
        })),
        actorUserId: actor?.actorUserId ?? null,
        actorName: actor?.actorName ?? null,
      });
    }
  }

  // ── Office IP allowlist ─────────────────────────────────────────────────────────────────────

  async getIpAllowlist(tenantId: string): Promise<TenantIpAllowlistEntry[]> {
    return this.ipRepo.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
  }

  async addIpEntry(tenantId: string, cidr: string, label?: string | null): Promise<TenantIpAllowlistEntry> {
    return this.ipRepo.save(this.ipRepo.create({ tenantId, cidr: cidr.trim(), label: label?.trim() || null }));
  }

  async removeIpEntry(tenantId: string, id: string): Promise<void> {
    await this.ipRepo.delete({ id, tenantId });
  }

  async checkIp(
    tenantId: string,
    role: StaffRole,
    ip: string | null,
  ): Promise<{ mode: string; allowed: boolean }> {
    const mode = await this.getRuleValue(tenantId, role, 'ip_mode');
    if (mode === 'off' || !ip) return { mode, allowed: true };
    const allowlist = await this.getIpAllowlist(tenantId);
    if (!allowlist.length) return { mode, allowed: true }; // nothing configured yet — never lock everyone out
    const allowed = ipMatchesAnyCidr(ip, allowlist.map((e) => e.cidr));
    return { mode, allowed };
  }

  async getStaffRoleById(tenantId: string, staffUserId: string): Promise<StaffRole | null> {
    const staff = await this.staffRepo.findOne({ where: { id: staffUserId, tenantId } });
    return staff?.role ?? null;
  }

  // ── Requester context (who is this, are they exempt from scoping) ──────────────────────────

  async getStaffForUser(tenantId: string, user: CurrentUserPayload): Promise<StaffUser | null> {
    const userId = user.userId ?? user.id ?? user.sub;
    if (!userId) return null;
    const authUser = await this.userRepo.findOne({ where: { id: userId, tenantId } });
    if (!authUser) return null;
    return this.staffRepo.findOne({ where: { tenantId, email: authUser.email } });
  }

  async isPrivileged(tenantId: string, role: StaffRole | undefined, staffId: string | null): Promise<boolean> {
    if (role && PRIVILEGED_ROLES.includes(role)) return true;
    if (!staffId) return false;
    return this.departmentRepo.exists({ where: { tenantId, managerId: staffId } });
  }

  async getRequestContext(tenantId: string, user: CurrentUserPayload): Promise<RequestVisibilityContext> {
    const staff = await this.getStaffForUser(tenantId, user);
    const privileged = await this.isPrivileged(tenantId, user.role as StaffRole, staff?.id ?? null);
    return { staffId: staff?.id ?? null, privileged };
  }

  // ── Sales scoping (Sale has no assignedUserId of its own — "own" is derived through its
  // linked lead/contact's assignee) ───────────────────────────────────────────────────────────

  /** Raw SQL fragment (expects the sales QueryBuilder alias to be 's') + params, for scoping a
   * Sales list query to rows linked to this staff member. Reused by SalesController.list and
   * simulateForStaff below so the ownership definition lives in exactly one place. */
  salesOwnFilterSql(staffId: string): { sql: string; params: Record<string, unknown> } {
    return {
      // sales.lead_id/contact_id are snake_case columns (Sale entity's explicit @Column({name:...})),
      // unlike leads."assignedUserId"/contacts."assignedUserId" which are camelCase-quoted (no name
      // override on those columns) — verified against the live schema, not assumed.
      sql: '(EXISTS (SELECT 1 FROM leads l WHERE l.id = s.lead_id AND l."assignedUserId" = :dvStaffId) OR EXISTS (SELECT 1 FROM contacts c WHERE c.id = s.contact_id AND c."assignedUserId" = :dvStaffId))',
      params: { dvStaffId: staffId },
    };
  }

  async isSaleOwnedByStaff(
    sale: { leadId: string | null; contactId: string | null },
    staffId: string | null,
  ): Promise<boolean> {
    if (!staffId) return false;
    if (sale.leadId) {
      const lead = await this.leadRepo.findOne({ where: { id: sale.leadId } });
      if (lead?.assignedUserId === staffId) return true;
    }
    if (sale.contactId) {
      const contact = await this.contactRepo.findOne({ where: { id: sale.contactId } });
      if (contact?.assignedUserId === staffId) return true;
    }
    return false;
  }

  // ── Simulation for the "Проверка на сотруднике" panel ──────────────────────────────────────

  async simulateForStaff(tenantId: string, staffId: string, role: StaffRole) {
    const privileged = await this.isPrivileged(tenantId, role, staffId);
    const [foreignRecords, amountsVisibility, contactMasking] = await Promise.all([
      this.getRuleValue(tenantId, role, 'foreign_records'),
      this.getRuleValue(tenantId, role, 'amounts_visibility'),
      this.getRuleValue(tenantId, role, 'contact_masking'),
    ]);

    const [contactsTotal, contactsOwn, companiesTotal, companiesOwn, salesTotal, salesOwn] = await Promise.all([
      this.contactRepo.count({ where: { tenantId } }),
      this.contactRepo.count({ where: { tenantId, assignedUserId: staffId } }),
      this.companyRepo.count({ where: { tenantId } }),
      this.companyRepo.count({ where: { tenantId, assignedUserId: staffId } }),
      this.saleRepo.count({ where: { tenantId } }),
      (() => {
        const { sql, params } = this.salesOwnFilterSql(staffId);
        return this.saleRepo
          .createQueryBuilder('s')
          .where('s.tenantId = :tenantId', { tenantId })
          .andWhere(sql, params)
          .getCount();
      })(),
    ]);

    const visibleContacts = privileged || foreignRecords !== 'hide' ? contactsTotal : contactsOwn;
    const visibleCompanies = privileged || foreignRecords !== 'hide' ? companiesTotal : companiesOwn;
    const visibleSales = privileged || foreignRecords !== 'hide' ? salesTotal : salesOwn;

    return {
      privileged,
      foreignRecords,
      amountsVisibility,
      contactMasking,
      contacts: { visible: visibleContacts, total: contactsTotal },
      companies: { visible: visibleCompanies, total: companiesTotal },
      sales: { visible: visibleSales, total: salesTotal },
    };
  }
}
