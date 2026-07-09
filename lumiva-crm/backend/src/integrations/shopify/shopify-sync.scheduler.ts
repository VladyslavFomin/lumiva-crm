import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IntegrationConnection } from '../integration-connection.entity';
import { ShopifyAdapter } from './shopify.adapter';

/**
 * Runs Shopify order sync every 30 minutes for all enabled Shopify connections.
 */
@Injectable()
export class ShopifySyncScheduler {
  private readonly log = new Logger(ShopifySyncScheduler.name);
  private running = false;

  constructor(
    @InjectRepository(IntegrationConnection)
    private readonly connectionRepo: Repository<IntegrationConnection>,
    private readonly shopifyAdapter: ShopifyAdapter,
  ) {}

  @Cron('*/30 * * * *')
  async syncAll(): Promise<void> {
    if (this.running) {
      this.log.warn('Shopify sync already in progress, skipping this tick');
      return;
    }
    this.running = true;
    try {
      const connections = await this.connectionRepo.find({
        where: { kind: 'shopify', isEnabled: true, isDeleted: false } as any,
      });

      if (!connections.length) return;

      this.log.log(`Shopify scheduler: found ${connections.length} active connection(s)`);

      for (const conn of connections) {
        try {
          const result = await this.shopifyAdapter.syncSales(conn);
          if (result.ok) {
            this.log.log(`Shopify conn=${conn.id}: created=${result.created} updated=${result.updated}`);
          } else {
            this.log.warn(`Shopify conn=${conn.id}: ${result.message}`);
          }
        } catch (e) {
          this.log.error(`Shopify conn=${conn.id} error: ${(e as Error).message}`);
        }
      }
    } finally {
      this.running = false;
    }
  }
}
