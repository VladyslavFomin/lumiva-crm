import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiChatSession } from './ai-chat-session.entity';
import {
  deriveAiChatTitleFromUserMessage,
  isDefaultAiChatTitle,
} from './ai-chat-title.util';
import { AiChatMessage } from './ai-chat-message.entity';
import { AiMemoryChunk } from './ai-memory-chunk.entity';
import { AiOpenAiService, type ChatMessage } from './ai-openai.service';
import { AiToolsService, AI_TOOL_DEFINITIONS } from './ai-tools.service';
import { STANDARD_PROJECT_FIELDS_NOTE } from './crm-ai-tool-definitions';
import { AiQuotaService } from './ai-quota.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { Lead } from '../leads/lead.entity';
import { Company } from '../companies/company.entity';
import { StaffUser } from '../staff/staff-user.entity';
import { CustomFieldsService } from '../custom-fields/custom-fields.service';
import {
  EntityType as CustomFieldEntityType,
  FieldType as CustomFieldType,
} from '../custom-fields/custom-field.entity';
import { Tenant } from '../tenants/tenant.entity';

const MAX_TOOL_ROUNDS = 8;
const MAX_HISTORY = 24;

@Injectable()
export class AiAssistantService {
  private readonly log = new Logger(AiAssistantService.name);

  constructor(
    @InjectRepository(AiChatSession)
    private readonly sessions: Repository<AiChatSession>,
    @InjectRepository(AiChatMessage)
    private readonly messages: Repository<AiChatMessage>,
    @InjectRepository(AiMemoryChunk)
    private readonly memoryRepo: Repository<AiMemoryChunk>,
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(StaffUser)
    private readonly staffRepo: Repository<StaffUser>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly openai: AiOpenAiService,
    private readonly tools: AiToolsService,
    private readonly quota: AiQuotaService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly integrationsService: IntegrationsService,
    private readonly customFieldsService: CustomFieldsService,
  ) {}

  /** Префикс инструмента -> ключ enabledComponents тенанта (тот же tenant.enabledComponents,
   * что скрывает разделы в самом интерфейсе, см. /platform-admin). */
  private static readonly TOOL_PREFIX_COMPONENT: Array<{ prefix: string; component: string }> = [
    { prefix: 'crm_product_', component: 'products' },
    { prefix: 'crm_booking_', component: 'bookings' },
    { prefix: 'crm_hotel_', component: 'hotels' },
  ];

  /**
   * OpenAI жёстко ограничивает 'tools' массивом из максимум 128 элементов — у нас их больше
   * (Products/Bookings/Hotels добавляют десятки инструментов). Вместо угадывания, какие
   * инструменты вообще нужны в разговоре, убираем из списка только те модули, что реально
   * ВЫКЛЮЧЕНЫ тенанту (tenant.enabledComponents, тот же тумблер, что скрывает раздел в самом
   * интерфейсе) — так ИИ не предлагает и не путает инструменты модуля, которым тенант не
   * пользуется, и остаётся запас по лимиту даже когда список инструментов вырастет дальше.
   * enabledComponents[key] отсутствует/null трактуем как «включено» (тот же дефолт, что и при
   * построении entitlements — см. plan-entitlements.ts buildState).
   */
  private async buildToolsForTenant(tenantId: string): Promise<unknown[]> {
    const tenant = await this.tenantRepo.findOne({
      where: { id: tenantId },
      select: ['id', 'enabledComponents'],
    });
    const enabled = tenant?.enabledComponents || {};
    const disabledComponents = new Set(
      AiAssistantService.TOOL_PREFIX_COMPONENT.filter(({ component }) => enabled[component] === false).map(
        ({ component }) => component,
      ),
    );
    if (!disabledComponents.size) return AI_TOOL_DEFINITIONS;
    return AI_TOOL_DEFINITIONS.filter((tool) => {
      const name = (tool as { function?: { name?: string } })?.function?.name || '';
      const hit = AiAssistantService.TOOL_PREFIX_COMPONENT.find(({ prefix }) => name.startsWith(prefix));
      return !hit || !disabledComponents.has(hit.component);
    });
  }

  /**
   * Свой ключ OpenAI тенанта (Интеграции → OpenAI / LLM) — если подключён, чат использует его
   * вместо платформенного, и платформенная AI-квота не списывается (тенант платит сам).
   */
  async resolveTenantOpenAiOverride(
    tenantId: string,
  ): Promise<{ apiKey: string; baseUrl?: string; model?: string; provider?: 'openai' | 'anthropic' } | undefined> {
    try {
      const list = await this.integrationsService.findAllForTenant(tenantId);
      const conn = list.find(
        (c) => c.kind === 'third_party_link' && c.linkCatalogId === 'openai' && c.isEnabled,
      );
      if (!conn) return undefined;
      const full = await this.integrationsService.findOneForTenant(tenantId, conn.id);
      const cfg = full.config as Record<string, any> | null | undefined;
      if (!cfg?.apiToken) return undefined;
      return {
        apiKey: String(cfg.apiToken),
        baseUrl: cfg.webhookUrl ? String(cfg.webhookUrl) : undefined,
        model: cfg.model ? String(cfg.model) : undefined,
        provider: cfg.provider === 'anthropic' ? 'anthropic' : undefined,
      };
    } catch {
      return undefined;
    }
  }

