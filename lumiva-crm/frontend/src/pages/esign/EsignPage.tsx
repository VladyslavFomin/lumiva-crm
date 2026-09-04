// src/pages/esign/EsignPage.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import {
  fetchEsignDocuments,
  fetchEsignDocument,
  fetchEsignKeys,
  fetchEsignAutoValues,
  issueEsignDocument,
  updateEsignDocument,
  sendEsignDocument,
  duplicateEsignDocument,
  openEsignDocumentFile,
  downloadEsignDocumentFile,
  fetchEsignTemplates,
  createEsignTemplate,
  updateEsignTemplate,
  deleteEsignTemplate,
  fetchEsignNextContractNo,
  fetchEsignAmountSuggestions,
  type EsignDocumentRow,
  type EsignDocumentDetail,
  type EsignTemplate,
  type EsignKeyGroup,
  type EsignStatus,
  type EsignItemPick,
  type EsignAmountSuggestion,
} from '../../api/esign';
import { fetchContacts } from '../../api/contacts';
import type { Contact } from '../../api/contacts';
import { fetchProducts } from '../../api/products';
import type { Product } from '../../api/products';
import { fetchBookingServices, fetchBookingStaff } from '../../api/bookings';
import type { BookingServiceItem, BookingStaffProfile } from '../../api/bookings';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { Ic, ESN_ICON } from './EsignIcons';
import './esign-design.css';

const cx = (...a: Array<string | false | undefined>) => a.filter(Boolean).join(' ');

const KIND_OPTIONS = ['Договор', 'Счёт', 'Акт', 'Согласие', 'Оферта', 'Доверенность'];
/** {CONTRACT_NO} is auto-assigned server-side from the tenant's sequence — never a manual
 * field (mirrors backend ESIGN_SEQUENCE_KEYS in esign-keys.ts). */
const SEQUENCE_KEYS = new Set(['CONTRACT_NO']);
const DEFAULT_FILE_PATTERN = '{KIND}-{NAME}-{CONTRACT_DATE}';
const KEY_TOKEN_RE = /\{([A-Z][A-Z0-9_]*)\}/g;

function extractKeysFE(text: string): string[] {
  const found = text.match(KEY_TOKEN_RE) || [];
  return [...new Set(found.map((f) => f.slice(1, -1)))];
}

