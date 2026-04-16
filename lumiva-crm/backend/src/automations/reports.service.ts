// src/automations/reports.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import * as fs from 'fs';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

import { SalesService } from '../sales/sales.service';
import { Lead } from '../leads/lead.entity';
import { Project } from '../projects/project.entity';
import { CompanyTask } from '../companies/company-task.entity';
import { SalesAnalyticsQueryDto } from '../sales/dto/sales-analytics-query.dto';
import { MarketingService } from '../marketing/marketing.service';

type ReportRange = { from: Date; to: Date };

type ReportSummary = {
  totalCount: number;
  totalAmount?: number;
  avgAmount?: number;
  currency?: string;
};

type ReportSectionRow = { label: string; count: number; amount?: number };

export type ReportExtraXlsxSheet = {
  name: string;
  headers: string[];
  rows: (string | number | null)[][];
};

export type ReportPayload = {
  title: string;
  range: ReportRange;
  summary: ReportSummary;
  /** Подписи карточек сводки в письме/PDF (иначе «Всего» / «Сумма»). */
  summaryLabels?: { total?: string; amount?: string; avg?: string };
  sections: Array<{ title: string; rows: ReportSectionRow[] }>;
  /** Дополнительные листы Excel (маркетинг и др.). */
  extraXlsxSheets?: ReportExtraXlsxSheet[];
  /** Не дублировать секции из `sections` отдельными листами (данные уже в extraXlsxSheets). */
  skipDefaultXlsxSections?: boolean;
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly salesService: SalesService,
    private readonly marketingService: MarketingService,
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(CompanyTask)
    private readonly taskRepo: Repository<CompanyTask>,
  ) {}

  buildRange(frequency: string, now = new Date()): ReportRange {
    const to = new Date(now);
    const from = new Date(now);
    if (frequency === 'daily') {
      from.setDate(from.getDate() - 1);
    } else if (frequency === 'monthly') {
      from.setDate(from.getDate() - 29);
    } else if (frequency === 'quarterly') {
      from.setDate(from.getDate() - 89);
    } else {
      from.setDate(from.getDate() - 6);
    }
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }

  /** Календарные даты YYYY-MM-DD в UTC (границы дня). */
  parseInclusiveDateRange(fromDay: string, toDay: string): ReportRange {
    const fromS = fromDay.slice(0, 10);
    const toS = toDay.slice(0, 10);
    const from = new Date(`${fromS}T00:00:00.000Z`);
    const to = new Date(`${toS}T23:59:59.999Z`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
      throw new Error('Некорректный период: проверьте даты «с» и «по»');
    }
    return { from, to };
  }

  /** Пресеты для ручного запуска (UTC-календарь). */
  datePresetToRangeStrings(
    preset: 'last_7_days' | 'last_30_days' | 'this_month' | 'yesterday',
    now = new Date(),
  ): { from: string; to: string } {
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    const d = now.getUTCDate();
    const to = new Date(Date.UTC(y, m, d, 23, 59, 59, 999));
    let from = new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
    if (preset === 'yesterday') {
      from.setUTCDate(from.getUTCDate() - 1);
      to.setUTCDate(to.getUTCDate() - 1);
    } else if (preset === 'last_7_days') {
      from.setUTCDate(from.getUTCDate() - 6);
    } else if (preset === 'last_30_days') {
      from.setUTCDate(from.getUTCDate() - 29);
    } else if (preset === 'this_month') {
      from = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
    }
    const fmt = (dt: Date) => dt.toISOString().slice(0, 10);
    return { from: fmt(from), to: fmt(to) };
  }

  async buildSalesReport(
    tenantId: string,
    range: ReportRange,
    opts: {
      currencyMode?: 'native' | 'converted';
      displayCurrency?: string;
      rates?: Record<string, number>;
      dateField?: 'saleDate' | 'createdAt';
    },
  ): Promise<ReportPayload> {
    const preset = await this.salesService.getAnalyticsPreset(tenantId, null);
    const settings = (preset && (preset as any).settings) || {};

    const resolved = {
      currencyMode: opts.currencyMode ?? settings.currencyMode ?? 'converted',
      displayCurrency: opts.displayCurrency ?? settings.displayCurrency ?? 'EUR',
      rates: opts.rates ?? settings.rates ?? undefined,
      dateField: opts.dateField ?? settings.dateField ?? 'saleDate',
    };

    const query: SalesAnalyticsQueryDto = {
      from: range.from.toISOString().slice(0, 10),
      to: range.to.toISOString().slice(0, 10),
      dateField: resolved.dateField,
      currencyMode: resolved.currencyMode,
      displayCurrency: resolved.displayCurrency,
      rates: resolved.rates ? JSON.stringify(resolved.rates) : undefined,
      sampleLimit: 200,
    } as any;

    const analytics = await this.salesService.getAnalytics(tenantId, query);
    return {
      title: 'Отчёт по продажам',
      range,
      summary: {
        totalCount: analytics.totalCount,
        totalAmount: analytics.totalAmount,
        avgAmount: analytics.avgCheck,
        currency: analytics.displayCurrency,
      },
      sections: [
        {
          title: 'Статусы',
          rows: analytics.byStatus.map((row) => ({
            label: row.status,
            count: row.count,
            amount: row.amount,
          })),
        },
        {
          title: 'Каналы',
          rows: analytics.byChannel.map((row) => ({
            label: row.label,
            count: row.count,
            amount: row.amount,
          })),
        },
      ],
    };
  }

  async buildLeadsReport(tenantId: string, range: ReportRange): Promise<ReportPayload> {
    const totalCount = await this.leadRepo.count({
      where: {
        tenantId,
        createdAt: Between(range.from, range.to),
      } as any,
    });

    const statusRows = await this.leadRepo
      .createQueryBuilder('l')
      .select('l.status', 'label')
      .addSelect('COUNT(*)', 'count')
      .where('l."tenantId" = :tenantId', { tenantId })
      .andWhere('l."createdAt" BETWEEN :from AND :to', {
        from: range.from,
        to: range.to,
      })
      .groupBy('l.status')
      .getRawMany<{ label: string; count: string }>();

    return {
      title: 'Отчёт по лидам',
      range,
      summary: { totalCount },
      sections: [
        {
          title: 'Статусы',
          rows: statusRows.map((row) => ({
            label: row.label || '—',
            count: Number(row.count || 0),
          })),
        },
      ],
    };
  }

  async buildProjectsReport(tenantId: string, range: ReportRange): Promise<ReportPayload> {
    const totalCount = await this.projectRepo.count({
      where: {
        tenantId,
        createdAt: Between(range.from, range.to),
      } as any,
    });

    const statusRows = await this.projectRepo
      .createQueryBuilder('p')
      .select('p.status', 'label')
      .addSelect('COUNT(*)', 'count')
      .where('p."tenantId" = :tenantId', { tenantId })
      .andWhere('p."createdAt" BETWEEN :from AND :to', {
        from: range.from,
        to: range.to,
      })
      .groupBy('p.status')
      .getRawMany<{ label: string; count: string }>();

    return {
      title: 'Отчёт по проектам',
      range,
      summary: { totalCount },
      sections: [
        {
          title: 'Статусы',
          rows: statusRows.map((row) => ({
            label: row.label || '—',
            count: Number(row.count || 0),
          })),
        },
      ],
    };
  }

  /**
   * Агрегаты из marketing_traffic (синхронизации Google/Meta, Метрика, GA4 и т.д.).
   */
  async buildMarketingReport(tenantId: string, range: ReportRange): Promise<ReportPayload> {
    const from = range.from.toISOString().slice(0, 10);
    const to = range.to.toISOString().slice(0, 10);
    const stats = await this.marketingService.getTrafficChannelsStats(
      tenantId,
      from,
      to,
      undefined,
      65_000,
    );
    const labels = stats.dataSourceLabels || {};

    const dsLabel = (ds: string) => {
      const key = (ds || '').trim();
      if (labels[key]) return labels[key];
      if (!key || key === 'unknown') return 'Без источника / прочее';
      return key;
    };

    const providerRows = stats.providerBreakdown.map((p) => ({
      label: dsLabel(p.dataSource),
      count: p.sessions,
      amount: p.cost,
    }));

    const topCampaignRows = [...stats.items]
      .sort((a, b) => (b.sessions || 0) - (a.sessions || 0))
      .slice(0, 30)
      .map((it) => {
        const src = [it.source, it.medium].filter(Boolean).join(' / ') || '—';
        const camp = it.campaign || '—';
        const label = `${dsLabel(it.dataSource || 'unknown')} · ${camp} (${src})`.slice(0, 200);
        return {
          label,
          count: it.sessions,
          amount: it.cost,
        };
      });

    const currency = stats.currency === 'MIXED' ? undefined : stats.currency;
    const amountValue =
      stats.totalCost > 0 ? stats.totalCost : stats.totalRevenue > 0 ? stats.totalRevenue : undefined;
    const amountLabel =
      stats.totalCost > 0 ? 'Расход' : stats.totalRevenue > 0 ? 'Выручка' : undefined;

    const providerSheetRows: (string | number | null)[][] = stats.providerBreakdown.map((p) => [
      dsLabel(p.dataSource),
      p.rowCount,
      p.sessions,
      p.clicks,
      p.leads,
      p.impressions,
      p.cost,
      p.revenue,
      p.currency,
    ]);

    const detailRows: (string | number | null)[][] = stats.items.map((it) => [
      dsLabel(it.dataSource || 'unknown'),
      it.source ?? '',
      it.medium ?? '',
      it.campaign ?? '',
      it.sessions,
      it.clicks,
      it.leads,
      it.impressions,
      it.cost,
      it.revenue,
      it.currency,
    ]);

    const extraXlsxSheets: ReportExtraXlsxSheet[] = [
      {
        name: 'Сводка',
        headers: ['Показатель', 'Значение'],
        rows: [
          ['Период (дата с)', from],
          ['Период (дата по)', to],
          ['Сессии', stats.totalSessions],
          ['Клики', stats.totalClicks],
          ['Лиды', stats.totalLeads],
          ['Показы', stats.totalImpressions],
          ['Расход', stats.totalCost],
          ['Выручка', stats.totalRevenue],
          ['Строк в выборке', stats.totalRows],
          ['Валюта (сводно)', stats.currency],
        ],
      },
      {
        name: 'Источники',
        headers: [
          'Источник',
          'Строк в БД',
          'Сессии',
          'Клики',
          'Лиды',
          'Показы',
          'Расход',
          'Выручка',
          'Валюта',
        ],
        rows: providerSheetRows,
      },
      {
        name: 'Детализация',
        headers: [
          'Источник',
          'Source',
          'Medium',
          'Кампания',
          'Сессии',
          'Клики',
          'Лиды',
          'Показы',
          'Расход',
          'Выручка',
          'Валюта',
        ],
        rows: detailRows,
      },
    ];

    return {
      title: 'Отчёт по маркетингу',
      range,
      summary: {
        totalCount: stats.totalSessions,
        totalAmount: amountValue,
        avgAmount: undefined,
        currency,
      },
      summaryLabels: {
        total: 'Сессии',
        ...(amountLabel ? { amount: amountLabel } : {}),
      },
      sections: [
        { title: 'По источникам данных', rows: providerRows },
        { title: 'Кампании и каналы (топ по сессиям)', rows: topCampaignRows },
      ],
      extraXlsxSheets,
      skipDefaultXlsxSections: true,
    };
  }

  async buildTasksReport(tenantId: string, range: ReportRange): Promise<ReportPayload> {
    const totalCount = await this.taskRepo.count({
      where: {
        tenantId,
        createdAt: Between(range.from, range.to),
      } as any,
    });

    const statusRows = await this.taskRepo
      .createQueryBuilder('t')
      .select('t.status', 'label')
      .addSelect('COUNT(*)', 'count')
      .where('t."tenantId" = :tenantId', { tenantId })
      .andWhere('t."createdAt" BETWEEN :from AND :to', {
        from: range.from,
        to: range.to,
      })
      .groupBy('t.status')
      .getRawMany<{ label: string; count: string }>();

    return {
      title: 'Отчёт по задачам',
      range,
      summary: { totalCount },
      sections: [
        {
          title: 'Статусы',
          rows: statusRows.map((row) => ({
            label: row.label || '—',
            count: Number(row.count || 0),
          })),
        },
      ],
    };
  }

  renderEmailHtml(report: ReportPayload): string {
    const { title, range, summary, sections, summaryLabels } = report;
    const formatDate = (d: Date) => d.toISOString().slice(0, 10);
    const palette = [
      '#38bdf8',
      '#f97316',
      '#22c55e',
      '#6366f1',
      '#f43f5e',
      '#facc15',
      '#14b8a6',
    ];

    const renderDonutSvg = (section: ReportPayload['sections'][number]) => {
      const total = section.rows.reduce((sum, r) => sum + (r.count || 0), 0);
      if (!total) return '';
      const size = 84;
      const stroke = 10;
      const radius = (size - stroke) / 2;
      const circumference = 2 * Math.PI * radius;
      let offset = 0;
      const slices = section.rows
        .map((row, idx) => {
          const value = row.count || 0;
          const seg = (value / total) * circumference;
          const color = palette[idx % palette.length];
          const slice = `
            <circle
              cx="${size / 2}"
              cy="${size / 2}"
              r="${radius}"
              fill="transparent"
              stroke="${color}"
              stroke-width="${stroke}"
              stroke-dasharray="${seg} ${circumference - seg}"
              stroke-dashoffset="${-offset}"
              stroke-linecap="round"
            />
          `;
          offset += seg;
          return slice;
        })
        .join('');

      return `
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="transparent" stroke="#e2e8f0" stroke-width="${stroke}" />
          ${slices}
        </svg>
      `;
    };

    const renderDonutFallbackBar = (section: ReportPayload['sections'][number]) => {
      const total = section.rows.reduce((sum, r) => sum + (r.count || 0), 0);
      if (!total) return '';
      const percents = section.rows.map((row) => Math.max(2, Math.floor((row.count / total) * 100)));
      const used = percents.reduce((sum, v) => sum + v, 0);
      if (used > 100) {
        const scale = 100 / used;
        for (let i = 0; i < percents.length; i += 1) {
          percents[i] = Math.max(2, Math.floor(percents[i] * scale));
        }
      }
      const usedAfter = percents.reduce((sum, v) => sum + v, 0);
      if (usedAfter < 100 && percents.length > 0) {
        percents[0] += 100 - usedAfter;
      }
      const cells = section.rows
        .map((row, idx) => {
          const percent = percents[idx] ?? 0;
          const color = palette[idx % palette.length];
          return `<td style="background:${color};height:10px;width:${percent}%;"></td>`;
        })
        .join('');
      return `
        <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:84px;border-radius:999px;overflow:hidden;">
          <tr>${cells}</tr>
        </table>
      `;
    };

    const renderLegendTable = (section: ReportPayload['sections'][number]) => {
      const total = section.rows.reduce((sum, r) => sum + (r.count || 0), 0);
      const rows = section.rows
        .map((row, idx) => {
          const percent = total > 0 ? Math.round((row.count / total) * 100) : 0;
          const color = palette[idx % palette.length];
          return `
            <tr>
              <td style="padding:6px 8px; font-size:12px; color:#475569;">
                <span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:${color};margin-right:8px;"></span>
                ${row.label}
              </td>
              <td style="padding:6px 8px; font-size:12px; color:#0f172a; text-align:right;">
                <span style="display:inline-block; padding:3px 10px; border-radius:999px; background:#f1f5f9; border:1px solid #e2e8f0; font-weight:600;">
                  ${row.count} · ${percent}%
                </span>
              </td>
              ${
                row.amount !== undefined
                  ? `<td style="padding:6px 8px; font-size:12px; color:#0f172a; text-align:right;">${row.amount.toFixed(
                      2,
                    )} ${summary.currency ?? ''}</td>`
                  : ''
              }
            </tr>
            <tr>
              <td colspan="${row.amount !== undefined ? 3 : 2}" style="padding:0 8px 8px 8px;">
                <div style="height:6px;background:#e2e8f0;border-radius:999px;overflow:hidden;">
                  <div style="height:100%;width:${percent}%;background:${color};"></div>
                </div>
              </td>
            </tr>
          `;
        })
        .join('');

      return `
        <table style="width:100%; border-collapse:collapse; background:#f8fafc; border-radius:12px; overflow:hidden;">
          <tbody>${rows}</tbody>
        </table>
      `;
    };

    const renderSection = (section: ReportPayload['sections'][number]) => {
      const total = section.rows.reduce((sum, r) => sum + (r.count || 0), 0);

      return `
        <div style="margin-top:16px;">
          <div style="font-size:13px;font-weight:600;color:#0f172a;margin-bottom:6px;">${section.title}</div>
          <div style="display:flex; gap:12px; align-items:flex-start;">
            <div style="min-width:90px;">
              <!--[if !mso]><!-->
              ${renderDonutSvg(section)}
              <!--<![endif]-->
              <!--[if mso]>
              ${renderDonutFallbackBar(section)}
              <![endif]-->
            </div>
            ${renderLegendTable(section)}
          </div>
          ${
            total === 0
              ? `<div style="font-size:12px;color:#94a3b8;margin-top:6px;">Нет данных за период</div>`
              : ''
          }
        </div>
      `;
    };

    const summaryBlocks = [
      { label: summaryLabels?.total ?? 'Всего', value: summary.totalCount },
      summary.totalAmount !== undefined
        ? {
            label: summaryLabels?.amount ?? 'Сумма',
            value: `${summary.totalAmount.toFixed(2)} ${summary.currency ?? ''}`,
          }
        : null,
      summary.avgAmount !== undefined
        ? {
            label: summaryLabels?.avg ?? 'Среднее',
            value: `${summary.avgAmount.toFixed(2)} ${summary.currency ?? ''}`,
          }
        : null,
    ].filter(Boolean) as Array<{ label: string; value: string | number }>;

    const summaryHtml = summaryBlocks
      .map(
        (block) => `
          <div style="flex:1; min-width:140px; padding:12px 14px; border-radius:16px; background:#f1f5f9;">
            <div style="font-size:11px; text-transform:uppercase; letter-spacing:.16em; color:#94a3b8;">${block.label}</div>
            <div style="font-size:18px; font-weight:600; color:#0f172a; margin-top:4px;">${block.value}</div>
          </div>
        `,
      )
      .join('');

    return `
      <div style="font-family:Inter, Arial, sans-serif; color:#0f172a; line-height:1.4;">
        <div style="font-size:12px; text-transform:uppercase; letter-spacing:.3em; color:#94a3b8;">Отчёт</div>
        <h2 style="margin:8px 0 6px 0;">${title}</h2>
        <div style="font-size:12px; color:#64748b;">Период: ${formatDate(range.from)} – ${formatDate(range.to)}</div>

        <div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:14px;">
          ${summaryHtml}
        </div>

        ${sections.map(renderSection).join('')}
      </div>
    `;
  }

  async renderCsv(report: ReportPayload): Promise<Buffer> {
    const lines: string[] = [];
    lines.push(`title,${report.title}`);
    lines.push(`from,${report.range.from.toISOString()}`);
    lines.push(`to,${report.range.to.toISOString()}`);
    lines.push(`total,${report.summary.totalCount}`);
    if (report.summary.totalAmount !== undefined) {
      lines.push(`amount,${report.summary.totalAmount}`);
    }
    if (report.summary.avgAmount !== undefined) {
      lines.push(`avg,${report.summary.avgAmount}`);
    }
    lines.push('');

    report.sections.forEach((section) => {
      lines.push(section.title);
      lines.push('label,count,amount');
      section.rows.forEach((row) => {
        lines.push(
          `${row.label},${row.count},${row.amount !== undefined ? row.amount : ''}`,
        );
      });
      lines.push('');
    });

    return Buffer.from(lines.join('\n'), 'utf-8');
  }

  async renderXlsx(report: ReportPayload): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Lumiva CRM';

    const styleHeaderRow = (row: ExcelJS.Row) => {
      row.font = { bold: true, color: { argb: 'FF0F172A' } };
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE2E8F0' },
      };
      row.alignment = { vertical: 'middle', wrapText: true };
    };

    if (report.extraXlsxSheets?.length) {
      for (const sh of report.extraXlsxSheets) {
        const safeName = sh.name
          .slice(0, 31)
          .replace(/[[\]:*?/\\]/g, ' ')
          .trim();
        const sheet = workbook.addWorksheet(safeName || 'Sheet');
        const headerRow = sheet.addRow(sh.headers);
        styleHeaderRow(headerRow);
        sh.rows.forEach((r) => sheet.addRow(r));
        sheet.columns.forEach((col) => {
          let max = 10;
          col.eachCell?.({ includeEmpty: false }, (cell) => {
            const len = cell.value != null ? String(cell.value).length : 0;
            if (len > max) max = Math.min(len, 48);
          });
          col.width = max + 2;
        });
      }
    }

    if (!report.skipDefaultXlsxSections) {
      const summarySheet = workbook.addWorksheet('Summary');
      summarySheet.addRow(['Title', report.title]);
      summarySheet.addRow(['From', report.range.from.toISOString()]);
      summarySheet.addRow(['To', report.range.to.toISOString()]);
      summarySheet.addRow([report.summaryLabels?.total ?? 'Total', report.summary.totalCount]);
      if (report.summary.totalAmount !== undefined) {
        summarySheet.addRow([
          report.summaryLabels?.amount ?? 'Amount',
          report.summary.totalAmount,
          report.summary.currency || '',
        ]);
      }
      if (report.summary.avgAmount !== undefined) {
        summarySheet.addRow([
          report.summaryLabels?.avg ?? 'Average',
          report.summary.avgAmount,
          report.summary.currency || '',
        ]);
      }

      report.sections.forEach((section) => {
        const sheet = workbook.addWorksheet(section.title.slice(0, 25).replace(/[[\]:*?/\\]/g, ' '));
        const h = sheet.addRow(['Label', 'Count', 'Amount']);
        styleHeaderRow(h);
        section.rows.forEach((row) => {
          sheet.addRow([row.label, row.count, row.amount ?? null]);
        });
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async renderPdf(report: ReportPayload): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const fontPath = resolveUnicodePdfFont();
        const doc = new PDFDocument({ margin: 48, size: 'A4', autoFirstPage: true });
        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk as Buffer));
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        const fontName = fontPath ? 'ReportBody' : 'Helvetica';
        if (fontPath) {
          doc.registerFont(fontName, fontPath);
        }
        doc.font(fontName);

        const pageBottom = 780;
        const ensureSpace = (needed: number) => {
          if (doc.y + needed > pageBottom) {
            doc.addPage();
            doc.font(fontName);
          }
        };

        const fromD = report.range.from.toISOString().slice(0, 10);
        const toD = report.range.to.toISOString().slice(0, 10);

        doc.fillColor('#0f172a').fontSize(20).text(report.title, { width: 500 });
        doc.moveDown(0.4);
        doc.fontSize(11).fillColor('#64748b').text(`Период: ${fromD} — ${toD}`, { width: 500 });
        doc.moveDown(0.8);

        doc.rect(doc.x, doc.y, 504, 1).fill('#e2e8f0');
        doc.moveDown(0.5);

        doc.fontSize(12).fillColor('#0f172a');
        ensureSpace(24);
        doc.text(`${report.summaryLabels?.total ?? 'Всего'}: ${report.summary.totalCount}`, {
          width: 500,
        });
        if (report.summary.totalAmount !== undefined) {
          ensureSpace(22);
          doc.text(
            `${report.summaryLabels?.amount ?? 'Сумма'}: ${report.summary.totalAmount.toFixed(2)} ${report.summary.currency ?? ''}`,
            { width: 500 },
          );
        }
        if (report.summary.avgAmount !== undefined) {
          ensureSpace(22);
          doc.text(
            `${report.summaryLabels?.avg ?? 'Среднее'}: ${report.summary.avgAmount.toFixed(2)} ${report.summary.currency ?? ''}`,
            { width: 500 },
          );
        }

        doc.moveDown(0.6);
        doc.rect(doc.x, doc.y, 504, 1).fill('#e2e8f0');
        doc.moveDown(0.6);

        report.sections.forEach((section) => {
          ensureSpace(36);
          doc.fontSize(13).fillColor('#0f172a').text(section.title, { width: 500 });
          doc.moveDown(0.25);

          const total = section.rows.reduce((sum, r) => sum + (r.count || 0), 0);
          section.rows.forEach((row) => {
            const pct = total > 0 ? Math.round(((row.count || 0) / total) * 100) : 0;
            const amt =
              row.amount !== undefined
                ? `  ·  ${row.amount.toFixed(2)} ${report.summary.currency ?? ''}`
                : '';
            const line = `• ${row.label}\n    ${row.count} (${pct}%)${amt}`;
            ensureSpace(40);
            doc.fontSize(9.5).fillColor('#334155').text(line, { width: 500, lineGap: 2 });
            doc.moveDown(0.2);
          });
          doc.moveDown(0.5);
        });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}

/** TTF с кириллицей: Alpine (font-dejavu), Debian/Ubuntu. */
function resolveUnicodePdfFont(): string | null {
  const candidates = [
    '/usr/share/fonts/TTF/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/dejavu/ttf/DejaVuSans.ttf',
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return null;
}
