import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import './WorkspaceArea.css';
import { WsAreaBar } from '../../components/workspace/WsAreaBar';
import {
  createCustomObject,
  createCustomObjectField,
  createCustomObjectRecord,
  fetchCustomObjects,
  fetchCustomObjectFields,
  fetchAllCustomObjectRecords,
  type CustomObject,
  type CustomObjectFieldType,
} from '../../api/customObjects';
import {
  fetchWorkspaceArea,
  fetchWorkspaceAreaMembers,
  fetchWorkspaceAreas,
  readWorkspaceIntegrationBindings,
  type WorkspaceArea,
} from '../../api/workspaceAreas';
import { fetchCustomFields, type EntityType, type FieldType } from '../../api/custom-fields';
import { fetchLeads } from '../../api/leads';
import { fetchCompanies } from '../../api/companies';
import { fetchContacts } from '../../api/contacts';
import { fetchSales } from '../../api/sales';
import { fetchProjects } from '../../api/projects';
import {
  fetchReservations as fetchBookingReservationsAll,
  fetchBookingLocations,
  fetchBookingServices,
} from '../../api/bookings';
import { fetchStaff } from '../../api/staff';
import {
  fetchReservations as fetchHotelReservationsAll,
  fetchHotels,
  fetchRoomTypes as fetchHotelRoomTypes,
  fetchAgencies as fetchHotelAgencies,
} from '../../api/hotels';
import { fetchProducts, fetchProductCategories } from '../../api/products';
import type { WorkspaceAreaMember } from '../../workspace/workspaceAreaRole';
import {
  WORKSPACE_TABLE_KIND_KEY,
  type WorkspaceTableKind,
} from '../../workspace/workspaceTableKind';
import type { ExtraWorkspaceViewKey } from '../../workspace/workspaceEnabledViews';
import { WorkspaceSourceIcon } from '../../components/workspace/WorkspaceSourceIcon';

type Template = 'blank' | 'source' | 'file' | 'copy';

type NativeSourceKind = 'lead' | 'sale' | 'project' | 'booking' | 'hotel' | 'product';

type SourcePick =
  | { kind: 'entity'; entity: NativeSourceKind }
  | { kind: 'integration'; bindingId: string; targetObjectId: string; label: string };

type SourceFieldSeed = { key: string; label: string; type: CustomObjectFieldType };

