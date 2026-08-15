// src/pages/contacts/ContactsListPage.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  fetchContacts,
  type Contact,
  deleteContact,
  bulkUpdateContacts,
  type BulkUpdateContactsDto,
} from '../../api/contacts';
import { fetchStaff, type StaffUser } from '../../api/staff';
import { fetchCompanies, type Company } from '../../api/companies';
import { fetchLeads, isLeadInTrash, type Lead } from '../../api/leads';
import { useWorkspaceStyleColumnDrag } from '../../components/table/useWorkspaceStyleColumnDrag';
import '../projects/ProjectsListPage.css';
import {
  OwnerAvatarsRow,
  resolveContactManagerDisplay,
} from '../../components/crm/OwnerAvatarsRow';
import { useAlertModal } from '../../contexts/AlertModalContext';

type ContactsCustomGroup = {
  id: string;
  name: string;
  order: number;
};

const CONTACTS_GROUPS_KEY = 'contacts_custom_groups_v1';
const CONTACTS_GROUP_ASSIGNMENTS_KEY = 'contacts_custom_group_assignments_v1';
const CONTACTS_TABLE_COLUMNS_KEY = 'contacts_table_columns_v1';

type ContactTableColId =
  | 'contact'
  | 'email'
  | 'phone'
  | 'company'
  | 'manager'
  | 'status'
  | 'lead'
  | 'group'
  | 'tags'
  | 'actions';

