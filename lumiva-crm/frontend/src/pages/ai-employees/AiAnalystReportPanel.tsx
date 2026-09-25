/**
 * CRM-аналитик: владелец только отмечает, какие данные собирать, и когда/кому присылать отчёт
 * «за вчера». Сам аналитик ничего в CRM не меняет (роль reportOnly, см. бэкенд AiAnalystReportService).
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  fetchAnalystConfig,
  runAnalystReport,
  updateAnalystConfig,
  type AnalystBlock,
  type AnalystReportConfig,
} from '../../api/aiEmployees';
import { getLocale } from '../../i18n/utils';

const BLOCKS: AnalystBlock[] = ['sales', 'payments', 'discounts', 'leads', 'bookings', 'hotels', 'tasks', 'helpdesk', 'marketing'];
const WEEK = [1, 2, 3, 4, 5, 6, 0];

export function AiAnalystReportPanel({ agentId }: { agentId: string }) {
  const { t, i18n } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.aiEmployees.analyst.${key}`, o) as string;
  const locale = getLocale(i18n.language);
  const [cfg, setCfg] = useState<AnalystReportConfig | null>(null);
  const [saved, setSaved] = useState<string>('');
  const [recipients, setRecipients] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [preview, setPreview] = useState<string>('');

  useEffect(() => {
    fetchAnalystConfig(agentId)
      .then((c) => {
        setCfg(c);
        setSaved(JSON.stringify(c));
        setRecipients(c.recipients.join(', '));
      })
      .catch((e) => setMsg({ ok: false, text: e?.message || k('loadError') }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  if (!cfg) return <div className="e2-panel" style={{ padding: 18 }}>{msg?.text || '…'}</div>;

  const draft = { ...cfg, recipients: recipients.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean) };
  const dirty = JSON.stringify(draft) !== saved;
  const dayName = (d: number) => new Date(Date.UTC(2024, 0, 7 + d, 12)).toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' });
  const toggleBlock = (b: AnalystBlock) =>
    setCfg({ ...cfg, blocks: cfg.blocks.includes(b) ? cfg.blocks.filter((x) => x !== b) : [...cfg.blocks, b] });
  const toggleDay = (d: number) =>
    setCfg({ ...cfg, weekdays: cfg.weekdays.includes(d) ? cfg.weekdays.filter((x) => x !== d) : [...cfg.weekdays, d] });

  const save = async () => {
    setBusy('save');
    setMsg(null);
    try {
      const next = await updateAnalystConfig(agentId, {
        enabled: draft.enabled,
        blocks: draft.blocks,
        time: draft.time,
        weekdays: draft.weekdays,
        recipients: draft.recipients,
        inApp: draft.inApp,
      });
      setCfg(next);
      setSaved(JSON.stringify(next));
      setRecipients(next.recipients.join(', '));
      setMsg({ ok: true, text: k('saved') });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || k('saveError') });
    } finally {
      setBusy('');
    }
  };

  const run = async (deliver: boolean) => {
    if (dirty) await save();
    setBusy(deliver ? 'send' : 'preview');
    setMsg(null);
    try {
      const r = await runAnalystReport(agentId, deliver);
      setPreview(r.contentMd);
      setMsg({ ok: true, text: deliver ? k('sent', { list: r.sentTo.map((x) => (x === 'in_app' ? k('inAppShort') : x)).join(', ') || '—' }) : k('previewReady', { day: r.day }) });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.code === 'ANALYST_NO_BLOCKS' ? k('noBlocks') : e?.message || k('runError') });
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="e2-grid2">
      <div className="e2-col">
        <div className="e2-panel">
          <div className="e2-panel-hd">
            <div className="h">{k('dataTitle')}</div>
          </div>
          <p className="e2-hint" style={{ margin: 0, padding: '12px 18px 4px', fontSize: 12.5, color: 'var(--fg-3)' }}>{k('dataHint')}</p>
          <div className="ai-analyst-blocks">
            {BLOCKS.map((b) => (
              <label key={b} className={cfg.blocks.includes(b) ? 'on' : ''}>
                <input type="checkbox" checked={cfg.blocks.includes(b)} onChange={() => toggleBlock(b)} />
                <span>
                  <b>{k(`blocks.${b}.t`)}</b>
                  <small>{k(`blocks.${b}.d`)}</small>
                </span>
              </label>
            ))}
          </div>
        </div>
        {preview ? (
          <div className="e2-panel">
            <div className="e2-panel-hd">
              <div className="h">{k('previewTitle')}</div>
            </div>
            <pre className="ai-analyst-preview">{preview}</pre>
          </div>
        ) : null}
      </div>
      <div className="e2-col">
        <div className="e2-panel">
          <div className="e2-panel-hd">
            <div className="h">{k('scheduleTitle')}</div>
          </div>
          <div className="ai-analyst-form">
            <label className="ai-analyst-row">
              <input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} />
              {k('enabled')}
            </label>
            <div>
              <div className="lbl">{k('time', { tz: cfg.timezone || '' })}</div>
              <input type="time" className="ai-input" value={cfg.time} onChange={(e) => setCfg({ ...cfg, time: e.target.value })} />
            </div>
            <div>
              <div className="lbl">{k('days')}</div>
              <div className="ai-analyst-days">
                {WEEK.map((d) => (
                  <button key={d} type="button" className={cfg.weekdays.includes(d) ? 'on' : ''} onClick={() => toggleDay(d)}>
                    {dayName(d)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="lbl">{k('recipients')}</div>
              <input className="ai-input" value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="owner@company.com, cfo@company.com" />
            </div>
            <label className="ai-analyst-row">
              <input type="checkbox" checked={cfg.inApp} onChange={(e) => setCfg({ ...cfg, inApp: e.target.checked })} />
              {k('inApp')}
            </label>
            {msg ? <div className={msg.ok ? 'ai-analyst-ok' : 'ai-analyst-err'}>{msg.text}</div> : null}
            <div className="ai-analyst-actions">
              <button className="e2b sm" disabled={!dirty || !!busy} onClick={() => void save()}>
                {busy === 'save' ? k('saving') : k('save')}
              </button>
              <button className="e2b gh sm" disabled={!!busy} onClick={() => void run(false)}>
                {busy === 'preview' ? k('running') : k('preview')}
              </button>
              <button className="e2b gh sm" disabled={!!busy} onClick={() => void run(true)}>
                {busy === 'send' ? k('running') : k('sendNow')}
              </button>
            </div>
            <p className="e2-hint" style={{ margin: 0, fontSize: 12, color: 'var(--fg-3)' }}>{k('reportOnlyNote')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
