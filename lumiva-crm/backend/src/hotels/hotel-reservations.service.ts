import { BadRequestException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  HotelReservation,
  HotelReservationGuest,
  HotelReservationPaidStatus,
  HotelReservationPayment,
  HotelReservationStatus,
} from './hotel-reservation.entity';
import { normalizeNumericInput } from './hotel-number.util';
import { Hotel } from './hotel.entity';
import { HotelRoomType } from './hotel-room-type.entity';
import { HotelRoomUnit } from './hotel-room-unit.entity';
import { HotelRoomTypesService } from './hotel-room-types.service';
import { AutomationsService } from '../automations/automations.service';
import { TriggerEvent } from '../automations/automation.entity';
import { AuditLogService } from '../audit-log/audit-log.service';
import { HotelAvailabilityService } from './hotel-availability.service';
import { renderHotelFolioPdf } from './hotel-folio-pdf.util';
import { MailService } from '../mail/mail.service';

export interface HotelReservationWriteOptions {
  /** Never populated from the HTTP request body — set only by the reservation-import flow for
   * historical data, mirroring Booking's import precedent. The only other bypass is hotel-level
   * Hotel.allowOverbooking. */
  skipValidation?: boolean;
}

export interface HotelReservationFilters {
  hotelId?: string;
  roomTypeId?: string;
  agencyId?: string;
  status?: string;
  market?: string;
  search?: string;
}

function toNum(v: string | number | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.max(1, Math.round(ms / 86_400_000));
}

export interface HotelReservationInput {
  hotelId: string;
  roomTypeId: string;
  agencyId?: string | null;
  roomUnitId?: string | null;
  occupancyTypeId?: string | null;
  guestName: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
  pax?: number;
  market?: string | null;
  checkIn: string;
  checkOut: string;
  costPerNight?: string;
  ppPerNight?: string;
  grossPerNight?: string;
  discountPct?: string;
  status?: HotelReservationStatus;
  paidStatus?: HotelReservationPaidStatus;
  source?: 'manual' | 'import';
  depositAmount?: string;
  earlyCheckIn?: boolean;
  lateCheckOut?: boolean;
  notes?: string | null;
  guests?: HotelReservationGuest[];
}

const PRICE_FIELDS = ['costPerNight', 'ppPerNight', 'grossPerNight', 'discountPct'] as const;

@Injectable()
export class HotelReservationsService {
  constructor(
    @InjectRepository(HotelReservation)
    private readonly repo: Repository<HotelReservation>,
    @InjectRepository(Hotel)
    private readonly hotelRepo: Repository<Hotel>,
    @InjectRepository(HotelRoomType)
    private readonly roomTypeRepo: Repository<HotelRoomType>,
    @InjectRepository(HotelRoomUnit)
    private readonly roomUnitsRepo: Repository<HotelRoomUnit>,
    private readonly roomTypesService: HotelRoomTypesService,
    @Inject(forwardRef(() => AutomationsService))
    private readonly automationsService: AutomationsService,
    private readonly auditLog: AuditLogService,
    private readonly availability: HotelAvailabilityService,
    private readonly mail: MailService,
  ) {}

  /** Проверяет заполняемость типа номера за месяц заезда и, если она достигла/превысила
   * порог отеля (Hotel.riskThresholdWarnPct, тот же порог, что у теплокарты в аналитике),
   * шлёт HOTEL_LOW_AVAILABILITY. Срабатывает при создании/отмене брони — без отдельного
   * планировщика (см. план: "fire-on-write, not a new cron"). */
  private async checkLowAvailability(tenantId: string, reservation: HotelReservation, adminEmails: string[]) {
    try {
      const [year, month] = reservation.checkIn.split('-').map(Number);
      const monthStats = await this.roomTypesService.getMonthFillStats(tenantId, reservation.roomTypeId, year, month - 1);
      const hotel = await this.hotelRepo.findOne({ where: { id: reservation.hotelId, tenantId } });
      const warnPct = toNum(hotel?.riskThresholdWarnPct) || 65;
      if (monthStats.occupancyPct >= warnPct) {
        await this.automationsService.triggerAutomation(tenantId, TriggerEvent.HOTEL_LOW_AVAILABILITY, {
          entityType: 'hotel_room_type',
          entityId: reservation.roomTypeId,
          hotel,
          monthStats,
          adminEmails,
        });
      }
    } catch (error) {
      console.error('Failed to trigger automation:', error);
    }
  }

