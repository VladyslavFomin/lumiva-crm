/**
 * ИИ-консультант мессенджеров: аккордеон по каналам (WhatsApp, Telegram) — у каждого свой
 * переключатель «Отвечать», свой бриф и проверка ответа. Ответы клиентам пишет бэкенд
 * OnlineChatAiService (processMessenger), тот же движок, что у онлайн-консультанта сайта.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AiBookingPanel, AiBookingTrace } from './AiBookingPanel';
import { Link } from 'react-router-dom';
import {
  fetchMessengerOperatorConfig,
  testMessengerOperatorReply,
  updateMessengerOperatorConfig,
  type ConsultantTestReply,
  type MessengerChannel,
  type MessengerOperatorConfig,
} from '../../api/aiEmployees';

const BRIEF_MAX = 12000;
const CHANNELS: Array<{ key: MessengerChannel; name: string; accent: string; inbox: string; perm: string }> = [
  { key: 'whatsapp', name: 'WhatsApp', accent: '#1FA855', inbox: '/whatsapp/inbox', perm: 'send_whatsapp' },
  { key: 'telegram', name: 'Telegram', accent: '#229ED9', inbox: '/telegram/inbox', perm: 'send_telegram' },
];

export function AiMessengerOperatorPanel({
  agentId,
  autonomyMode,
  permissions,
}: {
  agentId: string;
  autonomyMode: string;
  permissions: Record<string, boolean> | undefined;
}) {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.aiEmployees.messengerOperator.${key}`, o) as string;
  const [cfg, setCfg] = useState<MessengerOperatorConfig | null>(null);
  const [saved, setSaved] = useState('');
  const [openCh, setOpenCh] = useState<MessengerChannel | null>('whatsapp');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [question, setQuestion] = useState<Record<MessengerChannel, string>>({ whatsapp: '', telegram: '' });
  const [answer, setAnswer] = useState<Partial<Record<MessengerChannel, ConsultantTestReply>>>({});

  useEffect(() => {
    fetchMessengerOperatorConfig(agentId)
      .then((c) => {
        setCfg(c);
        setSaved(JSON.stringify(c));
      })
      .catch((e) => setMsg({ ok: false, text: e?.message || k('loadError') }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  if (!cfg) return <div className="e2-panel" style={{ padding: 18 }}>{msg?.text || '…'}</div>;

  const dirty = JSON.stringify(cfg) !== saved;
  const setChannel = (c: MessengerChannel, patch: Partial<MessengerOperatorConfig['channels'][MessengerChannel]>) =>
    setCfg({ ...cfg, channels: { ...cfg.channels, [c]: { ...cfg.channels[c], ...patch } } });
  const modeOf = (c: (typeof CHANNELS)[number]) =>
    !cfg.channels[c.key].enabled || autonomyMode === 'suggest' ? 'off' : autonomyMode === 'auto' && permissions?.[c.perm] ? 'auto' : 'draft';

  const save = async () => {
    setBusy('save');
    setMsg(null);
    try {
      const next = await updateMessengerOperatorConfig(agentId, cfg);
      setCfg(next);
      setSaved(JSON.stringify(next));
      setMsg({ ok: true, text: k('saved') });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || k('saveError') });
    } finally {
      setBusy('');
    }
  };

  const test = async (c: MessengerChannel) => {
    const q = question[c].trim();
    if (!q) return;
    setBusy(`test-${c}`);
    setMsg(null);
    setAnswer((a) => ({ ...a, [c]: undefined }));
    try {
      // проверяем на текущем (в т.ч. несохранённом) брифе канала
      const res = await testMessengerOperatorReply(agentId, c, q, cfg.channels[c].brief);
      setAnswer((a) => ({ ...a, [c]: res }));
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || k('testError') });
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="e2-col">
      <div className="e2-panel">
        <div className="e2-panel-hd">
          <div className="h">{k('channelsTitle')}</div>
        </div>
        <div className="ai-analyst-form">
          <p className="e2-hint" style={{ margin: 0, fontSize: 12.5, color: 'var(--fg-3)' }}>{k('channelsHint')}</p>
          {CHANNELS.map((c) => {
            const ch = cfg.channels[c.key];
            const isOpen = openCh === c.key;
            const mode = modeOf(c);
            const ans = answer[c.key];
            return (
              <div key={c.key} className="ai-msgop-ch" style={{ ['--ch' as string]: c.accent }}>
                <button type="button" className="ai-msgop-head" onClick={() => setOpenCh(isOpen ? null : c.key)} aria-expanded={isOpen}>
                  <span className="dot" />
                  <b>{c.name}</b>
                  <span className={`ai-msgop-state ${mode}`}>{k(`state.${mode}`)}</span>
                  <span className="chev">{isOpen ? '−' : '+'}</span>
                </button>
                {isOpen ? (
                  <div className="ai-msgop-body">
                    <label className="ai-analyst-row">
                      <input type="checkbox" checked={ch.enabled} onChange={(e) => setChannel(c.key, { enabled: e.target.checked })} />
                      {k('enable', { channel: c.name })}
                    </label>
                    <div className={`ai-chatop-mode ${mode}`}>
                      <b>{k(`mode.${mode}.t`)}</b>
                      <span>{k(`mode.${mode}.d`, { channel: c.name })}</span>
                    </div>
                    <div className="lbl">{k('briefTitle', { channel: c.name })}</div>
                    <textarea
                      className="ai-input ai-chatop-brief"
                      value={ch.brief}
                      maxLength={BRIEF_MAX}
                      rows={12}
                      placeholder={k(`briefPlaceholder.${c.key}`)}
                      onChange={(e) => setChannel(c.key, { brief: e.target.value })}
                    />
                    <div className="ai-chatop-count">
                      {ch.brief.length} / {BRIEF_MAX}
                    </div>
                    <div className="lbl">{k('testTitle')}</div>
                    <textarea
                      className="ai-input"
                      rows={2}
                      value={question[c.key]}
                      placeholder={k('testPlaceholder')}
                      onChange={(e) => setQuestion((q) => ({ ...q, [c.key]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          void test(c.key);
                        }
                      }}
                    />
                    <div className="ai-analyst-actions">
                      <button className="e2b gh sm" disabled={!question[c.key].trim() || !!busy} onClick={() => void test(c.key)}>
                        {busy === `test-${c.key}` ? k('testing') : k('testBtn')}
                      </button>
                      <Link className="e2b gh sm" to={c.inbox}>{k('openInbox', { channel: c.name })}</Link>
                    </div>
                    {ans ? (
                      <div className="ai-chatop-answer">
                        <div className="bubble">{ans.reply || '—'}</div>
                        {ans.handoff ? <div className="handoff">{k('wouldHandoff', { reason: ans.handoffReason || '' })}</div> : null}
                        <AiBookingTrace trace={ans.bookingTrace} />
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
          <div>
            <div className="lbl">{k('maxReplies')}</div>
            <input
              type="number"
              min={1}
              max={100}
              className="ai-input"
              style={{ maxWidth: 120 }}
              value={cfg.maxRepliesPerChat}
              onChange={(e) => setCfg({ ...cfg, maxRepliesPerChat: Number(e.target.value) || 1 })}
            />
          </div>
          <p className="e2-hint" style={{ margin: 0, fontSize: 12, color: 'var(--fg-3)' }}>
            {k('rulesNote')} <Link to="/ai-employees/knowledge">{k('knowledgeLink')}</Link>
          </p>
          {msg ? <div className={msg.ok ? 'ai-analyst-ok' : 'ai-analyst-err'}>{msg.text}</div> : null}
          <div className="ai-analyst-actions">
            <button className="e2b sm" disabled={!dirty || !!busy} onClick={() => void save()}>
              {busy === 'save' ? k('saving') : k('save')}
            </button>
          </div>
        </div>
      </div>
      <AiBookingPanel agentId={agentId} />
    </div>
  );
}
