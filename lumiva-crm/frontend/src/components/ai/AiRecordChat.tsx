import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { askAiEmployee, assignAiTask, fetchAiAssignableRoster, fetchAiPlanLimits, type AiAssignableRosterItem } from '../../api/aiEmployees';

type Turn = { role: 'user' | 'assistant' | 'note'; text: string };

/**
 * Чат с ИИ-сотрудником прямо в карточке лида/проекта: «Спросить» — только ответ по этой записи,
 * «Поручить» — ставит сотруднику задание по этой записи (результат — в комментариях записи).
 * Ответы на вопросы также сохраняются комментарием на записи (см. backend askAboutRecord).
 */
export function AiRecordChat({ entityType, entityId }: { entityType: 'lead' | 'project'; entityId: string | null | undefined }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState<AiAssignableRosterItem[] | null>(null);
  const [agentId, setAgentId] = useState('');
  const [text, setText] = useState('');
  const [thread, setThread] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);
  // Чат работает через раздел «ИИ-сотрудники» — без доступа к нему блок не показываем вовсе.
  // Проба идёт в тот же RBAC-эндпоинт (включая автодоступ руководителям отделов), а не в дубль логики прав.
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    fetchAiPlanLimits()
      .then(() => alive && setAllowed(true))
      .catch(() => alive && setAllowed(false));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!open || agents !== null) return;
    fetchAiAssignableRoster()
      .then((list) => {
        setAgents(list);
        const first = list.find((a) => a.status === 'active') ?? list[0];
        if (first) setAgentId(first.id);
      })
      .catch(() => setAgents([]));
  }, [open, agents]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [thread, busy]);

  if (!entityId || allowed !== true) return null;

  const agent = agents?.find((a) => a.id === agentId);
  const history = thread.filter((x): x is { role: 'user' | 'assistant'; text: string } => x.role !== 'note');

  const ask = async () => {
    const message = text.trim();
    if (!message || !agentId) return;
    setBusy(true);
    setError('');
    setThread((cur) => [...cur, { role: 'user', text: message }]);
    setText('');
    try {
      const res = await askAiEmployee(agentId, { message, entityType, entityId, history });
      setThread((cur) => [...cur, { role: 'assistant', text: res.answer }]);
    } catch (e: any) {
      setError(e?.message || t('crm.aiEmployees.errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  const assign = async () => {
    const task = text.trim();
    if (!task || !agentId) return;
    setBusy(true);
    setError('');
    try {
      await assignAiTask(agentId, { task, entityType, entityId, runNow: true });
      setThread((cur) => [...cur, { role: 'user', text: task }, { role: 'note', text: t('crm.aiEmployees.recordChat.taskSent', { name: agent?.name || '' }) }]);
      setText('');
    } catch (e: any) {
      setError(e?.message || t('crm.aiEmployees.errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        borderRadius: 8,
        border: '1px solid #e0d7f7',
        background: 'linear-gradient(135deg,#f7f3ff,#eef5ff)',
        padding: 8,
        marginTop: 8,
        whiteSpace: 'normal',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 0, padding: 0, cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#3b2a86' }}
      >
        <span aria-hidden>💬</span>
        {t('crm.aiEmployees.recordChat.title')}
        <span style={{ marginLeft: 'auto' }}>{open ? '▴' : '▾'}</span>
      </button>
      {open ? (
        agents === null ? (
          <div style={{ fontSize: 11, color: '#6b6b8a', marginTop: 6 }}>…</div>
        ) : (
          <div style={{ marginTop: 8 }}>
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              style={{ width: '100%', fontSize: 12, padding: '4px 6px', borderRadius: 6, border: '1px solid #d9d2f3', background: '#fff' }}
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.status !== 'active' ? ` (${t('crm.aiEmployees.recordChat.paused')})` : ''}
                </option>
              ))}
            </select>
            {thread.length > 0 ? (
              <div style={{ maxHeight: 260, overflowY: 'auto', margin: '8px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {thread.map((m, i) => (
                  <div
                    key={i}
                    style={{
                      alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '92%',
                      fontSize: 12,
                      lineHeight: 1.4,
                      padding: '6px 9px',
                      borderRadius: 10,
                      whiteSpace: 'pre-wrap',
                      background: m.role === 'user' ? '#5b3fd0' : m.role === 'note' ? '#fff8e6' : '#fff',
                      color: m.role === 'user' ? '#fff' : '#22203a',
                      border: m.role === 'user' ? 0 : '1px solid #e4dff5',
                    }}
                  >
                    {m.text}
                  </div>
                ))}
                {busy ? <div style={{ fontSize: 11, color: '#6b6b8a' }}>{t('crm.aiEmployees.recordChat.thinking')}</div> : null}
                <div ref={endRef} />
              </div>
            ) : null}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void ask();
              }}
              placeholder={t('crm.aiEmployees.recordChat.placeholder')}
              rows={3}
              style={{ width: '100%', marginTop: thread.length ? 0 : 8, fontSize: 12, padding: 6, borderRadius: 6, border: '1px solid #d9d2f3', resize: 'vertical', boxSizing: 'border-box' }}
            />
            {error ? <div style={{ fontSize: 11, color: '#b4232a', marginTop: 4 }}>{error}</div> : null}
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button type="button" className="btn btn-sm btn-primary" disabled={busy || !text.trim() || !agentId} onClick={() => void ask()}>
                {t('crm.aiEmployees.recordChat.ask')}
              </button>
              <button
                type="button"
                className="btn btn-sm"
                disabled={busy || !text.trim() || !agentId || agent?.status !== 'active'}
                title={agent?.status !== 'active' ? t('crm.aiEmployees.recordChat.needActive') : t('crm.aiEmployees.recordChat.assignHint')}
                onClick={() => void assign()}
              >
                {t('crm.aiEmployees.recordChat.assign')}
              </button>
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}