/** Реальные ключи/лейблы полей нативных модулей — те же, что уже используются в списках/импортах этих модулей. */
const ENTITY_SOURCE_FIELDS: Record<NativeSourceKind, SourceFieldSeed[]> = {
  lead: [
    { key: 'name', label: 'Имя', type: 'text' },
    { key: 'status', label: 'Статус', type: 'status' },
    { key: 'company', label: 'Компания', type: 'text' },
    { key: 'contact', label: 'Контакт', type: 'text' },
    { key: 'channel', label: 'Канал', type: 'text' },
    { key: 'utmSource', label: 'UTM Source', type: 'text' },
    { key: 'utmMedium', label: 'UTM Medium', type: 'text' },
    { key: 'utmCampaign', label: 'UTM Campaign', type: 'text' },
    { key: 'created', label: 'Создан', type: 'date' },
  ],
  sale: [
    { key: 'date', label: 'Дата', type: 'date' },
    { key: 'channel', label: 'Канал', type: 'text' },
    { key: 'product', label: 'Товар', type: 'text' },
    { key: 'customer', label: 'Клиент', type: 'text' },
    { key: 'amount', label: 'Сумма', type: 'number' },
    { key: 'status', label: 'Статус', type: 'status' },
  ],
  project: [
    { key: 'name', label: 'Название', type: 'text' },
    { key: 'owner', label: 'Ответственный', type: 'text' },
    { key: 'status', label: 'Статус', type: 'status' },
    { key: 'progress', label: 'Прогресс', type: 'number' },
    { key: 'amount', label: 'Сумма', type: 'number' },
    { key: 'company', label: 'Компания', type: 'text' },
    { key: 'created', label: 'Создан', type: 'date' },
  ],
  booking: [
    { key: 'customerName', label: 'Клиент', type: 'text' },
    { key: 'customerPhone', label: 'Телефон', type: 'text' },
    { key: 'customerEmail', label: 'Email', type: 'text' },
    { key: 'locationName', label: 'Локация', type: 'text' },
    { key: 'serviceName', label: 'Услуга', type: 'text' },
    { key: 'staffName', label: 'Мастер', type: 'text' },
    { key: 'date', label: 'Дата', type: 'date' },
    { key: 'time', label: 'Время', type: 'text' },
    { key: 'durationMinutes', label: 'Длительность (мин)', type: 'number' },
    { key: 'participants', label: 'Участников', type: 'number' },
    { key: 'price', label: 'Цена', type: 'number' },
    { key: 'currency', label: 'Валюта', type: 'text' },
    { key: 'status', label: 'Статус', type: 'status' },
    { key: 'notes', label: 'Комментарий', type: 'text' },
  ],
  hotel: [
    { key: 'guestName', label: 'Гость', type: 'text' },
    { key: 'hotelName', label: 'Отель', type: 'text' },
    { key: 'roomTypeName', label: 'Тип номера', type: 'text' },
    { key: 'agencyName', label: 'Агентство', type: 'text' },
    { key: 'market', label: 'Рынок', type: 'text' },
    { key: 'checkIn', label: 'Заезд', type: 'date' },
    { key: 'checkOut', label: 'Выезд', type: 'date' },
    { key: 'pax', label: 'Гостей (PAX)', type: 'number' },
    { key: 'costPerNight', label: 'Себестоимость/ночь', type: 'number' },
    { key: 'ppPerNight', label: 'PP/ночь', type: 'number' },
    { key: 'grossPerNight', label: 'Brutto/ночь', type: 'number' },
    { key: 'discountPct', label: 'Скидка, %', type: 'number' },
    { key: 'status', label: 'Статус', type: 'status' },
  ],
  product: [
    { key: 'sku', label: 'Артикул', type: 'text' },
    { key: 'name', label: 'Название', type: 'text' },
    { key: 'description', label: 'Описание', type: 'text' },
    { key: 'category', label: 'Категория', type: 'text' },
    { key: 'status', label: 'Статус', type: 'status' },
    { key: 'price', label: 'Цена', type: 'number' },
    { key: 'costPrice', label: 'Себестоимость', type: 'number' },
    { key: 'currency', label: 'Валюта', type: 'text' },
    { key: 'quantity', label: 'Количество', type: 'number' },
    { key: 'unit', label: 'Единица измерения', type: 'text' },
    { key: 'barcode', label: 'Штрихкод', type: 'text' },
  ],
};

const NATIVE_SOURCE_KINDS: NativeSourceKind[] = ['lead', 'sale', 'project', 'booking', 'hotel', 'product'];

function mapCustomFieldType(t: FieldType): CustomObjectFieldType {
  switch (t) {
    case 'select':
      return 'select';
    case 'multiselect':
      return 'multiselect';
    case 'boolean':
      return 'boolean';
    case 'number':
      return 'number';
    case 'date':
      return 'date';
    case 'datetime':
      return 'datetime';
    default:
      return 'text';
  }
}

