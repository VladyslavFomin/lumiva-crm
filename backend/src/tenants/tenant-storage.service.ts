import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { unlink } from 'fs/promises';

import { joinUploadsAbsolute } from '../common/uploads-root.util';

import { Tenant } from './tenant.entity';
import { TenantStorageFile } from './tenant-storage-file.entity';
import { User } from '../users/user.entity';
import { StaffUser } from '../staff/staff-user.entity';
import { isItDepartmentStaff } from './tenant-storage.util';

function numBytes(v: string | bigint | null | undefined): number {
  if (v === undefined || v === null) return 0;
  const n = typeof v === 'bigint' ? Number(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function subBytesString(current: string | undefined, delta: number): string {
  const a = BigInt(current || '0');
  const b = BigInt(delta);
  const r = a - b;
  return (r < 0n ? 0n : r).toString();
}

@Injectable()
export class TenantStorageService {
  constructor(
    @InjectRepository(TenantStorageFile)
    private readonly fileRepo: Repository<TenantStorageFile>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(StaffUser)
    private readonly staffRepo: Repository<StaffUser>,
  ) {}

  async canUserDeleteStorage(
    tenantId: string,
    userId: string,
  ): Promise<boolean> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || user.tenantId !== tenantId) return false;
    if ((user.role || '').toLowerCase() === 'owner') return true;
    const staff = await this.staffRepo.findOne({
      where: { tenantId, email: user.email },
      relations: ['departmentEntity'],
    });
    return isItDepartmentStaff(staff);
  }

  /**
   * Удаление записи из tenant_storage_files + квота (без проверки роли).
   */
  async deleteCompanyFileUnsafe(tenantId: string, fileId: string): Promise<void> {
    const row = await this.fileRepo.findOne({ where: { id: fileId } });
    if (!row || row.tenantId !== tenantId) {
      throw new NotFoundException('File not found');
    }

    const abs = joinUploadsAbsolute(row.relativePath);
    try {
      await unlink(abs);
    } catch {
      /* файл уже удалён */
    }

    const size = numBytes(row.sizeBytes as any);
    await this.fileRepo.remove(row);

    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (tenant) {
      tenant.storageUsedBytes = subBytesString(tenant.storageUsedBytes as any, size);
      await this.tenantRepo.save(tenant);
    }
  }
}
