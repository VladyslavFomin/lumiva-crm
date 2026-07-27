import { forwardRef, Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BookingWaitlistEntry } from './booking-waitlist-entry.entity';
import { BookingsProjectsService } from './bookings-projects.service';
import { ReservationsService } from './reservations.service';
import { AutomationsService } from '../automations/automations.service';
import { TriggerEvent } from '../automations/automation.entity';

@Injectable()
export class BookingsWaitlistService {
  constructor(
    @InjectRepository(BookingWaitlistEntry)
    private readonly repo: Repository<BookingWaitlistEntry>,
    private readonly projects: BookingsProjectsService,
    private readonly reservations: ReservationsService,
    @Inject(forwardRef(() => AutomationsService))
    private readonly automationsService: AutomationsService,
  ) {}

  async list(tenantId: string, status?: string): Promise<BookingWaitlistEntry[]> {
    return this.repo.find({
      where: status ? { tenantId, status: status as any } : { tenantId },
      order: { createdAt: 'ASC' },
    });
  }

  async create(
    tenantId: string,
    dto: {
      locationId?: string;
      serviceId?: string;
      preferredStaffUserId?: string;
      customerName?: string;
      customerPhone?: string;
      customerEmail?: string;
      preferredWindow?: string;
      participants?: number;
      priority?: BookingWaitlistEntry['priority'];
    },
  ): Promise<BookingWaitlistEntry> {
    const project = await this.projects.getOrCreateDefaultProject(tenantId);
    const { leadId, contactId } = await this.reservations.resolveLeadAndContact(tenantId, {
      name: dto.customerName,
      phone: dto.customerPhone,
      email: dto.customerEmail,
    });
    const entry = this.repo.create({
      tenantId,
      projectId: project.id,
      locationId: dto.locationId || null,
      serviceId: dto.serviceId || null,
      preferredStaffUserId: dto.preferredStaffUserId || null,
      leadId,
      contactId,
      customerName: dto.customerName || null,
      customerPhone: dto.customerPhone || null,
      customerEmail: dto.customerEmail || null,
      preferredWindow: dto.preferredWindow || null,
      participants: dto.participants || 1,
      priority: dto.priority || 'normal',
      status: 'waiting',
    });
    const saved = await this.repo.save(entry);

    try {
      await this.automationsService.triggerAutomation(tenantId, TriggerEvent.BOOKING_WAITLIST_ENTRY_CREATED, {
        entityType: 'waitlist_entry',
        entityId: saved.id,
        waitlistEntry: saved,
      });
    } catch (error) {
      console.error('Failed to trigger automation:', error);
    }

    return saved;
  }

  async updatePriority(
    tenantId: string,
    id: string,
    priority: BookingWaitlistEntry['priority'],
  ): Promise<BookingWaitlistEntry> {
    const entry = await this.findOne(tenantId, id);
    entry.priority = priority;
    return this.repo.save(entry);
  }

  async remove(tenantId: string, id: string): Promise<BookingWaitlistEntry> {
    const entry = await this.findOne(tenantId, id);
    entry.status = 'removed';
    return this.repo.save(entry);
  }

  async offerSlot(
    tenantId: string,
    id: string,
    dto: { startAt: string; endAt: string },
  ): Promise<BookingWaitlistEntry> {
    const entry = await this.findOne(tenantId, id);
    entry.status = 'offer';
    entry.offeredStartAt = new Date(dto.startAt);
    entry.offeredEndAt = new Date(dto.endAt);
    return this.repo.save(entry);
  }

  async convertToReservation(
    tenantId: string,
    id: string,
    actingStaffUserId: string | null,
  ) {
    const entry = await this.findOne(tenantId, id);
    if (!entry.locationId) {
      throw new BadRequestException('Waitlist entry has no location — cannot convert');
    }
    if (!entry.offeredStartAt || !entry.offeredEndAt) {
      throw new BadRequestException('Offer a slot before converting to a reservation');
    }
    const reservation = await this.reservations.create(
      tenantId,
      {
        locationId: entry.locationId,
        serviceId: entry.serviceId || undefined,
        staffUserId: entry.preferredStaffUserId || undefined,
        startAt: entry.offeredStartAt.toISOString(),
        endAt: entry.offeredEndAt.toISOString(),
        participants: entry.participants,
        customerName: entry.customerName || undefined,
        customerPhone: entry.customerPhone || undefined,
        customerEmail: entry.customerEmail || undefined,
        source: 'manual',
      },
      actingStaffUserId,
    );
    entry.status = 'confirmed';
    entry.convertedReservationId = reservation.id;
    await this.repo.save(entry);
    return reservation;
  }

  private async findOne(tenantId: string, id: string): Promise<BookingWaitlistEntry> {
    const entry = await this.repo.findOne({ where: { id, tenantId } });
    if (!entry) throw new NotFoundException('Waitlist entry not found');
    return entry;
  }
}
