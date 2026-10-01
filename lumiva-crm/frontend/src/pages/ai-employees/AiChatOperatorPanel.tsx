/**
 * ИИ-онлайн-консультант: бриф владельца (услуги, цены, условия), лимиты и проверка ответа
 * на тестовый вопрос. Сами ответы в чате сайта пишет бэкенд OnlineChatAiService.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AiBookingPanel, AiBookingTrace } from './AiBookingPanel';
import { Link } from 'react-router-dom';
import {
  fetchChatOperatorConfig,
  testChatOperatorReply,
  updateChatOperatorConfig,
  type ChatOperatorConfig,
  type ConsultantTestReply,
} from '../../api/aiEmployees';

const BRIEF_MAX = 12000;

export function AiChatOperatorPanel({
  agentId,
  autonomyMode,
  canReply,
}: {
  agentId: string;
  autonomyMode: string;
  /** Право reply_online_chat включено в «Доступах». */
  canReply: boolean;
}) {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.aiEmployees.chatOperator.${key}`, o) as string;
  const [cfg, setCfg] = useState<ChatOperatorConfig | null>(null);
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<ConsultantTestReply | null>(null);

  useEffect(() => {
    fetchChatOperatorConfig(agentId)
      .then((c) => {
        setCfg(c);
        setSaved(JSON.stringify(c));
      })
      .catch((e) => setMsg({ ok: false, text: e?.message || k('loadError') }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  if (!cfg) return <div className="e2-panel" style={{ padding: 18 }}>{msg?.text || '…'}</div>;

  const dirty = JSON.stringify(cfg) !== saved;
  const mode = autonomyMode === 'suggest' ? 'off' : autonomyMode === 'auto' && canReply ? 'auto' : 'draft';

  const save = async () => {
    setBusy('save');
    setMsg(null);
    try {
      const next = await updateChatOperatorConfig(agentId, cfg);
      setCfg(next);
      setSaved(JSON.stringify(next));
      setMsg({ ok: true, text: k('saved') });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || k('saveError') });
    } finally {
      setBusy('');
    }
  };

  const test = async () => {
    if (!question.trim()) return;
    setBusy('test');
    setAnswer(null);
    setMsg(null);
    try {
      // проверяем на текущем (в т.ч. несохранённом) брифе
      setAnswer(await testChatOperatorReply(agentId, question.trim(), cfg.brief));
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || k('testError') });
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="e2-grid2">
      <div className="e2-col">
        <div className="e2-panel">
          <div className="e2-panel-hd">
            <div className="h">{k('briefTitle')}</div>
          </div>
          <div className="ai-analyst-form">
            <p className="e2-hint" style={{ margin: 0, fontSize: 12.5, color: 'var(--fg-3)' }}>{k('briefHint')}</p>
            <textarea
              className="ai-input ai-chatop-brief"
              value={cfg.brief}
              maxLength={BRIEF_MAX}
              rows={18}
              placeholder={k('briefPlaceholder')}
              onChange={(e) => setCfg({ ...cfg, brief: e.target.value })}
            />
            <div className="ai-chatop-count">
              {cfg.brief.length} / {BRIEF_MAX}
            </div>
            <p className="e2-hint" style={{ margin: 0, fontSize: 12, color: 'var(--fg-3)' }}>
              {k('sourcesHint')} <Link to="/ai-employees/knowledge">{k('knowledgeLink')}</Link>
            </p>
          </div>
        </div>
      </div>
      <div className="e2-col">
        <div className="e2-panel">
          <div className="e2-panel-hd">
            <div className="h">{k('modeTitle')}</div>
          </div>
          <div className="ai-analyst-form">
            <div className={`ai-chatop-mode ${mode}`}>
              <b>{k(`mode.${mode}.t`)}</b>
              <span>{k(`mode.${mode}.d`)}</span>
            </div>
            <label className="ai-analyst-row">
              <input type="checkbox" checked={cfg.collectContacts} onChange={(e) => setCfg({ ...cfg, collectContacts: e.target.checked })} />
              {k('collectContacts')}
            </label>
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
            <p className="e2-hint" style={{ margin: 0, fontSize: 12, color: 'var(--fg-3)' }}>{k('humanNote')}</p>
            {msg ? <div className={msg.ok ? 'ai-analyst-ok' : 'ai-analyst-err'}>{msg.text}</div> : null}
            <div className="ai-analyst-actions">
              <button className="e2b sm" disabled={!dirty || !!busy} onClick={() => void save()}>
                {busy === 'save' ? k('saving') : k('save')}
              </button>
              <Link className="e2b gh sm" to="/chat">
                {k('openInbox')}
              </Link>
            </div>
          </div>
        </div>
        <div className="e2-panel">
          <div className="e2-panel-hd">
            <div className="h">{k('testTitle')}</div>
          </div>
          <div className="ai-analyst-form">
            <p className="e2-hint" style={{ margin: 0, fontSize: 12.5, color: 'var(--fg-3)' }}>{k('testHint')}</p>
            <textarea
              className="ai-input"
              rows={3}
              value={question}
              placeholder={k('testPlaceholder')}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void test();
                }
              }}
            />
            <div className="ai-analyst-actions">
              <button className="e2b gh sm" disabled={!question.trim() || !!busy} onClick={() => void test()}>
                {busy === 'test' ? k('testing') : k('testBtn')}
              </button>
            </div>
            {answer ? (
              <div className="ai-chatop-answer">
                <div className="bubble">{answer.reply || '—'}</div>
                {answer.handoff ? <div className="handoff">{k('wouldHandoff', { reason: answer.handoffReason || '' })}</div> : null}
                <AiBookingTrace trace={answer.bookingTrace} />
              </div>
            ) : null}
          </div>
        </div>
        <AiBookingPanel agentId={agentId} />
      </div>
    </div>
  );
}
