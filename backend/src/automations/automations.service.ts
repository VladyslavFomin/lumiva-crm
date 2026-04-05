// src/automations/automations.service.ts
import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import axios from 'axios';
import { Automation, TriggerEvent } from './automation.entity';
import { AutomationExecution } from './automation-execution.entity';
import { CreateAutomationDto } from './dto/create-automation.dto';
import { UpdateAutomationDto } from './dto/update-automation.dto';
import { EmailService } from '../email/email.service';
import { TelegramCrmService } from '../telegram-crm/telegram-crm.service';
import { NotesService } from '../notes/notes.service';
import { EntityType as NoteEntityType } from '../notes/dto/create-note.dto';
import { ReportsService } from './reports.service';

@Injectable()
export class AutomationsService {
  private scheduleRunning = false;
  constructor(
    @InjectRepository(Automation)
    private readonly automationRepo: Repository<Automation>,
    @InjectRepository(AutomationExecution)
    private readonly executionRepo: Repository<AutomationExecution>,
    @Inject(forwardRef(() => EmailService))
    private readonly emailService: EmailService,
    @Inject(forwardRef(() => TelegramCrmService))
    private readonly telegramCrmService: TelegramCrmService,
    @Inject(forwardRef(() => NotesService))
    private readonly notesService: NotesService,
    private readonly reportsService: ReportsService,
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
   * Запустить автоматизацию по событию
   */
  async triggerAutomation(
    tenantId: string,
    event: TriggerEvent,
    triggerData: any,
  ): Promise<void> {
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
    if (frequency === 'monthly' && zoned.day !== dayOfMonth) return false;
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
   * Выполнить автоматизацию
   */
  private async executeAutomation(
    automation: Automation,
    event: TriggerEvent,
    triggerData: any,
  ): Promise<void> {
    // Добавляем tenantId в triggerData если его нет
    if (!triggerData.tenantId) {
      triggerData.tenantId = automation.tenantId;
    }
    const execution = this.executionRepo.create({
      tenantId: automation.tenantId,
      automationId: automation.id,
      triggerEvent: event,
      triggerData,
      entityType: triggerData?.entityType || null,
      entityId: triggerData?.entityId || null,
      status: 'pending',
      actionsExecuted: 0,
    });

    await this.executionRepo.save(execution);

    try {
      const results: any[] = [];

      // Выполняем каждое действие
      for (const action of automation.actions) {
        try {
          const result = await this.executeAction(
            action,
            triggerData,
            automation.tenantId,
          );
          results.push({ action: action.type, success: true, result });
          execution.actionsExecuted++;
        } catch (error: any) {
          results.push({
            action: action.type,
            success: false,
            error: error.message,
          });
        }
      }

      // Обновляем статистику
      automation.executionCount++;
      automation.lastExecutedAt = new Date();
      automation.lastError = null;
      await this.automationRepo.save(automation);

      // Обновляем выполнение
      execution.status = 'success';
      execution.executionResult = results;
      await this.executionRepo.save(execution);
    } catch (error: any) {
      // Обновляем статистику ошибок
      automation.errorCount++;
      automation.lastError = error.message;
      automation.lastExecutedAt = new Date();
      await this.automationRepo.save(automation);

      // Обновляем выполнение
      execution.status = 'error';
      execution.errorMessage = error.message;
      await this.executionRepo.save(execution);
    }
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
        const { botId, telegramUserId, text } = config;
        if (!botId || !telegramUserId || !text) {
          throw new Error('Telegram botId, telegramUserId and text are required');
        }

        return await this.telegramCrmService.sendMessage(
          tenantId,
          botId,
          telegramUserId,
          this.interpolateString(text, triggerData),
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
        // Обновление поля сущности - требует доступа к соответствующему сервису
        const { field, value } = config;
        if (!field || value === undefined) {
          throw new Error('Field and value are required');
        }

        // Это упрощенная версия - в реальности нужно вызывать соответствующий сервис
        return { fieldUpdated: true, field, value: this.interpolateString(String(value), triggerData) };
      }

      case 'add_tag': {
        const { tag } = config;
        if (!tag || !entityId || !entityType) {
          throw new Error('Tag, entityId and entityType are required');
        }

        // Упрощенная версия - в реальности нужно вызывать соответствующий сервис
        return { tagAdded: true, tag: this.interpolateString(tag, triggerData) };
      }

      case 'change_status': {
        const { status } = config;
        if (!status || !entityId || !entityType) {
          throw new Error('Status, entityId and entityType are required');
        }

        // Упрощенная версия - в реальности нужно вызывать соответствующий сервис
        return { statusChanged: true, status: this.interpolateString(status, triggerData) };
      }

      case 'send_report': {
        const reportType = (config.reportType || 'sales') as string;
        const channel = (config.channel || 'email') as string;
        const frequency = (config.scheduleFrequency || 'weekly') as string;
        const range = this.reportsService.buildRange(frequency);

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

      default:
        throw new Error(`Unknown action type: ${type}`);
    }
  }

  private buildTelegramReportText(report: { title: string; range: { from: Date; to: Date }; summary: any; sections: any[] }) {
    const lines: string[] = [];
    lines.push(report.title);
    lines.push(`Период: ${report.range.from.toISOString().slice(0, 10)} – ${report.range.to.toISOString().slice(0, 10)}`);
    lines.push(`Всего: ${report.summary.totalCount}`);
    if (report.summary.totalAmount !== undefined) {
      lines.push(`Сумма: ${report.summary.totalAmount.toFixed(2)} ${report.summary.currency ?? ''}`);
    }
    if (report.summary.avgAmount !== undefined) {
      lines.push(`Среднее: ${report.summary.avgAmount.toFixed(2)} ${report.summary.currency ?? ''}`);
    }
    report.sections.forEach((section) => {
      lines.push('');
      lines.push(section.title);
      section.rows.forEach((row: any) => {
        lines.push(`- ${row.label}: ${row.count}`);
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
    limit: number = 50,
  ): Promise<AutomationExecution[]> {
    const where: any = { tenantId };
    if (automationId) {
      where.automationId = automationId;
    }

    return this.executionRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['automation'],
    });
  }
}
