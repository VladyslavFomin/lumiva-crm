import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { DuplicatePair, DedupEntityType, DuplicateMergeSnapshot } from './duplicate-pair.entity';
import { DedupSettings } from './dedup-settings.entity';
import { Contact } from '../contacts/contact.entity';
import { Lead } from '../leads/lead.entity';
import { Company } from '../companies/company.entity';
import { Sale } from '../sales/sale.entity';
import { Project } from '../projects/project.entity';
import { Reservation } from '../bookings/reservation.entity';
import { MarketingSegment } from '../marketing/marketing-segment.entity';
import { MergeDto } from './dto/merge.dto';

export interface ScanResult {
  scanned: number;
  found: number;
}

interface ScoreResult {
  score: number;
  reasons: string[];
}

const NO_MATCH: ScoreResult = { score: 0, reasons: [] };

export interface DuplicateGroup {
  entityType: DedupEntityType;
  ids: string[];
  score: number;
  reasons: string[];
  pairIds: string[];
}

@Injectable()
export class DeduplicationService {
  constructor(
    @InjectRepository(DuplicatePair)
    private readonly pairRepo: Repository<DuplicatePair>,
    @InjectRepository(Contact)
    private readonly contactRepo: Repository<Contact>,
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(Sale)
    private readonly saleRepo: Repository<Sale>,
    @InjectRepository(MarketingSegment)
    private readonly segmentRepo: Repository<MarketingSegment>,
    @InjectRepository(DedupSettings)
    private readonly settingsRepo: Repository<DedupSettings>,
  ) {}

  // ─── Similarity ───────────────────────────────────────────────────────────

