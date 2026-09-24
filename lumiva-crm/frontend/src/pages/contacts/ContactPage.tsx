// src/pages/contacts/ContactPage.tsx
// Редизайн по мокапу Claude Design (contact-page.html / components/contact-page.jsx) —
// объединяет старые ContactFormPage + ContactDetailsPage в одну страницу с вкладками.
// Основное всегда редактируемое (нет отдельного "режима" — это реальная CRM, не демо).
import { AiAssigneeGroup } from '../../components/ai/AiAssigneeGroup';
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { useAlertModal } from '../../contexts/AlertModalContext';
import {
  fetchContact,
  createContact,
  updateContact,
  deleteContact,
  type Contact,
  type CreateContactDto,
} from '../../api/contacts';
import { fetchCompanies, createCompany, type Company } from '../../api/companies';
import { fetchStaff, type StaffUser } from '../../api/staff';
import { fetchLeads, isLeadInTrash, type Lead } from '../../api/leads';
import { fetchProjects } from '../../api/projects';
import type { Project } from '../projects/projectTypes';
import { fetchAuditLog, type AuditLogEntry } from '../../api/auditLog';
import { cl, initials, money, Ic, LIC, Own, Tags, KV, sumByCurrency, fmtByCurrency } from './CrmListShared';
import { F, In, Ta, Sel, Card, SideCard, Tabs, CompanyPick, DeptAssignees, Metrics, COUNTRIES_F, industryLabel } from './CrmFormShared';
import './crm-lists-design.css';
import './crm-forms-design.css';

type TFunc = (key: string, opts?: Record<string, unknown>) => string;

const getCstC = (t: TFunc): Array<[string, string]> => [
  ['active', t('crm.contacts.card.statuses.active')],
  ['inactive', t('crm.contacts.card.statuses.inactive')],
  ['archived', t('crm.contacts.card.statuses.archived')],
];

const getLstC = (t: TFunc): Record<string, [string, string]> => ({
  'Новый клиент': ['', t('crm.contacts.card.leadStatusPill.new')],
  'В работе': ['wait', t('crm.contacts.card.leadStatusPill.inProgress')],
  'Ожидает ответа': ['mute', t('crm.contacts.card.leadStatusPill.waiting')],
  'Закрыт (успех)': ['ok', t('crm.contacts.card.leadStatusPill.won')],
  'Закрыт (проигран)': ['bad', t('crm.contacts.card.leadStatusPill.lost')],
});
const PST_C: Record<string, string> = { Новый: '', 'В работе': 'wait', 'На проверке': 'wait', Заморожен: 'mute', Закрыт: 'ok' };

type FormState = Omit<CreateContactDto, 'customFields'> & { passport?: string };

