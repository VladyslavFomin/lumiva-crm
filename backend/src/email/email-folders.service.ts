import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailFolder } from './email-folder.entity';
import { EmailAccount } from './email-account.entity';
import { EmailMessage } from './email-message.entity';

export type SystemFolderKey = 'inbox' | 'sent' | 'trash';

@Injectable()
export class EmailFoldersService {
  constructor(
    @InjectRepository(EmailFolder)
    private readonly folderRepo: Repository<EmailFolder>,
    @InjectRepository(EmailAccount)
    private readonly accountRepo: Repository<EmailAccount>,
    @InjectRepository(EmailMessage)
    private readonly messageRepo: Repository<EmailMessage>,
  ) {}

  private async assertAccount(tenantId: string, accountId: string): Promise<void> {
    const a = await this.accountRepo.findOne({
      where: { id: accountId, tenantId },
    });
    if (!a) throw new NotFoundException('Email account not found');
  }

  /**
   * Создаёт системные папки, если их ещё нет.
   */
  async ensureSystemFolders(
    tenantId: string,
    accountId: string,
  ): Promise<Record<SystemFolderKey, string>> {
    await this.assertAccount(tenantId, accountId);
    const existing = await this.folderRepo.find({
      where: { tenantId, accountId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    const byKey = (k: SystemFolderKey) =>
      existing.find((f) => f.systemKey === k);

    const mk = async (
      name: string,
      key: SystemFolderKey,
      order: number,
    ): Promise<EmailFolder> => {
      const row = this.folderRepo.create({
        tenantId,
        accountId,
        parentId: null,
        name,
        systemKey: key,
        sortOrder: order,
      });
      return this.folderRepo.save(row);
    };

    let inbox = byKey('inbox');
    if (!inbox) inbox = await mk('Входящие', 'inbox', 0);
    let sent = byKey('sent');
    if (!sent) sent = await mk('Отправленные', 'sent', 1);
    let trash = byKey('trash');
    if (!trash) trash = await mk('Корзина', 'trash', 2);

    return { inbox: inbox.id, sent: sent.id, trash: trash.id };
  }

  async getFolderIdForSystemKey(
    tenantId: string,
    accountId: string,
    key: SystemFolderKey,
  ): Promise<string> {
    const map = await this.ensureSystemFolders(tenantId, accountId);
    return map[key];
  }

  async findFolder(
    tenantId: string,
    folderId: string,
  ): Promise<EmailFolder | null> {
    return this.folderRepo.findOne({ where: { id: folderId, tenantId } });
  }

  async listTree(tenantId: string, accountId: string): Promise<EmailFolder[]> {
    await this.ensureSystemFolders(tenantId, accountId);
    return this.folderRepo.find({
      where: { tenantId, accountId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  async createUserFolder(
    tenantId: string,
    accountId: string,
    name: string,
    parentId?: string | null,
  ): Promise<EmailFolder> {
    await this.assertAccount(tenantId, accountId);
    const trimmed = (name || '').trim();
    if (!trimmed) throw new BadRequestException('Folder name required');
    if (parentId) {
      const parent = await this.folderRepo.findOne({
        where: { id: parentId, tenantId, accountId },
      });
      if (!parent) throw new NotFoundException('Parent folder not found');
    }
    const maxSort = await this.folderRepo
      .createQueryBuilder('f')
      .select('MAX(f.sortOrder)', 'm')
      .where('f.tenantId = :tid AND f.accountId = :aid', {
        tid: tenantId,
        aid: accountId,
      })
      .andWhere('f.parentId IS NOT DISTINCT FROM :pid', {
        pid: parentId ?? null,
      })
      .getRawOne();
    const next = Number(maxSort?.m ?? -1) + 1;
    const row = this.folderRepo.create({
      tenantId,
      accountId,
      parentId: parentId ?? null,
      name: trimmed,
      systemKey: null,
      sortOrder: next,
    });
    return this.folderRepo.save(row);
  }

  async renameFolder(
    tenantId: string,
    folderId: string,
    name: string,
  ): Promise<EmailFolder> {
    const f = await this.folderRepo.findOne({
      where: { id: folderId, tenantId },
    });
    if (!f) throw new NotFoundException('Folder not found');
    if (f.systemKey)
      throw new BadRequestException('Cannot rename system folder');
    const trimmed = (name || '').trim();
    if (!trimmed) throw new BadRequestException('Folder name required');
    f.name = trimmed;
    return this.folderRepo.save(f);
  }

  async deleteFolder(tenantId: string, folderId: string): Promise<void> {
    const f = await this.folderRepo.findOne({
      where: { id: folderId, tenantId },
    });
    if (!f) throw new NotFoundException('Folder not found');
    if (f.systemKey)
      throw new BadRequestException('Cannot delete system folder');
    const children = await this.folderRepo.count({
      where: { tenantId, parentId: folderId },
    });
    if (children > 0)
      throw new BadRequestException('Remove subfolders first');
    const inboxId = await this.getFolderIdForSystemKey(
      tenantId,
      f.accountId,
      'inbox',
    );
    await this.messageRepo.update(
      { tenantId, crmFolderId: folderId },
      { crmFolderId: inboxId },
    );
    await this.folderRepo.remove(f);
  }

  async moveFolder(
    tenantId: string,
    folderId: string,
    parentId: string | null,
    sortOrder?: number,
  ): Promise<EmailFolder> {
    const f = await this.folderRepo.findOne({
      where: { id: folderId, tenantId },
    });
    if (!f) throw new NotFoundException('Folder not found');
    if (f.systemKey && parentId !== null)
      throw new BadRequestException('System folders stay at root');
    if (parentId) {
      if (parentId === folderId)
        throw new BadRequestException('Invalid parent');
      const parent = await this.folderRepo.findOne({
        where: { id: parentId, tenantId, accountId: f.accountId },
      });
      if (!parent) throw new NotFoundException('Parent folder not found');
      let walk: string | null = parentId;
      while (walk) {
        if (walk === folderId)
          throw new BadRequestException('Circular folder parent');
        const p = await this.folderRepo.findOne({
          where: { id: walk, tenantId },
        });
        walk = p?.parentId ?? null;
      }
    }
    f.parentId = parentId;
    if (sortOrder !== undefined) f.sortOrder = sortOrder;
    return this.folderRepo.save(f);
  }

  async reorderFolders(
    tenantId: string,
    accountId: string,
    items: Array<{ id: string; sortOrder: number; parentId?: string | null }>,
  ): Promise<void> {
    await this.assertAccount(tenantId, accountId);
    for (const it of items) {
      const f = await this.folderRepo.findOne({
        where: { id: it.id, tenantId, accountId },
      });
      if (!f) continue;
      if (f.systemKey) {
        f.sortOrder = it.sortOrder;
        await this.folderRepo.save(f);
        continue;
      }
      if (it.parentId !== undefined) f.parentId = it.parentId;
      f.sortOrder = it.sortOrder;
      await this.folderRepo.save(f);
    }
  }
}