  async list(tenantId: string, filters: HotelReservationFilters) {
    const qb = this.repo.createQueryBuilder('r').where('r.tenantId = :tenantId', { tenantId });
    if (filters.hotelId) qb.andWhere('r.hotelId = :hotelId', { hotelId: filters.hotelId });
    if (filters.roomTypeId) qb.andWhere('r.roomTypeId = :roomTypeId', { roomTypeId: filters.roomTypeId });
    if (filters.agencyId) qb.andWhere('r.agencyId = :agencyId', { agencyId: filters.agencyId });
    if (filters.status) qb.andWhere('r.status = :status', { status: filters.status });
    if (filters.market) qb.andWhere('r.market = :market', { market: filters.market });
    if (filters.search) {
      qb.andWhere('(r.guestName ILIKE :search)', { search: `%${filters.search}%` });
    }
    qb.orderBy('r.createdAt', 'DESC');
    return qb.getMany();
  }

  async get(tenantId: string, id: string) {
    const row = await this.repo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Бронь не найдена');
    return row;
  }

  private computeTotals(row: HotelReservation) {
    const nights = nightsBetween(row.checkIn, row.checkOut);
    row.ppTotal = String(round2(toNum(row.ppPerNight) * nights));
    row.roomTotal = String(round2(toNum(row.grossPerNight) * nights));
    row.total = String(round2(toNum(row.roomTotal) * (1 - toNum(row.discountPct) / 100)));
  }

  async create(
    tenantId: string,
    dto: HotelReservationInput,
    actorUserId?: string | null,
    options: HotelReservationWriteOptions = {},
  ) {
    if (!options.skipValidation) {
      const result = await this.availability.checkAvailability({
        tenantId,
        roomTypeId: dto.roomTypeId,
        checkIn: dto.checkIn,
        checkOut: dto.checkOut,
      });
      if (!result.ok) throw new BadRequestException(result.reason);
    }

    const row = this.repo.create({
      tenantId,
      hotelId: dto.hotelId,
      roomTypeId: dto.roomTypeId,
      agencyId: dto.agencyId ?? null,
      roomUnitId: dto.roomUnitId ?? null,
      occupancyTypeId: dto.occupancyTypeId ?? null,
      guestName: dto.guestName,
      guestEmail: dto.guestEmail ?? null,
      guestPhone: dto.guestPhone ?? null,
      pax: dto.pax ?? 1,
      market: dto.market ?? null,
      checkIn: dto.checkIn,
      checkOut: dto.checkOut,
      costPerNight: normalizeNumericInput(dto.costPerNight),
      ppPerNight: normalizeNumericInput(dto.ppPerNight),
      grossPerNight: normalizeNumericInput(dto.grossPerNight),
      discountPct: normalizeNumericInput(dto.discountPct),
      status: dto.status ?? 'confirmed',
      paidStatus: dto.paidStatus ?? 'none',
      source: dto.source ?? 'manual',
      depositAmount: dto.depositAmount !== undefined ? normalizeNumericInput(dto.depositAmount) : '0',
      earlyCheckIn: dto.earlyCheckIn ?? false,
      lateCheckOut: dto.lateCheckOut ?? false,
      notes: dto.notes ?? null,
      guests: dto.guests ?? [],
    });
    this.computeTotals(row);
    const saved = await this.repo.save(row);

    try {
      const [hotel, roomType, adminEmails] = await Promise.all([
        this.hotelRepo.findOne({ where: { id: saved.hotelId, tenantId } }),
        this.roomTypeRepo.findOne({ where: { id: saved.roomTypeId, tenantId } }),
        this.automationsService.resolveAdminEmails(tenantId),
      ]);
      await this.automationsService.triggerAutomation(tenantId, TriggerEvent.HOTEL_RESERVATION_CREATED, {
        entityType: 'hotel_reservation',
        entityId: saved.id,
        reservation: saved,
        hotel,
        roomType,
        adminEmails,
        ...this.buildNotificationTokens(saved, hotel, roomType),
      });
      await this.checkLowAvailability(tenantId, saved, adminEmails);
    } catch (error) {
      console.error('Failed to trigger automation:', error);
    }

    void this.auditLog.log({
      tenantId,
      entityType: 'hotel_reservation',
      entityId: saved.id,
      entityLabel: saved.guestName,
      action: 'create',
      summary: 'Бронь отеля создана',
      actorUserId: actorUserId ?? null,
    });

    return saved;
  }

