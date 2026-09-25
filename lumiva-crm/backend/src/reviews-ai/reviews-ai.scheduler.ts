import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ReviewsAiService } from './reviews-ai.service';

/** Опрос Google-отзывов: раз в 30 минут проверяем, у каких объектов подошёл срок (syncHours). */
@Injectable()
export class ReviewsAiScheduler {
  private readonly log = new Logger(ReviewsAiScheduler.name);
  private running = false;

  constructor(private readonly reviews: ReviewsAiService) {}

  @Cron('*/30 * * * *')
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.reviews.tick();
    } catch (e) {
      this.log.warn(`reviews tick: ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