  private buildSystemPrompt(memoryBlock: string): string {
    const now = new Date();
    const utcDate = now.toISOString().slice(0, 10);
    const frontendBase = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
    const envBlock =
      `\nТекущие дата/время (ориентир для модели; UTC): ${now.toISOString()} (дата ${utcDate}). ` +
      `Если пользователь называет только месяц («апрель», «за март») без года — по умолчанию используй календарный год этой даты, не предполагай прошлые годы без явного указания пользователя.` +
      (frontendBase
        ? `\nПубличный URL веб-интерфейса этой CRM: ${frontendBase}. В ссылках для пользователя используй этот домен и относительные пути из инструментов (например ${frontendBase}/workspace/…). Никогда не подставляй example.com или выдуманные домены.`
        : `\nBASE URL фронта не передан сервером (FRONTEND_URL): давай только относительные пути из инструментов (/workspace/…), без выдумывания полного домена.`);

    return `Ты — AI-ассистент Lumiva CRM. Помогаешь с текстами, идеями, аналитикой, маркетингом, данными CRM и модулями ниже.${envBlock}

Термины (не путай):
- Лиды — только модуль лидов CRM. Инструменты: crm_list_leads (последние записи), crm_search_leads (поиск по имени/email/телефону — обязателен для «найди лида Александра»), crm_get_lead (по UUID), crm_create_lead, crm_update_lead.
- Проекты — только модуль «Проекты» (сделки/проекты с суммой и статусом). Инструменты: crm_list_projects, crm_create_project. Это НЕ рабочая область.
- Интеграции: crm_list_integrations отдаёт два списка — salesIntegrations (продажи: WooCommerce, ручной импорт, сторонние связки third_party_link с полем catalogId — Mailchimp, Slack, Teams и т.д.) и marketingIntegrations (маркетинг: Meta/Facebook Ads, GA4, Яндекс.Метрика, Google Ads и т.д.). Запросы про рекламу, Meta, GA4 — смотри marketingIntegrations; не утверждай, что маркетинговых интеграций нет, если в ответе есть непустой marketingIntegrations. Mailchimp: подключение с catalogId mailchimp; в сценариях — действие send_mailchimp; из чата после явного согласия пользователя на добавление в список — crm_mailchimp_subscribe с userConfirmedAdd: true.
- Рабочая область — отдельный модуль пользовательских таблиц (раздел /workspace, свои поля и записи). Инструменты с префиксом crm_workspace_. Для таблицы, записей и сводной аналитики по ней используй только их. Никогда не называй проект «рабочей областью» и наоборот.
- Товары vs Бронирования vs Система резервации — три РАЗНЫХ модуля, не путай: Товары (crm_product_*) — каталог товаров/услуг с ценами и остатками, никак не связан ни с записями на приём, ни с номерами отеля. Бронирования (crm_booking_*) — запись клиента на приём к мастеру/сотруднику на конкретное время (салон, сервис-бизнес: «записать клиента к мастеру Ивану на стрижку в 15:00»); сущность Reservation, таблица reservations. Система резервации / Отели (crm_hotel_*) — бронирование НОМЕРОВ ОТЕЛЯ по датам заезда/выезда и тарифам по группам рынков («забронировать номер Делюкс в отеле Х с 10 по 15 августа», «поменять тариф на номер Y»); сущность HotelReservation, таблица hotel_reservations, свои отели/типы номеров/группы рынков — никак не связана с crm_booking_*. Если пользователь пишет просто «бронь»/«резервация»/«booking» без уточнения — определи по контексту (упоминание мастера/услуги/времени приёма → Бронирования; упоминание отеля/номера/заезда-выезда/тарифа → Система резервации); если контекста недостаточно — спроси пользователя прямо, о каком из двух модулей речь, прежде чем вызывать инструмент.
- Чтобы перенести в рабочую область данные по рекламе/каналам из CRM (то, что в маркетинге и marketing_traffic), используй crm_workspace_import_marketing_channels — он создаёт таблицу с колонками и заполняет строки. Не создавай пустую таблицу только через crm_workspace_create_table без fields и без последующих crm_workspace_add_record.
- Сегментация рекламы по стране/рынку (crm_marketing_overview, crm_marketing_daily_series, crm_workspace_import_marketing_channels): у большинства источников (Google Ads, Meta, Yandex Direct/Metrika, VK Ads) НЕТ поля страны в БД — гео есть только у GA4-строк; у остальных рынок можно определить лишь эвристически по тегу в начале названия кампании ("LV - Search - Traffic - ...") или по названию страны в тексте кампании. Поэтому: если пользователь просит данные ПО КОНКРЕТНОЙ СТРАНЕ/РЫНКУ — ВСЕГДА передавай параметр market (код ISO2 или название), а если не уверен — сначала вызови crm_marketing_markets, чтобы увидеть реальный список рынков с расходом по каждому и unclassified (кампании без определённого рынка). НИКОГДА не переименовывай заголовок таблицы/ответа в название страны, не передав фактический фильтр market — старая ошибка бота была именно в этом (заголовок "по Великобритании", а внутри данные всех стран). Если market не распознан (ok:false, error:"unknown_market") или после фильтра 0 строк — не показывай нефильтрованные данные, а прямо скажи, что не можешь надёжно сегментировать по этой стране, и покажи availableMarkets.
- Если таблица уже создана без колонок — добавь поля через crm_workspace_add_field, затем crm_workspace_describe_table и crm_workspace_add_record с правильными key.
- Если в сообщении есть блок «Вложение: импорт продаж» с importId — для завершения импорта вызови crm_sales_import_apply (маппинг из suggestedMapping, если пользователь не указал иное).
- Если в сообщении есть блок «Вложение: файл в рабочую область» с importId (CSV/Excel) — создай таблицу через crm_workspace_create_table с полями по columns/sample, затем ОБЯЗАТЕЛЬНО вызови crm_workspace_import_file с её objectId и importId, чтобы перенести все строки файла; не пытайся построчно передавать данные через crm_workspace_bulk_add_records для файла из вложения — там может быть гораздо больше строк, чем показано в sample.
- Изображения: для новой картинки или правок к недавней вызывай crm_generate_image с полным промптом (лучше на английском). Ты не видишь пиксели прошлого изображения — опиши сцену целиком с учётом правок.
- Если есть блок «Недавнее изображение в этом чате» и пользователь просит изменить персонажа, одежду, стиль или детали — обязательно вызови crm_generate_image; не отвечай только общими рассуждениями и не предлагай «текст отзыва» вместо перегенерации.
- После успешного crm_generate_image в ответе пользователю укажи ссылку на картинку из результата инструмента (markdown ![img](url) или явный URL).

Расширенные действия CRM (используй по запросу):
- Лиды: crm_get_lead, crm_update_lead (поиск по имени — через crm_search_leads, не выдумывай UUID). crm_list_leads поддерживает page (1, 2, 3…), source, search для полного перебора базы.
- Проекты: crm_get_project, crm_update_project (в т.ч. tasks, comments), crm_change_project_status, crm_soft_delete_project. Стандартные (не кастомные) поля/колонки таблицы «Проекты», для которых НИКОГДА не нужно создавать кастомную колонку — они уже существуют и меняются через crm_update_project напрямую: ${STANDARD_PROJECT_FIELDS_NOTE} Если пользователь просит «колонку» под что-то из этого списка (в любой формулировке — «валюта», «бюджет», «ответственный», «теги» и т.п.) — она уже есть, crm_project_create_column здесь не нужен, просто используй соответствующее поле в crm_update_project (например leadId). Если не уверен, соответствует ли просьба пользователя одному из этих стандартных полей, одной из уже существующих кастомных колонок (crm_project_list_columns) или это действительно нужно новое — не угадывай молча: спроси у пользователя прямым текстом («у проекта уже есть поле «Компания» — использовать его или завести отдельную колонку специально под это?») и дождись ответа, прежде чем вызывать crm_project_create_column. Кроме них у таблицы «Проекты» есть кастомные колонки, настраиваемые тенантом (например «Ссылка», «Почта», «Телефон», произвольная дата и т.д.) — их значения лежат в project.customFields по ключу колонки. Перед тем как прочитать или записать значение такой колонки — вызови crm_project_list_columns, чтобы узнать реальные key/type/options (не выдумывай ключи). Если нужной колонки под задачу пользователя ещё нет («добавь колонку с ...», «занеси email клиента в отдельную колонку» и т.п.) — сначала создай её через crm_project_create_column с максимально точным type (email/phone/url/date/datetime/daterange/boolean/select/multiselect/number/text/textarea — не text «на всякий случай», если смысл данных явно другой), и только потом запиши значение через crm_update_project с customFields: { <key>: <значение> }. Для колонок email/phone с source: lead или company значение подтягивается автоматически из привязанного лида/компании — вручную его не пишут. Это касается не только прямых просьб «добавь колонку»: если пользователь при создании/описании проекта называет конкретный самостоятельный факт (ссылку, отдельный email/телефон, бюджет, специфичную дату и т.п.), для которого нет ни стандартного поля, ни подходящей существующей колонки — заведи колонку и запиши значение сам, не складывай такие факты просто в текст description и не спрашивай разрешения на создание колонки отдельно (создание колонки — не деструктивное действие, подтверждение не требуется); подтверждения жди только для реально необратимых действий (удаление и т.п.), как указано в общих правилах ниже. Когда создаёшь колонку и сразу заполняешь её значением для конкретного проекта (а не просто добавляешь пустую колонку в таблицу) — перед этим ОБЯЗАТЕЛЬНО вызови crm_get_project и посмотри его текущие customFields целиком: там могут быть значения по смыслу совпадающие с новой колонкой, но под другим ключом (например старое "priority", не связанное ни с одной текущей колонкой, — это реальные данные проекта, а не мусор). Если такое значение нашлось — используй именно его (при необходимости адаптировав под options/формат новой колонки), а не придумывай своё; никогда не подставляй в новую колонку значение "на глаз" или заглушку, если у тебя нет источника для него — в этом случае либо спроси пользователя, либо оставь колонку пустой.
- Продажи: crm_list_sales, crm_get_sale, crm_update_sale.
- Компании: crm_create_company, crm_get_company, crm_update_company, crm_delete_company.
- Контакты: crm_list_contacts, crm_get_contact, crm_create_contact, crm_update_contact, crm_delete_contact.
- Заметки: crm_list_notes, crm_update_note, crm_delete_note (и crm_create_note как раньше).
- Рабочая область: crm_workspace_update_record, crm_workspace_delete_record.
- Маркетинг: crm_sync_marketing_integration по UUID из marketingIntegrations.
- Задачи компании: crm_list_company_tasks, crm_create_company_task, crm_update_company_task, crm_delete_company_task.
- Встречи лида (meta.meetings; карточка лида и календарь на главной): crm_list_lead_meetings, crm_add_lead_meeting, crm_update_lead_meeting, crm_remove_lead_meeting. Чтобы встреча появилась у пользователя в календаре, всегда привязывай к лиду: сначала crm_search_leads или crm_list_leads, возьми leadId из результата, затем crm_add_lead_meeting с startsAt в ISO 8601. Не выдумывай UUID лида.
- Почта: crm_list_email_accounts, crm_list_email_templates, crm_preview_email_template, crm_draft_client_email (черновик без отправки). Итоговое письмо оформляется единой фирменной HTML-обёрткой (как транзакционные письма): пользователю показывай утверждённый текст/тему; визуальная вёрстка добавится автоматически. Отправка: (1) пользователь открывает «Письмо» в панели и жмёт «Отправить», или (2) после явных фраз («отправляй», «всё ок, отправь», «да, отправь письмо») вызови crm_send_approved_client_email с userConfirmedSend: true, accountId из crm_list_email_accounts, to (массив строк email), subject и утверждённым bodyText/bodyHtml. Если пользователь написал email в чате (например user@mail.ru) — передай его в to как есть; не требуй контакт/лид в CRM для отправки. Если нужен email лида по имени — сначала crm_search_leads с query из имени, возьми email из результата; при нескольких совпадениях уточни у пользователя. Без подтверждения отправки не вызывай crm_send_approved_client_email. Не говори, что письмо отправлено, пока инструмент не вернул ok. В шаблонах маркетинга: {{поле.вложенное}} и простые {name}, {email}.
- Массовая рассылка (bulk): crm_send_bulk_email — отправляет персонализированное письмо ({{name}}, {{email}}) всем лидам или контактам сегмента. Алгоритм: (1) сначала crm_list_leads или crm_list_contacts чтобы показать пользователю аудиторию (кол-во, примеры), (2) показать итоговый черновик письма, (3) дождаться явного «запускай» / «отправляй всем» от пользователя, (4) вызвать crm_send_bulk_email с userConfirmedSend: true. Всегда указывай targetType (leads или contacts), accountId из crm_list_email_accounts. Фильтры: filterStatus, filterSource, filterDateFrom/To, filterSearch, maxRecipients (макс. 500). Без явного согласия пользователя не запускай рассылку.
- Команда: crm_list_staff_members — список сотрудников тенанта (id, ФИО, email, роль, отдел). Используй для получения assignedUserId при назначении лидов/задач или для рассылки внутри команды.
- Автоматизации: crm_list_automations, crm_create_automation, crm_update_automation, crm_delete_automation. Периодические сценарии: triggerEvent scheduled и meta.schedule с полями scheduleFrequency (weekly|daily|monthly|quarterly), scheduleTime (HH:mm), scheduleTimezone (IANA), scheduleDayOfWeek (1–7 пн=1 для weekly), scheduleDayOfMonth. В действии send_email для scheduled укажи accountId и to (массив email) и/или templateId. Mailchimp: send_mailchimp — один подписчик в аудиторию; send_mailchimp_campaign — одна email-кампания на всю аудиторию (subject, htmlBody, replyTo с верифицированного домена).
- AI-сотрудники: crm_list_ai_employees показывает доступных AI Employees (в т.ч. scheduleMode и autonomyMode); crm_assign_ai_employee_task ставит задачу конкретному AI-сотруднику; crm_ask_ai_employee задаёт вопрос AI-сотруднику и возвращает ответ от его роли по CRM-данным. Именование для пользователя: этот чат — универсальный CRM-помощник по всей системе; AI Employees — именованные специалисты с ролями (можно ссылаться по имени из списка). Если у сотрудника scheduleMode не manual, бэкенд может сам запускать фоновые циклы и ежедневный отчёт по dailyReportTime; новые лиды могут автоматически ставить задачи lead_manager/sales_manager (если не read_only и не отключено в settings.proactive.reactToNewLeads). Если пользователь просит «дай задачу AI-маркетологу/лид-менеджеру» или «спроси у AI-сотрудника», используй эти инструменты.
- Товары: crm_product_search (поиск по названию/SKU), crm_product_get, crm_product_list_categories — без подтверждения. Изменение цены/скидки — crm_product_update_price: сначала crm_product_get чтобы показать текущую цену, назови старую и новую цену/валюту в чате и дождись согласия («меняй», «да, ставь такую цену»), только после этого вызови повторно с userConfirmedPriceChange: true. Так же для статуса (crm_product_update_status, userConfirmedStatusChange — статус влияет на видимость на витрине), массовых изменений (crm_product_bulk_update, userConfirmedBulkUpdate) и корректировки остатков (crm_product_adjust_stock, userConfirmedStockAdjust) — во всех случаях сначала покажи, что именно изменится, и дождись явного «да»/«делай». Создание товара — crm_product_create (без подтверждения, кроме случая явного риска): если currency не задана явно пользователем — не выдумывай и не подставляй EUR по умолчанию, оставь поле пустым, инструмент сам определит валюту по уже существующим товарам тенанта (в ответе будет currency — сверься с ним, если нужно сообщить пользователю). Категория: если пользователь называет её словами (не UUID) — передай в category (текстом), инструмент сам найдёт существующую или создаст новую (ответ содержит createdCategory: true, если создал — обязательно сообщи об этом пользователю); crm_product_create_category — только если нужно завести категорию отдельно/заранее.
- Бронирования (запись на приём — мастер/услуга/время, НЕ номера отеля): crm_booking_list_services/crm_booking_list_staff/crm_booking_list_locations/crm_booking_list_resources для резолва названий в id (если совпадений по имени больше одного — покажи варианты и спроси пользователя, не выбирай сам, как с лидами). Если пользователь просит назначить/сменить мастера, но не назвал конкретное имя ("назначь мастера") — вызови crm_booking_list_staff и СПРОСИ, кого именно назначить; не выбирай сотрудника сам по умолчанию/наугад. "Мастер услуги" и "мастер брони/записи" — РАЗНЫЕ вещи, часто путаются: crm_booking_manage_service.staffUserIds — это справочник "кто вообще умеет оказывать эту услугу" (никак не виден в конкретной записи клиента и не отражается в списке броней); crm_booking_update.staffUserId — это мастер, назначенный на конкретную бронь конкретного клиента (то, что видно в таблице записей в колонке "Мастер"). Если из фразы пользователя неясно, что из двух он имеет в виду ("добавь мастера этой услуге" может означать оба варианта) — СПРОСИ, прежде чем вызывать инструмент, не угадывай: неверный выбор выглядит как "ничего не изменилось", хотя технически один из двух объектов был изменён. crm_booking_check_availability перед созданием — не требует подтверждения. crm_booking_search/crm_booking_get — чтение. crm_booking_search сам подстраховывается: если поиск с именем клиента (query) + датой ничего не дал, он автоматически повторяет поиск без имени и возвращает найденное в possibleMatchesByDate с пояснением в note (имя в базе могло отличаться от указанного — опечатка/другой род, напр. "Александр" вместо "Александра"). В этом случае прочти note, покажи пользователю найденные записи (имя из базы, время, услуга) и уточни, это ли нужная — НЕ говори "не найдено", если possibleMatchesByDate не пуст, и НЕ вызывай поиск повторно вручную, это уже сделано за тебя. Создание (crm_booking_create) — ВСЕГДА сначала озвучь клиента, мастера/услугу, дату и время в чате и дождись явного согласия, затем userConfirmedBooking: true. Изменение существующей брони (перенос времени, смена мастера/кабинета/локации/услуги, данные клиента, кол-во участников, цена, статус оплаты) — единый инструмент crm_booking_update: reservationId + любые поля для изменения (в т.ч. serviceId — чтобы поменять саму услугу, напр. "ресницы" на "покраска"), сначала озвучь пользователю, что именно меняется, дождись согласия, затем userConfirmedChange: true. Не утверждай, что бронь изменена, если crm_booking_update не вернул ok:true с обновлённой записью — сверься с полем serviceId/staffUserId и т.п. в ответе, а не с тем, что ты только что просил изменить. Смена статуса брони — единый инструмент crm_booking_set_status с параметром action (confirm/cancel/reject/check_in/complete/mark_no_show): для confirm/cancel/reject дождись согласия пользователя и передай userConfirmed: true; check_in/complete/mark_no_show лишь фиксируют факт, подтверждения не требуют. Управление справочниками (обычно нужны права руководителя/настройки бронирований — если инструмент вернёт forbidden, так и скажи пользователю, не обходи другим способом) — тоже единые инструменты с action: crm_booking_manage_location (create/update/delete) — локации/филиалы; crm_booking_manage_service (create/update/delete) — услуги (длительность, цена, к каким локациям/мастерам привязаны); crm_booking_manage_resource (create/update/delete) — ресурсы/кабинеты (переговорки, столы, оборудование) в конкретной локации; delete необратим — озвучь пользователю и дождись согласия. Профиль мастера — crm_booking_manage_staff_profile (доступность для записи, недельный график mon..sun, привязка к локациям/услугам, лимит одновременных броней, цвет календаря — НЕ создаёт нового сотрудника, только настраивает существующего для модуля «Бронирования») и crm_booking_manage_staff_time_off (action add/remove — отпуска/выходные); особые даты локации — crm_booking_manage_location_closure (action add/remove — закрытый день/сокращённые часы). Аналитика (загрузка, доход, динамика) — crm_booking_analytics, без подтверждения. Удаления брони как такового нет — вместо него используй crm_booking_set_status с action cancel/reject.
- Система резервации / Отели (номера отеля, тарифы по датам — НЕ путать с Бронированиями выше): crm_hotel_list/crm_hotel_get для отеля, crm_hotel_list_room_types для типа номера по названию. crm_hotel_list_market_groups ОБЯЗАТЕЛЬНО перед любым изменением тарифа — у отеля может быть несколько групп рынков (например «Западная Европа»/«Восточная Европа»/«Внутренний рынок»), тариф хранится отдельно для каждой; если групп больше одной и пользователь не назвал нужную — спроси, для какой менять цену, не угадывай. crm_hotel_get_daily_rates — текущий тариф, используй чтобы показать «было» перед «станет». Изменение тарифа — crm_hotel_update_rate: назови группу рынков, дату, старую и новую цену, дождись согласия, затем userConfirmedRateChange: true. Стоп-продажа даты — crm_hotel_set_stop_sale, userConfirmedStopSale: true. Бронирование номера — crm_hotel_reservation_create (имя гостя, отель, тип номера, даты заезда/выезда) — это ДРУГАЯ сущность, чем Бронирования выше; параметр market — свободный текст региона гостя (например «Германия»), НЕ id группы рынков из crm_hotel_list_market_groups, не путай их. Перенос/отмена/смена статуса — crm_hotel_reservation_update. Все создающие/меняющие инструменты этого блока требуют явного согласия пользователя и соответствующего userConfirmed*: true. Данные/наполнение номера (название, площадь, вместимость, кол-во номеров, удобства-amenities, обложка, стоп-продажа) — crm_hotel_update_room_type, БЕЗ подтверждения (это не цена и не бронь). Плоские тарифы по рынкам для конкретного типа номера — crm_hotel_list_markets, отдельно от групп рынков и посуточных тарифов, не путай эти три механизма цены. При изменении кол-ва гостей (pax) в существующей брони (crm_hotel_reservation_update) сумма пересчитывается автоматически ТОЛЬКО из ночей×ставки — сама ставка при смене pax не меняется сама по себе: если новая вместимость должна дать другую цену, узнай актуальную ставку (crm_hotel_get_daily_rates/crm_hotel_list_markets) и передай новый grossPerNight/ppPerNight вместе с pax в одном вызове. Аналитика (загрузка, доход, воронка, рынки/агентства/демография гостей) — crm_hotel_analytics, без подтверждения. Структура отеля (обычно нужны права руководителя — при forbidden сообщи об этом, не обходи): crm_hotel_create — новый отель; crm_hotel_create_room_type — новый тип номера (автоматически заводит 2 базовых варианта размещения); crm_hotel_list_room_units + crm_hotel_manage_room_unit (action create/update/delete) — конкретные номера с реальными названиями (напр. "101"); crm_hotel_list_occupancy_types + crm_hotel_manage_occupancy_type (action create/update/remove) — варианты размещения (SGL/2 AD и т.п.) с коэффициентом к базовой цене, на них опираются посуточные тарифы; delete/remove необратимы — озвучь пользователю и дождись согласия.

Правила:
- Доступ только к данным текущего арендатора (tenant из авторизации пользователя). Чужие tenantId недоступны; лиды, продажи, рабочая область (/workspace), интеграции и прочее — только внутри этой песочницы. Не проси и не подставляй иной tenant.
- Лиды в корзине или архиве (meta.deleted/meta.archived) не считаются активными и не должны попадать в ответы, рассылки, поиск и подсчёты.
- Отвечай на языке пользователя (по умолчанию русский).
- Для фактов и изменений в CRM вызывай соответствующие инструменты; не выдумывай цифры и не утверждай, что что-то создано, если инструмент не вызывался или вернул ошибку.
- ID-шники (UUID) сущностей — leadId/projectId/reservationId/saleId и т.п. — НЕЛЬЗЯ перепечатывать по памяти из своего же предыдущего ответа в чате: длинные случайные строки легко перепутать на один символ (напр. "2c86" превращается в "2d86"), и тогда следующий вызов инструмента получит несуществующий ID и вернёт "не найдено", хотя запись реальна. Когда нужно подряд применить действие к нескольким записям, полученным одним поиском (напр. "назначь мастера на обе записи") — используй ID именно из структурированного результата этого вызова инструмента, а не из текста, который ты сам вывел пользователю; если между показом ID пользователю и использованием его в другом инструменте прошло хоть одно сообщение — на всякий случай выполни поиск заново (crm_booking_search и т.п.) прямо перед действием, чтобы взять ID из свежего результата, а не по памяти.
- Перед удалением компании/контакта/проекта/заметки/строки workspace убедись, что пользователь явно это просит; destructive-инструменты необратимы или ведут в корзину (проект).
- Для изменения цены товара, тарифа отеля, создания/переноса/отмены брони (Бронирования или Система резервации) — правило то же, что для писем и рассылок: сначала покажи пользователю конкретику (что именно изменится, было→станет) и дождись явного согласия в этом же диалоге, и только тогда вызови инструмент с userConfirmed*: true; не вызывай эти инструменты «на всякий случай» и не утверждай, что цена/бронь изменены, если инструмент не вернул успех.
- Выбирай инструмент по смыслу запроса: «лид» → лиды, «проект» в смысле сделки → проекты, «рабочая область / таблица в workspace» → crm_workspace_*.
- Перед созданием сущностей кратко уточни намерение, если запрос двусмысленный; если пользователь явно попросил — создавай через нужный инструмент.
- После успешного вызова инструмента кратко резюмируй результат (id, имя); для рабочей области можно подсказать путь /workspace/{objectId}/table или /analytics — или полный URL из полей tableUrl / analyticsUrl ответа инструмента, если они есть.
- Таблицы и статьи в ответе оформляй в Markdown.
${memoryBlock ? `\nКонтекст из памяти клиента:\n${memoryBlock}\n` : ''}`;
  }

