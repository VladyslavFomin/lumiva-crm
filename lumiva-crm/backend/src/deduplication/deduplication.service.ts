import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DuplicatePair, DedupEntityType } from './duplicate-pair.entity';
import { Contact } from '../contacts/contact.entity';
import { Lead } from '../leads/lead.entity';
import { Company } from '../companies/company.entity';
import { Sale } from '../sales/sale.entity';
import { MarketingSegment } from '../marketing/marketing-segment.entity';
import { MergeDto } from './dto/merge.dto';

export interface ScanResult {
  scanned: number;
  found: number;
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
   * Возвращает score 0–100 для пары записей.
   * 100 = точное совпадение email или phone, 0 = нет совпадений.
   */
  private scoreContacts(a: Contact, b: Contact): number {
    const ea = this.normEmail(a.email), eb = this.normEmail(b.email);
    if (ea && ea === eb) return 100;

    const pa = this.normPhone(a.phone), pb = this.normPhone(b.phone);
    if (pa && pa === pb && pa.length >= 7) return 100;

    const na = this.normName(`${a.firstName} ${a.lastName}`);
    const nb = this.normName(`${b.firstName} ${b.lastName}`);
    if (!na || !nb) return 0;

    const maxLen = Math.max(na.length, nb.length);
    if (maxLen === 0) return 0;
    const dist = this.levenshtein(na, nb);
    const similarity = Math.round((1 - dist / maxLen) * 100);
    return similarity >= 75 ? similarity : 0;
  }

  private scoreLeads(a: Lead, b: Lead): number {
    const ea = this.normEmail(a.email), eb = this.normEmail(b.email);
    if (ea && ea === eb) return 100;

    const pa = this.normPhone(a.phone), pb = this.normPhone(b.phone);
    if (pa && pa === pb && pa.length >= 7) return 100;

    const na = this.normName(a.name), nb = this.normName(b.name);
    if (!na || !nb) return 0;

    const maxLen = Math.max(na.length, nb.length);
    if (maxLen === 0) return 0;
    const dist = this.levenshtein(na, nb);
    const similarity = Math.round((1 - dist / maxLen) * 100);
    return similarity >= 80 ? similarity : 0;
  }

  private scoreCompanies(a: Company, b: Company): number {
    const ea = this.normEmail(a.email), eb = this.normEmail(b.email);
    if (ea && ea === eb) return 100;

    const pa = this.normPhone(a.phone), pb = this.normPhone(b.phone);
    if (pa && pa === pb && pa.length >= 7) return 100;

    const na = this.normName(a.name), nb = this.normName(b.name);
    if (!na || !nb) return 0;

    const maxLen = Math.max(na.length, nb.length);
    if (maxLen === 0) return 0;
    const dist = this.levenshtein(na, nb);
    const similarity = Math.round((1 - dist / maxLen) * 100);
    return similarity >= 80 ? similarity : 0;
  }

  private scoreSales(a: Sale, b: Sale): number {
    if (a.externalId && a.externalId === b.externalId) return 100;
    if (a.externalOrderNo && a.externalOrderNo === b.externalOrderNo) return 100;
    const na = this.normName(a.guestName), nb = this.normName(b.guestName);
    if (!na || !nb) return 0;
    const sameHotel = this.normName(a.hotel) === this.normName(b.hotel) && !!a.hotel;
    const sameAmount = a.amount === b.amount;
    const aDate = a.saleDate ? new Date(a.saleDate).toDateString() : null;
    const bDate = b.saleDate ? new Date(b.saleDate).toDateString() : null;
    const sameDate = aDate && aDate === bDate;
    if (sameHotel && sameAmount && sameDate) return 95;
    const maxLen = Math.max(na.length, nb.length);
    const sim = Math.round((1 - this.levenshtein(na, nb) / maxLen) * 100);
    return sim >= 90 && sameHotel ? sim : 0;
  }

