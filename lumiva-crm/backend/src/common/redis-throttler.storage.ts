import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import Redis from 'ioredis';

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnModuleDestroy {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private client: Redis | null = null;

  private readonly memoryHits = new Map<string, { hits: number; expiresAt: number }>();

  constructor() {
    const url = process.env.REDIS_URL;
    if (url) {
      this.client = new Redis(url, { lazyConnect: true, enableOfflineQueue: false });
      this.client.connect().catch((err: Error) => {
        this.logger.warn(`Redis unavailable, falling back to memory: ${err.message}`);
        this.client = null;
      });
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit().catch(() => undefined);
    }
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    if (!this.client) {
      return this.memoryIncrement(key, ttl, limit, blockDuration, throttlerName);
    }

    const hitKey = `throttle:${throttlerName}:${key}`;
    const blockKey = `throttle:block:${throttlerName}:${key}`;

    if (blockDuration > 0) {
      const blocked = await this.client.exists(blockKey);
      if (blocked) {
        const pttl = await this.client.pttl(blockKey);
        return { totalHits: limit + 1, timeToExpire: 0, isBlocked: true, timeToBlockExpire: Math.max(0, pttl) };
      }
    }

    const pipeline = this.client.pipeline();
    pipeline.incr(hitKey);
    pipeline.pttl(hitKey);
    const results = await pipeline.exec();

    const totalHits = (results?.[0]?.[1] as number) ?? 1;
    let remainingTtl = (results?.[1]?.[1] as number) ?? -1;

    if (totalHits === 1 || remainingTtl < 0) {
      await this.client.pexpire(hitKey, ttl);
      remainingTtl = ttl;
    }

    if (totalHits > limit && blockDuration > 0) {
      await this.client.set(blockKey, '1', 'PX', blockDuration);
      await this.client.del(hitKey);
      return { totalHits, timeToExpire: 0, isBlocked: true, timeToBlockExpire: blockDuration };
    }

    return { totalHits, timeToExpire: Math.max(0, remainingTtl), isBlocked: totalHits > limit, timeToBlockExpire: 0 };
  }

  private memoryIncrement(
    key: string,
    ttl: number,
    limit: number,
    _blockDuration: number,
    throttlerName: string,
  ): ThrottlerStorageRecord {
    const fullKey = `${throttlerName}:${key}`;
    const now = Date.now();
    const entry = this.memoryHits.get(fullKey);

    if (!entry || entry.expiresAt <= now) {
      this.memoryHits.set(fullKey, { hits: 1, expiresAt: now + ttl });
      return { totalHits: 1, timeToExpire: ttl, isBlocked: false, timeToBlockExpire: 0 };
    }

    entry.hits += 1;
    const timeToExpire = Math.max(0, entry.expiresAt - now);
    const isBlocked = entry.hits > limit;
    return { totalHits: entry.hits, timeToExpire, isBlocked, timeToBlockExpire: isBlocked ? timeToExpire : 0 };
  }
}
