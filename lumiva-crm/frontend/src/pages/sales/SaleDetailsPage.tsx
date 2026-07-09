// src/pages/sales/SaleDetailsPage.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { translateSaleStatus } from './saleStatusI18n';
import { SalesStatusPillSelect } from './SalesStatusPillSelect';
import {
  fetchSaleDetail,
  updateSale,
  type SaleDetail,
  type SaleStatus,
} from '../../api/sales';
import {
  fetchCustomFields,
  type CustomField,
} from '../../api/custom-fields';
import {
  searchLeadsQuick,
  createLead,
  fetchLeadById,
  type Lead,
} from '../../api/leads';
import { fetchStaff, type StaffUser } from '../../api/staff';
import { MainLayout } from '../../layout/MainLayout';
import { CustomFieldsManager } from '../../components/CustomFieldsManager';
import { getLocale } from '../../i18n/utils';
import { saleOrderDisplayNumber } from '../../utils/saleOrderDisplay';
import { extractSaleProductUrl } from '../../utils/saleLinks';
import { extractWooOrderSummary } from '../../utils/wooOrderSummary';

/** Поля записи Sale, не выводимые в «Дополнительные поля»: дубли шапки / продукта / формы или служебные ключи. */
const SALE_DETAIL_GRID_HIDDEN_KEYS = new Set([
  'id',
  'tenantId',
  'channelId',
  'contactId',
  'projectId',
  'agentName',
  'guestName',
  'hotel',
  'market',
  'externalOrderNo',
  'externalId',
  'amount',
  'currency',
  'status',
  'saleDate',
  'createdAt',
  'updatedAt',
  'notes',
  'leadId',
  'managerName',
  'customFields',
  'rawPayload',
  'checkInAt',
  'checkOutAt',
  'wooAdminEditUrl',
  'channelSiteLabel',
  'channelIntegrationLabel',
]);

