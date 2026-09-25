import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.interface';
import { ReviewsAiService } from './reviews-ai.service';

@Controller('marketing/reviews')
@UseGuards(JwtAuthGuard)
export class ReviewsAiController {
  constructor(private readonly reviews: ReviewsAiService) {}

  private async tenant(user: CurrentUserPayload, gate = true): Promise<string> {
    if (!user?.tenantId) throw new BadRequestException('No tenant in auth payload');
    if (gate) await this.reviews.assertAccess(user.tenantId);
    return user.tenantId;
  }

  /** Есть ли активный ИИ-сотрудник «Менеджер отзывов» и можно ли его нанять. */
  @Get('access')
  async access(@CurrentUser() user: CurrentUserPayload) {
    return this.reviews.getAccess(await this.tenant(user, false));
  }

  @Get('search')
  async search(@CurrentUser() user: CurrentUserPayload, @Query('q') q: string) {
    await this.tenant(user);
    return this.reviews.search(q);
  }

  @Get('places')
  async places(@CurrentUser() user: CurrentUserPayload) {
    return this.reviews.listPlaces(await this.tenant(user));
  }

  @Post('places')
  async addPlace(@CurrentUser() user: CurrentUserPayload, @Body() body: { placeId: string }) {
    return this.reviews.addPlace(await this.tenant(user), user.userId ?? null, body?.placeId);
  }

  @Patch('places/:id')
  async updatePlace(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string, @Body() body: Record<string, any>) {
    return this.reviews.updatePlace(await this.tenant(user), id, body || {});
  }

  @Delete('places/:id')
  async removePlace(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.reviews.removePlace(await this.tenant(user), id);
  }

  @Post('places/:id/sync')
  async sync(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.reviews.syncNow(await this.tenant(user), id);
  }

  @Get('stats')
  async stats(@CurrentUser() user: CurrentUserPayload, @Query('placeId') placeId?: string) {
    return this.reviews.stats(await this.tenant(user), placeId || undefined);
  }

  @Get('items')
  async items(
    @CurrentUser() user: CurrentUserPayload,
    @Query('placeId') placeId?: string,
    @Query('status') status?: string,
    @Query('sentiment') sentiment?: string,
  ) {
    return this.reviews.listReviews(await this.tenant(user), { placeId, status, sentiment });
  }

  @Patch('items/:id')
  async updateItem(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string, @Body() body: { status?: any; aiReply?: string }) {
    return this.reviews.updateReview(await this.tenant(user), id, body || {});
  }

  @Post('items/:id/regenerate')
  async regenerate(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string, @Body() body: { tone?: string }) {
    return this.reviews.regenerate(await this.tenant(user), id, body?.tone);
  }
}
