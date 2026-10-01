import { Injectable, PayloadTooLargeException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { stat, unlink } from 'fs/promises';
import { Tenant } from '../tenants/tenant.entity';
import { getTotalStorageQuotaBytes } from '../tenants/storage-quota.util';
import { sumTenantUploadsBytesOnDisk } from '../common/uploads-root.util';

/**
 * Лимит хранилища по тарифу (3/5/10 ГБ + докупка). Объём считаем по диску, а не по
 * tenants.storage_used_bytes: тот счётчик делит квоту AI-памяти и не знает о файлах модулей.
 */
@Injectable()
export class StorageQuotaService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  private async quotaBytes(tenantId: string): Promise<number | null> {
    const tenant = await this.tenantRepo.findOne({
      where: { id: tenantId },
      select: ['id', 'plan', 'storageExtraBytes'],
    });
    if (!tenant) return null;
    return getTotalStorageQuotaBytes(tenant.plan, Number(tenant.storageExtraBytes || 0));
  }

  private fail(): never {
    throw new PayloadTooLargeException({
      code: 'STORAGE_FULL',
      message:
        'Хранилище компании заполнено. Удалите ненужные файлы или докупите объём в «Настройки компании → Хранилище».',
    });
  }

  /** До записи: хватит ли места ещё на `addBytes` (для буферов в памяти и генерируемых файлов). */
  async assertCanAdd(tenantId: string, addBytes: number): Promise<void> {
    if (!tenantId || addBytes <= 0) return;
    const quota = await this.quotaBytes(tenantId);
    if (quota === null) return;
    const used = await sumTenantUploadsBytesOnDisk(tenantId);
    if (used + addBytes > quota) this.fail();
  }

  /**
   * После multer diskStorage файл уже на диске и входит в подсчёт: если вылезли за лимит —
   * удаляем его и отказываем.
   */
  async assertAfterWrite(tenantId: string, absPath: string | undefined | null): Promise<void> {
    if (!tenantId || !absPath) return;
    const quota = await this.quotaBytes(tenantId);
    if (quota === null) return;
    const used = await sumTenantUploadsBytesOnDisk(tenantId);
    if (used <= quota) return;
    const st = await stat(absPath).catch(() => null);
    if (!st) return;
    await unlink(absPath).catch(() => undefined);
    this.fail();
  }
}