export const ContactsListPage: React.FC = () => {
  const { t } = useTranslation();
  const { showAlert, showConfirm } = useAlertModal();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkModalOpen, setBulkModalOpen] = useState<boolean>(false);
  const [bulkSaving, setBulkSaving] = useState<boolean>(false);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [companiesMap, setCompaniesMap] = useState<Record<string, Company>>({});
  const [leadByContactId, setLeadByContactId] = useState<Record<string, Lead>>({});
  const [bulkAssignedUserId, setBulkAssignedUserId] = useState<string>('');
  const [bulkStatus, setBulkStatus] = useState<string>('');
  const [bulkTags, setBulkTags] = useState<string>('');
  const [groupMode, setGroupMode] = useState<'none' | 'company' | 'status' | 'manager' | 'custom'>('company');
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  const [customGroups, setCustomGroups] = useState<ContactsCustomGroup[]>([]);
  const [contactGroupMap, setContactGroupMap] = useState<Record<string, string>>({});
  const [draggingContactId, setDraggingContactId] = useState<string | null>(null);
  const [dragOverGroupKey, setDragOverGroupKey] = useState<string | null>(null);
  const [draggingGroupId, setDraggingGroupId] = useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchContacts({ search: search || undefined, limit: 100 }),
      fetchStaff(),
      fetchCompanies({ limit: 500 }),
      fetchLeads(),
    ])
      .then(([contactsData, staffData, companiesData, leadsData]) => {
        if (!alive) return;
        setContacts(contactsData.items);
        setStaff(staffData);
        const map: Record<string, Company> = {};
        companiesData.items.forEach((company) => {
          map[company.id] = company;
        });
        setCompaniesMap(map);
        const leadMap: Record<string, Lead> = {};
        leadsData.forEach((lead) => {
          if (!lead.contactId || isLeadInTrash(lead)) return;
          if (!leadMap[lead.contactId]) leadMap[lead.contactId] = lead;
        });
        setLeadByContactId(leadMap);
      })
      .catch((e) => {
        console.error(e);
        if (!alive) return;
        setError(e.message || t('crm.contacts.list.errors.loadFailed'));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [search]);

  const handleCreate = () => navigate('/app/contacts/new');
  const handleOpen = (id: string) => navigate(`/app/contacts/${id}`);
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await showConfirm(t('crm.contacts.list.deleteConfirm'), {
      title: t('crm.confirmModal.deleteTitle', { defaultValue: 'Удаление' }),
      confirmLabel: t('crm.confirmModal.deleteLabel', { defaultValue: 'Удалить' }),
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteContact(id);
      setContacts(contacts.filter((c) => c.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err: any) {
      showAlert(err.message || t('crm.contacts.list.errors.deleteFailed'), {
        variant: 'error',
      });
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === contacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(contacts.map((c) => c.id)));
    }
  };

  const handleBulkUpdate = async () => {
    if (selectedIds.size === 0) return;

    setBulkSaving(true);
    try {
      const dto: BulkUpdateContactsDto = {
        contactIds: Array.from(selectedIds),
      };

      if (bulkAssignedUserId) {
        const staffMember = staff.find((s) => s.id === bulkAssignedUserId);
        dto.assignedUserId = bulkAssignedUserId;
        dto.assignedTo = staffMember?.fullName || staffMember?.email || null;
      }

      if (bulkStatus) {
        dto.status = bulkStatus;
      }

      if (bulkTags.trim()) {
        dto.tagsToAdd = bulkTags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
      }

      await bulkUpdateContacts(dto);
      setBulkModalOpen(false);
      setSelectedIds(new Set());
      setBulkAssignedUserId('');
      setBulkStatus('');
      setBulkTags('');

      // Перезагружаем список
      const data = await fetchContacts({ search: search || undefined, limit: 100 });
      setContacts(data.items);
    } catch (e: any) {
      console.error(e);
      showAlert(e.message || t('crm.contacts.bulk.errors.updateFailed'), {
        variant: 'error',
      });
    } finally {
      setBulkSaving(false);
    }
  };

  const managerLabelById = useMemo(() => {
    const map = new Map<string, string>();
    staff.forEach((member) => map.set(member.id, member.fullName || member.email));
    return map;
  }, [staff]);

  const contactColumnDefs = useMemo((): { id: ContactTableColId; label: string }[] => {
    return [
      { id: 'contact', label: t('crm.contacts.list.table.contact') },
      { id: 'email', label: 'E-mail' },
      { id: 'phone', label: t('crm.contacts.form.fields.phone') },
      { id: 'company', label: t('crm.contacts.form.fields.company') },
      { id: 'manager', label: t('crm.contacts.list.table.manager') },
      { id: 'status', label: t('crm.contacts.form.fields.status') },
      { id: 'lead', label: t('crm.contacts.list.table.lead') },
      { id: 'group', label: t('crm.contacts.list.table.group') },
      { id: 'tags', label: t('crm.contacts.bulk.tags') },
      { id: 'actions', label: t('crm.projects.tasks.table.headers.actions') },
    ];
  }, [t]);

  const orderedContactColumns = useMemo(() => {
    if (!contactColumnDefs.length) return [];
    const map = new Map(contactColumnDefs.map((col) => [col.id, col]));
    const order =
      columnOrder.length > 0 ? columnOrder : contactColumnDefs.map((col) => col.id);
    const result: typeof contactColumnDefs = [];
    order.forEach((id) => {
      const col = map.get(id as ContactTableColId);
      if (col) result.push(col);
    });
    contactColumnDefs.forEach((col) => {
      if (!result.find((r) => r.id === col.id)) result.push(col);
    });
    return result;
  }, [contactColumnDefs, columnOrder]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CONTACTS_TABLE_COLUMNS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.order)) setColumnOrder(parsed.order);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CONTACTS_TABLE_COLUMNS_KEY, JSON.stringify({ order: columnOrder }));
    } catch {
      // ignore
    }
  }, [columnOrder]);

  useEffect(() => {
    if (!contactColumnDefs.length) return;
    setColumnOrder((prev) => {
      if (!prev.length) return contactColumnDefs.map((c) => c.id);
      const ids = contactColumnDefs.map((c) => c.id);
      const filtered = prev.filter((id) => ids.includes(id as ContactTableColId));
      const missing = ids.filter((cid) => !filtered.includes(cid));
      return [...filtered, ...missing];
    });
  }, [contactColumnDefs]);

  const reorderColumns = useCallback((dragId: string, targetId: string) => {
    setColumnOrder((prev) => {
      const next = [...prev];
      const from = next.indexOf(dragId);
      const to = next.indexOf(targetId);
      if (from === -1 || to === -1) return prev;
      next.splice(from, 1);
      next.splice(to, 0, dragId);
      return next;
    });
  }, []);

  const { getThProps, draggingColumnKey, columnDragOverKey } =
    useWorkspaceStyleColumnDrag(reorderColumns, 'light');

  const contactColClass = (colId: ContactTableColId): string =>
    colId === 'contact'
      ? 'lv-tcol-name'
      : colId === 'actions'
        ? 'lv-tcol-actions'
        : 'lv-tcol-center';

  const renderContactCellContent = (
    contact: Contact,
    colId: ContactTableColId,
    fullName: string,
  ): React.ReactNode => {
    switch (colId) {
      case 'contact':
        return <span className="text-[12.5px] font-medium text-[var(--ink)]">{fullName}</span>;
      case 'email':
        return <span className="text-[12.5px] text-[var(--ink)]">{contact.email || '—'}</span>;
      case 'phone':
        return <span className="text-[12.5px] text-[var(--ink)]">{contact.phone || '—'}</span>;
      case 'company':
        return contact.companyId ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/app/companies/${contact.companyId}`);
            }}
            className="text-lumiva-accent hover:underline text-[12.5px]"
          >
            {companiesMap[contact.companyId]?.name ||
              contact.company ||
              t('crm.contacts.list.groups.noCompany')}
          </button>
        ) : (
          <span className="text-[12.5px] text-[var(--ink)]">{contact.company || '—'}</span>
        );
      case 'manager': {
        const items = resolveContactManagerDisplay(contact, staff);
        return items.length ? (
          <OwnerAvatarsRow items={items} readOnly />
        ) : (
          <span className="text-[var(--fg-3)]">—</span>
        );
      }
      case 'status':
        return <span className="text-[12.5px] text-[var(--ink)]">{contact.status || '—'}</span>;
      case 'lead':
        return leadByContactId[contact.id] ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/app/leads/${leadByContactId[contact.id].id}`);
            }}
            className="lv-cell-pill"
          >
            <span className="dot" style={{ background: '#60a5fa' }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {leadByContactId[contact.id].name || t('crm.contacts.list.table.openLead')}
            </span>
          </button>
        ) : (
          <span className="text-[var(--fg-3)]">—</span>
        );
      case 'group':
        return groupMode === 'custom' ? (
          <select
            value={contactGroupMap[contact.id] || ''}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.stopPropagation();
              assignContactGroup(contact.id, e.target.value);
            }}
            className="w-full rounded-md border border-[var(--line-2)] bg-white px-2 py-1 text-[11px] text-[var(--ink)] outline-none"
          >
            <option value="">{t('crm.contacts.list.groups.ungrouped')}</option>
            {customGroupsOrdered.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-[var(--fg-3)]">—</span>
        );
      case 'tags':
        return (
          <span className="text-[12.5px] text-[var(--fg-2)]">
            {contact.tags?.length ? contact.tags.join(', ') : '—'}
          </span>
        );
      case 'actions':
        return (
          <button
            type="button"
            onClick={(e) => handleDelete(contact.id, e)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#f0c8cf] bg-white px-3 py-1.5 text-[12px] font-medium text-[#9a1f31] hover:bg-[#fbecef] hover:border-[#e8b4bb] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {t('crm.contacts.list.delete')}
          </button>
        );
      default:
        return null;
    }
  };

  useEffect(() => {
    try {
      const rawGroups = localStorage.getItem(CONTACTS_GROUPS_KEY);
      const rawAssignments = localStorage.getItem(CONTACTS_GROUP_ASSIGNMENTS_KEY);
      if (rawGroups) {
        const parsed = JSON.parse(rawGroups);
        if (Array.isArray(parsed)) {
          setCustomGroups(
            parsed
              .filter((item) => item && typeof item.id === 'string' && typeof item.name === 'string')
              .map((item, index) => ({
                id: item.id,
                name: item.name,
                order: typeof item.order === 'number' ? item.order : index,
              })),
          );
        }
      }
      if (rawAssignments) {
        const parsed = JSON.parse(rawAssignments);
        if (parsed && typeof parsed === 'object') {
          setContactGroupMap(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CONTACTS_GROUPS_KEY, JSON.stringify(customGroups));
      localStorage.setItem(CONTACTS_GROUP_ASSIGNMENTS_KEY, JSON.stringify(contactGroupMap));
    } catch {
      // ignore
    }
  }, [customGroups, contactGroupMap]);

  const customGroupsOrdered = useMemo(
    () => [...customGroups].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'ru')),
    [customGroups],
  );

  const createCustomGroup = () => {
    const name = window.prompt(t('crm.contacts.list.groups.prompts.newName'));
    if (!name || !name.trim()) return;
    setCustomGroups((prev) => [
      ...prev,
      {
        id: `cg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        name: name.trim(),
        order: prev.length,
      },
    ]);
  };

  const renameCustomGroup = (groupId: string) => {
    const current = customGroups.find((group) => group.id === groupId);
    if (!current) return;
    const next = window.prompt(t('crm.contacts.list.groups.prompts.rename'), current.name);
    if (!next || !next.trim()) return;
    setCustomGroups((prev) =>
      prev.map((group) => (group.id === groupId ? { ...group, name: next.trim() } : group)),
    );
  };

  const deleteCustomGroup = async (groupId: string) => {
    const ok = await showConfirm(t('crm.contacts.list.groups.confirmDelete'), {
      title: t('crm.confirmModal.deleteTitle', { defaultValue: 'Удаление' }),
      confirmLabel: t('crm.confirmModal.deleteLabel', { defaultValue: 'Удалить' }),
      danger: true,
    });
    if (!ok) return;
    setCustomGroups((prev) => prev.filter((group) => group.id !== groupId));
    setContactGroupMap((prev) => {
      const next: Record<string, string> = {};
      Object.entries(prev).forEach(([contactId, assignedGroupId]) => {
        if (assignedGroupId !== groupId) next[contactId] = assignedGroupId;
      });
      return next;
    });
    setCollapsedGroups((prev) => prev.filter((item) => item !== groupId));
  };

  const assignContactGroup = (contactId: string, groupId: string) => {
    setContactGroupMap((prev) => {
      if (!groupId) {
        const next = { ...prev };
        delete next[contactId];
        return next;
      }
      return { ...prev, [contactId]: groupId };
    });
  };

  const moveCustomGroup = (groupId: string, direction: 'up' | 'down') => {
    const ordered = [...customGroupsOrdered];
    const index = ordered.findIndex((group) => group.id === groupId);
    if (index === -1) return;
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= ordered.length) return;
    const next = [...ordered];
    const [moved] = next.splice(index, 1);
    next.splice(nextIndex, 0, moved);
    setCustomGroups(next.map((group, order) => ({ ...group, order })));
  };

  const reorderCustomGroups = (sourceGroupId: string, targetGroupId: string) => {
    if (sourceGroupId === targetGroupId) return;
    const ordered = [...customGroupsOrdered];
    const sourceIndex = ordered.findIndex((group) => group.id === sourceGroupId);
    const targetIndex = ordered.findIndex((group) => group.id === targetGroupId);
    if (sourceIndex === -1 || targetIndex === -1) return;
    const next = [...ordered];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    setCustomGroups(next.map((group, order) => ({ ...group, order })));
  };

  const groupedContacts = useMemo(() => {
    if (groupMode === 'none') {
      return [{ key: 'all', label: t('crm.common.all'), items: contacts }];
    }
    if (groupMode === 'custom') {
      const grouped = customGroupsOrdered.map((group) => ({
        key: group.id,
        label: group.name,
        items: contacts.filter((contact) => contactGroupMap[contact.id] === group.id),
      }));
      const ungrouped = contacts.filter((contact) => !contactGroupMap[contact.id]);
      return [
        ...grouped,
        { key: 'ungrouped', label: t('crm.contacts.list.groups.ungrouped'), items: ungrouped },
      ];
    }
    const map = new Map<string, Contact[]>();
    const getGroup = (contact: Contact) => {
      if (groupMode === 'company') {
        if (contact.companyId && companiesMap[contact.companyId]?.name) {
          return companiesMap[contact.companyId].name;
        }
        return contact.company || t('crm.contacts.list.groups.noCompany');
      }
      if (groupMode === 'status') return contact.status || t('crm.contacts.list.groups.noStatus');
      if (groupMode === 'manager') {
        if (contact.assignedUserId && managerLabelById.has(contact.assignedUserId)) {
          return managerLabelById.get(contact.assignedUserId) as string;
        }
        return contact.assignedTo || t('crm.contacts.list.groups.noManager');
      }
      return t('crm.common.all');
    };
    contacts.forEach((contact) => {
      const key = getGroup(contact).trim() || t('crm.contacts.list.groups.ungrouped');
      const list = map.get(key) || [];
      list.push(contact);
      map.set(key, list);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0], 'ru'))
      .map(([key, items]) => ({ key, label: key, items }));
  }, [contacts, groupMode, managerLabelById, companiesMap, t, customGroupsOrdered, contactGroupMap]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
    );
  };

  return (
    <MainLayout>
      <div
        className="lv-pt w-full pb-8 min-w-0"
        style={{
          marginLeft: -24,
          marginRight: -24,
          paddingLeft: 24,
          paddingRight: 24,
          width: 'calc(100% + 48px)',
        }}
      >
        <div className="lv-pt-head">
          <div>
            <h1>{t('crm.contacts.list.title')}</h1>
            <div className="sub">
              {t('crm.contacts.list.subtitle')}
              {selectedIds.size > 0 && (
                <span className="ml-2" style={{ color: 'var(--ink)' }}>
                  ({selectedIds.size} {t('crm.contacts.list.selected')})
                </span>
              )}
            </div>
          </div>
          <div className="lv-pt-head-actions">
            {selectedIds.size > 0 && (
              <button type="button" onClick={() => setBulkModalOpen(true)} className="lv-tb-btn">
                {t('crm.contacts.list.bulkOperations')} ({selectedIds.size})
              </button>
            )}
            <button
              type="button"
              onClick={handleCreate}
              className="lv-tb-btn"
              style={{ background: '#222', color: '#fff', borderColor: '#222', borderRadius: 8 }}
            >
              + {t('crm.contacts.list.create')}
            </button>
          </div>
        </div>

        {error && (
          <div className="text-[12px] text-rose-600 bg-rose-50 border border-rose-200 rounded-[8px] px-3 py-2 mb-[14px]">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-[12px] text-slate-400 mb-[14px]">{t('crm.contacts.list.loading')}</div>
        ) : contacts.length === 0 ? (
          <div
            className="rounded-[10px] border p-8 text-center"
            style={{ borderColor: 'var(--line-2)', background: 'var(--surface)' }}
          >
            <div className="text-[12px] text-[var(--fg-3)]">
              {search ? t('crm.contacts.list.notFound') : t('crm.contacts.list.empty')}
            </div>
            {!search && (
              <button
                type="button"
                onClick={handleCreate}
                className="mt-4 lv-tb-btn"
                style={{ background: '#222', color: '#fff', borderColor: '#222', borderRadius: 8 }}
              >
                {t('crm.contacts.list.createFirst')}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="lv-toolbar">
              <div className="lv-tb-search" style={{ flex: '1 1 180px', maxWidth: 320 }}>
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  style={{ color: 'var(--fg-4)', flexShrink: 0 }}
                  aria-hidden
                >
                  <circle cx="6.5" cy="6.5" r="5.5" />
                  <path d="M11 11l3.5 3.5" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('crm.contacts.list.search')}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    style={{
                      background: 'none',
                      border: 0,
                      cursor: 'pointer',
                      color: 'var(--fg-3)',
                      fontSize: 14,
                      padding: 0,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="lv-toolbar-divider" />

              <label className="lv-tb-select">
                <span className="lbl">{t('crm.leads.list.groupMode.label')}:</span>
                <select
                  value={groupMode}
                  onChange={(e) =>
                    setGroupMode(e.target.value as 'none' | 'company' | 'status' | 'manager' | 'custom')
                  }
                >
                  <option value="company">{t('crm.contacts.list.groupMode.company')}</option>
                  <option value="status">{t('crm.contacts.list.groupMode.status')}</option>
                  <option value="manager">{t('crm.contacts.list.groupMode.manager')}</option>
                  <option value="custom">{t('crm.contacts.list.groupMode.custom')}</option>
                  <option value="none">{t('crm.contacts.list.groupMode.none')}</option>
                </select>
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ color: 'var(--fg-3)', flexShrink: 0 }}
                  aria-hidden
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </label>

              {groupMode === 'custom' && (
                <>
                  <div className="lv-toolbar-divider" />
                  <button type="button" className="lv-tb-btn" onClick={createCustomGroup}>
                    + {t('crm.contacts.list.groups.new')}
                  </button>
                  {customGroupsOrdered.map((group) => (
                    <div
                      key={group.id}
                      draggable
                      onDragStart={(e) => {
                        setDraggingGroupId(group.id);
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', group.id);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverGroupId(group.id);
                      }}
                      onDragLeave={() => {
                        setDragOverGroupId((prev) => (prev === group.id ? null : prev));
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (!draggingGroupId) return;
                        reorderCustomGroups(draggingGroupId, group.id);
                        setDraggingGroupId(null);
                        setDragOverGroupId(null);
                      }}
                      onDragEnd={() => {
                        setDraggingGroupId(null);
                        setDragOverGroupId(null);
                      }}
                      className="lv-tb-btn"
                      style={{
                        borderColor: dragOverGroupId === group.id ? 'var(--ink)' : undefined,
                      }}
                    >
                      <span style={{ fontSize: 11 }}>{group.name}</span>
                      <button
                        type="button"
                        className="lv-tb-btn"
                        style={{ padding: '2px 6px', fontSize: 10 }}
                        onClick={() => moveCustomGroup(group.id, 'up')}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="lv-tb-btn"
                        style={{ padding: '2px 6px', fontSize: 10 }}
                        onClick={() => moveCustomGroup(group.id, 'down')}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="lv-tb-btn"
                        style={{ padding: '2px 6px', fontSize: 10 }}
                        onClick={() => renameCustomGroup(group.id)}
                      >
                        {t('crm.contacts.list.groups.renameShort')}
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#f0c8cf] bg-white px-3 py-1.5 text-[12px] font-medium text-[#9a1f31] hover:bg-[#fbecef] hover:border-[#e8b4bb] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        onClick={() => deleteCustomGroup(group.id)}
                      >
                        {t('crm.contacts.list.groups.deleteShort')}
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>

            <div className="lv-proj-wrap">
            <div className="lv-proj-scroll">
              <table className="lv-proj-table lv-leads-table min-w-[900px]">
                <thead>
                  <tr>
                    <th className="lv-col-check">
                      <button
                        type="button"
                        className={`lv-checkbox${
                          contacts.length > 0 && selectedIds.size === contacts.length
                            ? ' checked'
                            : selectedIds.size > 0
                              ? ' indet'
                              : ''
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectAll();
                        }}
                        role="checkbox"
                        aria-checked={contacts.length > 0 && selectedIds.size === contacts.length}
                      >
                        {selectedIds.size > 0 && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M5 12l4 4 10-10" />
                          </svg>
                        )}
                      </button>
                    </th>
                    {orderedContactColumns.map((col) => {
                      const isDragging = draggingColumnKey === col.id;
                      const isDropTarget = columnDragOverKey === col.id && !isDragging;
                      return (
                        <th
                          key={col.id}
                          {...(() => {
                            const props = getThProps(col.id, col.label, '');
                            const { className: _c, ...rest } = props as any;
                            return rest;
                          })()}
                          className={[
                            isDragging ? 'lv-col-dragging' : '',
                            isDropTarget ? 'lv-col-drop-target' : '',
                            contactColClass(col.id),
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          <span className="lv-th-inner">
                            <span className="lv-th-grip">⋮⋮</span>
                            {col.label}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {groupedContacts.map((group) => {
                    const collapsed = collapsedGroups.includes(group.key);
                    return (
                      <React.Fragment key={group.key}>
                        <tr
                          className="lv-proj-group-row"
                          style={
                            groupMode === 'custom' && dragOverGroupKey === group.key
                              ? { boxShadow: 'inset 0 0 0 2px rgba(59, 130, 246, 0.35)' }
                              : undefined
                          }
                          onDragOver={(e) => {
                            if (groupMode !== 'custom' || !draggingContactId) return;
                            e.preventDefault();
                            setDragOverGroupKey(group.key);
                          }}
                          onDragLeave={() => {
                            if (groupMode !== 'custom') return;
                            setDragOverGroupKey((prev) => (prev === group.key ? null : prev));
                          }}
                          onDrop={(e) => {
                            if (groupMode !== 'custom' || !draggingContactId) return;
                            e.preventDefault();
                            assignContactGroup(
                              draggingContactId,
                              group.key === 'ungrouped' ? '' : group.key,
                            );
                            setDraggingContactId(null);
                            setDragOverGroupKey(null);
                          }}
                        >
                          <td colSpan={1 + orderedContactColumns.length}>
                            <div className="lv-proj-group-inner">
                              <button
                                type="button"
                                className={`lv-group-toggle${collapsed ? ' collapsed' : ''}`}
                                onClick={() => toggleGroup(group.key)}
                              >
                                <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden>
                                  <path d="M2.5 4.5L6 8L9.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </button>
                              <span style={{ fontWeight: 500, fontSize: 12.5, color: 'var(--ink)' }}>
                                {group.label}
                              </span>
                              <span className="lv-group-meta">{group.items.length}</span>
                            </div>
                          </td>
                        </tr>
                        {!collapsed &&
                          group.items.map((contact) => {
                            const fullName =
                              contact.fullName ||
                              `${contact.firstName || ''} ${contact.lastName || ''}`.trim() ||
                              t('crm.projects.detail.fields.leadNameFallback');
                            return (
                              <tr
                                key={contact.id}
                                className={`lv-proj-row${selectedIds.has(contact.id) ? ' selected' : ''}`}
                                onClick={() => handleOpen(contact.id)}
                                draggable={groupMode === 'custom'}
                                onDragStart={(e) => {
                                  if (groupMode !== 'custom') return;
                                  setDraggingContactId(contact.id);
                                  e.dataTransfer.effectAllowed = 'move';
                                  e.dataTransfer.setData('text/plain', contact.id);
                                }}
                                onDragEnd={() => {
                                  setDraggingContactId(null);
                                  setDragOverGroupKey(null);
                                }}
                              >
                                <td className="lv-col-check" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    className={`lv-checkbox${selectedIds.has(contact.id) ? ' checked' : ''}`}
                                    onClick={() => handleToggleSelect(contact.id)}
                                    role="checkbox"
                                    aria-checked={selectedIds.has(contact.id)}
                                  >
                                    {selectedIds.has(contact.id) && (
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                        <path d="M5 12l4 4 10-10" />
                                      </svg>
                                    )}
                                  </button>
                                </td>
                                {orderedContactColumns.map((col) => (
                                  <td
                                    key={col.id}
                                    className={[
                                      ['manager', 'lead', 'group', 'actions'].includes(col.id)
                                        ? 'lv-td-popover'
                                        : '',
                                      contactColClass(col.id),
                                    ]
                                      .filter(Boolean)
                                      .join(' ')}
                                    onClick={(e) => {
                                      if (
                                        ['manager', 'lead', 'group', 'actions', 'company'].includes(
                                          col.id,
                                        )
                                      ) {
                                        e.stopPropagation();
                                      }
                                    }}
                                  >
                                    {renderContactCellContent(contact, col.id, fullName)}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="lv-proj-foot">
              <div className="lv-proj-foot-stats">
                <span>
                  <span className="lbl">{t('crm.leads.list.footerTotal')}:</span>
                  <strong>{contacts.length}</strong>
                </span>
              </div>
            </div>
          </div>
          </>
        )}
        {groupMode === 'custom' && draggingContactId && (
          <div className="fixed bottom-4 right-4 z-50 rounded-xl border border-border-default bg-white px-3 py-2 text-[11px] text-text-secondary shadow-card">
            {dragOverGroupKey
              ? t('crm.contacts.list.groups.dragToGroup', {
                  group:
                    groupedContacts.find((g) => g.key === dragOverGroupKey)?.label ||
                    t('crm.contacts.list.groups.ungrouped'),
                })
              : t('crm.contacts.list.groups.dragHint')}
          </div>
        )}

        {/* Модальное окно массовых операций */}
        {bulkModalOpen && (
          <div className="fixed inset-0 z-[8500] flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-2xl modal-panel p-5">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <div className="text-xs font-semibold text-[#111827]">
                    {t('crm.contacts.bulk.title')}
                  </div>
                  <div className="mt-1 text-[11px] text-text-tertiary">
                    {t('crm.contacts.bulk.subtitle', { count: selectedIds.size })}
                  </div>
                </div>
                <button
                  onClick={() => setBulkModalOpen(false)}
                  className="text-text-tertiary hover:text-[#111827] text-xl leading-none"
                  type="button"
                >
                  ×
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] text-text-tertiary mb-1.5">
                    {t('crm.contacts.bulk.assignedTo')}
                  </label>
                  <select
                    value={bulkAssignedUserId}
                    onChange={(e) => setBulkAssignedUserId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-slate-500"
                  >
                    <option value="">{t('crm.contacts.bulk.noChange')}</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName || s.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-text-tertiary mb-1.5">{t('crm.contacts.bulk.status')}</label>
                  <select
                    value={bulkStatus}
                    onChange={(e) => setBulkStatus(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-slate-500"
                  >
                    <option value="">{t('crm.contacts.bulk.noChange')}</option>
                    <option value="active">{t('crm.contacts.form.statuses.active')}</option>
                    <option value="inactive">{t('crm.contacts.form.statuses.inactive')}</option>
                    <option value="archived">{t('crm.contacts.form.statuses.archived')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-text-tertiary mb-1.5">
                    {t('crm.contacts.bulk.tags')}
                  </label>
                  <input
                    type="text"
                    value={bulkTags}
                    onChange={(e) => setBulkTags(e.target.value)}
                    placeholder={t('crm.contacts.bulk.tagsPlaceholder')}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBulkModalOpen(false)}
                  className="btn-secondary btn-secondary-sm"
                >
                  {t('crm.contacts.bulk.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleBulkUpdate}
                  disabled={bulkSaving}
                  className="btn-primary btn-secondary-sm disabled:opacity-50"
                >
                  {bulkSaving ? t('crm.contacts.bulk.saving') : t('crm.contacts.bulk.apply')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};