  async update(
    tenantId: string,
    id: string,
    dto: Partial<HotelReservationInput>,
    actorUserId?: string | null,
    options: HotelReservationWriteOptions = {},
  ) {
    const row = await this.get(tenantId, id);
    const fromStatus = row.status;
    const priceFieldsChanged = PRICE_FIELDS.some(
      (key) => dto[key] !== undefined && normalizeNumericInput(dto[key]) !== row[key],
    );
    const datesOrRoomChanged =
      (dto.checkIn !== undefined && dto.checkIn !== row.checkIn) ||
      (dto.checkOut !== undefined && dto.checkOut !== row.checkOut) ||
      (dto.roomTypeId !== undefined && dto.roomTypeId !== row.roomTypeId);

    if (datesOrRoomChanged && !options.skipValidation) {
      const result = await this.availability.checkAvailability({
        tenantId,
        roomTypeId: dto.roomTypeId ?? row.roomTypeId,
        checkIn: dto.checkIn ?? row.checkIn,
        checkOut: dto.checkOut ?? row.checkOut,
        excludeReservationId: id,
      });
      if (!result.ok) throw new BadRequestException(result.reason);
    }

    const normalized = { ...dto };
    for (const key of PRICE_FIELDS) {
      if (normalized[key] !== undefined) normalized[key] = normalizeNumericInput(normalized[key]);
    }
    if (normalized.depositAmount !== undefined) normalized.depositAmount = normalizeNumericInput(normalized.depositAmount);
    Object.assign(row, normalized);
    this.computeTotals(row);
    const saved = await this.repo.save(row);

    try {
      const adminEmails = await this.automationsService.resolveAdminEmails(tenantId);
      const statusChanged = dto.status !== undefined && dto.status !== fromStatus;
      let hotel: Hotel | null = null;
      let roomType: HotelRoomType | null = null;
      if (statusChanged || priceFieldsChanged) {
        [hotel, roomType] = await Promise.all([
          this.hotelRepo.findOne({ where: { id: saved.hotelId, tenantId } }),
          this.roomTypeRepo.findOne({ where: { id: saved.roomTypeId, tenantId } }),
        ]);
      }
      if (dto.status !== undefined && dto.status !== fromStatus) {
        await this.automationsService.triggerAutomation(tenantId, TriggerEvent.HOTEL_RESERVATION_STATUS_CHANGED, {
          entityType: 'hotel_reservation',
          entityId: id,
          reservation: saved,
          fromStatus,
          toStatus: saved.status,
          adminEmails,
          ...this.buildNotificationTokens(saved, hotel, roomType),
        });
        if (saved.status === 'cancelled') {
          await this.checkLowAvailability(tenantId, saved, adminEmails);
        }
      }
      if (priceFieldsChanged) {
        await this.automationsService.triggerAutomation(tenantId, TriggerEvent.HOTEL_PRICE_CHANGED, {
          entityType: 'hotel_reservation',
          entityId: id,
          reservation: saved,
          ...this.buildNotificationTokens(saved, hotel, roomType),
        });
      }
    } catch (error) {
      console.error('Failed to trigger automation:', error);
    }

    void this.auditLog.log({
      tenantId,
      entityType: 'hotel_reservation',
      entityId: saved.id,
      entityLabel: saved.guestName,
      action: 'update',
      summary: dto.status !== undefined && dto.status !== fromStatus
        ? `Статус брони изменён: ${fromStatus} → ${saved.status}`
        : 'Бронь отеля обновлена',
      changes: dto.status !== undefined && dto.status !== fromStatus
        ? [{ field: 'status', oldValue: fromStatus, newValue: saved.status }]
        : null,
      actorUserId: actorUserId ?? null,
    });

    return saved;
  }

