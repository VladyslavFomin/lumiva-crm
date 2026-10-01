import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toJpeg } from 'html-to-image';
import { fetchCustomObject } from '../../api/customObjects';
import { sendAnalyticsReportEmail } from '../../api/workspaceShare';

type BlockRef = { id: string; title: string };

const EMAIL_BLOCK_WIDTH = 640;
const nextFrames = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

/** Снимок блока «как на экране» для письма. Кнопки блока (data-export-ignore) не попадают.
 * Широкий блок временно сужаем до ширины письма — графики перерисуются под неё, и текст на
 * снимке не превратится в мелочь после масштабирования в почтовом клиенте. */
async function captureBlock(el: HTMLElement): Promise<string | null> {
  const wide = el.offsetWidth > EMAIL_BLOCK_WIDTH + 60;
  const prev = { width: el.style.width, maxWidth: el.style.maxWidth };
  try {
    if (wide) {
      el.style.width = `${EMAIL_BLOCK_WIDTH}px`;
      el.style.maxWidth = `${EMAIL_BLOCK_WIDTH}px`;
      await nextFrames();
      await new Promise((r) => setTimeout(r, 350));
    }
    return await toJpeg(el, {
      quality: 0.92,
      pixelRatio: Math.min(2, window.devicePixelRatio || 1.5),
      backgroundColor: '#ffffff',
      filter: (node) => !(node instanceof HTMLElement && node.dataset?.exportIgnore !== undefined),
    });
  } catch {
    return null;
  } finally {
    if (wide) {
      el.style.width = prev.width;
      el.style.maxWidth = prev.maxWidth;
    }
  }
}

/**
 * «Отчёт на почту»: блоки текущей вкладки (снимками), ИИ-анализ таблицы и комментарий —
 * одним красивым письмом. Отправляет бэкенд (AnalyticsReportMailService).
 */
