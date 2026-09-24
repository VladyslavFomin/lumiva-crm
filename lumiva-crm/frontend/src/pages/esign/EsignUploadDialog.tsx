// src/pages/esign/EsignUploadDialog.tsx
// Archive of already-signed documents received from a counterparty: upload a PDF + metadata,
// or (edit mode) change the metadata of an already archived one.
import React, { useEffect, useRef, useState } from 'react';
import {
  fetchEsignDocument,
  searchEsignLinkOptions,
  updateUploadedEsignDocument,
  uploadSignedEsignDocument,
  type EsignLinkOption,
  type EsignUploadMeta,
} from '../../api/esign';
import { Ic, ESN_ICON } from './EsignIcons';

const MAX_BYTES = 20 * 1024 * 1024;
const CURRENCIES = ['EUR', 'USD', 'TRY', 'RUB', 'UAH', 'GBP'];

const cx = (...a: Array<string | false | undefined>) => a.filter(Boolean).join(' ');
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function fmtBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

interface Props {
  t: (k: string, o?: any) => string;
  /** null → upload a new file; otherwise edit the metadata of this archived document */
  documentId: string | null;
  kindOptions: string[];
  onClose: () => void;
  onSaved: () => void;
  showAlert: (msg: string, opts?: any) => void;
}

