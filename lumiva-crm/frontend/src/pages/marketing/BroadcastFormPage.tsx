// src/pages/marketing/BroadcastFormPage.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  fetchBroadcast,
  createBroadcast,
  updateBroadcast,
  scheduleBroadcast,
  type MarketingBroadcast,
  type BroadcastChannel,
  type BroadcastStep,
} from '../../api/marketing-broadcasts';
import { fetchSegments, type MarketingSegment } from '../../api/marketing';
import { fetchEmailAccounts, type EmailAccount } from '../../api/email';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { useAlertModal } from '../../contexts/AlertModalContext';

const emptyStep = (order: number): BroadcastStep => ({ order, delayDays: order === 0 ? 0 : 3, subject: '', body: '' });

export const BroadcastFormPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const { showAlert } = useAlertModal();

  const [broadcast, setBroadcast] = useState<MarketingBroadcast | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  const [name, setName] = useState('');
  const [channel, setChannel] = useState<BroadcastChannel>('email');
  const [segmentId, setSegmentId] = useState<string>('');
  const [fromEmailAccountId, setFromEmailAccountId] = useState('');
  const [trackOpens, setTrackOpens] = useState(false);
  const [steps, setSteps] = useState<BroadcastStep[]>([emptyStep(0)]);

  const [segments, setSegments] = useState<MarketingSegment[]>([]);
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);

  const [sendMode, setSendMode] = useState<'now' | 'later'>('now');
  const [sendAt, setSendAt] = useState('');

  useEffect(() => {
    fetchSegments().then(setSegments).catch(() => setSegments([]));
    fetchEmailAccounts().then(setEmailAccounts).catch(() => setEmailAccounts([]));
  }, []);

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    fetchBroadcast(id!)
      .then((b) => {
        setBroadcast(b);
        setName(b.name);
        setChannel(b.channel);
        setSegmentId(b.segmentId || '');
        setFromEmailAccountId(b.fromEmailAccountId || '');
        setTrackOpens(b.trackOpens);
        setSteps(b.steps.length ? b.steps : [emptyStep(0)]);
      })
      .catch((e) => showAlert(e?.message || t('crm.marketingBroadcasts.form.errors.loadFailed'), { variant: 'error' }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const isDraft = !broadcast || broadcast.status === 'draft';

  const updateStep = (idx: number, patch: Partial<BroadcastStep>) => {
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const addStep = () => setSteps((prev) => [...prev, emptyStep(prev.length)]);
  const removeStep = (idx: number) => setSteps((prev) => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i })));

  const buildDto = () => ({
    name: name.trim(),
    channel,
    segmentId: segmentId || null,
    fromEmailAccountId: channel === 'email' ? (fromEmailAccountId || null) : null,
    trackOpens: channel === 'email' ? trackOpens : false,
    steps,
  });

  const handleSave = async () => {
    if (!name.trim()) { showAlert(t('crm.marketingBroadcasts.form.errors.nameRequired'), { variant: 'error' }); return; }
    setSaving(true);
    try {
      const dto = buildDto();
      const saved = isNew ? await createBroadcast(dto) : await updateBroadcast(id!, dto);
      setBroadcast(saved);
      if (isNew) navigate(`/marketing/broadcasts/${saved.id}`, { replace: true });
    } catch (e: any) {
      showAlert(e?.message || t('crm.marketingBroadcasts.form.errors.saveFailed'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSchedule = async () => {
    if (!broadcast) return;
    setScheduling(true);
    try {
      const dto = buildDto();
      await updateBroadcast(broadcast.id, dto);
      const scheduledAt = sendMode === 'later' && sendAt ? new Date(sendAt).toISOString() : null;
      const updated = await scheduleBroadcast(broadcast.id, scheduledAt);
      setBroadcast(updated);
      showAlert(
        t(sendMode === 'now' ? 'crm.marketingBroadcasts.form.success.sent' : 'crm.marketingBroadcasts.form.success.scheduled'),
        { variant: 'success' },
      );
    } catch (e: any) {
      showAlert(e?.message || t('crm.marketingBroadcasts.form.errors.scheduleFailed'), { variant: 'error' });
    } finally {
      setScheduling(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="text-sm text-text-secondary py-10 text-center">{t('crm.marketingBroadcasts.form.loading')}</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageHelpButton topic="marketingBroadcasts" />
      <div className="space-y-6 max-w-3xl">
        <div className="page-header mb-0">
          <div>
            <h1 className="page-title">{isNew ? t('crm.marketingBroadcasts.form.titleNew') : name || t('crm.marketingBroadcasts.form.titleNew')}</h1>
            <p className="page-subtitle">
              {broadcast ? t('crm.marketingBroadcasts.form.subtitleStatus', { status: broadcast.status }) : t('crm.marketingBroadcasts.form.subtitleNew')}
            </p>
          </div>
          <Link to="/marketing/broadcasts" className="btn-secondary">{t('crm.marketingBroadcasts.form.back')}</Link>
        </div>

        <div className="card p-5 space-y-5">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('crm.marketingBroadcasts.form.fieldName')}</label>
            <input
              className="input w-full"
              value={name}
              disabled={!isDraft}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('crm.marketingBroadcasts.form.fieldNamePlaceholder')}
            />
          </div>

          <div>
            <p className="section-label">{t('crm.marketingBroadcasts.form.channelLabel')}</p>
            <div className="grid grid-cols-2 gap-2">
              {(['email', 'sms'] as BroadcastChannel[]).map((ch) => (
                <button
                  key={ch}
                  disabled={!isDraft}
                  onClick={() => setChannel(ch)}
                  className={`text-left rounded-xl border px-3 py-3 transition-all ${
                    channel === ch ? 'border-[#111827] bg-surface-subtle ring-1 ring-[#111827]' : 'border-border-default hover:border-border-strong'
                  }`}
                >
                  <span className="text-sm font-semibold text-[#111827] uppercase">{ch}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('crm.marketingBroadcasts.form.audienceLabel')}</label>
            <select className="input w-full" value={segmentId} disabled={!isDraft} onChange={(e) => setSegmentId(e.target.value)}>
              <option value="">
                {t(channel === 'email' ? 'crm.marketingBroadcasts.form.audienceAllEmail' : 'crm.marketingBroadcasts.form.audienceAllPhone')}
              </option>
              {segments.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <p className="text-[11px] text-text-tertiary mt-1.5">{t('crm.marketingBroadcasts.form.audienceHint')}</p>
          </div>

          {channel === 'email' && (
            <>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('crm.marketingBroadcasts.form.fromLabel')}</label>
                <select className="input w-full" value={fromEmailAccountId} disabled={!isDraft} onChange={(e) => setFromEmailAccountId(e.target.value)}>
                  <option value="">{t('crm.marketingBroadcasts.form.fromPlaceholder')}</option>
                  {emailAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name || a.email}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between py-1">
                <p className="text-sm font-medium text-[#111827]">{t('crm.marketingBroadcasts.form.trackOpensLabel')}</p>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={trackOpens} disabled={!isDraft} onChange={(e) => setTrackOpens(e.target.checked)} />
                  <div className="w-10 h-5 bg-border-strong rounded-full peer peer-checked:bg-[#111827] transition-colors" />
                  <div className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-5 shadow-sm" />
                </label>
              </div>
            </>
          )}
        </div>

        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="section-label mb-0">{t('crm.marketingBroadcasts.form.stepsHeading')}</p>
            {isDraft && (
              <button onClick={addStep} className="text-xs font-medium text-[#111827] hover:underline">
                {t('crm.marketingBroadcasts.form.addStep')}
              </button>
            )}
          </div>
          <p className="text-[11px] text-text-tertiary -mt-2">{t('crm.marketingBroadcasts.form.stepsHint')}</p>

          {steps.map((step, idx) => (
            <div key={idx} className="rounded-xl border border-border-default p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[#111827]">{t('crm.marketingBroadcasts.form.stepLabel', { n: idx + 1 })}</span>
                {isDraft && steps.length > 1 && (
                  <button onClick={() => removeStep(idx)} className="text-xs text-status-error hover:underline">
                    {t('crm.marketingBroadcasts.form.removeStep')}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-[120px_1fr] gap-3 items-center">
                <label className="text-xs text-text-secondary">{t('crm.marketingBroadcasts.form.delayDaysLabel')}</label>
                <input
                  type="number"
                  min={0}
                  className="input"
                  value={step.delayDays}
                  disabled={!isDraft}
                  onChange={(e) => updateStep(idx, { delayDays: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                />
              </div>
              {channel === 'email' && (
                <input
                  className="input w-full"
                  placeholder={t('crm.marketingBroadcasts.form.subjectPlaceholder')}
                  value={step.subject || ''}
                  disabled={!isDraft}
                  onChange={(e) => updateStep(idx, { subject: e.target.value })}
                />
              )}
              <textarea
                className="input w-full min-h-[100px]"
                placeholder={t(channel === 'email' ? 'crm.marketingBroadcasts.form.bodyPlaceholderEmail' : 'crm.marketingBroadcasts.form.bodyPlaceholderSms')}
                value={step.body}
                disabled={!isDraft}
                onChange={(e) => updateStep(idx, { body: e.target.value })}
              />
            </div>
          ))}
        </div>

        {isDraft && (
          <div className="card p-5 space-y-4">
            <p className="section-label">{t('crm.marketingBroadcasts.form.launchHeading')}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setSendMode('now')}
                className={`rounded-xl border px-3 py-2 text-xs font-medium ${sendMode === 'now' ? 'border-[#111827] bg-surface-subtle' : 'border-border-default'}`}
              >
                {t('crm.marketingBroadcasts.form.sendNow')}
              </button>
              <button
                onClick={() => setSendMode('later')}
                className={`rounded-xl border px-3 py-2 text-xs font-medium ${sendMode === 'later' ? 'border-[#111827] bg-surface-subtle' : 'border-border-default'}`}
              >
                {t('crm.marketingBroadcasts.form.sendLater')}
              </button>
            </div>
            {sendMode === 'later' && (
              <input
                type="datetime-local"
                className="input"
                value={sendAt}
                onChange={(e) => setSendAt(e.target.value)}
              />
            )}
            <div className="flex items-center gap-3 pt-2 border-t border-border-default">
              <button onClick={handleSave} disabled={saving} className="btn-secondary">
                {saving ? t('crm.marketingBroadcasts.form.saving') : t('crm.marketingBroadcasts.form.saveDraft')}
              </button>
              <button
                onClick={handleSchedule}
                disabled={scheduling || !broadcast || (sendMode === 'later' && !sendAt)}
                className="btn-primary"
              >
                {scheduling
                  ? t('crm.marketingBroadcasts.form.launching')
                  : t(sendMode === 'now' ? 'crm.marketingBroadcasts.form.saveAndSend' : 'crm.marketingBroadcasts.form.saveAndSchedule')}
              </button>
            </div>
            {!broadcast && (
              <p className="text-[11px] text-text-tertiary">{t('crm.marketingBroadcasts.form.draftHint')}</p>
            )}
          </div>
        )}

        {broadcast && !isDraft && (
          <div className="card p-5">
            <p className="text-sm text-text-secondary">
              {t('crm.marketingBroadcasts.form.statsLine', { done: broadcast.stats.completed + broadcast.stats.active, total: broadcast.stats.total })}
              {broadcast.stats.failed > 0 && (
                <span className="text-status-error">
                  {t('crm.marketingBroadcasts.form.statsFailed', { count: broadcast.stats.failed })}
                </span>
              )}
            </p>
          </div>
        )}
      </div>
    </MainLayout>
  );
};
