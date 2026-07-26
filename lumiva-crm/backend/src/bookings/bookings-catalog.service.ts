import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BookingLocation, BookingLocationClosure } from './booking-location.entity';
import { BookingService } from './booking-service.entity';
import { BookingResource } from './booking-resource.entity';
import { BookingsProjectsService } from './bookings-projects.service';

/** CRUD для Locations/Services/Resources — v1 держит их в одном сервисе, как Products. */
@Injectable()
export class BookingsCatalogService {
  constructor(
    @InjectRepository(BookingLocation)
    private readonly locationsRepo: Repository<BookingLocation>,
    @InjectRepository(BookingService)
    private readonly servicesRepo: Repository<BookingService>,
    @InjectRepository(BookingResource)
    private readonly resourcesRepo: Repository<BookingResource>,
    private readonly projects: BookingsProjectsService,
  ) {}

  /* ---------- Locations ---------- */

  async listLocations(tenantId: string): Promise<BookingLocation[]> {
    return this.locationsRepo.find({
      where: { tenantId },
      order: { createdAt: 'ASC' },
    });
  }

  async createLocation(
    tenantId: string,
    dto: Partial<BookingLocation>,
  ): Promise<BookingLocation> {
    const project = await this.projects.getOrCreateDefaultProject(tenantId);
    const entity = this.locationsRepo.create({
      ...dto,
      tenantId,
      projectId: project.id,
    });
    return this.locationsRepo.save(entity);
  }

  async updateLocation(
    tenantId: string,
    id: string,
    dto: Partial<BookingLocation>,
  ): Promise<BookingLocation> {
    const entity = await this.locationsRepo.findOne({ where: { id, tenantId } });
    if (!entity) throw new NotFoundException('Location not found');
    const { id: _id, tenantId: _t, projectId: _p, ...rest } = dto as any;
    Object.assign(entity, rest);
    return this.locationsRepo.save(entity);
  }

  async deleteLocation(tenantId: string, id: string): Promise<void> {
    await this.locationsRepo.delete({ id, tenantId });
  }

  /** "Особые даты" — закрытый день / сокращённые часы локации. */
  async addLocationClosure(
    tenantId: string,
    locationId: string,
    closure: BookingLocationClosure,
  ): Promise<BookingLocation> {
    const location = await this.locationsRepo.findOne({ where: { id: locationId, tenantId } });
    if (!location) throw new NotFoundException('Location not found');
    location.closures = [...(location.closures || []), closure];
    return this.locationsRepo.save(location);
  }

  async removeLocationClosure(
    tenantId: string,
    locationId: string,
    index: number,
  ): Promise<BookingLocation> {
    const location = await this.locationsRepo.findOne({ where: { id: locationId, tenantId } });
    if (!location) throw new NotFoundException('Location not found');
    location.closures = (location.closures || []).filter((_, i) => i !== index);
    return this.locationsRepo.save(location);
  }

  /* ---------- Services ---------- */

  async listServices(tenantId: string): Promise<BookingService[]> {
    return this.servicesRepo.find({
      where: { tenantId },
      order: { createdAt: 'ASC' },
    });
  }

  async createService(
    tenantId: string,
    dto: Partial<BookingService>,
  ): Promise<BookingService> {
    const project = await this.projects.getOrCreateDefaultProject(tenantId);
    const entity = this.servicesRepo.create({
      ...dto,
      tenantId,
      projectId: project.id,
    });
    return this.servicesRepo.save(entity);
  }

  async updateService(
    tenantId: string,
    id: string,
    dto: Partial<BookingService>,
  ): Promise<BookingService> {
    const entity = await this.servicesRepo.findOne({ where: { id, tenantId } });
    if (!entity) throw new NotFoundException('Service not found');
    const { id: _id, tenantId: _t, projectId: _p, ...rest } = dto as any;
    Object.assign(entity, rest);
    return this.servicesRepo.save(entity);
  }

  async deleteService(tenantId: string, id: string): Promise<void> {
    await this.servicesRepo.delete({ id, tenantId });
  }

  /* ---------- Resources ---------- */

  async listResources(tenantId: string): Promise<BookingResource[]> {
    return this.resourcesRepo.find({
      where: { tenantId },
      order: { createdAt: 'ASC' },
    });
  }

  async createResource(
    tenantId: string,
    dto: Partial<BookingResource> & { locationId: string },
  ): Promise<BookingResource> {
    const project = await this.projects.getOrCreateDefaultProject(tenantId);
    const entity = this.resourcesRepo.create({
      ...dto,
      tenantId,
      projectId: project.id,
    });
    return this.resourcesRepo.save(entity);
  }

  async updateResource(
    tenantId: string,
    id: string,
    dto: Partial<BookingResource>,
  ): Promise<BookingResource> {
    const entity = await this.resourcesRepo.findOne({ where: { id, tenantId } });
    if (!entity) throw new NotFoundException('Resource not found');
    const { id: _id, tenantId: _t, projectId: _p, ...rest } = dto as any;
    Object.assign(entity, rest);
    return this.resourcesRepo.save(entity);
  }

  async deleteResource(tenantId: string, id: string): Promise<void> {
    await this.resourcesRepo.delete({ id, tenantId });
  }
}
