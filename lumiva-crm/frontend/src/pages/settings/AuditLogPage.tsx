// src/pages/settings/AuditLogPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { fetchAuditLog, type AuditLogEntry, type AuditLogEntityType, type AuditLogAction } from '../../api/auditLog';
import { fetchStaff, type StaffUser } from '../../api/staff';
import { useAlertModal } from '../../contexts/AlertModalContext';
import '../telephony/telephony-design.css';

const ENTITY_KEYS: AuditLogEntityType[] = ['lead', 'contact', 'company', 'sale', 'project', 'reservation', 'hotel_reservation', 'product'];
const ACTION_KEYS: AuditLogAction[] = ['create', 'update', 'delete'];
const ACTION_CLASS: Record<AuditLogAction, string> = { create: 'ok', update: 'warn', delete: 'bad' };

export const AuditLogPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const al = (key: string, opts?: Record<string, unknown>) => t(`crm.settings.auditLog.${key}`, opts as any) as string;
  const dateLocale = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
  const formatDate = (iso: string) => new Date(iso).toLocaleString(dateLocale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const entityLabel = (k: AuditLogEntityType) => t(`crm.settings.auditLog.entityLabels.${k}`);
  const actionLabel = (k: AuditLogAction) => t(`crm.settings.auditLog.actionLabels.${k}`);

  const { showAlert } = useAlertModal();
  const [items, setItems] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [entityType, setEntityType] = useState<AuditLogEntityType | ''>('');
  const [action, setAction] = useState<AuditLogAction | ''>('');
  const [search, setSearch] = useState('');

  const staffNameById = useMemo(() => new Map(staff.map((s) => [s.id, s.fullName])), [staff]);

  useEffect(() => {
    fetchStaff().then(setStaff).catch(() => {});
  }, []);

  const load = (nextPage: number, append: boolean) => {
    setLoading(true);
    fetchAuditLog({
      entityType: entityType || undefined,
      action: action || undefined,
      search: search || undefined,
      page: nextPage,
      limit: 30,
    })
      .then((res) => {
        setItems((prev) => (append ? [...prev, ...res.items] : res.items));
        setTotal(res.total);
        setPage(nextPage);
      })
      .catch((e) => showAlert(e?.message || al('loadError'), { variant: 'error' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, action]);

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    load(1, false);
  };

  return (
    <MainLayout>
      <div className="px-scope">
        <div className="tel-hero">
          <div>
            <div className="kicker"><span className="dot" />{al('kicker')}</div>
            <h1>{al('title')}</h1>
            <p className="sub">{al('subtitle')}</p>
          </div>
        </div>

        <div className="ha-section">
          <form onSubmit={onSearchSubmit} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="bk-search" style={{ maxWidth: 280 }}>
              <input
                placeholder={al('searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value as AuditLogEntityType | '')}
              style={{ padding: '9px 12px', borderRadius: 9, border: '1px solid var(--line-2)', fontSize: 12.5, fontFamily: 'inherit', background: '#fff' }}
            >
              <option value="">{al('allEntities')}</option>
              {ENTITY_KEYS.map((k) => (
                <option key={k} value={k}>{entityLabel(k)}</option>
              ))}
            </select>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as AuditLogAction | '')}
              style={{ padding: '9px 12px', borderRadius: 9, border: '1px solid var(--line-2)', fontSize: 12.5, fontFamily: 'inherit', background: '#fff' }}
            >
              <option value="">{al('allActions')}</option>
              {ACTION_KEYS.map((k) => (
                <option key={k} value={k}>{actionLabel(k)}</option>
              ))}
            </select>
            <button type="submit" className="btn">{al('findBtn')}</button>
          </form>
        </div>

        <div className="ha-section">
          <div className="ha-section-head">
            <div>
              <h3>{al('recordsTitle')}</h3>
              <div className="sub">{al('totalSuffix', { count: total })}</div>
            </div>
          </div>

          {items.length === 0 && !loading ? (
            <p style={{ fontSize: 12.5, color: 'var(--fg-3)' }}>{al('empty')}</p>
          ) : (
            items.map((it) => (
              <div key={it.id} className="sms-thread-row" style={{ cursor: 'default', gridTemplateColumns: '90px 1fr 140px' }}>
                <span className={`ha-risk-pill ${ACTION_CLASS[it.action]}`} style={{ alignSelf: 'center', textAlign: 'center' }}>{actionLabel(it.action)}</span>
                <div>
                  <div className="call-name">{entityLabel(it.entityType)}{it.entityLabel ? ` · ${it.entityLabel}` : ''}</div>
                  <div className="sms-preview">{it.summary || '—'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11.5, color: 'var(--ink)' }}>{it.actorUserId ? (staffNameById.get(it.actorUserId) || al('staffFallback')) : al('systemFallback')}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--fg-3)', fontFamily: 'var(--ff-mono)' }}>{formatDate(it.createdAt)}</div>
                </div>
              </div>
            ))
          )}

          {items.length < total && (
            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <button className="btn" disabled={loading} onClick={() => load(page + 1, true)}>
                {loading ? al('loadingMore') : al('showMoreBtn')}
              </button>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};
