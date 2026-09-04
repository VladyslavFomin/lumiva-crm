// src/pages/leads/LeadAccessSettingsPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { fetchStaff, type StaffUser } from '../../api/staff';
import {
  fetchLeads,
  fetchLeadAccessGrants,
  createLeadAccessGrant,
  deleteLeadAccessGrant,
  type LeadAccessGrant,
  type LeadAccessScopeType,
  type LeadAccessTier,
} from '../../api/leads';
import { useAlertModal } from '../../contexts/AlertModalContext';

const TIERS: LeadAccessTier[] = ['viewer', 'analyst', 'editor', 'owner'];

export const LeadAccessSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showConfirm, showAlert } = useAlertModal();

  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [grants, setGrants] = useState<LeadAccessGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [staffUserId, setStaffUserId] = useState('');
  const [scopeType, setScopeType] = useState<LeadAccessScopeType>('all');
  const [scopeValue, setScopeValue] = useState('');
  const [tier, setTier] = useState<LeadAccessTier>('viewer');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setForbidden(false);

    Promise.all([fetchStaff(), fetchLeads(), fetchLeadAccessGrants()])
      .then(([staffList, leads, grantList]) => {
        if (!alive) return;
        setStaff(staffList.filter((u) => u.isActive));
        const distinctSources = Array.from(
          new Set(leads.map((l) => l.source).filter((s): s is string => Boolean(s && s.trim()))),
        ).sort((a, b) => a.localeCompare(b));
        setSources(distinctSources);
        setGrants(grantList);
      })
      .catch((e: any) => {
        if (!alive) return;
        if (e?.status === 403) {
          setForbidden(true);
        } else {
          setError(e.message || t('crm.leads.access.errorLoad'));
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const grantsByStaff = useMemo(() => {
    const map: Record<string, LeadAccessGrant[]> = {};
    grants.forEach((g) => {
      if (!map[g.staffUserId]) map[g.staffUserId] = [];
      map[g.staffUserId].push(g);
    });
    return map;
  }, [grants]);

  const tierLabel = (tr: LeadAccessTier) => t(`crm.leads.access.tiers.${tr}`);
  const tierHint = (tr: LeadAccessTier) => t(`crm.leads.access.tiers.${tr}Desc`);

  const handleAddGrant = async () => {
    if (!staffUserId) {
      showAlert(t('crm.leads.access.selectStaffFirst'));
      return;
    }
    if (scopeType === 'source' && !scopeValue.trim()) {
      showAlert(t('crm.leads.access.selectSourceFirst'));
      return;
    }
    setSaving(true);
    try {
      const created = await createLeadAccessGrant({
        staffUserId,
        scopeType,
        scopeValue: scopeType === 'source' ? scopeValue.trim() : null,
        tier,
      });
      setGrants((prev) => {
        const withoutDup = prev.filter(
          (g) =>
            !(
              g.staffUserId === created.staffUserId &&
              g.scopeType === created.scopeType &&
              g.scopeValue === created.scopeValue
            ),
        );
        return [created, ...withoutDup];
      });
      setScopeValue('');
    } catch (e: any) {
      showAlert(e.message || t('crm.leads.access.errorSave'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGrant = async (grant: LeadAccessGrant) => {
    const ok = await showConfirm(t('crm.leads.access.deleteConfirm'), {
      title: t('crm.leads.access.deleteConfirmTitle'),
      confirmLabel: t('crm.leads.access.deleteButton'),
      cancelLabel: t('crm.leads.access.cancel'),
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteLeadAccessGrant(grant.id);
      setGrants((prev) => prev.filter((g) => g.id !== grant.id));
    } catch (e: any) {
      showAlert(e.message || t('crm.leads.access.errorSave'));
    }
  };

  if (forbidden) {
    return (
      <MainLayout>
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm text-center space-y-3">
          <div className="text-sm font-semibold text-lumiva-accent">{t('crm.leads.access.pageTitle')}</div>
          <div className="text-xs text-slate-500">{t('crm.leads.access.forbiddenPage')}</div>
          <button
            type="button"
            onClick={() => navigate('/leads')}
            className="px-4 py-2 rounded-xl bg-lumiva-accent text-white text-xs font-semibold hover:bg-lumiva-accent-soft"
          >
            {t('crm.leads.access.backToLeads')}
          </button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageHelpButton topic="leads" />
      <div className="space-y-4">
        <div>
          <h1 className="text-lg font-semibold text-lumiva-accent">{t('crm.leads.access.pageTitle')}</h1>
          <p className="text-[11px] text-slate-600 max-w-[720px]">{t('crm.leads.access.pageSubtitle')}</p>
        </div>

        {error && (
          <div className="text-xs text-status-error bg-status-error-bg border border-red-200 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-lumiva-accent">{t('crm.leads.access.addGrantTitle')}</h2>

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-slate-500">{t('crm.leads.access.staffLabel')}</span>
              <select
                value={staffUserId}
                onChange={(e) => setStaffUserId(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-sky-400 min-w-[200px]"
              >
                <option value="">{t('crm.leads.access.staffPlaceholder')}</option>
                {staff.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-slate-500">{t('crm.leads.access.scopeLabel')}</span>
              <select
                value={scopeType}
                onChange={(e) => setScopeType(e.target.value as LeadAccessScopeType)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-sky-400 min-w-[180px]"
              >
                <option value="all">{t('crm.leads.access.scopeAll')}</option>
                <option value="source">{t('crm.leads.access.scopeSource')}</option>
              </select>
            </div>

            {scopeType === 'source' && (
              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-slate-500">{t('crm.leads.access.sourceLabel')}</span>
                <input
                  list="lead-access-sources"
                  value={scopeValue}
                  onChange={(e) => setScopeValue(e.target.value)}
                  placeholder={t('crm.leads.access.sourcePlaceholder')}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-sky-400 min-w-[180px]"
                />
                <datalist id="lead-access-sources">
                  {sources.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-slate-500">{t('crm.leads.access.tierLabel')}</span>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value as LeadAccessTier)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-sky-400 min-w-[160px]"
              >
                {TIERS.map((tr) => (
                  <option key={tr} value={tr}>
                    {tierLabel(tr)}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleAddGrant}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-lumiva-accent text-white text-xs font-semibold hover:bg-lumiva-accent-soft disabled:opacity-60"
            >
              {t('crm.leads.access.addButton')}
            </button>
          </div>

          <div className="text-[10px] text-slate-400 leading-relaxed max-w-[640px]">{tierHint(tier)}</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-lumiva-accent">{t('crm.leads.access.existingGrantsTitle')}</h2>

          {loading ? (
            <div className="text-xs text-slate-500">{t('crm.leads.access.loading')}</div>
          ) : staff.filter((u) => grantsByStaff[u.id]?.length).length === 0 ? (
            <div className="text-xs text-slate-500">{t('crm.leads.access.emptyGrants')}</div>
          ) : (
            <div className="space-y-3">
              {staff
                .filter((u) => grantsByStaff[u.id]?.length)
                .map((u) => (
                  <div key={u.id} className="border border-slate-100 rounded-2xl p-3">
                    <div className="text-xs font-semibold text-lumiva-accent mb-2">{u.fullName}</div>
                    <div className="space-y-1.5">
                      {grantsByStaff[u.id].map((g) => (
                        <div
                          key={g.id}
                          className="flex items-center justify-between gap-3 bg-slate-50 rounded-xl px-3 py-1.5"
                        >
                          <div className="text-xs text-slate-700">
                            {g.scopeType === 'all'
                              ? t('crm.leads.access.scopeAll')
                              : `${t('crm.leads.access.scopeSourceLabel')}: ${g.scopeValue}`}
                            {' — '}
                            <span className="font-medium">{tierLabel(g.tier)}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteGrant(g)}
                            className="text-[11px] text-status-error hover:underline"
                          >
                            {t('crm.leads.access.deleteButton')}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="text-[10px] text-slate-400 max-w-[640px]">{t('crm.leads.access.fullAccessNote')}</div>
      </div>
    </MainLayout>
  );
};
