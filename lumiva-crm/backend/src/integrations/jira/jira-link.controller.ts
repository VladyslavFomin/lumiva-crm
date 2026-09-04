import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { IntegrationConnection } from '../integration-connection.entity';
import { JiraApiService, type JiraProject } from './jira-api.service';
import { JiraLinkEntityType, JiraLinkInfo, JiraLinkService } from './jira-link.service';

function assertEntityType(v: string): asserts v is JiraLinkEntityType {
  if (v !== 'lead' && v !== 'sale' && v !== 'project') {
    throw new BadRequestException('entityType должен быть lead, sale или project');
  }
}

@Controller('integrations/jira/link')
@UseGuards(JwtAuthGuard)
export class JiraLinkController {
  constructor(
    @InjectRepository(IntegrationConnection)
    private readonly connectionRepo: Repository<IntegrationConnection>,
    private readonly jiraApi: JiraApiService,
    private readonly jiraLink: JiraLinkService,
  ) {}

  private async loadConnection(tenantId: string, connectionId: string): Promise<IntegrationConnection> {
    const entity = await this.connectionRepo.findOne({
      where: { id: connectionId, tenantId, isDeleted: false } as any,
    });
    if (!entity) throw new NotFoundException('Подключение Jira не найдено');
    return entity;
  }

  @Get(':connectionId/projects')
  async listProjects(
    @CurrentUser() user: CurrentUserPayload,
    @Param('connectionId') connectionId: string,
  ): Promise<JiraProject[]> {
    const entity = await this.loadConnection(user.tenantId, connectionId);
    const cfg = await this.jiraApi.resolveConfigAndPersist(entity);
    if (!cfg) {
      throw new BadRequestException(
        'Jira: подключение не настроено — войдите через OAuth или укажите jiraUrl/email/apiToken',
      );
    }
    return this.jiraApi.getProjects(cfg);
  }

  @Get(':entityType/:entityId')
  async getLinked(
    @CurrentUser() user: CurrentUserPayload,
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ): Promise<JiraLinkInfo | null> {
    assertEntityType(entityType);
    return this.jiraLink.getLinkedIssue(user.tenantId, entityType, entityId);
  }

  @Post(':entityType/:entityId')
  async createAndLink(
    @CurrentUser() user: CurrentUserPayload,
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Body()
    body: {
      connectionId: string;
      projectKey: string;
      summary: string;
      description?: string;
      issueType?: string;
    },
  ): Promise<JiraLinkInfo> {
    assertEntityType(entityType);
    const connectionId = String(body?.connectionId || '').trim();
    const projectKey = String(body?.projectKey || '').trim();
    const summary = String(body?.summary || '').trim();
    if (!connectionId) throw new BadRequestException('Укажите подключение Jira (connectionId)');
    if (!projectKey) throw new BadRequestException('Укажите проект Jira (projectKey)');
    if (!summary) throw new BadRequestException('Укажите тему задачи (summary)');

    const entity = await this.loadConnection(user.tenantId, connectionId);
    const cfg = await this.jiraApi.resolveConfigAndPersist(entity);
    if (!cfg) {
      throw new BadRequestException(
        'Jira: подключение не настроено — войдите через OAuth или укажите jiraUrl/email/apiToken',
      );
    }
    const issue = await this.jiraApi.createIssue(cfg, {
      summary,
      description: body.description,
      projectKey,
      issueType: body.issueType || 'Task',
    });
    await this.jiraLink.attach(user.tenantId, entityType, entityId, {
      key: issue.key,
      url: issue.url,
      connectionId,
    });
    return {
      key: issue.key,
      url: issue.url,
      status: null,
      connectionId,
      linkedAt: new Date().toISOString(),
    };
  }
}
