// src/esign/esign.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { EsignService, type EsignLinkType } from './esign.service';
import type { EsignItemPick } from './esign-items';

@Controller('esign/documents')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('esign', 'read')
export class EsignController {
  constructor(private readonly esign: EsignService) {}

  @Get()
  list(@CurrentUser() user: CurrentUserPayload) {
    return this.esign.listDocuments(user.tenantId);
  }

  @Get('keys')
  keys() {
    return this.esign.getKeyCatalog();
  }

  @Get('auto-values')
  autoValues(@CurrentUser() user: CurrentUserPayload, @Query('contactId') contactId?: string) {
    return this.esign.getAutoValues(user.tenantId, contactId || null, (user.userId ?? (user as any).id ?? (user as any).sub) || null);
  }

  @Get('next-contract-no')
  nextContractNo(@CurrentUser() user: CurrentUserPayload) {
    return this.esign.previewNextContractNumber(user.tenantId).then((preview) => ({ preview }));
  }

  @Get('amount-suggestions')
  amountSuggestions(@CurrentUser() user: CurrentUserPayload, @Query('contactId') contactId: string) {
    return this.esign.getAmountSuggestions(user.tenantId, contactId);
  }

  @Get(':id')
  getOne(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.esign.getDocument(user.tenantId, id);
  }

  @Get(':id/file')
  async file(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Query('variant') variant: 'draft' | 'signed' | undefined,
    @Query('download') download: string | undefined,
    @Res() res: Response,
  ) {
    const { buffer, fileName } = await this.esign.getDocumentFile(user.tenantId, id, variant);
    res.setHeader('Content-Type', 'application/pdf');
    const disposition = download ? 'attachment' : 'inline';
    res.setHeader('Content-Disposition', `${disposition}; filename="document.pdf"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.send(buffer);
  }

  @Post()
  @RequirePermission('esign', 'write')
  issue(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { templateId: string; contactId: string; extraFields?: Record<string, string>; items?: EsignItemPick[] },
  ) {
    return this.esign.issueDocument(user.tenantId, (user.userId ?? (user as any).id ?? (user as any).sub) || '', body);
  }

  @Patch(':id')
  @RequirePermission('esign', 'write')
  update(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string, @Body() body: { bodyText?: string }) {
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
    return this.esign.sendOrRemind(user.tenantId, id);
  }

  @Post(':id/duplicate')
  @RequirePermission('esign', 'write')
  duplicate(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.esign.duplicateDocument(user.tenantId, id, (user.userId ?? (user as any).id ?? (user as any).sub) || '');
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
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { name: string; description?: string; kind?: string; bodyTemplate: string; fileNamePattern?: string },
  ) {
    return this.esign.createTemplate(user.tenantId, body);
  }

  @Patch(':id')
  @RequirePermission('esign', 'write')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string; kind?: string; bodyTemplate?: string; fileNamePattern?: string },
  ) {
    return this.esign.updateTemplate(user.tenantId, id, body);
  }

  @Delete(':id')
  @RequirePermission('esign', 'write')
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.esign.deleteTemplate(user.tenantId, id);
  }
}
