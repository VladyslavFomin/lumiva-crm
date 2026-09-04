import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { Ic, TG_ICON } from './TelegramIcons';
import {
  updateTelegramBot,
  sendTelegramTestChat,
  type TelegramBot,
  type TelegramKnowledgeEntry,
  type TelegramAiFunctionToggles,
} from '../../api/telegram-crm';

const OPENAI_MODELS = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1', 'o3-mini'];
const FUNCTION_KEYS: Array<keyof TelegramAiFunctionToggles> = ['booking.availability', 'sale.read', 'helpdesk.ticket.read', 'file.send'];

function newId(): string { return `kb${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`; }

interface Props { bot: TelegramBot; onBotChange: (bot: TelegramBot) => void }

export const TelegramAiTab: React.FC<Props> = ({ bot, onBotChange }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const ai = bot.meta?.aiConnector || {};

  const [model, setModel] = useState(ai.model || 'gpt-4o-mini');
  const [temperature, setTemperature] = useState(typeof ai.temperature === 'number' ? ai.temperature : 0.3);
  const [systemPrompt, setSystemPrompt] = useState(ai.systemPrompt || '');
  const [kb, setKb] = useState<TelegramKnowledgeEntry[]>(ai.knowledgeBase || []);
  const [functions, setFunctions] = useState<TelegramAiFunctionToggles>(ai.functions || {});
  const [stopWords, setStopWords] = useState((ai.escalation?.stopWords || []).join(', '));
  const [repeatThreshold, setRepeatThreshold] = useState(ai.escalation?.repeatThreshold ?? 2);
  const [department, setDepartment] = useState(ai.escalation?.department || '');
  const [pauseMinutes, setPauseMinutes] = useState(ai.escalation?.pauseMinutes ?? 30);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const a = bot.meta?.aiConnector || {};
    setModel(a.model || 'gpt-4o-mini');
    setTemperature(typeof a.temperature === 'number' ? a.temperature : 0.3);
    setSystemPrompt(a.systemPrompt || '');
    setKb(a.knowledgeBase || []);
    setFunctions(a.functions || {});
    setStopWords((a.escalation?.stopWords || []).join(', '));
    setRepeatThreshold(a.escalation?.repeatThreshold ?? 2);
    setDepartment(a.escalation?.department || '');
    setPauseMinutes(a.escalation?.pauseMinutes ?? 30);
  }, [bot.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [history, setHistory] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([]);
  const [draft, setDraft] = useState('');
  const [trace, setTrace] = useState<Array<{ step: string; detail: string; ms: number }>>([]);
  const [testing, setTesting] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const updated = await updateTelegramBot(bot.id, {
        meta: {
          aiConnector: {
            model, temperature, systemPrompt, knowledgeBase: kb, functions,
            escalation: { stopWords: stopWords.split(',').map((s) => s.trim()).filter(Boolean), repeatThreshold, department, pauseMinutes },
          },
        },
      });
      onBotChange(updated);
      showAlert(t('crm.telegram.ai.saved'), { variant: 'success' });
    } catch (e: any) {
      showAlert(e.message || t('crm.telegram.errors.saveFailed'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const addKbEntry = () => setKb((prev) => [...prev, { id: newId(), name: t('crm.telegram.ai.newSourceName'), kind: 'text', content: '' }]);
  const removeKbEntry = (id: string) => setKb((prev) => prev.filter((k) => k.id !== id));

  const runTest = async () => {
    if (!draft.trim()) return;
    setTesting(true);
    const message = draft.trim();
    setHistory((prev) => [...prev, { role: 'user', text: message }]);
    setDraft('');
    try {
      const res = await sendTelegramTestChat(bot.id, { history, message });
      setHistory((prev) => [...prev, { role: 'assistant', text: res.reply || t('crm.telegram.ai.noReply') }]);
      setTrace(res.trace || []);
    } catch (e: any) {
      showAlert(e.message || t('crm.telegram.errors.saveFailed'), { variant: 'error' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="tg-split wide">
      <div>
        <div className="tg-card" style={{ marginBottom: 16 }}>
          <div className="tg-card-head">
            <div><h3><Ic d={TG_ICON.ai} size={15} />{t('crm.telegram.ai.modelTitle')}</h3><div className="sub">{t('crm.telegram.ai.modelSubtitle')}</div></div>
          </div>
          <div className="tg-card-body">
            <div className="tg-row2">
              <div className="tg-field">
                <span className="tg-label">{t('crm.telegram.ai.model')}</span>
                <select className="tg-select" value={model} onChange={(e) => setModel(e.target.value)}>
                  {OPENAI_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="tg-field">
                <span className="tg-label">{t('crm.telegram.ai.temperature')} · {temperature.toFixed(1)}</span>
                <input type="range" min={0} max={1} step={0.1} value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} style={{ width: '100%' }} />
                <div className="hint">{t('crm.telegram.ai.temperatureHint')}</div>
              </div>
            </div>
            <div className="tg-field" style={{ marginBottom: 0 }}>
              <span className="tg-label">{t('crm.telegram.ai.systemPrompt')}</span>
              <textarea className="tg-area" style={{ minHeight: 110 }} value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} placeholder={t('crm.telegram.ai.systemPromptPlaceholder') || ''} />
            </div>
          </div>
        </div>

        <div className="tg-card" style={{ marginBottom: 16 }}>
          <div className="tg-card-head"><div><h3><Ic d={TG_ICON.book} size={15} />{t('crm.telegram.ai.kbTitle')}</h3><div className="sub">{t('crm.telegram.ai.kbSubtitle')}</div></div><button className="btn btn-sm" onClick={addKbEntry}><Ic d={TG_ICON.plus} size={12} />{t('crm.telegram.ai.addSource')}</button></div>
          <div className="tg-card-body">
            {kb.length === 0 && <div className="tg-empty">{t('crm.telegram.ai.kbEmpty')}</div>}
            {kb.map((k) => (
              <div key={k.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--line-3)' }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <input className="tg-input" style={{ flex: 1 }} value={k.name} onChange={(e) => setKb((prev) => prev.map((x) => (x.id === k.id ? { ...x, name: e.target.value } : x)))} />
                  <button className="btn btn-sm" onClick={() => removeKbEntry(k.id)}><Ic d={TG_ICON.trash} size={13} /></button>
                </div>
                <textarea className="tg-area" style={{ minHeight: 60 }} value={k.content} onChange={(e) => setKb((prev) => prev.map((x) => (x.id === k.id ? { ...x, content: e.target.value } : x)))} placeholder={t('crm.telegram.ai.kbPlaceholder') || ''} />
              </div>
            ))}
          </div>
        </div>

        <div className="tg-card" style={{ marginBottom: 16 }}>
          <div className="tg-card-head"><div><h3><Ic d={TG_ICON.hook} size={15} />{t('crm.telegram.ai.functionsTitle')}</h3><div className="sub">{t('crm.telegram.ai.functionsSubtitle')}</div></div></div>
          <div className="tg-card-body">
            {FUNCTION_KEYS.map((key) => (
              <div key={key} className="tg-toggle-row">
                <div style={{ flex: 1 }}>
                  <div className="t" style={{ fontFamily: 'var(--ff-mono)', fontSize: 12 }}>{key}</div>
                  <div className="d">{t(`crm.telegram.ai.functions.${key.replace(/\./g, '_')}`)}</div>
                </div>
                <div className={`tg-switch ${functions[key] ? 'on' : ''}`} onClick={() => setFunctions((prev) => ({ ...prev, [key]: !prev[key] }))}><i /></div>
              </div>
            ))}
          </div>
        </div>

        <div className="tg-card">
          <div className="tg-card-head"><div><h3><Ic d={TG_ICON.human} size={15} />{t('crm.telegram.ai.escalationTitle')}</h3><div className="sub">{t('crm.telegram.ai.escalationSubtitle')}</div></div></div>
          <div className="tg-card-body">
            <div className="tg-field"><span className="tg-label">{t('crm.telegram.ai.stopWords')}</span><input className="tg-input" value={stopWords} onChange={(e) => setStopWords(e.target.value)} placeholder={t('crm.telegram.ai.stopWordsPlaceholder') || ''} /></div>
            <div className="tg-row2">
              <div className="tg-field"><span className="tg-label">{t('crm.telegram.ai.repeatThreshold')}</span><input className="tg-input mono" type="number" value={repeatThreshold} onChange={(e) => setRepeatThreshold(Number(e.target.value))} /></div>
              <div className="tg-field"><span className="tg-label">{t('crm.telegram.ai.pauseMinutes')}</span><input className="tg-input mono" type="number" value={pauseMinutes} onChange={(e) => setPauseMinutes(Number(e.target.value))} /></div>
            </div>
            <div className="tg-field" style={{ marginBottom: 0 }}><span className="tg-label">{t('crm.telegram.ai.department')}</span><input className="tg-input" value={department} onChange={(e) => setDepartment(e.target.value)} /></div>
            <button className="btn btn-sm btn-primary" style={{ marginTop: 14 }} disabled={busy} onClick={save}><Ic d={TG_ICON.check} size={13} />{t('crm.telegram.ai.save')}</button>
          </div>
        </div>
      </div>

      <div>
        <div className="tg-card" style={{ marginBottom: 16 }}>
          <div className="tg-card-head"><div><h3><Ic d={TG_ICON.eye} size={15} />{t('crm.telegram.ai.testTitle')}</h3><div className="sub">{t('crm.telegram.ai.testSubtitle')}</div></div></div>
          <div className="tg-card-body">
            <div className="tg-preview">
              <div className="tg-preview-head">
                <div className="ava">{(bot.botName || '??').slice(0, 2).toUpperCase()}</div>
                <div style={{ flex: 1 }}><div className="nm">{bot.botName}</div><div className="st">bot · {t('crm.telegram.ai.testOnline')}</div></div>
              </div>
              <div className="tg-msgs">
                {history.length === 0 && <div style={{ fontSize: 11.5, color: 'var(--fg-3)', textAlign: 'center', padding: '10px 0' }}>{t('crm.telegram.ai.testEmpty')}</div>}
                {history.map((m, i) => <div key={i} className={`tg-msg ${m.role === 'user' ? 'out' : 'in'}`}>{m.text}</div>)}
              </div>
              <div className="tg-preview-input">
                <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t('crm.telegram.ai.testPlaceholder') || ''} onKeyDown={(e) => e.key === 'Enter' && runTest()} disabled={testing} />
                <button onClick={runTest} disabled={testing || !draft.trim()}><Ic d={TG_ICON.send} size={14} /></button>
              </div>
            </div>
          </div>
        </div>

        <div className="tg-card">
          <div className="tg-card-head"><div><h3><Ic d={TG_ICON.bolt} size={15} />{t('crm.telegram.ai.traceTitle')}</h3><div className="sub">{t('crm.telegram.ai.traceSubtitle')}</div></div></div>
          <div className="tg-card-body">
            {trace.length === 0 ? (
              <div className="tg-empty">{t('crm.telegram.ai.traceEmpty')}</div>
            ) : (
              <div className="tg-trace">
                {trace.map((s, i) => <div key={i} className="step"><b>{i + 1} · {s.ms}{t('crm.telegram.ai.msShort')}</b><span>{s.step}: {s.detail}</span></div>)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