export const EsignUploadDialog: React.FC<Props> = ({ t, documentId, kindOptions, onClose, onSaved, showAlert }) => {
  const editing = !!documentId;
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [title, setTitle] = useState('');
  const [titleTouched, setTitleTouched] = useState(false);
  const [kind, setKind] = useState('Договор');
  const [company, setCompany] = useState<EsignLinkOption | null>(null);
  const [companyQ, setCompanyQ] = useState('');
  const [companyOpts, setCompanyOpts] = useState<EsignLinkOption[]>([]);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [signedAt, setSignedAt] = useState(todayISO());
  const [docNo, setDocNo] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!documentId) return;
    let cancelled = false;
    fetchEsignDocument(documentId)
      .then((d) => {
        if (cancelled) return;
        setTitle(d.title || '');
        setTitleTouched(true);
        setFileName(d.fileName || '');
        setKind(d.kind || 'Договор');
        if (d.entityType === 'company' && d.entityId) setCompany({ id: d.entityId, name: d.entityLabel || '—' });
        setSignedAt(d.signedAt ? d.signedAt.slice(0, 10) : todayISO());
        setDocNo(d.extraFields?.CONTRACT_NO || '');
        setAmount(d.amount ? String(parseFloat(d.amount)) : '');
        setCurrency(d.currency || 'EUR');
        setNotes(d.notes || '');
      })
      .catch((e: any) => {
        showAlert(e?.message || t('crm.esign.errors.loadDocs'), { variant: 'error' });
        onClose();
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  // company autocomplete (debounced)
  useEffect(() => {
    if (!companyOpen) return;
    let cancelled = false;
    const id = window.setTimeout(() => {
      searchEsignLinkOptions('company', companyQ)
        .then((r) => !cancelled && setCompanyOpts(r))
        .catch(() => !cancelled && setCompanyOpts([]));
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [companyQ, companyOpen]);

  const pickFile = (f: File | null | undefined) => {
    if (!f) return;
    const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
    if (!isPdf) {
      showAlert(t('crm.esign.upload.errNotPdf'), { variant: 'error' });
      return;
    }
    if (f.size > MAX_BYTES) {
      showAlert(t('crm.esign.upload.errTooBig'), { variant: 'error' });
      return;
    }
    setFile(f);
    if (!titleTouched) setTitle(f.name.replace(/\.pdf$/i, ''));
  };

  const missingFile = !editing && !file;
  const missingCompany = !company;
  const missingDate = !signedAt;
  const invalid = missingFile || missingCompany || missingDate;

  const save = async () => {
    setSubmitted(true);
    if (invalid) return;
    const meta: EsignUploadMeta = {
      title: title.trim(),
      kind: kind.trim() || 'Договор',
      companyId: company!.id,
      signedAt,
      docNo: docNo.trim(),
      amount: amount.trim(),
      currency,
      notes: notes.trim(),
    };
    setSaving(true);
    try {
      if (editing) await updateUploadedEsignDocument(documentId!, meta);
      else await uploadSignedEsignDocument(file!, meta);
      onSaved();
      onClose();
    } catch (e: any) {
      showAlert(e?.message || t('crm.esign.upload.errSave'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="md-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="md-overlay-panel">
        <div className="md-overlay-head">
          <h3>{editing ? t('crm.esign.upload.titleEdit') : t('crm.esign.upload.title')}</h3>
          <button type="button" className="md-ib" onClick={onClose} aria-label={t('crm.esign.confirm.cancelLabel')}>
            <Ic d={ESN_ICON.x} size={13} />
          </button>
        </div>
        <div className="md-overlay-body">
          {loading ? (
            <div aria-busy="true">
              <div className="md-skel" style={{ height: 64, marginBottom: 14 }} />
              <div className="md-skel" style={{ height: 40, marginBottom: 10 }} />
              <div className="md-skel" style={{ height: 40, width: '80%', marginBottom: 10 }} />
              <div className="md-skel" style={{ height: 40, width: '60%' }} />
            </div>
          ) : (
            <>
              <div className="md-note plain" style={{ marginBottom: 14 }}>
                <Ic d={ESN_ICON.doc} size={14} />
                {t('crm.esign.upload.intro')}
              </div>

              {!editing ? (
                <>
                  <div
                    className={cx('md-drop', dragOver && 'over', !!file && 'has', submitted && missingFile && 'err')}
                    role="button"
                    tabIndex={0}
                    onClick={() => fileRef.current?.click()}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click(); } }}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      pickFile(e.dataTransfer.files?.[0]);
                    }}
                  >
                    <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ''; }} />
                    {file ? (
                      <div className="md-file" style={{ justifyContent: 'center' }}>
                        <div className="ico">PDF</div>
                        <div style={{ minWidth: 0, textAlign: 'left' }}>
                          <div className="fn">{file.name}</div>
                          <div className="fm">{fmtBytes(file.size)} · {t('crm.esign.upload.replaceFile')}</div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Ic d={ESN_ICON.upload} size={20} />
                        <div className="t">{t('crm.esign.upload.dropTitle')}</div>
                        <div className="s">{t('crm.esign.upload.dropHint')}</div>
                      </>
                    )}
                  </div>
                  {submitted && missingFile && <div className="md-err">{t('crm.esign.upload.errNoFile')}</div>}
                </>
              ) : (
                <div className="md-file" style={{ marginBottom: 4 }}>
                  <div className="ico">PDF</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="fn">{fileName || '—'}</div>
                    <div className="fm">{t('crm.esign.upload.fileFixed')}</div>
                  </div>
                </div>
              )}

              <div className="md-f" style={{ marginTop: 14 }}>
                <label>{t('crm.esign.upload.companyLabel')} *</label>
                {company ? (
                  <div className="md-picked">
                    <span className="nm">{company.name}</span>
                    <button type="button" className="md-ib" onClick={() => { setCompany(null); setCompanyQ(''); setCompanyOpen(true); }} aria-label={t('crm.esign.upload.companyChange')}>
                      <Ic d={ESN_ICON.x} size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="md-combo">
                    <input
                      className={cx('md-in', submitted && missingCompany && 'err')}
                      placeholder={t('crm.esign.upload.companyPlaceholder')}
                      value={companyQ}
                      onFocus={() => setCompanyOpen(true)}
                      onChange={(e) => { setCompanyQ(e.target.value); setCompanyOpen(true); }}
                      onBlur={() => window.setTimeout(() => setCompanyOpen(false), 150)}
                    />
                    {companyOpen && (
                      <div className="md-combo-list">
                        {companyOpts.length === 0 ? (
                          <div className="md-combo-empty">{t('crm.esign.upload.companyEmpty')}</div>
                        ) : (
                          companyOpts.map((o) => (
                            <button
                              key={o.id}
                              type="button"
                              className="md-combo-item"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => { setCompany(o); setCompanyOpen(false); }}
                            >
                              {o.name}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
                {submitted && missingCompany && <div className="md-err">{t('crm.esign.upload.errNoCompany')}</div>}
              </div>

              <div className="md-fields2">
                <div className="md-f">
                  <label>{t('crm.esign.upload.kindLabel')}</label>
                  <input className="md-in" list="esn-upload-kinds" value={kind} maxLength={64} onChange={(e) => setKind(e.target.value)} />
                  <datalist id="esn-upload-kinds">
                    {kindOptions.map((k) => (
                      <option key={k} value={k} />
                    ))}
                  </datalist>
                </div>
                <div className="md-f">
                  <label>{t('crm.esign.upload.signedAtLabel')} *</label>
                  <input className={cx('md-in', submitted && missingDate && 'err')} type="date" value={signedAt} max="2100-01-01" onChange={(e) => setSignedAt(e.target.value)} />
                </div>
                <div className="md-f">
                  <label>{t('crm.esign.upload.numberLabel')}</label>
                  <input className="md-in" value={docNo} maxLength={64} placeholder={t('crm.esign.upload.numberPlaceholder')} onChange={(e) => setDocNo(e.target.value)} />
                </div>
                <div className="md-f">
                  <label>{t('crm.esign.upload.amountLabel')}</label>
                  <div className="md-amt">
                    <input className="md-in" inputMode="decimal" value={amount} placeholder="0.00" onChange={(e) => setAmount(e.target.value.replace(/[^\d.,\s]/g, ''))} />
                    <select className="md-sel" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                      {(CURRENCIES.includes(currency) ? CURRENCIES : [currency, ...CURRENCIES]).map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="md-f">
                <label>{t('crm.esign.upload.titleLabel')}</label>
                <input className="md-in" value={title} maxLength={255} placeholder={t('crm.esign.upload.titlePlaceholder')} onChange={(e) => { setTitle(e.target.value); setTitleTouched(true); }} />
              </div>
              <div className="md-f">
                <label>{t('crm.esign.upload.notesLabel')}</label>
                <textarea className="md-in" rows={3} value={notes} maxLength={5000} placeholder={t('crm.esign.upload.notesPlaceholder')} onChange={(e) => setNotes(e.target.value)} style={{ resize: 'vertical' }} />
              </div>
            </>
          )}
        </div>
        <div className="md-overlay-foot">
          <button type="button" className="btn btn-sm" onClick={onClose}>
            {t('crm.esign.confirm.cancelLabel')}
          </button>
          <button type="button" className="btn btn-sm btn-primary" onClick={save} disabled={saving || loading}>
            {saving ? t('crm.esign.templatesTab.savingBtn') : editing ? t('crm.esign.upload.saveBtn') : t('crm.esign.upload.uploadBtn')}
          </button>
        </div>
      </div>
    </div>
  );
};