export const AnalyticsReportEmailModal: React.FC<{
  objectId: string;
  objectName?: string;
  blocks: BlockRef[];
  getBlockElement: (id: string) => HTMLElement | null;
  tabName: string;
  periodLabel: string;
  currency: string;
  onClose: () => void;
}> = ({ objectId, objectName, blocks, getBlockElement, tabName, periodLabel, currency, onClose }) => {
  const { t, i18n } = useTranslation();
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [comment, setComment] = useState('');
  const [aiText, setAiText] = useState<{ text: string; agentName?: string; computedAt?: string } | null>(null);
  const [includeAi, setIncludeAi] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(blocks.map((b) => b.id)));
  const [stage, setStage] = useState<'idle' | 'capturing' | 'sending' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ sent: number; failed: string[] } | null>(null);

  useEffect(() => {
    let alive = true;
    fetchCustomObject(objectId)
      .then((obj) => {
        const a = (obj?.meta as Record<string, any> | null)?.aiAnalytics;
        if (alive && a?.text) setAiText({ text: String(a.text), agentName: a.agentName, computedAt: a.computedAt });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [objectId]);

  const defaultSubject = useMemo(
    () => t('crm.workspace.report.defaultSubject', { name: objectName || '', period: periodLabel }),
    [t, objectName, periodLabel],
  );

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const send = async () => {
    setError(null);
    const recipients = to
      .split(/[,;\s]+/)
      .map((e) => e.trim())
      .filter(Boolean);
    if (!recipients.length) {
      setError(t('crm.workspace.report.needEmail'));
      return;
    }
    setStage('capturing');
    const images: Array<{ title: string; image: string }> = [];
    for (const block of blocks) {
      if (!selected.has(block.id)) continue;
      const el = getBlockElement(block.id);
      if (!el) continue;
      const image = await captureBlock(el);
      if (image) images.push({ title: block.title, image });
    }
    setStage('sending');
    try {
      const res = await sendAnalyticsReportEmail(objectId, {
        to: recipients,
        subject: subject.trim() || defaultSubject,
        comment: comment.trim(),
        includeAi: includeAi && Boolean(aiText),
        tabName,
        periodLabel,
        currency,
        link: `${window.location.origin}/workspace/${objectId}/analytics`,
        blocks: images,
      });
      setResult({ sent: res.results.filter((r) => r.ok).length, failed: res.results.filter((r) => !r.ok).map((r) => r.to) });
      setStage('done');
    } catch (e: any) {
      setError(e?.message || t('crm.workspace.report.failed'));
      setStage('idle');
    }
  };

  const busy = stage === 'capturing' || stage === 'sending';
  const labelCls = 'block text-[11px] uppercase tracking-[0.12em] text-neutral-400 mb-1';
  const inputCls = 'w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400';

  return (
    <div
      className="fixed inset-0 z-[8500] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white text-[#222] shadow-[0_30px_80px_rgba(0,0,0,0.18)]">
        <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold tracking-[-0.02em]">{t('crm.workspace.report.title')}</h3>
            <p className="mt-1 text-sm text-neutral-500">{t('crm.workspace.report.subtitle')}</p>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} disabled={busy} aria-label="Close">
            ✕
          </button>
        </div>

        {stage === 'done' && result ? (
          <div className="px-5 py-6">
            <div className="text-base font-semibold">
              {result.failed.length === 0
                ? t('crm.workspace.report.sentOk', { count: result.sent })
                : t('crm.workspace.report.sentPartial', { sent: result.sent, failed: result.failed.join(', ') })}
            </div>
            <div className="mt-5 flex justify-end">
              <button type="button" className="btn-primary" onClick={onClose}>
                {t('crm.workspace.report.close')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-4 overflow-y-auto px-5 py-4">
              <div>
                <label className={labelCls}>{t('crm.workspace.report.to')}</label>
                <input
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="name@company.com, boss@company.com"
                  className={inputCls}
                  autoFocus
                />
              </div>
              <div>
                <label className={labelCls}>{t('crm.workspace.report.subject')}</label>
                <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={defaultSubject} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t('crm.workspace.report.comment')}</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  maxLength={5000}
                  placeholder={t('crm.workspace.report.commentPlaceholder')}
                  className={inputCls}
                />
              </div>

              <label className={`flex items-start gap-2.5 text-sm ${aiText ? 'cursor-pointer' : 'opacity-50'}`}>
                <input
                  type="checkbox"
                  className="lv-checkbox-input mt-0.5"
                  checked={includeAi && Boolean(aiText)}
                  disabled={!aiText}
                  onChange={(e) => setIncludeAi(e.target.checked)}
                />
                <span>
                  <span className="block font-medium">{t('crm.workspace.report.includeAi')}</span>
                  <span className="block text-xs text-neutral-500">
                    {aiText
                      ? t('crm.workspace.report.aiFrom', {
                          name: aiText.agentName || '—',
                          date: aiText.computedAt ? new Date(aiText.computedAt).toLocaleString(i18n.language) : '',
                        })
                      : t('crm.workspace.report.noAi')}
                  </span>
                </span>
              </label>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className={labelCls.replace(' mb-1', '')}>
                    {t('crm.workspace.report.blocks', { selected: selected.size, total: blocks.length })}
                  </span>
                  <button
                    type="button"
                    className="text-xs text-[#1769d1] hover:underline"
                    onClick={() =>
                      setSelected(selected.size === blocks.length ? new Set() : new Set(blocks.map((b) => b.id)))
                    }
                  >
                    {selected.size === blocks.length ? t('crm.workspace.report.none') : t('crm.workspace.report.all')}
                  </button>
                </div>
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-neutral-200 p-2">
                  {blocks.length === 0 && <div className="px-1 py-2 text-xs text-neutral-400">{t('crm.workspace.report.noBlocks')}</div>}
                  {blocks.map((block) => (
                    <label key={block.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1 text-sm hover:bg-neutral-50">
                      <input
                        type="checkbox"
                        className="lv-checkbox-input"
                        checked={selected.has(block.id)}
                        onChange={() => toggle(block.id)}
                      />
                      <span className="truncate">{block.title}</span>
                    </label>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-neutral-400">
                  {t('crm.workspace.report.blocksHint', { tab: tabName, period: periodLabel, currency })}
                </p>
              </div>

              {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-neutral-100 px-5 py-3">
              <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
                {t('crm.projects.analytics.tabs.cancel')}
              </button>
              <button type="button" className="btn-primary" onClick={() => void send()} disabled={busy}>
                {stage === 'capturing'
                  ? t('crm.workspace.report.capturing')
                  : stage === 'sending'
                    ? t('crm.workspace.report.sending')
                    : t('crm.workspace.report.send')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
