// src/pages/telephony/TelephonyPage.tsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { TelephonySubnav } from './TelephonySubnav';
import {
  fetchTelephonyStatus,
  fetchCalls,
  fetchTelephonyStats,
  initiateCall,
  updateCallTags,
  fetchRecordingBlobUrl,
  type Call,
  type TelephonyStats,
} from '../../api/telephony';
import { SENTIMENT_CLASS, sentimentLabel, topicLabel } from './telephonyLabels';
import { useAlertModal } from '../../contexts/AlertModalContext';
import './telephony-design.css';

const cx = (...a: Array<string | false | undefined>) => a.filter(Boolean).join(' ');

const STATUS_KEY: Record<string, string> = {
  queued: 'queued', ringing: 'ringing', 'in-progress': 'in_progress',
  completed: 'completed', 'no-answer': 'no_answer', busy: 'busy', failed: 'failed', canceled: 'canceled',
};

const DIR_ICON: Record<string, React.ReactNode> = {
  inbound: <><path d="M17 7L7 17" /><path d="M8 7h9v9" /></>,
  outbound: <><path d="M7 17L17 7" /><path d="M16 17V8H7" /></>,
  missed: <><path d="M22 8L2 8" /><path d="M6 4l-4 4 4 4" /></>,
};

const formatDuration = (sec: number | null): string => {
  if (!sec) return '0:00';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const displayNumber = (call: Call): string => (call.direction === 'outbound' ? call.toNumber : call.fromNumber) || '—';

type DirFilter = 'all' | 'inbound' | 'outbound' | 'missed';

const CallDetail: React.FC<{ call: Call; onClose: () => void; onTagsSaved: (call: Call) => void }> = ({ call, onClose, onTagsSaved }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [tagsDraft, setTagsDraft] = useState(call.tags.join(', '));
  const [savingTags, setSavingTags] = useState(false);
  const isMissed = ['no-answer', 'busy', 'failed', 'canceled'].includes(call.status);

  useEffect(() => {
    setTagsDraft(call.tags.join(', '));
    setAudioUrl(null);
    if (call.recordingUrl) {
      setAudioLoading(true);
      fetchRecordingBlobUrl(call.id)
        .then(setAudioUrl)
        .catch(() => undefined)
        .finally(() => setAudioLoading(false));
    }
    return () => { if (audioUrl) URL.revokeObjectURL(audioUrl); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call.id]);

  const handleSaveTags = async () => {
    setSavingTags(true);
    try {
      const tags = tagsDraft.split(',').map((tag) => tag.trim()).filter(Boolean);
      const updated = await updateCallTags(call.id, tags);
      onTagsSaved(updated);
    } catch (e: any) {
      showAlert(e?.message || t('crm.telephony.calls.detail.tagsSaveError'), { variant: 'error' });
    } finally {
      setSavingTags(false);
    }
  };

  return (
    <div className="bk-drawer-back" onClick={onClose}>
      <div className="bk-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="bk-drawer-head">
          <div>
            <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, color: 'var(--fg-3)' }}>
              {t(`crm.telephony.direction.${call.direction === 'outbound' ? 'outbound' : isMissed ? 'missed' : 'inbound'}`)} · {new Date(call.createdAt).toLocaleString()}
            </div>
            <h3>{displayNumber(call)}</h3>
          </div>
          <button onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 6l12 12" /><path d="M6 18L18 6" /></svg>
          </button>
        </div>
        <div className="bk-drawer-body">
          <div className="htl-info-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="htl-info-item"><div className="l">{t('crm.telephony.calls.detail.status')}</div><div className="v">{t(`crm.telephony.status.${STATUS_KEY[call.status] || call.status}`, { defaultValue: call.status })}</div></div>
            <div className="htl-info-item"><div className="l">{t('crm.telephony.calls.detail.duration')}</div><div className="v">{formatDuration(call.durationSeconds)}</div></div>
          </div>

          {call.recordingUrl ? (
            <div className="call-audio-player">
              <div style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 10 }}>{t('crm.telephony.calls.detail.recordingTitle')}</div>
              {audioLoading && <p style={{ fontSize: 12, color: 'var(--fg-3)' }}>{t('crm.telephony.calls.detail.loadingRecording')}</p>}
              {audioUrl && <audio controls src={audioUrl} style={{ width: '100%' }} />}
            </div>
          ) : (
            <p style={{ fontSize: 12, color: 'var(--fg-3)' }}>{t('crm.telephony.calls.detail.noRecording')}</p>
          )}

          {call.transcript && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 8 }}>{t('crm.telephony.calls.detail.aiAnalysisTitle')}</div>
              {call.sentimentStatus === 'pending' && <p style={{ fontSize: 12, color: 'var(--fg-3)' }}>{t('crm.telephony.calls.detail.analyzing')}</p>}
              {call.sentimentStatus === 'failed' && <p style={{ fontSize: 12, color: '#cc2f47' }}>{t('crm.telephony.calls.detail.analysisFailed')}</p>}
              {call.sentimentStatus === 'done' && call.sentiment && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span className={cx('ha-risk-pill', SENTIMENT_CLASS[call.sentiment])}>{sentimentLabel(t, call.sentiment)}</span>
                  {call.sentimentTopic && <span className="call-tag">{t('crm.telephony.calls.detail.topicPrefix')} {topicLabel(t, call.sentimentTopic)}</span>}
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 8 }}>{t('crm.telephony.calls.detail.transcriptTitle')}</div>
            {call.transcriptStatus === 'pending' && <p style={{ fontSize: 12, color: 'var(--fg-3)' }}>{t('crm.telephony.calls.detail.transcribing')}</p>}
            {call.transcriptStatus === 'failed' && <p style={{ fontSize: 12, color: '#cc2f47' }}>{t('crm.telephony.calls.detail.transcriptFailed')}</p>}
            {call.transcript ? (
              <div className="call-transcript">{call.transcript}</div>
            ) : call.transcriptStatus !== 'pending' && call.transcriptStatus !== 'failed' ? (
              <p style={{ fontSize: 12, color: 'var(--fg-3)' }}>{t('crm.telephony.calls.detail.noTranscript')}</p>
            ) : null}
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 8 }}>{t('crm.telephony.calls.detail.tagsTitle')}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="px-scope-input"
                style={{ flex: 1, border: '1px solid var(--line-2)', borderRadius: 8, padding: '8px 10px', fontSize: 12.5, fontFamily: 'inherit' }}
                placeholder={t('crm.telephony.calls.detail.tagsPlaceholder')}
                value={tagsDraft}
                onChange={(e) => setTagsDraft(e.target.value)}
              />
              <button className="btn btn-sm" onClick={handleSaveTags} disabled={savingTags}>{savingTags ? t('crm.telephony.calls.detail.saving') : t('crm.telephony.calls.detail.save')}</button>
            </div>
          </div>

          {call.linkedLeadId && (
            <div style={{ marginTop: 16 }}>
              <Link to={`/leads/${call.linkedLeadId}`} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                {t('crm.telephony.calls.detail.openLeadCard')}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const TelephonyPage: React.FC = () => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const [addonEnabled, setAddonEnabled] = useState<boolean | null>(null);
  const [items, setItems] = useState<Call[]>([]);
  const [stats, setStats] = useState<TelephonyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dirFilter, setDirFilter] = useState<DirFilter>('all');
  const [selected, setSelected] = useState<Call | null>(null);

  const [callTo, setCallTo] = useState('');
  const [calling, setCalling] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [calls, s] = await Promise.all([
        fetchCalls({ search: search || undefined, direction: dirFilter === 'all' ? undefined : dirFilter }),
        fetchTelephonyStats(30),
      ]);
      setItems(calls.items);
      setStats(s);
    } catch (e: any) {
      showAlert(e?.message || t('crm.telephony.calls.loadError'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTelephonyStatus().then((s) => setAddonEnabled(s.enabled)).catch(() => setAddonEnabled(false));
  }, []);

  useEffect(() => {
    if (addonEnabled) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addonEnabled, search, dirFilter]);

  const handleCall = async () => {
    if (!callTo.trim()) return;
    setCalling(true);
    try {
      await initiateCall(callTo.trim());
      showAlert(t('crm.telephony.calls.callSuccessMsg'), { variant: 'success' });
      setCallTo('');
      await load();
    } catch (e: any) {
      showAlert(e?.message || t('crm.telephony.calls.callErrorMsg'), { variant: 'error' });
    } finally {
      setCalling(false);
    }
  };

  if (addonEnabled === null || (addonEnabled && loading)) {
    return (
      <MainLayout>
        <div className="px-scope">
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--fg-3)', fontSize: 13 }}>{t('crm.telephony.calls.loadingPage')}</div>
        </div>
      </MainLayout>
    );
  }

  if (!addonEnabled) {
    return (
      <MainLayout>
        <div className="px-scope">
          <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center', padding: '64px 0' }}>
            <h1>{t('crm.telephony.calls.addonTitle')}</h1>
            <p style={{ fontSize: 13, color: 'var(--fg-3)', marginTop: 10 }}>
              {t('crm.telephony.calls.addonBody')}
            </p>
            <Link to="/telephony/settings" className="btn btn-primary" style={{ marginTop: 16, display: 'inline-flex' }}>{t('crm.telephony.calls.addonCta')}</Link>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageHelpButton topic="telephony" />
      <div className="px-scope">
        <div className="tel-hero">
          <div>
            <div className="kicker"><span className="dot" />{t('crm.telephony.calls.kicker', { count: items.length })}</div>
            <h1>{t('crm.telephony.calls.title')}</h1>
            <p className="sub">{t('crm.telephony.calls.subtitle')}</p>
          </div>
        </div>

        <TelephonySubnav active="calls" />

        {stats && (
          <div className="tel-kpis">
            <div className="tel-kpi"><div className="l">{t('crm.telephony.calls.kpis.total')}</div><div className="v">{stats.totalCalls}</div></div>
            <div className="tel-kpi"><div className="l">{t('crm.telephony.calls.kpis.missed')}</div><div className="v">{stats.missedCalls}</div></div>
            <div className="tel-kpi"><div className="l">{t('crm.telephony.calls.kpis.avgDuration')}</div><div className="v">{formatDuration(stats.avgDurationSeconds)}</div></div>
            <div className="tel-kpi"><div className="l">{t('crm.telephony.calls.kpis.pickupRate')}</div><div className="v">{stats.pickupRate}%</div></div>
            <div className="tel-kpi"><div className="l">{t('crm.telephony.calls.kpis.recorded')}</div><div className="v">{stats.recordedCalls}</div></div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, margin: '14px 0', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="bk-search" style={{ flex: '1 1 260px', maxWidth: 340 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.5-4.5" /></svg>
            <input placeholder={t('crm.telephony.calls.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="bk-savedviews" style={{ flex: 'none' }}>
            {(['all', 'inbound', 'outbound', 'missed'] as DirFilter[]).map((k) => (
              <div key={k} className={cx('bk-sv-tab', dirFilter === k && 'active')} onClick={() => setDirFilter(k)}>{t(`crm.telephony.calls.filters.${k}`)}</div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, flex: '1 1 260px' }}>
            <input
              className="bk-search"
              style={{ flex: 1 }}
              placeholder={t('crm.telephony.calls.callToPlaceholder')}
              value={callTo}
              onChange={(e) => setCallTo(e.target.value)}
            />
            <button className="btn btn-primary" onClick={handleCall} disabled={calling || !callTo.trim()}>{calling ? t('crm.telephony.calls.callingBtn') : t('crm.telephony.calls.callBtn')}</button>
          </div>
        </div>

        <div className="bk-table-wrap">
          <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 120px 100px 130px 32px', gap: 12, padding: '9px 14px', fontSize: 10.5, fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.03em', borderBottom: '1px solid var(--line-2)', background: 'var(--bg-muted)' }}>
            <span></span><span>{t('crm.telephony.calls.table.contact')}</span><span>{t('crm.telephony.calls.table.tag')}</span><span>{t('crm.telephony.calls.table.duration')}</span><span>{t('crm.telephony.calls.table.when')}</span><span></span>
          </div>
          {items.length === 0 && !loading && (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--fg-3)', fontSize: 13 }}>{t('crm.telephony.calls.emptyMessage')}</div>
          )}
          {items.map((c) => {
            const isMissed = ['no-answer', 'busy', 'failed', 'canceled'].includes(c.status);
            const dirKey = isMissed ? 'missed' : c.direction;
            return (
              <div key={c.id} className="call-row" onClick={() => setSelected(c)}>
                <div className={cx('call-dir-ic', dirKey)}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">{DIR_ICON[dirKey]}</svg>
                </div>
                <div>
                  <div className="call-name">{displayNumber(c)}</div>
                  <div className="call-num">{c.linkedLeadId ? t('crm.telephony.calls.linkedToLead') : ''}</div>
                </div>
                <div>{c.tags.length > 0 && <span className="call-tag">{c.tags[0]}</span>}</div>
                <div className="call-dur">{formatDuration(c.durationSeconds)}</div>
                <div style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>{new Date(c.createdAt).toLocaleString()}</div>
                <div>
                  {c.recordingUrl && (
                    <button className="call-play-btn" onClick={(e) => { e.stopPropagation(); setSelected(c); }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4l14 8-14 8z" /></svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {selected && (
        <CallDetail
          call={selected}
          onClose={() => setSelected(null)}
          onTagsSaved={(updated) => { setSelected(updated); setItems((prev) => prev.map((c) => (c.id === updated.id ? updated : c))); }}
        />
      )}
    </MainLayout>
  );
};
