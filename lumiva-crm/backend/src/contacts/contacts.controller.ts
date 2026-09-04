// src/contacts/contacts.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  NotFoundException,
} from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { BulkUpdateContactsDto } from './dto/bulk-update-contacts.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { DataVisibilityService } from '../data-visibility/data-visibility.service';
import type { Contact } from './contact.entity';

// Поля, которые скрываются для "чужих" записей в режиме foreign_records='masked' — сама запись
// остаётся видна (это не 'hide'), но детали, кроме базовой идентификации, обрезаются.
const DETAIL_FIELDS: (keyof Contact)[] = ['address', 'customFields', 'meta', 'linkedin', 'website'];

@Controller('contacts')
@UseGuards(JwtAuthGuard, RbacGuard)
export class ContactsController {
  constructor(
    private readonly contactsService: ContactsService,
    private readonly dataVisibility: DataVisibilityService,
  ) {}

  /** Resolves what to force into the list query (SQL-level, so pagination/total stay correct)
   * plus what to mask in-memory afterwards (safe post-processing — redacting fields never
   * changes row counts, unlike dropping rows would). Returns null scoping when the requester is
   * privileged or the rules don't apply here at all. */
  private async resolveVisibility(user: CurrentUserPayload): Promise<{
    forceOwnOnly: string | null; // staffId to force as assignedUserId, or null
    maskDetails: boolean;
    contactMaskingMode: string; // 'show' | 'mask_until_assigned' | 'always_mask'
    staffId: string | null;
  }> {
    const ctx = await this.dataVisibility.getRequestContext(user.tenantId, user);
    if (ctx.privileged) {
      return { forceOwnOnly: null, maskDetails: false, contactMaskingMode: 'show', staffId: ctx.staffId };
    }

    const [foreignRecords, contactMasking] = await Promise.all([
      this.dataVisibility.getRuleValue(user.tenantId, user.role as any, 'foreign_records'),
      this.dataVisibility.getRuleValue(user.tenantId, user.role as any, 'contact_masking'),
    ]);
    return {
      forceOwnOnly: foreignRecords === 'hide' ? ctx.staffId : null,
      maskDetails: foreignRecords === 'masked',
      contactMaskingMode: contactMasking,
      staffId: ctx.staffId,
    };
  }

  private maskOne(contact: Contact, staffId: string | null, maskDetails: boolean, contactMaskingMode: string): Contact {
    const isOwn = !!(staffId && contact.assignedUserId === staffId);
    const maskContact = contactMaskingMode === 'always_mask' || (contactMaskingMode === 'mask_until_assigned' && !isOwn);
    if ((isOwn && !maskContact) || (!maskDetails && !maskContact)) return contact;
    let out = contact;
    if (!isOwn && maskDetails) {
      out = { ...out };
      for (const field of DETAIL_FIELDS) (out as any)[field] = null;
    }
    if (maskContact) {
      out = { ...out, phone: null, email: null };
    }
    return out;
  }

  @Get()
  @RequirePermission('contacts', 'read')
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('assignedUserId') assignedUserId?: string,
    @Query('tags') tags?: string, // comma-separated
    @Query('companyId') companyId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const tagsArray = tags ? tags.split(',').filter(Boolean) : undefined;
    const visibility = await this.resolveVisibility(user);
    // forceOwnOnly overrides whatever the client asked for — SQL-level, so pagination/total stay
    // correct (unlike filtering the already-paginated result set would).
    const effectiveAssignedUserId = visibility.forceOwnOnly ?? assignedUserId;
    const result = await this.contactsService.findAll(user.tenantId, {
      search,
      status,
      assignedUserId: effectiveAssignedUserId,
      tags: tagsArray,
      companyId,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
    const items = result.items.map((c) =>
      this.maskOne(c, visibility.staffId, visibility.maskDetails, visibility.contactMaskingMode),
    );
    return { ...result, items };
  }

  @Get(':id')
  @RequirePermission('contacts', 'read')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('withRelations') withRelations?: string,
  ) {
    const contact =
      withRelations === 'true'
        ? await this.contactsService.findOneWithRelations(user.tenantId, id)
        : await this.contactsService.findOne(user.tenantId, id);
    const visibility = await this.resolveVisibility(user);
    if (visibility.forceOwnOnly && (contact as unknown as Contact).assignedUserId !== visibility.forceOwnOnly) {
      throw new NotFoundException('Contact not found');
    }
    return this.maskOne(contact as unknown as Contact, visibility.staffId, visibility.maskDetails, visibility.contactMaskingMode);
  }

  @Post()
  @RequirePermission('contacts', 'write')
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateContactDto,
  ) {
    return this.contactsService.create(user.tenantId, dto, user.userId ?? user.id ?? user.sub);
  }

  @Patch(':id')
  @RequirePermission('contacts', 'write')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.contactsService.update(user.tenantId, id, dto, user.userId ?? user.id ?? user.sub);
  }

  @Delete(':id')
  @RequirePermission('contacts', 'delete')
  async delete(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.contactsService.delete(user.tenantId, id, user.userId ?? user.id ?? user.sub);
    return { success: true };
  }

  // ========== BIRTHDAYS WIDGET ==========

  @Get('birthdays')
  @RequirePermission('contacts', 'read')
  async birthdays(
    @CurrentUser() _user: CurrentUserPayload,
  ) {
    // birthday field is not yet on the Contact entity — return empty list
    return { contacts: [] };
  }

  // ========== МАССОВЫЕ ОПЕРАЦИИ ==========

  @Post('bulk-update')
  @RequirePermission('contacts_manage_bulk', 'write')
  async bulkUpdate(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: BulkUpdateContactsDto,
  ) {
    return this.contactsService.bulkUpdate(user.tenantId, dto);
  }
}