  /** Расстояние Левенштейна (простая реализация, без npm) */
  private levenshtein(a: string, b: string): number {
    const m = a.length, n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
      Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
    );
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[m][n];
  }

  private normPhone(p: string | null | undefined): string {
    return (p || '').replace(/\D/g, '').slice(-10);
  }

  private normEmail(e: string | null | undefined): string {
    return (e || '').toLowerCase().trim();
  }

  private normName(n: string | null | undefined): string {
    return (n || '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  /**
   * Возвращает {score, reasons} для пары записей. 100 = точное совпадение email или phone,
   * score=0 (NO_MATCH) = нет совпадений. reasons — какие правила сработали, для тегов "почему
   * похоже" и группировки правил в UI.
   */
  private scoreContacts(a: Contact, b: Contact): ScoreResult {
    const reasons: string[] = [];
    const ea = this.normEmail(a.email), eb = this.normEmail(b.email);
    if (ea && ea === eb) reasons.push('email');

    const pa = this.normPhone(a.phone), pb = this.normPhone(b.phone);
    if (pa && pa === pb && pa.length >= 7) reasons.push('phone');

    if (reasons.length) return { score: 100, reasons };

    const na = this.normName(`${a.firstName} ${a.lastName}`);
    const nb = this.normName(`${b.firstName} ${b.lastName}`);
    if (!na || !nb) return NO_MATCH;

    const maxLen = Math.max(na.length, nb.length);
    if (maxLen === 0) return NO_MATCH;
    const dist = this.levenshtein(na, nb);
    const similarity = Math.round((1 - dist / maxLen) * 100);
    if (similarity < 75) return NO_MATCH;
    const sameCompany = a.companyId && a.companyId === b.companyId;
    return { score: similarity, reasons: [similarity === 100 ? 'name' : sameCompany ? 'name_company' : 'fuzzy_name'] };
  }

  private scoreLeads(a: Lead, b: Lead): ScoreResult {
    const reasons: string[] = [];
    const ea = this.normEmail(a.email), eb = this.normEmail(b.email);
    if (ea && ea === eb) reasons.push('email');

    const pa = this.normPhone(a.phone), pb = this.normPhone(b.phone);
    if (pa && pa === pb && pa.length >= 7) reasons.push('phone');

    if (reasons.length) return { score: 100, reasons };

    const na = this.normName(a.name), nb = this.normName(b.name);
    if (!na || !nb) return NO_MATCH;

    const maxLen = Math.max(na.length, nb.length);
    if (maxLen === 0) return NO_MATCH;
    const dist = this.levenshtein(na, nb);
    const similarity = Math.round((1 - dist / maxLen) * 100);
    if (similarity < 80) return NO_MATCH;
    return { score: similarity, reasons: [similarity === 100 ? 'name' : 'fuzzy_name'] };
  }

  private scoreCompanies(a: Company, b: Company): ScoreResult {
    const reasons: string[] = [];
    const ea = this.normEmail(a.email), eb = this.normEmail(b.email);
    if (ea && ea === eb) reasons.push('email');

    const pa = this.normPhone(a.phone), pb = this.normPhone(b.phone);
    if (pa && pa === pb && pa.length >= 7) reasons.push('phone');

    if (reasons.length) return { score: 100, reasons };

    const na = this.normName(a.name), nb = this.normName(b.name);
    if (!na || !nb) return NO_MATCH;

    const maxLen = Math.max(na.length, nb.length);
    if (maxLen === 0) return NO_MATCH;
    const dist = this.levenshtein(na, nb);
    const similarity = Math.round((1 - dist / maxLen) * 100);
    if (similarity < 80) return NO_MATCH;
    return { score: similarity, reasons: ['company_name'] };
  }

  private scoreSales(a: Sale, b: Sale): ScoreResult {
    if (a.externalId && a.externalId === b.externalId) return { score: 100, reasons: ['external_id'] };
    if (a.externalOrderNo && a.externalOrderNo === b.externalOrderNo) return { score: 100, reasons: ['order_no'] };
    const na = this.normName(a.guestName), nb = this.normName(b.guestName);
    if (!na || !nb) return NO_MATCH;
    const sameHotel = this.normName(a.hotel) === this.normName(b.hotel) && !!a.hotel;
    const sameAmount = a.amount === b.amount;
    const aDate = a.saleDate ? new Date(a.saleDate).toDateString() : null;
    const bDate = b.saleDate ? new Date(b.saleDate).toDateString() : null;
    const sameDate = aDate && aDate === bDate;
    if (sameHotel && sameAmount && sameDate) return { score: 95, reasons: ['same_stay'] };
    const maxLen = Math.max(na.length, nb.length);
    const sim = Math.round((1 - this.levenshtein(na, nb) / maxLen) * 100);
    return sim >= 90 && sameHotel ? { score: sim, reasons: ['fuzzy_name'] } : NO_MATCH;
  }

  private scoreSegments(a: MarketingSegment, b: MarketingSegment): ScoreResult {
    const na = this.normName(a.name), nb = this.normName(b.name);
    if (!na || !nb) return NO_MATCH;
    if (na === nb) return { score: 100, reasons: ['name'] };
    const maxLen = Math.max(na.length, nb.length);
    const sim = Math.round((1 - this.levenshtein(na, nb) / maxLen) * 100);
    return sim >= 85 ? { score: sim, reasons: ['fuzzy_name'] } : NO_MATCH;
  }

  // ─── Scan ─────────────────────────────────────────────────────────────────

  async scan(tenantId: string, entityType: DedupEntityType): Promise<ScanResult> {
    if (entityType === 'contact') return this.scanContacts(tenantId);
    if (entityType === 'lead') return this.scanLeads(tenantId);
    if (entityType === 'sale') return this.scanSales(tenantId);
    if (entityType === 'segment') return this.scanSegments(tenantId);
    return this.scanCompanies(tenantId);
  }

  private async scanContacts(tenantId: string): Promise<ScanResult> {
    const items = await this.contactRepo.find({
      where: { tenantId },
      select: ['id', 'firstName', 'lastName', 'email', 'phone', 'companyId'],
    });
    return this.runScan(tenantId, 'contact', items, (a, b) =>
      this.scoreContacts(a as Contact, b as Contact),
    );
  }

  private async scanLeads(tenantId: string): Promise<ScanResult> {
    const items = await this.leadRepo.find({
      where: { tenantId },
      select: ['id', 'name', 'email', 'phone'],
    });
    return this.runScan(tenantId, 'lead', items, (a, b) =>
      this.scoreLeads(a as Lead, b as Lead),
    );
  }

  private async scanCompanies(tenantId: string): Promise<ScanResult> {
    const items = await this.companyRepo.find({
      where: { tenantId },
      select: ['id', 'name', 'email', 'phone'],
    });
    return this.runScan(tenantId, 'company', items, (a, b) =>
      this.scoreCompanies(a as Company, b as Company),
    );
  }

  private async scanSales(tenantId: string): Promise<ScanResult> {
    const items = await this.saleRepo.find({
      where: { tenantId },
      select: ['id', 'externalId', 'externalOrderNo', 'guestName', 'hotel', 'amount', 'saleDate'] as any,
    });
    return this.runScan(tenantId, 'sale', items, (a, b) =>
      this.scoreSales(a as Sale, b as Sale),
    );
  }

  private async scanSegments(tenantId: string): Promise<ScanResult> {
    const items = await this.segmentRepo.find({
      where: { tenantId },
      select: ['id', 'name'],
    });
    return this.runScan(tenantId, 'segment', items, (a, b) =>
      this.scoreSegments(a as MarketingSegment, b as MarketingSegment),
    );
  }

  private async runScan<T extends { id: string }>(
    tenantId: string,
    entityType: DedupEntityType,
    items: T[],
    scorer: (a: T, b: T) => ScoreResult,
  ): Promise<ScanResult> {
    let found = 0;
    const pairs: Partial<DuplicatePair>[] = [];

    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const { score, reasons } = scorer(items[i], items[j]);
        if (score >= 75) {
          const [aId, bId] = [items[i].id, items[j].id].sort();
          pairs.push({ tenantId, entityType, entityAId: aId, entityBId: bId, score, reasons });
          found++;
        }
      }
      // Пакетная запись каждые 100 пар чтобы не переполнить память
      if (pairs.length >= 100) {
        await this.pairRepo
          .createQueryBuilder()
          .insert()
          .into(DuplicatePair)
          .values(pairs)
          .orIgnore()
          .execute();
        pairs.length = 0;
      }
    }

    if (pairs.length > 0) {
      await this.pairRepo
        .createQueryBuilder()
        .insert()
        .into(DuplicatePair)
        .values(pairs)
        .orIgnore()
        .execute();
    }

    return { scanned: items.length, found };
  }

  // ─── Query ────────────────────────────────────────────────────────────────

  async findPairs(
    tenantId: string,
    entityType?: DedupEntityType,
    status = 'pending',
    limit = 50,
    offset = 0,
  ): Promise<{ items: DuplicatePair[]; total: number }> {
    const where: any = { tenantId, status };
    if (entityType) where.entityType = entityType;

    const [items, total] = await this.pairRepo.findAndCount({
      where,
      order: { score: 'DESC', createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { items, total };
  }

  async ignorePair(tenantId: string, id: string, userId: string): Promise<DuplicatePair> {
    const pair = await this.pairRepo.findOne({ where: { tenantId, id } });
    if (!pair) throw new NotFoundException('Пара дублей не найдена');
    pair.status = 'ignored';
    pair.resolvedAt = new Date();
    pair.resolvedBy = userId;
    return this.pairRepo.save(pair);
  }

  /** Bulk-ignore every pending pair touching any id in this group — used by "Не дубли" on a
   * whole group, not just one pair. */
  async ignoreGroup(tenantId: string, ids: string[], userId: string): Promise<void> {
    await this.pairRepo
      .createQueryBuilder()
      .update(DuplicatePair)
      .set({ status: 'ignored', resolvedAt: new Date(), resolvedBy: userId })
      .where('"tenantId" = :tenantId AND status = :status', { tenantId, status: 'pending' })
      .andWhere('("entityAId" IN (:...ids) OR "entityBId" IN (:...ids))', { ids })
      .execute();
  }

  // ─── Groups (connected components over pending pairs) ─────────────────────

  /** Clusters pending pairs into N-way groups (union-find) — a scan only ever records pairwise
   * matches, but three near-identical contacts show up as three overlapping pairs; the UI wants
   * one group. Returns raw records per member so the frontend can render/compare any field
   * without the backend hardcoding a fixed field list per entity type. */
  async getGroups(
    tenantId: string,
    entityType: DedupEntityType,
  ): Promise<{ groups: (DuplicateGroup & { records: Record<string, unknown>[] })[] }> {
    const pairs = await this.pairRepo.find({ where: { tenantId, entityType, status: 'pending' } });
    if (!pairs.length) return { groups: [] };

    const parent = new Map<string, string>();
    const find = (x: string): string => {
      if (!parent.has(x)) parent.set(x, x);
      let root = x;
      while (parent.get(root) !== root) root = parent.get(root)!;
      let cur = x;
      while (parent.get(cur) !== cur) {
        const next = parent.get(cur)!;
        parent.set(cur, root);
        cur = next;
      }
      return root;
    };
    const union = (a: string, b: string) => {
      const ra = find(a), rb = find(b);
      if (ra !== rb) parent.set(ra, rb);
    };
    pairs.forEach((p) => union(p.entityAId, p.entityBId));

    const clusters = new Map<string, { ids: Set<string>; pairs: DuplicatePair[] }>();
    pairs.forEach((p) => {
      const root = find(p.entityAId);
      if (!clusters.has(root)) clusters.set(root, { ids: new Set(), pairs: [] });
      const c = clusters.get(root)!;
      c.ids.add(p.entityAId);
      c.ids.add(p.entityBId);
      c.pairs.push(p);
    });

    const allIds = pairs.flatMap((p) => [p.entityAId, p.entityBId]);
    const records = await this.fetchRecordsByIds(entityType, tenantId, [...new Set(allIds)]);
    const byId = new Map(records.map((r: any) => [r.id, r]));

    const groups = [...clusters.values()]
      .map((c) => ({
        entityType,
        ids: [...c.ids],
        score: Math.max(...c.pairs.map((p) => p.score)),
        reasons: [...new Set(c.pairs.flatMap((p) => p.reasons ?? []))],
        pairIds: c.pairs.map((p) => p.id),
        records: [...c.ids].map((id) => byId.get(id)).filter(Boolean) as Record<string, unknown>[],
      }))
      .filter((g) => g.records.length >= 2)
      .sort((a, b) => b.score - a.score);

    return { groups };
  }

  private async fetchRecordsByIds(
    entityType: DedupEntityType,
    tenantId: string,
    ids: string[],
  ): Promise<Record<string, unknown>[]> {
    if (!ids.length) return [];
    if (entityType === 'contact') return this.contactRepo.find({ where: { tenantId, id: In(ids) } }) as any;
    if (entityType === 'lead') return this.leadRepo.find({ where: { tenantId, id: In(ids) } }) as any;
    if (entityType === 'company') return this.companyRepo.find({ where: { tenantId, id: In(ids) } }) as any;
    if (entityType === 'sale') return this.saleRepo.find({ where: { tenantId, id: In(ids) } }) as any;
    return this.segmentRepo.find({ where: { tenantId, id: In(ids) } }) as any;
  }

  // ─── Settings ───────────────────────────────────────────────────────────────

  async getSettings(tenantId: string): Promise<DedupSettings> {
    const existing = await this.settingsRepo.findOne({ where: { tenantId } });
    if (existing) return existing;
    return this.settingsRepo.create({ tenantId, masterRule: 'oldest', fillEmptyFields: true, autoMergeThreshold: null });
  }

  async saveSettings(
    tenantId: string,
    patch: Partial<Pick<DedupSettings, 'masterRule' | 'fillEmptyFields' | 'autoMergeThreshold'>>,
  ): Promise<DedupSettings> {
    const current = await this.getSettings(tenantId);
    Object.assign(current, patch);
    return this.settingsRepo.save(current);
  }

  // ─── Merge ────────────────────────────────────────────────────────────────

  async merge(tenantId: string, dto: MergeDto, userId: string): Promise<{ merged: true }> {
    const { entityType, winnerId, loserId, fieldMap } = dto;
    if (winnerId === loserId) throw new BadRequestException('winnerId и loserId должны отличаться');

    const settings = await this.getSettings(tenantId);

    // Раньше сам merge сущности (в своей транзакции) и последующая пометка DuplicatePair как
    // 'merged' были двумя независимыми шагами — сбой между ними оставлял пару в статусе
    // 'pending', хотя сущности уже объединены. Один общий transaction() на весь merge()
    // (entity-merge методы больше не открывают собственный — принимают готовый manager)
    // закрывает это: либо оба шага закоммитятся, либо оба откатятся.
    await this.contactRepo.manager.transaction(async (manager) => {
      let snapshot: DuplicateMergeSnapshot | null = null;

      if (entityType === 'contact') {
        snapshot = await this.mergeContacts(manager, tenantId, winnerId, loserId, fieldMap ?? {}, settings.fillEmptyFields);
      } else if (entityType === 'lead') {
        snapshot = await this.mergeLeads(manager, tenantId, winnerId, loserId, fieldMap ?? {}, settings.fillEmptyFields);
      } else if (entityType === 'sale') {
        await this.mergeSales(manager, tenantId, winnerId, loserId, fieldMap ?? {});
      } else if (entityType === 'segment') {
        await this.mergeSegments(manager, tenantId, winnerId, loserId, fieldMap ?? {});
      } else {
        snapshot = await this.mergeCompanies(manager, tenantId, winnerId, loserId, fieldMap ?? {}, settings.fillEmptyFields);
      }

      // Помечаем все пары с этими сущностями как merged; snapshot сохраняем на КАЖДУЮ такую пару —
      // все они описывают один и тот же результат объединения, и любую можно использовать для undo.
      await manager
        .createQueryBuilder()
        .update(DuplicatePair)
        .set({ status: 'merged', resolvedAt: new Date(), resolvedBy: userId, snapshot })
        .where('"tenantId" = :tenantId AND "entityType" = :et', { tenantId, et: entityType })
        .andWhere('("entityAId" = :a OR "entityBId" = :a OR "entityAId" = :b OR "entityBId" = :b)', {
          a: winnerId,
          b: loserId,
        })
        .execute();
    });

    return { merged: true };
  }

  private async mergeContacts(
    manager: EntityManager,
    tenantId: string,
    winnerId: string,
    loserId: string,
    fieldMap: Record<string, 'winner' | 'loser'>,
    fillEmptyFields: boolean,
  ): Promise<DuplicateMergeSnapshot> {
    const [winner, loser] = await Promise.all([
      manager.findOneOrFail(Contact, { where: { tenantId, id: winnerId } }),
      manager.findOneOrFail(Contact, { where: { tenantId, id: loserId } }),
    ]);
    const winnerBefore = { ...winner };
    const loserRow = { ...loser };

    const mergeableFields: (keyof Contact)[] = [
      'firstName', 'lastName', 'email', 'phone', 'position', 'telegram',
    ] as any;

    for (const field of mergeableFields) {
      const choice = fieldMap[field as string];
      const source = choice === 'loser' ? loser : winner;
      const target = winner;
      if (choice === 'loser' && source[field]) {
        (target as any)[field] = source[field];
      } else if (fillEmptyFields && !target[field] && loser[field]) {
        (target as any)[field] = loser[field];
      }
    }

    await manager.save(winner);
    // Переносим связанные записи на выжившего — иначе они остаются привязаны к
    // soft-deleted проигравшему и просто исчезают из вида (дедупликация переставала
    // быть "объединением", а по факту теряла сделки/проекты/брони проигравшего).
    await manager.update(Sale, { tenantId, contactId: loserId }, { contactId: winnerId });
    await manager.update(Project, { tenantId, contactId: loserId }, { contactId: winnerId });
    await manager.update(Reservation, { tenantId, contactId: loserId }, { contactId: winnerId });
    await manager.softDelete(Contact, { tenantId, id: loserId });
    return { winnerBefore, loserRow };
  }

  private async mergeLeads(
    manager: EntityManager,
    tenantId: string,
    winnerId: string,
    loserId: string,
    fieldMap: Record<string, 'winner' | 'loser'>,
    fillEmptyFields: boolean,
  ): Promise<DuplicateMergeSnapshot> {
    const [winner, loser] = await Promise.all([
      manager.findOneOrFail(Lead, { where: { tenantId, id: winnerId } }),
      manager.findOneOrFail(Lead, { where: { tenantId, id: loserId } }),
    ]);
    const winnerBefore = { ...winner };
    const loserRow = { ...loser };

    const mergeableFields: (keyof Lead)[] = ['name', 'email', 'phone'] as any;

    for (const field of mergeableFields) {
      const choice = fieldMap[field as string];
      if (choice === 'loser' && loser[field]) {
        (winner as any)[field] = loser[field];
      } else if (fillEmptyFields && !winner[field] && loser[field]) {
        (winner as any)[field] = loser[field];
      }
    }

    await manager.save(winner);
    await manager.update(Sale, { tenantId, leadId: loserId }, { leadId: winnerId });
    await manager.update(Project, { tenantId, leadId: loserId }, { leadId: winnerId });
    await manager.update(Reservation, { tenantId, leadId: loserId }, { leadId: winnerId });
    await manager.softDelete(Lead, { tenantId, id: loserId });
    return { winnerBefore, loserRow };
  }

  private async mergeCompanies(
    manager: EntityManager,
    tenantId: string,
    winnerId: string,
    loserId: string,
    fieldMap: Record<string, 'winner' | 'loser'>,
    fillEmptyFields: boolean,
  ): Promise<DuplicateMergeSnapshot> {
    const [winner, loser] = await Promise.all([
      manager.findOneOrFail(Company, { where: { tenantId, id: winnerId } }),
      manager.findOneOrFail(Company, { where: { tenantId, id: loserId } }),
    ]);
    const winnerBefore = { ...winner };
    const loserRow = { ...loser };

    const mergeableFields: (keyof Company)[] = ['name', 'email', 'phone', 'website'] as any;

    for (const field of mergeableFields) {
      const choice = fieldMap[field as string];
      if (choice === 'loser' && loser[field]) {
        (winner as any)[field] = loser[field];
      } else if (fillEmptyFields && !winner[field] && loser[field]) {
        (winner as any)[field] = loser[field];
      }
    }

    await manager.save(winner);
    await manager.update(Lead, { tenantId, companyId: loserId }, { companyId: winnerId });
    await manager.update(Contact, { tenantId, companyId: loserId }, { companyId: winnerId });
    await manager.update(Project, { tenantId, companyId: loserId }, { companyId: winnerId });
    await manager.softDelete(Company, { tenantId, id: loserId });
    return { winnerBefore, loserRow };
  }

  private async mergeSales(
    manager: EntityManager,
    tenantId: string,
    winnerId: string,
    loserId: string,
    fieldMap: Record<string, 'winner' | 'loser'>,
  ): Promise<void> {
    const [winner, loser] = await Promise.all([
      manager.findOneOrFail(Sale, { where: { tenantId, id: winnerId } }),
      manager.findOneOrFail(Sale, { where: { tenantId, id: loserId } }),
    ]);

    const mergeableFields: (keyof Sale)[] = ['guestName', 'hotel', 'externalId', 'externalOrderNo'] as any;

    for (const field of mergeableFields) {
      const choice = fieldMap[field as string];
      if (choice === 'loser' && loser[field]) {
        (winner as any)[field] = loser[field];
      } else if (!winner[field] && loser[field]) {
        (winner as any)[field] = loser[field];
      }
    }

    await manager.save(winner);
    await manager.delete(Sale, { tenantId, id: loserId });
  }

  private async mergeSegments(
    manager: EntityManager,
    tenantId: string,
    winnerId: string,
    loserId: string,
    fieldMap: Record<string, 'winner' | 'loser'>,
  ): Promise<void> {
    const [winner, loser] = await Promise.all([
      manager.findOneOrFail(MarketingSegment, { where: { tenantId, id: winnerId } }),
      manager.findOneOrFail(MarketingSegment, { where: { tenantId, id: loserId } }),
    ]);

    const mergeableFields: (keyof MarketingSegment)[] = ['name', 'description'] as any;

    for (const field of mergeableFields) {
      const choice = fieldMap[field as string];
      if (choice === 'loser' && loser[field]) {
        (winner as any)[field] = loser[field];
      } else if (!winner[field] && loser[field]) {
        (winner as any)[field] = loser[field];
      }
    }

    await manager.save(winner);
    await manager.delete(MarketingSegment, { tenantId, id: loserId });
  }

  // ─── Undo ─────────────────────────────────────────────────────────────────

  /** Restores a merge — only possible for contact/lead/company (soft-deletable, and we captured
   * a snapshot at merge time). sale/segment merges hard-delete the loser row, so there is nothing
   * to restore; those pairs are left as 'merged' forever. */
  async undoMerge(tenantId: string, pairId: string, userId: string): Promise<DuplicatePair> {
    const pair = await this.pairRepo.findOne({ where: { tenantId, id: pairId } });
    if (!pair) throw new NotFoundException('Пара дублей не найдена');
    if (pair.status !== 'merged' || !pair.snapshot) {
      throw new BadRequestException('Это объединение нельзя отменить');
    }
    if (pair.entityType === 'sale' || pair.entityType === 'segment') {
      throw new BadRequestException('Объединения этого типа записей нельзя отменить — старая запись удалена без возможности восстановления');
    }

    const winnerId = pair.snapshot.winnerBefore.id as string;
    const loserId = pair.snapshot.loserRow.id as string;
    // Never write back id/tenantId/createdAt — only the mutable fields that merge() may have changed.
    const { id: _wId, tenantId: _wTenant, createdAt: _wCreated, ...winnerFields } = pair.snapshot.winnerBefore as any;

    const repo =
      pair.entityType === 'contact' ? this.contactRepo : pair.entityType === 'lead' ? this.leadRepo : this.companyRepo;

    await (repo as Repository<any>).restore({ tenantId, id: loserId });
    await (repo as Repository<any>).update({ tenantId, id: winnerId }, winnerFields);

    pair.status = 'undone';
    pair.resolvedAt = new Date();
    pair.resolvedBy = userId;
    return this.pairRepo.save(pair);
  }

  // ─── KPIs & history ─────────────────────────────────────────────────────────

  async getOverview(tenantId: string, entityType: DedupEntityType) {
    const [mergedTotal, entityTotal, { groups }] = await Promise.all([
      this.pairRepo.count({ where: { tenantId, entityType, status: 'merged' } }),
      this.countEntities(entityType, tenantId),
      this.getGroups(tenantId, entityType),
    ]);

    const groupsHighConfidence = groups.filter((g) => g.score >= 90).length;
    const recordsInvolved = new Set(groups.flatMap((g) => g.ids)).size;
    const duplicateRatePct = entityTotal > 0 ? Math.round((recordsInvolved / entityTotal) * 1000) / 10 : 0;

    return {
      groupsCount: groups.length,
      recordsInvolved,
      groupsHighConfidence,
      mergedTotal,
      duplicateRatePct,
      entityTotal,
    };
  }

  private async countEntities(entityType: DedupEntityType, tenantId: string): Promise<number> {
    if (entityType === 'contact') return this.contactRepo.count({ where: { tenantId } });
    if (entityType === 'lead') return this.leadRepo.count({ where: { tenantId } });
    if (entityType === 'company') return this.companyRepo.count({ where: { tenantId } });
    if (entityType === 'sale') return this.saleRepo.count({ where: { tenantId } });
    return this.segmentRepo.count({ where: { tenantId } });
  }

  async getHistory(
    tenantId: string,
    entityType?: DedupEntityType,
    limit = 50,
    offset = 0,
  ): Promise<{ items: DuplicatePair[]; total: number }> {
    const where: any = { tenantId };
    if (entityType) where.entityType = entityType;
    const [items, total] = await this.pairRepo.findAndCount({
      where: [
        { ...where, status: 'merged' },
        { ...where, status: 'ignored' },
        { ...where, status: 'undone' },
      ],
      order: { resolvedAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { items, total };
  }

  // ─── Nightly auto-merge (opt-in via DedupSettings.autoMergeThreshold) ──────

  /** Auto-merges only exact matches (score 100 — phone or email) at/above the tenant's
   * configured threshold, and only for contact/lead — never company (names legitimately repeat
   * across unrelated legal entities far more often) and never sale/segment (hard-delete, would be
   * unrecoverable if wrong). Master = oldest/newest record per the tenant's masterRule. */
  async runNightlyAutoMerge(): Promise<{ tenantsProcessed: number; merged: number }> {
    // TypeORM can't express "IS NOT NULL" via find() options cleanly — use the query builder.
    const settingsRows = await this.settingsRepo
      .createQueryBuilder('s')
      .where('s."autoMergeThreshold" IS NOT NULL')
      .getMany();

    let merged = 0;
    for (const settings of settingsRows) {
      for (const entityType of ['contact', 'lead'] as DedupEntityType[]) {
        await this.scan(settings.tenantId, entityType);
        const { groups } = await this.getGroups(settings.tenantId, entityType);
        for (const group of groups) {
          if (group.score < 100 || group.score < (settings.autoMergeThreshold ?? 101)) continue;
          const sorted = [...group.records].sort((a: any, b: any) => {
            const da = new Date(a.createdAt).getTime();
            const db = new Date(b.createdAt).getTime();
            return settings.masterRule === 'newest' ? db - da : da - db;
          });
          const winner = sorted[0] as any;
          for (const loser of sorted.slice(1)) {
            try {
              await this.merge(
                settings.tenantId,
                { entityType, winnerId: winner.id, loserId: (loser as any).id, fieldMap: {} },
                'system',
              );
              merged++;
            } catch {
              // best-effort — skip this pair, keep going with the rest of the tenant's queue
            }
          }
        }
      }
    }
    return { tenantsProcessed: settingsRows.length, merged };
  }
}