  /** Fires HOTEL_RESERVATION_STATUS_CHANGED — shared by update() (generic status field edit) and
   * checkIn()/checkOut() (dedicated front-desk actions) so the automation-trigger logic isn't
   * duplicated across all three status-changing call sites. */
  private async fireStatusChangeTrigger(
    tenantId: string,
    saved: HotelReservation,
    fromStatus: HotelReservationStatus,
  ) {
    try {
      const adminEmails = await this.automationsService.resolveAdminEmails(tenantId);
      const [hotel, roomType] = await Promise.all([
        this.hotelRepo.findOne({ where: { id: saved.hotelId, tenantId } }),
        this.roomTypeRepo.findOne({ where: { id: saved.roomTypeId, tenantId } }),
      ]);
      await this.automationsService.triggerAutomation(tenantId, TriggerEvent.HOTEL_RESERVATION_STATUS_CHANGED, {
        entityType: 'hotel_reservation',
        entityId: saved.id,
        reservation: saved,
        fromStatus,
        toStatus: saved.status,
        adminEmails,
        ...this.buildNotificationTokens(saved, hotel, roomType),
      });
    } catch (error) {
      console.error('Failed to trigger automation:', error);
    }
  }

  async checkIn(tenantId: string, id: string, roomUnitId: string | null | undefined, actorUserId?: string | null) {
    const row = await this.get(tenantId, id);
    if (row.status === 'checked_in') throw new BadRequestException('Гость уже заселён');
    if (row.status === 'cancelled') throw new BadRequestException('Бронь отменена');

    if (roomUnitId) {
      const unit = await this.roomUnitsRepo.findOne({
        where: { id: roomUnitId, tenantId, roomTypeId: row.roomTypeId, active: true },
      });
      if (!unit) throw new BadRequestException('Номер не найден или не принадлежит этому типу номера');
      row.roomUnitId = roomUnitId;
    }

    const fromStatus = row.status;
    row.status = 'checked_in';
    row.checkedInAt = new Date();
    const saved = await this.repo.save(row);

    await this.fireStatusChangeTrigger(tenantId, saved, fromStatus);

    void this.auditLog.log({
      tenantId,
      entityType: 'hotel_reservation',
      entityId: saved.id,
      entityLabel: saved.guestName,
      action: 'update',
      summary: 'Гость заселён',
      changes: [{ field: 'status', oldValue: fromStatus, newValue: saved.status }],
      actorUserId: actorUserId ?? null,
    });

    return saved;
  }

  async checkOut(tenantId: string, id: string, actorUserId?: string | null) {
    const row = await this.get(tenantId, id);
    if (row.status !== 'checked_in') throw new BadRequestException('Бронь не в статусе «Заселён»');

    const fromStatus = row.status;
    row.status = 'checked_out';
    row.checkedOutAt = new Date();
    const saved = await this.repo.save(row);

    await this.fireStatusChangeTrigger(tenantId, saved, fromStatus);

    void this.auditLog.log({
      tenantId,
      entityType: 'hotel_reservation',
      entityId: saved.id,
      entityLabel: saved.guestName,
      action: 'update',
      summary: 'Гость выселен',
      changes: [{ field: 'status', oldValue: fromStatus, newValue: saved.status }],
      actorUserId: actorUserId ?? null,
    });

    return saved;
  }

  /** none/partial/full from Σpayments vs total — never overwrites a manually-set 'refunded'
   * state. paidStatus stays directly editable via update() too, so staff can always override. */
  private suggestPaidStatus(row: HotelReservation): HotelReservationPaidStatus {
    const paid = row.payments.reduce((s, p) => s + toNum(p.amount), 0);
    const total = toNum(row.total);
    if (paid <= 0) return 'none';
    if (paid >= total) return 'full';
    return 'partial';
  }

