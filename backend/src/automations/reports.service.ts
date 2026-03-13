// src/automations/reports.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

import { SalesService } from '../sales/sales.service';
import { Lead } from '../leads/lead.entity';
import { Project } from '../projects/project.entity';
import { CompanyTask } from '../companies/company-task.entity';
import { SalesAnalyticsQueryDto } from '../sales/dto/sales-analytics-query.dto';

type ReportRange = { from: Date; to: Date };

type ReportSummary = {
  totalCount: number;
  totalAmount?: number;
  avgAmount?: number;
  currency?: string;
};

type ReportSectionRow = { label: string; count: number; amount?: number };

export type ReportPayload = {
  title: string;
  range: ReportRange;
  summary: ReportSummary;
  sections: Array<{ title: string; rows: ReportSectionRow[] }>;
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly salesService: SalesService,
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
    if (frequency === 'monthly') {
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
    const { title, range, summary, sections } = report;
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
      { label: 'Всего', value: summary.totalCount },
      summary.totalAmount !== undefined
        ? { label: 'Сумма', value: `${summary.totalAmount.toFixed(2)} ${summary.currency ?? ''}` }
        : null,
      summary.avgAmount !== undefined
        ? { label: 'Среднее', value: `${summary.avgAmount.toFixed(2)} ${summary.currency ?? ''}` }
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
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.addRow(['Title', report.title]);
    summarySheet.addRow(['From', report.range.from.toISOString()]);
    summarySheet.addRow(['To', report.range.to.toISOString()]);
    summarySheet.addRow(['Total', report.summary.totalCount]);
    if (report.summary.totalAmount !== undefined) {
      summarySheet.addRow(['Amount', report.summary.totalAmount, report.summary.currency || '']);
    }
    if (report.summary.avgAmount !== undefined) {
      summarySheet.addRow(['Average', report.summary.avgAmount, report.summary.currency || '']);
    }

    report.sections.forEach((section) => {
      const sheet = workbook.addWorksheet(section.title.slice(0, 25));
      sheet.addRow(['Label', 'Count', 'Amount']);
      section.rows.forEach((row) => {
        sheet.addRow([row.label, row.count, row.amount ?? null]);
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async renderPdf(report: ReportPayload): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 40 });
        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk as Buffer));
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        const palette = [
          '#38bdf8',
          '#f97316',
          '#22c55e',
          '#6366f1',
          '#f43f5e',
          '#facc15',
          '#14b8a6',
        ];

        const drawBars = (section: ReportPayload['sections'][number]) => {
          const max = Math.max(...section.rows.map((r) => r.count || 0), 1);
          const startX = doc.x;
          const barX = startX + 160;
          const barWidth = 240;
          const rowHeight = 16;

          section.rows.forEach((row, idx) => {
            doc.fontSize(10).fillColor('#0f172a').text(row.label, startX, doc.y);
            const barY = doc.y - 2;
            const valueWidth = Math.max(8, (row.count / max) * barWidth);
            doc
              .rect(barX, barY, barWidth, 6)
              .fillOpacity(0.15)
              .fill('#94a3b8')
              .fillOpacity(1);
            doc
              .rect(barX, barY, valueWidth, 6)
              .fill(palette[idx % palette.length]);
            doc
              .fillColor('#0f172a')
              .fontSize(9)
              .text(`${row.count}`, barX + barWidth + 6, barY - 2);
            doc.moveDown(0.6);
          });
        };

        const drawDonutWithLegend = (section: ReportPayload['sections'][number]) => {
          const total = section.rows.reduce((sum, r) => sum + (r.count || 0), 0);
          if (!total) return 0;
          const centerX = doc.x + 40;
          const centerY = doc.y + 34;
          const radius = 26;
          const stroke = 10;
          let startAngle = -Math.PI / 2;

          section.rows.forEach((row, idx) => {
            const value = row.count || 0;
            const angle = (value / total) * 2 * Math.PI;
            (doc as any)
              .lineWidth(stroke)
              .strokeColor(palette[idx % palette.length])
              .arc(centerX, centerY, radius, startAngle, startAngle + angle)
              .stroke();
            startAngle += angle;
          });

          doc
            .lineWidth(1)
            .strokeColor('#e2e8f0')
            .circle(centerX, centerY, radius)
            .stroke();

          const legendX = centerX + radius + 18;
          let legendY = doc.y;
          const lineHeight = 12;
          section.rows.forEach((row, idx) => {
            const percent = total > 0 ? Math.round((row.count / total) * 100) : 0;
            const color = palette[idx % palette.length];
            doc
              .circle(legendX, legendY + 4, 3)
              .fill(color);
            doc
              .fillColor('#0f172a')
              .fontSize(9)
              .text(`${row.label}`, legendX + 8, legendY, { continued: true, width: 200 });
            doc
              .fillColor('#64748b')
              .text(` ${row.count} · ${percent}%`, { continued: false });
            legendY += lineHeight;
          });

          return Math.max(radius * 2, section.rows.length * lineHeight);
        };

        doc.fontSize(16).text(report.title);
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor('#666666');
        doc.text(`Период: ${report.range.from.toISOString().slice(0, 10)} – ${report.range.to.toISOString().slice(0, 10)}`);
        doc.moveDown(1);

        doc.fillColor('#000000').fontSize(12);
        doc.text(`Всего: ${report.summary.totalCount}`);
        if (report.summary.totalAmount !== undefined) {
          doc.text(`Сумма: ${report.summary.totalAmount.toFixed(2)} ${report.summary.currency ?? ''}`);
        }
        if (report.summary.avgAmount !== undefined) {
          doc.text(`Среднее: ${report.summary.avgAmount.toFixed(2)} ${report.summary.currency ?? ''}`);
        }

        report.sections.forEach((section) => {
          doc.moveDown(1);
          doc.fontSize(12).fillColor('#0f172a').text(section.title);
          doc.moveDown(0.2);
          const startY = doc.y;
          const donutHeight = drawDonutWithLegend(section);
          if (donutHeight > 0) {
            doc.y = startY + donutHeight + 6;
          }
          drawBars(section);
        });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