  private async loadMemoryContext(
    tenantId: string,
    userHint: string,
  ): Promise<string> {
    const hint = userHint.slice(0, 500);
    const words = hint
      .split(/\s+/)
      .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
      .filter((w) => w.length > 2)
      .slice(0, 8);
    if (!words.length) {
      const recent = await this.memoryRepo.find({
        where: { tenantId },
        order: { createdAt: 'DESC' },
        take: 6,
      });
      if (!recent.length) return '';
      return recent.map((m) => `- ${m.title || 'фрагмент'}: ${m.content.slice(0, 800)}`).join('\n');
    }
    const qb = this.memoryRepo
      .createQueryBuilder('m')
      .where('m.tenantId = :tenantId', { tenantId })
      .orderBy('m.createdAt', 'DESC')
      .take(20);
    const ors = words.map((_, i) => `m.content ILIKE :w${i}`);
    words.forEach((w, i) => {
      qb.setParameter(`w${i}`, `%${w}%`);
    });
    if (ors.length) qb.andWhere(`(${ors.join(' OR ')})`);
    const rows = await qb.getMany();
    const pick = rows.slice(0, 8);
    if (!pick.length) return '';
    return pick
      .map((m) => `- ${m.title || 'память'}: ${m.content.slice(0, 1200)}`)
      .join('\n');
  }

