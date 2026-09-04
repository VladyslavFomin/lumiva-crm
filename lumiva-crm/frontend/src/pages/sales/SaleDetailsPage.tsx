// src/pages/sales/SaleDetailsPage.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { translateSaleStatus } from './saleStatusI18n';
import {
  fetchSaleDetail,
  fetchSales,
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
import { fetchAuditLog, type AuditLogEntry, type AuditLogAction } from '../../api/auditLog';
import { getStoredUser } from '../../auth/session';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { CustomFieldsManager } from '../../components/CustomFieldsManager';
import { SalePaymentLinkModal } from './SalePaymentLinkModal';
import { JiraIssueLinkPanel } from '../../components/integrations/JiraIssueLinkPanel';
import { getLocale } from '../../i18n/utils';
import type { ProjectComment } from '../projects/projectTypes';
import { splitTextWithMentions } from '../projects/mentions';
import {
  saleOrderDisplayNumber,
  saleStorefrontProductName,
} from '../../utils/saleOrderDisplay';
import { extractSaleProductUrl } from '../../utils/saleLinks';
import {
  extractWooOrderSummary,
  extractStorefrontOrderSummary,
} from '../../utils/wooOrderSummary';
import { Ic, SD_ICON } from './SaleDetailIcons';
import './sales-design.css';
import './sale-detail-design.css';

const cxd = (...a: Array<string | false | undefined | null>) => a.filter(Boolean).join(' ');

const STATUS_ORDER: SaleStatus[] = ['new', 'pending', 'confirmed', 'cancelled', 'refunded', 'other'];

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

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function auditIconFor(action: AuditLogAction): React.ReactNode {
  if (action === 'create') return SD_ICON.bolt;
  if (action === 'delete') return SD_ICON.trash;
  return SD_ICON.refresh;
}

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
  const [copied, setCopied] = useState(false);
  const [ownerPickerOpen, setOwnerPickerOpen] = useState(false);

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
  const [paymentLinkOpen, setPaymentLinkOpen] = useState(false);

  const [auditEntries, setAuditEntries] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const [clientStats, setClientStats] = useState<{ count: number; sum: number | null; sumCurrency: string | null; first: string | null } | null>(null);

  // Комментарии (теги, лайки, ответы) — хранятся в sale.customFields.comments,
  // как в проектах, автосохраняются отдельно от общей формы (не ждут кнопки "Сохранить").
  const [comments, setComments] = useState<ProjectComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionDropdownPos, setMentionDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const commentInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const lastCommentsSnapshotRef = useRef<string>('');

  useEffect(() => {
    fetchStaff()
      .then(setStaff)
      .catch((err) => console.error(err));
  }, []);

  const reload = useCallback(
    (opts?: { quiet?: boolean }) => {
      if (!id) return;
      if (!opts?.quiet) {
        setLoading(true);
        setError(null);
      }

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

          const loadedComments = (
            (sale.customFields as Record<string, any> | undefined)?.comments ?? []
          ) as ProjectComment[];
          setComments(loadedComments);
          lastCommentsSnapshotRef.current = JSON.stringify(loadedComments);
        })
        .catch((e: any) => {
          console.error(e);
          if (!opts?.quiet) setError(e.message || t('crm.sales.details.errors.load'));
        })
        .finally(() => {
          if (!opts?.quiet) setLoading(false);
        });
    },
    [id, t],
  );

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // История изменений (audit-log) — реальная лента, перезагружается после каждого сохранения.
  useEffect(() => {
    if (!id) return;
    setAuditLoading(true);
    fetchAuditLog({ entityType: 'sale', entityId: id, limit: 20 })
      .then((res) => setAuditEntries(res.items))
      .catch(() => setAuditEntries([]))
      .finally(() => setAuditLoading(false));
  }, [id, data?.sale?.updatedAt]);

  // Статистика покупок по привязанному лиду — реальный список продаж этого лида.
  useEffect(() => {
    if (!formLeadId) {
      setClientStats(null);
      return;
    }
    let alive = true;
    fetchSales({ leadId: formLeadId, page: 1, pageSize: 200 })
      .then((res) => {
        if (!alive) return;
        const currencies = new Set(res.items.map((s) => s.currency));
        const sameCurrency = currencies.size <= 1;
        const sum = sameCurrency ? res.items.reduce((acc, s) => acc + (s.amount || 0), 0) : null;
        const dates = res.items
          .map((s) => s.saleDate || s.createdAt)
          .filter(Boolean) as string[];
        const first = dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : null;
        setClientStats({
          count: res.total,
          sum,
          sumCurrency: sameCurrency ? res.items[0]?.currency ?? null : null,
          first,
        });
      })
      .catch(() => setClientStats(null));
    return () => {
      alive = false;
    };
  }, [formLeadId]);

  // Автосохранение комментариев (новый/ответ/лайк) — независимо от основной формы,
  // как в проектах. Читает базовый customFields из последних загруженных данных, а не
  // из formCustomFields, чтобы не сохранять заодно недописанные правки кастомных полей.
  useEffect(() => {
    if (loading || !id) return;
    const snapshot = JSON.stringify(comments);
    if (snapshot === lastCommentsSnapshotRef.current) return;
    const timer = window.setTimeout(() => {
      lastCommentsSnapshotRef.current = snapshot;
      const baseCustomFields = ((data?.sale as Record<string, any> | undefined)?.customFields as Record<string, any>) || {};
      updateSale(id, { customFields: { ...baseCustomFields, comments } })
        .then((updated) => {
          setData((prev) =>
            prev
              ? { ...prev, sale: { ...prev.sale, customFields: updated.customFields, updatedAt: updated.updatedAt } }
              : prev,
          );
        })
        .catch((e: any) => console.error(e));
    }, 600);
    return () => window.clearTimeout(timer);
  }, [comments, loading, id]);

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

  const amount = (sale.amount as number | undefined) ?? null;
  const currency = (sale.currency as string | undefined) ?? t('crm.sales.common.empty');

  const purchaseDateRaw =
    (sale.saleDate as string | undefined) || (sale.createdAt as string | undefined);
  const purchaseDate = purchaseDateRaw ? new Date(purchaseDateRaw) : null;
  const purchaseDateFull = purchaseDate ? purchaseDate.toLocaleString(locale) : t('crm.sales.common.empty');
  const purchaseDatePart = purchaseDate ? purchaseDate.toLocaleDateString(locale) : t('crm.sales.common.empty');
  const purchaseTimePart = purchaseDate
    ? purchaseDate.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    : '';

  const updatedAtRaw = sale.updatedAt as string | undefined;
  const updatedAtDate = updatedAtRaw ? new Date(updatedAtRaw) : null;
  const updatedAtFull = updatedAtDate ? updatedAtDate.toLocaleString(locale) : t('crm.sales.common.empty');
  const updatedTimePart = updatedAtDate
    ? updatedAtDate.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    : '';

  const clientName =
    (sale.agentName as string | undefined) || (sale.guestName as string | undefined) || null;

  const storefrontItemNames = useMemo(
    () => saleStorefrontProductName(sale),
    [sale.customFields],
  );

  const productName = (sale.hotel as string | undefined) || storefrontItemNames || null;

  const wpOrderNoForDisplay = saleOrderDisplayNumber(sale as Record<string, unknown>);

  const wooAdminEditUrl =
    typeof (sale as Record<string, unknown>).wooAdminEditUrl === 'string'
      ? String((sale as Record<string, unknown>).wooAdminEditUrl).trim()
      : '';

  const productUrl = extractSaleProductUrl(sale as Record<string, unknown>);

  const country = (sale.market as string | undefined) || null;

  const contactId = typeof sale.contactId === 'string' ? sale.contactId : null;

  /** Email клиента для «Письмо» / создания лида — та же экстракция, что и в handleCreateLeadFromSale. */
  const clientEmail = useMemo(() => {
    const rawPayload = sale.rawPayload as Record<string, any> | undefined;
    const billing = rawPayload?.billing || {};
    return (
      (typeof billing.email === 'string' && billing.email.trim()) ||
      (meta && (meta.email as string)) ||
      (meta && (meta.billing_email as string)) ||
      ''
    );
  }, [sale.rawPayload, meta]);

  // ---------------- Комментарии: текущий пользователь, упоминания ----------------
  const currentUser = useMemo(() => getStoredUser(), []);
  const currentStaff = useMemo(
    () => staff.find((u) => u.id === currentUser?.id || u.email === currentUser?.email),
    [staff, currentUser],
  );
  const extractMentions = useCallback((text: string) => {
    const matches = text.matchAll(/@([\p{L}\p{N}._-]+)/gu);
    const result: string[] = [];
    for (const m of matches) if (m[1]) result.push(m[1]);
    return result;
  }, []);
  const renderMentions = (text: string) =>
    splitTextWithMentions(text, staff).map((part, idx) =>
      part.mention ? (
        <span key={`m-${idx}`} className="mention">
          {part.text}
        </span>
      ) : (
        <span key={`t-${idx}`}>{part.text}</span>
      ),
    );
  const addComment = () => {
    if (!newComment.trim()) return;
    const mentions = extractMentions(newComment.trim());
    const c: ProjectComment = {
      id: `cm${Date.now()}`,
      author: currentStaff?.fullName || currentUser?.name || currentUser?.email || t('crm.sales.details.fallbacks.noName'),
      createdAt: new Date().toLocaleString(locale),
      text: newComment.trim(),
      mentions,
    };
    setComments((prev) => [c, ...prev]);
    setNewComment('');
  };

  const addReply = (parentId: string) => {
    if (!replyText.trim()) return;
    const mentions = extractMentions(replyText.trim());
    const c: ProjectComment = {
      id: `cm${Date.now()}`,
      author: currentStaff?.fullName || currentUser?.name || currentUser?.email || t('crm.sales.details.fallbacks.noName'),
      createdAt: new Date().toLocaleString(locale),
      text: replyText.trim(),
      mentions,
      parentId,
    };
    setComments((prev) => [...prev, c]);
    setReplyText('');
    setReplyingToId(null);
  };

  const toggleCommentLike = (commentId: string) => {
    const me = currentStaff?.id || currentUser?.id || currentUser?.email;
    if (!me) return;
    setComments((prev) =>
      prev.map((c) => {
        if (c.id !== commentId) return c;
        const likedBy = c.likedBy || [];
        return {
          ...c,
          likedBy: likedBy.includes(me) ? likedBy.filter((x) => x !== me) : [...likedBy, me],
        };
      }),
    );
  };

  const UUID_LIKE = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
  const rawChannelId = typeof sale.channelId === 'string' ? sale.channelId.trim() : '';
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

  const wooOrderSummary = useMemo(() => extractWooOrderSummary(sale.rawPayload), [sale.rawPayload]);

  const storefrontOrderSummary = useMemo(
    () =>
      extractStorefrontOrderSummary(
        sale.customFields,
        (sale.currency as string | undefined) ?? null,
        typeof sale.amount === 'number' ? sale.amount : Number(sale.amount) || null,
      ),
    [sale.customFields, sale.currency, sale.amount],
  );

  const orderItemsSummary = wooOrderSummary || storefrontOrderSummary;

  const unitPrice = (quantity: string | number, lineTotal: string | null): string | null => {
    const qty = typeof quantity === 'number' ? quantity : Number(quantity);
    const total = lineTotal != null ? Number(lineTotal) : NaN;
    if (!qty || !Number.isFinite(qty) || !Number.isFinite(total)) return null;
    return (total / qty).toLocaleString(locale, { maximumFractionDigits: 2 });
  };

  const saleGridFieldLabel = (key: string) =>
    t(`crm.sales.details.saleFieldLabels.${key}`, { defaultValue: key });
  const metaGridFieldLabel = (key: string) =>
    t(`crm.sales.details.metaFieldLabels.${key}`, { defaultValue: key });

  const pairsMeta = meta ? Object.entries(meta).sort(([a], [b]) => a.localeCompare(b)) : [];

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

  const activeCustomFields = useMemo(() => customFields.filter((field) => field.isActive), [customFields]);

  const managerStaff = useMemo(() => {
    const filtered = staff.filter(
      (u) => u.isActive && (u.role === 'owner' || u.role === 'manager' || u.role === 'sales'),
    );
    const base = filtered.length ? filtered : staff.filter((u) => u.isActive);
    return [...base].sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [staff]);

  const ownerAssignableStaff = useMemo(() => {
    if (managerStaff.length) return managerStaff;
    return staff.filter((u) => u.isActive).sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [managerStaff, staff]);

  const selectedOwners = useMemo(
    () => ownerAssignableStaff.filter((u) => formManagerIds.includes(u.id)),
    [ownerAssignableStaff, formManagerIds],
  );

  const ownerDepartmentGroups = useMemo(() => {
    const groups = new Map<string, StaffUser[]>();
    ownerAssignableStaff.forEach((u) => {
      const key = (u.department || '').trim() || t('crm.projects.detail.owner.noDepartment');
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
      checked ? Array.from(new Set([...prev, userId])) : prev.filter((x) => x !== userId),
    );
  };

  const toggleSaleManagerDepartment = (department: string, checked: boolean) => {
    const group = ownerDepartmentGroups.find((g) => g.department === department);
    if (!group) return;
    const ids = group.users.map((u) => u.id);
    setFormManagerIds((prev) =>
      checked ? Array.from(new Set([...prev, ...ids])) : prev.filter((id) => !ids.includes(id)),
    );
  };

  const getCustomFieldValue = (field: CustomField) => (formCustomFields ?? {})[field.key];
  const setCustomFieldValue = (field: CustomField, value: any) => {
    setFormCustomFields((prev) => ({ ...(prev ?? {}), [field.key]: value }));
  };

  const renderCustomFieldInput = (field: CustomField) => {
    const value = getCustomFieldValue(field);
    const label = (
      <span className="sd-fl">
        {field.label}
        {field.required && <em style={{ color: '#b0233a', marginLeft: 4, fontStyle: 'normal' }}>*</em>}
      </span>
    );

    if (field.type === 'boolean') {
      return (
        <label key={field.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
          <input type="checkbox" checked={Boolean(value)} onChange={(e) => setCustomFieldValue(field, e.target.checked)} />
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
            className="sd-field"
            rows={3}
          />
        </div>
      );
    }

    if (field.type === 'select') {
      return (
        <div key={field.id}>
          {label}
          <select value={value ?? ''} onChange={(e) => setCustomFieldValue(field, e.target.value)} className="sd-field">
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
            onChange={(e) => setCustomFieldValue(field, Array.from(e.target.selectedOptions).map((o) => o.value))}
            className="sd-field"
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
            const next = field.type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value;
            setCustomFieldValue(field, next);
          }}
          placeholder={field.placeholder || ''}
          className="sd-field"
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
        setCustomFields([...items].sort((a, b) => a.order - b.order));
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
                updatedAt: updated.updatedAt,
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

      const payload = {
        name: clientName || t('crm.sales.details.lead.defaultName'),
        phone: phoneFromMeta,
        email: clientEmail,
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
      await updateSale(data.id, { leadId: newLead.id });

      setFormLeadId(newLead.id);
      setLeadQuery([newLead.name, newLead.phone || newLead.email].filter(Boolean).join(' • '));

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

  const copyId = () => {
    const val = (sale.id as string) || data?.id || '';
    if (!val || !navigator.clipboard) return;
    navigator.clipboard
      .writeText(val)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="px-scope">
          <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 11.5, color: 'var(--fg-3)' }}>
            {t('crm.sales.details.loading')}
          </div>
        </div>
      </MainLayout>
    );
  }

  if (error || !data) {
    return (
      <MainLayout>
        <div className="px-scope">
          {error && <div style={{ fontSize: 11.5, color: '#b0233a' }}>{error}</div>}
        </div>
      </MainLayout>
    );
  }

  const statusLabel = saleStatusSelectLabels[(formStatus || 'new') as SaleStatus];
  const itemsRows = orderItemsSummary?.lines || [];
  const fallbackSingleItem = !orderItemsSummary && (productName || amount != null);

  return (
    <MainLayout>
      <PageHelpButton topic="saleCard" />
      <div className="px-scope">
        <div className="sd-head">
          <div className="sd-head-l">
            <div className="kicker">
              <span className="dot" />
              {t('crm.sales.kicker')} · {t('crm.sales.details.sections.order')}
            </div>
            <div className="sd-idrow">
              <h1>{t('crm.sales.details.titleWithOrder', { orderNo: wpOrderNoForDisplay })}</h1>
              <span className={cxd('sd-stsel', formStatus || 'new')}>
                <span className="dot" />
                <select value={formStatus || 'new'} onChange={(e) => setFormStatus(e.target.value as SaleStatus)}>
                  {STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {saleStatusSelectLabels[s]}
                    </option>
                  ))}
                </select>
                <Ic d={SD_ICON.chev} size={13} />
              </span>
            </div>
            <div className="sd-uuid">
              {t('crm.sales.details.fields.internalRecordId')} · {sale.id || data.id}
              <button type="button" onClick={copyId} title="Скопировать">
                <Ic d={copied ? SD_ICON.check : SD_ICON.copy} size={12} />
              </button>
            </div>
          </div>
          <div className="sd-head-r">
            <button type="button" className="sl-btn" onClick={() => navigate(-1)}>
              <Ic d={SD_ICON.back} size={14} />
              {t('crm.sales.details.back')}
            </button>
            {wooAdminEditUrl && (
              <a className="sl-btn" href={wooAdminEditUrl} target="_blank" rel="noreferrer">
                <Ic d={SD_ICON.ext} size={14} />
                {t('crm.sales.details.links.wpOrder')}
              </a>
            )}
            {amount != null && amount > 0 && (
              <button type="button" className="sl-btn" onClick={() => setPaymentLinkOpen(true)}>
                <Ic d={SD_ICON.doc} size={14} />
                {t('crm.sales.paymentLink.openButton')}
              </button>
            )}
            <button type="button" className="sl-btn solid" disabled={saving} onClick={() => void handleSave()}>
              <Ic d={SD_ICON.check} size={14} />
              {saving ? t('crm.sales.details.actions.saving') : t('crm.sales.details.actions.save')}
            </button>
          </div>
        </div>

        <div className="sd-strip">
          <div>
            <div className="l">{t('crm.sales.details.strip.amount')}</div>
            <div className="v">
              {amount != null ? amount.toLocaleString(locale, { maximumFractionDigits: 2 }) : t('crm.sales.common.empty')}
              <small>{currency}</small>
            </div>
          </div>
          <div>
            <div className="l">{t('crm.sales.details.strip.payment')}</div>
            <div className="v" style={{ fontSize: 15, marginTop: 8 }}>
              {amount != null && amount > 0
                ? t('crm.sales.details.strip.paymentAvailable')
                : t('crm.sales.details.strip.paymentUnavailable')}
            </div>
            <div className="s">{amount != null && amount > 0 ? t('crm.sales.details.strip.invoiceNotIssued') : '—'}</div>
          </div>
          <div>
            <div className="l">{t('crm.sales.details.strip.channel')}</div>
            <div className="v" style={{ fontSize: 15, marginTop: 8 }}>
              {channelLabel}
            </div>
            <div className="s">
              {wpOrderNoForDisplay !== '—' && (
                <>
                  {t('crm.sales.details.strip.storeLabel')}: <b>{wpOrderNoForDisplay}</b>
                </>
              )}
            </div>
          </div>
          <div>
            <div className="l">{t('crm.sales.details.strip.dates')}</div>
            <div className="v" style={{ fontSize: 15, marginTop: 8, fontFamily: 'var(--ff-mono)', letterSpacing: 0 }}>
              {purchaseDatePart}
            </div>
            <div className="s">
              {purchaseTimePart &&
                t('crm.sales.details.strip.purchaseUpdatedHint', { purchaseTime: purchaseTimePart, updateTime: updatedTimePart || purchaseTimePart })}
            </div>
          </div>
        </div>

        <div className="sd-split">
          <div className="sd-col">
            <div className="sl-panel">
              <div className="sl-panel-h">
                <span className="t">{t('crm.sales.details.sections.orderContents')}</span>
                <span className="s">{t('crm.sales.details.orderContentsHint')}</span>
              </div>
              {itemsRows.length > 0 ? (
                <>
                  <table className="sd-items">
                    <thead>
                      <tr>
                        <th>{t('crm.sales.details.wooOrder.colProduct')}</th>
                        <th className="r">{t('crm.sales.details.wooOrder.colQty')}</th>
                        <th className="r">{t('crm.sales.details.orderContentsExtra.colPrice')}</th>
                        <th className="r">{t('crm.sales.details.wooOrder.colLineTotal')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemsRows.map((line, idx) => (
                        <tr key={`${idx}-${line.name}`}>
                          <td>
                            <span className="nm">{line.name}</span>
                          </td>
                          <td className="r">{line.quantity}</td>
                          <td className="r">
                            {(() => {
                              const p = unitPrice(line.quantity, line.lineTotal);
                              return p ? `${p} ${orderItemsSummary?.currency || currency}` : '—';
                            })()}
                          </td>
                          <td className="r">
                            {line.lineTotal != null ? `${line.lineTotal} ${orderItemsSummary?.currency || currency}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="sd-totals">
                    {orderItemsSummary?.totalTax && (
                      <div className="sd-tr">
                        <span>{t('crm.sales.details.wooOrder.totalTax')}</span>
                        <b>{orderItemsSummary.totalTax} {orderItemsSummary.currency || currency}</b>
                      </div>
                    )}
                    <div className="sd-tr grand">
                      <span>{t('crm.sales.details.orderContentsExtra.grandTotal')}</span>
                      <span>
                        <b>
                          {(orderItemsSummary?.total ?? amount)?.toLocaleString
                            ? Number(orderItemsSummary?.total ?? amount).toLocaleString(locale, { maximumFractionDigits: 2 })
                            : orderItemsSummary?.total}{' '}
                          {orderItemsSummary?.currency || currency}
                        </b>
                      </span>
                    </div>
                  </div>
                </>
              ) : fallbackSingleItem ? (
                <>
                  <table className="sd-items">
                    <thead>
                      <tr>
                        <th>{t('crm.sales.details.wooOrder.colProduct')}</th>
                        <th className="r">{t('crm.sales.details.wooOrder.colQty')}</th>
                        <th className="r">{t('crm.sales.details.wooOrder.colLineTotal')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          <span className="nm">{productName || t('crm.sales.common.empty')}</span>
                          {productUrl && (
                            <a href={productUrl} target="_blank" rel="noreferrer" className="sku" style={{ color: 'var(--fg-3)' }}>
                              {productUrl}
                            </a>
                          )}
                        </td>
                        <td className="r">1</td>
                        <td className="r">{amount != null ? `${amount.toLocaleString(locale, { maximumFractionDigits: 2 })} ${currency}` : '—'}</td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="sd-totals">
                    <div className="sd-tr grand">
                      <span>{t('crm.sales.details.orderContentsExtra.grandTotal')}</span>
                      <b>{amount != null ? `${amount.toLocaleString(locale, { maximumFractionDigits: 2 })} ${currency}` : '—'}</b>
                    </div>
                  </div>
                </>
              ) : (
                <div className="sl-panel-b">
                  <div className="sd-cf">{t('crm.sales.details.orderContentsExtra.noData')}</div>
                </div>
              )}
            </div>

            <div className="sl-panel">
              <div className="sl-panel-h">
                <span className="t">{t('crm.sales.details.strip.payment')}</span>
                <span className="s">{t('crm.sales.paymentLink.openButton')}</span>
              </div>
              <div className="sl-panel-b">
                <div className="sd-pay">
                  <span className="sd-pay-st">
                    <i />
                    {amount != null && amount > 0
                      ? t('crm.sales.details.strip.paymentAvailable')
                      : t('crm.sales.details.strip.paymentUnavailable')}
                  </span>
                  <span className="m">
                    {t('crm.sales.details.paymentExtra.methodNotChosen')}
                    {amount != null && amount > 0 ? ` · ${t('crm.sales.details.strip.invoiceNotIssued')}` : ''}
                  </span>
                  <span className="sl-sp" />
                  {amount != null && amount > 0 && (
                    <button type="button" className="sl-btn sm" onClick={() => setPaymentLinkOpen(true)}>
                      <Ic d={SD_ICON.card} size={12} />
                      {t('crm.sales.paymentLink.openButton')}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="sl-panel">
              <div className="sl-panel-h">
                <span className="t">{t('crm.sales.details.timeline.title')}</span>
                <span className="s">{t('crm.sales.details.timeline.hint')}</span>
              </div>
              <div className="sl-panel-b">
                {auditLoading ? (
                  <div className="sd-cf">{t('crm.sales.details.timeline.loading')}</div>
                ) : auditEntries.length > 0 ? (
                  <div className="sd-tl">
                    {auditEntries.map((entry, idx) => (
                      <div key={entry.id} className={cxd('sd-tl-i', idx === 0 && 'hi')}>
                        <span className="sd-tl-d">
                          <Ic d={auditIconFor(entry.action)} size={11} />
                        </span>
                        <div className="sd-tl-c">
                          <b>{entry.summary || entry.action}</b>
                          {entry.changes && entry.changes.length > 0 && (
                            <p>
                              {entry.changes
                                .map((c) => `${saleGridFieldLabel(c.field)}: ${c.oldValue ?? '—'} → ${c.newValue ?? '—'}`)
                                .join(' · ')}
                            </p>
                          )}
                          <span className="t">
                            {new Date(entry.createdAt).toLocaleString(locale)}
                            {entry.actorName ? ` · ${entry.actorName}` : ''}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="sd-cf">{t('crm.sales.details.timeline.empty')}</div>
                )}
              </div>
            </div>

            <div className="sl-panel">
              <div className="sl-panel-h">
                <span className="t">{t('crm.sales.details.comments.title')}</span>
                <span className="s">{t('crm.sales.details.comments.hint')}</span>
              </div>
              <div className="sl-panel-b">
                {comments.filter((c) => !c.parentId).length > 0 ? (
                  <div className="sd-cm-list">
                    {comments
                      .filter((c) => !c.parentId)
                      .map((c) => {
                        const replies = comments.filter((r) => r.parentId === c.id);
                        const me = currentStaff?.id || currentUser?.id || currentUser?.email || '';
                        const liked = !!me && (c.likedBy || []).includes(me);
                        const renderBody = (comment: ProjectComment) => {
                          const mentions = comment.mentions ?? extractMentions(comment.text || '');
                          return (
                            <>
                              <div className="sd-cm-meta">
                                {comment.createdAt} · {comment.author}
                              </div>
                              <div className="sd-cm-text">{renderMentions(comment.text)}</div>
                              {mentions.length > 0 && (
                                <div className="sd-cm-tags">
                                  {mentions.map((m) => (
                                    <span key={m} className="sd-cm-tag">
                                      @{m}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </>
                          );
                        };
                        return (
                          <div key={c.id}>
                            <div className="sd-cm">
                              {renderBody(c)}
                              <div className="sd-cm-acts">
                                <button type="button" className={cxd('sd-cm-like', liked && 'on')} onClick={() => toggleCommentLike(c.id)}>
                                  <span aria-hidden>{liked ? '♥' : '♡'}</span>
                                  {(c.likedBy || []).length > 0 && (c.likedBy || []).length}
                                </button>
                                <button
                                  type="button"
                                  className="sd-cm-reply-btn"
                                  onClick={() => setReplyingToId((prev) => (prev === c.id ? null : c.id))}
                                >
                                  {t('crm.sales.details.comments.reply')}
                                </button>
                              </div>
                            </div>

                            {replies.length > 0 && (
                              <div className="sd-cm-replies">
                                {replies.map((r) => {
                                  const rLiked = !!me && (r.likedBy || []).includes(me);
                                  return (
                                    <div key={r.id} className="sd-cm reply">
                                      {renderBody(r)}
                                      <div className="sd-cm-acts">
                                        <button
                                          type="button"
                                          className={cxd('sd-cm-like', rLiked && 'on')}
                                          onClick={() => toggleCommentLike(r.id)}
                                        >
                                          <span aria-hidden>{rLiked ? '♥' : '♡'}</span>
                                          {(r.likedBy || []).length > 0 && (r.likedBy || []).length}
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {replyingToId === c.id && (
                              <div className="sd-cm-replybox">
                                <input
                                  autoFocus
                                  className="sd-field"
                                  value={replyText}
                                  onChange={(e) => setReplyText(e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && addReply(c.id)}
                                  placeholder={t('crm.sales.details.comments.replyPlaceholder')}
                                />
                                <button type="button" className="sl-btn sm solid" onClick={() => addReply(c.id)}>
                                  {t('crm.projects.detail.actions.add')}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="sd-cf" style={{ marginBottom: 14 }}>
                    {t('crm.sales.details.comments.empty')}
                  </div>
                )}

                <div className="sd-cm-new">
                  <textarea
                    ref={commentInputRef}
                    className="sd-field"
                    rows={3}
                    style={{ resize: 'vertical', minHeight: 76 }}
                    value={newComment}
                    onChange={(e) => {
                      const value = e.target.value;
                      setNewComment(value);
                      const caret = e.target.selectionStart ?? value.length;
                      const before = value.slice(0, caret);
                      const match = before.match(/@([\p{L}\p{N}._-]*)$/u);
                      setMentionQuery(match ? match[1] : null);
                      if (match) {
                        const rect = e.target.getBoundingClientRect();
                        setMentionDropdownPos({ top: rect.top - 6, left: rect.left, width: rect.width });
                      }
                    }}
                    onBlur={() => window.setTimeout(() => setMentionQuery(null), 150)}
                    placeholder={t('crm.sales.details.comments.newPlaceholder')}
                  />
                  {mentionQuery !== null &&
                    mentionDropdownPos &&
                    (() => {
                      const q = mentionQuery.toLowerCase();
                      const matches = staff.filter((u) => u.fullName?.toLowerCase().includes(q)).slice(0, 6);
                      return (
                        <div
                          className="sd-cm-mentions-dd"
                          style={{
                            position: 'fixed',
                            top: mentionDropdownPos.top,
                            left: mentionDropdownPos.left,
                            width: mentionDropdownPos.width,
                            transform: 'translateY(-100%)',
                          }}
                        >
                          {matches.length > 0 ? (
                            matches.map((u) => (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => {
                                  const el = commentInputRef.current;
                                  const caret = el?.selectionStart ?? newComment.length;
                                  const before = newComment.slice(0, caret);
                                  const after = newComment.slice(caret);
                                  const replaced = before.replace(/@([\p{L}\p{N}._-]*)$/u, `@${u.fullName} `);
                                  const next = replaced + after;
                                  setNewComment(next);
                                  setMentionQuery(null);
                                  requestAnimationFrame(() => {
                                    el?.focus();
                                    const pos = replaced.length;
                                    el?.setSelectionRange(pos, pos);
                                  });
                                }}
                              >
                                <b>{u.fullName}</b>
                                <i>{u.email}</i>
                              </button>
                            ))
                          ) : (
                            <div className="empty">{t('crm.sales.details.comments.noResults')}</div>
                          )}
                        </div>
                      );
                    })()}
                  <div className="sd-cm-send">
                    <button type="button" className="sl-btn sm solid" onClick={addComment}>
                      {t('crm.projects.detail.actions.add')}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="sl-panel">
              <div className="sl-panel-h">
                <span className="t">{t('crm.sales.details.subsections.customFields')}</span>
                <button type="button" className="sl-btn sm" style={{ marginLeft: 'auto' }} onClick={() => setCustomFieldsOpen(true)}>
                  {t('crm.sales.details.actions.configure')}
                </button>
              </div>
              <div className="sl-panel-b">
                {customFieldsLoading && <div className="sd-cf">{t('crm.sales.details.loadingCustomFields')}</div>}
                {customFieldsError && <div className="sd-cf" style={{ color: '#b0233a' }}>{customFieldsError}</div>}
                {!customFieldsLoading && !customFieldsError && activeCustomFields.length === 0 && (
                  <div className="sd-cf">{t('crm.sales.details.fallbacks.noActiveCustomFields')}</div>
                )}
                {activeCustomFields.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                    {activeCustomFields.map((field) => renderCustomFieldInput(field))}
                  </div>
                )}
              </div>
            </div>

            {pairsSaleFiltered.length > 0 && (
              <div className="sl-panel">
                <div className="sl-panel-h">
                  <span className="t">{t('crm.sales.details.sections.allSaleFields')}</span>
                  <span className="s">{t('crm.sales.details.allSaleFieldsHint')}</span>
                </div>
                <div className="sl-panel-b">
                  <div className="sd-rows">
                    {pairsSaleFiltered.map(([key, value]) => (
                      <div key={key} className="sd-row">
                        <span className="k">{saleGridFieldLabel(key)}</span>
                        <span className="v">{typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {pairsMeta.length > 0 && (
              <div className="sl-panel">
                <div className="sl-panel-h">
                  <span className="t">{t('crm.sales.details.sections.metaFields')}</span>
                </div>
                <div className="sl-panel-b">
                  <div className="sd-rows">
                    {pairsMeta.map(([key, value]) => (
                      <div key={key} className="sd-row">
                        <span className="k">{metaGridFieldLabel(key)}</span>
                        <span className="v">{typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="sd-rail">
            <div className="sl-panel">
              <div className="sl-panel-h">
                <span className="t">{t('crm.sales.details.sections.client')}</span>
              </div>
              <div className="sl-panel-b">
                <div className="sd-client">
                  <span className="av">{clientName ? initialsOf(clientName) : '—'}</span>
                  <div style={{ minWidth: 0 }}>
                    <div className="nm">{clientName || t('crm.sales.common.empty')}</div>
                    <div className="em">{clientEmail || country || ''}</div>
                  </div>
                </div>
                <div className="sd-cl-acts">
                  {clientEmail && (
                    <a className="sl-btn sm" href={`mailto:${clientEmail}`}>
                      <Ic d={SD_ICON.mail} size={12} />
                      {t('crm.sales.details.actions.sendEmail')}
                    </a>
                  )}
                  {contactId && (
                    <button type="button" className="sl-btn sm" onClick={() => navigate(`/contacts/${contactId}`)}>
                      <Ic d={SD_ICON.user} size={12} />
                      {t('crm.sales.details.actions.openContactCard')}
                    </button>
                  )}
                </div>
                {formLeadId && clientStats && (
                  <div className="sd-rows" style={{ marginTop: 12 }}>
                    <div className="sd-row">
                      <span className="k">{t('crm.sales.details.clientExtra.statsCount')}</span>
                      <span className="v mono">{clientStats.count}</span>
                    </div>
                    {clientStats.sum != null && (
                      <div className="sd-row">
                        <span className="k">{t('crm.sales.details.clientExtra.statsSum')}</span>
                        <span className="v mono">
                          {clientStats.sum.toLocaleString(locale, { maximumFractionDigits: 0 })} {clientStats.sumCurrency}
                        </span>
                      </div>
                    )}
                    {clientStats.first && (
                      <div className="sd-row">
                        <span className="k">{t('crm.sales.details.clientExtra.statsFirst')}</span>
                        <span className="v mono">{new Date(clientStats.first).toLocaleDateString(locale)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="sl-panel">
              <div className="sl-panel-h">
                <span className="t">{t('crm.sales.details.subsections.lead')}</span>
              </div>
              <div className="sl-panel-b">
                {formLeadId ? (
                  <div className="sd-lead">
                    <Ic d={SD_ICON.bolt} size={14} />
                    <div className="tx">
                      <b>{leadQuery || `${formLeadId.slice(0, 8)}…`}</b>
                      <i>{t('crm.sales.details.lead.linkedHint')}</i>
                    </div>
                    <button type="button" className="sl-btn ghost sm" onClick={handleOpenLead} title={t('crm.sales.details.actions.open')}>
                      <Ic d={SD_ICON.ext} size={12} />
                    </button>
                    <button
                      type="button"
                      className="sl-btn ghost sm"
                      onClick={() => {
                        setFormLeadId('');
                        setLeadQuery('');
                      }}
                    >
                      {t('crm.sales.details.actions.unlinkLead')}
                    </button>
                  </div>
                ) : (
                  <div className="sd-lead-search">
                    <input
                      type="text"
                      className="sd-field"
                      value={leadQuery}
                      onChange={(e) => setLeadQuery(e.target.value)}
                      placeholder={t('crm.sales.details.placeholders.searchLead')}
                    />
                    {leadDropdownOpen &&
                      leadQuery.trim().length >= 2 &&
                      (leadResults.length > 0 ? (
                        <div className="sd-lead-dd">
                          {leadResults.map((lead) => (
                            <button type="button" key={lead.id} onClick={() => handleSelectLead(lead)}>
                              <b>{lead.name || t('crm.sales.details.fallbacks.noName')}</b>
                              <i>{lead.phone || lead.email || t('crm.sales.details.fallbacks.noContacts')}</i>
                            </button>
                          ))}
                        </div>
                      ) : (
                        !leadSearching && (
                          <div className="sd-lead-dd">
                            <div className="empty">{t('crm.sales.details.fallbacks.noResults')}</div>
                          </div>
                        )
                      ))}
                  </div>
                )}
                <p className="sd-note">{t('crm.sales.details.hints.leadAuto')}</p>
                {!formLeadId && (
                  <button
                    type="button"
                    className="sl-btn sm"
                    disabled={creatingLead}
                    onClick={() => void handleCreateLeadFromSale()}
                  >
                    {creatingLead ? t('crm.sales.details.actions.creatingLead') : t('crm.sales.details.actions.createLead')}
                  </button>
                )}
                {createLeadError && <p style={{ fontSize: 10.5, color: '#b0233a', marginTop: 6 }}>{createLeadError}</p>}
              </div>
            </div>

            <div className="sl-panel">
              <div className="sl-panel-h">
                <span className="t">{t('crm.sales.details.subsections.team')}</span>
                <span className="s">{formManagerIds.length}</span>
              </div>
              <div className="sl-panel-b">
                <div className="sd-own">
                  {selectedOwners.map((o) => (
                    <div key={o.id} className="sd-own-r">
                      <span className="av">{initialsOf(o.fullName || o.email)}</span>
                      <span className="tx">
                        <b>{o.fullName || o.email}</b>
                        <i>{o.email}</i>
                      </span>
                      <span className="sd-dept">{o.department || t('crm.projects.detail.owner.noDepartment')}</span>
                      <button type="button" className="x" onClick={() => toggleSaleManagerUser(o.id, false)}>
                        <Ic d={SD_ICON.x} size={12} />
                      </button>
                    </div>
                  ))}
                  {!selectedOwners.length && <div className="sd-cf">{t('crm.sales.details.owners.noneAssigned')}</div>}
                </div>
                <button
                  type="button"
                  className="sl-btn sm"
                  style={{ width: '100%', justifyContent: 'center', marginTop: 9 }}
                  onClick={() => setOwnerPickerOpen((v) => !v)}
                >
                  <Ic d={SD_ICON.plus} size={12} />
                  {t('crm.sales.details.owners.addButton')}
                </button>
                {ownerPickerOpen && (
                  <div className="sd-own-picker">
                    {ownerDepartmentGroups.map((group) => {
                      const groupIds = group.users.map((u) => u.id);
                      const selectedInGroup = groupIds.filter((gid) => formManagerIds.includes(gid)).length;
                      const allChecked = selectedInGroup > 0 && selectedInGroup === groupIds.length;
                      return (
                        <div key={group.department} className="sd-own-grp">
                          <div className="sd-own-grp-h">
                            <span>{group.department}</span>
                            <label style={{ fontWeight: 400, fontSize: 10.5 }}>
                              <input
                                type="checkbox"
                                className="lv-checkbox-input"
                                checked={allChecked}
                                onChange={(e) => toggleSaleManagerDepartment(group.department, e.target.checked)}
                              />
                              {t('crm.projects.detail.owner.wholeDepartment')}
                            </label>
                          </div>
                          {group.users.map((u) => (
                            <label key={u.id}>
                              <input
                                type="checkbox"
                                className="lv-checkbox-input"
                                checked={formManagerIds.includes(u.id)}
                                onChange={(e) => toggleSaleManagerUser(u.id, e.target.checked)}
                              />
                              <span>
                                {u.fullName || u.email}
                                {u.email ? ` · ${u.email}` : ''}
                              </span>
                            </label>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="sl-panel">
              <div className="sl-panel-h">
                <span className="t">Jira</span>
              </div>
              <div className="sl-panel-b">
                <JiraIssueLinkPanel
                  entityType="sale"
                  entityId={(sale.id as string) || data.id}
                  defaultSummary={clientName ? `Сделка — ${clientName}` : undefined}
                />
              </div>
            </div>

            <div className="sl-panel">
              <div className="sl-panel-h">
                <span className="t">{t('crm.sales.details.record.title')}</span>
              </div>
              <div className="sl-panel-b">
                <div className="sd-rows">
                  <div className="sd-row">
                    <span className="k">{t('crm.sales.details.fields.externalOrderNo')}</span>
                    <span className="v mono">{wpOrderNoForDisplay}</span>
                  </div>
                  <div className="sd-row">
                    <span className="k">{t('crm.sales.details.record.currencyLabel')}</span>
                    <span className="v mono">{currency}</span>
                  </div>
                  <div className="sd-row">
                    <span className="k">{t('crm.sales.details.fields.purchaseDate')}</span>
                    <span className="v mono">{purchaseDateFull}</span>
                  </div>
                  <div className="sd-row">
                    <span className="k">{t('crm.sales.details.fields.updatedAt')}</span>
                    <span className="v mono">{updatedAtFull}</span>
                  </div>
                  {data.integration && (
                    <div className="sd-row">
                      <span className="k">{t('crm.sales.details.fields.integration')}</span>
                      <span className="v">
                        {data.integration.name}
                        <i>{data.integration.kind}</i>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="sd-bar">
          <span className="h">{t('crm.sales.details.bar.statusHint', { label: statusLabel })}</span>
          <button type="button" className="sl-btn" onClick={() => navigate(-1)}>
            {t('crm.sales.details.actions.cancel')}
          </button>
          <button type="button" className="sl-btn solid" disabled={saving} onClick={() => void handleSave()}>
            <Ic d={SD_ICON.check} size={14} />
            {saving ? t('crm.sales.details.actions.saving') : t('crm.sales.details.actions.save')}
          </button>
        </div>
      </div>

      {customFieldsOpen && (
        <CustomFieldsManager
          entityType="sale"
          title={t('crm.sales.list.customFieldsTitle')}
          onClose={() => setCustomFieldsOpen(false)}
          onUpdated={(list) => setCustomFields([...list].sort((a, b) => a.order - b.order))}
        />
      )}
      {id && amount != null ? (
        <SalePaymentLinkModal
          open={paymentLinkOpen}
          saleId={id}
          amount={amount}
          currency={currency}
          defaultBuyerName={clientName || ''}
          onClose={() => setPaymentLinkOpen(false)}
          onPaid={() => reload({ quiet: true })}
        />
      ) : null}
    </MainLayout>
  );
};
