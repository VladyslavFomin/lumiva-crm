import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { decideAiProposal, type AiChatProposal } from '../../api/ai';
import { notifyAiAssignmentsChanged } from './useAiAssignees';

/**
 * Рекомендация ассистента с кнопками «Одобрить / Отклонить». Одобрить = AI-сотрудник становится ответственным
 * за запись и сразу берёт задание в работу (дальше действует по своим правам и автономности).
 */
export function AiProposalCards({
  messageId,
  proposals,
  onUpdated,
}: {
  messageId: string;
  proposals: AiChatProposal[];
  onUpdated: (p: AiChatProposal) => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const decide = async (p: AiChatProposal, decision: 'approve' | 'reject') => {
    setBusy(`${p.id}:${decision}`);
    setError('');
    try {
      const res = await decideAiProposal(messageId, p.id, decision);
      onUpdated(res.proposal);
      if (decision === 'approve') notifyAiAssignmentsChanged();
    } catch (e: any) {
      setError(e?.message || t('crm.aiEmployees.errors.generic'));
    } finally {
      setBusy('');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
      {proposals.map((p) => (
        <div
          key={p.id}
          style={{
            border: '1px solid #ddd6fe',
            borderRadius: 12,
            padding: 12,
            background: 'linear-gradient(135deg,#faf7ff,#f1f6ff)',
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: '#5b3fd0', marginBottom: 4 }}>
            ✦ {t('crm.aiEmployees.proposal.label', { name: p.agentName })}
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#1f1b3a' }}>{p.title}</div>
          {p.entityLabel ? (
            <div style={{ fontSize: 12, color: '#5a5a78', marginTop: 2 }}>
              {t(`crm.aiEmployees.work.entity.${p.entityType}`, { defaultValue: '' })} · {p.entityLabel}
              {p.assign ? ` · ${t('crm.aiEmployees.proposal.willBeResponsible')}` : ''}
            </div>
          ) : null}
          <div style={{ fontSize: 12.5, color: '#3a3a55', marginTop: 6, whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{p.task}</div>
          {p.status === 'pending' ? (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => decide(p, 'approve')}
                style={{ padding: '7px 14px', borderRadius: 9, border: 0, background: '#1f1b3a', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}
              >
                {t('crm.aiEmployees.proposal.approve')}
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => decide(p, 'reject')}
                style={{ padding: '7px 14px', borderRadius: 9, border: '1px solid #d4d4e8', background: '#fff', color: '#1f1b3a', fontSize: 12.5, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}
              >
                {t('crm.aiEmployees.proposal.reject')}
              </button>
            </div>
          ) : (
            <div
              style={{
                marginTop: 10,
                fontSize: 12,
                fontWeight: 600,
                color: p.status === 'approved' ? '#1f8a5e' : '#8b8bad',
              }}
            >
              {p.status === 'approved' ? `✓ ${t('crm.aiEmployees.proposal.approved', { name: p.agentName })}` : t('crm.aiEmployees.proposal.rejected')}
            </div>
          )}
        </div>
      ))}
      {error ? <div style={{ fontSize: 12, color: '#9a1f31' }}>{error}</div> : null}
    </div>
  );
}
