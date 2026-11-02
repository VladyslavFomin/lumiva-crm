import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BookingPass } from './booking-pass.entity';
import { Reservation, ReservationStatus } from './reservation.entity';
import { BookingProject } from './booking-project.entity';
import { zonedParts, safeTimeZone } from './booking-time.util';

/** Сегодня в поясе проекта, YYYY-MM-DD. */
export function todayYmd(tz?: string | null): string {
  return zonedParts(new Date(), safeTimeZone(tz)).ymd;
}

/**
 * Списание/возврат посещений абонемента по броням. Вынесено отдельно (зависит только от
 * репозиториев), чтобы ReservationsService мог вызывать его на любой смене статуса —
 * отметка «пришёл» из карточки брони, из ростера занятия или из ИИ-чата списывает одинаково.
 */
@Injectable()
export class BookingsPassLedgerService {
  constructor(
    @InjectRepository(BookingPass)
    private readonly passRepo: Repository<BookingPass>,
    @InjectRepository(Reservation)
    private readonly reservationsRepo: Repository<Reservation>,
  ) {}

  /** Актуализирует статус по сроку/остатку (ленивая «экспирация» без крона). */
  normalize(pass: BookingPass, today: string): BookingPass {
    if (pass.status === 'cancelled' || pass.status === 'frozen') return pass;
    if (pass.expiresAt < today) pass.status = 'expired';
    else if (pass.kind === 'visits' && pass.visitsTotal != null && pass.visitsUsed >= pass.visitsTotal) pass.status = 'used_up';
    else pass.status = 'active';
    return pass;
  }

  isUsableFor(pass: BookingPass, serviceId: string | null, onDate: string): boolean {
    if (pass.status !== 'active') return false;
    if (pass.startsAt > onDate || pass.expiresAt < onDate) return false;
    if (pass.kind === 'visits' && pass.visitsTotal != null && pass.visitsUsed >= pass.visitsTotal) return false;
    if (serviceId && pass.serviceIds?.length && !pass.serviceIds.includes(serviceId)) return false;
    return true;
  }

  /** Подходящий активный абонемент клиента (самый скоро истекающий — честнее для клиента). */
  async findUsable(
    tenantId: string,
    contactId: string | null,
    serviceId: string | null,
    onDate: string,
  ): Promise<BookingPass | null> {
    if (!contactId) return null;
    const passes = await this.passRepo.find({ where: { tenantId, contactId }, order: { expiresAt: 'ASC' } });
    for (const p of passes) {
      this.normalize(p, onDate);
      if (this.isUsableFor(p, serviceId, onDate)) return p;
    }
    return null;
  }

  async charge(tenantId: string, reservation: Reservation): Promise<void> {
    if (!reservation.passId || reservation.passVisitCharged) return;
    const pass = await this.passRepo.findOne({ where: { id: reservation.passId, tenantId } });
    if (!pass) return;
    if (pass.kind === 'visits') {
      pass.visitsUsed += 1;
      if (pass.visitsTotal != null && pass.visitsUsed >= pass.visitsTotal) pass.status = 'used_up';
    }
    await this.passRepo.save(pass);
    reservation.passVisitCharged = true;
    await this.reservationsRepo.update({ id: reservation.id, tenantId }, { passVisitCharged: true });
  }

  async refund(tenantId: string, reservation: Reservation): Promise<void> {
    if (!reservation.passId || !reservation.passVisitCharged) return;
    const pass = await this.passRepo.findOne({ where: { id: reservation.passId, tenantId } });
    if (pass && pass.kind === 'visits') {
      pass.visitsUsed = Math.max(0, pass.visitsUsed - 1);
      if (pass.status === 'used_up') pass.status = 'active';
      await this.passRepo.save(pass);
    }
    reservation.passVisitCharged = false;
    await this.reservationsRepo.update({ id: reservation.id, tenantId }, { passVisitCharged: false });
  }

  /** Политика списания по смене статуса брони (настройки вертикали проекта). */
  async onStatus(project: BookingProject, reservation: Reservation, status: ReservationStatus): Promise<void> {
    if (!reservation.passId) return;
    const vs = project.verticalSettings || {};
    const tenantId = project.tenantId;
    if (status === 'checked_in' || status === 'in_progress' || status === 'completed') {
      await this.charge(tenantId, reservation);
      return;
    }
    if (status === 'no_show') {
      if (vs.noShowChargesVisit !== false) await this.charge(tenantId, reservation);
      else await this.refund(tenantId, reservation);
      return;
    }
    if (status === 'cancelled_by_business' || status === 'rejected') {
      await this.refund(tenantId, reservation);
      return;
    }
    if (status === 'cancelled_by_customer') {
      const lateHours = vs.lateCancelHours ?? 12;
      const late = reservation.startAt.getTime() - Date.now() < lateHours * 3600_000;
      if (late && vs.passChargeOn === 'booking') return; // поздняя отмена — посещение сгорает
      if (late && (vs.passChargeOn ?? 'attendance') === 'attendance') {
        // при списании «по посещению» поздняя отмена тоже сжигает посещение
        await this.charge(tenantId, reservation);
        return;
      }
      await this.refund(tenantId, reservation);
    }
  }

  async onCreated(project: BookingProject, reservation: Reservation): Promise<void> {
    if (!reservation.passId) return;
    if ((project.verticalSettings || {}).passChargeOn === 'booking') {
      await this.charge(project.tenantId, reservation);
    }
  }
}
