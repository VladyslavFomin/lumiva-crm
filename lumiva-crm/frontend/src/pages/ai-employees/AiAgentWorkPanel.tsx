import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  assignAiTask,
  fetchAiAgentAssignments,
  fetchAiAgentTasks,
  setAiAssignment,
  type AiAgentAction,
  type AiAgentAssignmentItem,
} from '../../api/aiEmployees';

const cn = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

function recordPath(item: { entityType: string; entityId: string }): string | null {
  if (item.entityType === 'lead') return `/leads/${item.entityId}`;
  if (item.entityType === 'project') return `/projects/${item.entityId}`;
  return null;
}

/** Вкладка «Работа»: разовое задание с данными + записи, за которые этот ИИ отвечает. */
export function AiAgentWorkPanel({ agentId, agentActive }: { agentId: string; agentActive: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<AiAgentAction[]>([]);
  const [assignments, setAssignments] = useState<AiAgentAssignmentItem[]>([]);
  const [task, setTask] = useState('');
  const [priority, setPriority] = useState('medium');
  const [linked, setLinked] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [tk, as] = await Promise.all([fetchAiAgentTasks(agentId), fetchAiAgentAssignments(agentId)]);
      setTasks(tk.items);
      setAssignments(as.items);
    } catch {
      /* пустые списки — не критично */
    }
  }, [agentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (!task.trim()) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const ref = assignments.find((a) => a.id === linked);
      await assignAiTask(agentId, {
        task: task.trim(),
        priority,
        runNow: true,
        ...(ref ? { entityType: ref.entityType, entityId: ref.entityId } : {}),
      });
      setTask('');
      setNotice(t('crm.aiEmployees.work.sent'));
      await load();
    } catch (e: any) {
      setError(e?.message || t('crm.aiEmployees.errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  const unassign = async (a: AiAgentAssignmentItem) => {
    try {
      await setAiAssignment({ agentId, entityType: a.entityType, entityId: a.entityId, assigned: false });
      await load();
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="ai-form-card" style={{ marginBottom: 0 }}>
        <div className="fct">{t('crm.aiEmployees.work.taskTitle')}</div>
        <div className="fcd">{t('crm.aiEmployees.work.taskHint')}</div>
        <textarea
          className="ai-textarea"
          style={{ minHeight: 130 }}
          maxLength={4000}
          value={task}
          placeholder={t('crm.aiEmployees.work.taskPlaceholder')}
          onChange={(e) => setTask(e.target.value)}
        />
        <div className="ai-field-row" style={{ marginTop: 12 }}>
          <div className="ai-field" style={{ margin: 0 }}>
            <label className="ai-label">{t('crm.aiEmployees.work.priority')}</label>
            <select className="ai-select" value={priority} onChange={(e) => setPriority(e.target.value)}>
              {['low', 'medium', 'high', 'urgent'].map((p) => (
                <option key={p} value={p}>
                  {t(`crm.aiEmployees.work.priorities.${p}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="ai-field" style={{ margin: 0 }}>
            <label className="ai-label">{t('crm.aiEmployees.work.linkedRecord')}</label>
            <select className="ai-select" value={linked} onChange={(e) => setLinked(e.target.value)}>
              <option value="">{t('crm.aiEmployees.work.noRecord')}</option>
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {t(`crm.aiEmployees.work.entity.${a.entityType}`)} · {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
          <button className="aib" disabled={busy || !task.trim() || !agentActive} onClick={submit}>
            {t('crm.aiEmployees.work.submit')}
          </button>
          {!agentActive ? <span className="ai-hint">{t('crm.aiEmployees.work.notActive')}</span> : null}
          {notice ? <span className="ai-hint" style={{ color: '#1f8a5e' }}>{notice}</span> : null}
          {error ? <span className="ai-hint" style={{ color: '#9a1f31' }}>{error}</span> : null}
        </div>

        <div className="ai-grp" style={{ marginTop: 24 }}>
          {t('crm.aiEmployees.work.tasksList')} <span className="cnt">{tasks.length}</span>
        </div>
        {tasks.length === 0 ? (
          <div className="ai-hint">{t('crm.aiEmployees.work.tasksEmpty')}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tasks.map((tk) => (
              <div key={tk.id} className="ai-info-row" style={{ alignItems: 'flex-start' }}>
                <span className="v" style={{ textAlign: 'left', whiteSpace: 'pre-wrap' }}>
                  {tk.title}
                </span>
                <span className={cn('ai-st', tk.status === 'executed' ? 'active' : 'paused')}>
                  <span className="dot" />
                  {t(`crm.aiEmployees.work.taskStatus.${tk.status === 'executed' ? 'done' : 'queued'}`)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="ai-panel" style={{ alignSelf: 'start' }}>
        <div className="ai-panel-head">
          <div className="pt">{t('crm.aiEmployees.work.responsibleFor')}</div>
        </div>
        <div className="ai-panel-body">
          <p className="ai-hint" style={{ marginTop: 0 }}>{t('crm.aiEmployees.work.responsibleHint')}</p>
          {assignments.length === 0 ? (
            <div className="ai-hint">{t('crm.aiEmployees.work.responsibleEmpty')}</div>
          ) : (
            assignments.map((a) => {
              const path = recordPath(a);
              return (
                <div key={a.id} className="ai-info-row" style={{ gap: 10 }}>
                  <span className="k" style={{ minWidth: 70 }}>{t(`crm.aiEmployees.work.entity.${a.entityType}`)}</span>
                  <span className="v" style={{ flex: 1, textAlign: 'left' }}>
                    {path ? (
                      <a href={path} onClick={(e) => { e.preventDefault(); navigate(path); }} style={{ color: 'var(--ink)', textDecoration: 'underline' }}>
                        {a.name}
                      </a>
                    ) : (
                      a.name
                    )}
                    {a.status ? <span className="ai-auto" style={{ marginLeft: 8 }}>{a.status}</span> : null}
                  </span>
                  <button className="aib ghost sm" onClick={() => unassign(a)}>
                    {t('crm.aiEmployees.work.unassign')}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
