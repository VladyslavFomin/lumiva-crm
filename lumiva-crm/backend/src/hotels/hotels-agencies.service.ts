import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HotelAgency, type HotelPartnerPaymentTerms, type HotelPartnerType } from './hotel-agency.entity';
import { HotelReservation } from './hotel-reservation.entity';
import { HotelContract } from './hotel-contract.entity';
import { normalizeCountry } from '../common/countries';

const TYPES: HotelPartnerType[] = ['tour_operator', 'ota', 'travel_agency', 'corporate', 'direct', 'other'];
const TERMS: HotelPartnerPaymentTerms[] = ['prepayment', 'on_arrival', 'postpayment'];

/** Типовые партнёры — только по кнопке «Добавить типовых» (раньше сеялись сами при первом открытии). */
const TYPICAL: Array<{ name: string; type: HotelPartnerType; countryCode: string | null }> = [
  { name: 'Booking.com', type: 'ota', countryCode: 'NL' },
  { name: 'Expedia', type: 'ota', countryCode: 'US' },
  { name: 'TUI', type: 'tour_operator', countryCode: 'DE' },
  { name: 'Anex Tour', type: 'tour_operator', countryCode: 'TR' },
  { name: 'Coral Travel', type: 'tour_operator', countryCode: 'TR' },
  { name: 'Pegas Touristik', type: 'tour_operator', countryCode: 'TR' },
  { name: 'Jet2holidays', type: 'tour_operator', countryCode: 'GB' },
];

export type HotelPartnerInput = Partial<
  Pick<
    HotelAgency,
    | 'name' | 'type' | 'status' | 'countryCode' | 'city' | 'code' | 'legalName' | 'taxId' | 'address' | 'contactName'
    | 'email' | 'phone' | 'website' | 'currency' | 'commissionPct' | 'paymentTerms' | 'paymentDays' | 'creditLimit' | 'notes'
  >
>;

const s = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const num = (v: unknown, min: number, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null;
};

@Injectable()
export class HotelsAgenciesService {
  constructor(
    @InjectRepository(HotelAgency)
    private readonly repo: Repository<HotelAgency>,
    @InjectRepository(HotelReservation)
    private readonly reservations: Repository<HotelReservation>,
    @InjectRepository(HotelContract)
    private readonly contracts: Repository<HotelContract>,
  ) {}

  /** Список партнёров. Раньше пустой тенант засевался туроператорами автоматически — теперь нет. */
  list(tenantId: string) {
    return this.repo.find({ where: { tenantId }, order: { status: 'ASC', name: 'ASC' } });
  }

  /** Список + сводка по броням и контрактам (для страницы «Партнёры»). */
  async listWithStats(tenantId: string) {
    const [partners, resRows, contractRows] = await Promise.all([
      this.list(tenantId),
      this.reservations
        .createQueryBuilder('r')
        .select('r.agencyId', 'agencyId')
        .addSelect('COUNT(*)::int', 'bookings')
        .addSelect(`COALESCE(SUM(CASE WHEN r.status NOT IN ('cancelled','no_show') THEN r.total ELSE 0 END), 0)`, 'gross')
        .addSelect(`COALESCE(SUM(CASE WHEN r.status NOT IN ('cancelled','no_show') THEN r.netTotal ELSE 0 END), 0)`, 'net')
        .addSelect(`COALESCE(SUM(CASE WHEN r.status NOT IN ('cancelled','no_show') THEN r.commissionAmount ELSE 0 END), 0)`, 'commission')
        .addSelect(`COUNT(*) FILTER (WHERE r.status IN ('cancelled','no_show'))::int`, 'cancelled')
        .addSelect('MAX(r.createdAt)', 'lastBookingAt')
        .where('r.tenantId = :tenantId', { tenantId })
        .andWhere('r.agencyId IS NOT NULL')
        .groupBy('r.agencyId')
        .getRawMany(),
      this.contracts
        .createQueryBuilder('c')
        .select('c.agencyId', 'agencyId')
        .addSelect(`COUNT(*) FILTER (WHERE c.status = 'active' AND c.validTo >= CURRENT_DATE)::int`, 'activeContracts')
        .where('c.tenantId = :tenantId', { tenantId })
        .groupBy('c.agencyId')
        .getRawMany(),
    ]);
    const res = new Map(resRows.map((r) => [r.agencyId, r]));
    const con = new Map(contractRows.map((r) => [r.agencyId, r]));
    return partners.map((p) => {
      const r = res.get(p.id);
      return {
        ...p,
        stats: {
          bookings: r ? Number(r.bookings) : 0,
          cancelled: r ? Number(r.cancelled) : 0,
          gross: r ? Number(r.gross) : 0,
          net: r ? Number(r.net) : 0,
          commission: r ? Number(r.commission) : 0,
          lastBookingAt: r?.lastBookingAt ?? null,
          activeContracts: con.get(p.id) ? Number(con.get(p.id).activeContracts) : 0,
        },
      };
    });
  }