async function runInChunks<T>(items: T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

/** Реальные строки нативных CRM-модулей для «Из источника» — те же данные, что видны в их списках. */
async function fetchSourceRecords(entity: NativeSourceKind): Promise<Array<Record<string, any>>> {
  if (entity === 'lead') {
    const [leads, companiesRes, contactsRes] = await Promise.all([
      fetchLeads(),
      fetchCompanies({ limit: 2000 }).catch(() => ({ items: [], total: 0 })),
      fetchContacts({ limit: 2000 }).catch(() => ({ items: [], total: 0 })),
    ]);
    const companiesById = new Map(companiesRes.items.map((c) => [c.id, c.name]));
    const contactsById = new Map(
      contactsRes.items.map((c) => [c.id, c.fullName || [c.firstName, c.lastName].filter(Boolean).join(' ')]),
    );
    return leads.map((l) => ({
      name: l.name,
      status: l.status,
      company: l.companyId ? companiesById.get(l.companyId) || '' : '',
      contact: l.contactId ? contactsById.get(l.contactId) || '' : '',
      channel: l.channel,
      utmSource: l.utmSource || '',
      utmMedium: l.utmMedium || '',
      utmCampaign: l.utmCampaign || '',
      created: l.createdAt,
    }));
  }
  if (entity === 'sale') {
    const all: Array<Record<string, any>> = [];
    let page = 1;
    const pageSize = 200;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const res = await fetchSales({ page, pageSize });
      all.push(...res.items);
      if (res.items.length < pageSize || all.length >= res.total || page > 200) break;
      page += 1;
    }
    return all.map((s) => ({
      date: s.saleDate || '',
      channel: s.channel?.name || '',
      product: s.hotel || '',
      customer: s.guestName || '',
      amount: s.amount,
      status: s.status,
    }));
  }
  if (entity === 'project') {
    const { items } = await fetchProjects();
    return items.map((p) => {
      const total = p.tasks?.length ?? 0;
      const done = p.tasks?.filter((t) => /готов|заверш|done|finished/i.test(String(t.status))).length ?? 0;
      return {
        name: p.name,
        owner: p.owner || '',
        status: p.status,
        progress: total ? Math.round((done / total) * 100) : 0,
        amount: p.amount,
        company: p.companyName || '',
        created: p.createdAt,
      };
    });
  }
  if (entity === 'booking') {
    const [reservations, locations, services, staff] = await Promise.all([
      fetchBookingReservationsAll(),
      fetchBookingLocations().catch(() => []),
      fetchBookingServices().catch(() => []),
      fetchStaff().catch(() => []),
    ]);
    const locById = new Map(locations.map((l) => [l.id, l.name]));
    const svcById = new Map(services.map((s) => [s.id, s.name]));
    const staffById = new Map(staff.map((s) => [s.id, s.fullName || s.email]));
    return reservations.map((r) => {
      const start = r.startAt ? new Date(r.startAt) : null;
      const end = r.endAt ? new Date(r.endAt) : null;
      const durationMinutes = start && end ? Math.round((end.getTime() - start.getTime()) / 60000) : null;
      return {
        customerName: r.customerName || '',
        customerPhone: r.customerPhone || '',
        customerEmail: r.customerEmail || '',
        locationName: r.locationId ? locById.get(r.locationId) || '' : '',
        serviceName: r.serviceId ? svcById.get(r.serviceId) || '' : '',
        staffName: r.staffUserId ? staffById.get(r.staffUserId) || '' : '',
        date: start ? start.toISOString().slice(0, 10) : '',
        time: start ? start.toISOString().slice(11, 16) : '',
        durationMinutes,
        participants: r.participants,
        price: r.price ? Number(r.price) : null,
        currency: r.currency || '',
        status: r.status,
        notes: '',
      };
    });
  }
  if (entity === 'hotel') {
    const [reservations, hotels, agencies] = await Promise.all([
      fetchHotelReservationsAll(),
      fetchHotels(),
      fetchHotelAgencies().catch(() => []),
    ]);
    const hotelsById = new Map(hotels.map((h) => [h.id, h.name]));
    const roomTypeLists = await Promise.all(hotels.map((h) => fetchHotelRoomTypes(h.id).catch(() => [])));
    const roomTypesById = new Map(roomTypeLists.flat().map((rt) => [rt.id, rt.name]));
    const agenciesById = new Map(agencies.map((a) => [a.id, a.name]));
    return reservations.map((r) => ({
      guestName: r.guestName || '',
      hotelName: hotelsById.get(r.hotelId) || '',
      roomTypeName: roomTypesById.get(r.roomTypeId) || '',
      agencyName: r.agencyId ? agenciesById.get(r.agencyId) || '' : '',
      market: r.market || '',
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      pax: r.pax,
      costPerNight: r.costPerNight ? Number(r.costPerNight) : null,
      ppPerNight: r.ppPerNight ? Number(r.ppPerNight) : null,
      grossPerNight: r.grossPerNight ? Number(r.grossPerNight) : null,
      discountPct: r.discountPct ? Number(r.discountPct) : null,
      status: r.status,
    }));
  }
  // product
  const categories = await fetchProductCategories().catch(() => []);
  const catById = new Map(categories.map((c) => [c.id, c.name]));
  const allProducts: Array<Record<string, any>> = [];
  let page = 1;
  const limit = 200;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await fetchProducts({ page, limit });
    allProducts.push(...res.items);
    if (res.items.length < limit || allProducts.length >= res.total || page > 200) break;
    page += 1;
  }
  return allProducts.map((p) => ({
    sku: p.sku || '',
    name: p.name,
    description: p.description || '',
    category: p.categoryId ? catById.get(p.categoryId) || '' : '',
    status: p.status,
    price: p.price ? Number(p.price) : null,
    costPrice: p.costPrice ? Number(p.costPrice) : null,
    currency: p.currency || '',
    quantity: p.quantity,
    unit: p.unit || '',
    barcode: p.barcode || '',
  }));
}

