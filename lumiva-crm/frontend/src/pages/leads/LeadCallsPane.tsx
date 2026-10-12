// src/pages/leads/LeadCallsPane.tsx
// Вкладка «Звонки» карточки лида: звонки Twilio и записи, загруженные вручную, с AI-разбором —
// резюме, договорённости, возражения клиента, «температура» клиента и оценка менеджера.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  deleteLeadCall,
  fetchLeadCallAudioUrl,
  fetchLeadCalls,
  reanalyzeLeadCall,
  uploadLeadCall,
  type LeadCall,
} from '../../api/leadCalls';
import { useAlertModal } from '../../contexts/AlertModalContext';
import './leadCalls.css';

const ACCEPT = 'audio/*,video/mp4,video/webm,.mp3,.m4a,.wav,.ogg,.oga,.opus,.webm,.mp4,.aac,.flac,.amr';
const MAX_BYTES = 25 * 1024 * 1024;

const fmtDur = (s: number | null) => {
  if (!s && s !== 0) return null;
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
};

const scoreTone = (n: number) => (n >= 75 ? 'good' : n >= 50 ? 'mid' : 'low');

function Ico({ d, size = 14 }: { d: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d}
    </svg>
  );
}
const IC = {
  upload: <><path d="M12 16V4" /><path d="M7 9l5-5 5 5" /><path d="M5 20h14" /></>,
  out: <><path d="M15 9l6-6" /><path d="M15 3h6v6" /><path d="M21 15.5v3a2 2 0 0 1-2.2 2A19 19 0 0 1 3.5 5.2 2 2 0 0 1 5.5 3h3l1.5 4-2 1.5a12 12 0 0 0 7.5 7.5l1.5-2z" /></>,
  inn: <><path d="M21 3l-6 6" /><path d="M15 3v6h6" /><path d="M21 15.5v3a2 2 0 0 1-2.2 2A19 19 0 0 1 3.5 5.2 2 2 0 0 1 5.5 3h3l1.5 4-2 1.5a12 12 0 0 0 7.5 7.5l1.5-2z" /></>,
  play: <path d="M8 5v14l11-7z" />,
  retry: <><path d="M20 11A8 8 0 0 0 6.3 6.3L4 8.5" /><path d="M4 4v4.5h4.5" /><path d="M4 13a8 8 0 0 0 13.7 4.7L20 15.5" /><path d="M20 20v-4.5h-4.5" /></>,
  trash: <><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13" /><path d="M9 7V4h6v3" /></>,
  ai: <path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6z" />,
};