  /** Текст для модели: видимый content + скрытый в UI контекст из meta (напр. правка картинки). */
  private expandUserContentForModel(row: AiChatMessage): string {
    let c = row.content || '';
    const meta = row.meta;
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return c;
    const im = (meta as Record<string, unknown>).imageFollowUp;
    if (!im || typeof im !== 'object' || Array.isArray(im)) return c;
    const o = im as Record<string, unknown>;
    const lastUrl = String(o.lastUrl || '').trim();
    if (!lastUrl) return c;
    const up = String(o.lastUserPrompt || '').trim() || '—';
    const rp = String(o.lastRevisedPrompt || '').trim() || '—';
    c += `\n\n--- Недавнее изображение в этом чате (интерфейс) ---\nПредыдущий промпт пользователя: ${up}\nУточнённый промпт модели (если был): ${rp}\nURL последней картинки (справочно; ты не видишь пиксели): ${lastUrl}\nЕсли пользователь просит изменить персонажа, одежду, стиль или композицию — вызови crm_generate_image с полным новым описанием сцены.`;
    return c;
  }

  private toOpenAiMessages(
    system: string,
    rows: AiChatMessage[],
  ): ChatMessage[] {
    const out: ChatMessage[] = [{ role: 'system', content: system }];
    for (const r of rows) {
      if (r.role === 'user') {
        out.push({
          role: 'user',
          content: this.expandUserContentForModel(r),
        });
      } else if (r.role === 'assistant') {
        out.push({
          role: 'assistant',
          content: r.content,
          tool_calls: r.toolCalls as any,
        });
      } else if (r.role === 'tool') {
        out.push({
          role: 'tool',
          tool_call_id: r.toolCallId || '',
          content: r.content || '',
        });
      }
    }
    return out;
  }