export const ContactPage: React.FC = () => {
  const { t } = useTranslation();
  const CST_C = getCstC(t);
  const LST_C = getLstC(t);
  const { id } = useParams<{ id?: string }>();
  const isNew = !id;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetCompanyId = searchParams.get('companyId') || '';
  const { showAlert, showConfirm } = useAlertModal();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState('main');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [history, setHistory] = useState<AuditLogEntry[]>([]);
  const [contactMeta, setContactMeta] = useState<Contact | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [customFields, setCustomFields] = useState<Record<string, any>>({});

  const [form, setForm] = useState<FormState>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    companyId: presetCompanyId,
    position: '',
    city: '',
    country: '',
    address: '',
    status: 'active',
  });

  useEffect(() => {
    fetchCompanies({ limit: 2000 })
      .then((r) => setCompanies(r.items))
      .catch(() => {});
    fetchStaff()
      .then((r) => setStaff(r.filter((s) => s.isActive)))
      .catch(() => {});
    fetchLeads()
      .then(setLeads)
      .catch(() => {});
    fetchProjects()
      .then((r) => setProjects(r.items))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchContact(id)
      .then((c) => {
        setContactMeta(c);
        setForm({
          firstName: c.firstName || '',
          lastName: c.lastName || '',
          email: c.email || '',
          phone: c.phone || '',
          companyId: c.companyId || '',
          position: c.position || '',
          city: c.city || '',
          country: c.country || '',
          address: c.address || '',
          status: c.status || 'active',
        });
        setCustomFields(c.customFields || {});
        setPicked(c.assignedUserIds?.length ? c.assignedUserIds : c.assignedUserId ? [c.assignedUserId] : []);
      })
      .catch((e: any) => setError(e.message || t('crm.contacts.card.errors.loadFailed')))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) {
      setHistory([]);
      return;
    }
    fetchAuditLog({ entityType: 'contact', entityId: id, limit: 20 })
      .then((r) => setHistory(r.items))
      .catch(() => setHistory([]));
  }, [id]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((p) => ({ ...p, [k]: v }));

  const company = companies.find((c) => c.id === form.companyId);
  const fullName = [form.firstName, form.lastName].filter(Boolean).join(' ');

  const contactLeads = useMemo(
    () => (id ? leads.filter((l) => l.contactId === id && !isLeadInTrash(l)) : []),
    [leads, id],
  );
  const contactProjects = useMemo(() => (id ? projects.filter((p) => p.contactId === id) : []), [projects, id]);
  // Деньги считаются по проектам (сделкам), не по лидам — лиды остаются просто списком заявок.
  const dealsSumCur = sumByCurrency(
    contactProjects.filter((p) => p.status === 'Выиграно' || p.status === 'Закрыт'),
    (p) => Number(p.amount) || 0,
    (p) => p.currency,
  );

  const TABS = [
    { id: 'main', l: t('crm.contacts.card.tabs.main') },
    { id: 'leads', l: t('crm.contacts.card.tabs.leads'), n: contactLeads.length },
    { id: 'projects', l: t('crm.contacts.card.tabs.projects'), n: contactProjects.length },
    { id: 'history', l: t('crm.contacts.card.tabs.history') },
  ];

  const handleCompanyCreate = async (name: string) => {
    try {
      const created = await createCompany({ name: name || t('crm.contacts.card.newCompanyDefaultName') });
      setCompanies((prev) => [...prev, created]);
      set('companyId', created.id);
    } catch (e: any) {
      showAlert(e.message || t('crm.contacts.card.errors.createCompanyFailed'), { variant: 'error' });
    }
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      setError(t('crm.contacts.card.errors.nameRequired'));
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const primaryId = picked[0];
      const primaryMember = staff.find((s) => s.id === primaryId);
      const payload: CreateContactDto = {
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        companyId: form.companyId || undefined,
        position: form.position || undefined,
        city: form.city || undefined,
        country: form.country || undefined,
        address: form.address || undefined,
        status: form.status,
        assignedUserIds: picked,
        assignedUserId: primaryId || undefined,
        assignedTo: primaryMember?.fullName || primaryMember?.email || undefined,
        customFields: { ...customFields, passport: form.passport },
      };
      if (isNew) {
        const created = await createContact(payload);
        showAlert(t('crm.contacts.card.messages.created'), { variant: 'success' });
        navigate(`/app/contacts/${created.id}`);
      } else {
        await updateContact(id!, payload);
        showAlert(t('crm.contacts.card.messages.saved'), { variant: 'success' });
        const fresh = await fetchContact(id!);
        setContactMeta(fresh);
      }
    } catch (e: any) {
      setError(e.message || t('crm.contacts.card.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    const ok = await showConfirm(t('crm.contacts.card.deleteConfirm'), {
      title: t('crm.contacts.list.deleteTitle'),
      confirmLabel: t('crm.contacts.list.deleteLabel'),
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteContact(id);
      navigate('/app/contacts');
    } catch (e: any) {
      showAlert(e.message || t('crm.contacts.card.errors.deleteFailed'), { variant: 'error' });
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="px-scope">
          <div className="cf-empty">{t('crm.contacts.list.loading')}</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageHelpButton topic="contacts" />
      <div className="px-scope">
        <div className="cf-wrap">
          <a
            className="cf-back"
            href="/app/contacts"
            onClick={(e) => {
              e.preventDefault();
              navigate('/app/contacts');
            }}
          >
            <Ic d={LIC.chev} size={12} style={{ transform: 'rotate(90deg)' }} />
            {t('crm.contacts.card.allContacts')}
          </a>

          <div className="cf-head">
            <div>
              <div className="cf-kicker">
                {isNew ? t('crm.contacts.card.newContact') : t('crm.contacts.card.contactKicker', { id: id?.slice(0, 8).toUpperCase() })}
              </div>
              <h1>
                {fullName || <span className="ph">{t('crm.contacts.card.namePlaceholder')}</span>}
                {!isNew && (
                  <span className={cl('cl-pill', form.status === 'active' ? 'ok' : 'mute')}>
                    <span className="dot" />
                    {CST_C.find(([id2]) => id2 === form.status)?.[1] || form.status}
                  </span>
                )}
              </h1>
              {isNew ? (
                <div className="cf-hint">
                  <Ic d={LIC.note} size={14} />
                  {t('crm.contacts.card.newContactHint')}
                </div>
              ) : (
                <div className="role">
                  {form.position}
                  {company ? ` · ${company.name}` : ''}
                </div>
              )}
            </div>
            <div className="cf-actions">
              {!isNew && (
                <>
                  {form.email && (
                    <a className="btn btn-sm" href={`mailto:${form.email}`}>
                      <Ic d={LIC.mail} size={13} />
                      {t('crm.contacts.list.drawer.write')}
                    </a>
                  )}
                  <button type="button" className="btn btn-sm" onClick={() => navigate('/app/my-documents')}>
                    <Ic d={LIC.note} size={13} />
                    {t('crm.contacts.list.drawer.document')}
                  </button>
                  <button type="button" className="btn btn-sm btn-danger" onClick={handleDelete}>
                    <Ic d={LIC.trash} size={13} />
                    {t('crm.contacts.list.bulk.delete')}
                  </button>
                </>
              )}
              <button type="button" className="btn btn-sm btn-primary" disabled={saving} onClick={handleSave}>
                <Ic d={LIC.check} size={13} />
                {saving ? t('crm.contacts.card.saving') : isNew ? t('crm.contacts.card.create') : t('crm.contacts.card.save')}
              </button>
            </div>
          </div>

          <Tabs tabs={TABS} v={tab} set={setTab} locked={isNew} />
          {error && (
            <div className="cf-alert">
              <Ic d={LIC.close} size={14} />
              {error}
            </div>
          )}

          {tab === 'main' && (
            <>
              {!isNew && (
                <Metrics
                  items={[
                    [
                      t('crm.contacts.card.metrics.leads'),
                      contactLeads.length,
                      t('crm.contacts.card.metrics.leadsInProgress', { count: contactLeads.filter((l) => l.status === 'В работе').length }),
                    ],
                    [
                      t('crm.contacts.card.metrics.projects'),
                      contactProjects.length,
                      t('crm.contacts.card.metrics.projectsActive', { count: contactProjects.filter((p) => p.status === 'В работе').length }),
                    ],
                    [t('crm.contacts.card.metrics.dealsSum'), fmtByCurrency(dealsSumCur), t('crm.contacts.card.metrics.dealsSumHint')],
                    [
                      t('crm.contacts.card.metrics.lastContact'),
                      history[0] ? new Date(history[0].createdAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) : '—',
                      history[0]?.summary || t('crm.contacts.card.metrics.noRecords'),
                    ],
                  ]}
                />
              )}

              <div className="cf-grid">
                <div className="cf-col">
                  <Card icon={LIC.users} title={t('crm.contacts.card.personal.title')} sub={t('crm.contacts.card.personal.sub')}>
                    <div className="cf-body">
                      <div className="cf-fields">
                        <F label={t('crm.contacts.card.personal.firstName')}>
                          <In value={form.firstName} onChange={(e) => set('firstName', e.target.value)} placeholder={t('crm.contacts.card.personal.firstNamePlaceholder')} className={error ? 'cf-err' : undefined} />
                        </F>
                        <F label={t('crm.contacts.card.personal.lastName')}>
                          <In value={form.lastName} onChange={(e) => set('lastName', e.target.value)} placeholder={t('crm.contacts.card.personal.lastNamePlaceholder')} />
                        </F>
                        <F label={t('crm.contacts.card.personal.email')}>
                          <In type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="ivan@..." />
                        </F>
                        <F label={t('crm.contacts.card.personal.phone')}>
                          <In type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+7 900..." />
                        </F>
                        <F label={t('crm.contacts.card.personal.company')} wide hint={t('crm.contacts.card.personal.companyHint')}>
                          <CompanyPick list={companies} value={form.companyId || ''} onChange={(v) => set('companyId', v)} />
                          {!form.companyId && (
                            <button
                              type="button"
                              className="btn btn-sm"
                              style={{ marginTop: 6 }}
                              onClick={() => {
                                const name = window.prompt(t('crm.contacts.card.personal.newCompanyPrompt'));
                                if (name && name.trim()) handleCompanyCreate(name.trim());
                              }}
                            >
                              <Ic d={LIC.plus} size={12} />
                              {t('crm.contacts.card.personal.createCompany')}
                            </button>
                          )}
                        </F>
                        <F label={t('crm.contacts.card.personal.position')} wide>
                          <In value={form.position} onChange={(e) => set('position', e.target.value)} placeholder={t('crm.contacts.card.personal.positionPlaceholder')} />
                        </F>
                        <F label={t('crm.contacts.card.personal.city')}>
                          <In value={form.city} onChange={(e) => set('city', e.target.value)} placeholder={t('crm.contacts.card.personal.cityPlaceholder')} />
                        </F>
                        <F label={t('crm.contacts.card.personal.country')}>
                          <Sel value={form.country || ''} onChange={(e) => set('country', e.target.value)} placeholder={t('crm.crmShared.selectPlaceholder')} options={COUNTRIES_F} />
                        </F>
                        <F label={t('crm.contacts.card.personal.address')} wide>
                          <Ta rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} />
                        </F>
                        <F label={t('crm.contacts.card.personal.passport')} wide hint={t('crm.contacts.card.personal.passportHint')}>
                          <In
                            value={form.passport ?? customFields.passport ?? ''}
                            onChange={(e) => set('passport', e.target.value)}
                            placeholder="AA 1234567"
                          />
                        </F>
                      </div>
                    </div>
                  </Card>

                  {!isNew && company && (
                    <Card icon={LIC.users} title={t('crm.contacts.card.companyCard.title')}>
                      <div className="cf-body">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          <div className="cl-av sq" style={{ width: 38, height: 38, fontSize: 13 }}>
                            {initials(company.name)}
                          </div>
                          <div style={{ flex: 1, minWidth: 160 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{company.name}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--fg-3)', marginTop: 2 }}>
                              {industryLabel(t, company.industry) || '—'} · {company.city || '—'}
                            </div>
                          </div>
                          <button type="button" className="btn btn-sm" onClick={() => navigate(`/companies/${company.id}`)}>
                            {t('crm.contacts.card.companyCard.open')}
                            <Ic d={LIC.chevR} size={12} />
                          </button>
                        </div>
                      </div>
                    </Card>
                  )}
                </div>

                <div className="cf-col">
                  <SideCard title={t('crm.contacts.list.table.status')}>
                    <Sel value={form.status || 'active'} onChange={(e) => set('status', e.target.value)} options={CST_C} />
                  </SideCard>
                  <SideCard title={t('crm.contacts.card.assignees')} right={<span className="cf-mono">{picked.length}</span>}>
                    <DeptAssignees staff={staff} picked={picked} setPicked={setPicked} />
                    <AiAssigneeGroup entityType="contact" entityId={isNew ? null : id} compact />
                  </SideCard>
                  {!isNew && contactMeta && (
                    <div className="cf-card">
                      <div className="cf-body">
                        <div className="cf-side-t">{t('crm.contacts.card.service.title')}</div>
                        <KV k={t('crm.contacts.card.service.id')} v={<span className="cf-idbox">{contactMeta.id}</span>} />
                        <KV k={t('crm.companies.list.drawer.created')} v={new Date(contactMeta.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} mono />
                        <KV k={t('crm.contacts.card.service.updated')} v={new Date(contactMeta.updatedAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} mono />
                        <KV k={t('crm.contacts.list.drawer.tags')} v={contactMeta.tags?.length ? <Tags list={contactMeta.tags} /> : null} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {tab === 'leads' && (
            <Card
              icon={LIC.bolt}
              title={t('crm.contacts.card.leadsTab.title')}
              sub={t('crm.contacts.card.leadsTab.sub')}
              right={
                <button type="button" className="btn btn-sm btn-primary" onClick={() => navigate('/app/leads')}>
                  <Ic d={LIC.plus} size={13} />
                  {t('crm.contacts.card.leadsTab.newLead')}
                </button>
              }
            >
              {contactLeads.length === 0 ? (
                <div className="cf-empty">
                  <div className="t">{t('crm.contacts.card.leadsTab.emptyTitle')}</div>
                  <div className="d">{t('crm.contacts.card.leadsTab.emptyDesc')}</div>
                </div>
              ) : (
                <table className="cf-tbl">
                  <thead>
                    <tr>
                      <th>{t('crm.contacts.card.leadsTab.colLead')}</th>
                      <th>{t('crm.contacts.list.table.status')}</th>
                      <th className="r">{t('crm.contacts.card.leadsTab.colSum')}</th>
                      <th>{t('crm.contacts.card.leadsTab.colOwner')}</th>
                      <th>{t('crm.companies.list.drawer.created')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contactLeads.map((l) => {
                      const st = LST_C[l.status] || ['', l.status];
                      return (
                        <tr key={l.id} onClick={() => navigate(`/app/leads/${l.id}`)} style={{ cursor: 'pointer' }}>
                          <td>
                            <div className="nm">{l.name || t('crm.contacts.card.leadsTab.untitled')}</div>
                            <div className="sub cf-mono">{l.id.slice(0, 8)}</div>
                          </td>
                          <td>
                            <span className={cl('cl-pill', st[0])}>
                              <span className="dot" />
                              {st[1]}
                            </span>
                          </td>
                          <td className="r">
                            <span className="cf-sum">
                              {money(Number(l.amount) || 0)} {l.currency}
                            </span>
                          </td>
                          <td>
                            <Own name={l.assignedTo} />
                          </td>
                          <td>
                            <span className="cf-mono">{new Date(l.createdAt).toLocaleDateString('ru-RU')}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              <div className="cf-foot">
                <span>{t('crm.contacts.card.leadsTab.footNote')}</span>
                <a className="btn btn-sm" href="/app/leads">
                  {t('crm.contacts.card.leadsTab.allLeads')}
                </a>
              </div>
            </Card>
          )}

          {tab === 'projects' && (
            <Card icon={LIC.users} title={t('crm.contacts.card.projectsTab.title')} sub={t('crm.contacts.card.projectsTab.sub')}>
              {contactProjects.length === 0 ? (
                <div className="cf-empty">
                  <div className="t">{t('crm.contacts.card.projectsTab.emptyTitle')}</div>
                  <div className="d">{t('crm.contacts.card.projectsTab.emptyDesc')}</div>
                </div>
              ) : (
                <table className="cf-tbl">
                  <thead>
                    <tr>
                      <th>{t('crm.contacts.card.projectsTab.colProject')}</th>
                      <th>{t('crm.contacts.list.table.status')}</th>
                      <th className="r">{t('crm.contacts.card.projectsTab.colBudget')}</th>
                      <th>{t('crm.contacts.card.leadsTab.colOwner')}</th>
                      <th>{t('crm.contacts.card.projectsTab.colUpdated')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contactProjects.map((p) => (
                      <tr key={p.id} onClick={() => navigate(`/app/projects/${p.id}`)} style={{ cursor: 'pointer' }}>
                        <td>
                          <div className="nm">{p.name}</div>
                          <div className="sub cf-mono">{p.id.slice(0, 8)}</div>
                        </td>
                        <td>
                          <span className={cl('cl-pill', PST_C[p.status])}>
                            <span className="dot" />
                            {p.status.toLowerCase()}
                          </span>
                        </td>
                        <td className="r">
                          <span className="cf-sum">
                            {money(p.amount)} {p.currency}
                          </span>
                        </td>
                        <td>
                          <Own name={p.owner} />
                        </td>
                        <td>
                          <span className="cf-mono">{p.updatedAt ? new Date(p.updatedAt).toLocaleDateString('ru-RU') : '—'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          )}

          {tab === 'history' && (
            <div className="cf-grid" style={{ gridTemplateColumns: 'minmax(0,1fr) 330px' }}>
              <Card icon={LIC.bolt} title={t('crm.contacts.card.historyTab.title')} sub={t('crm.contacts.card.historyTab.sub')}>
                <div className="cf-body">
                  {history.length === 0 ? (
                    <div className="cl-dash" style={{ fontSize: 12 }}>
                      {t('crm.contacts.list.drawer.noHistory')}
                    </div>
                  ) : (
                    history.map((h) => (
                      <div key={h.id} className="cl-tl">
                        <span className="tm">
                          {new Date(h.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="pt" />
                        <span className="tx">
                          {h.summary || h.action} {h.actorName ? `· ${h.actorName}` : ''}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </Card>
              <div className="cf-col">
                <div className="cf-card">
                  <div className="cf-body">
                    <div className="cf-side-t">{t('crm.contacts.card.historyTab.summary')}</div>
                    <KV k={t('crm.contacts.card.historyTab.logEntries')} v={String(history.length)} mono />
                    <KV k={t('crm.contacts.card.metrics.leads')} v={String(contactLeads.length)} mono />
                    <KV k={t('crm.contacts.card.metrics.projects')} v={String(contactProjects.length)} mono />
                    <KV
                      k={t('crm.contacts.card.historyTab.lastActivity')}
                      v={history[0] ? new Date(history[0].createdAt).toLocaleDateString('ru-RU') : null}
                      mono
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};