function CallCard({
  leadId,
  call,
  canEdit,
  locale,
  onChanged,
  onDeleted,
}: {
  leadId: string;
  call: LeadCall;
  canEdit: boolean;
  locale: string;
  onChanged: (c: LeadCall) => void;
  onDeleted: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { showConfirm, showAlert } = useAlertModal();
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const a = call.aiAnalysis;
  const busy = call.analysisStatus === 'transcribing' || call.analysisStatus === 'analyzing';

  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  const loadAudio = async () => {
    setAudioLoading(true);
    try {
      setAudioUrl(await fetchLeadCallAudioUrl(leadId, call.id));
    } catch {
      showAlert(t('crm.leadCard.calls.audioError'), { variant: 'error' });
    } finally {
      setAudioLoading(false);
    }
  };

  const retry = async () => {
    try {
      onChanged(await reanalyzeLeadCall(leadId, call.id));
    } catch (e: any) {
      showAlert(e?.message || t('crm.leadCard.calls.retryError'), { variant: 'error' });
    }
  };

  const remove = async () => {
    if (!(await showConfirm(t('crm.leadCard.calls.deleteConfirm'), { danger: true }))) return;
    try {
      await deleteLeadCall(leadId, call.id);
      onDeleted(call.id);
    } catch (e: any) {
      showAlert(e?.message || t('crm.leadCard.calls.deleteError'), { variant: 'error' });
    }
  };

  const when = new Date(call.startedAt || call.createdAt).toLocaleString(locale, {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
  const dur = fmtDur(call.durationSeconds);

  return (
    <article className="lc-card">
      <header className="lc-head">
        <span className={`lc-dir ${call.direction}`} title={t(`crm.leadCard.calls.dir.${call.direction}`)}>
          <Ico d={call.direction === 'inbound' ? IC.inn : IC.out} />
        </span>
        <div className="lc-meta">
          <div className="lc-title">
            {t(`crm.leadCard.calls.dir.${call.direction}`)}
            {dur && <span className="mono mut">· {dur}</span>}
          </div>
          <div className="mono mut lc-sub">
            {when}
            <span className="sep" />
            {call.source === 'upload' ? t('crm.leadCard.calls.sourceUpload') : t('crm.leadCard.calls.sourceTwilio')}
            {call.originalFilename && <span className="lc-file" title={call.originalFilename}>{call.originalFilename}</span>}
          </div>
        </div>
        {a && call.analysisStatus === 'done' && (
          <div className="lc-badges">
            <span className={`lc-intent ${a.clientIntent}`}>{t(`crm.leadCard.calls.intent.${a.clientIntent}`)}</span>
            <span className={`lc-score ${scoreTone(a.managerScore)}`} title={t('crm.leadCard.calls.scoreHint')}>
              {t('crm.leadCard.calls.score')} <b>{a.managerScore}</b>
            </span>
          </div>
        )}
      </header>

      {busy && (
        <div className="lc-status">
          <span className="lc-spin" aria-hidden="true" />
          {call.analysisStatus === 'transcribing' ? t('crm.leadCard.calls.transcribing') : t('crm.leadCard.calls.analyzing')}
        </div>
      )}

      {call.analysisStatus === 'failed' && (
        <div className="lc-fail">
          <span>{t('crm.leadCard.calls.failed')}{call.analysisError ? `: ${call.analysisError}` : ''}</span>
          {canEdit && (
            <button type="button" className="lk" onClick={() => void retry()}>
              <Ico d={IC.retry} size={12} /> {t('crm.leadCard.calls.retry')}
            </button>
          )}
        </div>
      )}

      {a && call.analysisStatus === 'done' && (
        <div className="lc-body">
          <p className="lc-summary">{a.summary}</p>

          {a.nextSteps.length > 0 && (
            <section className="lc-block">
              <span className="kick">{t('crm.leadCard.calls.nextSteps')}</span>
              <ul className="lc-steps">
                {a.nextSteps.map((s, i) => (
                  <li key={i}>
                    <span>{s.text}</span>
                    {s.dueInDays !== null && (
                      <span className="lc-due mono">
                        {s.dueInDays === 0 ? t('crm.leadCard.calls.dueToday') : t('crm.leadCard.calls.dueIn', { count: s.dueInDays })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {a.objections.length > 0 && (
            <section className="lc-block">
              <span className="kick">{t('crm.leadCard.calls.objections')}</span>
              <ul className="lc-list">
                {a.objections.map((o, i) => <li key={i}>{o}</li>)}
              </ul>
            </section>
          )}

          {(a.strengths.length > 0 || a.improvements.length > 0) && (
            <div className="lc-coach">
              {a.strengths.length > 0 && (
                <section className="lc-block good">
                  <span className="kick">{t('crm.leadCard.calls.strengths')}</span>
                  <ul className="lc-list">{a.strengths.map((o, i) => <li key={i}>{o}</li>)}</ul>
                </section>
              )}
              {a.improvements.length > 0 && (
                <section className="lc-block warn">
                  <span className="kick">{t('crm.leadCard.calls.improvements')}</span>
                  <ul className="lc-list">{a.improvements.map((o, i) => <li key={i}>{o}</li>)}</ul>
                </section>
              )}
            </div>
          )}
        </div>
      )}

      <footer className="lc-foot">
        {call.hasRecording && (audioUrl ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <audio className="lc-audio" src={audioUrl} controls autoPlay />
        ) : (
          <button type="button" className="lk" onClick={() => void loadAudio()} disabled={audioLoading}>
            <Ico d={IC.play} size={12} /> {audioLoading ? t('crm.leadCard.calls.loadingAudio') : t('crm.leadCard.calls.listen')}
          </button>
        ))}
        {call.transcript && (
          <button type="button" className="lk" onClick={() => setShowTranscript((v) => !v)} aria-expanded={showTranscript}>
            {showTranscript ? t('crm.leadCard.calls.hideTranscript') : t('crm.leadCard.calls.showTranscript')}
          </button>
        )}
        <span className="lc-sp" />
        {canEdit && call.analysisStatus === 'done' && (
          <button type="button" className="lk" onClick={() => void retry()} title={t('crm.leadCard.calls.reanalyzeHint')}>
            <Ico d={IC.ai} size={12} /> {t('crm.leadCard.calls.reanalyze')}
          </button>
        )}
        {canEdit && call.source === 'upload' && !busy && (
          <button type="button" className="lk lc-del" onClick={() => void remove()}>
            <Ico d={IC.trash} size={12} /> {t('crm.leadCard.calls.delete')}
          </button>
        )}
      </footer>
      {showTranscript && call.transcript && <pre className="lc-transcript">{call.transcript}</pre>}
    </article>
  );
}

export function LeadCallsPane({
  leadId,
  canEdit,
  locale,
  onCount,
}: {
  leadId: string;
  canEdit: boolean;
  locale: string;
  onCount?: (n: number) => void;
}) {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const [calls, setCalls] = useState<LeadCall[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [direction, setDirection] = useState<'outbound' | 'inbound'>('outbound');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const list = await fetchLeadCalls(leadId);
      setCalls(list);
      setError(null);
    } catch (e: any) {
      setError(e?.message || t('crm.leadCard.calls.loadError'));
    } finally {
      setLoaded(true);
    }
  }, [leadId, t]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { onCount?.(calls.length); }, [calls.length, onCount]);

  // Пока идёт распознавание/разбор — опрашиваем каждые 4 секунды.
  const pending = calls.some((c) => c.analysisStatus === 'transcribing' || c.analysisStatus === 'analyzing');
  useEffect(() => {
    if (!pending) return;
    const id = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(id);
  }, [pending, load]);

  const upload = async (file: File | undefined | null) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      showAlert(t('crm.leadCard.calls.tooLarge'), { variant: 'error' });
      return;
    }
    setUploading(true);
    try {
      const call = await uploadLeadCall(leadId, file, direction);
      setCalls((list) => [call, ...list]);
    } catch (e: any) {
      showAlert(e?.message || t('crm.leadCard.calls.uploadError'), { variant: 'error' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const replace = (c: LeadCall) => setCalls((list) => list.map((x) => (x.id === c.id ? c : x)));
  const drop = (id: string) => setCalls((list) => list.filter((x) => x.id !== id));

  return (
    <div
      className={`ld-pane lc-pane${dragOver ? ' drag' : ''}`}
      onDragOver={(e) => { if (canEdit && e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragOver(true); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false); }}
      onDrop={(e) => {
        if (!canEdit) return;
        e.preventDefault();
        setDragOver(false);
        void upload(e.dataTransfer.files?.[0]);
      }}
    >
      {canEdit && (
        <div className="lc-up">
          <div className="lc-up-txt">
            <b>{t('crm.leadCard.calls.uploadTitle')}</b>
            <span>{t('crm.leadCard.calls.uploadHint')}</span>
          </div>
          <div className="lc-seg" role="group" aria-label={t('crm.leadCard.calls.directionLabel')}>
            {(['outbound', 'inbound'] as const).map((d) => (
              <button key={d} type="button" aria-pressed={direction === d} className={direction === d ? 'on' : undefined} onClick={() => setDirection(d)}>
                {t(`crm.leadCard.calls.dir.${d}`)}
              </button>
            ))}
          </div>
          <button type="button" className="ld-btn" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Ico d={IC.upload} /> {uploading ? t('crm.leadCard.calls.uploading') : t('crm.leadCard.calls.upload')}
          </button>
          <input ref={fileRef} type="file" accept={ACCEPT} hidden onChange={(e) => void upload(e.target.files?.[0])} />
        </div>
      )}

      {error && <div className="ld-err">{error}</div>}
      {!loaded && <div className="ld-empty">{t('crm.leadCard.comms.loading')}</div>}
      {loaded && !error && calls.length === 0 && (
        <div className="lc-empty">
          <Ico d={IC.ai} size={22} />
          <b>{t('crm.leadCard.calls.emptyTitle')}</b>
          <span>{t('crm.leadCard.calls.emptyText')}</span>
        </div>
      )}

      <div className="lc-list-wrap lv-stagger">
        {calls.map((c) => (
          <CallCard key={c.id} leadId={leadId} call={c} canEdit={canEdit} locale={locale} onChanged={replace} onDeleted={drop} />
        ))}
      </div>
    </div>
  );
}