  async runChat(input: {
    tenantId: string;
    userId: string;
    userEmail?: string;
    userRole?: string;
    /** staff_users.id (не users.id) — для проверки персональных исключений в AI-инструментах. */
    staffUserId?: string | null;
    telegramUsername?: string;
    telegramChatId?: string;
    sessionId?: string | null;
    message: string;
    salesImportContext?: {
      importId: string;
      suggestedMapping?: Record<string, string | null>;
      fileName?: string;
      totalRows?: number;
    };
    workspaceFileContext?: {
      importId: string;
      fileName?: string;
      tableNameHint?: string;
      columns: string[];
      sample: Record<string, unknown>[];
      totalRows: number;
    };
    imageFollowUpContext?: {
      lastUserPrompt?: string;
      lastRevisedPrompt?: string;
      lastUrl?: string;
    };
  }): Promise<{
    sessionId: string;
    reply: string;
    toolRounds: number;
    usage: { prompt_tokens: number; completion_tokens: number; costCents: number };
    imageUrl?: string | null;
    imageRevisedPrompt?: string | null;
    usingOwnKey: boolean;
  }> {
    const text = String(input.message || '').trim();
    const hasSalesAtt = Boolean(input.salesImportContext?.importId);
    const hasWsFile =
      Boolean(input.workspaceFileContext?.importId) &&
      Array.isArray(input.workspaceFileContext?.columns) &&
      input.workspaceFileContext!.columns.length > 0;
    const hasImgCtx = Boolean(input.imageFollowUpContext?.lastUrl?.trim());
    if (!text && !hasSalesAtt && !hasWsFile && !hasImgCtx) {
      throw new BadRequestException('Пустое сообщение');
    }

    const parts: string[] = [];
    if (text) parts.push(text);
    if (hasSalesAtt) {
      const c = input.salesImportContext!;
      parts.push(
        `\n\n--- Вложение: импорт продаж (CSV) — ${c.fileName || 'файл'}, строк: ${c.totalRows ?? '?'} ---\nimportId: ${c.importId}\nsuggestedMapping (JSON): ${JSON.stringify(c.suggestedMapping || {})}\nДействие: вызови crm_sales_import_apply с importId; fieldMapping можно опустить (подставится из сессии) или скорректировать; channelId — только если пользователь дал UUID канала.`,
      );
    }
    if (hasWsFile) {
      const w = input.workspaceFileContext!;
      parts.push(
        `\n\n--- Вложение: файл в рабочую область — ${w.fileName || 'файл'}, всего строк: ${w.totalRows} ---\nimportId: ${w.importId}\ncolumns (колонки файла): ${JSON.stringify(w.columns)}\nsample (первые строки, только для ознакомления — это не все данные): ${JSON.stringify(w.sample)}\nСначала вызови crm_workspace_create_table: name осмысленное (${w.tableNameHint || w.fileName || 'таблица'}), придумай fields (key/label/type) по columns и sample; enabledViews при необходимости ["analytics"]. Затем вызови crm_workspace_import_file с objectId созданной таблицы и importId — он сам перенесёт ВСЕ ${w.totalRows} строк из файла в таблицу (не проси и не пытайся передать сами строки — используй только importId). fieldMapping можно не указывать — колонки подберутся к полям автоматически по схожести названий; укажи явно, только если подбор точно будет неверным.`,
      );
    }
    if (hasImgCtx) {
      const im = input.imageFollowUpContext!;
      parts.push(
        `\n\n--- Недавнее изображение в этом чате (интерфейс) ---\nПредыдущий промпт пользователя: ${im.lastUserPrompt?.trim() || '—'}\nУточнённый промпт модели (если был): ${im.lastRevisedPrompt?.trim() || '—'}\nURL последней картинки (справочно; ты не видишь пиксели): ${im.lastUrl}\nЕсли пользователь просит изменить персонажа, одежду, стиль или композицию — вызови crm_generate_image с полным новым описанием сцены.`,
      );
    }

    const partsVisible: string[] = [];
    if (text) partsVisible.push(text);
    if (hasSalesAtt) {
      const c = input.salesImportContext!;
      partsVisible.push(
        `\n\n--- Вложение: импорт продаж (CSV) — ${c.fileName || 'файл'}, строк: ${c.totalRows ?? '?'} ---\nimportId: ${c.importId}\nsuggestedMapping (JSON): ${JSON.stringify(c.suggestedMapping || {})}\nДействие: вызови crm_sales_import_apply с importId; fieldMapping можно опустить (подставится из сессии) или скорректировать; channelId — только если пользователь дал UUID канала.`,
      );
    }
    if (hasWsFile) {
      const w = input.workspaceFileContext!;
      partsVisible.push(
        `\n\n--- Вложение: файл в рабочую область — ${w.fileName || 'файл'}, всего строк: ${w.totalRows} ---\nimportId: ${w.importId}\ncolumns (колонки файла): ${JSON.stringify(w.columns)}\nsample (первые строки, только для ознакомления — это не все данные): ${JSON.stringify(w.sample)}\nСначала вызови crm_workspace_create_table: name осмысленное (${w.tableNameHint || w.fileName || 'таблица'}), придумай fields (key/label/type) по columns и sample; enabledViews при необходимости ["analytics"]. Затем вызови crm_workspace_import_file с objectId созданной таблицы и importId — он сам перенесёт ВСЕ ${w.totalRows} строк из файла в таблицу (не проси и не пытайся передать сами строки — используй только importId). fieldMapping можно не указывать — колонки подберутся к полям автоматически по схожести названий; укажи явно, только если подбор точно будет неверным.`,
      );
    }

    const userContent = parts.join('').trim();
    const userContentVisible = partsVisible.join('').trim();
    if (userContent.length > 32_000) {
      throw new BadRequestException('Сообщение с вложением слишком длинное');
    }

    await this.quota.getQuotaSnapshot(input.tenantId);

    let session: AiChatSession;
    if (input.sessionId) {
      const s = await this.sessions.findOne({
        where: {
          id: input.sessionId,
          tenantId: input.tenantId,
          userId: input.userId,
        },
      });
      if (!s) throw new BadRequestException('Сессия не найдена');
      session = s;
    } else {
      session = this.sessions.create({
        tenantId: input.tenantId,
        userId: input.userId,
        title: (text || 'Вложение / запрос').slice(0, 80),
      });
      await this.sessions.save(session);
    }

    const memoryBlock = await this.loadMemoryContext(input.tenantId, userContent);
    const system = this.buildSystemPrompt(memoryBlock);

    const history = await this.messages.find({
      where: { sessionId: session.id },
      order: { createdAt: 'ASC' },
      take: MAX_HISTORY,
    });

    await this.messages.save(
      this.messages.create({
        sessionId: session.id,
        role: 'user',
        content:
          userContentVisible.length > 0 ? userContentVisible : text,
        meta: hasImgCtx
          ? { imageFollowUp: input.imageFollowUpContext }
          : null,
      }),
    );

    const allRows = await this.messages.find({
      where: { sessionId: session.id },
      order: { createdAt: 'ASC' },
      take: MAX_HISTORY,
    });

    let messages = this.toOpenAiMessages(system, allRows);
    let totalPrompt = 0;
    let totalCompletion = 0;
    let toolRounds = 0;

    const cfg = await this.platformSettings.getSettings();
    const inPrice = parseFloat(
      cfg?.aiPriceInputPerMtokUsd?.trim() || '0.15',
    );
    const outPrice = parseFloat(
      cfg?.aiPriceOutputPerMtokUsd?.trim() || '0.6',
    );

    let finalAssistantText = '';
    let lastGeneratedImage: { url: string; revised_prompt?: string } | null =
      null;

    const openAiOverride = await this.resolveTenantOpenAiOverride(input.tenantId);
    const tenantTools = await this.buildToolsForTenant(input.tenantId);

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const { message: assistantMsg, usage } = await this.openai.chatCompletionWithConfig(
        {
          messages,
          tools: tenantTools,
        },
        openAiOverride,
      );
      totalPrompt += usage.prompt_tokens || 0;
      totalCompletion += usage.completion_tokens || 0;

      const calls = assistantMsg.tool_calls;
      if (!calls?.length) {
        finalAssistantText = assistantMsg.content || '';
        if (
          lastGeneratedImage?.url &&
          !finalAssistantText.includes(lastGeneratedImage.url)
        ) {
          finalAssistantText = `${finalAssistantText.trim()}\n\n![Изображение](${lastGeneratedImage.url})`.trim();
        }
        await this.messages.save(
          this.messages.create({
            sessionId: session.id,
            role: 'assistant',
            content: finalAssistantText,
            toolCalls: null,
            meta: lastGeneratedImage?.url
              ? {
                  imageUrl: lastGeneratedImage.url,
                  revised_prompt: lastGeneratedImage.revised_prompt ?? null,
                }
              : null,
          }),
        );
        break;
      }

      toolRounds += 1;
      await this.messages.save(
        this.messages.create({
          sessionId: session.id,
          role: 'assistant',
          content: assistantMsg.content,
          toolCalls: calls as any,
        }),
      );

      messages = [...messages, assistantMsg as ChatMessage];

      for (const c of calls) {
        const name = c.function?.name || '';
        const argStr = c.function?.arguments || '{}';
        const result = await this.tools.execute(name, argStr, {
          tenantId: input.tenantId,
          userId: input.userId,
          userEmail: input.userEmail,
          userRole: input.userRole,
          staffUserId: input.staffUserId,
          telegramUsername: input.telegramUsername,
          telegramChatId: input.telegramChatId,
        });
        if (name === 'crm_generate_image') {
          try {
            const p = JSON.parse(result) as {
              ok?: boolean;
              url?: string;
              revised_prompt?: string;
            };
            if (p?.ok && p.url) {
              lastGeneratedImage = {
                url: p.url,
                revised_prompt: p.revised_prompt,
              };
            }
          } catch {
            /* ignore */
          }
        }
        await this.messages.save(
          this.messages.create({
            sessionId: session.id,
            role: 'tool',
            content: result,
            toolName: name,
            toolCallId: c.id,
          }),
        );
        messages.push({
          role: 'tool',
          tool_call_id: c.id,
          content: result,
        });
      }
    }