const VIEWS: { key: ExtraWorkspaceViewKey; labelKey: string; hintKey: string }[] = [
  { key: 'kanban', labelKey: 'crm.workspace.newTable.views.kanban', hintKey: 'crm.workspace.newTable.views.kanbanHint' },
  { key: 'calendar', labelKey: 'crm.workspace.newTable.views.calendar', hintKey: 'crm.workspace.newTable.views.calendarHint' },
  { key: 'gantt', labelKey: 'crm.workspace.newTable.views.gantt', hintKey: 'crm.workspace.newTable.views.ganttHint' },
  { key: 'analytics', labelKey: 'crm.workspace.newTable.views.analytics', hintKey: 'crm.workspace.newTable.views.analyticsHint' },
];

export const WorkspaceNewTablePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const finish = (searchParams.get('finish') || 'settings').toLowerCase();
  const workspaceAreaIdRaw = searchParams.get('workspaceAreaId');
  const workspaceAreaId =
    workspaceAreaIdRaw && /^[0-9a-f-]{36}$/i.test(workspaceAreaIdRaw)
      ? workspaceAreaIdRaw
      : undefined;
  const kindParam = searchParams.get('kind')?.toLowerCase();
  const initialKind: WorkspaceTableKind = useMemo(() => {
    if (kindParam === 'board') return 'board';
    return 'data';
  }, [kindParam]);

  const [tableKind, setTableKind] = useState<WorkspaceTableKind>(initialKind);
  const [template, setTemplate] = useState<Template>('blank');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [views, setViews] = useState<ExtraWorkspaceViewKey[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [area, setArea] = useState<WorkspaceArea | null>(null);
  const [members, setMembers] = useState<WorkspaceAreaMember[]>([]);

  // «Копия таблицы»
  const [copySourceId, setCopySourceId] = useState<string | null>(null);
  const [copyCandidates, setCopyCandidates] = useState<CustomObject[]>([]);
  const [copyAreasById, setCopyAreasById] = useState<Record<string, WorkspaceArea>>({});
  const [copyLoading, setCopyLoading] = useState(false);
  const [copySearch, setCopySearch] = useState('');

  // «Из источника»
  const [sourcePick, setSourcePick] = useState<SourcePick | null>(null);

  useEffect(() => {
    if (!workspaceAreaId) return;
    let alive = true;
    void fetchWorkspaceArea(workspaceAreaId).then((a) => alive && setArea(a)).catch(() => {});
    void fetchWorkspaceAreaMembers(workspaceAreaId).then((m) => alive && setMembers(m)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [workspaceAreaId]);

  useEffect(() => {
    if (template !== 'copy' || copyCandidates.length > 0 || copyLoading) return;
    let alive = true;
    setCopyLoading(true);
    void Promise.all([fetchCustomObjects(), fetchWorkspaceAreas()])
      .then(([objs, areas]) => {
        if (!alive) return;
        setCopyCandidates(objs);
        setCopyAreasById(Object.fromEntries(areas.map((a) => [a.id, a])));
      })
      .catch(() => {})
      .finally(() => alive && setCopyLoading(false));
    return () => {
      alive = false;
    };
  }, [template, copyCandidates.length, copyLoading]);

  const areaIntegrationBindings = useMemo(
    () => readWorkspaceIntegrationBindings(area?.meta).filter((b) => !!b.targetObjectId),
    [area?.meta],
  );

  const filteredCopyCandidates = useMemo(() => {
    const q = copySearch.trim().toLowerCase();
    const list = q ? copyCandidates.filter((o) => o.name.toLowerCase().includes(q)) : copyCandidates;
    return list.slice(0, 60);
  }, [copyCandidates, copySearch]);

  const toggleView = (v: ExtraWorkspaceViewKey) => {
    setViews((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      // «Копия таблицы» / «Из источника» с реальной таблицей (existing custom object) —
      // тянем её актуальные поля вместо статического списка.
      let copiedFields: Array<{ key: string; label: string; type: CustomObjectFieldType; required?: boolean; options?: Array<{ value: string; label: string }> }> | null = null;
      const objectIdToCopyFieldsFrom =
        template === 'copy'
          ? copySourceId
          : template === 'source' && sourcePick?.kind === 'integration'
            ? sourcePick.targetObjectId
            : null;
      if (objectIdToCopyFieldsFrom) {
        const fields = await fetchCustomObjectFields(objectIdToCopyFieldsFrom);
        copiedFields = fields
          .filter((f) => f.isActive)
          .sort((a, b) => a.order - b.order)
          .map((f) => ({ key: f.key, label: f.label, type: f.type, required: f.required, options: f.options || undefined }));
      }
      // «Из источника» с нативным CRM-модулем (Лиды/Продажи/Проекты/Бронирования/Отели/Товары) —
      // реальные ключи полей этих модулей + актуальные пользовательские поля тенанта.
      let sourceFields: SourceFieldSeed[] | null = null;
      if (template === 'source' && sourcePick?.kind === 'entity') {
        const base = ENTITY_SOURCE_FIELDS[sourcePick.entity];
        let custom: SourceFieldSeed[] = [];
        if (sourcePick.entity === 'lead' || sourcePick.entity === 'sale' || sourcePick.entity === 'project') {
          const cf = await fetchCustomFields(sourcePick.entity as EntityType);
          custom = cf
            .filter((f) => f.isActive)
            .sort((a, b) => a.order - b.order)
            .map((f) => ({ key: f.key, label: f.label, type: mapCustomFieldType(f.type) }));
        }
        sourceFields = [...base, ...custom];
      }

      const created = await createCustomObject({
        name: name.trim(),
        description: description.trim() || undefined,
        workspaceAreaId: workspaceAreaId ?? null,
        meta: {
          enabledViews: ['table', ...(tableKind === 'board' ? views : [])],
          [WORKSPACE_TABLE_KIND_KEY]: tableKind,
        },
      });
      if (copiedFields && copiedFields.length > 0) {
        for (const f of copiedFields) {
          // eslint-disable-next-line no-await-in-loop
          await createCustomObjectField(created.id, f);
        }
      } else if (sourceFields && sourceFields.length > 0) {
        for (const f of sourceFields) {
          // eslint-disable-next-line no-await-in-loop
          await createCustomObjectField(created.id, f);
        }
      } else {
        await Promise.all([
          createCustomObjectField(created.id, {
            key: 'name',
            label: 'Name',
            type: 'text',
            required: true,
          }),
          createCustomObjectField(created.id, {
            key: 'status',
            label: 'Status',
            type: 'status',
          }),
        ]);
      }
      // «Из источника» — переносим и реальные строки, не только колонки.
      if (template === 'source' && sourcePick?.kind === 'entity') {
        const rows = await fetchSourceRecords(sourcePick.entity);
        await runInChunks(rows, 6, async (values) => {
          await createCustomObjectRecord(created.id, { values });
        });
      } else if (template === 'source' && sourcePick?.kind === 'integration') {
        const records = await fetchAllCustomObjectRecords(sourcePick.targetObjectId);
        await runInChunks(records, 6, async (rec) => {
          await createCustomObjectRecord(created.id, { values: rec.values });
        });
      }
      if (template === 'file') {
        navigate(`/workspace/${created.id}/import`);
        return;
      }
      const tail =
        finish === 'kanban'
          ? 'kanban'
          : finish === 'analytics'
            ? 'analytics'
            : finish === 'table'
              ? 'table'
              : 'settings';
      navigate(`/workspace/${created.id}/${tail}`);
    } catch (e: any) {
      setError(e?.message || t('crm.workspace.newTable.error'));
    } finally {
      setSaving(false);
    }
  };

  const viewChain = tableKind === 'board' ? ['table', ...views] : ['table'];
  const viewLabel = (v: string) =>
    v === 'table'
      ? t('crm.workspace.views.table')
      : v === 'kanban'
        ? t('crm.workspace.views.kanban')
        : v === 'calendar'
          ? t('crm.workspace.views.calendar')
          : v === 'gantt'
            ? t('crm.workspace.views.gantt')
            : t('crm.workspace.views.analytics');

  return (
    <MainLayout>
      <div className="ws-page max-w-5xl mx-auto">
        {area && <WsAreaBar areaId={area.id} areaName={area.name} areaIconKey={area.iconKey} current={t('crm.workspace.newTable.title')} />}
        <div className="page-head">
          <div>
            <h1>{t('crm.workspace.newTable.title')}</h1>
            <div className="sub">{t('crm.workspace.newTable.subtitle')}</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="ws-cols" style={{ gridTemplateColumns: '1fr 300px' }}>
          <div>
            <div className="ws-sec">
              <div className="ws-sec-head">
                <div>
                  <h2>{t('crm.workspace.newTable.kindLegend')}</h2>
                  <div className="s">{t('crm.workspace.newTable.kindIrreversibleHint')}</div>
                </div>
              </div>
              <div className="ws-sec-body">
                <div className="ws-pickrow">
                  <button type="button" className={`ws-pick${tableKind === 'board' ? ' on' : ''}`} onClick={() => setTableKind('board')}>
                    <span className="r" />
                    <span>
                      <span className="n">{t('crm.workspace.newTable.kindBoard')}</span>
                      <span className="h">{t('crm.workspace.newTable.kindBoardHint')}</span>
                    </span>
                  </button>
                  <button type="button" className={`ws-pick${tableKind === 'data' ? ' on' : ''}`} onClick={() => setTableKind('data')}>
                    <span className="r" />
                    <span>
                      <span className="n">{t('crm.workspace.newTable.kindData')}</span>
                      <span className="h">{t('crm.workspace.newTable.kindDataHint')}</span>
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <div className="ws-sec">
              <div className="ws-sec-head">
                <div><h2>{t('crm.workspace.newTable.structureTitle')}</h2></div>
              </div>
              <div className="ws-sec-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="ws-field">
                  <label>{t('crm.workspace.newTable.name')}</label>
                  <input
                    className="ws-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('crm.workspace.newTable.placeholderName')}
                    autoFocus
                    required
                  />
                </div>
                <div className="ws-field">
                  <label>{t('crm.workspace.newTable.description')}</label>
                  <textarea
                    className="ws-input"
                    style={{ minHeight: 70, resize: 'vertical' }}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t('crm.workspace.newTable.placeholderDescription')}
                  />
                </div>
                <div className="ws-field">
                  <label>{t('crm.workspace.newTable.templateLabel')}</label>
                  <div className="ws-pickrow">
                    <button type="button" className={`ws-pick${template === 'blank' ? ' on' : ''}`} onClick={() => setTemplate('blank')}>
                      <span className="r" />
                      <span>
                        <span className="n">{t('crm.workspace.newTable.templateBlank')}</span>
                        <span className="h">{t('crm.workspace.newTable.templateBlankHint')}</span>
                      </span>
                    </button>
                    <button type="button" className={`ws-pick${template === 'file' ? ' on' : ''}`} onClick={() => setTemplate('file')}>
                      <span className="r" />
                      <span>
                        <span className="n">{t('crm.workspace.newTable.templateFile')}</span>
                        <span className="h">{t('crm.workspace.newTable.templateFileHint')}</span>
                      </span>
                    </button>
                    <button type="button" className={`ws-pick${template === 'source' ? ' on' : ''}`} onClick={() => setTemplate('source')}>
                      <span className="r" />
                      <span>
                        <span className="n">{t('crm.workspace.newTable.templateSource')}</span>
                        <span className="h">{t('crm.workspace.newTable.templateSourceHint')}</span>
                      </span>
                    </button>
                    <button type="button" className={`ws-pick${template === 'copy' ? ' on' : ''}`} onClick={() => setTemplate('copy')}>
                      <span className="r" />
                      <span>
                        <span className="n">{t('crm.workspace.newTable.templateCopy')}</span>
                        <span className="h">{t('crm.workspace.newTable.templateCopyHint')}</span>
                      </span>
                    </button>
                  </div>
                </div>

                {template === 'source' && (
                  <div className="ws-field">
                    <label>{t('crm.workspace.newTable.sourcePickLabel')}</label>
                    <div className="ws-chain" style={{ marginBottom: areaIntegrationBindings.length > 0 ? 6 : 0 }}>
                      {NATIVE_SOURCE_KINDS.map((kind) => (
                        <button
                          key={kind}
                          type="button"
                          className={`it${sourcePick?.kind === 'entity' && sourcePick.entity === kind ? ' on' : ''}`}
                          onClick={() => setSourcePick({ kind: 'entity', entity: kind })}
                        >
                          {t(`crm.workspace.newTable.sourceEntity.${kind}`)}
                        </button>
                      ))}
                    </div>
                    {areaIntegrationBindings.length > 0 && (
                      <>
                        <span className="ws-k" style={{ display: 'block', margin: '10px 0 6px' }}>
                          {t('crm.workspace.newTable.sourceIntegrationsLabel')}
                        </span>
                        <div className="ws-chain">
                          {areaIntegrationBindings.map((b) => (
                            <button
                              key={b.id}
                              type="button"
                              className={`it${sourcePick?.kind === 'integration' && sourcePick.bindingId === b.id ? ' on' : ''}`}
                              onClick={() => setSourcePick({ kind: 'integration', bindingId: b.id, targetObjectId: b.targetObjectId as string, label: b.label })}
                            >
                              <WorkspaceSourceIcon catalogKey={b.catalogKey} className="!h-[11px] !w-[11px]" />
                              {b.label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {template === 'copy' && (
                  <div className="ws-field">
                    <label>{t('crm.workspace.newTable.copyPickLabel')}</label>
                    <input
                      className="ws-input"
                      style={{ marginBottom: 6 }}
                      value={copySearch}
                      onChange={(e) => setCopySearch(e.target.value)}
                      placeholder={t('crm.workspace.newTable.copySearchPlaceholder')}
                    />
                    <div className="ws-picklist">
                      {copyLoading && <div className="ws-note" style={{ padding: '8px 2px' }}>…</div>}
                      {!copyLoading && filteredCopyCandidates.length === 0 && (
                        <div className="ws-note" style={{ padding: '8px 2px' }}>{t('crm.workspace.newTable.copyEmpty')}</div>
                      )}
                      {filteredCopyCandidates.map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          className={`ws-mrow pick${copySourceId === o.id ? ' on' : ''}`}
                          style={{ width: '100%' }}
                          onClick={() => setCopySourceId(o.id)}
                        >
                          <span style={{ minWidth: 0 }}>
                            <span className="nm" style={{ display: 'block' }}>{o.name}</span>
                            <span className="ml">{o.workspaceAreaId ? copyAreasById[o.workspaceAreaId]?.name || '—' : t('crm.workspace.newTable.copyNoArea')}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {tableKind === 'board' && (
              <div className="ws-sec">
                <div className="ws-sec-head">
                  <div>
                    <h2>{t('crm.workspace.newTable.viewsTitle')}</h2>
                    <div className="s">{t('crm.workspace.newTable.viewsHint')}</div>
                  </div>
                </div>
                <div className="ws-sec-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="ws-tog">
                    <button type="button" className="sw on" disabled />
                    <span>
                      <span style={{ fontWeight: 500 }}>{t('crm.workspace.views.table')}</span>
                      <span className="h">{t('crm.workspace.newTable.views.tableHint')}</span>
                    </span>
                    <span className="sp" />
                    <span className="ws-badge">{t('crm.workspace.newTable.required')}</span>
                  </div>
                  {VIEWS.map(({ key, labelKey, hintKey }) => (
                    <div className="ws-tog" key={key}>
                      <button type="button" className={`sw${views.includes(key) ? ' on' : ''}`} onClick={() => toggleView(key)} />
                      <span>
                        <span style={{ fontWeight: 500 }}>{t(labelKey)}</span>
                        <span className="h">{t(hintKey)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {workspaceAreaId && (
              <div className="ws-sec">
                <div className="ws-sec-head">
                  <div>
                    <h2>{t('crm.workspace.newTable.membersTitle')}</h2>
                    <div className="s">{t('crm.workspace.newTable.membersHint')}</div>
                  </div>
                </div>
                <div className="ws-sec-body">
                  {members.length === 0 && (
                    <div className="ws-note">{t('crm.workspace.newTable.noMembers')}</div>
                  )}
                  {members.map((m) => (
                    <div className="ws-mrow" key={m.id}>
                      <span className="ws-ava">{(m.staffUser?.fullName || m.staffUser?.email || '?').slice(0, 2).toUpperCase()}</span>
                      <span style={{ minWidth: 0 }}>
                        <span className="nm" style={{ display: 'block' }}>{m.staffUser?.fullName || m.staffUser?.email}</span>
                        <span className="ml">{m.staffUser?.email}</span>
                      </span>
                      <span className="sp" />
                      <span className="ws-badge">{t(`crm.workspace.areaSettings.roles.${m.role}`)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* превью */}
          <div className="ws-side" style={{ gap: 12 }}>
            <div className="ws-sec" style={{ marginBottom: 0 }}>
              <div className="ws-sec-head" style={{ padding: '12px 14px 10px' }}>
                <div><h2 style={{ fontSize: 13 }}>{t('crm.workspace.newTable.previewTitle')}</h2></div>
              </div>
              <div className="ws-sec-body" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span
                    className="ws-badge board"
                    style={{
                      background: tableKind === 'board' ? 'var(--ink)' : '#fff',
                      color: tableKind === 'board' ? '#fff' : 'var(--fg-2)',
                      borderColor: tableKind === 'board' ? 'var(--ink)' : 'var(--line-2)',
                    }}
                  >
                    {tableKind === 'board' ? t('crm.workspace.kindBadge.shortBoard') : t('crm.workspace.kindBadge.shortData')}
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 500, color: name ? 'var(--ink)' : 'var(--fg-4)' }}>
                    {name || t('crm.workspace.newTable.noNameYet')}
                  </span>
                </div>
                <div className="ws-note">
                  {tableKind === 'board' ? t('crm.workspace.newTable.previewBoardNote') : t('crm.workspace.newTable.previewDataNote')}
                </div>
                <div style={{ borderTop: '1px solid var(--line-3)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span className="ws-k">{t('crm.workspace.newTable.viewsTitle')}</span>
                  <span className="ws-chain">
                    {viewChain.map((v) => (
                      <span className="it" key={v}>{viewLabel(v)}</span>
                    ))}
                  </span>
                </div>
                {workspaceAreaId && (
                  <div style={{ borderTop: '1px solid var(--line-3)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span className="ws-k">{t('crm.workspace.newTable.accessTitle')}</span>
                    <span className="ws-v">{t('crm.workspace.newTable.accessCount', { count: members.length })}</span>
                  </div>
                )}
              </div>
              {error && <div className="ws-sec-body" style={{ paddingTop: 0 }}><span className="text-sm text-rose-600">{error}</span></div>}
              <div className="ws-sec-foot">
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  style={{ borderRadius: 8, flex: 1, justifyContent: 'center' }}
                  disabled={
                    !name.trim() ||
                    saving ||
                    (template === 'copy' && !copySourceId) ||
                    (template === 'source' && !sourcePick)
                  }
                >
                  {saving ? t('crm.workspace.newTable.creating') : t('crm.workspace.newTable.create')}
                </button>
              </div>
            </div>
            <button
              type="button"
              className="tb-icon-btn"
              style={{ justifyContent: 'center' }}
              onClick={() => navigate(workspaceAreaId ? `/workspace/areas/${workspaceAreaId}` : '/workspace')}
            >
              {t('crm.common.cancel')}
            </button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
};
