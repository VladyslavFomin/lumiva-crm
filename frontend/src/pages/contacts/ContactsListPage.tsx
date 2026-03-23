// src/pages/contacts/ContactsListPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
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

type ContactsCustomGroup = {
  id: string;
  name: string;
  order: number;
};

const CONTACTS_GROUPS_KEY = 'contacts_custom_groups_v1';
const CONTACTS_GROUP_ASSIGNMENTS_KEY = 'contacts_custom_group_assignments_v1';

export const ContactsListPage: React.FC = () => {
  const { t } = useTranslation();
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
    if (!confirm(t('crm.contacts.list.deleteConfirm'))) return;
    try {
      await deleteContact(id);
      setContacts(contacts.filter((c) => c.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err: any) {
      alert(err.message || t('crm.contacts.list.errors.deleteFailed'));
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
      alert(e.message || t('crm.contacts.bulk.errors.updateFailed'));
    } finally {
      setBulkSaving(false);
    }
  };

  const managerLabelById = useMemo(() => {
    const map = new Map<string, string>();
    staff.forEach((member) => map.set(member.id, member.fullName || member.email));
    return map;
  }, [staff]);

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

  const deleteCustomGroup = (groupId: string) => {
    if (!window.confirm(t('crm.contacts.list.groups.confirmDelete'))) return;
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
      <div className="space-y-4">
        {/* Заголовок */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-50">{t('crm.contacts.list.title')}</h1>
            <div className="text-[11px] text-slate-500">
              {t('crm.contacts.list.subtitle')}
              {selectedIds.size > 0 && (
                <span className="ml-2 text-lumiva-accent">
                  ({selectedIds.size} {t('crm.contacts.list.selected')})
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {selectedIds.size > 0 && (
              <button
                onClick={() => setBulkModalOpen(true)}
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-700 text-slate-300 hover:text-slate-50 hover:border-slate-600 transition-colors"
              >
                {t('crm.contacts.list.bulkOperations')} ({selectedIds.size})
              </button>
            )}
            <button
              onClick={handleCreate}
              className="px-3 py-1.5 text-xs rounded-xl bg-lumiva-accent text-slate-950 font-semibold hover:bg-lumiva-accent-soft transition-colors"
            >
              + {t('crm.contacts.list.create')}
            </button>
          </div>
        </div>

        {/* Поиск + группировка */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4">
          <div className="grid gap-2 md:grid-cols-[1fr_220px]">
            <input
              type="text"
              placeholder={t('crm.contacts.list.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
            />
            <select
              value={groupMode}
              onChange={(e) => setGroupMode(e.target.value as 'none' | 'company' | 'status' | 'manager' | 'custom')}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-slate-500"
            >
              <option value="company">{t('crm.contacts.list.groupMode.company')}</option>
              <option value="status">{t('crm.contacts.list.groupMode.status')}</option>
              <option value="manager">{t('crm.contacts.list.groupMode.manager')}</option>
              <option value="custom">{t('crm.contacts.list.groupMode.custom')}</option>
              <option value="none">{t('crm.contacts.list.groupMode.none')}</option>
            </select>
          </div>
          {groupMode === 'custom' && (
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={createCustomGroup}
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-700 text-slate-200 hover:bg-slate-900/80"
              >
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
                  className={`inline-flex items-center gap-1 rounded-xl border px-2 py-1 ${
                    dragOverGroupId === group.id
                      ? 'border-lumiva-accent bg-slate-900/80'
                      : 'border-slate-700'
                  }`}
                >
                  <span className="text-[11px] text-slate-300">{group.name}</span>
                  <button
                    type="button"
                    onClick={() => moveCustomGroup(group.id, 'up')}
                    className="text-[10px] text-slate-400 hover:text-slate-200"
                    aria-label="move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveCustomGroup(group.id, 'down')}
                    className="text-[10px] text-slate-400 hover:text-slate-200"
                    aria-label="move down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => renameCustomGroup(group.id)}
                    className="text-[10px] text-slate-400 hover:text-slate-200"
                  >
                    {t('crm.contacts.list.groups.renameShort')}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteCustomGroup(group.id)}
                    className="text-[10px] text-rose-400 hover:text-rose-300"
                  >
                    {t('crm.contacts.list.groups.deleteShort')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ошибка */}
        {error && (
          <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        {/* Загрузка */}
        {loading ? (
          <div className="text-center py-12 text-xs text-slate-400">{t('crm.contacts.list.loading')}</div>
        ) : contacts.length === 0 ? (
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-8 text-center">
            <div className="text-xs text-slate-400">
              {search ? t('crm.contacts.list.notFound') : t('crm.contacts.list.empty')}
            </div>
            {!search && (
              <button
                onClick={handleCreate}
                className="mt-4 px-4 py-2 text-xs rounded-xl bg-lumiva-accent text-slate-950 font-semibold hover:bg-lumiva-accent-soft transition-colors"
              >
                {t('crm.contacts.list.createFirst')}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Чекбокс "Выбрать все" */}
            {contacts.length > 0 && (
              <div className="flex items-center gap-2 px-2">
                <input
                  type="checkbox"
                  checked={selectedIds.size === contacts.length && contacts.length > 0}
                  onChange={handleSelectAll}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-lumiva-accent focus:ring-lumiva-accent"
                />
                <span className="text-xs text-slate-400">
                  {t('crm.common.selectAll')} ({contacts.length})
                </span>
              </div>
            )}

            <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-3 overflow-x-auto">
              <table className="min-w-[900px] w-full text-xs border-separate border-spacing-y-1">
                <thead className="text-slate-500">
                  <tr>
                    <th className="px-2 py-1 w-10" />
                    <th className="px-2 py-1 text-left">{t('crm.contacts.list.table.contact')}</th>
                    <th className="px-2 py-1 text-left">E-mail</th>
                    <th className="px-2 py-1 text-left">{t('crm.contacts.form.fields.phone')}</th>
                    <th className="px-2 py-1 text-left">{t('crm.contacts.form.fields.company')}</th>
                    <th className="px-2 py-1 text-left">{t('crm.contacts.list.table.manager')}</th>
                    <th className="px-2 py-1 text-left">{t('crm.contacts.form.fields.status')}</th>
                    <th className="px-2 py-1 text-left">{t('crm.contacts.list.table.lead')}</th>
                    <th className="px-2 py-1 text-left">{t('crm.contacts.list.table.group')}</th>
                    <th className="px-2 py-1 text-left">{t('crm.contacts.bulk.tags')}</th>
                    <th className="px-2 py-1 text-right">{t('crm.projects.tasks.table.headers.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedContacts.map((group) => {
                    const collapsed = collapsedGroups.includes(group.key);
                    return (
                      <React.Fragment key={group.key}>
                        <tr
                          className={`bg-slate-900/80 ${groupMode === 'custom' && dragOverGroupKey === group.key ? 'ring-1 ring-lumiva-accent/70' : ''}`}
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
                          <td colSpan={11} className="px-3 py-2 text-slate-200">
                            <button
                              type="button"
                              onClick={() => toggleGroup(group.key)}
                              className="flex items-center gap-2 text-[12px]"
                            >
                              <span className="text-[10px]">{collapsed ? '▶' : '▼'}</span>
                              <span>{group.label}</span>
                              <span className="text-slate-400">{group.items.length}</span>
                            </button>
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
                                className={`cursor-pointer ${
                                  selectedIds.has(contact.id)
                                    ? 'bg-slate-800/90'
                                    : 'bg-slate-950/80 hover:bg-slate-900/80'
                                }`}
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
                                <td className="px-2 py-1.5">
                                  <input
                                    type="checkbox"
                                    checked={selectedIds.has(contact.id)}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      handleToggleSelect(contact.id);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </td>
                                <td className="px-2 py-1.5 text-slate-100">{fullName}</td>
                                <td className="px-2 py-1.5 text-slate-400">{contact.email || '-'}</td>
                                <td className="px-2 py-1.5 text-slate-400">{contact.phone || '-'}</td>
                                <td className="px-2 py-1.5 text-slate-400">
                                  {contact.companyId ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/app/companies/${contact.companyId}`);
                                      }}
                                      className="text-sky-300 hover:text-sky-200 hover:underline"
                                    >
                                      {companiesMap[contact.companyId]?.name ||
                                        contact.company ||
                                        t('crm.contacts.list.groups.noCompany')}
                                    </button>
                                  ) : (
                                    contact.company || '-'
                                  )}
                                </td>
                                <td className="px-2 py-1.5 text-slate-400">
                                  {contact.assignedTo ||
                                    (contact.assignedUserId
                                      ? managerLabelById.get(contact.assignedUserId) || '-'
                                      : '-')}
                                </td>
                                <td className="px-2 py-1.5 text-slate-300">{contact.status || '-'}</td>
                                <td className="px-2 py-1.5 text-slate-400">
                                  {leadByContactId[contact.id] ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/app/leads/${leadByContactId[contact.id].id}`);
                                      }}
                                      className="text-sky-300 hover:text-sky-200 hover:underline"
                                    >
                                      {leadByContactId[contact.id].name ||
                                        t('crm.contacts.list.table.openLead')}
                                    </button>
                                  ) : (
                                    '-'
                                  )}
                                </td>
                                <td className="px-2 py-1.5 text-slate-400">
                                  {groupMode === 'custom' ? (
                                    <select
                                      value={contactGroupMap[contact.id] || ''}
                                      onClick={(e) => e.stopPropagation()}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        assignContactGroup(contact.id, e.target.value);
                                      }}
                                      className="w-full px-2 py-1 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-200 outline-none"
                                    >
                                      <option value="">{t('crm.contacts.list.groups.ungrouped')}</option>
                                      {customGroupsOrdered.map((group) => (
                                        <option key={group.id} value={group.id}>
                                          {group.name}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    '-'
                                  )}
                                </td>
                                <td className="px-2 py-1.5 text-slate-500">
                                  {contact.tags?.length ? contact.tags.join(', ') : '-'}
                                </td>
                                <td className="px-2 py-1.5 text-right">
                                  <button
                                    onClick={(e) => handleDelete(contact.id, e)}
                                    className="text-red-400 hover:text-red-300 text-[10px] px-2 py-1 hover:bg-red-950/30 rounded-lg transition-colors"
                                  >
                                    {t('crm.contacts.list.delete')}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {groupMode === 'custom' && draggingContactId && (
          <div className="fixed bottom-4 right-4 z-50 rounded-xl border border-slate-700 bg-slate-950/95 px-3 py-2 text-[11px] text-slate-200 shadow-xl">
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
          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-950 p-5">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <div className="text-xs font-semibold text-slate-50">
                    {t('crm.contacts.bulk.title')}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    {t('crm.contacts.bulk.subtitle', { count: selectedIds.size })}
                  </div>
                </div>
                <button
                  onClick={() => setBulkModalOpen(false)}
                  className="text-slate-400 hover:text-white text-xl leading-none"
                  type="button"
                >
                  ×
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1.5">
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
                  <label className="block text-[10px] text-slate-500 mb-1.5">{t('crm.contacts.bulk.status')}</label>
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
                  <label className="block text-[10px] text-slate-500 mb-1.5">
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
                  className="px-4 py-2 text-xs text-slate-400 hover:text-slate-50 transition-colors"
                >
                  {t('crm.contacts.bulk.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleBulkUpdate}
                  disabled={bulkSaving}
                  className="px-4 py-2 text-xs rounded-xl bg-lumiva-accent text-slate-950 font-semibold hover:bg-lumiva-accent-soft disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
