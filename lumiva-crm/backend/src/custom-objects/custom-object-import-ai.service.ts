import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { CustomObjectsService, type ImportPreviewResponse } from './custom-objects.service';
import {
  applyImportReshapePlan,
  buildImportReshapeOutputFields,
  normHeaderKey,
  type ImportReshapePlan,
  type ImportReshapePivotPlan,
} from '../lib/import-spreadsheet.util';
// Только типы — не тянут AiModule в рантайме (см. lazy ModuleRef ниже).
import type { AiAssistantService } from '../ai/ai-assistant.service';
import type { AiOpenAiService } from '../ai/ai-openai.service';

const SAMPLE_ROWS_FOR_AI = 60;

/**
 * ИИ-реструктуризация "сырых" файлов при импорте в таблицы рабочей области — напр. PMS-отчёт,
 * где колонка "Nationality" объединена (merge) на 4 строки Sold/Occ%/C-In/C-Out: построчный
 * импорт 1:1 (previewImport/applyImport) в этом случае дублирует страну 4 раза вместо одной
 * записи с 4 колонками-метриками. Модель проектирует ПЛАН реструктуризации по сэмплу строк,
 * а {@link applyImportReshapePlan} детерминированно применяет его ко всем строкам файла —
 * числа и группировка никогда не проходят через LLM, только структура.
 *
 * DI: AiModule уже импортирует CustomObjectsModule (для crm_workspace_import_file и т.п.),
 * поэтому обратный импорт AiModule сюда создал бы circular DI. Вместо этого — тот же
 * ленивый ModuleRef.get(..., { strict: false }) паттерн, что и в
 * telegram-crm/telegram-ai-tools.ts для TelegramCrmService/HelpdeskService.
 */
@Injectable()
export class CustomObjectImportAiService {
  private readonly log = new Logger(CustomObjectImportAiService.name);

