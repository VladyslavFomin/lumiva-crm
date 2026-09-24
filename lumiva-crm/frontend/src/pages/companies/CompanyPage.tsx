// src/pages/companies/CompanyPage.tsx
// Редизайн по мокапу Claude Design (company-page.html / components/company-page.jsx) —
// объединяет старые CompanyFormPage + CompanyDetailsPage в одну страницу с вкладками.
// Основное всегда редактируемое (нет отдельного "режима" — это реальная CRM, не демо).
import { AiAssigneeGroup } from '../../components/ai/AiAssigneeGroup';
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { buildUnifiedTasks, type TaskSource, type UnifiedTask } from './companyTasksAggregate';
import {
  fetchCompany,
  createCompany,
  updateCompany,
  deleteCompany,
  fetchCompanyAnalytics,
  fetchCompanyTasks,
  type Company,
  type CreateCompanyDto,
  type CompanyAnalytics,
  type CompanyTask,
  type CompanyTaskStatus,
} from '../../api/companies';
import { fetchContacts, type Contact } from '../../api/contacts';
import { fetchStaff, type StaffUser } from '../../api/staff';
import { fetchLeads, isLeadInTrash, type Lead } from '../../api/leads';
import { fetchProjects } from '../../api/projects';
import type { Project } from '../projects/projectTypes';
import { cl, initials, money, Ic, LIC, Own, Tags, KV, sumByCurrency, fmtByCurrency } from '../contacts/CrmListShared';
import {
  F,
  In,
  Ta,
  Sel,
  Card,
  SideCard,
  Tabs,
  DeptAssignees,
  Metrics,
  INDUSTRIES_F,
  industryLabel,
  normalizeIndustry,
  SIZES_F,
  STATUSES_F,
} from '../contacts/CrmFormShared';
import { LegalRequisitesEditor } from '../../legal/LegalRequisitesEditor';
import type { LegalRequisiteItem } from '../../legal/legalRequisites';
import { TYPE_OPTIONS } from './CompaniesListPage';
import '../contacts/crm-lists-design.css';
import '../contacts/crm-forms-design.css';

type TFunc = (key: string, opts?: Record<string, unknown>) => string;

const getLst = (t: TFunc): Record<string, [string, string]> => ({
  'Новый клиент': ['', t('crm.contacts.card.leadStatusPill.new')],
  'В работе': ['wait', t('crm.contacts.card.leadStatusPill.inProgress')],
  'Ожидает ответа': ['mute', t('crm.contacts.card.leadStatusPill.waiting')],
  'Закрыт (успех)': ['ok', t('crm.contacts.card.leadStatusPill.won')],
  'Закрыт (проигран)': ['bad', t('crm.contacts.card.leadStatusPill.lost')],
});
const PST: Record<string, string> = {
  Новый: '',
  'В работе': 'wait',
  'На проверке': 'wait',
  Заморожен: 'mute',
  Закрыт: 'ok',
  Выиграно: 'ok',
  Проиграно: 'bad',
};
/** Отображаемая метка статуса проекта (сами статусы — литералы в БД, см. project.entity.ts). */
const PROJECT_STATUS_LABEL = (t: TFunc, status: string): string => {
  const map: Record<string, string> = {
    Новый: t('crm.companies.card.projectStatus.new'),
    'В работе': t('crm.companies.card.projectStatus.inProgress'),
    'На проверке': t('crm.companies.card.projectStatus.inReview'),
    Заморожен: t('crm.companies.card.projectStatus.frozen'),
    Закрыт: t('crm.companies.card.projectStatus.closed'),
    Выиграно: t('crm.companies.card.projectStatus.won'),
    Проиграно: t('crm.companies.card.projectStatus.lost'),
  };
  return map[status] || status;
};
const getTaskCols = (t: TFunc): Array<[CompanyTaskStatus, string]> => [
  ['todo', t('crm.companies.card.taskCols.todo')],
  ['in_progress', t('crm.companies.card.taskCols.inProgress')],
  ['review', t('crm.companies.card.taskCols.review')],
  ['done', t('crm.companies.card.taskCols.done')],
];

type FormState = Omit<CreateCompanyDto, 'legalRequisites' | 'assignedUserIds' | 'tags'>;

