/**
 * ИИ-менеджер отзывов: ежедневная сводка, напоминания о неотвеченных отзывах с эскалацией задачей,
 * черновики ответов (отвечает всегда человек), еженедельные инсайты. Бэкенд — ReputationAgentService
 * (модуль hotel-reputation, настройки в agent.settings.reviewsWork).
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  fetchRepAgent,
  fetchRepSettings,
  fetchRepSetup,
  runRepAgentDigest,
  runRepAgentInsights,
  runRepAgentReminders,
  updateRepAgent,
  type RepAgentState,
  type RepReviewsWork,
  type RepSettings,
  type RepSetup,
} from '../../api/hotelReputation';
import { getLocale } from '../../i18n/utils';
import { TenantMailNotice } from '../../components/mail/TenantMailNotice';

const WEEK = [1, 2, 3, 4, 5, 6, 0];

export function AiReviewsWorkPanel({ agentStatus }: { agentStatus: string }) {
  const { t, i18n } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.aiEmployees.reviewsWork.${key}`, o) as string;
  const locale = getLocale(i18n.language);
  const [state, setState] = useState<RepAgentState | null>(null);
  const [w, setW] = useState<RepReviewsWork | null>(null);
  const [saved, setSaved] = useState('');
  const [recipients, setRecipients] = useState('');
  const [setup, setSetup] = useState<RepSetup | null>(null);
  const [repSettings, setRepSettings] = useState<RepSettings | null>(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [preview, setPreview] = useState('');

  const apply = (s: RepAgentState) => {
    setState(s);
    setW(s.work);
    setSaved(JSON.stringify(s.work));
    setRecipients(s.work.digest.recipients.join(', '));
  };

  useEffect(() => {
    fetchRepAgent().then(apply).catch((e) => setMsg({ ok: false, text: e?.message || k('loadError') }));
    fetchRepSetup().then(setSetup).catch(() => undefined);
    fetchRepSettings().then(setRepSettings).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!w) return <div className="e2-panel" style={{ padding: 18 }}>{msg?.text || '…'}</div>;

  const draft: RepReviewsWork = { ...w, digest: { ...w.digest, recipients: recipients.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean) } };
  const dirty = JSON.stringify(draft) !== saved;
  const dayName = (d: number) => new Date(Date.UTC(2024, 0, 7 + d, 12)).toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' });
  const bot = repSettings?.telegramBots.find((b) => b.id === repSettings.config.telegramBotId);
  const set = <K extends keyof RepReviewsWork>(key: K, v: Partial<RepReviewsWork[K]>) => setW({ ...w, [key]: { ...(w[key] as any), ...v } });

  const save = async () => {
    setBusy('save');
    setMsg(null);
    try {
      apply(await updateRepAgent({ digest: draft.digest, reminders: draft.reminders, drafts: draft.drafts, insights: draft.insights, scope: draft.scope }));
      setMsg({ ok: true, text: k('saved') });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || k('saveError') });
    } finally {
      setBusy('');
    }
  };

  const run = async (what: 'digest' | 'digestSend' | 'insights' | 'insightsSend' | 'reminders') => {
    if (dirty) await save();
    setBusy(what);
    setMsg(null);
    try {
      if (what === 'digest' || what === 'digestSend') {
        const r = await runRepAgentDigest(what === 'digestSend');
        setPreview(r.contentMd);
        setMsg({ ok: true, text: what === 'digestSend' ? k('sent', { list: r.sentTo.map((x) => (x === 'in_app' ? k('inAppShort') : x)).join(', ') || '—' }) : k('previewReady', { day: r.day }) });
      } else if (what === 'insights' || what === 'insightsSend') {
        const r = await runRepAgentInsights(what === 'insightsSend');
        setPreview(r.contentMd);
        setMsg({ ok: true, text: k('insightsReady', { items: r.items, recs: r.recommendations, tasks: r.tasks }) });
      } else {
        const r = await runRepAgentReminders();
        setMsg({ ok: true, text: k('remindersDone', { r: r.reminded, e: r.escalated }) });
      }
      fetchRepAgent().then((s) => setState(s)).catch(() => undefined);
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || k('runError') });
    } finally {
      setBusy('');
    }
  };

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <div className="e2-grid2">
      <div className="e2-col">
        {agentStatus !== 'active' && <div className="ai-analyst-err" style={{ marginBottom: 12 }}>{k('paused')}</div>}
        <div className="e2-panel">
          <div className="e2-panel-hd"><div className="h">{k('digestTitle')}</div></div>
          <div className="ai-analyst-form">
            <p className="e2-hint" style={{ margin: 0, fontSize: 12.5, color: 'var(--fg-3)' }}>{k('digestHint')}</p>
            <label className="ai-analyst-row">
              <input type="checkbox" checked={w.digest.enabled} onChange={(e) => set('digest', { enabled: e.target.checked })} />
              {k('digestEnabled')}
            </label>
            <div>
              <div className="lbl">{k('time', { tz: state?.agent?.timezone || '' })}</div>
              <input type="time" className="ai-input" value={w.digest.time} onChange={(e) => set('digest', { time: e.target.value })} />
            </div>
            <div>
              <div className="lbl">{k('days')}</div>
              <div className="ai-analyst-days">
                {WEEK.map((d) => (
                  <button key={d} type="button" className={w.digest.weekdays.includes(d) ? 'on' : ''} onClick={() => set('digest', { weekdays: toggle(w.digest.weekdays, d) })}>
                    {dayName(d)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="lbl">{k('recipients')}</div>
              <input className="ai-input" value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="manager@hotel.com, marketing@hotel.com" />
              <TenantMailNotice style={{ marginTop: 6 }} />
            </div>
            <div>
              <div className="lbl">{k('telegram')}</div>
              {bot && bot.recipients.length ? (
                <div className="ai-analyst-days">
                  {bot.recipients.map((r) => (
                    <button key={r.id} type="button" className={w.digest.telegram.includes(r.id) ? 'on' : ''} onClick={() => set('digest', { telegram: toggle(w.digest.telegram, r.id) })}>
                      {r.name}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="e2-hint" style={{ fontSize: 12, color: 'var(--fg-3)' }}>
                  {k('noBot')} <Link to="/hotels/reviews/settings?tab=alerts">{k('openReviewSettings')}</Link>
                </div>
              )}
            </div>
            <label className="ai-analyst-row">
              <input type="checkbox" checked={w.digest.inApp} onChange={(e) => set('digest', { inApp: e.target.checked })} />
              {k('inApp')}
            </label>
            <div className="ai-analyst-actions">
              <button className="e2b gh sm" disabled={!!busy} onClick={() => void run('digest')}>{busy === 'digest' ? k('running') : k('preview')}</button>
              <button className="e2b gh sm" disabled={!!busy} onClick={() => void run('digestSend')}>{busy === 'digestSend' ? k('running') : k('sendNow')}</button>
            </div>
          </div>
        </div>

        <div className="e2-panel">
          <div className="e2-panel-hd"><div className="h">{k('remindersTitle')}</div></div>
          <div className="ai-analyst-form">
            <p className="e2-hint" style={{ margin: 0, fontSize: 12.5, color: 'var(--fg-3)' }}>{k('remindersHint')}</p>
            <label className="ai-analyst-row">
              <input type="checkbox" checked={w.reminders.enabled} onChange={(e) => set('reminders', { enabled: e.target.checked })} />
              {k('remindersEnabled')}
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div className="lbl">{k('firstHours')}</div>
                <input type="number" min={1} className="ai-input" value={w.reminders.firstHours} onChange={(e) => set('reminders', { firstHours: Number(e.target.value) })} />
              </div>
              <div>
                <div className="lbl">{k('escalateHours')}</div>
                <input type="number" min={2} className="ai-input" value={w.reminders.escalateHours} onChange={(e) => set('reminders', { escalateHours: Number(e.target.value) })} />
              </div>
            </div>
            <label className="ai-analyst-row">
              <input type="checkbox" checked={w.reminders.negativeOnly} onChange={(e) => set('reminders', { negativeOnly: e.target.checked })} />
              {k('negativeOnly')}
            </label>
            <div className="ai-analyst-actions">
              <button className="e2b gh sm" disabled={!!busy} onClick={() => void run('reminders')}>{busy === 'reminders' ? k('running') : k('runReminders')}</button>
            </div>
          </div>
        </div>

        {preview ? (
          <div className="e2-panel">
            <div className="e2-panel-hd"><div className="h">{k('previewTitle')}</div></div>
            <pre className="ai-analyst-preview">{preview}</pre>
          </div>
        ) : null}
      </div>

      <div className="e2-col">
        <div className="e2-panel">
          <div className="e2-panel-hd"><div className="h">{k('draftsTitle')}</div></div>
          <div className="ai-analyst-form">
            <p className="e2-hint" style={{ margin: 0, fontSize: 12.5, color: 'var(--fg-3)' }}>{k('draftsHint')}</p>
            {(['negative', 'all', 'off'] as const).map((m) => (
              <label key={m} className="ai-analyst-row">
                <input type="radio" name="drafts" checked={w.drafts.mode === m} onChange={() => set('drafts', { mode: m })} />
                {k(`drafts.${m}`)}
              </label>
            ))}
          </div>
        </div>

        <div className="e2-panel">
          <div className="e2-panel-hd"><div className="h">{k('insightsTitle')}</div></div>
          <div className="ai-analyst-form">
            <p className="e2-hint" style={{ margin: 0, fontSize: 12.5, color: 'var(--fg-3)' }}>{k('insightsHint')}</p>
            <label className="ai-analyst-row">
              <input type="checkbox" checked={w.insights.enabled} onChange={(e) => set('insights', { enabled: e.target.checked })} />
              {k('insightsEnabled')}
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div className="lbl">{k('weekday')}</div>
                <select className="ai-input" value={w.insights.weekday} onChange={(e) => set('insights', { weekday: Number(e.target.value) })}>
                  {WEEK.map((d) => <option key={d} value={d}>{dayName(d)}</option>)}
                </select>
              </div>
              <div>
                <div className="lbl">{k('time', { tz: state?.agent?.timezone || '' })}</div>
                <input type="time" className="ai-input" value={w.insights.time} onChange={(e) => set('insights', { time: e.target.value })} />
              </div>
            </div>
            <label className="ai-analyst-row">
              <input type="checkbox" checked={w.insights.createTasks} onChange={(e) => set('insights', { createTasks: e.target.checked })} />
              {k('createTasks')}
            </label>
            <div className="ai-analyst-actions">
              <button className="e2b gh sm" disabled={!!busy} onClick={() => void run('insights')}>{busy === 'insights' ? k('running') : k('preview')}</button>
              <button className="e2b gh sm" disabled={!!busy} onClick={() => void run('insightsSend')}>{busy === 'insightsSend' ? k('running') : k('sendNow')}</button>
            </div>
          </div>
        </div>

        <div className="e2-panel">
          <div className="e2-panel-hd"><div className="h">{k('scopeTitle')}</div></div>
          <div className="ai-analyst-form">
            <p className="e2-hint" style={{ margin: 0, fontSize: 12.5, color: 'var(--fg-3)' }}>{k('scopeHint')}</p>
            {setup?.brands.length ? (
              <div>
                <div className="lbl">{k('brands')}</div>
                <div className="ai-analyst-days">
                  {setup.brands.map((b) => (
                    <button key={b.id} type="button" className={w.scope.brandIds.includes(b.id) ? 'on' : ''} onClick={() => set('scope', { brandIds: toggle(w.scope.brandIds, b.id) })}>
                      {b.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {setup?.hotels.length ? (
              <div>
                <div className="lbl">{k('hotels')}</div>
                <div className="ai-analyst-days" style={{ flexWrap: 'wrap' }}>
                  {setup.hotels.map((h) => (
                    <button key={h.id} type="button" className={w.scope.hotelIds.includes(h.id) ? 'on' : ''} onClick={() => set('scope', { hotelIds: toggle(w.scope.hotelIds, h.id) })}>
                      {h.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {msg ? <div className={msg.ok ? 'ai-analyst-ok' : 'ai-analyst-err'}>{msg.text}</div> : null}
            <div className="ai-analyst-actions">
              <button className="e2b sm" disabled={!dirty || !!busy} onClick={() => void save()}>{busy === 'save' ? k('saving') : k('save')}</button>
              <Link className="e2b gh sm" to="/hotels/reviews">{k('openFeed')}</Link>
            </div>
            <p className="e2-hint" style={{ margin: 0, fontSize: 12, color: 'var(--fg-3)' }}>{k('humanReplies')}</p>
          </div>
        </div>

        {state?.reports.length ? (
          <div className="e2-panel">
            <div className="e2-panel-hd"><div className="h">{k('reportsTitle')}</div></div>
            <div className="ai-analyst-form">
              {state.reports.map((r) => (
                <Link key={r.id} to="/ai-employees/reports" className="ai-analyst-row" style={{ textDecoration: 'none', color: 'inherit' }}>
                  {r.title} · {new Date(r.createdAt).toLocaleString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
