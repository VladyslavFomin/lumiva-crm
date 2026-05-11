// src/automations/automations.service.ts
const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import axios from 'axios';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { Automation, TriggerEvent } from './automation.entity';
import { AutomationExecution } from './automation-execution.entity';
import { Lead } from '../leads/lead.entity';
import { Contact } from '../contacts/contact.entity';
import { Company } from '../companies/company.entity';
import { CompanyTask } from '../companies/company-task.entity';
import { Project } from '../projects/project.entity';
import { Sale } from '../sales/sale.entity';
import { CreateAutomationDto } from './dto/create-automation.dto';
import { UpdateAutomationDto } from './dto/update-automation.dto';
import { EmailService } from '../email/email.service';
import { TelegramCrmService } from '../telegram-crm/telegram-crm.service';
import { NotesService } from '../notes/notes.service';
import { EntityType as NoteEntityType } from '../notes/dto/create-note.dto';
import { ReportsService } from './reports.service';
import { CompaniesService } from '../companies/companies.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { MarketingService } from '../marketing/marketing.service';
import type { RunAutomationNowDto } from './dto/run-automation-now.dto';
import { CustomObjectsService } from '../custom-objects/custom-objects.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SmsService } from '../sms/sms.service';
import { StaffUsersService } from '../staff/staff-users.service';

@Injectable()
export class AutomationsService {
  private scheduleRunning = false;
  constructor(
    @InjectRepository(Automation)
    private readonly automationRepo: Repository<Automation>,
    @InjectRepository(AutomationExecution)
    private readonly executionRepo: Repository<AutomationExecution>,
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
    @InjectRepository(Contact)
    private readonly contactRepo: Repository<Contact>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(CompanyTask)
    private readonly companyTaskRepo: Repository<CompanyTask>,
    @InjectRepository(Sale)
    private readonly saleRepo: Repository<Sale>,
    @Inject(forwardRef(() => EmailService))
    private readonly emailService: EmailService,
    @Inject(forwardRef(() => TelegramCrmService))
    private readonly telegramCrmService: TelegramCrmService,
    @Inject(forwardRef(() => NotesService))
    private readonly notesService: NotesService,
    @Inject(forwardRef(() => CompaniesService))
    private readonly companiesService: CompaniesService,
    private readonly reportsService: ReportsService,
    private readonly integrationsService: IntegrationsService,
    private readonly marketingService: MarketingService,
    @Inject(forwardRef(() => CustomObjectsService))
    private readonly customObjectsService: CustomObjectsService,
    private readonly notificationsService: NotificationsService,
    private readonly staffUsersService: StaffUsersService,
    private readonly smsService: SmsService,
  ) {}