export const SaleDetailsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = getLocale();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<SaleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // форма управления заказом
  const [formStatus, setFormStatus] = useState<SaleStatus | ''>('');
  const [formManagerIds, setFormManagerIds] = useState<string[]>([]);
  const [formNotes, setFormNotes] = useState('');
  const [formLeadId, setFormLeadId] = useState(''); // привязка к лиду
  const [formCustomFields, setFormCustomFields] = useState<Record<string, any>>(
    {},
  );
  const [saving, setSaving] = useState(false);

  // создание лида из заказа
  const [creatingLead, setCreatingLead] = useState(false);
  const [createLeadError, setCreateLeadError] = useState<string | null>(null);

  // поиск лида
  const [leadQuery, setLeadQuery] = useState('');
  const [leadResults, setLeadResults] = useState<Lead[]>([]);
  const [leadSearching, setLeadSearching] = useState(false);
  const [leadDropdownOpen, setLeadDropdownOpen] = useState(false);
  const leadSearchTimeout = useRef<number | undefined>(undefined);

  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldsLoading, setCustomFieldsLoading] = useState(false);
  const [customFieldsError, setCustomFieldsError] = useState<string | null>(null);
  const [customFieldsOpen, setCustomFieldsOpen] = useState(false);
  const [staff, setStaff] = useState<StaffUser[]>([]);

  useEffect(() => {
    fetchStaff()
      .then(setStaff)
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);

    fetchSaleDetail(id)
      .then((res) => {
        setData(res);

        const sale = res.sale || {};

        const initialStatus =
          (sale.status as SaleStatus | undefined) ?? 'new';
        setFormStatus(initialStatus);

        setFormNotes((sale.notes as string) || '');
        setFormLeadId((sale.leadId as string) || '');
        setFormCustomFields((sale.customFields as Record<string, any>) || {});
      })
      .catch((e: any) => {
        console.error(e);
        setError(e.message || t('crm.sales.details.errors.load'));
      })
      .finally(() => setLoading(false));
  }, [id, t]);

  useEffect(() => {
    const lid = data?.sale?.leadId as string | undefined;
    if (!lid) return;
    fetchLeadById(lid)
      .then((lead) => {
        setLeadQuery(
          [lead.name, lead.phone || lead.email].filter(Boolean).join(' • '),
        );
      })
      .catch(() => undefined);
  }, [data?.sale?.leadId]);

  const persistedSaleManagerNames = useMemo(() => {
    const raw = (data?.sale as Record<string, unknown> | undefined)?.managerName;
    return typeof raw === 'string' ? raw : '';
  }, [data?.id, (data?.sale as Record<string, unknown> | undefined)?.managerName]);

  useEffect(() => {
    if (!data?.sale || staff.length === 0) return;
    const raw = persistedSaleManagerNames
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (raw.length === 0) {
      setFormManagerIds([]);
      return;
    }
    const ids: string[] = [];
    for (const name of raw) {
      const u = staff.find((x) => x.fullName.trim() === name);
      if (u) ids.push(u.id);
    }
    setFormManagerIds(ids);
  }, [data?.id, persistedSaleManagerNames, staff]);

  // дебаунс-поиск лида
  useEffect(() => {
    if (!leadQuery || leadQuery.trim().length < 2) {
      setLeadResults([]);
      setLeadDropdownOpen(false);
      return;
    }

    setLeadSearching(true);
    setLeadDropdownOpen(true);

    if (leadSearchTimeout.current) {
      window.clearTimeout(leadSearchTimeout.current);
    }

    leadSearchTimeout.current = window.setTimeout(async () => {
      try {
        const res = await searchLeadsQuick(leadQuery.trim(), 7);
        setLeadResults(res);
      } catch (err) {
        console.error(err);
        setLeadResults([]);
      } finally {
        setLeadSearching(false);
      }
    }, 300);

    return () => {
      if (leadSearchTimeout.current) {
        window.clearTimeout(leadSearchTimeout.current);
      }
    };
  }, [leadQuery]);

  const sale = data?.sale || {};
  const meta = data?.meta || null;

  // Стоимость + валюта
  const amount = (sale.amount as number | undefined) ?? null;

  const currency =
    (sale.currency as string | undefined) ?? t('crm.sales.common.empty');

  // Даты: покупка и изменение
  const purchaseDateRaw =
    (sale.saleDate as string | undefined) ||
    (sale.createdAt as string | undefined);

  const purchaseDate = purchaseDateRaw
    ? new Date(purchaseDateRaw).toLocaleString(locale)
    : t('crm.sales.common.empty');

  const updatedAtRaw = sale.updatedAt as string | undefined;
  const updatedAt = updatedAtRaw
    ? new Date(updatedAtRaw).toLocaleString(locale)
    : t('crm.sales.common.empty');

  // Клиент
  const clientName =
    (sale.agentName as string | undefined) ||
    (sale.guestName as string | undefined) ||
    null;

  // Продукт
  const productName =
    (sale.hotel as string | undefined) || null;

  const wpOrderNoForDisplay = saleOrderDisplayNumber(sale as Record<string, unknown>);

  const wooAdminEditUrl =
    typeof (sale as Record<string, unknown>).wooAdminEditUrl === 'string'
      ? String((sale as Record<string, unknown>).wooAdminEditUrl).trim()
      : '';

  const productUrl = extractSaleProductUrl(sale as Record<string, unknown>);

  // Страна покупки
  const country =
    (sale.market as string | undefined) || null;

  /** Если канал удалён из справочника, API отдаёт channel: null, а в продаже остаётся channelId — не показываем UUID как «название». */
  const UUID_LIKE =
    /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
  const rawChannelId =
    typeof sale.channelId === 'string' ? sale.channelId.trim() : '';
  const channelLabel =
    data?.channel?.name ??
    (!rawChannelId
      ? t('crm.sales.common.empty')
      : UUID_LIKE.test(rawChannelId)
        ? t('crm.sales.details.fields.channelUnresolved')
        : rawChannelId);

  const pairsSaleFiltered = useMemo(() => {
    return Object.entries(sale)
      .filter(([key]) => !SALE_DETAIL_GRID_HIDDEN_KEYS.has(key))
      .sort(([a], [b]) => a.localeCompare(b));
  }, [sale]);

  const wooOrderSummary = useMemo(
    () => extractWooOrderSummary(sale.rawPayload),
    [sale.rawPayload],
  );

  const wooAmountDisplay = (amount: string | null) => {
    if (amount == null || amount === '') return t('crm.sales.common.empty');
    const c = wooOrderSummary?.currency;
    return c ? `${amount} ${c}` : amount;
  };

  const saleGridFieldLabel = (key: string) =>
    t(`crm.sales.details.saleFieldLabels.${key}`, { defaultValue: key });

  const metaGridFieldLabel = (key: string) =>
    t(`crm.sales.details.metaFieldLabels.${key}`, { defaultValue: key });

  const pairsMeta = meta
    ? Object.entries(meta).sort(([a], [b]) => a.localeCompare(b))
    : [];

  const saleStatusSelectLabels = useMemo(
    () =>
      ({
        new: translateSaleStatus(t, i18n, 'new'),
        pending: translateSaleStatus(t, i18n, 'pending'),
        confirmed: translateSaleStatus(t, i18n, 'confirmed'),
        cancelled: translateSaleStatus(t, i18n, 'cancelled'),
        refunded: translateSaleStatus(t, i18n, 'refunded'),
        other: translateSaleStatus(t, i18n, 'other'),
      }) as Record<SaleStatus, string>,
    [t, i18n],
  );

  const activeCustomFields = useMemo(
    () => customFields.filter((field) => field.isActive),
    [customFields],
  );

  const managerStaff = useMemo(() => {
    const filtered = staff.filter(
      (u) =>
        u.isActive &&
        (u.role === 'owner' ||
          u.role === 'manager' ||
          u.role === 'sales'),
    );
    const base = filtered.length ? filtered : staff.filter((u) => u.isActive);
    return [...base].sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [staff]);

  const ownerAssignableStaff = useMemo(() => {
    if (managerStaff.length) return managerStaff;
    return staff
      .filter((u) => u.isActive)
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [managerStaff, staff]);

  const ownerDepartmentGroups = useMemo(() => {
    const groups = new Map<string, StaffUser[]>();
    ownerAssignableStaff.forEach((u) => {
      const key =
        (u.department || '').trim() ||
        t('crm.projects.detail.owner.noDepartment');
      const list = groups.get(key) || [];
      list.push(u);
      groups.set(key, list);
    });
    const nd = t('crm.projects.detail.owner.noDepartment');
    return Array.from(groups.entries())
      .map(([department, users]) => ({
        department,
        users: users.slice().sort((a, b) => a.fullName.localeCompare(b.fullName)),
      }))
      .sort((a, b) => {
        if (a.department === nd) return 1;
        if (b.department === nd) return -1;
        return a.department.localeCompare(b.department, locale);
      });
  }, [ownerAssignableStaff, t, locale]);

  const toggleSaleManagerUser = (userId: string, checked: boolean) => {
    setFormManagerIds((prev) =>
      checked
        ? Array.from(new Set([...prev, userId]))
        : prev.filter((x) => x !== userId),
    );
  };

  const toggleSaleManagerDepartment = (department: string, checked: boolean) => {
    const group = ownerDepartmentGroups.find((g) => g.department === department);
    if (!group) return;
    const ids = group.users.map((u) => u.id);
    setFormManagerIds((prev) =>
      checked
        ? Array.from(new Set([...prev, ...ids]))
        : prev.filter((id) => !ids.includes(id)),
    );
  };

  const getCustomFieldValue = (field: CustomField) =>
    (formCustomFields ?? {})[field.key];

  const setCustomFieldValue = (field: CustomField, value: any) => {
    setFormCustomFields((prev) => ({
      ...(prev ?? {}),
      [field.key]: value,
    }));
  };

  const renderCustomFieldInput = (field: CustomField) => {
    const value = getCustomFieldValue(field);
    const commonClass =
      'base-input h-8 text-[11px] px-2';
    const label = (
      <div className="form-label mb-1">
        {field.label}
        {field.required && <span className="text-rose-400 ml-1">*</span>}
      </div>
    );

    if (field.type === 'boolean') {
      return (
        <label
          key={field.id}
          className="flex items-center gap-2 text-[11px] text-[#111827]"
        >
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => setCustomFieldValue(field, e.target.checked)}
          />
          {field.label}
        </label>
      );
    }

    if (field.type === 'textarea') {
      return (
        <div key={field.id}>
          {label}
          <textarea
            value={value ?? ''}
            onChange={(e) => setCustomFieldValue(field, e.target.value)}
            placeholder={field.placeholder || ''}
            className="base-input text-[11px] px-2 py-2 resize-y"
            rows={3}
          />
        </div>
      );
    }

    if (field.type === 'select') {
      return (
        <div key={field.id}>
          {label}
          <select
            value={value ?? ''}
            onChange={(e) => setCustomFieldValue(field, e.target.value)}
            className={commonClass}
          >
            <option value="">{field.placeholder || t('crm.sales.details.placeholders.selectValue')}</option>
            {(field.options || []).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (field.type === 'multiselect') {
      const arrayValue = Array.isArray(value)
        ? value.map(String)
        : typeof value === 'string' && value
          ? value.split(',').map((v) => v.trim())
          : [];
      return (
        <div key={field.id}>
          {label}
          <select
            multiple
            value={arrayValue}
            onChange={(e) =>
              setCustomFieldValue(
                field,
                Array.from(e.target.selectedOptions).map((o) => o.value),
              )
            }
            className={commonClass}
          >
            {(field.options || []).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );
    }

    const inputType =
      field.type === 'number'
        ? 'number'
        : field.type === 'email'
          ? 'email'
          : field.type === 'phone'
            ? 'tel'
            : field.type === 'date'
              ? 'date'
              : field.type === 'datetime'
                ? 'datetime-local'
                : field.type === 'url'
                  ? 'url'
                  : 'text';

    return (
      <div key={field.id}>
        {label}
        <input
          type={inputType}
          value={value ?? ''}
          onChange={(e) => {
            const next =
              field.type === 'number'
                ? e.target.value === ''
                  ? null
                  : Number(e.target.value)
                : e.target.value;
            setCustomFieldValue(field, next);
          }}
          placeholder={field.placeholder || ''}
          className={commonClass}
        />
      </div>
    );
  };

  useEffect(() => {
    let alive = true;
    setCustomFieldsLoading(true);
    setCustomFieldsError(null);
    fetchCustomFields('sale')
      .then((items) => {
        if (!alive) return;
        const sorted = [...items].sort((a, b) => a.order - b.order);
        setCustomFields(sorted);
      })
      .catch((e) => {
        console.error('Failed to load sale custom fields:', e);
        if (!alive) return;
        setCustomFieldsError(t('crm.sales.details.errors.loadCustomFields'));
      })
      .finally(() => {
        if (!alive) return;
        setCustomFieldsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [t]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    setError(null);

    try {
      const managerNamesForSave = ownerAssignableStaff
        .filter((u) => formManagerIds.includes(u.id))
        .map((u) => u.fullName.trim())
        .filter(Boolean);

      const updated = await updateSale(id, {
        status: formStatus || undefined,
        managerName: managerNamesForSave.length ? managerNamesForSave.join(', ') : undefined,
        notes: formNotes.trim() || undefined,
        leadId: formLeadId.trim() || null,
        customFields: formCustomFields,
      });

      setData((prev) =>
        prev
          ? {
              ...prev,
              sale: {
                ...prev.sale,
                status: updated.status,
                managerName: updated.managerName,
                notes: updated.notes,
                leadId: updated.leadId,
                customFields: updated.customFields,
              },
            }
          : prev,
      );
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.sales.details.errors.save'));
    } finally {
      setSaving(false);
    }
  };

  const handleOpenLead = () => {
    if (!formLeadId) return;
    navigate(`/app/leads/${formLeadId}`);
  };

  const handleSelectLead = (lead: Lead) => {
    setFormLeadId(lead.id);
    const parts = [lead.name, lead.phone || lead.email].filter(Boolean);
    setLeadQuery(parts.join(' • '));
    setLeadDropdownOpen(false);
  };

  const handleCreateLeadFromSale = async () => {
    if (!data) return;
    setCreatingLead(true);
    setCreateLeadError(null);

    try {
      const rawPayload = sale.rawPayload as Record<string, any> | undefined;
      const billing = rawPayload?.billing || {};
      const phoneFromMeta =
        (typeof billing.phone === 'string' && billing.phone.trim()) ||
        (meta && (meta.phone as string)) ||
        (meta && (meta.billing_phone as string)) ||
        '';
      const emailFromMeta =
        (typeof billing.email === 'string' && billing.email.trim()) ||
        (meta && (meta.email as string)) ||
        (meta && (meta.billing_email as string)) ||
        '';

      const payload = {
        name: clientName || t('crm.sales.details.lead.defaultName'),
        phone: phoneFromMeta,
        email: emailFromMeta,
        country: country || '',
        status: 'Новый клиент' as const,
        source: data?.channel?.name || 'sales',
        meta: {
          ...(meta || {}),
          fromSaleId: sale.id || data.id,
          saleExternalId: sale.externalId,
          saleChannelId: sale.channelId,
          saleAmount: amount,
          saleCurrency: currency,
        },
      };

      const newLead = await createLead(payload);

      // сразу привязываем лид к заказу
      await updateSale(data.id, { leadId: newLead.id });

      setFormLeadId(newLead.id);
      setLeadQuery(
        [newLead.name, newLead.phone || newLead.email]
          .filter(Boolean)
          .join(' • '),
      );

      setData((prev) =>
        prev
          ? {
              ...prev,
              sale: {
                ...prev.sale,
                leadId: newLead.id,
              },
            }
          : prev,
      );
    } catch (e: any) {
      console.error(e);
      setCreateLeadError(e?.message || t('crm.sales.details.errors.createLead'));
    } finally {
      setCreatingLead(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6 pb-8">
        {/* Заголовок */}
        <section className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-text-tertiary mb-1">
              {t('crm.sales.kicker')}
            </div>
            <h1 className="page-title">
              {t('crm.sales.details.titleWithOrder', {
                orderNo: saleOrderDisplayNumber(sale as Record<string, unknown>),
              })}
            </h1>
            <p className="text-xs text-text-tertiary mt-1 max-w-2xl">
              {t('crm.sales.details.subtitle')}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="btn-secondary btn-secondary-sm"
            >
              {`← ${t('crm.sales.details.back')}`}
            </button>
          </div>
        </section>

        {loading && (
          <div className="text-[11px] text-text-tertiary">{t('crm.sales.details.loading')}</div>
        )}

        {error && (
          <div className="text-[11px] text-red-400">{error}</div>
        )}

        {data && !loading && !error && (
          <>
            {/* Шапка: три колонки с разделителями */}
            <section className="card p-4 md:p-6 text-xs">
              <div className="mb-4 border-b border-border-default pb-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
                  {t('crm.sales.details.structure.heroKicker')}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 md:divide-x md:divide-border-default gap-y-8 md:gap-y-0">
                {/* Заказ */}
                <div className="space-y-2 md:pr-6">
                  <div className="text-[11px] text-text-secondary">
                    {t('crm.sales.details.sections.order')}
                  </div>
                  <div className="text-[#111827] text-xl font-semibold tabular-nums tracking-tight">
                    {saleOrderDisplayNumber(sale as Record<string, unknown>)}
                  </div>
                  <div className="pt-1 space-y-1.5">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-tertiary">
                      {t('crm.sales.details.subsections.status')}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 shadow-sm">
                      <SalesStatusPillSelect
                        value={(formStatus || 'new') as SaleStatus}
                        labels={saleStatusSelectLabels}
                        onChange={(s) => setFormStatus(s)}
                        stopPropagationOnControl={false}
                        className="w-full [&_button]:max-w-none [&_button]:w-full [&_button]:justify-between"
                      />
                    </div>
                  </div>
                  <div className="text-[10px] text-text-tertiary font-mono break-all pt-2 border-t border-border-default">
                    {t('crm.sales.details.fields.internalRecordId')}
                    <span className="text-text-secondary"> · </span>
                    <span className="break-all">{sale.id || data.id}</span>
                  </div>
                  <dl className="space-y-1.5 pt-2">
                    <div className="flex justify-between gap-4">
                      <dt className="text-text-tertiary shrink-0">{t('crm.sales.details.fields.purchaseDate')}</dt>
                      <dd className="text-[#111827] text-right">{purchaseDate}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-text-tertiary shrink-0">{t('crm.sales.details.fields.updatedAt')}</dt>
                      <dd className="text-[#111827] text-right">{updatedAt}</dd>
                    </div>
                  </dl>
                </div>

                {/* Финансы и канал */}
                <div className="space-y-2 md:px-6">
                  <div className="text-[11px] text-text-secondary">
                    {t('crm.sales.details.sections.amountAndChannel')}
                  </div>
                  <div className="text-[#111827] text-lg font-semibold tabular-nums">
                    {amount != null
                      ? `${amount.toLocaleString(locale, {
                          maximumFractionDigits: 2,
                        })} ${currency}`
                      : t('crm.sales.common.empty')}
                  </div>
                  <dl className="space-y-1.5 pt-2 border-t border-border-default">
                    <div className="flex justify-between gap-4">
                      <dt className="text-text-tertiary shrink-0">{t('crm.sales.details.fields.channel')}</dt>
                      <dd className="text-[#111827] text-right min-w-0">{channelLabel}</dd>
                    </div>
                    {data?.channel?.name
                      ? null
                      : rawChannelId && UUID_LIKE.test(rawChannelId) ? (
                          <div className="text-[10px] font-mono text-text-tertiary break-all pt-1">
                            {t('crm.sales.details.fields.channelIdInternal')}: {rawChannelId}
                          </div>
                        ) : null}
                    {data.integration && (
                      <div className="flex justify-between gap-4">
                        <dt className="text-text-tertiary shrink-0">{t('crm.sales.details.fields.integration')}</dt>
                        <dd className="text-[#111827] text-right min-w-0">
                          {data.integration.name} · {data.integration.kind}
                        </dd>
                      </div>
                    )}
                  </dl>
                  {wooAdminEditUrl ? (
                    <div className="pt-2">
                      <a
                        href={wooAdminEditUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-lumiva-accent hover:underline font-medium text-[11px]"
                      >
                        {t('crm.sales.details.links.wpOrder')} ↗
                      </a>
                    </div>
                  ) : null}
                </div>

                {/* Клиент */}
                <div className="space-y-2 md:pl-6">
                  <div className="text-[11px] text-text-secondary">
                    {t('crm.sales.details.sections.client')}
                  </div>
                  <div className="text-[#111827] text-base font-medium leading-snug">
                    {clientName || t('crm.sales.common.empty')}
                  </div>
                  {country && (
                    <div className="text-[11px] text-text-secondary pt-2 border-t border-border-default">
                      <span className="text-text-tertiary">{t('crm.sales.details.fields.country')}: </span>
                      <span className="text-[#111827]">{country}</span>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Содержимое заказа: сводка CRM и данные Woo */}
            {(wooOrderSummary ||
              productName ||
              wpOrderNoForDisplay !== '—' ||
              productUrl) && (
              <section className="card p-4 md:p-6 text-xs">
                <header className="border-b border-border-default pb-4 mb-6">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-tertiary mb-1">
                    {t('crm.sales.details.structure.orderContentsKicker')}
                  </div>
                  <h2 className="text-base font-semibold text-[#111827] tracking-tight">
                    {t('crm.sales.details.sections.orderContents')}
                  </h2>
                  <p className="text-[11px] text-text-tertiary mt-1 max-w-2xl leading-relaxed">
                    {t('crm.sales.details.orderContentsHint')}
                  </p>
                </header>

                <div className="space-y-6">
                  {(productName ||
                    wpOrderNoForDisplay !== '—' ||
                    productUrl) && (
                    <div className="space-y-3">
                      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                        {t('crm.sales.details.orderContentsFromCrm')}
                      </h3>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <div className="text-[11px] text-text-tertiary mb-1">
                              {t('crm.sales.details.fields.productName')}
                            </div>
                            <div className="text-slate-900 text-[13px] font-medium leading-snug">
                              {productName || t('crm.sales.common.empty')}
                            </div>
                          </div>
                          <div>
                            <div className="text-[11px] text-text-tertiary mb-1">
                              {t('crm.sales.details.fields.externalOrderNo')}
                            </div>
                            <div className="text-slate-900 font-mono text-[11px] tabular-nums">
                              {wpOrderNoForDisplay !== '—'
                                ? wpOrderNoForDisplay
                                : t('crm.sales.common.empty')}
                            </div>
                          </div>
                          <div>
                            <div className="text-[11px] text-text-tertiary mb-1">
                              {t('crm.sales.details.fields.productLink')}
                            </div>
                            {productUrl ? (
                              <a
                                href={productUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-lumiva-accent text-[11px] font-medium hover:underline break-all"
                              >
                                {productUrl}
                              </a>
                            ) : (
                              <span className="text-text-secondary">
                                {t('crm.sales.common.empty')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {wooOrderSummary &&
                  (productName ||
                    wpOrderNoForDisplay !== '—' ||
                    productUrl) ? (
                    <div className="h-px bg-border-default" aria-hidden />
                  ) : null}

                  {wooOrderSummary && (
                    <div className="space-y-3">
                      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                        {t('crm.sales.details.orderContentsFromStore')}
                      </h3>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm space-y-4">
                        <p className="text-[10px] text-slate-600 leading-snug">
                          {t('crm.sales.details.wooOrder.hint')}
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <div className="text-[11px] text-text-tertiary mb-1">
                              {t('crm.sales.details.wooOrder.currency')}
                            </div>
                            <div className="text-slate-900 font-semibold tabular-nums">
                              {wooOrderSummary.currency ?? t('crm.sales.common.empty')}
                            </div>
                          </div>
                          <div>
                            <div className="text-[11px] text-text-tertiary mb-1">
                              {t('crm.sales.details.wooOrder.totalTax')}
                            </div>
                            <div className="text-slate-900 tabular-nums">
                              {wooAmountDisplay(wooOrderSummary.totalTax)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[11px] text-text-tertiary mb-1">
                              {t('crm.sales.details.wooOrder.orderTotal')}
                            </div>
                            <div className="text-slate-900 font-semibold tabular-nums">
                              {wooAmountDisplay(wooOrderSummary.total)}
                            </div>
                          </div>
                        </div>

                        {wooOrderSummary.lines.length > 0 && (
                          <div>
                            <div className="text-[11px] font-medium text-slate-700 mb-2">
                              {t('crm.sales.details.wooOrder.itemsHeading')}
                            </div>
                            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                              <table className="w-full text-left border-collapse min-w-[280px]">
                                <thead>
                                  <tr className="border-b border-slate-200 bg-slate-100/80">
                                    <th className="py-2 px-2 text-[10px] uppercase tracking-wide text-slate-600 font-medium">
                                      {t('crm.sales.details.wooOrder.colProduct')}
                                    </th>
                                    <th className="py-2 px-2 text-[10px] uppercase tracking-wide text-slate-600 font-medium whitespace-nowrap w-20 text-right">
                                      {t('crm.sales.details.wooOrder.colQty')}
                                    </th>
                                    <th className="py-2 px-2 text-[10px] uppercase tracking-wide text-slate-600 font-medium whitespace-nowrap text-right">
                                      {t('crm.sales.details.wooOrder.colLineTotal')}
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {wooOrderSummary.lines.map((line, idx) => (
                                    <tr
                                      key={`${idx}-${line.name}`}
                                      className="border-b border-slate-100 last:border-0"
                                    >
                                      <td className="py-2 px-2 text-slate-900 align-top text-[11px]">
                                        {line.name}
                                      </td>
                                      <td className="py-2 px-2 text-slate-800 tabular-nums text-right align-top text-[11px]">
                                        {line.quantity}
                                      </td>
                                      <td className="py-2 px-2 text-slate-800 tabular-nums text-right align-top text-[11px]">
                                        {line.lineTotal != null &&
                                        line.lineTotal !== ''
                                          ? wooAmountDisplay(line.lineTotal)
                                          : t('crm.sales.common.empty')}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Управление заказом: по подпунктам, светлые панели как у ответственных */}
            <section className="card p-4 md:p-6 text-xs">
              <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between border-b border-border-default pb-4 mb-6">
                <div className="min-w-0 space-y-1">
                  <h2 className="text-base font-semibold text-[#111827] tracking-tight">
                    {t('crm.sales.details.sections.management')}
                  </h2>
                  <p className="text-[11px] text-text-tertiary max-w-xl leading-relaxed">
                    {t('crm.sales.details.managementIntro')}
                  </p>
                </div>
                {saving && (
                  <span className="text-[11px] text-text-secondary shrink-0 tabular-nums">
                    {t('crm.sales.details.actions.saving')}
                  </span>
                )}
              </header>

              <div className="space-y-8">
                {/* Команда и лид — две колонки на xl */}
                <div className="grid grid-cols-1 gap-8 xl:grid-cols-12 xl:gap-8 xl:items-start">
                  <div className="space-y-3 xl:col-span-7 min-w-0">
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                      {t('crm.sales.details.subsections.team')}
                    </h3>
                    <label className="block text-[11px] font-medium text-text-secondary sr-only">
                      {t('crm.sales.details.fields.manager')}
                    </label>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm">
                      <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-text-tertiary">
                        {t('crm.projects.detail.owner.byDepartment')}
                      </div>
                      <div className="mb-2 text-[11px] text-slate-600">
                        {t('crm.projects.detail.owner.selected', {
                          count: formManagerIds.length,
                        })}
                      </div>
                      <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                        {ownerDepartmentGroups.map((group) => {
                          const groupIds = group.users.map((u) => u.id);
                          const selectedInGroup = groupIds.filter((id) =>
                            formManagerIds.includes(id),
                          ).length;
                          const allChecked =
                            selectedInGroup > 0 &&
                            selectedInGroup === groupIds.length;
                          return (
                            <div
                              key={group.department}
                              className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm"
                            >
                              <div className="mb-1.5 flex items-center justify-between gap-2">
                                <div className="truncate text-[11px] font-semibold text-slate-900">
                                  {group.department}
                                </div>
                                <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[10px] text-slate-600">
                                  <input
                                    type="checkbox"
                                    checked={allChecked}
                                    onChange={(e) =>
                                      toggleSaleManagerDepartment(
                                        group.department,
                                        e.target.checked,
                                      )
                                    }
                                    className="h-4 w-4 shrink-0 rounded border-slate-400 text-blue-600 focus:ring-blue-500"
                                  />
                                  {t('crm.projects.detail.owner.wholeDepartment')}
                                </label>
                              </div>
                              <div className="space-y-1">
                                {group.users.map((u) => (
                                  <label
                                    key={u.id}
                                    className="flex cursor-pointer items-start gap-2 text-[11px]"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={formManagerIds.includes(u.id)}
                                      onChange={(e) =>
                                        toggleSaleManagerUser(u.id, e.target.checked)
                                      }
                                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-400 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="min-w-0">
                                      <span className="font-medium text-slate-900">
                                        {u.fullName || u.email}
                                      </span>
                                      {u.email ? (
                                        <span className="text-text-tertiary">
                                          {' · '}
                                          {u.email}
                                        </span>
                                      ) : null}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 xl:col-span-5 min-w-0">
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                      {t('crm.sales.details.subsections.lead')}
                    </h3>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm space-y-3">
                      <p className="text-[10px] text-slate-600 leading-snug">
                        {t('crm.sales.details.hints.leadAuto')}
                      </p>
                      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <div className="relative flex items-center border-b border-transparent">
                          <input
                            type="text"
                            value={leadQuery}
                            onChange={(e) => setLeadQuery(e.target.value)}
                            placeholder={t('crm.sales.details.placeholders.searchLead')}
                            className="w-full min-h-[36px] border-0 bg-transparent px-3 py-2 text-[11px] text-slate-800 outline-none placeholder:text-text-secondary pr-9"
                          />
                          {leadSearching && (
                            <span className="pointer-events-none absolute right-3 text-[11px] text-text-secondary">
                              …
                            </span>
                          )}
                        </div>

                        {leadDropdownOpen &&
                          leadQuery.trim().length >= 2 &&
                          (leadResults.length > 0 ? (
                            <div className="max-h-56 overflow-y-auto border-t border-slate-200 bg-white">
                              {leadResults.map((lead) => (
                                <button
                                  type="button"
                                  key={lead.id}
                                  onClick={() => handleSelectLead(lead)}
                                  className="flex w-full flex-col items-start gap-0.5 border-b border-slate-100 px-3 py-2.5 text-left last:border-b-0 hover:bg-slate-50"
                                >
                                  <span className="block w-full truncate text-[11px] font-medium text-slate-900">
                                    {lead.name ||
                                      t('crm.sales.details.fallbacks.noName')}
                                  </span>
                                  <span className="block w-full truncate text-[10px] text-text-tertiary">
                                    {lead.phone ||
                                      lead.email ||
                                      t('crm.sales.details.fallbacks.noContacts')}
                                  </span>
                                </button>
                              ))}
                            </div>
                          ) : (
                            !leadSearching && (
                              <div className="border-t border-slate-200 px-3 py-2.5 text-[11px] text-text-tertiary">
                                {t('crm.sales.details.fallbacks.noResults')}
                              </div>
                            )
                          ))}
                      </div>

                      {formLeadId ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="max-w-[220px] truncate text-[11px] text-slate-700"
                            title={formLeadId}
                          >
                            {leadQuery ||
                              `${formLeadId.slice(0, 8)}…`}
                          </span>
                          <button
                            type="button"
                            onClick={handleOpenLead}
                            className="inline-flex px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-[11px] font-medium text-slate-900 shadow-sm transition-colors hover:bg-surface-hover"
                          >
                            {t('crm.sales.details.actions.open')}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setFormLeadId('');
                              setLeadQuery('');
                            }}
                            className="text-[11px] text-slate-600 hover:text-slate-900 underline"
                          >
                            {t('crm.sales.details.actions.unlinkLead')}
                          </button>
                        </div>
                      ) : null}

                      <div>
                        <button
                          type="button"
                          disabled={!!formLeadId || creatingLead}
                          onClick={handleCreateLeadFromSale}
                          className="inline-flex px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-[11px] font-medium text-slate-900 shadow-sm transition-colors hover:bg-surface-hover disabled:opacity-50"
                        >
                          {creatingLead
                            ? t('crm.sales.details.actions.creatingLead')
                            : t('crm.sales.details.actions.createLead')}
                        </button>
                      </div>
                      {createLeadError && (
                        <p className="text-[10px] text-red-600">
                          {createLeadError}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Кастомные поля */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                      {t('crm.sales.details.subsections.customFields')}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setCustomFieldsOpen(true)}
                      className="text-[11px] font-medium text-lumiva-accent hover:text-lumiva-accent-soft"
                    >
                      {t('crm.sales.details.actions.configure')}
                    </button>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm space-y-3">
                    {customFieldsLoading && (
                      <div className="text-[11px] text-slate-600">
                        {t('crm.sales.details.loadingCustomFields')}
                      </div>
                    )}
                    {customFieldsError && (
                      <div className="text-[11px] text-red-600">
                        {customFieldsError}
                      </div>
                    )}
                    {!customFieldsLoading &&
                      !customFieldsError &&
                      activeCustomFields.length === 0 && (
                        <div className="text-[11px] text-slate-600">
                          {t('crm.sales.details.fallbacks.noActiveCustomFields')}
                        </div>
                      )}
                    {activeCustomFields.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {activeCustomFields.map((field) =>
                          renderCustomFieldInput(field),
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Заметки */}
                <div className="space-y-3">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                    {t('crm.sales.details.subsections.notes')}
                  </h3>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                    <label className="block text-[11px] font-medium text-slate-700 mb-2">
                      {t('crm.sales.details.fields.notes')}
                    </label>
                    <textarea
                      rows={4}
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      placeholder={t('crm.sales.details.placeholders.notes')}
                      className="w-full rounded-xl bg-white border border-slate-200 text-[11px] text-slate-900 px-3 py-2 outline-none resize-y placeholder:text-text-secondary focus:border-lumiva-accent/60 focus:ring-1 focus:ring-lumiva-accent/20"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-end border-t border-slate-800/80 pt-5">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-primary btn-primary-lg disabled:opacity-60"
                >
                  {saving ? t('crm.sales.details.actions.saving') : t('crm.sales.details.actions.save')}
                </button>
              </div>
            </section>

            {/* Дополнительные поля записи (без дублей шапки и без служебных ключей) */}
            {pairsSaleFiltered.length > 0 && (
              <section className="card p-4 md:p-5 text-xs">
                <div className="text-sm font-semibold text-slate-100 mb-0.5">
                  {t('crm.sales.details.sections.allSaleFields')}
                </div>
                <p className="text-[11px] text-text-tertiary mb-3 max-w-2xl">
                  {t('crm.sales.details.allSaleFieldsHint')}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                  {pairsSaleFiltered.map(([key, value]) => (
                    <div key={key} className="flex gap-2">
                      <div className="w-40 text-[11px] text-text-tertiary truncate">
                        {saleGridFieldLabel(key)}
                      </div>
                      <div className="flex-1 text-slate-100 break-all">
                        {typeof value === 'object' && value !== null
                          ? JSON.stringify(value)
                          : String(value)}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Дополнительные данные (meta) */}
            {pairsMeta.length > 0 && (
              <section className="card p-4 md:p-5 text-xs">
                <div className="text-sm font-semibold text-slate-100 mb-2">
                  {t('crm.sales.details.sections.metaFields')}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                  {pairsMeta.map(([key, value]) => (
                    <div key={key} className="flex gap-2">
                      <div className="w-40 text-[11px] text-text-tertiary truncate">
                        {metaGridFieldLabel(key)}
                      </div>
                      <div className="flex-1 text-slate-100 break-all">
                        {typeof value === 'object' && value !== null
                          ? JSON.stringify(value)
                          : String(value)}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
      {customFieldsOpen && (
        <CustomFieldsManager
          entityType="sale"
          title={t('crm.sales.list.customFieldsTitle')}
          onClose={() => setCustomFieldsOpen(false)}
          onUpdated={(list) =>
            setCustomFields([...list].sort((a, b) => a.order - b.order))
          }
        />
      )}
    </MainLayout>
  );
};