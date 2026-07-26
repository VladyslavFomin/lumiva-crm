import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BookingStaffProfile } from './booking-staff-profile.entity';
import { StaffUser } from '../staff/staff-user.entity';

export interface BookingStaffProfileWithUser extends BookingStaffProfile {
  staffUser?: Pick<StaffUser, 'id' | 'fullName' | 'email' | 'role' | 'avatarUrl'> | null;
}

@Injectable()
export class BookingsStaffService {
  constructor(
    @InjectRepository(BookingStaffProfile)
    private readonly repo: Repository<BookingStaffProfile>,
    @InjectRepository(StaffUser)
    private readonly staffRepo: Repository<StaffUser>,
  ) {}

  /** Список сотрудников тенанта + их booking-профиль (создаётся лениво при первом сохранении). */
  async listStaff(tenantId: string): Promise<BookingStaffProfileWithUser[]> {
    const [staffUsers, profiles] = await Promise.all([
      this.staffRepo.find({ where: { tenantId, isActive: true } }),
      this.repo.find({ where: { tenantId } }),
    ]);
    const profileByStaffId = new Map(profiles.map((p) => [p.staffUserId, p]));
    return staffUsers.map((su) => {
      const existing = profileByStaffId.get(su.id);
      const base: BookingStaffProfileWithUser = existing
        ? { ...existing }
        : ({
            id: '',
            tenantId,
            staffUserId: su.id,
            availableForBooking: false,
            assignedLocationIds: [],
            assignedServiceIds: [],
            weeklyAvailability: null,
            timeOff: [],
            maxSimultaneousBookings: 1,
            calendarColor: null,
            createdAt: su.createdAt,
            updatedAt: su.updatedAt,
          } as BookingStaffProfileWithUser);
      base.staffUser = {
        id: su.id,
        fullName: su.fullName,
        email: su.email,
        role: su.role,
        avatarUrl: su.avatarUrl,
      };
      return base;
    });
  }

  async upsertProfile(
    tenantId: string,
    staffUserId: string,
    dto: Partial<BookingStaffProfile>,
  ): Promise<BookingStaffProfile> {
    let profile = await this.repo.findOne({ where: { tenantId, staffUserId } });
    if (!profile) {
      profile = this.repo.create({ tenantId, staffUserId });
    }
    const { id: _id, tenantId: _t, staffUserId: _s, ...rest } = dto as any;
    Object.assign(profile, rest);
    return this.repo.save(profile);
  }
}