function initials(name: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function money(n: number): string {
  return n.toLocaleString('ru-RU');
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} Б`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} КБ`;
  return `${(kb / 1024).toFixed(1)} МБ`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

interface PickedItem {
  kind: 'product' | 'service';
  refId: string;
  name: string;
  sku?: string | null;
  price: string;
  currency: string;
  durationMinutes?: number | null;
  masterId?: string | null;
  masterName?: string | null;
}

/** Mirrors backend `computeItemValues` (esign-items.ts) so the wizard's live preview matches
 * exactly what the server will render once the document is actually issued. */
function computeItemValuesFE(items: PickedItem[]): Record<string, string> {
  const values: Record<string, string> = {};
  const products = items.filter((i) => i.kind === 'product');
  const services = items.filter((i) => i.kind === 'service');

  if (products[0]) {
    values.PRODUCT_NAME = products[0].name;
    values.PRODUCT_SKU = products[0].sku || '';
    values.PRODUCT_PRICE = `${money(parseFloat(products[0].price))} ${products[0].currency}`;
  }
  if (products.length) {
    values.PRODUCTS_LIST = products.map((p) => `${p.name}${p.sku ? ` (${p.sku})` : ''} — ${money(parseFloat(p.price))} ${p.currency}`).join('\n');
    values.PRODUCTS_TOTAL = `${money(products.reduce((s, p) => s + parseFloat(p.price), 0))} ${products[0].currency}`;
  }

  if (services[0]) {
    values.BOOKING_SERVICE_NAME = services[0].name;
    values.BOOKING_SERVICE_PRICE = `${money(parseFloat(services[0].price))} ${services[0].currency}`;
    values.BOOKING_SERVICE_DURATION = services[0].durationMinutes ? `${services[0].durationMinutes} мин` : '';
    values.BOOKING_SERVICE_MASTER = services[0].masterName || '';
  }
  if (services.length) {
    values.BOOKING_SERVICES_LIST = services
      .map((s) => `${s.name}${s.masterName ? ` (${s.masterName})` : ''} — ${money(parseFloat(s.price))} ${s.currency}`)
      .join('\n');
    values.BOOKING_SERVICES_TOTAL = `${money(services.reduce((s, x) => s + parseFloat(x.price), 0))} ${services[0].currency}`;
  }

  return values;
}

const RenderedBody: React.FC<{ body: string; values?: Record<string, string> }> = ({ body, values }) => {
  const parts = body.split(/(\{[A-Z][A-Z0-9_]*\})/g);
  return (
    <div className="md-paper">
      {parts.map((p, i) => {
        if (!/^\{[A-Z][A-Z0-9_]*\}$/.test(p)) return <React.Fragment key={i}>{p}</React.Fragment>;
        if (!values) return (
          <span key={i} className="md-tok">
            {p}
          </span>
        );
        const key = p.slice(1, -1);
        const v = values[key];
        return v ? (
          <span key={i} className="md-tok filled">
            {v}
          </span>
        ) : (
          <span key={i} className="md-tok miss">
            {p}
          </span>
        );
      })}
    </div>
  );
};

/** Free-text edit of an already-issued draft's final text — draft-only on the backend, since
 * a sent document's text is part of the audit trail of what the signer saw. */
const EditDocumentPanel: React.FC<{
  t: (k: string, o?: any) => string;
  documentId: string;
  keyGroups: EsignKeyGroup[];
  groupLabel: Record<string, string>;
  onClose: () => void;
  onSaved: (doc: EsignDocumentDetail) => void;
  showAlert: (msg: string, opts?: any) => void;
}> = ({ t, documentId, keyGroups, groupLabel, onClose, onSaved, showAlert }) => {
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ client: true });
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchEsignDocument(documentId)
      .then(async (d) => {
        if (cancelled) return;
        setBody(d.bodyText);
        const auto = await fetchEsignAutoValues(d.contactId).catch(() => ({}));
        if (cancelled) return;
        const itemValues = computeItemValuesFE((d.items || []) as PickedItem[]);
        setValues({ ...auto, ...itemValues, ...(d.extraFields || {}) });
      })
      .catch((e: any) => showAlert(e?.message || t('crm.esign.errors.loadDocs'), { variant: 'error' }))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  const toggleGroup = (g: string) => setOpenGroups((s) => ({ ...s, [g]: !s[g] }));

  const insertKey = (key: string) => {
    const token = values[key] || `{${key}}`;
    const el = taRef.current;
    const start = el?.selectionStart ?? body.length;
    const end = el?.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = start + token.length;
      el.selectionStart = el.selectionEnd = pos;
    });
  };

  const save = async () => {
    if (!body.trim()) return;
    setSaving(true);
    try {
      const updated = await updateEsignDocument(documentId, { bodyText: body.trim() });
      onSaved(updated);
      onClose();
    } catch (e: any) {
      showAlert(e?.message || t('crm.esign.errors.saveDoc'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="md-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="md-overlay-panel md-overlay-panel-wide">
        <div className="md-overlay-head">
          <h3>{t('crm.esign.editDoc.title')}</h3>
          <button type="button" className="md-ib" onClick={onClose}>
            <Ic d={ESN_ICON.x} size={13} />
          </button>
        </div>
        <div className="md-overlay-body md-overlay-body-split">
          {loading ? (
            <div className="hint">{t('crm.esign.docsTab.loading')}</div>
          ) : (
            <>
              <div className="md-overlay-main">
                <textarea ref={taRef} className="md-ta" value={body} onChange={(e) => setBody(e.target.value)} spellCheck={false} autoFocus />
                <div className="hint" style={{ marginTop: 8 }}>
                  {t('crm.esign.editDoc.hint')}
                </div>
              </div>
              <div className="md-keys">
                <div className="md-note plain" style={{ marginBottom: 14 }}>
                  <Ic d={ESN_ICON.brace} size={14} />
                  {t('crm.esign.editDoc.keysHint')}
                </div>
                {keyGroups.map((g) => {
                  const open = !!openGroups[g.group];
                  return (
                    <div key={g.group} className="md-key-group">
                      <button type="button" className={cx('md-key-group-head', open && 'open')} onClick={() => toggleGroup(g.group)}>
                        <span className="lbl">{groupLabel[g.group]}</span>
                        <Ic d={ESN_ICON.chevDown} size={13} />
                      </button>
                      {open && (
                        <div className="md-key-group-body">
                          {g.keys.map((k) => (
                            <button key={k.key} type="button" className="md-key" onClick={() => insertKey(k.key)} title={t('crm.esign.templatesTab.insertTitle')}>
                              <code style={{ color: values[k.key] ? 'var(--ink)' : 'var(--fg-2)' }}>{`{${k.key}}`}</code>
                              <span>{values[k.key] || k.label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
        <div className="md-overlay-foot">
          <button type="button" className="btn btn-sm" onClick={onClose}>
            {t('crm.esign.confirm.cancelLabel')}
          </button>
          <button type="button" className="btn btn-sm btn-primary" onClick={save} disabled={saving || loading || !body.trim()}>
            {saving ? t('crm.esign.templatesTab.savingBtn') : t('crm.esign.editDoc.saveBtn')}
          </button>
        </div>
      </div>
    </div>
  );
};

const Card: React.FC<{
  icon?: React.ReactNode;
  title?: React.ReactNode;
  sub?: React.ReactNode;
  right?: React.ReactNode;
  foot?: React.ReactNode;
  children?: React.ReactNode;
}> = ({ icon, title, sub, right, foot, children }) => (
  <div className="md-card">
    {(title || right) && (
      <div className="md-card-head">
        <div>
          <h3>
            {icon}
            {title}
          </h3>
          {sub && <div className="sub">{sub}</div>}
        </div>
        {right}
      </div>
    )}
    {children}
    {foot && <div className="md-foot">{foot}</div>}
  </div>
);

const STATUS_CLS: Record<EsignStatus, 'ok' | 'wait' | 'draft' | 'bad'> = {
  draft: 'draft',
  sent: 'wait',
  viewed: 'wait',
  signed: 'ok',
  declined: 'bad',
  expired: 'bad',
};

export const EsignPage: React.FC = () => {
  const { t } = useTranslation();
  const { showAlert, showConfirm } = useAlertModal();
  const [tab, setTab] = useState<'docs' | 'tpl' | 'issue'>('docs');

  const STATUS_LABEL: Record<EsignStatus, string> = {
    draft: t('crm.esign.status.draft'),
    sent: t('crm.esign.status.sent'),
    viewed: t('crm.esign.status.viewed'),
    signed: t('crm.esign.status.signed'),
    declined: t('crm.esign.status.declined'),
    expired: t('crm.esign.status.expired'),
  };
  const KIND_LABEL_ALL = t('crm.esign.docsTab.kindAll');

  // ── shared data ─────────────────────────────────────────
  const [documents, setDocuments] = useState<EsignDocumentRow[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [templates, setTemplates] = useState<EsignTemplate[]>([]);
  const [tplLoading, setTplLoading] = useState(true);
  const [keyGroups, setKeyGroups] = useState<EsignKeyGroup[]>([]);

  const loadDocuments = () => {
    setDocsLoading(true);
    fetchEsignDocuments()
      .then(setDocuments)
      .catch((e: any) => showAlert(e?.message || t('crm.esign.errors.loadDocs'), { variant: 'error' }))
      .finally(() => setDocsLoading(false));
  };
  const loadTemplates = () => {
    setTplLoading(true);
    fetchEsignTemplates()
      .then(setTemplates)
      .catch((e: any) => showAlert(e?.message || t('crm.esign.errors.loadTemplates'), { variant: 'error' }))
      .finally(() => setTplLoading(false));
  };

  useEffect(() => {
    loadDocuments();
    loadTemplates();
    fetchEsignKeys().then(setKeyGroups).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const autoKeySet = useMemo(() => {
    const s = new Set<string>();
    keyGroups
      .filter((g) => g.group === 'client' || g.group === 'org')
      .forEach((g) => g.keys.forEach((k) => s.add(k.key)));
    return s;
  }, [keyGroups]);

  const itemKeySet = useMemo(() => {
    const s = new Set<string>();
    keyGroups
      .filter((g) => g.group === 'product' || g.group === 'service')
      .forEach((g) => g.keys.forEach((k) => s.add(k.key)));
    return s;
  }, [keyGroups]);

  const productKeySet = useMemo(() => new Set((keyGroups.find((g) => g.group === 'product')?.keys || []).map((k) => k.key)), [keyGroups]);
  const serviceKeySet = useMemo(() => new Set((keyGroups.find((g) => g.group === 'service')?.keys || []).map((k) => k.key)), [keyGroups]);

  const keyLabel = useMemo(() => {
    const map: Record<string, string> = {};
    keyGroups.forEach((g) => g.keys.forEach((k) => (map[k.key] = k.label)));
    return map;
  }, [keyGroups]);

  const GROUP_LABEL: Record<string, string> = {
    client: t('crm.esign.keys.groupClient'),
    contract: t('crm.esign.keys.groupContract'),
    org: t('crm.esign.keys.groupOrg'),
    product: t('crm.esign.keys.groupProduct'),
    service: t('crm.esign.keys.groupService'),
  };

  const TABS = [
    { id: 'docs' as const, label: t('crm.esign.pageTabs.docs'), n: documents.length },
    { id: 'tpl' as const, label: t('crm.esign.pageTabs.templates'), n: templates.length },
    { id: 'issue' as const, label: t('crm.esign.pageTabs.issue'), n: null },
  ];

  return (
    <MainLayout>
      <PageHelpButton topic="esign" />
      <div className="px-scope">
        <div className="esn-hero">
          <div>
            <div className="kicker">
              <span className="dot" />
              {t('crm.esign.page.kicker')}
            </div>
            <h1>{t('crm.esign.page.title')}</h1>
            <p className="sub">{t('crm.esign.page.subtitle')}</p>
          </div>
          <div className="esn-hero-r">
            <button type="button" className="btn btn-sm" onClick={() => setTab('tpl')}>
              <Ic d={ESN_ICON.doc} size={13} />
              {t('crm.esign.page.templatesBtn')}
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setTab('issue')}>
              <Ic d={ESN_ICON.plus} size={13} />
              {t('crm.esign.page.newDocBtn')}
            </button>
          </div>
        </div>

        <div className="view-tabs">
          {TABS.map((tb) => (
            <button key={tb.id} type="button" className={cx('view-tab', tab === tb.id && 'active')} onClick={() => setTab(tb.id)}>
              {tb.label}
              {tb.n !== null && <span className="badge">{tb.n}</span>}
            </button>
          ))}
        </div>

        {tab === 'docs' && (
          <DocsTab
            t={t}
            documents={documents}
            loading={docsLoading}
            templatesCount={templates.length}
            templatesUpdated={templates.reduce<string | null>((acc, tpl) => (!acc || tpl.updatedAt > acc ? tpl.updatedAt : acc), null)}
            statusLabel={STATUS_LABEL}
            kindAllLabel={KIND_LABEL_ALL}
            keyGroups={keyGroups}
            groupLabel={GROUP_LABEL}
            onIssue={() => setTab('issue')}
            onChanged={loadDocuments}
            showAlert={showAlert}
          />
        )}
        {tab === 'tpl' && (
          <TemplatesTab
            t={t}
            templates={templates}
            loading={tplLoading}
            keyGroups={keyGroups}
            groupLabel={GROUP_LABEL}
            onChanged={loadTemplates}
            showAlert={showAlert}
            showConfirm={showConfirm}
          />
        )}
        {tab === 'issue' && (
          <IssueTab
            t={t}
            templates={templates}
            keyGroups={keyGroups}
            groupLabel={GROUP_LABEL}
            keyLabel={keyLabel}
            autoKeySet={autoKeySet}
            itemKeySet={itemKeySet}
            productKeySet={productKeySet}
            serviceKeySet={serviceKeySet}
            onIssued={loadDocuments}
            showAlert={showAlert}
          />
        )}
      </div>
    </MainLayout>
  );
};

/* ─────────────────────────── Документы ─────────────────────────── */

const DocsTab: React.FC<{
  t: (k: string, o?: any) => string;
  documents: EsignDocumentRow[];
  loading: boolean;
  templatesCount: number;
  templatesUpdated: string | null;
  statusLabel: Record<EsignStatus, string>;
  kindAllLabel: string;
  keyGroups: EsignKeyGroup[];
  groupLabel: Record<string, string>;
  onIssue: () => void;
  onChanged: () => void;
  showAlert: (msg: string, opts?: any) => void;
}> = ({ t, documents, loading, templatesCount, templatesUpdated, statusLabel, kindAllLabel, keyGroups, groupLabel, onIssue, onChanged, showAlert }) => {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<string>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  const kinds = useMemo(() => ['all', ...Array.from(new Set(documents.map((d) => d.kind)))], [documents]);

  const rows = documents.filter((d) => {
    if (kind !== 'all' && d.kind !== kind) return false;
    if (q) {
      const hay = `${d.contactName || ''} ${d.contactCompany || ''} ${d.docNo || ''} ${d.fileName || ''}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  const now = new Date();
  const thisMonthCount = documents.filter((d) => {
    const c = new Date(d.createdAt);
    return c.getFullYear() === now.getFullYear() && c.getMonth() === now.getMonth();
  }).length;

  const amounts = documents.filter((d) => d.amount);
  const totalAmount = amounts.reduce((s, d) => s + parseFloat(d.amount as string), 0);
  const currencyCounts = new Map<string, number>();
  amounts.forEach((d) => {
    if (d.currency) currencyCounts.set(d.currency, (currencyCounts.get(d.currency) || 0) + 1);
  });
  const mainCurrency = [...currencyCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';

  const pendingCount = documents.filter((d) => d.status === 'sent' || d.status === 'viewed').length;

  const kpis: Array<[string, React.ReactNode, string]> = [
    [t('crm.esign.kpis.docsCount'), documents.length, t('crm.esign.kpis.docsHint', { count: thisMonthCount })],
    [t('crm.esign.kpis.totalAmount'), `${money(totalAmount)}${mainCurrency ? ` ${mainCurrency}` : ''}`, t('crm.esign.kpis.totalAmountHint')],
    [t('crm.esign.kpis.pending'), pendingCount, t('crm.esign.kpis.pendingHint')],
    [t('crm.esign.kpis.templatesCount'), templatesCount, templatesUpdated ? t('crm.esign.kpis.templatesHint', { date: fmtDate(templatesUpdated) }) : t('crm.esign.kpis.templatesHintEmpty')],
  ];

  const act = async (id: string, fn: () => Promise<void>) => {
    setBusyId(id);
    try {
      await fn();
    } catch (e: any) {
      showAlert(e?.message || t('crm.esign.errors.actionFailed'), { variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="esn-kpis">
        {kpis.map(([k, v, d]) => (
          <div className="esn-kpi" key={k}>
            <div className="l">{k}</div>
            <div className="v">{v}</div>
            <div className="d">{d}</div>
          </div>
        ))}
      </div>

      <Card>
        <div className="md-bar">
          <div className="md-search">
            <Ic d={ESN_ICON.search} size={14} />
            <input placeholder={t('crm.esign.docsTab.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="md-seg">
            {kinds.map((k) => (
              <button key={k} className={cx(kind === k && 'on')} onClick={() => setKind(k)} type="button">
                {k === 'all' ? kindAllLabel : k}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-sm btn-primary" onClick={onIssue}>
            <Ic d={ESN_ICON.plus} size={13} />
            {t('crm.esign.page.newDocBtn')}
          </button>
        </div>

        {loading ? (
          <div className="md-empty">{t('crm.esign.docsTab.loading')}</div>
        ) : rows.length === 0 ? (
          <div className="md-empty">
            <div className="t">{documents.length === 0 ? t('crm.esign.docsTab.emptyTitleNone') : t('crm.esign.docsTab.emptyTitleFiltered')}</div>
            {t('crm.esign.docsTab.emptyBody')}
          </div>
        ) : (
          <div className="md-tbl-wrap">
          <table className="md-tbl">
            <thead>
              <tr>
                <th>{t('crm.esign.docsTab.colCreated')}</th>
                <th>{t('crm.esign.docsTab.colClient')}</th>
                <th>{t('crm.esign.docsTab.colType')}</th>
                <th className="r">{t('crm.esign.docsTab.colAmount')}</th>
                <th>{t('crm.esign.docsTab.colFile')}</th>
                <th>{t('crm.esign.docsTab.colStatus')}</th>
                <th className="r" />
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const disabled = busyId === d.id;
                const canSend = d.status !== 'signed' && d.status !== 'declined';
                return (
                  <tr key={d.id}>
                    <td>
                      <div className="num">{fmtDate(d.createdAt)}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--fg-3)', fontFamily: 'var(--ff-mono)', marginTop: 2 }}>
                        {fmtTime(d.createdAt)} {d.docNo ? `· ${d.docNo}` : ''}
                      </div>
                    </td>
                    <td>
                      <div className="md-cl">
                        <div className="md-av">{initials(d.contactName)}</div>
                        <div style={{ minWidth: 0 }}>
                          <div className="nm">{d.contactName || t('crm.esign.docsTab.noClient')}</div>
                          <div className="cm">{d.contactCompany || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="md-st">{d.kind}</span>
                    </td>
                    <td className="sum">{d.amount ? `${money(parseFloat(d.amount))} ${d.currency || ''}` : <span style={{ color: 'var(--fg-4)', fontWeight: 400 }}>—</span>}</td>
                    <td>
                      <div className="md-file">
                        <div className="ico">PDF</div>
                        <div style={{ minWidth: 0 }}>
                          <div className="fn">{d.fileName || '—'}</div>
                          <div className="fm">{fmtSize(d.fileSizeBytes)}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={cx('md-st', STATUS_CLS[d.status])}>
                        <span className="dot" />
                        {statusLabel[d.status]}
                      </span>
                    </td>
                    <td>
                      <div className="md-acts">
                        {d.status === 'draft' && (
                          <button className="md-ib" title={t('crm.esign.docsTab.actionEdit')} disabled={disabled} type="button" onClick={() => setEditId(d.id)}>
                            <Ic d={ESN_ICON.pencil} size={13} />
                          </button>
                        )}
                        <button
                          className="md-ib"
                          title={t('crm.esign.docsTab.actionOpen')}
                          disabled={disabled}
                          type="button"
                          onClick={() => act(d.id, () => openEsignDocumentFile(d.id))}
                        >
                          <Ic d={ESN_ICON.eye} size={13} />
                        </button>
                        <button
                          className="md-ib"
                          title={t('crm.esign.docsTab.actionDownload')}
                          disabled={disabled}
                          type="button"
                          onClick={() => act(d.id, () => downloadEsignDocumentFile(d.id, d.fileName || 'document.pdf'))}
                        >
                          <Ic d={ESN_ICON.download} size={13} />
                        </button>
                        <button
                          className="md-ib"
                          title={!canSend ? t('crm.esign.docsTab.actionSendDisabled') : d.status === 'draft' ? t('crm.esign.docsTab.actionSend') : t('crm.esign.docsTab.actionResend')}
                          disabled={disabled || !canSend}
                          type="button"
                          onClick={() =>
                            act(d.id, async () => {
                              await sendEsignDocument(d.id);
                              onChanged();
                            })
                          }
                        >
                          <Ic d={ESN_ICON.sign} size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
        {!loading && rows.length > 0 && (
          <div className="md-foot">
            <span>{t('crm.esign.docsTab.footShowing', { shown: rows.length, total: documents.length })}</span>
          </div>
        )}
      </Card>

      {editId && (
        <EditDocumentPanel t={t} documentId={editId} keyGroups={keyGroups} groupLabel={groupLabel} onClose={() => setEditId(null)} onSaved={onChanged} showAlert={showAlert} />
      )}
    </>
  );
};

/* ─────────────────────────── Шаблоны ─────────────────────────── */

const TemplatesTab: React.FC<{
  t: (k: string, o?: any) => string;
  templates: EsignTemplate[];
  loading: boolean;
  keyGroups: EsignKeyGroup[];
  groupLabel: Record<string, string>;
  onChanged: () => void;
  showAlert: (msg: string, opts?: any) => void;
  showConfirm: (msg: string, opts?: any) => Promise<boolean>;
}> = ({ t, templates, loading, keyGroups, groupLabel, onChanged, showAlert, showConfirm }) => {
  const [selId, setSelId] = useState<string | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [mode, setMode] = useState<'edit' | 'view'>('edit');
  const [name, setName] = useState('');
  const [kindVal, setKindVal] = useState('Договор');
  const [fileNamePattern, setFileNamePattern] = useState(DEFAULT_FILE_PATTERN);
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ client: true });
  const taRef = useRef<HTMLTextAreaElement>(null);

  const toggleGroup = (g: string) => setOpenGroups((s) => ({ ...s, [g]: !s[g] }));

  useEffect(() => {
    if (!templates.length) return;
    if (!selId && !creatingNew) setSelId(templates[0].id);
  }, [templates, selId, creatingNew]);

  const selected = templates.find((tpl) => tpl.id === selId) || null;

  useEffect(() => {
    if (creatingNew) return;
    if (selected) {
      setName(selected.name);
      setKindVal(selected.kind);
      setFileNamePattern(selected.fileNamePattern || DEFAULT_FILE_PATTERN);
      setBody(selected.bodyTemplate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId]);

  const startNew = () => {
    setCreatingNew(true);
    setSelId(null);
    setName('');
    setKindVal('Договор');
    setFileNamePattern(DEFAULT_FILE_PATTERN);
    setBody('');
    setMode('edit');
  };

  const usedKeys = useMemo(() => new Set(extractKeysFE(body)), [body]);

  const insertKey = (key: string) => {
    const token = `{${key}}`;
    const el = taRef.current;
    if (mode === 'edit' && el) {
      const start = el.selectionStart ?? body.length;
      const end = el.selectionEnd ?? body.length;
      const next = body.slice(0, start) + token + body.slice(end);
      setBody(next);
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + token.length;
        el.selectionStart = el.selectionEnd = pos;
      });
    } else {
      setBody((b) => b + token);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !body.trim()) return;
    setSaving(true);
    try {
      if (creatingNew) {
        const created = await createEsignTemplate({ name: name.trim(), kind: kindVal, bodyTemplate: body.trim(), fileNamePattern: fileNamePattern.trim() || DEFAULT_FILE_PATTERN });
        onChanged();
        setCreatingNew(false);
        setSelId(created.id);
      } else if (selId) {
        await updateEsignTemplate(selId, { name: name.trim(), kind: kindVal, bodyTemplate: body.trim(), fileNamePattern: fileNamePattern.trim() || DEFAULT_FILE_PATTERN });
        onChanged();
      }
    } catch (e: any) {
      showAlert(e?.message || t('crm.esign.errors.saveTemplate'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selId) return;
    const ok = await showConfirm(t('crm.esign.confirm.deleteTemplateBody'), {
      title: t('crm.esign.confirm.deleteTemplateTitle'),
      confirmLabel: t('crm.esign.confirm.deleteConfirmLabel'),
      cancelLabel: t('crm.esign.confirm.cancelLabel'),
      danger: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteEsignTemplate(selId);
      setSelId(null);
      onChanged();
    } catch (e: any) {
      showAlert(e?.message || t('crm.esign.errors.deleteTemplate'), { variant: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="md-split">
      <Card title={t('crm.esign.templatesTab.heading')} right={
        <button type="button" className="btn btn-sm" onClick={startNew}>
          <Ic d={ESN_ICON.plus} size={12} />
          {t('crm.esign.templatesTab.newTemplateBtn')}
        </button>
      }>
        <div className="md-list">
          {loading && <div className="md-empty">{t('crm.esign.docsTab.loading')}</div>}
          {!loading &&
            templates.map((tpl) => (
              <div key={tpl.id} className={cx('md-li', !creatingNew && selId === tpl.id && 'on')} onClick={() => { setCreatingNew(false); setSelId(tpl.id); }}>
                <div>
                  <div className="t">{tpl.name}</div>
                  <div className="d">
                    {tpl.kind} · {t('crm.esign.templatesTab.updatedPrefix')} {fmtDate(tpl.updatedAt)}
                  </div>
                </div>
              </div>
            ))}
        </div>
        <div className="md-foot">
          <span>{t('crm.esign.templatesTab.listHint')}</span>
        </div>
      </Card>

      {(selected || creatingNew) && (
        <Card
          icon={<Ic d={ESN_ICON.doc} size={15} />}
          title={creatingNew ? t('crm.esign.templatesTab.newTemplateBtn') : selected!.name}
          sub={creatingNew ? undefined : t('crm.esign.templatesTab.subHint', { file: `${(selected!.fileNamePattern || DEFAULT_FILE_PATTERN)}.pdf`, keys: extractKeysFE(selected!.bodyTemplate).length })}
          right={
            <div className="md-seg">
              <button type="button" className={cx(mode === 'edit' && 'on')} onClick={() => setMode('edit')}>
                {t('crm.esign.templatesTab.modeText')}
              </button>
              <button type="button" className={cx(mode === 'view' && 'on')} onClick={() => setMode('view')}>
                {t('crm.esign.templatesTab.modeView')}
              </button>
            </div>
          }
          foot={
            <>
              <span>{t('crm.esign.templatesTab.autosaveHint')}</span>
              <span style={{ display: 'flex', gap: 8 }}>
                {!creatingNew && (
                  <button type="button" className="btn btn-sm btn-danger" onClick={handleDelete} disabled={deleting}>
                    <Ic d={ESN_ICON.trash} size={12} />
                    {deleting ? t('crm.esign.templatesTab.deletingBtn') : t('crm.esign.templatesTab.deleteBtn')}
                  </button>
                )}
                <button type="button" className="btn btn-sm btn-primary" onClick={handleSave} disabled={saving || !name.trim() || !body.trim()}>
                  <Ic d={ESN_ICON.check} size={13} />
                  {saving ? t('crm.esign.templatesTab.savingBtn') : t('crm.esign.templatesTab.saveBtn')}
                </button>
              </span>
            </>
          }
        >
          <div className="md-ed">
            <div className="md-ed-main">
              <div className="md-fields2">
                <div className="md-f">
                  <label>{t('crm.esign.templatesTab.nameLabel')}</label>
                  <input className="md-in" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('crm.esign.templatesTab.namePlaceholder')} />
                </div>
                <div className="md-f">
                  <label>{t('crm.esign.templatesTab.kindLabel')}</label>
                  <select className="md-sel" value={kindVal} onChange={(e) => setKindVal(e.target.value)}>
                    {KIND_OPTIONS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md-f">
                  <label>{t('crm.esign.templatesTab.fileNameLabel')}</label>
                  <input className="md-in" value={fileNamePattern} onChange={(e) => setFileNamePattern(e.target.value)} />
                  <div className="hint">{t('crm.esign.templatesTab.fileNameHint')}</div>
                </div>
                <div className="md-f">
                  <label>{t('crm.esign.templatesTab.formatLabel')}</label>
                  <input className="md-in" value="PDF" disabled />
                </div>
              </div>
              {mode === 'edit' ? (
                <div className="md-f">
                  <label>{t('crm.esign.templatesTab.bodyLabel')}</label>
                  <textarea ref={taRef} className="md-ta" value={body} onChange={(e) => setBody(e.target.value)} spellCheck={false} />
                  <div className="hint">{t('crm.esign.templatesTab.bodyHint')}</div>
                </div>
              ) : (
                <>
                  <RenderedBody body={body} />
                  <div className="hint" style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 8 }}>
                    {t('crm.esign.templatesTab.viewHint')}
                  </div>
                </>
              )}
            </div>

            <div className="md-keys">
              <div className="md-note plain" style={{ marginBottom: 14 }}>
                <Ic d={ESN_ICON.brace} size={14} />
                {t('crm.esign.templatesTab.keysHint')}
              </div>
              {keyGroups.map((g) => {
                const groupUsedCount = g.keys.filter((k) => usedKeys.has(k.key)).length;
                const open = !!openGroups[g.group];
                return (
                  <div key={g.group} className="md-key-group">
                    <button type="button" className={cx('md-key-group-head', open && 'open')} onClick={() => toggleGroup(g.group)}>
                      <span className="lbl">
                        {groupLabel[g.group]}
                        {groupUsedCount > 0 && <span className="cnt">{groupUsedCount}</span>}
                      </span>
                      <Ic d={ESN_ICON.chevDown} size={13} />
                    </button>
                    {open && (
                      <div className="md-key-group-body">
                        {g.keys.map((k) => (
                          <button key={k.key} type="button" className="md-key" onClick={() => insertKey(k.key)} title={t('crm.esign.templatesTab.insertTitle')}>
                            <code style={{ color: usedKeys.has(k.key) ? 'var(--ink)' : 'var(--fg-2)' }}>{`{${k.key}}`}</code>
                            <span>{k.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      <div style={{ gridColumn: '1 / -1' }} className="md-note plain">
        <Ic d={ESN_ICON.user} size={14} />
        {t('crm.esign.templatesTab.orgSettingsNote')}{' '}
        <a href="/settings" style={{ color: 'var(--ink)', textDecoration: 'underline' }}>
          {t('crm.esign.templatesTab.orgSettingsLink')}
        </a>
      </div>
    </div>
  );
};

/* ─────────────────────────── Выпуск документа ─────────────────────────── */

const IssueTab: React.FC<{
  t: (k: string, o?: any) => string;
  templates: EsignTemplate[];
  keyGroups: EsignKeyGroup[];
  groupLabel: Record<string, string>;
  keyLabel: Record<string, string>;
  autoKeySet: Set<string>;
  itemKeySet: Set<string>;
  productKeySet: Set<string>;
  serviceKeySet: Set<string>;
  onIssued: () => void;
  showAlert: (msg: string, opts?: any) => void;
}> = ({ t, templates, keyGroups, groupLabel, keyLabel, autoKeySet, itemKeySet, productKeySet, serviceKeySet, onIssued, showAlert }) => {
  const [tplId, setTplId] = useState<string>('');
  const [contact, setContact] = useState<Contact | null>(null);
  const [contactSearch, setContactSearch] = useState('');
  const [contactResults, setContactResults] = useState<Contact[]>([]);
  const [autoValues, setAutoValues] = useState<Record<string, string>>({});
  const [extraFields, setExtraFields] = useState<Record<string, string>>({});
  const [productItems, setProductItems] = useState<PickedItem[]>([]);
  const [serviceItems, setServiceItems] = useState<PickedItem[]>([]);
  const [issuedDoc, setIssuedDoc] = useState<EsignDocumentDetail | null>(null);
  const [busy, setBusy] = useState<'send' | 'download' | 'link' | null>(null);
  const [editingIssued, setEditingIssued] = useState(false);

  useEffect(() => {
    if (!tplId && templates.length) setTplId(templates[0].id);
  }, [templates, tplId]);

  useEffect(() => {
    fetchContacts({ search: contactSearch || undefined, limit: 8 })
      .then((res) => setContactResults(res.items))
      .catch(() => {});
  }, [contactSearch]);

  useEffect(() => {
    fetchEsignAutoValues(contact?.id || null)
      .then(setAutoValues)
      .catch(() => setAutoValues({}));
  }, [contact?.id]);

  const tpl = templates.find((x) => x.id === tplId) || null;
  const needed = useMemo(() => (tpl ? extractKeysFE(tpl.bodyTemplate) : []), [tpl]);
  const manualKeys = needed.filter((k) => !autoKeySet.has(k) && !itemKeySet.has(k) && !SEQUENCE_KEYS.has(k));
  const usesProductKeys = needed.some((k) => productKeySet.has(k));
  const usesServiceKeys = needed.some((k) => serviceKeySet.has(k));
  const usesContractNo = needed.includes('CONTRACT_NO');

  const [nextContractNo, setNextContractNo] = useState('');
  useEffect(() => {
    if (!usesContractNo) return;
    fetchEsignNextContractNo()
      .then((r) => setNextContractNo(r.preview))
      .catch(() => setNextContractNo(''));
  }, [usesContractNo]);

  const [amountSuggestions, setAmountSuggestions] = useState<EsignAmountSuggestion[]>([]);
  useEffect(() => {
    if (!contact) {
      setAmountSuggestions([]);
      return;
    }
    fetchEsignAmountSuggestions(contact.id)
      .then(setAmountSuggestions)
      .catch(() => setAmountSuggestions([]));
  }, [contact?.id]);
  const useAmountSuggestion = (s: EsignAmountSuggestion) => {
    setExtraFields((f) => ({ ...f, AMOUNT: money(parseFloat(s.amount)), ...(s.currency ? { CURRENCY: s.currency } : {}) }));
  };

  const itemValues = useMemo(() => computeItemValuesFE([...productItems, ...serviceItems]), [productItems, serviceItems]);
  const values: Record<string, string> = { ...autoValues, ...itemValues, ...extraFields, ...(usesContractNo && nextContractNo ? { CONTRACT_NO: nextContractNo } : {}) };
  const missing = needed.filter((k) => !values[k] || !values[k].trim());
  const filledManual = manualKeys.filter((k) => extraFields[k] && extraFields[k].trim()).length;

  const itemsTotal = [...productItems, ...serviceItems].reduce((s, i) => s + parseFloat(i.price), 0);
  const itemsCurrencies = new Set([...productItems, ...serviceItems].map((i) => i.currency));
  const useItemsTotalAsAmount = () => {
    setExtraFields((f) => ({
      ...f,
      AMOUNT: money(itemsTotal),
      ...(itemsCurrencies.size === 1 ? { CURRENCY: [...itemsCurrencies][0] } : {}),
    }));
  };

  const resetWizard = () => {
    setIssuedDoc(null);
    setExtraFields({});
    setProductItems([]);
    setServiceItems([]);
  };

  const changeTemplate = (id: string) => {
    setTplId(id);
    setIssuedDoc(null);
    setExtraFields({});
    setProductItems([]);
    setServiceItems([]);
  };
  const changeContact = (c: Contact) => {
    setContact(c);
    setIssuedDoc(null);
  };

  const ensureIssued = async (): Promise<EsignDocumentDetail> => {
    if (issuedDoc) return issuedDoc;
    if (!tpl) throw new Error(t('crm.esign.issueTab.errNoTemplate'));
    if (!contact) throw new Error(t('crm.esign.issueTab.errNoClient'));
    const items: EsignItemPick[] = [
      ...productItems.map((i) => ({ kind: 'product' as const, refId: i.refId })),
      ...serviceItems.map((i) => ({ kind: 'service' as const, refId: i.refId, masterId: i.masterId || undefined })),
    ];
    const doc = await issueEsignDocument({ templateId: tpl.id, contactId: contact.id, extraFields, items });
    setIssuedDoc(doc);
    onIssued();
    return doc;
  };

  const handleSend = async () => {
    setBusy('send');
    try {
      const doc = await ensureIssued();
      await sendEsignDocument(doc.id);
      onIssued();
      showAlert(t('crm.esign.issueTab.sentOk'), { variant: 'success' });
    } catch (e: any) {
      showAlert(e?.message || t('crm.esign.errors.sendDoc'), { variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const handleDownload = async () => {
    setBusy('download');
    try {
      const doc = await ensureIssued();
      await downloadEsignDocumentFile(doc.id, doc.fileName || 'document.pdf');
    } catch (e: any) {
      showAlert(e?.message || t('crm.esign.errors.actionFailed'), { variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const handleOpen = async () => {
    setBusy('link');
    try {
      const doc = await ensureIssued();
      await openEsignDocumentFile(doc.id);
    } catch (e: any) {
      showAlert(e?.message || t('crm.esign.errors.actionFailed'), { variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const stepDone = (n: 1 | 2 | 3 | 4) => {
    if (n === 1) return !!tpl;
    if (n === 2) return !!contact;
    if (n === 3) return manualKeys.length === 0 || filledManual === manualKeys.length;
    return missing.length === 0;
  };

  const steps: Array<[string, string, string]> = [
    [t('crm.esign.issueTab.step1'), tpl ? tpl.name : t('crm.esign.issueTab.step1Empty'), ''],
    [t('crm.esign.issueTab.step2'), contact ? contact.fullName || [contact.firstName, contact.lastName].filter(Boolean).join(' ') : t('crm.esign.issueTab.step2Empty'), ''],
    [t('crm.esign.issueTab.step3'), t('crm.esign.issueTab.step3Fields', { count: manualKeys.length }), ''],
    [t('crm.esign.issueTab.step4'), missing.length ? t('crm.esign.issueTab.step4Missing', { count: missing.length }) : t('crm.esign.issueTab.step4Ready'), ''],
  ];

  return (
    <>
      <div className="md-steps">
        {steps.map(([label, sub], i) => (
          <div key={label} className={cx('md-step', stepDone((i + 1) as 1 | 2 | 3 | 4) && 'done')}>
            <div className="n">{i + 1}</div>
            <div style={{ minWidth: 0 }}>
              <div className="t">{label}</div>
              <div className="d">{sub}</div>
            </div>
          </div>
        ))}
      </div>

      {issuedDoc && (
        <div className="md-note ok" style={{ marginBottom: 16 }}>
          <Ic d={ESN_ICON.check} size={14} />
          {t('crm.esign.issueTab.issuedNote')}{' '}
          <span style={{ display: 'inline-flex', gap: 8, marginLeft: 10 }}>
            {issuedDoc.status === 'draft' && (
              <button type="button" className="btn btn-sm" onClick={() => setEditingIssued(true)}>
                <Ic d={ESN_ICON.pencil} size={12} />
                {t('crm.esign.issueTab.editTextBtn')}
              </button>
            )}
            <button type="button" className="btn btn-sm" onClick={resetWizard}>
              {t('crm.esign.issueTab.startOverBtn')}
            </button>
          </span>
        </div>
      )}
      {editingIssued && issuedDoc && (
        <EditDocumentPanel
          t={t}
          documentId={issuedDoc.id}
          keyGroups={keyGroups}
          groupLabel={groupLabel}
          onClose={() => setEditingIssued(false)}
          onSaved={(doc) => {
            setIssuedDoc(doc);
            onIssued();
          }}
          showAlert={showAlert}
        />
      )}

      <div className="md-split md-issue-split">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card icon={<Ic d={ESN_ICON.doc} size={15} />} title={t('crm.esign.issueTab.templateCardTitle')} sub={t('crm.esign.issueTab.templateCardHint')}>
            <div className="md-pick">
              {templates.map((tp) => (
                <div key={tp.id} className={cx('md-pick-i', tplId === tp.id && 'on')} onClick={() => changeTemplate(tp.id)}>
                  <div className="rd" />
                  <div>
                    <div className="t">{tp.name}</div>
                    <div className="d">{tp.kind}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card icon={<Ic d={ESN_ICON.user} size={15} />} title={t('crm.esign.issueTab.clientCardTitle')} sub={t('crm.esign.issueTab.clientCardHint')}>
            <div className="md-bar" style={{ borderBottom: 0 }}>
              <div className="md-search">
                <Ic d={ESN_ICON.search} size={14} />
                <input placeholder={t('crm.esign.issueTab.clientSearchPlaceholder')} value={contactSearch} onChange={(e) => setContactSearch(e.target.value)} />
              </div>
            </div>
            <div className="md-pick">
              {contactResults.map((c) => (
                <div key={c.id} className={cx('md-pick-i', contact?.id === c.id && 'on')} onClick={() => changeContact(c)}>
                  <div className="rd" />
                  <div>
                    <div className="t">{c.fullName || [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email}</div>
                    <div className="d">
                      {c.company || t('crm.esign.issueTab.noCompany')} · {c.phone || c.email || '—'}
                    </div>
                  </div>
                </div>
              ))}
              {contactResults.length === 0 && <div className="md-empty">{t('crm.esign.issueTab.noClients')}</div>}
            </div>
          </Card>

          <Card icon={<Ic d={ESN_ICON.pencil} size={15} />} title={t('crm.esign.issueTab.contractFieldsTitle')} sub={t('crm.esign.issueTab.contractFieldsHint')}>
            {usesContractNo && (
              <div className="md-body" style={{ paddingBottom: 0 }}>
                <div className="md-note plain">
                  <Ic d={ESN_ICON.check} size={14} />
                  {t('crm.esign.issueTab.contractNoAutoNote', { no: nextContractNo || '…' })}
                </div>
              </div>
            )}
            {manualKeys.length === 0 ? (
              <div className="md-body">
                <div className="hint">{t('crm.esign.issueTab.noManualFields')}</div>
              </div>
            ) : (
              <div className="md-body">
                <div className="md-fields2">
                  {manualKeys.map((k) => (
                    <div key={k} className="md-f">
                      <label>
                        {keyLabel[k] || k} <code style={{ fontFamily: 'var(--ff-mono)', textTransform: 'none', color: 'var(--fg-4)' }}>{`{${k}}`}</code>
                      </label>
                      <input
                        className="md-in"
                        value={extraFields[k] || ''}
                        onChange={(e) => setExtraFields({ ...extraFields, [k]: e.target.value })}
                        placeholder={t('crm.esign.issueTab.fieldPlaceholder', { key: k })}
                      />
                      {k === 'AMOUNT' && amountSuggestions.length > 0 && (
                        <div className="md-amount-suggestions">
                          {amountSuggestions.map((s) => (
                            <button key={`${s.source}-${s.refId}`} type="button" className="md-chip" onClick={() => useAmountSuggestion(s)} title={s.label}>
                              {t(`crm.esign.issueTab.amountSource.${s.source}`)}: {s.label} — {money(parseFloat(s.amount))} {s.currency}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {manualKeys.length > 0 && (
              <div className="md-foot">
                <span>{t('crm.esign.issueTab.filledOf', { filled: filledManual, total: manualKeys.length })}</span>
                {itemsTotal > 0 && manualKeys.includes('AMOUNT') && (
                  <button type="button" className="btn btn-sm" onClick={useItemsTotalAsAmount}>
                    {t('crm.esign.issueTab.useItemsTotalBtn', { total: money(itemsTotal) })}
                  </button>
                )}
              </div>
            )}
          </Card>

          {usesProductKeys && <ProductPicker t={t} items={productItems} onChange={setProductItems} />}
          {usesServiceKeys && <ServicePicker t={t} items={serviceItems} onChange={setServiceItems} />}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card
            icon={<Ic d={ESN_ICON.doc} size={15} />}
            title={t('crm.esign.issueTab.previewTitle')}
            sub={issuedDoc ? t('crm.esign.issueTab.previewHintIssued') : t('crm.esign.issueTab.previewHint')}
            right={
              issuedDoc ? (
                <span className="md-st ok">
                  <span className="dot" />
                  {t('crm.esign.issueTab.previewIssuedBadge')}
                </span>
              ) : (
                <span className={cx('md-st', missing.length ? 'wait' : 'ok')}>
                  <span className="dot" />
                  {missing.length ? t('crm.esign.issueTab.hasMissing') : t('crm.esign.issueTab.allFilled')}
                </span>
              )
            }
          >
            <div className="md-body">
              {issuedDoc ? (
                <RenderedBody body={issuedDoc.bodyText} />
              ) : tpl ? (
                <RenderedBody body={tpl.bodyTemplate} values={values} />
              ) : (
                <div className="hint">{t('crm.esign.issueTab.step1Empty')}</div>
              )}
            </div>
          </Card>

          {!issuedDoc && missing.length > 0 && (
            <div className="md-note">
              <Ic d={ESN_ICON.alert} size={14} />
              {t('crm.esign.issueTab.missingNote', { keys: missing.join(', ') })}
            </div>
          )}

          <Card icon={<Ic d={ESN_ICON.sign} size={15} />} title={t('crm.esign.issueTab.exportTitle')}>
            <div className="md-body">
              <div className="md-kv">
                <span className="k">{t('crm.esign.issueTab.kvClient')}</span>
                <span className="v">{contact ? contact.fullName || [contact.firstName, contact.lastName].filter(Boolean).join(' ') : '—'}</span>
              </div>
              <div className="md-kv">
                <span className="k">{t('crm.esign.issueTab.kvAmount')}</span>
                <span className="v mono">
                  {extraFields.AMOUNT || '—'} {extraFields.CURRENCY || ''}
                </span>
              </div>
              <div className="md-kv">
                <span className="k">{t('crm.esign.issueTab.kvNumber')}</span>
                <span className="v mono">{extraFields.CONTRACT_NO || '—'}</span>
              </div>
              <div className="md-kv">
                <span className="k">{t('crm.esign.issueTab.kvSendTo')}</span>
                <span className="v">{contact?.email || '—'}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-sm btn-primary" onClick={handleSend} disabled={!tpl || !contact || !contact.email || busy !== null}>
                  <Ic d={ESN_ICON.sign} size={13} />
                  {busy === 'send' ? t('crm.esign.issueTab.sending') : t('crm.esign.issueTab.sendBtn')}
                </button>
                <button type="button" className="btn btn-sm" onClick={handleDownload} disabled={!tpl || !contact || busy !== null}>
                  <Ic d={ESN_ICON.download} size={12} />
                  {busy === 'download' ? t('crm.esign.issueTab.downloading') : t('crm.esign.issueTab.downloadBtn')}
                </button>
                <button type="button" className="btn btn-sm" onClick={handleOpen} disabled={!tpl || !contact || busy !== null}>
                  <Ic d={ESN_ICON.eye} size={12} />
                  {busy === 'link' ? t('crm.esign.issueTab.opening') : t('crm.esign.issueTab.openBtn')}
                </button>
              </div>
              {!contact?.email && contact && <div className="hint" style={{ marginTop: 8 }}>{t('crm.esign.issueTab.noEmailHint')}</div>}
              <div className="md-note plain" style={{ marginTop: 12 }}>
                <Ic d={ESN_ICON.clock} size={14} />
                {t('crm.esign.issueTab.exportNote')}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
};

/* ─────────────────────────── Товары / Услуги ─────────────────────────── */

const ProductPicker: React.FC<{
  t: (k: string, o?: any) => string;
  items: PickedItem[];
  onChange: (items: PickedItem[]) => void;
}> = ({ t, items, onChange }) => {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Product[]>([]);

  useEffect(() => {
    fetchProducts({ search: q || undefined, status: 'active', limit: 8 })
      .then((res) => setResults(res.items))
      .catch(() => setResults([]));
  }, [q]);

  const add = (p: Product) => {
    if (items.some((i) => i.refId === p.id)) return;
    onChange([...items, { kind: 'product', refId: p.id, name: p.name, sku: p.sku, price: p.price, currency: p.currency }]);
    setQ('');
  };
  const remove = (refId: string) => onChange(items.filter((i) => i.refId !== refId));
  const total = items.reduce((s, i) => s + parseFloat(i.price), 0);

  return (
    <Card icon={<Ic d={ESN_ICON.box} size={15} />} title={t('crm.esign.issueTab.productsTitle')} sub={t('crm.esign.issueTab.productsHint')}>
      <div className="md-bar" style={{ borderBottom: items.length ? '1px solid var(--line-3)' : 0 }}>
        <div className="md-search">
          <Ic d={ESN_ICON.search} size={14} />
          <input placeholder={t('crm.esign.issueTab.productSearchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      {q && (
        <div className="md-pick" style={{ gridTemplateColumns: '1fr' }}>
          {results
            .filter((p) => !items.some((i) => i.refId === p.id))
            .map((p) => (
              <div key={p.id} className="md-pick-i" onClick={() => add(p)}>
                <div className="rd" />
                <div>
                  <div className="t">{p.name}</div>
                  <div className="d">
                    {p.sku ? `${p.sku} · ` : ''}
                    {money(parseFloat(p.price))} {p.currency}
                  </div>
                </div>
              </div>
            ))}
          {results.length === 0 && <div className="md-empty">{t('crm.esign.issueTab.noResults')}</div>}
        </div>
      )}
      {items.length > 0 && (
        <div className="md-body">
          {items.map((i) => (
            <div key={i.refId} className="md-item-row">
              <div className="nm">
                {i.name}
                {i.sku && <span className="meta"> ({i.sku})</span>}
              </div>
              <div className="price">
                {money(parseFloat(i.price))} {i.currency}
              </div>
              <button type="button" className="rm" onClick={() => remove(i.refId)} title={t('crm.esign.issueTab.removeItem')}>
                <Ic d={ESN_ICON.x} size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
      {items.length > 0 && (
        <div className="md-foot">
          <span>{t('crm.esign.issueTab.itemsCount', { count: items.length })}</span>
          <span className="v mono">
            {money(total)} {items[0]?.currency}
          </span>
        </div>
      )}
    </Card>
  );
};

const ServicePicker: React.FC<{
  t: (k: string, o?: any) => string;
  items: PickedItem[];
  onChange: (items: PickedItem[]) => void;
}> = ({ t, items, onChange }) => {
  const [q, setQ] = useState('');
  const [services, setServices] = useState<BookingServiceItem[]>([]);
  const [staff, setStaff] = useState<BookingStaffProfile[]>([]);

  useEffect(() => {
    fetchBookingServices()
      .then((s) => setServices(s.filter((x) => x.active)))
      .catch(() => setServices([]));
    fetchBookingStaff()
      .then(setStaff)
      .catch(() => setStaff([]));
  }, []);

  const staffName = (id: string) => staff.find((s) => s.staffUserId === id)?.staffUser?.fullName || '';
  const filtered = q ? services.filter((s) => s.name.toLowerCase().includes(q.toLowerCase())) : services;

  const add = (s: BookingServiceItem) => {
    if (items.some((i) => i.refId === s.id)) return;
    const soleMaster = s.staffUserIds.length === 1 ? s.staffUserIds[0] : null;
    onChange([
      ...items,
      {
        kind: 'service',
        refId: s.id,
        name: s.name,
        price: s.price,
        currency: s.currency,
        durationMinutes: s.durationMinutes,
        masterId: soleMaster,
        masterName: soleMaster ? staffName(soleMaster) : null,
      },
    ]);
    setQ('');
  };
  const remove = (refId: string) => onChange(items.filter((i) => i.refId !== refId));
  const setMaster = (refId: string, masterId: string) => onChange(items.map((i) => (i.refId === refId ? { ...i, masterId, masterName: staffName(masterId) } : i)));
  const total = items.reduce((s, i) => s + parseFloat(i.price), 0);

  return (
    <Card icon={<Ic d={ESN_ICON.clock} size={15} />} title={t('crm.esign.issueTab.servicesTitle')} sub={t('crm.esign.issueTab.servicesHint')}>
      <div className="md-bar" style={{ borderBottom: items.length ? '1px solid var(--line-3)' : 0 }}>
        <div className="md-search">
          <Ic d={ESN_ICON.search} size={14} />
          <input placeholder={t('crm.esign.issueTab.serviceSearchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div className="md-pick" style={{ gridTemplateColumns: '1fr' }}>
        {filtered
          .filter((s) => !items.some((i) => i.refId === s.id))
          .slice(0, 8)
          .map((s) => (
            <div key={s.id} className="md-pick-i" onClick={() => add(s)}>
              <div className="rd" />
              <div>
                <div className="t">{s.name}</div>
                <div className="d">
                  {s.durationMinutes} мин · {money(parseFloat(s.price))} {s.currency}
                </div>
              </div>
            </div>
          ))}
        {filtered.length === 0 && <div className="md-empty">{t('crm.esign.issueTab.noResults')}</div>}
      </div>
      {items.length > 0 && (
        <div className="md-body">
          {items.map((i) => {
            const svc = services.find((s) => s.id === i.refId);
            const eligible = svc?.staffUserIds || [];
            return (
              <div key={i.refId} className="md-item-row">
                <div className="nm">
                  {i.name}
                  {i.durationMinutes ? <span className="meta"> · {i.durationMinutes} мин</span> : null}
                </div>
                {eligible.length > 1 ? (
                  <select className="md-item-master" value={i.masterId || ''} onChange={(e) => setMaster(i.refId, e.target.value)}>
                    <option value="">{t('crm.esign.issueTab.pickMaster')}</option>
                    {eligible.map((id) => (
                      <option key={id} value={id}>
                        {staffName(id) || id}
                      </option>
                    ))}
                  </select>
                ) : i.masterName ? (
                  <div className="meta">{i.masterName}</div>
                ) : null}
                <div className="price">
                  {money(parseFloat(i.price))} {i.currency}
                </div>
                <button type="button" className="rm" onClick={() => remove(i.refId)} title={t('crm.esign.issueTab.removeItem')}>
                  <Ic d={ESN_ICON.x} size={11} />
                </button>
              </div>
            );
          })}
        </div>
      )}
      {items.length > 0 && (
        <div className="md-foot">
          <span>{t('crm.esign.issueTab.itemsCount', { count: items.length })}</span>
          <span className="v mono">
            {money(total)} {items[0]?.currency}
          </span>
        </div>
      )}
    </Card>
  );
};

export default EsignPage;
