import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { UserSession } from './user-session.entity';
import { User } from '../users/user.entity';

@Injectable()
export class UserSessionsService {
  constructor(
    @InjectRepository(UserSession)
    private readonly repo: Repository<UserSession>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async createSession(
    userId: string,
    tenantId: string,
    ip: string | null,
    userAgent: string | null,
  ): Promise<UserSession> {
    const now = new Date();
    const row = this.repo.create({
      userId,
      tenantId,
      ip,
      userAgent,
      lastSeenAt: now,
      revokedAt: null,
    });
    return this.repo.save(row);
  }

  async findActiveById(id: string): Promise<UserSession | null> {
    const s = await this.repo.findOne({ where: { id } });
    if (!s || s.revokedAt) return null;
    return s;
  }

  /**
   * Редко обновляет last_seen_at (чтобы не долбить БД на каждом запросе).
   */
  async touchSessionIfStale(sessionId: string): Promise<void> {
    const threshold = new Date(Date.now() - 2 * 60 * 1000);
    await this.repo
      .createQueryBuilder()
      .update(UserSession)
      .set({ lastSeenAt: () => 'NOW()' })
      .where('id = :id', { id: sessionId })
      .andWhere('revokedAt IS NULL')
      .andWhere('lastSeenAt < :threshold', { threshold })
      .execute();
  }

  async revokeAllForUser(tenantId: string, userId: string): Promise<number> {
    const res = await this.repo
      .createQueryBuilder()
      .update(UserSession)
      .set({ revokedAt: () => 'NOW()' })
      .where('tenantId = :tenantId', { tenantId })
      .andWhere('userId = :userId', { userId })
      .andWhere('revokedAt IS NULL')
      .execute();
    return res.affected ?? 0;
  }

  async revokeSessionForTenant(
    tenantId: string,
    sessionId: string,
  ): Promise<void> {
    const s = await this.repo.findOne({ where: { id: sessionId } });
    if (!s || s.tenantId !== tenantId) {
      throw new NotFoundException('Session not found');
    }
    if (!s.revokedAt) {
      s.revokedAt = new Date();
      await this.repo.save(s);
    }
  }

  /** Активные сессии ОДНОГО пользователя (страница «Аккаунт» — в отличие от listActiveForTenant,
   * которая отдаёт всех сотрудников тенанта и требует прав owner). */
  async listActiveForUser(tenantId: string, userId: string): Promise<UserSession[]> {
    return this.repo.find({
      where: { tenantId, userId, revokedAt: IsNull() },
      order: { lastSeenAt: 'DESC' },
    });
  }

  /** Отозвать одну свою сессию — проверяет, что она принадлежит именно этому пользователю
   * (в отличие от revokeSessionForTenant, которую вызывает owner для ЧУЖИХ сессий). */
  async revokeOwnSession(tenantId: string, userId: string, sessionId: string): Promise<void> {
    const s = await this.repo.findOne({ where: { id: sessionId } });
    if (!s || s.tenantId !== tenantId || s.userId !== userId) {
      throw new NotFoundException('Session not found');
    }
    if (!s.revokedAt) {
      s.revokedAt = new Date();
      await this.repo.save(s);
    }
  }

  /** «Завершить все, кроме этой» — использует ту же сессию, что и текущий запрос. */
  async revokeAllForUserExceptCurrent(
    tenantId: string,
    userId: string,
    currentSessionId: string,
  ): Promise<number> {
    const res = await this.repo
      .createQueryBuilder()
      .update(UserSession)
      .set({ revokedAt: () => 'NOW()' })
      .where('tenantId = :tenantId', { tenantId })
      .andWhere('userId = :userId', { userId })
      .andWhere('id != :currentSessionId', { currentSessionId })
      .andWhere('revokedAt IS NULL')
      .execute();
    return res.affected ?? 0;
  }

  async listActiveForTenant(tenantId: string): Promise<
    Array<{
      id: string;
      userId: string;
      userEmail: string;
      userName: string | null;
      ip: string | null;
      userAgent: string | null;
      createdAt: Date;
      lastSeenAt: Date;
    }>
  > {
    const rows = await this.repo.find({
      where: { tenantId, revokedAt: IsNull() },
      order: { lastSeenAt: 'DESC' },
    });
    const userIds = [...new Set(rows.map((r) => r.userId))];
    if (userIds.length === 0) return [];

    const users = await this.userRepo.find({
      where: { id: In(userIds) },
    });
    const byId = new Map(users.map((u) => [u.id, u]));

    return rows.map((r) => {
      const u = byId.get(r.userId);
      return {
        id: r.id,
        userId: r.userId,
        userEmail: u?.email ?? '—',
        userName: u?.name ?? null,
        ip: r.ip,
        userAgent: r.userAgent,
        createdAt: r.createdAt,
        lastSeenAt: r.lastSeenAt,
      };
    });
  }
}