    if (!finalAssistantText && toolRounds >= MAX_TOOL_ROUNDS) {
      finalAssistantText =
        'Достигнут лимит шагов инструментов. Уточните запрос или разбейте задачу.';
      await this.messages.save(
        this.messages.create({
          sessionId: session.id,
          role: 'assistant',
          content: finalAssistantText,
        }),
      );
    }

    const costCents = this.openai.estimateCostCents(
      totalPrompt,
      totalCompletion,
      inPrice,
      outPrice,
    );
    // Свой ключ OpenAI (BYOK) — тенант платит OpenAI напрямую, платформенную квоту не списываем.
    if (!openAiOverride) {
      await this.quota.chargeCents(input.tenantId, costCents, {
        userId: input.userId,
        kind: 'chat',
        model: cfg?.openAiModel || null,
        promptTokens: totalPrompt,
        completionTokens: totalCompletion,
        sessionId: session.id,
      });
    }

    if (isDefaultAiChatTitle(session.title)) {
      session.title = deriveAiChatTitleFromUserMessage(text, userContentVisible);
    }
    await this.sessions.save(session);

    return {
      sessionId: session.id,
      reply: finalAssistantText,
      toolRounds,
      usage: {
        prompt_tokens: totalPrompt,
        completion_tokens: totalCompletion,
        costCents,
      },
      imageUrl: lastGeneratedImage?.url ?? null,
      imageRevisedPrompt: lastGeneratedImage?.revised_prompt ?? null,
      usingOwnKey: Boolean(openAiOverride),
    };
  }

  private async quickCompletion(tenantId: string, prompt: string): Promise<string> {
    const openAiOverride = await this.resolveTenantOpenAiOverride(tenantId);
    const { message } = await this.openai.chatCompletionWithConfig(
      { messages: [{ role: 'user', content: prompt }] },
      openAiOverride,
    );
    return message.content || '';
  }

  private isLeadHiddenForAi(lead: Pick<Lead, 'meta'>): boolean {
    const meta = lead.meta as { deleted?: unknown; archived?: unknown } | null | undefined;
    return meta?.deleted === true ||
      meta?.deleted === 'true' ||
      meta?.archived === true ||
      meta?.archived === 'true';
  }

  async scoreLead(tenantId: string, userId: string, leadId: string) {
    const lead = await this.leadRepo.findOne({ where: { id: leadId, tenantId } });
    if (!lead || this.isLeadHiddenForAi(lead)) throw new NotFoundException('Lead not found');

    const prompt = `Ты эксперт по продажам. Оцени качество и приоритет лида на основе данных ниже.
Данные лида:
- Имя: ${lead.name || '—'}
- Email: ${lead.email || '—'}
- Телефон: ${lead.phone || '—'}
- Статус: ${lead.status || '—'}
- Источник: ${lead.source || '—'}
- UTM: source=${lead.utmSource || '—'}, medium=${lead.utmMedium || '—'}, campaign=${lead.utmCampaign || '—'}
- Страна: ${(lead as any).country || '—'}
- Создан: ${lead.createdAt}
- Обновлён: ${lead.updatedAt}
- Доп. поля: ${JSON.stringify(lead.customFields || {}).slice(0, 400)}

Ответь строго в JSON (без markdown, без пояснений вне JSON):
{
  "score": <число 0-100>,
  "priority": "<high|medium|low>",
  "label": "<одно предложение — общий вывод>",
  "reasons": ["<причина 1>", "<причина 2>", "<причина 3>"]
}`;

    try {
      const raw = await this.quickCompletion(tenantId, prompt);
      const json = raw.replace(/```[a-z]*\n?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(json);
      return {
        ok: true,
        score: Math.min(100, Math.max(0, Number(parsed.score) || 0)),
        priority: ['high', 'medium', 'low'].includes(parsed.priority) ? parsed.priority : 'medium',
        label: String(parsed.label || ''),
        reasons: Array.isArray(parsed.reasons) ? parsed.reasons.map(String).slice(0, 5) : [],
        leadId,
        updatedAt: new Date().toISOString(),
      };
    } catch {
      return { ok: false, error: 'parse_failed', leadId };
    }
  }

  async enrichEntity(
    tenantId: string,
    userId: string,
    entityType: 'lead' | 'company',
    entityId: string,
  ) {
    let data: Record<string, any> = {};
    if (entityType === 'lead') {
      const lead = await this.leadRepo.findOne({ where: { id: entityId, tenantId } });
      if (!lead || this.isLeadHiddenForAi(lead)) throw new NotFoundException('Lead not found');
      data = {
        name: lead.name, email: lead.email, phone: lead.phone,
        source: lead.source, status: lead.status,
        utmSource: lead.utmSource, utmMedium: lead.utmMedium, utmCampaign: lead.utmCampaign,
        country: (lead as any).country,
        customFields: lead.customFields,
      };
    } else {
      const company = await this.companyRepo.findOne({ where: { id: entityId, tenantId } });
      if (!company) throw new NotFoundException('Company not found');
      data = {
        name: company.name, email: (company as any).email,
        phone: (company as any).phone, website: (company as any).website,
        country: (company as any).country, city: (company as any).city,
        industry: (company as any).industry, description: (company as any).description,
      };
    }

    const excludedFields = entityType === 'lead'
      ? ['score', 'priority', 'aiScore', 'aiPriority', 'aiLabel', 'leadScore', 'rating', 'id', 'tenantId', 'createdAt', 'updatedAt']
      : ['score', 'rating', 'id', 'tenantId', 'createdAt', 'updatedAt'];

    const prompt = `Ты CRM-аналитик. На основе данных ${entityType === 'lead' ? 'лида' : 'компании'} предложи улучшения/дополнения полей.
Текущие данные: ${JSON.stringify(data)}

ВАЖНО: НЕ предлагай поля: ${excludedFields.join(', ')} — они вычисляются автоматически отдельным модулем.
Предлагай только реальные атрибуты сущности: для лида — industry, country, language, companySize и подобные; для компании — industry, website, description и подобные.

Верни строго JSON (без markdown):
{
  "insight": "<общий вывод 1-2 предложения>",
  "suggestions": [
    {
      "field": "<имя поля>",
      "label": "<читаемое название поля>",
      "currentValue": "<текущее значение или null>",
      "suggestedValue": "<предложенное значение>",
      "confidence": "<high|medium>",
      "reasoning": "<почему>"
    }
  ]
}
Предлагай только поля, которые реально можно заполнить на основе доступных данных (email домен → индустрия, страна; UTM → канал и т.д.). Максимум 5 предложений.`;

    try {
      const raw = await this.quickCompletion(tenantId, prompt);
      const json = raw.replace(/```[a-z]*\n?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(json);
      return {
        ok: true,
        insight: String(parsed.insight || ''),
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 5) : [],
        entityType,
        entityId,
        updatedAt: new Date().toISOString(),
      };
    } catch {
      return { ok: false, error: 'parse_failed', entityType, entityId };
    }
  }

  async suggestEmailReply(
    tenantId: string,
    userId: string,
    input: { subject?: string; body?: string; senderName?: string },
  ) {
    const subject = (input.subject || '').trim();
    const body = (input.body || '').trim().slice(0, 3000);
    const sender = (input.senderName || '').trim();
    if (!body && !subject) throw new BadRequestException('subject or body required');

    const prompt = `Ты помощник менеджера по продажам. Письмо от клиента:
Отправитель: ${sender || 'клиент'}
Тема: ${subject || '—'}
Текст: ${body || '—'}

Напиши ровно 3 варианта ответного письма (только текст, без HTML):
1) Официальный и краткий
2) Дружелюбный и развёрнутый
3) Деловой с чётким следующим шагом

Верни строго JSON (без markdown):
{"suggestions": ["<вариант 1>", "<вариант 2>", "<вариант 3>"]}`;

    try {
      const raw = await this.quickCompletion(tenantId, prompt);
      const json = raw.replace(/```[a-z]*\n?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(json);
      const suggestions = Array.isArray(parsed.suggestions)
        ? parsed.suggestions.map(String).slice(0, 3)
        : [];
      return { ok: true, suggestions };
    } catch {
      return { ok: false, error: 'parse_failed', suggestions: [] };
    }
  }

  private readonly allowedProjectColumnTypes = [
    'text', 'textarea', 'number', 'email', 'phone',
    'date', 'datetime', 'daterange', 'boolean', 'select', 'multiselect', 'url',
  ] as const;

  async generateProjectTasks(
    tenantId: string,
    userId: string,
    input: { projectName?: string; prompt?: string },
  ) {
    const userPrompt = (input.prompt || '').trim();
    if (!userPrompt) throw new BadRequestException('prompt required');

    const existingFields = await this.customFieldsService.findByEntityType(
      tenantId,
      CustomFieldEntityType.PROJECT,
    );
    const existingFieldsList = existingFields.length
      ? existingFields
          .map((f) => `- key="${f.key}" label="${f.label}" type=${f.type}`)
          .join('\n')
      : '(колонок пока нет)';

    const prompt = `Ты помощник по управлению проектами в CRM. Пользователь ведёт проект${
      input.projectName ? ` «${input.projectName}»` : ''
    } и описывает своими словами, какие задачи нужно добавить в список задач проекта.

Запрос пользователя: ${userPrompt.slice(0, 1000)}

У таблицы «Проекты» уже есть СТАНДАРТНЫЕ колонки, не относящиеся к кастомным полям — никогда не предлагай под них field, даже если пользователь просит «колонку», в любой формулировке: ${STANDARD_PROJECT_FIELDS_NOTE} Если запрос про одну из них («добавь колонку с лидом», «нужна колонка с суммой», «колонку с валютой», «колонку с категорией») — эта колонка уже есть в таблице, просто ничего не предлагай в fields по этому пункту (и не создавай задачу с таким названием); этот инструмент не может менять сами эти стандартные поля, значение для них тут не предлагай — только для новых кастомных колонок.

Уже существующие кастомные колонки таблицы «Проекты» у этого тенанта:
${existingFieldsList}

Сделай два дела:

Важно разделять два разных типа запроса пользователя — не путай их:
(a) описание РАБОТЫ, которую нужно сделать по проекту («собрать ТЗ», «согласовать дизайн с клиентом») — это задача (tasks);
(b) прямая просьба ИЗМЕНИТЬ САМУ ТАБЛИЦУ проектов — «добавь колонку …», «создай поле для …», «заведи колонку с …», «нужна колонка, показывающая …» и т.п. — это НЕ задача, а fields, даже если для неё в запросе нет конкретного значения. Никогда не создавай task с названием вроде «Добавить колонку …» или «Создать колонку для …» — такую фразу целиком нужно превратить в объект fields, а не в задачу.

1) Разбей ту часть запроса, что описывает работу (a), на список конкретных, самостоятельных задач. Для каждой задачи укажи:
- title: короткое чёткое название задачи на русском (без нумерации)
- priority: один из "Высокий", "Обычный", "Низкий"
- deadlineDaysFromNow: целое число дней от сегодня до разумного дедлайна, или null если срок не важен

2) Отдельно — собери fields из двух источников:
   - явные просьбы завести/добавить колонку (тип (b) выше);
   - КОНКРЕТНЫЕ самостоятельные данные о проекте в тексте запроса, для которых имеет смысл отдельная колонка (ссылка на бриф/файл/сайт, email или телефон клиента, бюджет/сумма, конкретная дата/дедлайн, диапазон дат, да/нет-признак, категория из ограниченного набора вариантов) — но не превращай в колонку саму задачу или её описание, только самостоятельный факт.
   Для каждой fields: если для этого смысла уже есть подходящая колонка из списка выше — верни её key в existingKey и НЕ создавай новую (не дублируй по смыслу, даже если label сформулирован иначе). Если подходящей колонки нет — оставь existingKey null и предложи максимально точный label и type. value заполни, только если в запросе реально названо конкретное значение для этого проекта («email клиента ivan@x.com» → value="ivan@x.com"); если пользователь просто просит завести колонку без значения («добавь колонку срочности») — оставь value пустой строкой "", колонка создастся пустой, это нормально. Если в запросе вообще нет ни просьбы завести колонку, ни самостоятельного факта под колонку — верни пустой массив fields, это тоже нормально и ожидаемо в большинстве случаев.
Разрешённые type: ${this.allowedProjectColumnTypes.join(', ')}. Для type "select"/"multiselect" укажи options — короткий список вариантов текстом (обязательно, даже если value пустой). Для остальных типов value — строка (для number строка-число, для boolean "true"/"false", для date "YYYY-MM-DD", для daterange не предлагай — слишком неоднозначно, пропусти).

3) Если в итоге tasks и fields оба получились пустыми — это ОЖИДАЕМЫЙ, не ошибочный результат, когда просьба относилась к стандартному полю (например «добавь колонку валюты») или была не про задачи/колонки вообще. В этом случае заполни note — короткое объяснение на русском для пользователя, готовое показать как есть (например: «Валюта уже есть как стандартное поле проекта — отдельная колонка не нужна»). Если tasks или fields не пустые — note можно не заполнять (пустая строка).