  async get(tenantId: string, id: string) {
    const row = await this.repo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Партнёр не найден');
    return row;
  }

  private clean(dto: HotelPartnerInput): Partial<HotelAgency> {
    const out: Partial<HotelAgency> = {};
    if (dto.name !== undefined) {
      const name = s(dto.name, 255);
      if (!name) throw new BadRequestException('Название партнёра обязательно');
      out.name = name;
    }
    if (dto.type !== undefined) out.type = TYPES.includes(dto.type as HotelPartnerType) ? (dto.type as HotelPartnerType) : 'other';
    if (dto.status !== undefined) out.status = dto.status === 'archived' ? 'archived' : 'active';
    if (dto.countryCode !== undefined) out.countryCode = normalizeCountry(dto.countryCode);
    if (dto.paymentTerms !== undefined) out.paymentTerms = TERMS.includes(dto.paymentTerms) ? dto.paymentTerms : 'prepayment';
    if (dto.paymentDays !== undefined) out.paymentDays = Math.round(num(dto.paymentDays, 0, 365) ?? 0);
    if (dto.commissionPct !== undefined) out.commissionPct = String(num(dto.commissionPct, 0, 100) ?? 0);
    if (dto.creditLimit !== undefined) out.creditLimit = dto.creditLimit === null || dto.creditLimit === '' ? null : String(num(dto.creditLimit, 0, 1e12) ?? 0);
    if (dto.currency !== undefined) out.currency = s(dto.currency, 3)?.toUpperCase() ?? null;
    for (const [k, max] of [['city', 120], ['code', 32], ['legalName', 255], ['taxId', 64], ['contactName', 160], ['email', 190], ['phone', 64], ['website', 255]] as const) {
      if (dto[k] !== undefined) (out as any)[k] = s(dto[k], max);
    }
    if (dto.address !== undefined) out.address = s(dto.address, 2000);
    if (dto.notes !== undefined) out.notes = s(dto.notes, 5000);
    return out;
  }

  async create(tenantId: string, dto: HotelPartnerInput) {
    if (!s(dto?.name, 255)) throw new BadRequestException('Название партнёра обязательно');
    return this.repo.save(this.repo.create({ ...this.clean(dto), tenantId }));
  }

  async update(tenantId: string, id: string, dto: HotelPartnerInput) {
    const row = await this.get(tenantId, id);
    Object.assign(row, this.clean(dto));
    return this.repo.save(row);
  }

  /** Добавить типовых партнёров, которых ещё нет (по названию). */
  async addTypical(tenantId: string) {
    const existing = new Set((await this.list(tenantId)).map((p) => p.name.trim().toLowerCase()));
    const fresh = TYPICAL.filter((p) => !existing.has(p.name.toLowerCase()));
    if (fresh.length) await this.repo.save(fresh.map((p) => this.repo.create({ ...p, tenantId })));
    return this.list(tenantId);
  }

  /** С бронями или контрактами партнёр уходит в архив (история не теряется), без них — удаляется. */
  async remove(tenantId: string, id: string) {
    const row = await this.get(tenantId, id);
    const [bookings, contracts] = await Promise.all([
      this.reservations.count({ where: { tenantId, agencyId: id } }),
      this.contracts.count({ where: { tenantId, agencyId: id } }),
    ]);
    if (bookings || contracts) {
      row.status = 'archived';
      await this.repo.save(row);
      return { ok: true, archived: true };
    }
    await this.repo.remove(row);
    return { ok: true, archived: false };
  }
}
