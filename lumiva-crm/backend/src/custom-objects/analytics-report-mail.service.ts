import { BadRequestException, Injectable } from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import { MAIL_BORDER, MAIL_MUTED, escapeMailHtml, renderMailShell } from '../mail/mail-template.util';
import { CustomObjectsService } from './custom-objects.service';

type ReportBlock = { title?: string; image?: string };

const EMAIL_RE = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]+$/;
const MAX_RECIPIENTS = 10;
const MAX_BLOCKS = 24;
const MAX_TOTAL_IMAGE_BYTES = 15 * 1024 * 1024;

/**
 * «Отправить отчёт на почту» со страницы аналитики таблицы: снимки блоков (PNG, сделаны в
 * браузере — поэтому в письме они выглядят 1 в 1 как на экране) + ИИ-анализ + комментарий.
 * ИИ-анализ берём из CustomObject.meta.aiAnalytics на сервере, а не из тела запроса.
 */
@Injectable()
export class AnalyticsReportMailService {
  constructor(
    private readonly mail: MailService,
    private readonly objects: CustomObjectsService,
  ) {}

  async send(
    tenantId: string,
    senderName: string,
    objectId: string,
    body: {
      to?: unknown;
      subject?: unknown;
      comment?: unknown;
      includeAi?: unknown;
      tabName?: unknown;
      periodLabel?: unknown;
      currency?: unknown;
      blocks?: unknown;
      link?: unknown;
    },
  ) {
    const object = await this.objects.getObject(tenantId, objectId);
    const to = Array.from(
      new Set(
        (Array.isArray(body.to) ? body.to : String(body.to || '').split(/[,;\s]+/))
          .map((e) => String(e || '').trim().toLowerCase())
          .filter(Boolean),
      ),
    );
    if (!to.length) throw new BadRequestException('Укажите хотя бы один email');
    if (to.length > MAX_RECIPIENTS) throw new BadRequestException(`Не больше ${MAX_RECIPIENTS} получателей`);
    const bad = to.filter((e) => !EMAIL_RE.test(e));
    if (bad.length) throw new BadRequestException(`Некорректный email: ${bad.join(', ')}`);

    const blocks = (Array.isArray(body.blocks) ? (body.blocks as ReportBlock[]) : []).slice(0, MAX_BLOCKS);
    const attachments: Array<{ filename: string; content: string; cid: string; contentType: string }> = [];
    let totalBytes = 0;
    const blockHtml: string[] = [];
    blocks.forEach((block, index) => {
      const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(String(block?.image || ''));
      if (!match) return;
      totalBytes += Math.floor((match[2].length * 3) / 4);
      if (totalBytes > MAX_TOTAL_IMAGE_BYTES) return;
      const cid = `block${index}@lumiva`;
      attachments.push({
        filename: `block-${index + 1}.${match[1] === 'jpeg' ? 'jpg' : 'png'}`,
        content: match[2],
        cid,
        contentType: `image/${match[1]}`,
      });
      const title = escapeMailHtml(String(block.title || '').slice(0, 160));
      blockHtml.push(
        // Заголовок блока уже есть на самом снимке — отдельной подписью не дублируем.
        `<div style="margin:0 0 14px;">
          <img src="cid:${cid}" alt="${title}" width="504" style="display:block;width:100%;max-width:504px;height:auto;border:0;border-radius:14px;" />
        </div>`,
      );
    });
    if (totalBytes > MAX_TOTAL_IMAGE_BYTES) {
      throw new BadRequestException('Слишком большой отчёт — уберите часть блоков');
    }

    const comment = String(body.comment || '').trim().slice(0, 5000);
    const meta = (object.meta || {}) as Record<string, any>;
    const ai = body.includeAi && meta.aiAnalytics?.text ? meta.aiAnalytics : null;
    const periodLabel = String(body.periodLabel || '').slice(0, 80);
    const tabName = String(body.tabName || '').slice(0, 80);
    const currency = String(body.currency || '').slice(0, 8);
    const link = typeof body.link === 'string' && /^https:\/\//.test(body.link) ? body.link.slice(0, 500) : '';

    const metaLine = [
      tabName && `Вкладка: <b>${escapeMailHtml(tabName)}</b>`,
      periodLabel && `Период: <b>${escapeMailHtml(periodLabel)}</b>`,
      currency && `Валюта: <b>${escapeMailHtml(currency)}</b>`,
      `Сформировано: ${escapeMailHtml(new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Istanbul' }))}`,
    ]
      .filter(Boolean)
      .join(' · ');

    const section = (label: string, inner: string) =>
      `<div style="margin:0 0 18px;">
        <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${MAIL_MUTED};margin:0 0 8px;">${label}</div>
        ${inner}
      </div>`;
    const textBox = (text: string, bg: string) =>
      `<div style="padding:14px 16px;border-radius:12px;background:${bg};border:1px solid ${MAIL_BORDER};font-size:14px;line-height:1.6;color:#27272a;">${escapeMailHtml(text).replace(/\n/g, '<br />')}</div>`;

    const bodyHtml = [
      `<p style="margin:0 0 18px;font-size:13px;color:${MAIL_MUTED};">${metaLine}</p>`,
      senderName ? `<p style="margin:0 0 18px;font-size:14px;">${escapeMailHtml(senderName)} поделился(ась) с вами отчётом.</p>` : '',
      comment ? section('Комментарий', textBox(comment, '#fafafa')) : '',
      ai
        ? section(
            `ИИ-анализ${ai.agentName ? ` · ${escapeMailHtml(String(ai.agentName))}` : ''}`,
            textBox(String(ai.text).slice(0, 12000), '#f5f3ff'),
          )
        : '',
      blockHtml.length ? section('Блоки аналитики', blockHtml.join('')) : '',
    ].join('');

    const subject =
      String(body.subject || '').trim().slice(0, 180) || `Отчёт: ${object.name}${periodLabel ? ` · ${periodLabel}` : ''}`;
    const html = renderMailShell({
      headline: escapeMailHtml(`Отчёт: ${object.name}`),
      bodyHtml,
      cta: link ? { label: 'Открыть аналитику', href: escapeMailHtml(link) } : undefined,
    });

    const results: Array<{ to: string; ok: boolean; error?: string }> = [];
    for (const recipient of to) {
      const res = await this.mail.sendMailNow({ to: recipient, subject, html, attachments });
      results.push(res.ok ? { to: recipient, ok: true } : { to: recipient, ok: false, error: res.error });
    }
    return { ok: results.every((r) => r.ok), results, blocks: attachments.length };
  }
}
