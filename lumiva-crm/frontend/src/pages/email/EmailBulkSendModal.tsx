import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  fetchEmailAccounts,
  fetchEmailTemplates,
  sendBulkEmail,
  type EmailAccount,
  type EmailTemplate,
} from '../../api/email';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Step = 'audience' | 'compose' | 'preview' | 'sent';

const LEAD_STATUS_KEYS = ['', 'new', 'in_progress', 'waiting', 'won', 'lost'];
const STEP_KEYS: Step[] = ['audience', 'compose', 'preview', 'sent'];

export function EmailBulkSendModal({ open, onClose }: Props) {
  const { t } = useTranslation();
  const bs = (key: string, opts?: Record<string, unknown>) => t(`crm.email.bulkSend.${key}`, opts as any) as string;
  const leadStatusLabel = (v: string) => bs(`leadStatuses.${v || 'any'}`);

  const [step, setStep] = useState<Step>('audience');

  // Audience
  const [audienceMode, setAudienceMode] = useState<'all' | 'filter' | 'manual'>('all');
  const [filterSource, setFilterSource] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [manualEmails, setManualEmails] = useState('');

  // Compose
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [fromAccountId, setFromAccountId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('');
  const [trackOpens, setTrackOpens] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);

  // Sent
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; jobId: string } | null>(null);
  const [error, setError] = useState('');

  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!open) return;
    setStep('audience');
    setResult(null);
    setError('');

    fetchEmailAccounts()
      .then((data) => {
        setAccounts(data);
        if (data.length > 0 && !fromAccountId) setFromAccountId(data[0].id);
      })
      .catch(() => {});

    fetchEmailTemplates(true)
      .then((data) => setTemplates(data))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // When template is selected, fill subject + html
  useEffect(() => {
    if (!selectedTemplateId) return;
    const tpl = templates.find((t) => t.id === selectedTemplateId);
    if (!tpl) return;
    if (tpl.subject) setSubject(tpl.subject);
    if (tpl.htmlBody) setHtml(tpl.htmlBody);
  }, [selectedTemplateId, templates]);

  // Update iframe preview when html changes
  useEffect(() => {
    if (previewVisible && iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(html || `<p style="color:#888;font-family:sans-serif">${bs('noContent')}</p>`);
        doc.close();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, previewVisible]);

  const parseManualEmails = () =>
    manualEmails
      .split(/[\n,;]+/)
      .map((e) => e.trim())
      .filter((e) => e.includes('@'));

  const buildPayload = () => ({
    subject,
    html,
    fromAccountId,
    templateId: selectedTemplateId || undefined,
    trackOpens,
    leadFilters:
      audienceMode === 'filter'
        ? {
            source: filterSource || undefined,
            status: filterStatus || undefined,
          }
        : audienceMode === 'all'
          ? {}
          : undefined,
    recipientEmails:
      audienceMode === 'manual' ? parseManualEmails() : undefined,
  });

  const handleSend = async () => {
    setSending(true);
    setError('');
    try {
      const res = await sendBulkEmail(buildPayload());
      setResult(res);
      setStep('sent');
    } catch (e: any) {
      setError(e?.message || bs('sendError'));
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          width: '100%',
          maxWidth: 680,
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{bs('title')}</h2>
            <p style={{ margin: 0, fontSize: 12, color: '#64748b', marginTop: 2 }}>
              {bs(`stepHints.${step}`)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 22,
              cursor: 'pointer',
              color: '#94a3b8',
              lineHeight: 1,
            }}
          >
            &times;
          </button>
        </div>

        {/* Step indicator */}
        <div
          style={{
            display: 'flex',
            gap: 0,
            padding: '0 24px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
          }}
        >
          {STEP_KEYS.map((s, i) => (
            <div
              key={s}
              style={{
                padding: '10px 0',
                marginRight: 24,
                borderBottom: step === s ? '2px solid #0f172a' : '2px solid transparent',
                fontSize: 12,
                fontWeight: step === s ? 700 : 400,
                color: step === s ? '#0f172a' : '#94a3b8',
                cursor: 'default',
              }}
            >
              {i + 1}. {bs(`steps.${s}`)}
            </div>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          {/* STEP 1: AUDIENCE */}
          {step === 'audience' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontWeight: 600, fontSize: 13 }}>{bs('audience.label')}</label>
                {[
                  { value: 'all', label: bs('audience.modeAll') },
                  { value: 'filter', label: bs('audience.modeFilter') },
                  { value: 'manual', label: bs('audience.modeManual') },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}
                  >
                    <input
                      type="radio"
                      name="audienceMode"
                      value={opt.value}
                      checked={audienceMode === opt.value}
                      onChange={() => setAudienceMode(opt.value as any)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>

              {audienceMode === 'filter' && (
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                      {bs('audience.sourceLabel')}
                    </label>
                    <input
                      type="text"
                      placeholder={bs('audience.sourcePlaceholder')}
                      value={filterSource}
                      onChange={(e) => setFilterSource(e.target.value)}
                      style={{
                        width: '100%',
                        border: '1px solid #e2e8f0',
                        borderRadius: 8,
                        padding: '7px 10px',
                        fontSize: 13,
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                      {bs('audience.statusLabel')}
                    </label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      style={{
                        width: '100%',
                        border: '1px solid #e2e8f0',
                        borderRadius: 8,
                        padding: '7px 10px',
                        fontSize: 13,
                      }}
                    >
                      {LEAD_STATUS_KEYS.map((s) => (
                        <option key={s} value={s}>
                          {leadStatusLabel(s)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {audienceMode === 'manual' && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    {bs('audience.emailsLabel')}
                  </label>
                  <textarea
                    placeholder="ivan@example.com&#10;maria@example.com"
                    value={manualEmails}
                    onChange={(e) => setManualEmails(e.target.value)}
                    rows={5}
                    style={{
                      width: '100%',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      padding: '8px 10px',
                      fontSize: 13,
                      resize: 'vertical',
                      fontFamily: 'monospace',
                    }}
                  />
                  {manualEmails && (
                    <p style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                      {bs('audience.recognizedCountFormat', { count: parseManualEmails().length })}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: COMPOSE */}
          {step === 'compose' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  {bs('compose.fromAccountLabel')}
                </label>
                <select
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(e.target.value)}
                  style={{
                    width: '100%',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: '7px 10px',
                    fontSize: 13,
                  }}
                >
                  <option value="">{bs('compose.chooseAccountOption')}</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name ? `${a.name} <${a.email}>` : a.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  {bs('compose.templateLabel')}
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  style={{
                    width: '100%',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: '7px 10px',
                    fontSize: 13,
                  }}
                >
                  <option value="">{bs('compose.ownLetterOption')}</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  {bs('compose.subjectLabel')}{' '}
                  <span style={{ fontWeight: 400, color: '#94a3b8' }}>
                    {bs('compose.subjectVarsHintPrefix')}{'{{lead.firstName}}'}, {'{{lead.email}}'}{bs('compose.subjectVarsHintSuffix')}
                  </span>
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={bs('compose.subjectPlaceholder')}
                  style={{
                    width: '100%',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: '7px 10px',
                    fontSize: 13,
                  }}
                />
              </div>

              <div>
                <div
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}
                >
                  <label style={{ fontSize: 12, fontWeight: 600 }}>
                    {bs('compose.htmlBodyLabel')}{' '}
                    <span style={{ fontWeight: 400, color: '#94a3b8' }}>
                      {bs('compose.htmlBodyVarsHintPrefix')}{'{{lead.firstName}}'}{bs('compose.htmlBodyVarsHintSuffix')}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setPreviewVisible((v) => !v)}
                    style={{
                      fontSize: 11,
                      padding: '3px 10px',
                      border: '1px solid #e2e8f0',
                      borderRadius: 6,
                      background: '#fff',
                      cursor: 'pointer',
                      color: '#334155',
                    }}
                  >
                    {previewVisible ? bs('compose.editBtn') : bs('compose.previewBtn')}
                  </button>
                </div>

                {!previewVisible ? (
                  <textarea
                    value={html}
                    onChange={(e) => setHtml(e.target.value)}
                    rows={10}
                    placeholder={bs('compose.htmlPlaceholder')}
                    style={{
                      width: '100%',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      padding: '8px 10px',
                      fontSize: 12,
                      fontFamily: 'monospace',
                      resize: 'vertical',
                    }}
                  />
                ) : (
                  <iframe
                    ref={iframeRef}
                    title={bs('compose.previewTitle')}
                    style={{
                      width: '100%',
                      height: 260,
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                    }}
                  />
                )}
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={trackOpens}
                  onChange={(e) => setTrackOpens(e.target.checked)}
                />
                {bs('compose.trackOpensLabel')}
              </label>
            </div>
          )}

          {/* STEP 3: PREVIEW */}
          {step === 'preview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  padding: 16,
                }}
              >
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{bs('preview.senderAccountLabel')}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {accounts.find((a) => a.id === fromAccountId)?.email || fromAccountId}
                </div>

                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4, marginTop: 12 }}>{bs('preview.audienceLabel')}</div>
                <div style={{ fontSize: 13 }}>
                  {audienceMode === 'all' && bs('preview.audienceAll')}
                  {audienceMode === 'filter' &&
                    bs('preview.audienceFilterFormat', {
                      filters: [
                        filterSource && bs('preview.sourceFilterFormat', { value: filterSource }),
                        filterStatus && bs('preview.statusFilterFormat', { value: filterStatus }),
                      ].filter(Boolean).join(', ') || bs('preview.noFilters'),
                    })}
                  {audienceMode === 'manual' && bs('preview.audienceManualFormat', { count: parseManualEmails().length })}
                </div>

                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4, marginTop: 12 }}>{bs('preview.subjectLabel')}</div>
                <div style={{ fontSize: 13 }}>{subject || bs('preview.noSubject')}</div>

                {trackOpens && (
                  <div style={{ marginTop: 12, fontSize: 12, color: '#64748b' }}>
                    {bs('preview.trackingEnabled')}
                  </div>
                )}
              </div>

              <div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>{bs('preview.emailPreviewLabel')}</div>
                <iframe
                  title={bs('preview.previewTitle')}
                  srcDoc={html || `<p style="color:#aaa;font-family:sans-serif">${bs('noContent')}</p>`}
                  style={{
                    width: '100%',
                    height: 240,
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                  }}
                />
              </div>

              {error && (
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: 8,
                    padding: '10px 14px',
                    fontSize: 13,
                    color: '#dc2626',
                  }}
                >
                  {error}
                </div>
              )}
            </div>
          )}

          {/* STEP 4: SENT */}
          {step === 'sent' && result && (
            <div style={{ textAlign: 'center', padding: '32px 16px' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>
                {result.failed === 0 ? '' : ''}
              </div>
              <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700 }}>{bs('sent.title')}</h3>
              <p style={{ margin: '0 0 4px', fontSize: 14, color: '#334155' }}>
                {bs('sent.sentCountFormat', { count: result.sent })}
              </p>
              {result.failed > 0 && (
                <p style={{ margin: '0 0 4px', fontSize: 13, color: '#dc2626' }}>
                  {bs('sent.failedCountFormat', { count: result.failed })}
                </p>
              )}
              <p style={{ margin: '16px 0 0', fontSize: 11, color: '#94a3b8' }}>
                {bs('sent.jobIdFormat', { id: result.jobId })}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          {step !== 'sent' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  if (step === 'audience') onClose();
                  else if (step === 'compose') setStep('audience');
                  else if (step === 'preview') setStep('compose');
                }}
                style={{
                  padding: '8px 20px',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  background: '#fff',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                {step === 'audience' ? bs('footer.cancelBtn') : bs('footer.backBtn')}
              </button>

              {step === 'preview' ? (
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={sending || !fromAccountId || !subject || !html}
                  style={{
                    padding: '8px 24px',
                    border: 'none',
                    borderRadius: 8,
                    background: sending ? '#94a3b8' : '#0f172a',
                    color: '#fff',
                    cursor: sending ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {sending ? bs('footer.sendingBtn') : bs('footer.sendBtn')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (step === 'audience') setStep('compose');
                    else if (step === 'compose') setStep('preview');
                  }}
                  disabled={step === 'compose' && (!fromAccountId || !subject || !html)}
                  style={{
                    padding: '8px 24px',
                    border: 'none',
                    borderRadius: 8,
                    background: '#0f172a',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {bs('footer.nextBtn')}
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 24px',
                border: 'none',
                borderRadius: 8,
                background: '#0f172a',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                marginLeft: 'auto',
              }}
            >
              {bs('footer.closeBtn')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