  /**
   * Получить все автоматизации тенанта
   */
  async findAll(tenantId: string, isActive?: boolean): Promise<Automation[]> {
    const where: any = { tenantId };
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    return this.automationRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Получить одну автоматизацию
   */
  async findOne(tenantId: string, id: string): Promise<Automation> {
    const automation = await this.automationRepo.findOne({
      where: { id, tenantId },
    });

    if (!automation) {
      throw new NotFoundException('Automation not found');
    }

    console.log('Loading automation:', automation.id);
    console.log('Actions from DB:', JSON.stringify(automation.actions, null, 2));
    console.log('Actions type:', typeof automation.actions, Array.isArray(automation.actions));

    return automation;
  }

  /**
   * Создать автоматизацию
   */
  async create(
    tenantId: string,
    dto: CreateAutomationDto,
  ): Promise<Automation> {
    console.log('Creating automation with actions:', JSON.stringify(dto.actions, null, 2));
    console.log('Actions type:', typeof dto.actions, Array.isArray(dto.actions));
    
    // Преобразуем ActionDto[] в формат entity, гарантируя что config всегда объект
    const actions = dto.actions.map(action => ({
      type: action.type,
      config: action.config || {},
    }));
    
    const automation = this.automationRepo.create({
      tenantId,
      name: dto.name,
      description: dto.description || null,
      triggerEvent: dto.triggerEvent,
      conditions: dto.conditions || null,
      actions: actions,
      isActive: dto.isActive !== undefined ? dto.isActive : true,
      maxExecutions: dto.maxExecutions || null,
      cooldownSeconds: dto.cooldownSeconds || null,
      meta: dto.meta !== undefined ? dto.meta : null,
      executionCount: 0,
      errorCount: 0,
    });

    const saved = await this.automationRepo.save(automation);
    console.log('Created automation actions:', JSON.stringify(saved.actions, null, 2));
    return saved;
  }

  /**
   * Обновить автоматизацию
   */
  async update(
    tenantId: string,
    id: string,
    dto: UpdateAutomationDto,
  ): Promise<Automation> {
    const automation = await this.findOne(tenantId, id);

    if (dto.name !== undefined) automation.name = dto.name;
    if (dto.description !== undefined) automation.description = dto.description || null;
    if (dto.triggerEvent !== undefined) automation.triggerEvent = dto.triggerEvent;
    if (dto.conditions !== undefined) automation.conditions = dto.conditions || null;
    if (dto.actions !== undefined) {
      console.log('Updating actions:', JSON.stringify(dto.actions, null, 2));
      console.log('Actions type:', typeof dto.actions, Array.isArray(dto.actions));
      // Преобразуем ActionDto[] в формат entity, гарантируя что config всегда объект
      automation.actions = dto.actions.map(action => ({
        type: action.type,
        config: action.config || {},
      }));
    }
    if (dto.isActive !== undefined) automation.isActive = dto.isActive;
    if (dto.maxExecutions !== undefined) automation.maxExecutions = dto.maxExecutions || null;
    if (dto.cooldownSeconds !== undefined) automation.cooldownSeconds = dto.cooldownSeconds || null;
    if (dto.meta !== undefined) automation.meta = dto.meta;

    const saved = await this.automationRepo.save(automation);
    console.log('Saved automation actions:', JSON.stringify(saved.actions, null, 2));
    return saved;
  }

  /**
   * Удалить автоматизацию
   */
  async delete(tenantId: string, id: string): Promise<void> {
    const automation = await this.findOne(tenantId, id);
    await this.automationRepo.remove(automation);
  }

  /**
   * Ручной запуск сценария (без ожидания cron / события).
   * Условия IF не проверяются — пользователь явно запросил выполнение.
   */
  async runNow(
    tenantId: string,
    automationId: string,
    dto?: RunAutomationNowDto,
  ): Promise<{ success: boolean; errorMessage?: string | null }> {
    const automation = await this.findOne(tenantId, automationId);
    const event = automation.triggerEvent as TriggerEvent;
    let triggerData: Record<string, unknown>;
    if (event === TriggerEvent.REPORT_SCHEDULED) {
      triggerData = {
        entityType: 'report',
        entityId: automation.id,
        report: true,
        manualRun: true,
        tenantId: automation.tenantId,
      };
    } else if (event === TriggerEvent.SCHEDULED) {
      triggerData = {
        entityType: 'scheduled',
        entityId: automation.id,
        scheduled: true,
        manualRun: true,
        tenantId: automation.tenantId,
      };
    } else {
      triggerData = {
        manualRun: true,
        tenantId: automation.tenantId,
        entityType: 'manual',
        entityId: automation.id,
      };
    }
    const rangeOv = this.resolveRunNowDateRange(dto);
    if (rangeOv) {
      triggerData.reportRangeOverride = rangeOv;
    }
    await this.executeAutomation(automation, event, triggerData);
    const fresh = await this.findOne(tenantId, automationId);
    return {
      success: !fresh.lastError,
      errorMessage: fresh.lastError ?? undefined,
    };
  }

  private resolveRunNowDateRange(
    dto?: RunAutomationNowDto,
  ): { from: string; to: string } | undefined {
    if (!dto) return undefined;
    if (dto.rangePreset && dto.rangePreset !== 'custom') {
      return this.reportsService.datePresetToRangeStrings(dto.rangePreset);
    }
    if (dto.rangePreset === 'custom' || (dto.dateFrom && dto.dateTo)) {
      if (!dto.dateFrom || !dto.dateTo) {
        throw new BadRequestException(
          'Для произвольного периода укажите dateFrom и dateTo в формате YYYY-MM-DD',
        );
      }
      return { from: dto.dateFrom.slice(0, 10), to: dto.dateTo.slice(0, 10) };
    }
    return undefined;
  }

  private resolveSendReportRange(
    config: Record<string, any>,
    frequency: string,
    triggerData: any,
  ): { from: Date; to: Date } {
    const ro = triggerData?.reportRangeOverride;
    if (ro?.from && ro?.to) {
      return this.reportsService.parseInclusiveDateRange(String(ro.from), String(ro.to));
    }
    const cf = config?.reportDateFrom;
    const ct = config?.reportDateTo;
    if (cf && ct) {
      return this.reportsService.parseInclusiveDateRange(String(cf), String(ct));
    }
    return this.reportsService.buildRange(frequency);
  }

  /**
   * Запустить автоматизацию по событию
   */
  async triggerAutomation(
    tenantId: string,
    event: TriggerEvent,
    triggerData: any,
  ): Promise<void> {
    // ── Telegram CRM notifications for key events ────────────────────────
    void this.dispatchTelegramNotification(tenantId, event, triggerData).catch(() => undefined);

    // Находим все активные автоматизации для этого события
    const automations = await this.automationRepo.find({
      where: {
        tenantId,
        triggerEvent: event,
        isActive: true,
      },
    });

    for (const automation of automations) {
      // Проверяем ограничения
      if (automation.maxExecutions && automation.executionCount >= automation.maxExecutions) {
        continue; // Пропускаем, если достигнут лимит
      }

      // Проверяем cooldown
      if (automation.cooldownSeconds && automation.lastExecutedAt) {
        const cooldownMs = automation.cooldownSeconds * 1000;
        const timeSinceLastExecution = Date.now() - automation.lastExecutedAt.getTime();
        if (timeSinceLastExecution < cooldownMs) {
          continue; // Пропускаем, если еще не прошло время cooldown
        }
      }

      // Проверяем условия
      if (automation.conditions && automation.conditions.length > 0) {
        const conditionsMet = this.checkConditions(
          automation.conditions,
          triggerData,
        );
        if (!conditionsMet) {
          continue; // Условия не выполнены
        }
      }

      // Выполняем автоматизацию
      await this.executeAutomation(automation, event, triggerData);
    }
  }

  /**
   * Запуск расписанных отчётов (cron)
   */
  async runScheduledReports(): Promise<void> {
    if (this.scheduleRunning) return;
    this.scheduleRunning = true;
    const automations = await this.automationRepo.find({
      where: {
        triggerEvent: TriggerEvent.REPORT_SCHEDULED,
        isActive: true,
      } as any,
    });

    try {
      for (const automation of automations) {
        const reportAction = automation.actions?.find(
          (action) => action.type === 'send_report',
        );
        if (!reportAction) continue;

        if (!this.shouldRunSchedule(reportAction.config || {}, automation.lastExecutedAt)) {
          continue;
        }

        await this.triggerAutomation(
          automation.tenantId,
          TriggerEvent.REPORT_SCHEDULED,
          {
            entityType: 'report',
            entityId: automation.id,
            report: true,
          },
        );
      }

      const scheduledAutomations = await this.automationRepo.find({
        where: {
          triggerEvent: TriggerEvent.SCHEDULED,
          isActive: true,
        } as any,
      });

      for (const automation of scheduledAutomations) {
        const sched = automation.meta?.schedule;
        if (!sched || typeof sched !== 'object') {
          continue;
        }
        if (!this.shouldRunSchedule(sched, automation.lastExecutedAt)) {
          continue;
        }
        await this.executeAutomation(automation, TriggerEvent.SCHEDULED, {
          entityType: 'scheduled',
          entityId: automation.id,
          tenantId: automation.tenantId,
          scheduled: true,
        });
      }
    } finally {
      this.scheduleRunning = false;
    }
  }

  private shouldRunSchedule(config: Record<string, any>, lastExecutedAt?: Date | null) {
    const frequency = (config.scheduleFrequency || 'weekly') as string;
    const time = (config.scheduleTime || '09:00') as string;
    const timezone = (config.scheduleTimezone || 'UTC') as string;
    const dayOfWeek = Number(config.scheduleDayOfWeek || 1);
    const dayOfMonth = Number(config.scheduleDayOfMonth || 1);

    const now = new Date();
    const zoned = this.getZonedParts(now, timezone);
    if (!zoned) return false;

    const [hh, mm] = time.split(':').map((v) => Number(v));
    if (zoned.hour !== hh || zoned.minute !== mm) return false;

    if (frequency === 'weekly' && zoned.weekday !== dayOfWeek) return false;
    if (
      frequency === 'monthly' &&
      zoned.day !== dayOfMonth
    ) {
      return false;
    }
    if (frequency === 'quarterly') {
      const quarterStartMonths = [1, 4, 7, 10];
      if (!quarterStartMonths.includes(zoned.month)) return false;
      if (zoned.day !== dayOfMonth) return false;
    }

    if (lastExecutedAt) {
      const lastZoned = this.getZonedParts(lastExecutedAt, timezone);
      if (lastZoned && lastZoned.year === zoned.year && lastZoned.month === zoned.month && lastZoned.day === zoned.day) {
        return false;
      }
    }

    return true;
  }

  private getZonedParts(date: Date, timeZone: string) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        weekday: 'short',
        hour12: false,
      }).formatToParts(date);

      const get = (type: string) => parts.find((p) => p.type === type)?.value;
      const weekdayMap: Record<string, number> = {
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6,
        Sun: 7,
      };

      return {
        year: Number(get('year')),
        month: Number(get('month')),
        day: Number(get('day')),
        hour: Number(get('hour')),
        minute: Number(get('minute')),
        weekday: weekdayMap[get('weekday') || 'Mon'] ?? 1,
      };
    } catch {
      return null;
    }
  }

  /** Send Telegram notifications to tenant staff recipients for key CRM events */
  private async dispatchTelegramNotification(tenantId: string, event: TriggerEvent, data: any): Promise<void> {
    const lead = data?.lead;
    const statusLabels: Record<string, string> = {
      new: 'Новый', in_progress: 'В работе', contacted: 'Контакт установлен',
      qualified: 'Квалифицирован', proposal: 'Предложение', negotiation: 'Переговоры',
      won: 'Выиграно', lost: 'Проиграно', closed: 'Закрыт',
    };
    const label = (s: string) => statusLabels[s] || s;
    const sourceLabels: Record<string, string> = {
      telegram: 'Telegram', website: 'Сайт', instagram: 'Instagram',
      facebook: 'Facebook', manual: 'Вручную', email: 'Email',
    };

    if (event === TriggerEvent.LEAD_CREATED && lead) {
      const src = lead.source ? ` · ${sourceLabels[lead.source] || lead.source}` : '';
      await this.telegramCrmService.notifyTenantRecipients(
        tenantId,
        `🆕 <b>Новый лид</b>${src}\n<b>${escHtml(lead.name || 'Без имени')}</b>` +
        (lead.phone ? `\n📞 ${lead.phone}` : '') +
        (lead.email ? `\n✉️ ${lead.email}` : ''),
      );
    } else if (event === TriggerEvent.LEAD_STATUS_CHANGED && lead) {
      const oldS = label(data?.oldStatus || '');
      const newS = label(data?.newStatus || '');
      await this.telegramCrmService.notifyTenantRecipients(
        tenantId,
        `🔄 <b>${escHtml(lead.name || 'Лид')}</b>\n${oldS} → <b>${newS}</b>`,
      );
    } else if (event === TriggerEvent.LEAD_ASSIGNED && lead) {
      const assignedIds: string[] = data?.newAssignedUserIds || data?.assignedUserIds ||
        (data?.newAssignedUserId ? [data.newAssignedUserId] : []);
      for (const uid of assignedIds) {
        await this.telegramCrmService.notifyStaffUser(
          tenantId, uid,
          `👤 <b>Вам назначен лид</b>\n<b>${escHtml(lead.name || 'Без имени')}</b>` +
          (lead.phone ? `\n📞 ${lead.phone}` : ''),
        );
      }
    }
  }

  /**
   * Проверить условия
   */
  private checkConditions(
    conditions: Array<{
      field: string;
      operator: string;
      value?: any;
    }>,
    data: any,
  ): boolean {
    return conditions.every((condition) => {
      const fieldValue = this.getFieldValue(data, condition.field);
      return this.evaluateCondition(fieldValue, condition.operator, condition.value);
    });
  }

  /**
   * Получить значение поля из данных (поддержка вложенных полей через точку)
   */
  private getFieldValue(data: any, field: string): any {
    const parts = field.split('.');
    let value = data;
    for (const part of parts) {
      if (value === null || value === undefined) return null;
      value = value[part];
    }
    return value;
  }

  /**
   * Оценить условие
   */
  private evaluateCondition(
    fieldValue: any,
    operator: string,
    expectedValue: any,
  ): boolean {
    switch (operator) {
      case 'equals':
        return fieldValue === expectedValue;
      case 'not_equals':
        return fieldValue !== expectedValue;
      case 'contains':
        return String(fieldValue || '').includes(String(expectedValue || ''));
      case 'not_contains':
        return !String(fieldValue || '').includes(String(expectedValue || ''));
      case 'greater_than':
        return Number(fieldValue) > Number(expectedValue);
      case 'less_than':
        return Number(fieldValue) < Number(expectedValue);
      case 'greater_or_equal':
        return Number(fieldValue) >= Number(expectedValue);
      case 'less_or_equal':
        return Number(fieldValue) <= Number(expectedValue);
      case 'is_empty':
        return fieldValue === null || fieldValue === undefined || fieldValue === '';
      case 'is_not_empty':
        return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
      case 'starts_with':
        return String(fieldValue || '').startsWith(String(expectedValue || ''));
      case 'ends_with':
        return String(fieldValue || '').endsWith(String(expectedValue || ''));
      default:
        return false;
    }
  }

  /**
   * Для расписания с привязкой к лиду (meta.contextLeadId) — подмешиваем лид в triggerData,
   * чтобы send_email и шаблоны получали {{lead.*}} и адрес из карточки.
   */
  private async mergeScheduledLeadContext(
    automation: Automation,
    triggerData: any,
  ): Promise<any> {
    const leadId = automation.meta?.contextLeadId as string | undefined;
    if (!leadId || typeof leadId !== 'string') {
      return triggerData;
    }
    const lead = await this.leadRepo.findOne({
      where: { id: leadId, tenantId: automation.tenantId },
    });
    if (!lead) {
      return triggerData;
    }
    return {
      ...triggerData,
      leadId: lead.id,
      entityType: 'lead',
      entityId: lead.id,
      email: lead.email || triggerData.email,
      lead: lead as any,
    };
  }

  /**
   * Выполнить автоматизацию
   */
  private async executeAutomation(
    automation: Automation,
    event: TriggerEvent,
    triggerData: any,
  ): Promise<void> {
    let effectiveTriggerData =
      typeof triggerData === 'object' && triggerData !== null && !Array.isArray(triggerData)
        ? { ...triggerData }
        : { _raw: triggerData };
    if (!effectiveTriggerData.tenantId) {
      effectiveTriggerData.tenantId = automation.tenantId;
    }
    if (!effectiveTriggerData.automationId) {
      effectiveTriggerData.automationId = automation.id;
    }
    if (event === TriggerEvent.SCHEDULED && automation.meta?.contextLeadId) {
      effectiveTriggerData = await this.mergeScheduledLeadContext(
        automation,
        effectiveTriggerData,
      );
    }
    const execution = this.executionRepo.create({
      tenantId: automation.tenantId,
      automationId: automation.id,
      triggerEvent: event,
      triggerData: effectiveTriggerData,
      entityType: effectiveTriggerData?.entityType || null,
      entityId: effectiveTriggerData?.entityId || null,
      status: 'pending',
      actionsExecuted: 0,
    });

    await this.executionRepo.save(execution);

    const results: Array<{
      action: string;
      success: boolean;
      result?: any;
      error?: string;
    }> = [];
    let firstError: string | null = null;

    let ctx: any =
      typeof effectiveTriggerData === 'object' &&
      effectiveTriggerData !== null &&
      !Array.isArray(effectiveTriggerData)
        ? { ...effectiveTriggerData }
        : { _trigger: effectiveTriggerData };

    for (let i = 0; i < automation.actions.length; i++) {
      const action = automation.actions[i];
      try {
        const result = await this.executeAction(action, ctx, automation.tenantId);
        results.push({ action: action.type, success: true, result });
        execution.actionsExecuted++;
        ctx = {
          ...ctx,
          lastActionResult: result,
          lastAction: { index: i, type: action.type, result },
        };
      } catch (error: any) {
        const msg = error?.message || String(error);
        results.push({
          action: action.type,
          success: false,
          error: msg,
        });
        if (!firstError) {
          firstError = msg;
        }
      }
    }

    automation.executionCount++;
    automation.lastExecutedAt = new Date();

    if (firstError) {
      automation.errorCount++;
      automation.lastError = firstError;
      execution.status = 'error';
      execution.errorMessage = firstError;
    } else {
      automation.lastError = null;
      execution.status = 'success';
      execution.errorMessage = null;
    }

    execution.executionResult = results;
    await this.automationRepo.save(automation);
    await this.executionRepo.save(execution);
  }

  /**
   * Выполнить действие
   */
  private async executeAction(
    action: { type: string; config: Record<string, any> },
    triggerData: any,
    tenantId: string,
  ): Promise<any> {
    const { type, config } = action;
    const entityId = triggerData.entityId || triggerData.entity?.id || triggerData.contact?.id || triggerData.lead?.id || triggerData.sale?.id;
    const entityType = triggerData.entityType || triggerData.entity?.constructor?.name?.toLowerCase() || 
      (triggerData.contact ? 'contact' : null) ||
      (triggerData.lead ? 'lead' : null) ||
      (triggerData.sale ? 'sale' : null) ||
      (triggerData.company ? 'company' : null) ||
      (triggerData.project ? 'project' : null) ||
      (triggerData.task ? 'task' : null);

    switch (type) {
      case 'trigger_webhook': {
        const { url, method = 'POST', headers = {}, body = {} } = config;
        if (!url) {
          throw new Error('Webhook URL is required');
        }

        try {
          const response = await axios({
            method: method.toUpperCase(),
            url,
            headers: {
              'Content-Type': 'application/json',
              ...headers,
            },
            data: {
              ...body,
              triggerData,
            },
            timeout: 10000,
          });

          return { webhookCalled: true, status: response.status };
        } catch (error: any) {
          throw new Error(`Webhook failed: ${error.message}`);
        }
      }

      case 'send_slack': {
        const { integrationConnectionId, webhookUrl: cfgWebhook, text } = config;
        let webhookUrl = '';
        if (cfgWebhook) {
          webhookUrl = this.interpolateString(String(cfgWebhook), triggerData).trim();
        }
        if (!webhookUrl && integrationConnectionId) {
          webhookUrl =
            (await this.integrationsService.getSlackWebhookUrlForConnection(
              tenantId,
              String(integrationConnectionId),
            )) || '';
        }
        if (!webhookUrl) {
          throw new Error(
            'send_slack: укажите webhookUrl (https://hooks.slack.com/...) или integrationConnectionId подключения Slack',
          );
        }
        const message = this.interpolateString(
          String(text || 'Уведомление из Lumiva CRM'),
          triggerData,
        );
        await this.integrationsService.sendSlackIncomingWebhookRaw(webhookUrl, message);
        return { slackSent: true };
      }

      case 'send_teams': {
        const { integrationConnectionId, webhookUrl: cfgWebhook, title, text } = config;
        let webhookUrl = '';
        if (cfgWebhook) {
          webhookUrl = this.interpolateString(String(cfgWebhook), triggerData).trim();
        }
        if (!webhookUrl && integrationConnectionId) {
          webhookUrl =
            (await this.integrationsService.getTeamsWebhookUrlForConnection(
              tenantId,
              String(integrationConnectionId),
            )) || '';
        }
        if (!webhookUrl) {
          throw new Error(
            'send_teams: укажите webhookUrl или integrationConnectionId подключения Microsoft Teams',
          );
        }
        const cardTitle = this.interpolateString(
          String(title || 'Lumiva CRM'),
          triggerData,
        );
        const cardText = this.interpolateString(
          String(text || 'Уведомление из Lumiva CRM'),
          triggerData,
        );
        await this.integrationsService.sendTeamsIncomingWebhookRaw(
          webhookUrl,
          cardTitle,
          cardText,
        );
        return { teamsSent: true };
      }

      case 'send_mailchimp': {
        const {
          integrationConnectionId,
          listId,
          email: emailTpl,
          mergeFieldsJson,
          subscriptionStatus,
        } = config;
        if (!integrationConnectionId) {
          throw new Error(
            'send_mailchimp: укажите integrationConnectionId подключения Mailchimp',
          );
        }
        const apiKey = await this.integrationsService.getMailchimpApiKeyForConnection(
          tenantId,
          String(integrationConnectionId),
        );
        if (!apiKey) {
          throw new Error(
            'send_mailchimp: подключение не найдено или в нём не Mailchimp API key (каталог mailchimp)',
          );
        }
        const list = this.interpolateString(String(listId || ''), triggerData).trim();
        if (!list) {
          throw new Error(
            'send_mailchimp: укажите listId — Audience ID из Mailchimp (Audience → Settings → Audience name and defaults)',
          );
        }
        let email = '';
        if (emailTpl) {
          email = this.interpolateString(String(emailTpl), triggerData).trim();
        } else {
          const d = triggerData as Record<string, any>;
          email = String(d?.lead?.email || d?.contact?.email || d?.email || '').trim();
        }
        if (!email) {
          throw new Error(
            'send_mailchimp: не удалось определить email (заполните поле email в шаге или используйте триггер с лидом/контактом)',
          );
        }
        let merge: Record<string, unknown> = {};
        if (mergeFieldsJson) {
          const raw = this.interpolateString(String(mergeFieldsJson), triggerData);
          let parsed: unknown;
          try {
            parsed = JSON.parse(raw);
          } catch {
            throw new Error(
              'send_mailchimp: mergeFieldsJson должен быть JSON-объектом после подстановки переменных',
            );
          }
          if (
            parsed === null ||
            typeof parsed !== 'object' ||
            Array.isArray(parsed)
          ) {
            throw new Error(
              'send_mailchimp: mergeFieldsJson должен быть объектом { "FNAME": "…" }, не массивом',
            );
          }
          merge = parsed as Record<string, unknown>;
        }
        const statusStr = String(subscriptionStatus || 'subscribed')
          .trim()
          .toLowerCase();
        const memberStatus = statusStr === 'pending' ? 'pending' : 'subscribed';
        await this.integrationsService.mailchimpUpsertMemberRaw(
          apiKey,
          list,
          email,
          merge,
          { status: memberStatus },
        );
        return { mailchimpSent: true };
      }

      case 'send_mailchimp_campaign': {
        const {
          integrationConnectionId,
          listId,
          subject,
          htmlBody,
          textBody,
          fromName,
          replyTo,
          campaignTitle,
        } = config;
        if (!integrationConnectionId) {
          throw new Error(
            'send_mailchimp_campaign: укажите integrationConnectionId подключения Mailchimp',
          );
        }
        const apiKey = await this.integrationsService.getMailchimpApiKeyForConnection(
          tenantId,
          String(integrationConnectionId),
        );
        if (!apiKey) {
          throw new Error(
            'send_mailchimp_campaign: подключение не найдено или в нём не Mailchimp API key (каталог mailchimp)',
          );
        }
        const list = this.interpolateString(String(listId || ''), triggerData).trim();
        if (!list) {
          throw new Error(
            'send_mailchimp_campaign: укажите listId — Audience ID из Mailchimp',
          );
        }
        const subj = this.interpolateString(String(subject || ''), triggerData).trim();
        const html = this.interpolateString(String(htmlBody || ''), triggerData).trim();
        if (!subj) {
          throw new Error('send_mailchimp_campaign: укажите subject (тему письма)');
        }
        if (!html) {
          throw new Error(
            'send_mailchimp_campaign: укажите htmlBody (HTML письма для всей аудитории)',
          );
        }
        const from = this.interpolateString(
          String(fromName || 'Lumiva CRM'),
          triggerData,
        ).trim();
        const reply = this.interpolateString(String(replyTo || ''), triggerData)
          .trim()
          .toLowerCase();
        if (!reply || !reply.includes('@')) {
          throw new Error(
            'send_mailchimp_campaign: укажите replyTo — email с домена, верифицированного в Mailchimp (настройки аудитории / домена)',
          );
        }
        const titleRaw = campaignTitle
          ? this.interpolateString(String(campaignTitle), triggerData).trim()
          : subj;
        const title = titleRaw.slice(0, 100);
        const plain = textBody
          ? this.interpolateString(String(textBody), triggerData).trim()
          : undefined;
        const { campaignId } =
          await this.integrationsService.mailchimpCreateAndSendCampaignRaw(apiKey, {
            listId: list,
            subjectLine: subj,
            campaignTitle: title,
            fromName: from,
            replyTo: reply,
            html,
            plainText: plain,
          });
        return { mailchimpCampaignSent: true, mailchimpCampaignId: campaignId };
      }

      case 'send_zapier': {
        const { integrationConnectionId, webhookUrl: cfgHook, text, jsonPayload } = config;
        let hookUrl = '';
        if (cfgHook) {
          hookUrl = this.interpolateString(String(cfgHook), triggerData).trim();
        }
        if (!hookUrl && integrationConnectionId) {
          hookUrl =
            (await this.integrationsService.getZapierWebhookUrlForConnection(
              tenantId,
              String(integrationConnectionId),
            )) || '';
        }
        if (!hookUrl) {
          throw new Error(
            'send_zapier: укажите webhookUrl (hooks.zapier.com) или integrationConnectionId',
          );
        }
        let body: Record<string, unknown>;
        if (jsonPayload) {
          const raw = this.interpolateString(String(jsonPayload), triggerData);
          try {
            body = JSON.parse(raw) as Record<string, unknown>;
          } catch {
            throw new Error('send_zapier: jsonPayload должен быть валидным JSON после подстановки');
          }
        } else {
          const message = this.interpolateString(
            String(text || 'Событие из Lumiva CRM'),
            triggerData,
          );
          body = {
            source: 'lumiva-crm',
            text: message,
            triggerEvent: triggerData?.event || triggerData?.triggerEvent,
            at: new Date().toISOString(),
          };
        }
        await this.integrationsService.postZapierCatchHookRaw(hookUrl, body);
        return { zapierSent: true };
      }

      case 'send_sms': {
        const { to, text: smsText } = config;
        const toRaw = to
          ? this.interpolateString(String(to), triggerData).trim()
          : '';
        const toPhone =
          toRaw ||
          String(
            triggerData?.lead?.phone ||
              triggerData?.contact?.phone ||
              triggerData?.phone ||
              '',
          ).trim();
        if (!toPhone) {
          throw new Error('send_sms: укажите номер to или поле phone у лида/контакта');
        }
        const message = this.interpolateString(
          String(smsText || 'Сообщение из Lumiva CRM'),
          triggerData,
        );
        await this.smsService.sendFromAutomation(
          tenantId,
          toPhone,
          message,
          triggerData?.lead?.id ? 'lead' : triggerData?.contact?.id ? 'contact' : undefined,
          triggerData?.lead?.id ?? triggerData?.contact?.id ?? undefined,
        );
        return { smsSent: true };
      }

      case 'send_whatsapp': {
        const {
          integrationConnectionId,
          phoneNumberId: cfgPid,
          accessToken: cfgTok,
          to,
          text,
        } = config;
        let phoneNumberId = cfgPid
          ? this.interpolateString(String(cfgPid), triggerData).trim()
          : '';
        let accessToken = cfgTok
          ? this.interpolateString(String(cfgTok), triggerData).trim()
          : '';
        if ((!phoneNumberId || !accessToken) && integrationConnectionId) {
          const creds = await this.integrationsService.getWhatsappCredentialsForConnection(
            tenantId,
            String(integrationConnectionId),
          );
          if (creds) {
            phoneNumberId = phoneNumberId || creds.phoneNumberId;
            accessToken = accessToken || creds.accessToken;
          }
        }
        if (!phoneNumberId || !accessToken) {
          throw new Error(
            'send_whatsapp: укажите integrationConnectionId (подключение WhatsApp) или phoneNumberId + accessToken',
          );
        }
        const toRaw = to
          ? this.interpolateString(String(to), triggerData).trim()
          : '';
        const toPhone =
          toRaw ||
          String(
            triggerData?.lead?.phone ||
              triggerData?.contact?.phone ||
              triggerData?.phone ||
              '',
          ).trim();
        if (!toPhone) {
          throw new Error(
            'send_whatsapp: укажите номер to или поле phone у лида/контакта в триггере',
          );
        }
        const message = this.interpolateString(
          String(text || 'Сообщение из Lumiva CRM'),
          triggerData,
        );
        await this.integrationsService.sendWhatsappTextRaw(
          phoneNumberId,
          accessToken,
          toPhone,
          message,
        );
        return { whatsappSent: true };
      }

      case 'send_google_calendar': {
        const {
          integrationConnectionId,
          accessToken: cfgTok,
          calendarId: cfgCal,
          summary,
          description,
          durationMinutes,
          startOffsetMinutes,
          timeZone,
        } = config;
        let accessToken = cfgTok
          ? this.interpolateString(String(cfgTok), triggerData).trim()
          : '';
        let calendarId = cfgCal
          ? this.interpolateString(String(cfgCal), triggerData).trim()
          : '';
        if ((!accessToken || !calendarId) && integrationConnectionId) {
          const creds = await this.integrationsService.getGoogleCalendarCredentialsForConnection(
            tenantId,
            String(integrationConnectionId),
          );
          if (creds) {
            accessToken = accessToken || creds.accessToken;
            calendarId = calendarId || creds.calendarId;
          }
        }
        if (!accessToken) {
          throw new Error(
            'send_google_calendar: укажите integrationConnectionId (подключение Google Calendar) или accessToken',
          );
        }
        const cal = calendarId || 'primary';
        const tzRaw = timeZone
          ? this.interpolateString(String(timeZone), triggerData).trim()
          : '';
        const tz = tzRaw || 'UTC';
        const offsetMin = Number.parseInt(String(startOffsetMinutes ?? 0), 10);
        const durMin = Number.parseInt(String(durationMinutes ?? 60), 10);
        const off = Number.isFinite(offsetMin) ? offsetMin : 0;
        const dur = Number.isFinite(durMin) && durMin > 0 ? durMin : 60;
        const startMs = Date.now() + off * 60 * 1000;
        const endMs = startMs + dur * 60 * 1000;
        const startIso = new Date(startMs).toISOString();
        const endIso = new Date(endMs).toISOString();
        const summ = this.interpolateString(
          String(summary || 'Событие из Lumiva CRM'),
          triggerData,
        );
        const desc = description
          ? this.interpolateString(String(description), triggerData)
          : undefined;
        await this.integrationsService.createGoogleCalendarEventRaw(accessToken, cal, {
          summary: summ,
          description: desc,
          startIso,
          endIso,
          timeZone: tz,
        });
        return { googleCalendarEventCreated: true };
      }

      case 'send_outlook_calendar': {
        const {
          integrationConnectionId,
          accessToken: cfgTok,
          calendarId: cfgCal,
          summary,
          description,
          durationMinutes,
          startOffsetMinutes,
        } = config;
        let accessToken = cfgTok
          ? this.interpolateString(String(cfgTok), triggerData).trim()
          : '';
        let calStr = cfgCal
          ? this.interpolateString(String(cfgCal), triggerData).trim()
          : '';
        if ((!accessToken || calStr === '') && integrationConnectionId) {
          const creds = await this.integrationsService.getOutlookCalendarCredentialsForConnection(
            tenantId,
            String(integrationConnectionId),
          );
          if (creds) {
            if (!accessToken) accessToken = creds.accessToken;
            if (!calStr && creds.calendarGraphId) calStr = creds.calendarGraphId;
          }
        }
        const calendarGraphId = calStr.length > 0 ? calStr : null;
        if (!accessToken) {
          throw new Error(
            'send_outlook_calendar: укажите integrationConnectionId (подключение Outlook / Microsoft 365) или accessToken',
          );
        }
        const offsetMin = Number.parseInt(String(startOffsetMinutes ?? 0), 10);
        const durMin = Number.parseInt(String(durationMinutes ?? 60), 10);
        const off = Number.isFinite(offsetMin) ? offsetMin : 0;
        const dur = Number.isFinite(durMin) && durMin > 0 ? durMin : 60;
        const startMs = Date.now() + off * 60 * 1000;
        const endMs = startMs + dur * 60 * 1000;
        const startIsoUtc = new Date(startMs).toISOString();
        const endIsoUtc = new Date(endMs).toISOString();
        const subject = this.interpolateString(
          String(summary || 'Событие из Lumiva CRM'),
          triggerData,
        );
        const bodyText = description
          ? this.interpolateString(String(description), triggerData)
          : undefined;
        await this.integrationsService.createOutlookCalendarEventRaw(
          accessToken,
          calendarGraphId,
          {
            subject,
            bodyText,
            startIsoUtc,
            endIsoUtc,
          },
        );
        return { outlookCalendarEventCreated: true };
      }

      case 'send_bitrix': {
        const { integrationConnectionId, webhookUrl: cfgWebhook, method, paramsJson } = config;
        let baseUrl = '';
        if (cfgWebhook) {
          baseUrl = this.interpolateString(String(cfgWebhook), triggerData).trim();
        }
        if (!baseUrl && integrationConnectionId) {
          baseUrl =
            (await this.integrationsService.getBitrixWebhookBaseForConnection(
              tenantId,
              String(integrationConnectionId),
            )) || '';
        }
        if (!baseUrl) {
          throw new Error(
            'send_bitrix: укажите webhookUrl (базовый URL входящего вебхука …/rest/1/…/) или integrationConnectionId подключения Битрикс24',
          );
        }
        const m = this.interpolateString(String(method || ''), triggerData).trim();
        if (!m) {
          throw new Error(
            'send_bitrix: укажите method (например crm.lead.add, tasks.task.add, im.message.add)',
          );
        }
        let payload: Record<string, unknown> = {};
        if (paramsJson) {
          const raw = this.interpolateString(String(paramsJson), triggerData);
          try {
            payload = JSON.parse(raw) as Record<string, unknown>;
          } catch {
            throw new Error(
              'send_bitrix: paramsJson должен быть валидным JSON-объектом после подстановки переменных',
            );
          }
          if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            throw new Error('send_bitrix: paramsJson должен быть JSON-объектом (не массивом)');
          }
        }
        await this.integrationsService.callBitrixRestMethodRaw(baseUrl, m, payload);
        return { bitrixSent: true };
      }

      case 'send_amocrm': {
        const {
          integrationConnectionId,
          webhookUrl: cfgBase,
          accessToken: cfgTok,
          httpMethod,
          apiPath,
          paramsJson,
        } = config;
        let baseUrl = '';
        if (cfgBase) {
          baseUrl = this.interpolateString(String(cfgBase), triggerData).trim();
        }
        let accessToken = '';
        if (cfgTok) {
          accessToken = this.interpolateString(String(cfgTok), triggerData).trim();
        }
        if ((!baseUrl || !accessToken) && integrationConnectionId) {
          const creds = await this.integrationsService.getAmocrmCredentialsForConnection(
            tenantId,
            String(integrationConnectionId),
          );
          if (creds) {
            if (!baseUrl) baseUrl = creds.baseUrl;
            if (!accessToken) accessToken = creds.accessToken;
          }
        }
        if (!baseUrl || !accessToken) {
          throw new Error(
            'send_amocrm: укажите базовый URL аккаунта (https://…amocrm.ru) и токен, или integrationConnectionId подключения amoCRM',
          );
        }
        const methodRaw = httpMethod
          ? this.interpolateString(String(httpMethod), triggerData).trim()
          : 'POST';
        const httpVerb = (methodRaw || 'POST').toUpperCase();
        if (!['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(httpVerb)) {
          throw new Error('send_amocrm: httpMethod должен быть GET, POST, PATCH, PUT или DELETE');
        }
        const path = this.interpolateString(String(apiPath || ''), triggerData).trim();
        if (!path) {
          throw new Error(
            'send_amocrm: укажите apiPath (например /api/v4/leads или /api/v4/contacts)',
          );
        }
        let body: unknown = undefined;
        if (httpVerb !== 'GET' && paramsJson) {
          const raw = this.interpolateString(String(paramsJson), triggerData);
          try {
            body = JSON.parse(raw) as unknown;
          } catch {
            throw new Error(
              'send_amocrm: paramsJson должен быть валидным JSON после подстановки переменных',
            );
          }
          if (body !== null && typeof body !== 'object') {
            throw new Error('send_amocrm: paramsJson должен быть JSON-объектом или массивом');
          }
        }
        await this.integrationsService.callAmocrmApiRaw(
          baseUrl,
          accessToken,
          httpVerb,
          path,
          body,
        );
        return { amocrmSent: true };
      }

      case 'send_hubspot': {
        const {
          integrationConnectionId,
          webhookUrl: cfgBase,
          accessToken: cfgTok,
          httpMethod,
          apiPath,
          paramsJson,
        } = config;
        let baseUrl = '';
        if (cfgBase) {
          baseUrl = this.interpolateString(String(cfgBase), triggerData).trim();
        }
        let accessToken = '';
        if (cfgTok) {
          accessToken = this.interpolateString(String(cfgTok), triggerData).trim();
        }
        if ((!accessToken || !baseUrl) && integrationConnectionId) {
          const creds = await this.integrationsService.getHubspotCredentialsForConnection(
            tenantId,
            String(integrationConnectionId),
          );
          if (creds) {
            if (!accessToken) accessToken = creds.accessToken;
            if (!baseUrl) baseUrl = creds.baseUrl;
          }
        }
        if (!accessToken) {
          throw new Error(
            'send_hubspot: укажите access token (private app) или integrationConnectionId подключения HubSpot',
          );
        }
        const effectiveBase = baseUrl || 'https://api.hubapi.com';
        const methodRaw = httpMethod
          ? this.interpolateString(String(httpMethod), triggerData).trim()
          : 'POST';
        const httpVerb = (methodRaw || 'POST').toUpperCase();
        if (!['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(httpVerb)) {
          throw new Error('send_hubspot: httpMethod должен быть GET, POST, PATCH, PUT или DELETE');
        }
        const path = this.interpolateString(String(apiPath || ''), triggerData).trim();
        if (!path) {
          throw new Error(
            'send_hubspot: укажите apiPath (например /crm/v3/objects/contacts или /crm/v3/objects/deals)',
          );
        }
        let body: unknown = undefined;
        if (httpVerb !== 'GET' && paramsJson) {
          const raw = this.interpolateString(String(paramsJson), triggerData);
          try {
            body = JSON.parse(raw) as unknown;
          } catch {
            throw new Error(
              'send_hubspot: paramsJson должен быть валидным JSON после подстановки переменных',
            );
          }
          if (body !== null && typeof body !== 'object') {
            throw new Error('send_hubspot: paramsJson должен быть JSON-объектом или массивом');
          }
        }
        await this.integrationsService.callHubspotApiRaw(
          effectiveBase,
          accessToken,
          httpVerb,
          path,
          body,
        );
        return { hubspotSent: true };
      }

      case 'send_google_ads': {
        const {
          integrationConnectionId,
          marketingIntegrationId: marketingIntegrationIdRaw,
          accessToken: cfgTok,
          developerToken: cfgDev,
          customerId: cfgCust,
          httpMethod,
          apiPath,
          paramsJson,
        } = config;
        let developerToken = cfgDev
          ? this.interpolateString(String(cfgDev), triggerData).trim()
          : '';
        let accessToken = cfgTok
          ? this.interpolateString(String(cfgTok), triggerData).trim()
          : '';
        let customerIdStr = cfgCust
          ? this.interpolateString(String(cfgCust), triggerData).trim().replace(/\D/g, '')
          : '';
        const marketingIntegrationId = marketingIntegrationIdRaw
          ? this.interpolateString(String(marketingIntegrationIdRaw), triggerData).trim()
          : '';
        if ((!developerToken || !accessToken) && marketingIntegrationId) {
          const bundle = await this.marketingService.getGoogleAdsCredentialBundleForAutomation(
            tenantId,
            marketingIntegrationId,
          );
          if (bundle) {
            if (!developerToken) developerToken = bundle.developerToken;
            if (!accessToken) accessToken = bundle.accessToken;
            if (!customerIdStr && bundle.customerId) customerIdStr = bundle.customerId;
          }
        }
        if ((!developerToken || !accessToken) && integrationConnectionId) {
          const creds = await this.integrationsService.getGoogleAdsCredentialsForConnection(
            tenantId,
            String(integrationConnectionId),
          );
          if (creds) {
            if (!developerToken) developerToken = creds.developerToken;
            if (!accessToken) accessToken = creds.accessToken;
            if (!customerIdStr && creds.customerId) customerIdStr = creds.customerId;
          }
        }
        if (!developerToken || !accessToken) {
          throw new Error(
            'send_google_ads: укажите developer token и access token (или overrides), либо marketingIntegrationId из маркетинга, либо integrationConnectionId подключения автоматизаций',
          );
        }
        const methodRaw = httpMethod
          ? this.interpolateString(String(httpMethod), triggerData).trim()
          : 'POST';
        const httpVerb = (methodRaw || 'POST').toUpperCase();
        if (!['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(httpVerb)) {
          throw new Error(
            'send_google_ads: httpMethod должен быть GET, POST, PATCH, PUT или DELETE',
          );
        }
        const td: Record<string, unknown> =
          typeof triggerData === 'object' && triggerData !== null && !Array.isArray(triggerData)
            ? { ...(triggerData as Record<string, unknown>) }
            : {};
        if (customerIdStr) td.customerId = customerIdStr;
        const path = this.interpolateString(String(apiPath || ''), td).trim();
        if (!path) {
          throw new Error(
            'send_google_ads: укажите apiPath (например /customers/1234567890/googleAds:search)',
          );
        }
        let body: unknown = undefined;
        if (httpVerb !== 'GET' && paramsJson) {
          const raw = this.interpolateString(String(paramsJson), triggerData);
          try {
            body = JSON.parse(raw) as unknown;
          } catch {
            throw new Error(
              'send_google_ads: paramsJson должен быть валидным JSON после подстановки переменных',
            );
          }
          if (body !== null && typeof body !== 'object') {
            throw new Error('send_google_ads: paramsJson должен быть JSON-объектом или массивом');
          }
        }
        const data = await this.integrationsService.callGoogleAdsApiRaw(
          developerToken,
          accessToken,
          httpVerb,
          path,
          body,
        );
        return { googleAdsSent: true, data };
      }

      case 'send_meta_ads': {
        const {
          integrationConnectionId,
          marketingIntegrationId: marketingIntegrationIdRaw,
          accessToken: cfgTok,
          httpMethod,
          apiPath,
          paramsJson,
        } = config;
        let accessToken = cfgTok
          ? this.interpolateString(String(cfgTok), triggerData).trim()
          : '';
        const marketingIntegrationId = marketingIntegrationIdRaw
          ? this.interpolateString(String(marketingIntegrationIdRaw), triggerData).trim()
          : '';
        if (!accessToken && marketingIntegrationId) {
          const bundle = await this.marketingService.getMetaAdsCredentialBundleForAutomation(
            tenantId,
            marketingIntegrationId,
          );
          if (bundle) accessToken = bundle.accessToken;
        }
        if (!accessToken && integrationConnectionId) {
          const creds = await this.integrationsService.getMetaAdsCredentialsForConnection(
            tenantId,
            String(integrationConnectionId),
          );
          if (creds) accessToken = creds.accessToken;
        }
        if (!accessToken) {
          throw new Error(
            'send_meta_ads: укажите access token, или marketingIntegrationId из маркетинга, или integrationConnectionId подключения автоматизаций',
          );
        }
        const methodRaw = httpMethod
          ? this.interpolateString(String(httpMethod), triggerData).trim()
          : 'GET';
        const httpVerb = (methodRaw || 'GET').toUpperCase();
        if (!['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(httpVerb)) {
          throw new Error(
            'send_meta_ads: httpMethod должен быть GET, POST, PATCH, PUT или DELETE',
          );
        }
        const path = this.interpolateString(String(apiPath || ''), triggerData).trim();
        if (!path) {
          throw new Error(
            'send_meta_ads: укажите apiPath (например me/adaccounts или act_123456/campaigns)',
          );
        }
        let body: unknown = undefined;
        if (httpVerb !== 'GET' && paramsJson) {
          const raw = this.interpolateString(String(paramsJson), triggerData);
          try {
            body = JSON.parse(raw) as unknown;
          } catch {
            throw new Error(
              'send_meta_ads: paramsJson должен быть валидным JSON после подстановки переменных',
            );
          }
          if (body !== null && typeof body !== 'object') {
            throw new Error('send_meta_ads: paramsJson должен быть JSON-объектом или массивом');
          }
        }
        const data = await this.integrationsService.callMetaAdsGraphRaw(
          accessToken,
          httpVerb,
          path,
          body,
        );
        return { metaAdsSent: true, data };
      }

      case 'send_email': {
        const { accountId, to, subject, textBody, htmlBody, templateId } = config;
        if (!accountId) {
          throw new Error('Email accountId is required');
        }

        // Извлекаем email получателя из triggerData если to не указан
        let recipientEmail: string[] = [];
        if (to) {
          recipientEmail = Array.isArray(to) ? to : [to];
        } else {
          // Пытаемся извлечь email из triggerData
          const emailFromData = 
            triggerData.lead?.email || 
            triggerData.contact?.email || 
            triggerData.email ||
            triggerData.to;
          
          if (emailFromData) {
            recipientEmail = Array.isArray(emailFromData) ? emailFromData : [emailFromData];
          } else {
            throw new Error('Email recipient (to) is required');
          }
        }
        
        // Извлекаем ID сущностей из triggerData
        const leadId = triggerData.leadId || triggerData.lead?.id || triggerData.entityId;
        const contactId = triggerData.contactId || triggerData.contact?.id;
        const companyId = triggerData.companyId || triggerData.company?.id;
        const saleId = triggerData.saleId || triggerData.sale?.id;
        
        console.log('Sending email:', {
          accountId,
          to: recipientEmail,
          leadId,
          contactId,
          companyId,
          saleId,
          templateId,
        });
        
        // Если указан templateId, передаем его и данные для интерполяции
        // Иначе используем прямые значения subject/textBody/htmlBody
        return await this.emailService.sendEmail(tenantId, {
          accountId,
          to: recipientEmail,
          subject: templateId ? undefined : (subject ? this.interpolateString(subject, triggerData) : (config.subject ? this.interpolateString(config.subject, triggerData) : 'Notification')),
          textBody: templateId ? undefined : (textBody ? this.interpolateString(textBody, triggerData) : undefined),
          htmlBody: templateId ? undefined : (htmlBody ? this.interpolateString(htmlBody, triggerData) : undefined),
          templateId: templateId || undefined,
          contactId,
          companyId,
          leadId,
          saleId,
        }, triggerData); // Передаем triggerData для интерполяции в шаблоне
      }

      case 'send_telegram': {
        const { botId, text } = config;
        const recipientIds: string[] = Array.isArray(config.recipientIds) ? config.recipientIds : [];
        const telegramUserId: string = String(config.telegramUserId || '').trim();

        if (!botId || !text) {
          throw new Error('Telegram botId and text are required');
        }
        if (!recipientIds.length && !telegramUserId) {
          throw new Error('Выберите хотя бы одного получателя Telegram');
        }

        const interpolated = this.interpolateString(text, triggerData);

        if (recipientIds.length) {
          // New path: resolve recipients from bot.meta.recipients
          const bot = await this.telegramCrmService.findBot(tenantId, botId);
          const allRecipients: any[] = (bot.meta?.recipients as any[]) || [];
          const targets = allRecipients.filter((r: any) => recipientIds.includes(r.id));
          if (!targets.length) {
            throw new Error('Указанные получатели Telegram не найдены в настройках бота');
          }
          for (const r of targets) {
            await this.telegramCrmService.sendDirectToChat(tenantId, botId, String(r.telegramChatId), interpolated);
          }
          return { telegramSent: targets.length };
        }

        // Legacy path: single telegramUserId (contact record required)
        return await this.telegramCrmService.sendMessage(
          tenantId,
          botId,
          telegramUserId,
          interpolated,
          {
            contactId: triggerData.contactId || triggerData.contact?.id,
            companyId: triggerData.companyId || triggerData.company?.id,
            leadId: triggerData.leadId || triggerData.lead?.id,
            saleId: triggerData.saleId || triggerData.sale?.id,
          },
        );
      }

      case 'create_note': {
        const { content, title, type = 'note', isPrivate = false } = config;
        if (!content || !entityId || !entityType) {
          throw new Error('Note content, entityId and entityType are required');
        }

        // Маппинг entityType к NoteEntityType
        const noteEntityType = this.mapEntityTypeToNoteEntityType(entityType);
        if (!noteEntityType) {
          throw new Error(`Unsupported entity type for notes: ${entityType}`);
        }

        return await this.notesService.create(
          tenantId,
          {
            entityType: noteEntityType,
            entityId,
            content: this.interpolateString(content, triggerData),
            title: title ? this.interpolateString(title, triggerData) : undefined,
            type,
            isPrivate,
          },
          triggerData.userId,
          triggerData.userName,
        );
      }

      case 'update_field': {
        const { field, value } = config;
        if (!field || value === undefined) {
          throw new Error('Field and value are required');
        }

        const resolved = await this.resolveAutomationActionTarget(
          tenantId,
          config,
          triggerData,
          entityType,
          entityId,
          String(field),
        );
        const fieldPath = this.stripEntityPrefix(String(field), resolved.type);
        const nextValue =
          typeof value === 'string'
            ? this.interpolateString(value, triggerData)
            : value;
        this.setAutomationEntityField(resolved.entity, fieldPath, nextValue);
        await this.saveAutomationActionEntity(resolved.type, resolved.entity);

        return {
          fieldUpdated: true,
          entityType: resolved.type,
          entityId: resolved.entity.id,
          field: fieldPath,
          value: nextValue,
        };
      }

      case 'add_tag': {
        const { tag } = config;
        if (!tag) {
          throw new Error('Tag is required');
        }

        const resolved = await this.resolveAutomationActionTarget(
          tenantId,
          config,
          triggerData,
          entityType,
          entityId,
        );
        const interpolatedTag = this.interpolateString(String(tag), triggerData).trim();
        if (!interpolatedTag) {
          throw new Error('Tag is required');
        }
        const tags = this.getAutomationEntityTags(resolved.entity);
        this.setAutomationEntityTags(resolved.entity, [
          ...new Set([...tags, interpolatedTag]),
        ]);
        await this.saveAutomationActionEntity(resolved.type, resolved.entity);

        return {
          tagAdded: true,
          entityType: resolved.type,
          entityId: resolved.entity.id,
          tag: interpolatedTag,
        };
      }

      case 'remove_tag': {
        const { tag } = config;
        if (!tag) {
          throw new Error('Tag is required');
        }

        const resolved = await this.resolveAutomationActionTarget(
          tenantId,
          config,
          triggerData,
          entityType,
          entityId,
        );
        const interpolatedTag = this.interpolateString(String(tag), triggerData).trim();
        if (!interpolatedTag) {
          throw new Error('Tag is required');
        }
        const tags = this.getAutomationEntityTags(resolved.entity).filter(
          (currentTag) => currentTag !== interpolatedTag,
        );
        this.setAutomationEntityTags(resolved.entity, tags);
        await this.saveAutomationActionEntity(resolved.type, resolved.entity);

        return {
          tagRemoved: true,
          entityType: resolved.type,
          entityId: resolved.entity.id,
          tag: interpolatedTag,
        };
      }

      case 'change_status': {
        const { status } = config;
        if (!status) {
          throw new Error('Status is required');
        }

        const resolved = await this.resolveAutomationActionTarget(
          tenantId,
          config,
          triggerData,
          entityType,
          entityId,
        );
        if (!('status' in resolved.entity)) {
          throw new Error(`change_status: entity type ${resolved.type} does not support status`);
        }
        const nextStatus = this.interpolateString(String(status), triggerData);
        resolved.entity.status = nextStatus;
        await this.saveAutomationActionEntity(resolved.type, resolved.entity);

        return {
          statusChanged: true,
          entityType: resolved.type,
          entityId: resolved.entity.id,
          status: nextStatus,
        };
      }

      case 'assign_user': {
        const configuredUserIds = Array.isArray(config.userIds)
          ? config.userIds
          : config.userId
            ? [config.userId]
            : [];
        const assignment = await this.resolveStaffAssignment(
          tenantId,
          configuredUserIds.map((id) => String(id || '').trim()).filter(Boolean),
        );
        if (!assignment.userIds.length) {
          throw new Error('assign_user: выберите хотя бы одного сотрудника');
        }

        const resolved = await this.resolveAutomationActionTarget(
          tenantId,
          config,
          triggerData,
          entityType,
          entityId,
        );
        this.assignAutomationEntityUsers(resolved.entity, assignment);
        await this.saveAutomationActionEntity(resolved.type, resolved.entity);

        return {
          userAssigned: true,
          entityType: resolved.type,
          entityId: resolved.entity.id,
          userIds: assignment.userIds,
        };
      }

      case 'assign_task': {
        const taskId =
          config.taskId ||
          triggerData.taskId ||
          triggerData.task?.id ||
          (entityType === 'task' ? entityId : null);
        const userId = String(config.userId || '').trim();
        if (!taskId || !userId) {
          throw new Error('assign_task: укажите taskId и сотрудника');
        }

        const assignment = await this.resolveStaffAssignment(tenantId, [userId]);
        if (!assignment.userIds.length) {
          throw new Error('assign_task: сотрудник не найден');
        }

        const task = await this.companyTaskRepo.findOne({
          where: { id: String(taskId), tenantId },
        });
        if (!task) {
          throw new Error('assign_task: задача не найдена');
        }
        task.assignedUserId = assignment.userIds[0];
        task.assignedTo = assignment.names[0] ?? null;
        await this.companyTaskRepo.save(task);

        return {
          taskAssigned: true,
          taskId: task.id,
          userId: task.assignedUserId,
        };
      }

      case 'create_task': {
        const title = config.title
          ? this.interpolateString(String(config.title), triggerData)
          : 'Задача из автоматизации';
        const companyId =
          config.companyId ||
          triggerData.companyId ||
          triggerData.company?.id ||
          triggerData.lead?.companyId ||
          (triggerData.lead as any)?.company?.id;
        if (!companyId) {
          throw new Error(
            'create_task: укажите companyId в действии или используйте триггер с компанией/лидом с компанией',
          );
        }
        return await this.companiesService.createTask(tenantId, {
          companyId: String(companyId),
          title,
          description: config.description
            ? this.interpolateString(String(config.description), triggerData)
            : null,
          status: this.normalizeCompanyTaskStatus(config.status),
          priority: config.priority ?? null,
          dueDate: this.resolveAutomationDueDate(config.dueDate),
          assignedUserId: config.assignedUserId ?? null,
          assignedTo: config.assignedUserId
            ? (await this.resolveStaffAssignment(tenantId, [String(config.assignedUserId)])).names[0] ?? null
            : null,
        });
      }

      case 'send_data_export': {
        const channel = (config.channel || 'email') as string;
        const fromPath = config.fromPath ? String(config.fromPath).trim() : '';
        const unwrap = config.unwrapData !== false;
        let payload: unknown = fromPath
          ? this.getValueAtPath(triggerData, fromPath)
          : triggerData.lastActionResult;
        if (payload == null || payload === undefined) {
          throw new Error(
            'send_data_export: нет данных предыдущего шага (lastActionResult). Разместите действие после запроса к API (Google Ads, Meta и т.д.).',
          );
        }
        if (
          unwrap &&
          typeof payload === 'object' &&
          payload !== null &&
          !Array.isArray(payload) &&
          'data' in (payload as object)
        ) {
          payload = (payload as { data: unknown }).data;
        }
        const formatJson = config.formatJson !== false;
        const formatXlsx = Boolean(config.formatXlsx);
        const formatPdf = Boolean(config.formatPdf);
        const attachments: Array<{
          filename: string;
          contentType: string;
          content: Buffer;
        }> = [];
        if (formatJson) {
          attachments.push({
            filename: 'data.json',
            contentType: 'application/json; charset=utf-8',
            content: Buffer.from(JSON.stringify(payload, null, 2), 'utf8'),
          });
        }
        if (formatXlsx) {
          attachments.push({
            filename: 'data.xlsx',
            contentType:
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            content: await this.bufferFromJsonExcel(payload),
          });
        }
        if (formatPdf) {
          attachments.push({
            filename: 'data.pdf',
            contentType: 'application/pdf',
            content: await this.bufferFromJsonPdf(payload),
          });
        }
        if (!attachments.length) {
          throw new Error(
            'send_data_export: включите хотя бы один формат (JSON, XLSX или PDF)',
          );
        }
        const subject = this.interpolateString(
          String(config.subject || 'Данные из сценария Lumiva CRM'),
          triggerData,
        );

        if (channel === 'telegram') {
          const botId = String(config.botId || '').trim();
          const recipientIds: string[] = Array.isArray(config.recipientIds) ? config.recipientIds : [];
          const telegramUserId = String(config.telegramUserId || '').trim();
          if (!botId || (!recipientIds.length && !telegramUserId)) {
            throw new Error('send_data_export: для Telegram укажите botId и получателей');
          }

          // Resolve chat IDs
          let chatIds: string[] = telegramUserId ? [telegramUserId] : [];
          if (recipientIds.length) {
            const bot = await this.telegramCrmService.findBot(tenantId, botId);
            const allRecipients: any[] = (bot.meta?.recipients as any[]) || [];
            chatIds = allRecipients
              .filter((r: any) => recipientIds.includes(r.id))
              .map((r: any) => String(r.telegramChatId));
          }

          for (const chatId of chatIds) {
            for (let i = 0; i < attachments.length; i++) {
              const a = attachments[i];
              await this.telegramCrmService.sendDocumentFromBuffer(
                tenantId,
                botId,
                chatId,
                a.filename,
                a.content,
                i === 0 ? subject : undefined,
                {
                  leadId: triggerData.leadId || triggerData.lead?.id,
                  contactId: triggerData.contactId || triggerData.contact?.id,
                  companyId: triggerData.companyId || triggerData.company?.id,
                  saleId: triggerData.saleId || triggerData.sale?.id,
                },
              );
            }
          }
          return { dataExportSent: true, channel: 'telegram', files: attachments.length };
        }

        const toRaw = config.to ? String(config.to) : '';
        const toList = toRaw
          .split(',')
          .map((v: string) => v.trim())
          .filter(Boolean);
        if (!config.accountId) {
          throw new Error('send_data_export: для Email укажите accountId');
        }
        if (!toList.length) {
          throw new Error('send_data_export: для Email укажите получателей to (через запятую)');
        }
        const htmlBody = `<p>${this.stripHtml(subject)}</p><p>Во вложении — результат предыдущего шага сценария.</p>`;
        return await this.emailService.sendEmail(
          tenantId,
          {
            accountId: config.accountId,
            to: toList.map((addr: string) => this.interpolateString(addr, triggerData)),
            subject,
            htmlBody,
            textBody: this.stripHtml(htmlBody),
            attachments,
          } as any,
        );
      }

      case 'send_report': {
        const reportType = (config.reportType || 'sales') as string;
        const channel = (config.channel || 'email') as string;
        const frequency = (config.scheduleFrequency || 'weekly') as string;
        const range = this.resolveSendReportRange(config, frequency, triggerData);

        let reportPayload;
        if (reportType === 'sales') {
          let rateMap = config.rates;
          if (typeof rateMap === 'string') {
            try {
              rateMap = JSON.parse(rateMap);
            } catch {
              rateMap = undefined;
            }
          }
          reportPayload = await this.reportsService.buildSalesReport(tenantId, range, {
            currencyMode: config.currencyMode,
            displayCurrency: config.displayCurrency,
            rates: rateMap,
            dateField: config.dateField,
          });
        } else if (reportType === 'projects') {
          reportPayload = await this.reportsService.buildProjectsReport(tenantId, range);
        } else if (reportType === 'tasks') {
          reportPayload = await this.reportsService.buildTasksReport(tenantId, range);
        } else if (reportType === 'marketing') {
          reportPayload = await this.reportsService.buildMarketingReport(tenantId, range);
        } else {
          reportPayload = await this.reportsService.buildLeadsReport(tenantId, range);
        }

        const html = this.reportsService.renderEmailHtml(reportPayload);
        const subject =
          config.subject ||
          `${reportPayload.title} · ${range.from.toISOString().slice(0, 10)} – ${range.to.toISOString().slice(0, 10)}`;

        const attachments: Array<{
          filename: string;
          contentType: string;
          content: Buffer;
        }> = [];

        if (config.formatPdf) {
          const pdf = await this.reportsService.renderPdf(reportPayload);
          attachments.push({
            filename: 'report.pdf',
            contentType: 'application/pdf',
            content: pdf,
          });
        }
        if (config.formatXls) {
          const xls = await this.reportsService.renderXlsx(reportPayload);
          attachments.push({
            filename: 'report.xlsx',
            contentType:
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            content: xls,
          });
        }
        if (config.formatCsv) {
          const csv = await this.reportsService.renderCsv(reportPayload);
          attachments.push({
            filename: 'report.csv',
            contentType: 'text/csv; charset=utf-8',
            content: csv,
          });
        }

        if (channel === 'telegram') {
          const text = this.buildTelegramReportText(reportPayload);
          return await this.telegramCrmService.sendMessage(
            tenantId,
            config.botId,
            config.telegramUserId,
            text,
          );
        }

        const toRaw = config.to || '';
        const toList = String(toRaw)
          .split(',')
          .map((v: string) => v.trim())
          .filter(Boolean);
        if (!config.accountId) {
          throw new Error('Email accountId is required');
        }
        if (!toList.length) {
          throw new Error('Email recipients are required');
        }

        return await this.emailService.sendEmail(tenantId, {
          accountId: config.accountId,
          to: toList,
          subject,
          htmlBody: html,
          textBody: this.stripHtml(html),
          attachments,
        } as any);
      }

      case 'create_custom_object_record': {
        const targetObjectId = String(config.targetObjectId || '').trim();
        if (!targetObjectId) {
          throw new Error('create_custom_object_record: targetObjectId is required');
        }
        const sourceObjectId = triggerData.objectId;
        const recordId = triggerData.recordId;
        if (!sourceObjectId || !recordId) {
          throw new Error(
            'create_custom_object_record: use a custom object record trigger (objectId and recordId)',
          );
        }
        const fieldMap =
          config.fieldMap && typeof config.fieldMap === 'object'
            ? (config.fieldMap as Record<string, string>)
            : undefined;
        const duplicateKeyTargetField =
          config.duplicateKeyTargetField != null
            ? String(config.duplicateKeyTargetField).trim() || null
            : null;
        const skipDuplicates = config.skipDuplicates !== false;
        const omitAutoTargetKeys = Array.isArray(config.omitAutoTargetKeys)
          ? (config.omitAutoTargetKeys as unknown[]).map((x) => String(x || '').trim()).filter(Boolean)
          : undefined;
        return await this.customObjectsService.pushRecordsToBoard(tenantId, String(sourceObjectId), {
          targetObjectId,
          recordIds: [String(recordId)],
          fieldMap,
          omitAutoTargetKeys,
          duplicateKeyTargetField,
          skipDuplicates,
        });
      }

      case 'send_notification': {
        const title = config.title ? this.interpolateString(String(config.title), triggerData) : null;
        const body = this.interpolateString(String(config.body || config.message || ''), triggerData);
        if (!body) throw new Error('send_notification: текст уведомления не может быть пустым');

        const configuredIds = Array.isArray(config.userIds)
          ? config.userIds.map((id) => String(id || '').trim()).filter(Boolean)
          : [];
        const targetIds = await this.staffUsersService.resolveNotificationUserIdsForTenant(
          tenantId,
          configuredIds.length > 0 ? configuredIds : undefined,
        );

        if (!targetIds.length) return { notificationsSent: 0 };

        await this.notificationsService.create(tenantId, targetIds, title, body, {
          automationId: triggerData.automationId,
          triggeredAt: new Date().toISOString(),
        });

        return { notificationsSent: targetIds.length };
      }

      default:
        throw new Error(`Unknown action type: ${type}`);
    }
  }

  private async resolveAutomationActionTarget(
    tenantId: string,
    config: Record<string, any>,
    triggerData: any,
    fallbackEntityType?: string | null,
    fallbackEntityId?: string | null,
    fieldPath?: string,
  ): Promise<{ type: string; entity: any }> {
    const fieldEntityType = fieldPath ? this.getEntityTypeFromFieldPath(fieldPath) : null;
    const rawType =
      config.entityType ||
      config.targetEntityType ||
      fieldEntityType ||
      fallbackEntityType;
    const type = this.normalizeAutomationEntityType(rawType);
    if (!type) {
      throw new Error('Не удалось определить тип сущности для действия автоматизации');
    }
    const id =
      config.entityId ||
      config.targetEntityId ||
      config[`${type}Id`] ||
      triggerData[`${type}Id`] ||
      triggerData[type]?.id ||
      (this.normalizeAutomationEntityType(fallbackEntityType) === type
        ? fallbackEntityId
        : null);

    if (!id) {
      throw new Error('Не удалось определить сущность для действия автоматизации');
    }

    const entity = await this.loadAutomationActionEntity(tenantId, type, String(id));
    if (!entity) {
      throw new Error(`Сущность ${type} не найдена`);
    }

    return { type, entity };
  }

  private normalizeAutomationEntityType(value: unknown): string | null {
    const raw = String(value || '').trim().toLowerCase();
    const map: Record<string, string> = {
      lead: 'lead',
      leads: 'lead',
      contact: 'contact',
      contacts: 'contact',
      company: 'company',
      companies: 'company',
      sale: 'sale',
      sales: 'sale',
      project: 'project',
      projects: 'project',
      task: 'task',
      companytask: 'task',
      company_task: 'task',
      companytaskentity: 'task',
    };
    return map[raw] || null;
  }

  private getEntityTypeFromFieldPath(fieldPath: string): string | null {
    const [firstPart] = fieldPath.split('.');
    return this.normalizeAutomationEntityType(firstPart);
  }

  private stripEntityPrefix(fieldPath: string, entityType: string): string {
    const parts = fieldPath
      .split('.')
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length > 1 && this.normalizeAutomationEntityType(parts[0]) === entityType) {
      return parts.slice(1).join('.');
    }
    return parts.join('.');
  }

  private async loadAutomationActionEntity(
    tenantId: string,
    entityType: string,
    entityId: string,
  ): Promise<any | null> {
    switch (entityType) {
      case 'lead':
        return this.leadRepo.findOne({ where: { id: entityId, tenantId } });
      case 'contact':
        return this.contactRepo.findOne({ where: { id: entityId, tenantId } });
      case 'company':
        return this.companyRepo.findOne({ where: { id: entityId, tenantId } });
      case 'project':
        return this.projectRepo.findOne({ where: { id: entityId, tenantId } });
      case 'task':
        return this.companyTaskRepo.findOne({ where: { id: entityId, tenantId } });
      case 'sale':
        return this.saleRepo.findOne({ where: { id: entityId, tenantId } as any });
      default:
        return null;
    }
  }

  private async saveAutomationActionEntity(
    entityType: string,
    entity: any,
  ): Promise<any> {
    switch (entityType) {
      case 'lead':
        return this.leadRepo.save(entity);
      case 'contact':
        return this.contactRepo.save(entity);
      case 'company':
        return this.companyRepo.save(entity);
      case 'project':
        return this.projectRepo.save(entity);
      case 'task':
        return this.companyTaskRepo.save(entity);
      case 'sale':
        return this.saleRepo.save(entity);
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }
  }

  private setAutomationEntityField(entity: any, fieldPath: string, value: any): void {
    const parts = fieldPath
      .split('.')
      .map((part) => part.trim())
      .filter(Boolean);
    if (!parts.length) {
      throw new Error('Field is required');
    }

    const blockedFields = new Set(['id', 'tenantId', 'createdAt', 'updatedAt']);
    if (blockedFields.has(parts[0])) {
      throw new Error(`Поле ${parts[0]} нельзя обновлять из автоматизации`);
    }

    if (parts[0] === 'customFields' || parts[0] === 'meta' || parts[0] === 'rawPayload') {
      entity[parts[0]] =
        typeof entity[parts[0]] === 'object' && entity[parts[0]] !== null
          ? entity[parts[0]]
          : {};
      this.setNestedAutomationValue(entity[parts[0]], parts.slice(1), value);
      return;
    }

    if (parts.length === 1 && parts[0] in entity) {
      entity[parts[0]] = value;
      return;
    }

    entity.customFields =
      typeof entity.customFields === 'object' && entity.customFields !== null
        ? entity.customFields
        : {};
    this.setNestedAutomationValue(entity.customFields, parts, value);
  }

  private setNestedAutomationValue(target: Record<string, any>, parts: string[], value: any): void {
    if (!parts.length) {
      throw new Error('Field is required');
    }
    let current = target;
    for (let index = 0; index < parts.length - 1; index++) {
      const part = parts[index];
      if (typeof current[part] !== 'object' || current[part] === null || Array.isArray(current[part])) {
        current[part] = {};
      }
      current = current[part];
    }
    current[parts[parts.length - 1]] = value;
  }

  private getAutomationEntityTags(entity: any): string[] {
    if (Array.isArray(entity.tags)) {
      return entity.tags.filter((tag: unknown): tag is string => typeof tag === 'string');
    }
    const customTags = entity.customFields?.tags;
    if (Array.isArray(customTags)) {
      return customTags.filter((tag: unknown): tag is string => typeof tag === 'string');
    }
    return [];
  }

  private setAutomationEntityTags(entity: any, tags: string[]): void {
    if ('tags' in entity) {
      entity.tags = tags;
      return;
    }
    entity.customFields =
      typeof entity.customFields === 'object' && entity.customFields !== null
        ? entity.customFields
        : {};
    entity.customFields.tags = tags;
  }

  private async resolveStaffAssignment(
    tenantId: string,
    staffIds: string[],
  ): Promise<{ userIds: string[]; names: string[] }> {
    const selectedIds = [...new Set(staffIds.filter(Boolean))];
    if (!selectedIds.length) {
      return { userIds: [], names: [] };
    }
    const staff = await this.staffUsersService.listForTenant(tenantId);
    const selectedStaff = staff.filter((user: any) => selectedIds.includes(user.id));
    return {
      userIds: selectedStaff.map((user: any) => user.id),
      names: selectedStaff.map((user: any) => user.fullName || user.email).filter(Boolean),
    };
  }

  private assignAutomationEntityUsers(
    entity: any,
    assignment: { userIds: string[]; names: string[] },
  ): void {
    const firstUserId = assignment.userIds[0] ?? null;
    const firstName = assignment.names[0] ?? null;
    const names = assignment.names.join(', ') || null;

    if ('assignedUserIds' in entity) entity.assignedUserIds = assignment.userIds;
    if ('assignedToList' in entity) entity.assignedToList = assignment.names;
    if ('assignedUserId' in entity) entity.assignedUserId = firstUserId;
    if ('assignedTo' in entity) entity.assignedTo = names;
    if ('ownerUserIds' in entity) entity.ownerUserIds = assignment.userIds;
    if ('ownerUserId' in entity) entity.ownerUserId = firstUserId;
    if ('ownerName' in entity) entity.ownerName = names;
    if ('managerName' in entity) entity.managerName = names;

    const hasAssignmentField =
      'assignedUserId' in entity ||
      'ownerUserId' in entity ||
      'managerName' in entity;
    if (!hasAssignmentField) {
      throw new Error('Эта сущность не поддерживает назначение сотрудника');
    }

    if ('assignedTo' in entity && !entity.assignedTo) {
      entity.assignedTo = firstName;
    }
  }

  private normalizeCompanyTaskStatus(value: unknown): any {
    const status = String(value || 'todo').trim();
    if (status === 'open') return 'todo';
    if (['todo', 'in_progress', 'review', 'done', 'cancelled'].includes(status)) {
      return status;
    }
    return 'todo';
  }

  private resolveAutomationDueDate(value: unknown): string | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const raw = String(value).trim();
    const dayMatch = raw.match(/^\+?(\d+)(?:\s*d(?:ay)?s?)?$/i);
    if (dayMatch) {
      const days = Number(dayMatch[1]);
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + days);
      return dueDate.toISOString();
    }
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  private getValueAtPath(root: any, path: string): any {
    const parts = path
      .split('.')
      .map((p) => p.trim())
      .filter(Boolean);
    let cur = root;
    for (const p of parts) {
      if (cur == null) return undefined;
      cur = /^\d+$/.test(p) ? cur[Number(p)] : cur[p];
    }
    return cur;
  }

  /** Плоский список [путь, значение] для таблицы в Excel (ограничение по строкам). */
  private flattenKeyValues(
    obj: unknown,
    prefix: string,
    depth: number,
    maxRows: number,
    out: string[][],
  ): void {
    if (out.length >= maxRows) return;
    if (obj === null || obj === undefined) {
      out.push([prefix || '(null)', '']);
      return;
    }
    if (typeof obj !== 'object') {
      out.push([prefix || 'value', String(obj)]);
      return;
    }
    if (Array.isArray(obj)) {
      out.push([prefix || 'array', JSON.stringify(obj).slice(0, 8000)]);
      return;
    }
    const entries = Object.entries(obj as object);
    if (!entries.length) {
      out.push([prefix || 'object', '{}']);
      return;
    }
    for (const [k, v] of entries) {
      if (out.length >= maxRows) break;
      const key = prefix ? `${prefix}.${k}` : k;
      if (v !== null && typeof v === 'object' && !Array.isArray(v) && depth < 5) {
        this.flattenKeyValues(v, key, depth + 1, maxRows, out);
      } else if (Array.isArray(v)) {
        out.push([key, JSON.stringify(v).slice(0, 4000)]);
      } else {
        out.push([key, v === null || v === undefined ? '' : String(v)]);
      }
    }
  }

  private async bufferFromJsonExcel(payload: unknown): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Data');
    if (
      Array.isArray(payload) &&
      payload.length > 0 &&
      typeof payload[0] === 'object' &&
      payload[0] !== null &&
      !Array.isArray(payload[0])
    ) {
      const keySet = new Set<string>();
      for (const row of payload as object[]) {
        Object.keys(row).forEach((k) => keySet.add(k));
      }
      const keys = [...keySet];
      ws.addRow(keys);
      for (const row of payload as Record<string, unknown>[]) {
        ws.addRow(
          keys.map((k) => {
            const v = row[k];
            if (v === null || v === undefined) return '';
            if (typeof v === 'object') return JSON.stringify(v).slice(0, 2000);
            return String(v);
          }),
        );
      }
    } else {
      ws.addRow(['Путь', 'Значение']);
      const rows: string[][] = [];
      this.flattenKeyValues(payload, '', 0, 8000, rows);
      for (const r of rows) {
        ws.addRow(r);
      }
    }
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  private async bufferFromJsonPdf(payload: unknown): Promise<Buffer> {
    return await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('error', reject);
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      const text = JSON.stringify(payload, null, 2).slice(0, 120000);
      doc.fontSize(8).text(text, { width: 515 });
      doc.end();
    });
  }

  private buildTelegramReportText(report: {
    title: string;
    range: { from: Date; to: Date };
    summary: any;
    summaryLabels?: { total?: string; amount?: string; avg?: string };
    sections: any[];
  }) {
    const lines: string[] = [];
    lines.push(report.title);
    lines.push(`Период: ${report.range.from.toISOString().slice(0, 10)} – ${report.range.to.toISOString().slice(0, 10)}`);
    lines.push(`${report.summaryLabels?.total ?? 'Всего'}: ${report.summary.totalCount}`);
    if (report.summary.totalAmount !== undefined) {
      lines.push(
        `${report.summaryLabels?.amount ?? 'Сумма'}: ${report.summary.totalAmount.toFixed(2)} ${report.summary.currency ?? ''}`,
      );
    }
    if (report.summary.avgAmount !== undefined) {
      lines.push(
        `${report.summaryLabels?.avg ?? 'Среднее'}: ${report.summary.avgAmount.toFixed(2)} ${report.summary.currency ?? ''}`,
      );
    }
    report.sections.forEach((section) => {
      lines.push('');
      lines.push(section.title);
      section.rows.forEach((row: any) => {
        const amt =
          row.amount !== undefined && row.amount !== null && Number(row.amount) !== 0
            ? ` · ${Number(row.amount).toFixed(2)}`
            : '';
        lines.push(`- ${row.label}: ${row.count}${amt}`);
      });
    });
    return lines.join('\n');
  }

  private stripHtml(html: string) {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /**
   * Интерполировать строку с переменными из triggerData
   * Поддерживает {{field}} и {{entity.field}} синтаксис
   */
  private interpolateString(template: string, data: any): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const parts = path.trim().split('.');
      let value = data;
      for (const part of parts) {
        if (value === null || value === undefined) return match;
        value = value[part];
      }
      return value !== null && value !== undefined ? String(value) : match;
    });
  }

  /**
   * Маппинг entityType к NoteEntityType
   */
  private mapEntityTypeToNoteEntityType(entityType: string): NoteEntityType | null {
    const mapping: Record<string, NoteEntityType> = {
      contact: NoteEntityType.CONTACT,
      company: NoteEntityType.COMPANY,
      lead: NoteEntityType.LEAD,
      sale: NoteEntityType.SALE,
      project: NoteEntityType.PROJECT,
    };
    return mapping[entityType.toLowerCase()] || null;
  }

  /**
   * Получить историю выполнений
   */
  async getExecutions(
    tenantId: string,
    automationId?: string,
    limit: number = 100,
    status?: string,
  ): Promise<AutomationExecution[]> {
    const qb = this.executionRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.automation', 'a')
      .where('e.tenantId = :tenantId', { tenantId })
      .orderBy('e.createdAt', 'DESC')
      .take(Math.min(Math.max(limit, 1), 500));

    if (automationId) {
      qb.andWhere('e.automationId = :automationId', { automationId });
    }
    if (status) {
      qb.andWhere('e.status = :status', { status });
    }

    return qb.getMany();
  }

  async getUsageStats(tenantId: string, days = 30) {
    const since = new Date(Date.now() - days * 86400000);

    const [totalsRaw, byTrigger, topAutomations, totalAll, totalActive] =
      await Promise.all([
        this.executionRepo
          .createQueryBuilder('e')
          .select('e.status', 'status')
          .addSelect('COUNT(*)', 'cnt')
          .where('e.tenantId = :tenantId', { tenantId })
          .andWhere('e.createdAt >= :since', { since })
          .groupBy('e.status')
          .getRawMany(),
        this.executionRepo
          .createQueryBuilder('e')
          .select('e.triggerEvent', 'triggerEvent')
          .addSelect('COUNT(*)', 'cnt')
          .where('e.tenantId = :tenantId', { tenantId })
          .andWhere('e.createdAt >= :since', { since })
          .groupBy('e.triggerEvent')
          .orderBy('cnt', 'DESC')
          .limit(15)
          .getRawMany(),
        this.executionRepo
          .createQueryBuilder('e')
          .leftJoin('e.automation', 'a')
          .select('e.automationId', 'automationId')
          .addSelect('a.name', 'name')
          .addSelect('COUNT(*)', 'cnt')
          .where('e.tenantId = :tenantId', { tenantId })
          .andWhere('e.createdAt >= :since', { since })
          .groupBy('e.automationId')
          .addGroupBy('a.name')
          .orderBy('cnt', 'DESC')
          .limit(10)
          .getRawMany(),
        this.automationRepo.count({ where: { tenantId } }),
        this.automationRepo.count({ where: { tenantId, isActive: true } }),
      ]);

    const executions = {
      total: 0,
      success: 0,
      error: 0,
      pending: 0,
      skipped: 0,
    };
    for (const row of totalsRaw) {
      const c = Number(row.cnt);
      executions.total += c;
      const st = String(row.status || '');
      if (st === 'success') executions.success += c;
      else if (st === 'error') executions.error += c;
      else if (st === 'pending') executions.pending += c;
      else if (st === 'skipped') executions.skipped += c;
    }

    return {
      periodDays: days,
      since: since.toISOString(),
      executions,
      byTrigger: byTrigger.map((r) => ({
        triggerEvent: r.triggerEvent,
        count: Number(r.cnt),
      })),
      topAutomations: topAutomations.map((r) => ({
        automationId: r.automationId,
        name: r.name || '—',
        runs: Number(r.cnt),
      })),
      automations: {
        total: totalAll,
        active: totalActive,
      },
    };
  }
}