  private scoreSegments(a: MarketingSegment, b: MarketingSegment): number {
    const na = this.normName(a.name), nb = this.normName(b.name);
    if (!na || !nb) return 0;
    if (na === nb) return 100;
    const maxLen = Math.max(na.length, nb.length);
    const sim = Math.round((1 - this.levenshtein(na, nb) / maxLen) * 100);
    return sim >= 85 ? sim : 0;
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
      select: ['id', 'firstName', 'lastName', 'email', 'phone'],
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
    scorer: (a: T, b: T) => number,
  ): Promise<ScanResult> {
    let found = 0;
    const pairs: Partial<DuplicatePair>[] = [];

    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const score = scorer(items[i], items[j]);
        if (score >= 75) {
          const [aId, bId] = [items[i].id, items[j].id].sort();
          pairs.push({ tenantId, entityType, entityAId: aId, entityBId: bId, score });
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

  // ─── Merge ────────────────────────────────────────────────────────────────

  async merge(tenantId: string, dto: MergeDto, userId: string): Promise<{ merged: true }> {
    const { entityType, winnerId, loserId, fieldMap } = dto;
    if (winnerId === loserId) throw new BadRequestException('winnerId и loserId должны отличаться');

    if (entityType === 'contact') {
      await this.mergeContacts(tenantId, winnerId, loserId, fieldMap ?? {});
    } else if (entityType === 'lead') {
      await this.mergeLeads(tenantId, winnerId, loserId, fieldMap ?? {});
    } else if (entityType === 'sale') {
      await this.mergeSales(tenantId, winnerId, loserId, fieldMap ?? {});
    } else if (entityType === 'segment') {
      await this.mergeSegments(tenantId, winnerId, loserId, fieldMap ?? {});
    } else {
      await this.mergeCompanies(tenantId, winnerId, loserId, fieldMap ?? {});
    }

    // Помечаем все пары с этими сущностями как merged
    await this.pairRepo
      .createQueryBuilder()
      .update(DuplicatePair)
      .set({ status: 'merged', resolvedAt: new Date(), resolvedBy: userId })
      .where('tenantId = :tenantId AND entityType = :et', { tenantId, et: entityType })
      .andWhere('(entityAId = :a OR entityBId = :a OR entityAId = :b OR entityBId = :b)', {
        a: winnerId,
        b: loserId,
      })
      .execute();

    return { merged: true };
  }

  private async mergeContacts(
    tenantId: string,
    winnerId: string,
    loserId: string,
    fieldMap: Record<string, 'winner' | 'loser'>,
  ): Promise<void> {
    const [winner, loser] = await Promise.all([
      this.contactRepo.findOneOrFail({ where: { tenantId, id: winnerId } }),
      this.contactRepo.findOneOrFail({ where: { tenantId, id: loserId } }),
    ]);

    const mergeableFields: (keyof Contact)[] = [
      'firstName', 'lastName', 'email', 'phone', 'position', 'telegram',
    ] as any;

    for (const field of mergeableFields) {
      const choice = fieldMap[field as string];
      const source = choice === 'loser' ? loser : winner;
      const target = winner;
      if (choice === 'loser' && source[field]) {
        (target as any)[field] = source[field];
      } else if (!target[field] && loser[field]) {
        (target as any)[field] = loser[field];
      }
    }

    await this.contactRepo.save(winner);
    await this.contactRepo.softDelete({ tenantId, id: loserId });
  }

  private async mergeLeads(
    tenantId: string,
    winnerId: string,
    loserId: string,
    fieldMap: Record<string, 'winner' | 'loser'>,
  ): Promise<void> {
    const [winner, loser] = await Promise.all([
      this.leadRepo.findOneOrFail({ where: { tenantId, id: winnerId } }),
      this.leadRepo.findOneOrFail({ where: { tenantId, id: loserId } }),
    ]);

    const mergeableFields: (keyof Lead)[] = ['name', 'email', 'phone'] as any;

    for (const field of mergeableFields) {
      const choice = fieldMap[field as string];
      if (choice === 'loser' && loser[field]) {
        (winner as any)[field] = loser[field];
      } else if (!winner[field] && loser[field]) {
        (winner as any)[field] = loser[field];
      }
    }

    await this.leadRepo.save(winner);
    await this.leadRepo.softDelete({ tenantId, id: loserId });
  }

  private async mergeCompanies(
    tenantId: string,
    winnerId: string,
    loserId: string,
    fieldMap: Record<string, 'winner' | 'loser'>,
  ): Promise<void> {
    const [winner, loser] = await Promise.all([
      this.companyRepo.findOneOrFail({ where: { tenantId, id: winnerId } }),
      this.companyRepo.findOneOrFail({ where: { tenantId, id: loserId } }),
    ]);

    const mergeableFields: (keyof Company)[] = ['name', 'email', 'phone', 'website'] as any;

    for (const field of mergeableFields) {
      const choice = fieldMap[field as string];
      if (choice === 'loser' && loser[field]) {
        (winner as any)[field] = loser[field];
      } else if (!winner[field] && loser[field]) {
        (winner as any)[field] = loser[field];
      }
    }

    await this.companyRepo.save(winner);
    await this.companyRepo.softDelete({ tenantId, id: loserId });
  }

  private async mergeSales(
    tenantId: string,
    winnerId: string,
    loserId: string,
    fieldMap: Record<string, 'winner' | 'loser'>,
  ): Promise<void> {
    const [winner, loser] = await Promise.all([
      this.saleRepo.findOneOrFail({ where: { tenantId, id: winnerId } }),
      this.saleRepo.findOneOrFail({ where: { tenantId, id: loserId } }),
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

    await this.saleRepo.save(winner);
    await this.saleRepo.delete({ tenantId, id: loserId });
  }

  private async mergeSegments(
    tenantId: string,
    winnerId: string,
    loserId: string,
    fieldMap: Record<string, 'winner' | 'loser'>,
  ): Promise<void> {
    const [winner, loser] = await Promise.all([
      this.segmentRepo.findOneOrFail({ where: { tenantId, id: winnerId } }),
      this.segmentRepo.findOneOrFail({ where: { tenantId, id: loserId } }),
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

    await this.segmentRepo.save(winner);
    await this.segmentRepo.delete({ tenantId, id: loserId });
  }
}
