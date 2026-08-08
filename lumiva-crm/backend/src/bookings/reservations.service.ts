import { forwardRef, Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reservation, ReservationStatus } from './reservation.entity';
import { ReservationActivity, ReservationActivityType } from './reservation-activity.entity';
import { Lead } from '../leads/lead.entity';
import { Contact } from '../contacts/contact.entity';
import { StaffUser } from '../staff/staff-user.entity';
import { BookingService } from './booking-service.entity';
import { BookingLocation } from './booking-location.entity';
import { BookingsProjectsService } from './bookings-projects.service';
import { BookingsAvailabilityService } from './bookings-availability.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AutomationsService } from '../automations/automations.service';
import { TriggerEvent } from '../automations/automation.entity';

export interface ReservationListFilters {
  status?: string;
  locationId?: string;
  serviceId?: string;
  staffUserId?: string;
  assignedUserId?: string;
  source?: string;
  from?: string;
  to?: string;
  search?: string;
}

export interface CustomerStats {
  visits: number;
  cancellations: number;
  noShows: number;
  ltv: number;
  lastVisit: string | null;
  tags: string[];
}

export interface ResolveLeadAndContactInput {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private readonly repo: Repository<Reservation>,
    @InjectRepository(ReservationActivity)
    private readonly activityRepo: Repository<ReservationActivity>,
    @InjectRepository(Lead)
    private readonly leadsRepo: Repository<Lead>,
    @InjectRepository(Contact)
    private readonly contactsRepo: Repository<Contact>,
    @InjectRepository(StaffUser)
    private readonly staffRepo: Repository<StaffUser>,
    @InjectRepository(BookingService)
    private readonly servicesRepo: Repository<BookingService>,
    @InjectRepository(BookingLocation)
    private readonly locationsRepo: Repository<BookingLocation>,
    private readonly projects: BookingsProjectsService,
    private readonly availability: BookingsAvailabilityService,
    private readonly notifications: NotificationsService,
    @Inject(forwardRef(() => AutomationsService))
    private readonly automationsService: AutomationsService,
  ) {}

  /* ---------- список / детали ---------- */

  async list(tenantId: string, filters: ReservationListFilters): Promise<Reservation[]> {
    const qb = this.repo
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId', { tenantId })
      .orderBy('r.startAt', 'ASC');

    if (filters.status) qb.andWhere('r.status = :status', { status: filters.status });
    if (filters.locationId) qb.andWhere('r.locationId = :locationId', { locationId: filters.locationId });
    if (filters.serviceId) qb.andWhere('r.serviceId = :serviceId', { serviceId: filters.serviceId });
    if (filters.staffUserId) qb.andWhere('r.staffUserId = :staffUserId', { staffUserId: filters.staffUserId });
    if (filters.assignedUserId) qb.andWhere('r.assignedUserId = :assignedUserId', { assignedUserId: filters.assignedUserId });
    if (filters.source) qb.andWhere('r.source = :source', { source: filters.source });
    if (filters.from) qb.andWhere('r.startAt >= :from', { from: new Date(filters.from) });
    if (filters.to) qb.andWhere('r.startAt <= :to', { to: new Date(filters.to) });
    if (filters.search) {
      qb.andWhere(
        '(r.customerName ILIKE :search OR r.customerPhone ILIKE :search OR r.customerEmail ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    return qb.getMany();
  }

  async findOne(tenantId: string, id: string): Promise<Reservation> {
    const reservation = await this.repo.findOne({ where: { id, tenantId } });
    if (!reservation) throw new NotFoundException('Reservation not found');
    return reservation;
  }

  /**
   * Тенант-wide лента активности броней — реальные события (создание, смена статуса,
   * перенос и т.д.), уже пишутся в ReservationActivity. Для "Логов" v1 отдаём этот
   * журнал как есть, без выдумывания коннектор/уведомление-логов, которых пока
   * физически нет (см. lumiva_booking_module memory).
   */
  async listLogs(tenantId: string, limit = 100): Promise<ReservationActivity[]> {
    return this.activityRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['user', 'reservation'],
    });
  }

  /** История клиента по contactId — питает ClientDrawer в списке "Броней". */
  async getCustomerStats(tenantId: string, contactId: string): Promise<CustomerStats> {
    const [reservations, contact] = await Promise.all([
      this.repo.find({ where: { tenantId, contactId }, order: { startAt: 'DESC' } }),
      this.contactsRepo.findOne({ where: { id: contactId, tenantId } }),
    ]);
    const visits = reservations.filter((r) => ['completed', 'checked_in'].includes(r.status)).length;
    const cancellations = reservations.filter(
      (r) => r.status === 'cancelled_by_customer' || r.status === 'cancelled_by_business',
    ).length;
    const noShows = reservations.filter((r) => r.status === 'no_show').length;
    const ltv = reservations
      .filter((r) => r.status === 'completed')
      .reduce((sum, r) => sum + Number(r.price || 0), 0);
    return {
      visits,
      cancellations,
      noShows,
      ltv,
      lastVisit: reservations[0]?.startAt.toISOString() || null,
      tags: contact?.tags || [],
    };
  }

  /** Все брони конкретного лида — для блока "Информация о бронировании" в карточке лида. */
  async listByLead(tenantId: string, leadId: string): Promise<Reservation[]> {
    return this.repo.find({
      where: { tenantId, leadId },
      order: { startAt: 'DESC' },
    });
  }

  /**
   * Ближайшая будущая активная бронь на лид, для всех лидов тенанта сразу — питает
   * колонку "Ближайшая бронь" и сохранённый фильтр "Лиды с предстоящими бронями" в
   * списке лидов, без изменений в самом Leads-модуле.
   */
  async listUpcomingByLead(tenantId: string): Promise<Record<string, Reservation>> {
    const rows = await this.repo
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere('r.leadId IS NOT NULL')
      .andWhere('r.startAt >= :now', { now: new Date() })
      .andWhere('r.status IN (:...statuses)', {
        statuses: ['pending', 'confirmed', 'checked_in', 'in_progress'],
      })
      .orderBy('r.startAt', 'ASC')
      .getMany();

    const byLead: Record<string, Reservation> = {};
    for (const r of rows) {
      if (r.leadId && !byLead[r.leadId]) byLead[r.leadId] = r;
    }
    return byLead;
  }

  async getActivity(tenantId: string, reservationId: string): Promise<ReservationActivity[]> {
    return this.activityRepo.find({
      where: { tenantId, reservationId },
      order: { createdAt: 'ASC' },
      relations: ['user'],
    });
  }

  /* ---------- Lead/Contact matching (ключевое требование клиента) ---------- */

  /**
   * Ищет Contact по телефону/email (совпадение приоритетнее по телефону) — если не нашёл,
   * создаёт новый. Затем ищет активный Lead, связанный с этим контактом — если нет,
   * создаёт новый с source='booking'. Возвращает { leadId, contactId }.
   */
  async resolveLeadAndContact(
    tenantId: string,
    input: ResolveLeadAndContactInput,
  ): Promise<{ leadId: string; contactId: string }> {
    const phone = input.phone?.trim() || null;
    const email = input.email?.trim().toLowerCase() || null;
    const name = input.name?.trim() || null;

    let contact: Contact | null = null;
    if (phone) {
      contact = await this.contactsRepo.findOne({ where: { tenantId, phone } });
    }
    if (!contact && email) {
      contact = await this.contactsRepo.findOne({ where: { tenantId, email } });
    }
    if (!contact) {
      contact = await this.contactsRepo.save(
        this.contactsRepo.create({
          tenantId,
          fullName: name,
          firstName: name,
          phone,
          email,
          status: 'active',
        }),
      );
    }

    let lead = await this.leadsRepo.findOne({
      where: { tenantId, contactId: contact.id },
      order: { createdAt: 'DESC' },
    });
    if (!lead) {
      lead = await this.leadsRepo.save(
        this.leadsRepo.create({
          tenantId,
          contactId: contact.id,
          name: name || contact.fullName,
          phone,
          email,
          status: 'new',
          source: 'booking',
        }),
      );
    }

    return { leadId: lead.id, contactId: contact.id };
  }

  /* ---------- создание / изменение ---------- */

  async create(
    tenantId: string,
    dto: {
      locationId: string;
      serviceId?: string;
      staffUserId?: string;
      resourceId?: string;
      startAt: string;
      endAt: string;
      participants?: number;
      customerName?: string;
      customerPhone?: string;
      customerEmail?: string;
      source?: Reservation['source'];
      price?: string;
      currency?: string;
      customFields?: Record<string, any>;
      assignedUserId?: string;
    },
    actingStaffUserId: string | null,
    options: { skipValidation?: boolean } = {},
  ): Promise<Reservation> {
    const project = await this.projects.getOrCreateDefaultProject(tenantId);
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    if (!(startAt < endAt)) {
      throw new BadRequestException('startAt must be before endAt');
    }

    // Правила проекта (мин. уведомление / горизонт) применяются к само-сервисным источникам
    // (сайт, API, Telegram) — у ресепшн/менеджера при ручном создании (walk-in, звонок) есть
    // право переопределить их собственным суждением, как и в дизайн-брифе. Массовый импорт
    // (см. reservations-import.service.ts) исторических/внешних броней тоже освобождён —
    // options.skipValidation полностью отключает и это, и проверку конфликтов ниже, иначе
    // прошлые даты и совпадения с уже импортированными строками валили бы весь файл.
    if (!options.skipValidation && dto.source && dto.source !== 'manual') {
      const rulesCheck = await this.availability.checkProjectRules(project, startAt);
      if (!rulesCheck.ok) throw new BadRequestException(rulesCheck.reason);
    }

    if (!options.skipValidation && !project.overbookingAllowed) {
      const conflict = await this.availability.checkConflict({
        tenantId,
        staffUserId: dto.staffUserId,
        resourceId: dto.resourceId,
        startAt,
        endAt,
      });
      if (!conflict.ok) throw new BadRequestException(conflict.reason);
    }

    const { leadId, contactId } = await this.resolveLeadAndContact(tenantId, {
      name: dto.customerName,
      phone: dto.customerPhone,
      email: dto.customerEmail,
    });

    const reservation = this.repo.create({
      tenantId,
      projectId: project.id,
      locationId: dto.locationId,
      serviceId: dto.serviceId || null,
      staffUserId: dto.staffUserId || null,
      resourceId: dto.resourceId || null,
      leadId,
      contactId,
      customerName: dto.customerName || null,
      customerPhone: dto.customerPhone || null,
      customerEmail: dto.customerEmail || null,
      startAt,
      endAt,
      participants: dto.participants || 1,
      status: project.confirmationMode === 'auto' ? 'confirmed' : 'pending',
      confirmationStatus: project.confirmationMode === 'auto' ? 'confirmed' : 'pending',
      source: dto.source || 'manual',
      price: dto.price || null,
      currency: dto.currency || project.currency,
      customFields: dto.customFields || null,
      assignedUserId: dto.assignedUserId || actingStaffUserId || null,
    });
    const saved = await this.repo.save(reservation);

    await this.logActivity(tenantId, saved.id, 'created', actingStaffUserId, 'Бронь создана');
    try {
      const [adminEmails, tokens] = await Promise.all([
        this.automationsService.resolveAdminEmails(tenantId),
        this.buildNotificationTokens(saved),
      ]);
      await this.automationsService.triggerAutomation(tenantId, TriggerEvent.BOOKING_RESERVATION_CREATED, {
        entityType: 'reservation',
        entityId: saved.id,
        reservation: saved,
        adminEmails,
        ...tokens,
      });
    } catch (error) {
      console.error('Failed to trigger automation:', error);
    }

    return saved;
  }

  async update(
    tenantId: string,
    id: string,
    dto: Partial<Reservation>,
    actingStaffUserId: string | null,
  ): Promise<Reservation> {
    const reservation = await this.findOne(tenantId, id);
    const previousStartAt = reservation.startAt;
    const rescheduling =
      (dto.startAt && new Date(dto.startAt).getTime() !== reservation.startAt.getTime()) ||
      (dto.endAt && new Date(dto.endAt).getTime() !== reservation.endAt.getTime());

    if (rescheduling) {
      const startAt = dto.startAt ? new Date(dto.startAt) : reservation.startAt;
      const endAt = dto.endAt ? new Date(dto.endAt) : reservation.endAt;
      const conflict = await this.availability.checkConflict({
        tenantId,
        staffUserId: dto.staffUserId ?? reservation.staffUserId,
        resourceId: dto.resourceId ?? reservation.resourceId,
        startAt,
        endAt,
        excludeReservationId: id,
      });
      if (!conflict.ok) throw new BadRequestException(conflict.reason);
    }

    const { id: _id, tenantId: _t, createdAt, updatedAt, ...rest } = dto as any;
    Object.assign(reservation, rest);
    const saved = await this.repo.save(reservation);

    if (rescheduling) {
      await this.logActivity(tenantId, id, 'rescheduled', actingStaffUserId, 'Бронь перенесена');
      try {
        const [adminEmails, tokens] = await Promise.all([
          this.automationsService.resolveAdminEmails(tenantId),
          this.buildNotificationTokens(saved),
        ]);
        await this.automationsService.triggerAutomation(tenantId, TriggerEvent.BOOKING_RESERVATION_RESCHEDULED, {
          entityType: 'reservation',
          entityId: id,
          reservation: saved,
          previousStartAt,
          adminEmails,
          ...tokens,
        });
      } catch (error) {
        console.error('Failed to trigger automation:', error);
      }
    }

    return saved;
  }

  private async transition(
    tenantId: string,
    id: string,
    status: ReservationStatus,
    actingStaffUserId: string | null,
    description: string,
  ): Promise<Reservation> {
    const reservation = await this.findOne(tenantId, id);
    const fromStatus = reservation.status;
    reservation.status = status;
    const saved = await this.repo.save(reservation);
    await this.logActivity(
      tenantId,
      id,
      'status_changed',
      actingStaffUserId,
      description,
      fromStatus,
      status,
    );
    try {
      const [adminEmails, tokens] = await Promise.all([
        this.automationsService.resolveAdminEmails(tenantId),
        this.buildNotificationTokens(saved),
      ]);
      await this.automationsService.triggerAutomation(tenantId, TriggerEvent.BOOKING_RESERVATION_STATUS_CHANGED, {
        entityType: 'reservation',
        entityId: id,
        reservation: saved,
        fromStatus,
        toStatus: status,
        adminEmails,
        ...tokens,
      });
    } catch (error) {
      console.error('Failed to trigger automation:', error);
    }
    return saved;
  }

  confirm(tenantId: string, id: string, actingStaffUserId: string | null) {
    return this.transition(tenantId, id, 'confirmed', actingStaffUserId, 'Бронь подтверждена');
  }

  cancelByBusiness(tenantId: string, id: string, actingStaffUserId: string | null) {
    return this.transition(
      tenantId,
      id,
      'cancelled_by_business',
      actingStaffUserId,
      'Бронь отменена бизнесом',
    );
  }

  reject(tenantId: string, id: string, actingStaffUserId: string | null) {
    return this.transition(tenantId, id, 'rejected', actingStaffUserId, 'Бронь отклонена');
  }

  checkIn(tenantId: string, id: string, actingStaffUserId: string | null) {
    return this.transition(tenantId, id, 'checked_in', actingStaffUserId, 'Клиент отмечен как пришедший');
  }

  complete(tenantId: string, id: string, actingStaffUserId: string | null) {
    return this.transition(tenantId, id, 'completed', actingStaffUserId, 'Бронь завершена');
  }

  markNoShow(tenantId: string, id: string, actingStaffUserId: string | null) {
    return this.transition(tenantId, id, 'no_show', actingStaffUserId, 'Клиент отмечен как неявка');
  }

  /* ---------- вспомогательное ---------- */

  async findActingStaffUserId(tenantId: string, email?: string | null): Promise<string | null> {
    if (!email) return null;
    const staff = await this.staffRepo.findOne({
      where: { tenantId, email: email.toLowerCase() },
    });
    return staff?.id || null;
  }

  private async logActivity(
    tenantId: string,
    reservationId: string,
    type: ReservationActivityType,
    userId: string | null,
    description: string,
    fromValue?: string,
    toValue?: string,
  ): Promise<void> {
    await this.activityRepo.save(
      this.activityRepo.create({
        tenantId,
        reservationId,
        userId,
        type,
        description,
        fromValue: fromValue || null,
        toValue: toValue || null,
      }),
    );
  }

  /**
   * Плоские токены для текста уведомлений в автоматизациях ({{client_name}}, {{service}}, ...) —
   * имена намеренно совпадают с токенами бывшей страницы "Шаблоны сообщений" (удалена, см. историю),
   * чтобы тенанты, привыкшие к тем именам, могли использовать их и в конструкторе автоматизаций.
   */
  private async buildNotificationTokens(reservation: Reservation): Promise<Record<string, string>> {
    const [service, staff, location] = await Promise.all([
      reservation.serviceId
        ? this.servicesRepo.findOne({ where: { id: reservation.serviceId } })
        : Promise.resolve(null),
      reservation.staffUserId
        ? this.staffRepo.findOne({ where: { id: reservation.staffUserId } })
        : Promise.resolve(null),
      this.locationsRepo.findOne({ where: { id: reservation.locationId } }),
    ]);
    return {
      client_name: reservation.customerName || '',
      service: service?.name || '',
      date: reservation.startAt.toLocaleDateString('ru-RU'),
      time: reservation.startAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      staff: staff?.fullName || '',
      location_address: location?.address || location?.name || '',
      booking_id: reservation.id,
      status: reservation.status,
    };
  }
}