export const CompanyPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const dateLoc = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
  const LST = getLst(t);
  const TASK_COLS = getTaskCols(t);
  const { id } = useParams<{ id?: string }>();
  const isNew = !id;
  const navigate = useNavigate();
  const { showAlert, showConfirm, showPrompt } = useAlertModal();

  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState(searchParams.get('tab') || 'main');
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<CompanyTask[]>([]);
  const [taskSource, setTaskSource] = useState<'all' | TaskSource>('all');
  const [analytics, setAnalytics] = useState<CompanyAnalytics | null>(null);
  const [companyMeta, setCompanyMeta] = useState<Company | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [req, setReq] = useState<LegalRequisiteItem[]>([]);

  const [form, setForm] = useState<FormState>({
    name: '',
    legalName: '',
    taxId: '',
    email: '',
    phone: '',
    website: '',
    industry: '',
    city: '',
    country: '',
    address: '',
    description: '',
    size: '',
    type: '',
    status: 'active',
  });

  useEffect(() => {
    fetchStaff()
      .then((r) => setStaff(r.filter((s) => s.isActive)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      fetchCompany(id),
      fetchContacts({ companyId: id, limit: 500 }).catch(() => ({ items: [], total: 0 })),
      fetchLeads().catch(() => []),
      fetchProjects().then((r) => r.items).catch(() => []),
      fetchCompanyAnalytics(id).catch(() => null),
      fetchCompanyTasks(id).catch(() => []),
    ])
      .then(([c, contactsData, leadsData, projectsData, analyticsData, tasksData]) => {
        setCompanyMeta(c);
        setForm({
          name: c.name,
          legalName: c.legalName || '',
          taxId: c.taxId || '',
          email: c.email || '',
          phone: c.phone || '',
          website: c.website || '',
          industry: normalizeIndustry(c.industry),
          city: c.city || '',
          country: c.country || '',
          address: c.address || '',
          description: c.description || '',
          size: c.size || '',
          type: c.type || '',
          status: c.status || 'active',
        });
        setReq(c.legalRequisites || []);
        setPicked(c.assignedUserIds?.length ? c.assignedUserIds : c.assignedUserId ? [c.assignedUserId] : []);
        setContacts(contactsData.items);
        setLeads(leadsData);
        setProjects(projectsData);
        setAnalytics(analyticsData);
        setTasks(tasksData);
      })
      .catch((e: any) => setError(e.message || t('crm.companies.card.errors.loadFailed')))
      .finally(() => setLoading(false));
  }, [id]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((p) => ({ ...p, [k]: v }));

  const companyLeads = useMemo(() => (id ? leads.filter((l) => l.companyId === id && !isLeadInTrash(l)) : []), [leads, id]);
  const companyProjects = useMemo(() => (id ? projects.filter((p) => p.companyId === id) : []), [projects, id]);

  // Деньги (выручка/потенциал/потери) считаются по проектам, не по лидам — лиды остаются
  // просто списком заявок. Готовые сконвертированные в одну валюту суммы приходят с бэкенда
  // (analytics.metrics.*Converted), см. companies.service.ts getCompanyAnalytics.
  const cur = analytics?.metrics.currency || 'EUR';
  const projectsInPipeline = companyProjects.filter((p) => ['Новый', 'В работе', 'На проверке', 'Заморожен'].includes(p.status));
  const projectsWon = companyProjects.filter((p) => p.status === 'Выиграно' || p.status === 'Закрыт');
  const projectsLost = companyProjects.filter((p) => p.status === 'Проиграно');
  const conversion = companyLeads.length ? Math.round((companyLeads.filter((l) => l.status === 'Закрыт (успех)').length / companyLeads.length) * 100) : 0;

  // Все задачи «под компанией»: свои + задачи проектов + шаги лидов (с пометкой источника)
  const allTasks = useMemo(
    () => (id ? buildUnifiedTasks({ companyId: id, tasks, leads, projects, contacts, staff }, t) : []),
    [id, tasks, leads, projects, contacts, staff, t],
  );
  const activeTasks = allTasks.filter((tsk) => tsk.column !== 'done');
  const visibleTasks = taskSource === 'all' ? allTasks : allTasks.filter((tsk) => tsk.source === taskSource);
  const taskCountBySource = (src: TaskSource) => allTasks.filter((tsk) => tsk.source === src).length;

  const openTaskSource = (tsk: UnifiedTask) => {
    if (tsk.source === 'project' && tsk.sourceId) navigate(`/projects/${tsk.sourceId}`);
    else if (tsk.source === 'lead' && tsk.sourceId) navigate(`/leads/${tsk.sourceId}`);
  };
  const fmtDue = (due: string | null) => {
    if (!due) return '—';
    const d = new Date(due);
    return Number.isNaN(d.getTime()) ? due : d.toLocaleDateString(dateLoc, { day: '2-digit', month: '2-digit', year: '2-digit' });
  };
  const PRIORITY_PILL: Record<string, string> = { urgent: 'bad', high: 'wait', medium: '', low: 'mute' };

  const TABS = [
    { id: 'main', l: t('crm.contacts.card.tabs.main') },
    { id: 'contacts', l: t('crm.companies.card.tabs.contacts'), n: contacts.length },
    { id: 'leads', l: t('crm.contacts.card.tabs.leads'), n: companyLeads.length },
    { id: 'projects', l: t('crm.contacts.card.tabs.projects'), n: companyProjects.length },
    { id: 'tasks', l: t('crm.companies.card.tabs.tasks'), n: activeTasks.length },
    { id: 'analytics', l: t('crm.companies.card.tabs.analytics') },
  ];

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError(t('crm.companies.card.errors.nameRequired'));
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const primaryId = picked[0];
      const primaryMember = staff.find((s) => s.id === primaryId);
      const payload: CreateCompanyDto = {
        ...form,
        assignedUserIds: picked,
        assignedUserId: primaryId || undefined,
        assignedTo: primaryMember?.fullName || primaryMember?.email || undefined,
        legalRequisites: req,
      };
      if (isNew) {
        const created = await createCompany(payload);
        showAlert(t('crm.companies.card.messages.created'), { variant: 'success' });
        navigate(`/companies/${created.id}`);
      } else {
        await updateCompany(id!, payload);
        showAlert(t('crm.contacts.card.messages.saved'), { variant: 'success' });
        const fresh = await fetchCompany(id!);
        setCompanyMeta(fresh);
      }
    } catch (e: any) {
      setError(e.message || t('crm.companies.card.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    const ok = await showConfirm(t('crm.companies.card.deleteConfirm'), {
      title: t('crm.companies.list.deleteTitle'),
      confirmLabel: t('crm.companies.list.deleteLabel'),
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteCompany(id);
      navigate('/companies');
    } catch (e: any) {
      showAlert(e.message || t('crm.companies.card.errors.deleteFailed'), { variant: 'error' });
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
      <PageHelpButton topic="companies" />
      <div className="px-scope">
        <div className="cf-wrap">
          <a
            className="cf-back"
            href="/companies"
            onClick={(e) => {
              e.preventDefault();
              navigate('/companies');
            }}
          >
            <Ic d={LIC.chev} size={12} style={{ transform: 'rotate(90deg)' }} />
            {t('crm.companies.card.allCompanies')}
          </a>

          <div className="cf-head">
            <div>
              <div className="cf-kicker">
                {isNew ? t('crm.companies.card.newCompany') : t('crm.companies.card.companyKicker', { id: id?.slice(0, 8).toUpperCase() })}
              </div>
              <h1>
                {form.name.trim() || <span className="ph">{t('crm.companies.card.namePlaceholder')}</span>}
                {!isNew && (
                  <span className={cl('cl-pill', form.status === 'active' ? 'ok' : 'mute')}>
                    <span className="dot" />
                    {STATUSES_F(t).find(([id2]) => id2 === form.status)?.[1] || form.status}
                  </span>
                )}
              </h1>
              {isNew ? (
                <div className="cf-hint">
                  <Ic d={LIC.note} size={14} />
                  {t('crm.companies.card.newCompanyHint')}
                </div>
              ) : (
                <div className="role">
                  {industryLabel(t, form.industry) || '—'} · {form.city || '—'}
                  {picked.length ? ` · ${t('crm.companies.card.responsiblePerson', { name: staff.find((s) => s.id === picked[0])?.fullName || '' })}` : ''}
                </div>
              )}
            </div>
            <div className="cf-actions">
              {!isNew && (
                <>
                  <button type="button" className="btn btn-sm" onClick={() => setTab('contacts')}>
                    <Ic d={LIC.users} size={13} />
                    {t('crm.companies.card.contactBtn')}
                  </button>
                  <button type="button" className="btn btn-sm" onClick={() => setTab('leads')}>
                    <Ic d={LIC.bolt} size={13} />
                    {t('crm.companies.card.leadBtn')}
                  </button>
                  <button type="button" className="btn btn-sm btn-danger" onClick={handleDelete}>
                    <Ic d={LIC.trash} size={13} />
                    {t('crm.contacts.list.bulk.delete')}
                  </button>
                </>
              )}
              <button type="button" className="btn btn-sm btn-primary" disabled={saving} onClick={handleSave}>
                <Ic d={LIC.check} size={13} />
                {saving ? t('crm.contacts.card.saving') : isNew ? t('crm.companies.card.create') : t('crm.contacts.card.save')}
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
              {!isNew && analytics && (
                <Metrics
                  items={[
                    [
                      t('crm.companies.card.metrics.contacts'),
                      analytics.contacts.total,
                      contacts.find((c) => c.position?.toLowerCase().includes('director') || c.position?.toLowerCase().includes('директор'))
                        ? t('crm.companies.card.metrics.oneMain')
                        : t('crm.companies.card.metrics.totalCount', { count: analytics.contacts.total }),
                    ],
                    [
                      t('crm.contacts.card.metrics.leads'),
                      analytics.leads.total,
                      t('crm.contacts.card.metrics.leadsInProgress', { count: analytics.leads.byStatus.in_progress }),
                    ],
                    [
                      t('crm.contacts.card.metrics.projects'),
                      analytics.projects.total,
                      t('crm.contacts.card.metrics.projectsActive', { count: analytics.projects.byStatus['В работе'] }),
                    ],
                    [t('crm.companies.card.metrics.potential'), `${money(analytics.metrics.pipelineRevenueConverted)} ${analytics.metrics.currency}`, t('crm.companies.card.metrics.potentialHint')],
                  ]}
                />
              )}

              <div className="cf-grid">
                <div className="cf-col">
                  <Card icon={LIC.users} title={t('crm.companies.card.companyFields.title')} sub={t('crm.companies.card.companyFields.sub')}>
                    <div className="cf-body">
                      <div className="cf-fields">
                        <F label={t('crm.companies.card.companyFields.name')} req wide>
                          <In value={form.name} onChange={(e) => set('name', e.target.value)} placeholder={t('crm.companies.card.companyFields.namePlaceholder')} className={error ? 'cf-err' : undefined} />
                        </F>
                        <F label={t('crm.companies.card.companyFields.legalName')}>
                          <In value={form.legalName} onChange={(e) => set('legalName', e.target.value)} placeholder={t('crm.companies.card.companyFields.legalNamePlaceholder')} />
                        </F>
                        <F label={t('crm.companies.card.companyFields.taxId')} hint={t('crm.companies.card.companyFields.taxIdHint')}>
                          <In value={form.taxId} onChange={(e) => set('taxId', e.target.value)} placeholder="7701456123" />
                        </F>
                        <F label={t('crm.contacts.card.personal.email')}>
                          <In type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="info@company.com" />
                        </F>
                        <F label={t('crm.contacts.card.personal.phone')}>
                          <In type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+7 900 000-00-00" />
                        </F>
                        <F label={t('crm.companies.card.companyFields.website')}>
                          <In type="url" value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="https://..." />
                        </F>
                        <F label={t('crm.companies.card.companyFields.industry')}>
                          <Sel value={form.industry || ''} onChange={(e) => set('industry', e.target.value)} placeholder={t('crm.crmShared.selectPlaceholder')} options={INDUSTRIES_F(t)} />
                        </F>
                        <F label={t('crm.contacts.card.personal.city')}>
                          <In value={form.city} onChange={(e) => set('city', e.target.value)} placeholder={t('crm.contacts.card.personal.cityPlaceholder')} />
                        </F>
                        <F label={t('crm.contacts.card.personal.country')}>
                          <In value={form.country} onChange={(e) => set('country', e.target.value)} placeholder={t('crm.companies.card.companyFields.countryPlaceholder')} />
                        </F>
                        <F label={t('crm.companies.card.companyFields.description')} wide>
                          <Ta rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder={t('crm.companies.card.companyFields.descriptionPlaceholder')} />
                        </F>
                        <F label={t('crm.contacts.card.personal.address')} wide>
                          <Ta rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} />
                        </F>
                      </div>
                    </div>
                  </Card>

                  <Card icon={LIC.note} title={t('crm.companies.card.requisites.title')} sub={t('crm.companies.card.requisites.sub')}>
                    <div className="cf-body">
                      <LegalRequisitesEditor value={req} onChange={setReq} />
                    </div>
                  </Card>
                </div>

                <div className="cf-col">
                  <SideCard title={t('crm.contacts.list.table.status')}>
                    <Sel value={form.status || 'active'} onChange={(e) => set('status', e.target.value)} options={STATUSES_F(t)} />
                  </SideCard>
                  <SideCard title={t('crm.companies.card.relationshipStage')}>
                    <Sel value={form.type || ''} onChange={(e) => set('type', e.target.value)} placeholder={t('crm.crmShared.notSpecifiedLead')} options={TYPE_OPTIONS(t)} />
                  </SideCard>
                  <SideCard title={t('crm.companies.list.drawer.size')}>
                    <Sel value={form.size || ''} onChange={(e) => set('size', e.target.value)} placeholder={t('crm.crmShared.notSpecified')} options={SIZES_F(t)} />
                  </SideCard>
                  <SideCard title={t('crm.contacts.card.assignees')} right={<span className="cf-mono">{picked.length}</span>}>
                    <DeptAssignees staff={staff} picked={picked} setPicked={setPicked} />
                    <AiAssigneeGroup entityType="company" entityId={isNew ? null : id} compact />
                  </SideCard>
                  {!isNew && companyMeta && (
                    <div className="cf-card">
                      <div className="cf-body">
                        <div className="cf-side-t">{t('crm.contacts.card.service.title')}</div>
                        <KV k={t('crm.companies.card.service.id')} v={<span className="cf-idbox">{companyMeta.id}</span>} />
                        <KV k={t('crm.companies.list.drawer.created')} v={new Date(companyMeta.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} mono />
                        <KV k={t('crm.companies.card.service.updated')} v={new Date(companyMeta.updatedAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} mono />
                        <KV k={t('crm.contacts.list.drawer.tags')} v={companyMeta.tags?.length ? <Tags list={companyMeta.tags} /> : null} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {tab === 'contacts' && (
            <Card
              icon={LIC.users}
              title={t('crm.companies.card.contactsTab.title')}
              sub={t('crm.companies.card.contactsTab.sub')}
              right={
                <button type="button" className="btn btn-sm btn-primary" onClick={() => navigate(`/app/contacts/new?companyId=${id}`)}>
                  <Ic d={LIC.plus} size={13} />
                  {t('crm.companies.card.contactsTab.add')}
                </button>
              }
            >
              {contacts.length === 0 ? (
                <div className="cf-empty">
                  <div className="t">{t('crm.companies.card.contactsTab.emptyTitle')}</div>
                  <div className="d">{t('crm.companies.card.contactsTab.emptyDesc')}</div>
                </div>
              ) : (
                <table className="cf-tbl">
                  <thead>
                    <tr>
                      <th>{t('crm.contacts.list.table.contact')}</th>
                      <th>{t('crm.contacts.list.table.contactInfo')}</th>
                      <th>{t('crm.contacts.card.leadsTab.colOwner')}</th>
                      <th>{t('crm.contacts.list.table.status')}</th>
                      <th className="r">{t('crm.contacts.list.table.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((c) => {
                      const name = c.fullName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || '—';
                      return (
                        <tr key={c.id}>
                          <td>
                            <div className="cl-idn">
                              <div className="cl-av">{initials(name)}</div>
                              <div>
                                <div className="nm">{name}</div>
                                <div className="sub">{c.position || '—'}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="cl-ch">
                              {c.email && <a href={`mailto:${c.email}`}>{c.email}</a>}
                              {c.phone && <span className="p">{c.phone}</span>}
                            </div>
                          </td>
                          <td>
                            <Own name={c.assignedTo} />
                          </td>
                          <td>
                            <span className={cl('cl-pill', c.status === 'active' ? 'ok' : 'mute')}>
                              <span className="dot" />
                              {c.status === 'active'
                                ? t('crm.contacts.list.statusPill.active')
                                : c.status === 'inactive'
                                  ? t('crm.contacts.list.statusPill.inactive')
                                  : t('crm.contacts.list.statusPill.archived')}
                            </span>
                          </td>
                          <td className="r">
                            <div className="cl-acts">
                              <button type="button" className="cl-ib" title={t('crm.companies.card.contactsTab.open')} onClick={() => navigate(`/app/contacts/${c.id}`)}>
                                <Ic d={LIC.chevR} size={13} />
                              </button>
                              {c.email && (
                                <a className="cl-ib" title={t('crm.contacts.list.table.mailTitle')} href={`mailto:${c.email}`}>
                                  <Ic d={LIC.mail} size={13} />
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              <div className="cf-foot">
                <span>{t('crm.companies.card.contactsTab.count', { count: contacts.length })}</span>
                <a className="btn btn-sm" href={`/app/contacts?companyId=${id}`}>
                  {t('crm.contacts.card.allContacts')}
                </a>
              </div>
            </Card>
          )}

          {tab === 'leads' && (
            <>
              <Metrics
                items={[
                  [
                    t('crm.contacts.card.metrics.leads'),
                    companyLeads.length,
                    t('crm.contacts.card.metrics.leadsInProgress', { count: companyLeads.filter((l) => l.status === 'В работе').length }),
                  ],
                  [t('crm.companies.card.leadsTab.won'), companyLeads.filter((l) => l.status === 'Закрыт (успех)').length, t('crm.companies.card.leadsTab.leadsUnit')],
                  [t('crm.companies.card.leadsTab.lost'), companyLeads.filter((l) => l.status === 'Закрыт (проигран)').length, t('crm.companies.card.leadsTab.leadsUnit')],
                  [t('crm.companies.card.leadsTab.conversion'), conversion + '%', t('crm.companies.card.leadsTab.conversionHint')],
                ]}
              />
              <Card
                icon={LIC.bolt}
                title={t('crm.companies.card.leadsTab.title')}
                right={
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => navigate('/app/leads')}>
                    <Ic d={LIC.plus} size={13} />
                    {t('crm.contacts.card.leadsTab.newLead')}
                  </button>
                }
              >
                {companyLeads.length === 0 ? (
                  <div className="cf-empty">
                    <div className="t">{t('crm.contacts.card.leadsTab.emptyTitle')}</div>
                    <div className="d">{t('crm.companies.card.leadsTab.emptyDesc')}</div>
                  </div>
                ) : (
                  <table className="cf-tbl">
                    <thead>
                      <tr>
                        <th>{t('crm.contacts.card.leadsTab.colLead')}</th>
                        <th>{t('crm.contacts.list.table.contact')}</th>
                        <th>{t('crm.contacts.list.table.status')}</th>
                        <th className="r">{t('crm.contacts.card.leadsTab.colSum')}</th>
                        <th>{t('crm.contacts.card.leadsTab.colOwner')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companyLeads.map((l) => {
                        const st = LST[l.status] || ['', l.status];
                        const linkedContact = contacts.find((c) => c.id === l.contactId);
                        return (
                          <tr key={l.id} onClick={() => navigate(`/app/leads/${l.id}`)} style={{ cursor: 'pointer' }}>
                            <td>
                              <div className="nm">{l.name || t('crm.contacts.card.leadsTab.untitled')}</div>
                              <div className="sub cf-mono">
                                {l.id.slice(0, 8)} · {new Date(l.createdAt).toLocaleDateString(dateLoc)}
                              </div>
                            </td>
                            <td>{linkedContact ? linkedContact.fullName || linkedContact.firstName : '—'}</td>
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
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
                <div className="cf-foot">
                  <span>{t('crm.companies.card.leadsTab.footNote')}</span>
                  <a className="btn btn-sm" href="/app/leads">
                    {t('crm.companies.card.leadsTab.kanban')}
                  </a>
                </div>
              </Card>
            </>
          )}

          {tab === 'projects' && (
            <>
              {analytics && (
                <Metrics
                  items={[
                    [
                      t('crm.contacts.card.metrics.projects'),
                      companyProjects.length,
                      t('crm.contacts.card.metrics.projectsActive', { count: projectsInPipeline.length }),
                    ],
                    [
                      t('crm.companies.card.projectsTab.inProgress'),
                      `${money(analytics.metrics.pipelineRevenueConverted)} ${cur}`,
                      t('crm.companies.card.projectsTab.dealsCount', { count: projectsInPipeline.length }),
                    ],
                    [
                      t('crm.companies.card.leadsTab.won'),
                      `${money(analytics.metrics.totalRevenueConverted)} ${cur}`,
                      t('crm.companies.card.projectsTab.dealsCount', { count: projectsWon.length }),
                    ],
                    [
                      t('crm.companies.card.projectsTab.lost'),
                      `${money(analytics.metrics.lostRevenueConverted)} ${cur}`,
                      t('crm.companies.card.projectsTab.dealsCount', { count: projectsLost.length }),
                    ],
                  ]}
                />
              )}
            <Card
              icon={LIC.users}
              title={t('crm.contacts.card.projectsTab.title')}
              sub={t('crm.companies.card.projectsTab.sub')}
              right={
                <button type="button" className="btn btn-sm btn-primary" onClick={() => navigate('/app/projects')}>
                  <Ic d={LIC.plus} size={13} />
                  {t('crm.companies.card.projectsTab.newProject')}
                </button>
              }
            >
              {companyProjects.length === 0 ? (
                <div className="cf-empty">
                  <div className="t">{t('crm.contacts.card.projectsTab.emptyTitle')}</div>
                  <div className="d">{t('crm.companies.card.projectsTab.emptyDesc')}</div>
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
                    {companyProjects.map((p) => (
                      <tr key={p.id} onClick={() => navigate(`/app/projects/${p.id}`)} style={{ cursor: 'pointer' }}>
                        <td>
                          <div className="nm">{p.name}</div>
                          <div className="sub cf-mono">{p.id.slice(0, 8)}</div>
                        </td>
                        <td>
                          <span className={cl('cl-pill', PST[p.status])}>
                            <span className="dot" />
                            {PROJECT_STATUS_LABEL(t, p.status)}
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
                          <span className="cf-mono">{p.updatedAt ? new Date(p.updatedAt).toLocaleDateString(dateLoc) : '—'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="cf-foot">
                <span>{t('crm.companies.card.projectsTab.totalBudgets', { amount: fmtByCurrency(sumByCurrency(companyProjects, (p) => p.amount, (p) => p.currency)) })}</span>
              </div>
            </Card>
            </>
          )}

          {tab === 'tasks' && (
            <Card
              icon={LIC.check}
              title={t('crm.companies.card.tasksTab.title')}
              sub={t('crm.companies.card.tasksTab.sub')}
            >
              <div className="cf-tsrc">
                {(
                  [
                    ['all', t('crm.companies.card.tasksTab.sourceAll'), allTasks.length],
                    ['company', t('crm.companies.card.tasksTab.sourceCompany'), taskCountBySource('company')],
                    ['project', t('crm.companies.card.tasksTab.sourceProject'), taskCountBySource('project')],
                    ['lead', t('crm.companies.card.tasksTab.sourceLead'), taskCountBySource('lead')],
                  ] as Array<['all' | TaskSource, string, number]>
                ).filter(([k, , n]) => k !== 'company' || n > 0).map(([k, label, n]) => (
                  <button key={k} type="button" className={cl('cf-chip', taskSource === k && 'on')} onClick={() => setTaskSource(k)}>
                    {label} <span className="n">{n}</span>
                  </button>
                ))}
              </div>
              <div className="cf-tasks">
                {TASK_COLS.map(([colId, label]) => {
                  const list = visibleTasks.filter((tsk) => tsk.column === colId);
                  return (
                    <div key={colId} className="cf-tcol">
                      <div className="cf-tcol-h">
                        <span>{label}</span>
                        <span>{list.length}</span>
                      </div>
                      {list.map((tsk) => (
                        <div key={tsk.key} className="cf-task" onClick={() => openTaskSource(tsk)} style={{ cursor: 'pointer' }}>
                          <div className={cl('cf-src', tsk.source)}>
                            <i />
                            {tsk.source === 'company'
                              ? t('crm.companies.card.tasksTab.fromCompany')
                              : tsk.source === 'project'
                                ? t('crm.companies.card.tasksTab.fromProject', { name: tsk.sourceName || '—' })
                                : t('crm.companies.card.tasksTab.fromLead', { name: tsk.sourceName || '—' })}
                          </div>
                          <div className="t">{tsk.title}</div>
                          {tsk.description && <div className="d">{tsk.description}</div>}
                          <div className="pl">
                            {tsk.statusLabel !== label && <span className="cl-pill wait">{tsk.statusLabel}</span>}
                            {tsk.priority && (
                              <span className={cl('cl-pill', PRIORITY_PILL[tsk.priority])}>
                                {t(`crm.companies.tasks.priorities.${tsk.priority}`)}
                              </span>
                            )}
                            {tsk.tags.map((tag) => (
                              <span key={tag} className="cl-pill mute">
                                #{tag}
                              </span>
                            ))}
                          </div>
                          {tsk.checklist && (
                            <div className="chk" title={t('crm.companies.card.tasksTab.checklist')}>
                              <div className="bar">
                                <i style={{ width: `${Math.round((tsk.checklist.done / tsk.checklist.total) * 100)}%` }} />
                              </div>
                              <span>
                                {tsk.checklist.done}/{tsk.checklist.total}
                              </span>
                            </div>
                          )}
                          <div className="m">
                            <span className={cl('due', tsk.overdue && 'late')}>{fmtDue(tsk.due)}</span>
                            <span>{tsk.assignees.length ? tsk.assignees.join(', ') : '—'}</span>
                          </div>
                        </div>
                      ))}
                      {list.length === 0 && <div style={{ fontSize: 11, color: 'var(--fg-4)' }}>{t('crm.companies.card.tasksTab.empty')}</div>}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {tab === 'analytics' && analytics && (
            <>
              <Card icon={LIC.bolt} title={t('crm.companies.card.analyticsTab.title')} sub={t('crm.companies.card.analyticsTab.sub')}>
                <div className="cf-ana">
                  {[
                    [t('crm.companies.card.metrics.contacts'), contacts.length, t('crm.companies.card.analyticsTab.peopleInBase')],
                    [t('crm.contacts.card.metrics.leads'), analytics.leads.total, t('crm.companies.card.analyticsTab.allTime')],
                    [
                      t('crm.contacts.card.metrics.projects'),
                      analytics.projects.total,
                      t('crm.contacts.card.metrics.projectsActive', { count: analytics.projects.byStatus['В работе'] }),
                    ],
                    [t('crm.companies.list.table.revenue'), `${money(analytics.metrics.totalRevenueConverted)} ${cur}`, t('crm.companies.card.metrics.potentialHint2')],
                    [t('crm.companies.card.leadsTab.conversion'), analytics.metrics.conversionRate + '%', t('crm.companies.card.leadsTab.conversionHint')],
                    [t('crm.companies.list.drawer.avgCheck'), `${money(analytics.metrics.avgProjectValueConverted)} ${cur}`, t('crm.companies.card.analyticsTab.byProjects')],
                  ].map(([k, v, d]) => (
                    <div key={k as string}>
                      <div className="k">{k}</div>
                      <div className="v">{v}</div>
                      <div className="d">{d}</div>
                    </div>
                  ))}
                </div>
              </Card>

              <div className="cf-grid" style={{ marginTop: 16, gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
                <Card title={t('crm.companies.card.analyticsTab.leadsByStatus')}>
                  <div className="cf-body">
                    <div className="cf-bars">
                      {[
                        [t('crm.companies.card.analyticsTab.new'), analytics.leads.byStatus.new, false],
                        [t('crm.contacts.card.leadStatusPill.inProgress'), analytics.leads.byStatus.in_progress, false],
                        [t('crm.companies.card.analyticsTab.waiting'), analytics.leads.byStatus.waiting, false],
                        [t('crm.companies.card.analyticsTab.success'), analytics.leads.byStatus.won, true],
                        [t('crm.companies.card.analyticsTab.failure'), analytics.leads.byStatus.lost, false],
                      ].map(([l, n, isWon]) => {
                        const max = Math.max(1, analytics.leads.total);
                        return (
                          <div key={l as string} className="cf-bar">
                            <span className="l">{l}</span>
                            <div className="t">
                              <i className={cl(!isWon && 'soft')} style={{ width: ((n as number) / max) * 100 + '%' }} />
                            </div>
                            <span className="n">{n}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Card>

                <Card title={t('crm.companies.card.analyticsTab.moneyFunnel')} sub={t('crm.companies.card.analyticsTab.moneyFunnelSub')}>
                  <div className="cf-body">
                    <div className="cf-funnel">
                      {(
                        [
                          [t('crm.companies.card.analyticsTab.allProjects'), analytics.metrics.totalRevenueConverted + analytics.metrics.pipelineRevenueConverted + analytics.metrics.lostRevenueConverted, ''],
                          [t('crm.companies.card.projectsTab.inProgress'), analytics.metrics.pipelineRevenueConverted, ''],
                          [t('crm.companies.card.leadsTab.won'), analytics.metrics.totalRevenueConverted, 'won'],
                          [t('crm.companies.card.projectsTab.lost'), analytics.metrics.lostRevenueConverted, 'lost'],
                        ] as Array<[string, number, string]>
                      ).map(([l, v, band]) => {
                        const total = analytics.metrics.totalRevenueConverted + analytics.metrics.pipelineRevenueConverted + analytics.metrics.lostRevenueConverted || 1;
                        const w = (v / total) * 100;
                        return (
                          <div key={l} className="cf-fn">
                            <div className={cl('band', band)}>
                              <i style={{ width: w + '%' }} />
                              <span>{l}</span>
                            </div>
                            <div className="m">
                              {money(v)} {cur}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="cf-foot">
                    <span>
                      {t('crm.companies.card.analyticsTab.potentialInOpen', { amount: money(analytics.metrics.pipelineRevenueConverted), currency: cur })}
                    </span>
                  </div>
                </Card>
              </div>

              <div style={{ marginTop: 16 }}>
                <Card title={t('crm.companies.card.analyticsTab.projectsByStatus')}>
                  <div className="cf-body">
                    <div className="cf-bars">
                      {Object.entries(analytics.projects.byStatus).map(([l, n]) => {
                        const max = Math.max(1, analytics.projects.total);
                        return (
                          <div key={l} className="cf-bar">
                            <span className="l">{PROJECT_STATUS_LABEL(t, l)}</span>
                            <div className="t">
                              <i className={cl(l !== 'Закрыт' && l !== 'Выиграно' && 'soft')} style={{ width: (n / max) * 100 + '%' }} />
                            </div>
                            <span className="n">{n}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="cf-foot">
                    <span>
                      {t('crm.companies.card.analyticsTab.projectsSum', {
                        amount: money(analytics.metrics.pipelineRevenueConverted + analytics.metrics.totalRevenueConverted + analytics.metrics.lostRevenueConverted),
                        currency: cur,
                        closedAmount: money(analytics.metrics.totalRevenueConverted),
                      })}
                    </span>
                  </div>
                </Card>
              </div>
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
};
