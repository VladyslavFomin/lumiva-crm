// src/telegram-crm/telegram-polling.service.ts
import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { TelegramBot } from './telegram-bot.entity';
import { TelegramCrmService } from './telegram-crm.service';

@Injectable()
export class TelegramPollingService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger(TelegramPollingService.name);
  private readonly loops = new Map<string, { running: boolean; offset: number }>();
  private globalRunning = true;

  constructor(
    @InjectRepository(TelegramBot)
    private readonly botRepo: Repository<TelegramBot>,
    private readonly telegramCrm: TelegramCrmService,
  ) {}

  async onApplicationBootstrap() {
    // Small delay so all NestJS dependencies are fully ready
    setTimeout(() => this.startAllBots(), 3000);
  }

  onApplicationShutdown() {
    this.globalRunning = false;
    this.loops.forEach((s) => { s.running = false; });
    this.log.log('Polling stopped');
  }

  private async startAllBots() {
    try {
      const bots = await this.botRepo.find({ where: { status: 'active' } });
      for (const bot of bots) {
        if (!bot.webhookUrl) {
          this.startPollingBot(bot.id, bot.botToken);
        }
      }
    } catch (err: any) {
      this.log.error(`Failed to start polling: ${err.message}`);
    }
  }

  /** Start a long-polling loop for a single bot */
  startPollingBot(botId: string, botToken: string) {
    if (this.loops.has(botId)) return; // already running
    const state = { running: true, offset: 0 };
    this.loops.set(botId, state);
    this.log.log(`Long-polling started for bot ${botId}`);
    this.pollLoop(botId, botToken, state).catch(() => undefined);
  }

  stopPollingBot(botId: string) {
    const state = this.loops.get(botId);
    if (state) {
      state.running = false;
      this.loops.delete(botId);
      this.log.log(`Long-polling stopped for bot ${botId}`);
    }
  }

  private async pollLoop(botId: string, botToken: string, state: { running: boolean; offset: number }) {
    while (state.running && this.globalRunning) {
      try {
        const res = await axios.get(
          `https://api.telegram.org/bot${botToken}/getUpdates`,
          {
            params: { timeout: 25, offset: state.offset || undefined, limit: 100 },
            timeout: 30_000,
          },
        );

        if (!res.data.ok) {
          this.log.warn(`getUpdates not ok for bot ${botId}: ${JSON.stringify(res.data)}`);
          await this.sleep(5000);
          continue;
        }

        const updates: any[] = res.data.result || [];
        for (const update of updates) {
          state.offset = update.update_id + 1;
          try {
            const bot = await this.botRepo.findOne({ where: { id: botId } });
            if (!bot || bot.status !== 'active') break;
            await this.telegramCrm.handleIncomingMessage(bot.tenantId, botToken, update);
          } catch (err: any) {
            this.log.error(`Update processing error: ${err.message}`);
          }
        }
      } catch (err: any) {
        if (state.running && this.globalRunning) {
          this.log.warn(`Polling error for bot ${botId}: ${err.message}`);
          await this.sleep(5000);
        }
      }
    }
  }

  private sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
}