Верни строго JSON без markdown и пояснений вне JSON:
{"tasks": [{"title": "...", "priority": "Обычный", "deadlineDaysFromNow": 3}], "fields": [{"label": "...", "type": "email", "options": [], "existingKey": null, "value": "..."}], "note": ""}
Не больше 15 задач и не больше 5 fields.`;

    try {
      const raw = await this.quickCompletion(tenantId, prompt);
      const json = raw.replace(/```[a-z]*\n?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(json);
      const list = Array.isArray(parsed.tasks) ? parsed.tasks : [];
      const priorities = ['Высокий', 'Обычный', 'Низкий'];
      const tasks = list
        .slice(0, 15)
        .map((t: any) => {
          const days = Number(t?.deadlineDaysFromNow);
          let deadline: string | null = null;
          if (Number.isFinite(days) && days >= 0) {
            const d = new Date();
            d.setDate(d.getDate() + Math.round(days));
            deadline = d.toISOString().slice(0, 10);
          }
          return {
            title: String(t?.title || '').slice(0, 200).trim(),
            priority: priorities.includes(t?.priority) ? t.priority : 'Обычный',
            deadline,
          };
        })
        .filter((t: { title: string }) => t.title.length > 0);

      const fieldsRaw = Array.isArray(parsed.fields) ? parsed.fields : [];
      const fields = fieldsRaw
        .slice(0, 5)
        .map((f: any) => {
          const type = String(f?.type || '').trim();
          if (!(this.allowedProjectColumnTypes as readonly string[]).includes(type)) return null;
          const label = String(f?.label || '').slice(0, 255).trim();
          const existingKey = f?.existingKey ? String(f.existingKey).trim() : null;
          if (!label && !existingKey) return null;
          const needsOptions = type === 'select' || type === 'multiselect';
          const options = needsOptions && Array.isArray(f?.options)
            ? (f.options as unknown[]).map((o) => String(o).trim()).filter(Boolean).slice(0, 20)
            : undefined;
          if (needsOptions && !options?.length) return null;
          const value = f?.value !== undefined && f?.value !== null ? String(f.value).trim() : '';
          const existing = existingKey ? existingFields.find((ef) => ef.key === existingKey) : null;
          return {
            label: existing ? existing.label : label,
            type: existing ? existing.type : (type as CustomFieldType),
            options: existing ? existing.options ?? undefined : options,
            existingKey: existing ? existing.key : null,
            value,
          };
        })
        .filter((f: any): f is NonNullable<typeof f> => Boolean(f && f.label));

      const note = typeof parsed.note === 'string' ? parsed.note.slice(0, 500).trim() : '';
      return { ok: true, tasks, fields, note: note || undefined };
    } catch (e: any) {
      const providerMessage =
        e?.response?.code === 'AI_PROVIDER_ERROR' ? e.response.message : null;
      return {
        ok: false,
        error: providerMessage ? 'provider_error' : 'parse_failed',
        message: providerMessage,
        tasks: [],
        fields: [],
      };
    }
  }

  // ── AI NEXT BEST ACTION ──────────────────────────────────────────────────
  async nextAction(tenantId: string, userId: string, leadId: string) {
    const lead = await this.leadRepo.findOne({ where: { id: leadId, tenantId } });
    if (!lead || this.isLeadHiddenForAi(lead)) throw new NotFoundException('Lead not found');

    const prompt = `Ты эксперт по продажам B2B/B2C. Проанализируй данные лида и предложи одно конкретное следующее действие менеджера.
Данные:
- Имя: ${lead.name || '—'}
- Email: ${lead.email || '—'}
- Телефон: ${lead.phone || '—'}
- Статус: ${lead.status || '—'}
- Канал: ${(lead as any).channel || '—'}
- Источник: ${lead.source || '—'}
- UTM: ${[lead.utmSource, lead.utmMedium, lead.utmCampaign].filter(Boolean).join(' / ') || '—'}
- Страна: ${(lead as any).country || '—'}
- Создан: ${lead.createdAt}

Верни строго JSON (без markdown):
{
  "action": "<короткое название действия, макс 6 слов>",
  "channel": "<phone|email|meeting|message>",
  "urgency": "<hot|warm|cold>",
  "reason": "<1-2 предложения — почему именно это действие>",
  "steps": ["<шаг 1>", "<шаг 2>", "<шаг 3>"]
}`;

    try {
      const raw = await this.quickCompletion(tenantId, prompt);
      const json = raw.replace(/```[a-z]*\n?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(json);
      return {
        ok: true,
        action: String(parsed.action || ''),
        channel: String(parsed.channel || 'email'),
        urgency: String(parsed.urgency || 'warm'),
        reason: String(parsed.reason || ''),
        steps: Array.isArray(parsed.steps) ? parsed.steps.map(String).slice(0, 5) : [],
        leadId,
        updatedAt: new Date().toISOString(),
      };
    } catch {
      return { ok: false, error: 'parse_failed', leadId };
    }
  }

  private countryToLanguage(country: string | null | undefined): string {
    if (!country) return 'Russian';
    const c = country.trim().toUpperCase();
    const map: Record<string, string> = {
      RU: 'Russian', RUS: 'Russian', RUSSIA: 'Russian', РОССИЯ: 'Russian',
      UA: 'Ukrainian', UKR: 'Ukrainian', UKRAINE: 'Ukrainian', УКРАИНА: 'Ukrainian',
      BY: 'Russian', BLR: 'Russian', BELARUS: 'Russian',
      KZ: 'Russian', KAZ: 'Russian', KAZAKHSTAN: 'Russian',
      US: 'English', USA: 'English', GB: 'English', UK: 'English', AU: 'English', CA: 'English',
      DE: 'German', DEU: 'German', GERMANY: 'German',
      FR: 'French', FRA: 'French', FRANCE: 'French',
      ES: 'Spanish', ESP: 'Spanish', SPAIN: 'Spanish',
      IT: 'Italian', ITA: 'Italian', ITALY: 'Italian',
      PL: 'Polish', POL: 'Polish', POLAND: 'Polish',
      CN: 'Chinese', CHN: 'Chinese', CHINA: 'Chinese',
      TR: 'Turkish', TUR: 'Turkish', TURKEY: 'Turkish',
    };
    return map[c] ?? 'English';
  }

  // ── AI OUTREACH EMAIL ────────────────────────────────────────────────────
  async generateOutreachEmail(tenantId: string, userId: string, leadId: string) {
    const lead = await this.leadRepo.findOne({ where: { id: leadId, tenantId } });
    if (!lead || this.isLeadHiddenForAi(lead)) throw new NotFoundException('Lead not found');

    const [companyEntity, senderUser] = await Promise.all([
      lead.companyId ? this.companyRepo.findOne({ where: { id: lead.companyId, tenantId } }) : Promise.resolve(null),
      this.staffRepo.findOne({ where: { id: userId, tenantId } }),
    ]);

    const companyName = (lead as any).companyName || companyEntity?.name || null;
    const senderName = senderUser?.fullName || 'Менеджер';
    const language = this.countryToLanguage((lead as any).country);

    const prompt = `Ты опытный менеджер по продажам. Напиши персонализированное первое письмо потенциальному клиенту.
Данные клиента:
- Имя: ${lead.name || 'клиент'}
- Email: ${lead.email || '—'}
- Компания: ${companyName || '—'}
- Страна: ${(lead as any).country || '—'}
- Источник лида: ${lead.source || (lead as any).channel || '—'}
- UTM кампания: ${lead.utmCampaign || '—'}

Данные отправителя:
- Имя менеджера: ${senderName}

ОБЯЗАТЕЛЬНО: Напиши письмо на языке "${language}". Подпись — "${senderName}".

Требования к письму:
- Персонализация по имени и компании
- Чёткое ценностное предложение (CRM/автоматизация бизнеса)
- Конкретный следующий шаг (звонок, демо)
- Естественный деловой тон, без шаблонных фраз
- Длина: 80-120 слов
- Подпись в конце: ${senderName}

Верни строго JSON (без markdown):
{
  "subject": "<тема письма>",
  "body": "<текст письма с переносами строк через \\n>",
  "tone": "<formal|friendly|direct>"
}`;

    try {
      const raw = await this.quickCompletion(tenantId, prompt);
      const json = raw.replace(/```[a-z]*\n?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(json);
      return {
        ok: true,
        subject: String(parsed.subject || ''),
        body: String(parsed.body || ''),
        tone: String(parsed.tone || 'friendly'),
        leadId,
        leadEmail: lead.email || null,
        leadName: lead.name || null,
      };
    } catch {
      return { ok: false, error: 'parse_failed', leadId };
    }
  }

  // ── AI DUPLICATE DETECTION ───────────────────────────────────────────────
  async findDuplicates(tenantId: string, userId: string) {
    const rawLeads = await this.leadRepo.find({
      where: { tenantId },
      select: ['id', 'name', 'email', 'phone', 'createdAt', 'meta'] as any,
      take: 220,
      order: { createdAt: 'DESC' } as any,
    });
    const leads = rawLeads
      .filter((lead) => !this.isLeadHiddenForAi(lead))
      .slice(0, 150);

    if (leads.length < 2) return { ok: true, groups: [] };

    const simplified = leads.map(l => ({
      id: l.id,
      name: l.name || '',
      email: l.email || '',
      phone: (l as any).phone || '',
    }));

    const prompt = `Ты аналитик данных CRM. Найди потенциальные дубликаты среди лидов.
Правила: дубликат — это один и тот же человек/контакт с похожими именем, email или телефоном (учитывай опечатки, разные форматы).
Данные (JSON): ${JSON.stringify(simplified)}

Верни строго JSON (без markdown), только группы с 2+ дублей:
{
  "groups": [
    {
      "ids": ["<id1>", "<id2>"],
      "reason": "<почему они дубликаты>",
      "confidence": "<high|medium>"
    }
  ]
}
Если дублей нет — верни {"groups": []}. Максимум 20 групп.`;

    try {
      const raw = await this.quickCompletion(tenantId, prompt);
      const json = raw.replace(/```[a-z]*\n?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(json);
      const leadsById = new Map(leads.map(l => [l.id, l]));
      const groups = Array.isArray(parsed.groups)
        ? parsed.groups
            .filter((g: any) => Array.isArray(g.ids) && g.ids.length >= 2)
            .slice(0, 20)
            .map((g: any) => ({
              leads: g.ids.map((id: string) => leadsById.get(id)).filter(Boolean),
              reason: String(g.reason || ''),
              confidence: String(g.confidence || 'medium'),
            }))
            .filter((g: any) => g.leads.length >= 2)
        : [];
      return { ok: true, groups, scanned: leads.length };
    } catch {
      return { ok: false, error: 'parse_failed', groups: [] };
    }
  }

  // ── AI SMART SEARCH ──────────────────────────────────────────────────────
  async smartSearch(tenantId: string, userId: string, query: string) {
    if (!query.trim()) return { ok: true, filters: {}, description: '' };

    const prompt = `Ты помощник CRM. Разбери запрос пользователя в структурированные фильтры для поиска лидов.
Запрос: "${query}"

Доступные фильтры:
- status: one of "Новый клиент" | "В работе" | "Ожидает ответа" | "Закрыт (успех)" | "Закрыт (проигран)"
- source: строка-источник (например "google", "facebook", "website")
- channel: строка (например "manual", "api", "form")
- country: код страны 2 буквы или название
- search: свободный текст для поиска по имени/email/телефону
- hasEmail: true/false
- hasPhone: true/false
- createdAfter: ISO дата "YYYY-MM-DD"
- createdBefore: ISO дата "YYYY-MM-DD"
Сегодня: ${new Date().toISOString().slice(0, 10)}

Верни строго JSON (без markdown):
{
  "filters": { /* только релевантные поля */ },
  "description": "<что ищем, 1 строка на русском>"
}`;

    try {
      const raw = await this.quickCompletion(tenantId, prompt);
      const json = raw.replace(/```[a-z]*\n?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(json);
      return {
        ok: true,
        filters: parsed.filters || {},
        description: String(parsed.description || query),
      };
    } catch {
      return { ok: false, error: 'parse_failed', filters: {}, description: query };
    }
  }
}
