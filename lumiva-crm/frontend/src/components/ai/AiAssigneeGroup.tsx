import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { notifyAiAssignmentsChanged } from './useAiAssignees';
import {
  fetchAiAssignableRoster,
  fetchAiAssignments,
  fetchAiRoles,
  setAiAssignment,
  type AiAssignableRosterItem,
  type AiAssignableEntityType,
  type AiEmployeeRole,
} from '../../api/aiEmployees';

/**
 * Блок «ИИ-сотрудники» внутри карточки ответственных (лид / проект / задача компании).
 * Назначение ИИ хранится отдельно от списка сотрудников и применяется сразу — без общей кнопки «Сохранить»:
 * ИИ немедленно берёт запись в работу (см. backend setEntityAssignment).
 *
 * Не любой активный сотрудник годится: роль определяет, за какими записями он может числиться
 * ответственным (маркетолог не подменяет менеджера по лидам) — см. role.assignableEntityTypes.
 * Это фильтруется и здесь (для удобства), и на бэкенде (для безопасности).
 */
export function AiAssigneeGroup({
  entityType,
  entityId,
  compact = false,
}: {
  entityType: AiAssignableEntityType;
  entityId: string | null | undefined;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [allAgents, setAllAgents] = useState<AiAssignableRosterItem[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [suggestedRole, setSuggestedRole] = useState<AiEmployeeRole | null | undefined>(undefined); // undefined = not looked up yet

  const load = useCallback(async () => {
    try {
      setAllAgents(await fetchAiAssignableRoster());
    } catch {
      setAllAgents([]);
    }
    if (entityId) {
      try {
        const res = await fetchAiAssignments(entityType, entityId);
        setSelected(new Set(res.items.map((i) => i.agentId)));
      } catch {
        /* нет назначений */
      }
    }
  }, [entityId, entityType]);

  useEffect(() => {
    void load();
  }, [load]);

  const eligible = (allAgents ?? []).filter((a) => a.roleAssignableEntityTypes?.includes(entityType));
  const eligibleActive = eligible.filter((a) => a.status === 'active');
  const noEligibleRole = allAgents !== null && eligible.length === 0;

  // Никто из существующих сотрудников не подходит по роли — предложим, кого именно завести.
  useEffect(() => {
    if (!noEligibleRole || suggestedRole !== undefined) return;
    fetchAiRoles()
      .then((roles) => {
        const candidates = roles.filter((r) => r.assignableEntityTypes?.includes(entityType));
        setSuggestedRole(candidates.find((r) => r.available) ?? candidates[0] ?? null);
      })
      .catch(() => setSuggestedRole(null));
  }, [noEligibleRole, suggestedRole, entityType]);

  // Ни одного ИИ-сотрудника в компании ещё не заводили — блок не показываем вовсе (не засоряем карточку).
  if (allAgents !== null && allAgents.length === 0) return null;

  const allPaused = allAgents !== null && eligible.length > 0 && eligibleActive.length === 0;

  const toggle = async (agent: AiAssignableRosterItem, next: boolean) => {
    if (!entityId) return;
    setBusyId(agent.id);
    setError('');
    try {
      await setAiAssignment({ agentId: agent.id, entityType, entityId, assigned: next });
      setSelected((prev) => {
        const copy = new Set(prev);
        if (next) copy.add(agent.id);
        else copy.delete(agent.id);
        return copy;
      });
      notifyAiAssignmentsChanged();
    } catch (e: any) {
      setError(e?.message || t('crm.aiEmployees.errors.generic'));
    } finally {
      setBusyId('');
    }
  };

  return (
    <div
      style={{
        borderRadius: 8,
        border: '1px solid #e0d7f7',
        background: 'linear-gradient(135deg,#f7f3ff,#eef5ff)',
        padding: 8,
        marginTop: compact ? 8 : 0,
        // Этот блок часто вставляют внутрь однострочных ячеек таблиц (white-space: nowrap на <td>),
        // а всплывающее окно позиционируется через position:fixed — визуально оно уже вне ячейки,
        // но по DOM всё ещё её потомок, так что nowrap наследуется и текст подсказки утекает за край
        // окна вместо переноса. Сбрасываем явно, а не полагаемся на предка.
        whiteSpace: 'normal',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: '#3b2a86', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span aria-hidden>✦</span>
        {t('crm.aiEmployees.assignee.title')}
      </div>
      {!entityId ? (
        <div style={{ fontSize: 11, color: '#6b6b8a' }}>{t('crm.aiEmployees.assignee.saveFirst')}</div>
      ) : allAgents === null ? (
        <div style={{ fontSize: 11, color: '#6b6b8a' }}>…</div>
      ) : noEligibleRole ? (
        <div style={{ fontSize: 11, color: '#6b6b8a', lineHeight: 1.4 }}>
          {t('crm.aiEmployees.assignee.noEligible')}{' '}
          {suggestedRole ? (
            <button
              type="button"
              onClick={() => navigate(`/ai-employees/new?role=${suggestedRole.key}`)}
              style={{ background: 'none', border: 0, padding: 0, font: 'inherit', color: '#5b3fd0', textDecoration: 'underline', cursor: 'pointer' }}
            >
              {t('crm.aiEmployees.assignee.noEligibleLink', { role: suggestedRole.shortTitle })}
            </button>
          ) : null}
        </div>
      ) : allPaused ? (
        <div style={{ fontSize: 11, color: '#6b6b8a', lineHeight: 1.4 }}>
          {t('crm.aiEmployees.assignee.allPaused')}{' '}
          <button
            type="button"
            onClick={() => navigate('/ai-employees')}
            style={{ background: 'none', border: 0, padding: 0, font: 'inherit', color: '#5b3fd0', textDecoration: 'underline', cursor: 'pointer' }}
          >
            {t('crm.aiEmployees.assignee.allPausedLink')}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {eligibleActive.map((a) => (
            <label
              key={a.id}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 11, color: '#3a3a55', cursor: 'pointer', padding: '3px 0', lineHeight: 1.35 }}
            >
              <input
                type="checkbox"
                className="lv-checkbox-input"
                checked={selected.has(a.id)}
                disabled={busyId === a.id}
                onChange={(e) => toggle(a, e.target.checked)}
                style={{ marginTop: 2, flexShrink: 0 }}
              />
              <span style={{ minWidth: 0, wordBreak: 'break-word' }}>
                {a.name} <span style={{ color: '#8b8bad' }}>· {a.roleShortTitle || t('crm.aiEmployees.assignee.badge')}</span>
              </span>
            </label>
          ))}
        </div>
      )}
      {error ? <div style={{ fontSize: 11, color: '#9a1f31', marginTop: 4 }}>{error}</div> : null}
      <div style={{ fontSize: 10, color: '#8b8bad', marginTop: 6, lineHeight: 1.4 }}>{t('crm.aiEmployees.assignee.hint')}</div>
    </div>
  );
}