  constructor(
    private readonly customObjects: CustomObjectsService,
    private readonly moduleRef: ModuleRef,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  private aiAssistant(): AiAssistantService {
    return this.moduleRef.get(require('../ai/ai-assistant.service').AiAssistantService, {
      strict: false,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  private aiOpenAi(): AiOpenAiService {
    return this.moduleRef.get(require('../ai/ai-openai.service').AiOpenAiService, {
      strict: false,
    });
  }

  private buildPrompt(
    columns: string[],
    sampleRows: Array<Record<string, any>>,
    existingFields: Array<{ key: string; label: string }>,
  ): string {
    const existingFieldsNote = existingFields.length
      ? `В целевой таблице CRM уже есть поля: ${JSON.stringify(
          existingFields.map((f) => f.label),
        )}. ОБЯЗАТЕЛЬНОЕ ПРАВИЛО: если среди них есть поле вроде "Name"/"Название"/"Title" (то,
что хранит имя/название самой записи) — passthroughLabels ДОЛЖЕН содержать ЕГО подпись
побуквенно (скопируй как есть из списка выше), а не имя исходной колонки файла. Пример: колонки
файла — ["ALBANIA","ALBANIA (2)","Sold","621"], поля таблицы — ["Name","Status"] → правильный
passthroughLabels — ["Name"], а НЕ ["ALBANIA"]. Создавать новое поле для passthrough-колонки
можно только если среди существующих полей действительно нет ничего подходящего.`
      : `Целевая таблица CRM пока без полей — предложи понятные подписи в passthroughLabels.`;
    return `Ты помогаешь разобрать "сырой" экспорт из Excel/CSV перед импортом в CRM-таблицу.

Колонки файла (в исходном порядке): ${JSON.stringify(columns)}
Первые строки файла (JSON, только для анализа структуры — не все строки): ${JSON.stringify(sampleRows).slice(0, 12000)}
${existingFieldsNote}

Определи, является ли файл уже "плоским" — то есть одна строка файла соответствует одной
сущности/записи (например: одна строка = один клиент, один заказ, один товар). Если да —
ответь строго {"kind":"direct"}.

Если НЕТ — типичный случай: несколько строк подряд описывают ОДНУ сущность, где одна колонка
задаёт название сущности (часто повторяется, пустая на части строк из-за склеенных ячеек Excel,
а иногда сама колонка называется бессмысленно — напр. в файле без реальной строки заголовков её
имя могло стать первым попавшимся значением типа "ALBANIA"; не путай это с реальным смыслом
колонки — смотри на ЗНАЧЕНИЯ, а не на имя), другая колонка содержит НАЗВАНИЕ метрики/показателя
(напр. "Sold", "Occ%", "C/In", "C/Out" — короткий фиксированный набор значений, циклически
повторяющийся), а третья — само ЗНАЧЕНИЕ этой метрики. В этом случае нужно "развернуть" эти
строки в одну строку на сущность с отдельной колонкой на каждую метрику.

Ответь строго в JSON (без markdown, без пояснений вне JSON) по одной из двух схем:

1) Файл уже плоский:
{"kind":"direct"}

2) Нужно развернуть повторяющиеся строки в колонки:
{
  "kind": "pivot",
  "groupKeyColumns": ["<точное имя колонки-сущности из списка "Колонки файла" выше>"],
  "pivotLabelColumn": "<точное имя колонки с названием метрики>",
  "pivotValueColumn": "<точное имя колонки со значением метрики>",
  "passthroughColumns": ["<обычно совпадает с groupKeyColumns>"],
  "passthroughLabels": ["<понятная подпись для каждой колонки из passthroughColumns, см. выше>"]
}

Список конкретных меток (Sold/Occ%/... и т.п.) и их типы ты указывать НЕ должен — это считается
отдельно и точно по всему файлу, не по сэмплу. Твоя задача — только определить структуру: какая
колонка задаёт сущность, какая — название метрики, какая — значение. passthroughLabels — ровно
столько же элементов, сколько passthroughColumns, в том же порядке. Названия колонок в
groupKeyColumns/pivotLabelColumn/pivotValueColumn/passthroughColumns должны ТОЧНО совпадать с
одним из имён из списка "Колонки файла" выше.`;
  }

  private parsePlanResponse(raw: string): ImportReshapePlan {
    const cleaned = raw.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new BadRequestException('ИИ не смог разобрать структуру файла — не удалось прочитать ответ модели.');
    }
    if (!parsed || typeof parsed !== 'object') {
      throw new BadRequestException('ИИ не смог разобрать структуру файла.');
    }
    if (parsed.kind === 'direct') return { kind: 'direct' };
    if (parsed.kind !== 'pivot') {
      throw new BadRequestException('ИИ вернул неизвестный тип структуры файла.');
    }
    const groupKeyColumns = Array.isArray(parsed.groupKeyColumns)
      ? parsed.groupKeyColumns.map(String)
      : [];
    const passthroughColumns = Array.isArray(parsed.passthroughColumns)
      ? parsed.passthroughColumns.map(String)
      : groupKeyColumns;
    const passthroughLabelsRaw = Array.isArray(parsed.passthroughLabels)
      ? parsed.passthroughLabels.map(String)
      : [];
    const passthroughLabels =
      passthroughLabelsRaw.length === passthroughColumns.length ? passthroughLabelsRaw : passthroughColumns;
    if (!groupKeyColumns.length || !parsed.pivotLabelColumn || !parsed.pivotValueColumn) {
      throw new BadRequestException('ИИ вернул неполный план разбора файла.');
    }
    // outputFields заполняется отдельно, детерминированно из полных данных — см. reshapeWithAi.
    const plan: ImportReshapePivotPlan = {
      kind: 'pivot',
      groupKeyColumns,
      pivotLabelColumn: String(parsed.pivotLabelColumn),
      pivotValueColumn: String(parsed.pivotValueColumn),
      passthroughColumns: passthroughColumns.length ? passthroughColumns : groupKeyColumns,
      passthroughLabels: passthroughLabels.length ? passthroughLabels : groupKeyColumns,
      outputFields: [],
    };
    return plan;
  }

  /**
   * Гарантирует, что для каждой итоговой колонки плана (passthrough + outputFields) есть
   * подходящее поле на целевой таблице — иначе после реструктуризации пользователю пришлось бы
   * вручную нажимать «Создать поле» на каждую из N метрик перед Apply (реальный кейс: ИИ
   * корректно разложил 139 строк в 35 записей по странам, но Sold/Occ%/C-In/C-Out никуда не
   * замапились и апply сохранил только имя страны — метрики потерялись молча). Подбор по точному
   * совпадению label/key (см. buildSuggestedCustomObjectFieldMapping) — создаём новое поле,
   * только если подходящего действительно нет.
   */
  private async ensureFieldsForPlan(
    tenantId: string,
    objectId: string,
    plan: ImportReshapePivotPlan,
  ): Promise<void> {
    const existing = await this.customObjects.listFields(tenantId, objectId);
    const findExisting = (label: string) => {
      const norm = normHeaderKey(label);
      return existing.find((f) => normHeaderKey(f.key) === norm || normHeaderKey(f.label) === norm);
    };
    for (const label of plan.passthroughLabels) {
      if (findExisting(label)) continue;
      const created = await this.customObjects.createField(tenantId, objectId, {
        key: label,
        label,
        type: 'text',
      });
      existing.push(created);
    }
    for (const f of plan.outputFields) {
      if (findExisting(f.label)) continue;
      const created = await this.customObjects.createField(tenantId, objectId, {
        key: f.key,
        label: f.label,
        type: f.type,
      });
      existing.push(created);
    }
  }

  async reshapeWithAi(
    tenantId: string,
    objectId: string,
    importId: string,
  ): Promise<(ImportPreviewResponse & { plan: ImportReshapePivotPlan }) | { alreadyFlat: true }> {
    const session = await this.customObjects.getImportSessionRows(tenantId, importId);
    if (session.objectId && session.objectId !== objectId) {
      throw new NotFoundException('Import session not found, or it is already attached to a different table');
    }
    if (!session.rows.length) {
      throw new BadRequestException('В файле нет строк для анализа.');
    }

    const existingFields = await this.customObjects.listFields(tenantId, objectId);
    const prompt = this.buildPrompt(
      session.columns,
      session.rows.slice(0, SAMPLE_ROWS_FOR_AI),
      existingFields.filter((f) => f.isActive),
    );
    const override = await this.aiAssistant().resolveTenantOpenAiOverride(tenantId);
    const { message } = await this.aiOpenAi().chatCompletionWithConfig(
      // Низкая температура: это структурное извлечение с единственно правильным ответом
      // (какая колонка чем является), а не творческая генерация — детерминизм важнее.
      { messages: [{ role: 'user', content: prompt }], temperatureOverride: 0.1 },
      override,
    );
    const plan = this.parsePlanResponse(message.content || '');
    if (plan.kind === 'direct') {
      return { alreadyFlat: true };
    }
    // Список меток и их типы — не от модели, а посчитаны точно по ВСЕМ строкам файла (см.
    // комментарий у ImportReshapePivotPlan.outputFields).
    plan.outputFields = buildImportReshapeOutputFields(
      session.rows,
      plan.pivotLabelColumn,
      plan.pivotValueColumn,
    );
    // Инструкция в промпте переиспользовать существующее поле "Name" модель на практике
    // выполняет ненадёжно (проверено на реальных данных — дважды продолжала предлагать сырое
    // имя исходной колонки вместо "Name"). "name" — жёсткая конвенция этого модуля (поле
    // заголовка записи), поэтому для одиночной passthrough-колонки просто переопределяем
    // детерминированно, не полагаясь на LLM.
    if (plan.passthroughColumns.length === 1) {
      const nameField = existingFields.find((f) => f.key === 'name' && f.isActive);
      if (nameField) plan.passthroughLabels = [nameField.label];
    }

    const { columns, rows } = applyImportReshapePlan(session.columns, session.rows, plan);
    // Заранее создаём недостающие поля под колонки плана — иначе Apply молча теряет метрики,
    // для которых ещё нет поля (данные некуда положить, а пользователь может не заметить, что
    // нужно было нажать «Создать поле» на каждую из них вручную).
    await this.ensureFieldsForPlan(tenantId, objectId, plan);
    const preview = await this.customObjects.createReshapedImportSession(
      tenantId,
      objectId,
      { originalImportId: importId, originalFileName: session.originalFileName },
      columns,
      rows,
      plan,
    );
    return { ...preview, plan };
  }
}