  async addPayment(
    tenantId: string,
    id: string,
    payment: { date: string; amount: string; method: string; note?: string | null },
    actorUserId?: string | null,
  ) {
    const row = await this.get(tenantId, id);
    const entry: HotelReservationPayment = {
      id: randomUUID(),
      date: payment.date,
      amount: normalizeNumericInput(payment.amount),
      method: payment.method,
      note: payment.note ?? null,
    };
    row.payments = [...row.payments, entry];
    if (row.paidStatus !== 'refunded') row.paidStatus = this.suggestPaidStatus(row);
    const saved = await this.repo.save(row);

    void this.auditLog.log({
      tenantId,
      entityType: 'hotel_reservation',
      entityId: saved.id,
      entityLabel: saved.guestName,
      action: 'update',
      summary: `Платёж добавлен: ${entry.amount}`,
      actorUserId: actorUserId ?? null,
    });

    return saved;
  }

  async removePayment(tenantId: string, id: string, paymentId: string, actorUserId?: string | null) {
    const row = await this.get(tenantId, id);
    row.payments = row.payments.filter((p) => p.id !== paymentId);
    if (row.paidStatus !== 'refunded') row.paidStatus = this.suggestPaidStatus(row);
    const saved = await this.repo.save(row);

    void this.auditLog.log({
      tenantId,
      entityType: 'hotel_reservation',
      entityId: saved.id,
      entityLabel: saved.guestName,
      action: 'update',
      summary: 'Платёж удалён',
      actorUserId: actorUserId ?? null,
    });

    return saved;
  }

  async renderFolio(tenantId: string, id: string) {
    const reservation = await this.get(tenantId, id);
    const [hotel, roomType] = await Promise.all([
      this.hotelRepo.findOne({ where: { id: reservation.hotelId, tenantId } }),
      this.roomTypeRepo.findOne({ where: { id: reservation.roomTypeId, tenantId } }),
    ]);
    return renderHotelFolioPdf(reservation, hotel, roomType);
  }

  async sendFolioEmail(tenantId: string, id: string) {
    const reservation = await this.get(tenantId, id);
    if (!reservation.guestEmail) {
      throw new BadRequestException('У брони нет email гостя — добавьте его, чтобы отправить счёт');
    }
    const [hotel, roomType] = await Promise.all([
      this.hotelRepo.findOne({ where: { id: reservation.hotelId, tenantId } }),
      this.roomTypeRepo.findOne({ where: { id: reservation.roomTypeId, tenantId } }),
    ]);
    const buffer = await renderHotelFolioPdf(reservation, hotel, roomType);

    await this.mail.sendMail({
      to: reservation.guestEmail,
      subject: `Счёт по брони — ${hotel?.name || 'отель'}`,
      html: `<p>Здравствуйте, ${reservation.guestName}!</p><p>Во вложении счёт по вашей брони (${reservation.checkIn} — ${reservation.checkOut}).</p>`,
      attachments: [{ filename: `folio-${id}.pdf`, content: buffer.toString('base64') }],
    });

    void this.auditLog.log({
      tenantId,
      entityType: 'hotel_reservation',
      entityId: reservation.id,
      entityLabel: reservation.guestName,
      action: 'update',
      summary: `Счёт отправлен на ${reservation.guestEmail}`,
      actorUserId: null,
    });

    return { ok: true };
  }

  async remove(tenantId: string, id: string, actorUserId?: string | null) {
    const row = await this.get(tenantId, id);
    await this.repo.remove(row);
    void this.auditLog.log({
      tenantId,
      entityType: 'hotel_reservation',
      entityId: id,
      entityLabel: row.guestName,
      action: 'delete',
      summary: 'Бронь отеля удалена',
      actorUserId: actorUserId ?? null,
    });
    return { ok: true };
  }

  /**
   * Плоские токены для текста уведомлений в автоматизациях ({{guest_name}}, {{room_type}}, ...) —
   * та же идея, что и у токенов бронирований (см. ReservationsService.buildNotificationTokens),
   * чтобы конструктор автоматизаций одинаково выглядел для Бронирований и Hotels/PMS.
   */
  private buildNotificationTokens(
    reservation: HotelReservation,
    hotel: Hotel | null,
    roomType: HotelRoomType | null,
  ): Record<string, string> {
    return {
      guest_name: reservation.guestName || '',
      room_type: roomType?.name || '',
      check_in: reservation.checkIn,
      check_out: reservation.checkOut,
      hotel_name: hotel?.name || '',
      booking_id: reservation.id,
      status: reservation.status,
    };
  }
}
