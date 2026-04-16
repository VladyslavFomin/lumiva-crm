import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  fetchEmailAccounts,
  previewStyledMail,
  sendStyledMail,
  type EmailAccount,
} from '../../api/email';
import { fetchContact } from '../../api/contacts';
import { fetchLeadById } from '../../api/leads';

export type AiEmailComposerInitialDraft = {
  subject?: string;
  textBody?: string;
  htmlBody?: string;
  to?: string;
};

export type AiEmailComposerModalProps = {
  open: boolean;
  onClose: () => void;
  initialDraft?: AiEmailComposerInitialDraft | null;
};

const DEFAULT_VARS = '{\n  "name": "",\n  "email": ""\n}';

function wrapEmailHtmlFragment(html: string): string {
  const raw = html.trim();
  if (!raw) return '';
  if (/^\s*<!DOCTYPE/i.test(raw) || /<html[\s>]/i.test(raw)) {
    return raw;
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><base target="_blank"></head><body>${raw}</body></html>`;
}

export const AiEmailComposerModal: React.FC<AiEmailComposerModalProps> = ({
  open,
  onClose,
  initialDraft,
}) => {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [accountId, setAccountId] = useState('');
  const [to, setTo] = useState('');
  const [contactId, setContactId] = useState('');
  const [leadId, setLeadId] = useState('');
  const [varsJson, setVarsJson] = useState(DEFAULT_VARS);
  const [headline, setHeadline] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyPlain, setBodyPlain] = useState('');
  const [bodyHtmlFragment, setBodyHtmlFragment] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const resetForm = useCallback(() => {
    setAccountId('');
    setTo('');
    setContactId('');
    setLeadId('');
    setVarsJson(DEFAULT_VARS);
    setHeadline('');
    setSubject('');
    setBodyPlain('');
    setBodyHtmlFragment('');
    setShowAdvanced(false);
    setPreviewHtml('');
    setLoadError(null);
    setActionError(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    resetForm();
    if (initialDraft) {
      if (initialDraft.subject != null) setSubject(initialDraft.subject);
      if (initialDraft.textBody != null) setBodyPlain(initialDraft.textBody);
      if (initialDraft.htmlBody != null) {
        setBodyHtmlFragment(initialDraft.htmlBody);
        setShowAdvanced(true);
      }
      if (initialDraft.to) setTo(initialDraft.to);
    }
    let cancelled = false;
    (async () => {
      try {
        const acc = await fetchEmailAccounts();
        if (cancelled) return;
        setAccounts(acc);
        const first = acc.find((a) => a.status === 'active') || acc[0];
        if (first) setAccountId(first.id);
      } catch (e: any) {
        if (!cancelled) setLoadError(e?.message || 'load_failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, resetForm, initialDraft]);

  const previewSrcDoc = useMemo(() => {
    const wrapped = wrapEmailHtmlFragment(previewHtml);
    if (wrapped) return wrapped;
    const msg = t('crm.aiAssistant.emailComposer.previewEmptyStyled');
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:system-ui,sans-serif;padding:20px;color:#64748b;font-size:14px;line-height:1.5}</style></head><body>${msg}</body></html>`;
  }, [previewHtml, t]);

  const parseVariables = (): Record<string, unknown> => {
    const raw = varsJson.trim();
    if (!raw) return {};
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error(t('crm.aiAssistant.emailComposer.varsInvalid'));
    }
    return data;
  };

  const mergeEntitiesIntoVariables = async (
    base: Record<string, unknown>,
  ): Promise<Record<string, unknown>> => {
    const out = { ...base };
    if (leadId.trim()) {
      const lead = await fetchLeadById(leadId.trim());
      out.name = out.name || lead.name || '';
      out.email = out.email || lead.email || '';
      out.lead = {
        id: lead.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        status: lead.status,
      };
    }
    if (contactId.trim()) {
      const c = await fetchContact(contactId.trim());
      const full = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
      out.name = out.name || full;
      out.email = out.email || c.email || '';
      out.contact = {
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        phone: c.phone,
      };
    }
    return out;
  };

  const applyEntityToVars = async () => {
    setActionError(null);
    try {
      const base = parseVariables();
      const merged = await mergeEntitiesIntoVariables(base);
      setVarsJson(JSON.stringify(merged, null, 2));
      if (!to.trim()) {
        const em =
          (typeof merged.email === 'string' && merged.email) ||
          (merged.lead as { email?: string } | undefined)?.email ||
          (merged.contact as { email?: string } | undefined)?.email;
        if (em) setTo(em);
      }
    } catch (e: any) {
      setActionError(e?.message || t('crm.aiAssistant.emailComposer.applyEntityFailed'));
    }
  };

  const buildStyledPayload = async () => {
    const variables = await mergeEntitiesIntoVariables(parseVariables());
    return {
      subject: subject.trim(),
      bodyText: bodyPlain.trim() || undefined,
      bodyHtml: bodyHtmlFragment.trim() || undefined,
      headline: headline.trim() || undefined,
      contactId: contactId.trim() || undefined,
      leadId: leadId.trim() || undefined,
      variables,
    };
  };

  const handlePreview = async () => {
    setActionError(null);
    if (!subject.trim()) {
      setActionError(t('crm.aiAssistant.emailComposer.subjectRequired'));
      return;
    }
    if (!bodyPlain.trim() && !bodyHtmlFragment.trim()) {
      setActionError(t('crm.aiAssistant.emailComposer.bodyRequired'));
      return;
    }
    setBusy(true);
    try {
      const base = await buildStyledPayload();
      const res = await previewStyledMail(base);
      setPreviewHtml(res.htmlBody || '');
    } catch (e: any) {
      setActionError(e?.message || 'preview_failed');
    } finally {
      setBusy(false);
    }
  };

  const handleSend = async () => {
    setActionError(null);
    if (!accountId) {
      setActionError(t('crm.aiAssistant.emailComposer.pickAccount'));
      return;
    }
    const recipients = to
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!recipients.length) {
      setActionError(t('crm.aiAssistant.emailComposer.toRequired'));
      return;
    }
    if (!subject.trim()) {
      setActionError(t('crm.aiAssistant.emailComposer.subjectRequired'));
      return;
    }
    if (!bodyPlain.trim() && !bodyHtmlFragment.trim()) {
      setActionError(t('crm.aiAssistant.emailComposer.bodyRequired'));
      return;
    }
    setBusy(true);
    try {
      const base = await buildStyledPayload();
      await sendStyledMail({
        ...base,
        accountId,
        to: recipients,
      });
      onClose();
    } catch (e: any) {
      setActionError(e?.message || 'send_failed');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/40 p-3 sm:items-center sm:p-4"
      role="dialog"
      aria-modal
      aria-labelledby="ai-email-composer-title"
    >
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
          <div className="min-w-0">
            <h2 id="ai-email-composer-title" className="text-base font-semibold text-slate-900">
              {t('crm.aiAssistant.emailComposer.title')}
            </h2>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              {t('crm.aiAssistant.emailComposer.hintStyled')}
            </p>
            <p className="mt-1 text-[10px] font-medium text-violet-800/90">
              {t('crm.aiAssistant.emailComposer.sendFlowHintStyled')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {loadError && (
            <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
              {loadError}
            </div>
          )}
          {actionError && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              {actionError}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
            <div className="space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-medium text-slate-600">
                  {t('crm.aiAssistant.emailComposer.account')}
                </label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
                >
                  <option value="">{t('crm.aiAssistant.emailComposer.pickAccount')}</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name ? `${a.name} <${a.email}>` : a.email} ({a.status})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block font-medium text-slate-600">
                  {t('crm.aiAssistant.emailComposer.to')}
                </label>
                <input
                  type="text"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
                  placeholder="client@example.com"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-slate-600">
                  {t('crm.aiAssistant.emailComposer.headlineField')}
                </label>
                <input
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
                  placeholder={t('crm.aiAssistant.emailComposer.headlinePlaceholder')}
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-slate-600">
                  {t('crm.aiAssistant.emailComposer.subject')}
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-slate-600">
                  {t('crm.aiAssistant.emailComposer.messagePlain')}
                </label>
                <p className="mb-1 text-[10px] text-slate-500">
                  {t('crm.aiAssistant.emailComposer.messagePlainHint')}
                </p>
                <textarea
                  value={bodyPlain}
                  onChange={(e) => setBodyPlain(e.target.value)}
                  rows={12}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm leading-relaxed text-slate-900"
                  placeholder={t('crm.aiAssistant.emailComposer.messagePlainPh')}
                />
              </div>

              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="text-[11px] font-semibold text-violet-700 underline decoration-violet-300 underline-offset-2"
              >
                {showAdvanced
                  ? t('crm.aiAssistant.emailComposer.hideAdvanced')
                  : t('crm.aiAssistant.emailComposer.showAdvanced')}
              </button>

              {showAdvanced && (
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block font-medium text-slate-600">
                        {t('crm.aiAssistant.emailComposer.contactId')}
                      </label>
                      <input
                        type="text"
                        value={contactId}
                        onChange={(e) => setContactId(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-[11px] text-slate-900"
                        placeholder="UUID"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-medium text-slate-600">
                        {t('crm.aiAssistant.emailComposer.leadId')}
                      </label>
                      <input
                        type="text"
                        value={leadId}
                        onChange={(e) => setLeadId(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-[11px] text-slate-900"
                        placeholder="UUID"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busy || (!contactId.trim() && !leadId.trim())}
                    onClick={() => void applyEntityToVars()}
                    className="w-full rounded-xl border border-violet-300 bg-violet-50 py-2 text-[11px] font-semibold text-violet-900 disabled:opacity-50"
                  >
                    {t('crm.aiAssistant.emailComposer.fillFromEntity')}
                  </button>
                  <div>
                    <label className="mb-1 block font-medium text-slate-600">
                      {t('crm.aiAssistant.emailComposer.variablesJson')}
                    </label>
                    <textarea
                      value={varsJson}
                      onChange={(e) => setVarsJson(e.target.value)}
                      rows={5}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-[11px] text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-medium text-slate-600">
                      {t('crm.aiAssistant.emailComposer.bodyHtmlFragment')}
                    </label>
                    <p className="mb-1 text-[10px] text-slate-500">
                      {t('crm.aiAssistant.emailComposer.bodyHtmlFragmentHint')}
                    </p>
                    <textarea
                      value={bodyHtmlFragment}
                      onChange={(e) => setBodyHtmlFragment(e.target.value)}
                      rows={5}
                      spellCheck={false}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-[11px] text-slate-900"
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handlePreview()}
                  className="rounded-xl border border-slate-400 bg-white px-4 py-2.5 text-[11px] font-semibold text-slate-800 disabled:opacity-50"
                >
                  {t('crm.aiAssistant.emailComposer.refreshPreview')}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleSend()}
                  className="rounded-xl border-2 border-violet-700 bg-violet-600 px-4 py-2.5 text-[11px] font-semibold text-white disabled:opacity-50"
                >
                  {t('crm.aiAssistant.emailComposer.send')}
                </button>
              </div>
            </div>

            <div className="flex min-h-0 flex-col gap-2 lg:sticky lg:top-0 lg:self-start">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {t('crm.aiAssistant.emailComposer.previewTitle')}
              </div>
              <iframe
                title={t('crm.aiAssistant.emailComposer.previewTitle')}
                className="min-h-[280px] w-full flex-1 rounded-xl border border-slate-200 bg-white shadow-inner sm:min-h-[360px]"
                sandbox=""
                srcDoc={previewSrcDoc}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
