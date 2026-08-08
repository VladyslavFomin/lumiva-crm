// src/esign/esign.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { EsignService, type EsignLinkType } from './esign.service';

@Controller('esign/documents')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('esign', 'read')
export class EsignController {
  constructor(private readonly esign: EsignService) {}

  @Get()
  list(@CurrentUser() user: CurrentUserPayload) {
    return this.esign.listDocuments(user.tenantId);
  }

  @Get(':id')
  getOne(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.esign.getDocument(user.tenantId, id);
  }

  @Post()
  @RequirePermission('esign', 'write')
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { contactId?: string; title: string; bodyTemplate: string; kind?: string; entityType?: EsignLinkType; entityId?: string; templateId?: string },
  ) {
    return this.esign.createDocument(user.tenantId, {
      ...body,
      createdByUserId: user.userId || user.id || user.sub || '',
    });
  }

  @Patch(':id')
  @RequirePermission('esign', 'write')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body()
    body: { title?: string; kind?: string; bodyText?: string; contactId?: string | null; entityType?: EsignLinkType | null; entityId?: string | null },
  ) {
    return this.esign.updateDocument(user.tenantId, id, body);
  }

  @Delete(':id')
  @RequirePermission('esign', 'write')
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.esign.deleteDocument(user.tenantId, id);
  }

  @Post(':id/send')
  @RequirePermission('esign', 'write')
  send(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.esign.sendForSignature(user.tenantId, id);
  }

  @Post(':id/remind')
  @RequirePermission('esign', 'write')
  remind(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.esign.remindSignature(user.tenantId, id);
  }

  @Post(':id/duplicate')
  @RequirePermission('esign', 'write')
  duplicate(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.esign.duplicateDocument(user.tenantId, id, user.userId || user.id || user.sub || '');
  }
}

@Controller('esign/link-options')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('esign', 'read')
export class EsignLinkOptionsController {
  constructor(private readonly esign: EsignService) {}

  @Get(':type')
  search(@CurrentUser() user: CurrentUserPayload, @Param('type') type: EsignLinkType, @Query('search') search?: string) {
    return this.esign.searchLinkEntities(user.tenantId, type, search);
  }
}

@Controller('esign/templates')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('esign', 'read')
export class EsignTemplateController {
  constructor(private readonly esign: EsignService) {}

  @Get()
  list(@CurrentUser() user: CurrentUserPayload) {
    return this.esign.listTemplates(user.tenantId);
  }

  @Post()
  @RequirePermission('esign', 'write')
  create(@CurrentUser() user: CurrentUserPayload, @Body() body: { name: string; description?: string; kind?: string; bodyTemplate: string }) {
    return this.esign.createTemplate(user.tenantId, body);
  }

  @Patch(':id')
  @RequirePermission('esign', 'write')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string; kind?: string; bodyTemplate?: string },
  ) {
    return this.esign.updateTemplate(user.tenantId, id, body);
  }

  @Delete(':id')
  @RequirePermission('esign', 'write')
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.esign.deleteTemplate(user.tenantId, id);
  }
}
