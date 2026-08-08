// src/pages/automations/PendingApprovalsPage.tsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  fetchPendingApprovals,
  approveExecution,
  rejectExecution,
  type AutomationExecution,
} from '../../api/automations';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';

export const PendingApprovalsPage: React.FC = () => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const [items, setItems] = useState<AutomationExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      setItems(await fetchPendingApprovals());
    } catch (e: any) {
      showAlert(e?.message || t('crm.automations.approvals.errors.loadFailed'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const handleDecide = async (id: string, approve: boolean) => {
    setBusyId(id);
    try {
      if (approve) await approveExecution(id, notes[id]);
      else await rejectExecution(id, notes[id]);
      await load();
    } catch (e: any) {
      showAlert(e?.message || t('crm.automations.approvals.errors.decideFailed'), { variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const pendingStepLabel = (item: AutomationExecution): string => {
    const idx = item.pausedAtStep ?? 0;
    const action = item.automation && (item.automation as any).actions?.[idx];
    return action ? `#${idx + 1} · ${action.type}` : `#${idx + 1}`;
  };

  return (
    <MainLayout>
      <div className="space-y-5">
        <div className="page-header mb-0">
          <div>
            <h1 className="page-title">{t('crm.automations.approvals.title')}</h1>
            <p className="page-subtitle">{t('crm.automations.approvals.subtitle')}</p>
          </div>
          <Link to="/automations" className="btn-secondary">{t('crm.automations.approvals.back')}</Link>
        </div>

        {loading ? (
          <div className="text-sm text-text-secondary py-10 text-center">{t('crm.automations.approvals.loading')}</div>
        ) : items.length === 0 ? (
          <div className="card p-10 text-center text-sm text-text-secondary">
            {t('crm.automations.approvals.empty')}
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="card p-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Link to={`/automations/${item.automationId}`} className="font-medium text-[#111827] hover:underline">
                      {item.automation?.name || item.automationId}
                    </Link>
                    <p className="text-xs text-text-secondary mt-1">
                      {t('crm.automations.approvals.pendingStep', { step: pendingStepLabel(item) })}
                    </p>
                    <p className="text-[11px] text-text-tertiary mt-0.5">
                      {t('crm.automations.approvals.triggeredAt', { date: new Date(item.createdAt).toLocaleString() })}
                      {item.entityType ? ` · ${item.entityType}${item.entityId ? ` #${item.entityId.slice(0, 8)}` : ''}` : ''}
                    </p>
                  </div>
                </div>

                <input
                  className="input w-full text-xs"
                  placeholder={t('crm.automations.approvals.notePlaceholder')}
                  value={notes[item.id] || ''}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                />

                <div className="flex gap-2">
                  <button
                    className="btn-primary"
                    disabled={busyId === item.id}
                    onClick={() => handleDecide(item.id, true)}
                  >
                    {busyId === item.id ? t('crm.automations.approvals.deciding') : t('crm.automations.approvals.approve')}
                  </button>
                  <button
                    className="btn-danger"
                    disabled={busyId === item.id}
                    onClick={() => handleDecide(item.id, false)}
                  >
                    {t('crm.automations.approvals.reject')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
};
