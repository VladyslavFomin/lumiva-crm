import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchLeads, isLeadOmittedFromAnalytics, type Lead } from '../../api/leads';
import { ProjectsAnalyticsPage } from '../projects/ProjectsAnalyticsPage';
import type { Project } from '../projects/projectTypes';

type AnalyticsFieldMeta = {
  key: string;
  label: string;
  type?: string;
};

const guessFieldType = (values: any[]): string => {
  if (values.some((value) => Array.isArray(value))) return 'multiselect';
  const meaningful = values.filter(
    (value) => value !== undefined && value !== null && String(value).trim() !== '',
  );
  if (!meaningful.length) return 'text';
  const numericCount = meaningful.filter((value) => {
    const normalized = String(value)
      .replace(/\s+/g, '')
      .replace(/,/g, '.')
      .replace(/[^0-9.\-]/g, '');
    if (!normalized || normalized === '-' || normalized === '.') return false;
    return Number.isFinite(Number(normalized));
  }).length;
  if (numericCount >= Math.max(1, Math.floor(meaningful.length * 0.6))) return 'number';
  return 'text';
};

const dedupe = <T,>(arr: T[]) => Array.from(new Set(arr));

export const LeadsAnalyticsPage: React.FC = () => {
  const { t } = useTranslation();
  const [leads, setLeads] = useState<Lead[]>([]);

  useEffect(() => {
    let alive = true;
    fetchLeads()
      .then((items) => {
        if (!alive) return;
        setLeads(items);
      })
      .catch(() => {
        if (!alive) return;
        setLeads([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const leadsForAnalytics = useMemo(
    () => leads.filter((l) => !isLeadOmittedFromAnalytics(l)),
    [leads],
  );

  const analyticsFields = useMemo<AnalyticsFieldMeta[]>(() => {
    const base: AnalyticsFieldMeta[] = [
      { key: 'status', label: 'Status', type: 'status' },
      { key: 'channel', label: 'Source', type: 'text' },
      { key: 'country', label: 'Country', type: 'text' },
      { key: 'assignedTo', label: 'Manager', type: 'text' },
      { key: 'name', label: 'Lead name', type: 'text' },
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'email', label: 'Email', type: 'text' },
    ];

    const customKeys = dedupe(
      leadsForAnalytics.flatMap((lead) => Object.keys((lead.customFields || {}) as Record<string, any>)),
    );

    const custom: AnalyticsFieldMeta[] = customKeys.map((key) => {
      const values = leadsForAnalytics.map((lead) => (lead.customFields as Record<string, any> | null)?.[key]);
      return {
        key,
        label: key,
        type: guessFieldType(values),
      };
    });

    return [...base, ...custom];
  }, [leadsForAnalytics]);

  const mappedItems = useMemo<Project[]>(() => {
    const detectAmount = (lead: Lead) => {
      const fields = (lead.customFields || {}) as Record<string, any>;
      const amountLikeKey = Object.keys(fields).find((key) => {
        const lower = key.toLowerCase();
        return (
          lower.includes('amount') ||
          lower.includes('price') ||
          lower.includes('sum') ||
          lower.includes('value') ||
          lower.includes('total') ||
          lower.includes('tutar') ||
          lower.includes('miktar') ||
          lower.includes('cost') ||
          lower.includes('budget')
        );
      });
      const raw = amountLikeKey ? fields[amountLikeKey] : null;
      if (typeof raw === 'number') return raw;
      if (raw === undefined || raw === null || raw === '') return 0;
      const normalized = String(raw)
        .replace(/\s+/g, '')
        .replace(/,/g, '.')
        .replace(/[^0-9.\-]/g, '');
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const detectCurrency = (lead: Lead) => {
      const fields = (lead.customFields || {}) as Record<string, any>;
      const key = Object.keys(fields).find((fieldKey) =>
        fieldKey.toLowerCase().includes('currency'),
      );
      if (key) return String(fields[key] || 'EUR');
      return 'EUR';
    };

    return leadsForAnalytics.map((lead) => ({
      id: lead.id,
      name: lead.name || lead.phone || lead.email || `Lead ${lead.id.slice(0, 6)}`,
      description: '',
      amount: detectAmount(lead),
      currency: detectCurrency(lead),
      status: (lead.status || 'new') as any,
      category: lead.country || null,
      tags: lead.channel ? [lead.channel] : [],
      owner: lead.assignedTo || null,
      leadId: lead.id,
      leadName: lead.name || null,
      leadEmail: lead.email || null,
      ownerUserIds: lead.assignedUserIds || [],
      customFields: {
        ...(lead.customFields || {}),
        status: lead.status,
        channel: lead.channel,
        country: lead.country,
        assignedTo: lead.assignedTo,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
      },
      tasks: [],
      comments: [],
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
    }));
  }, [leadsForAnalytics]);

  const header = useMemo(
    () => ({
      kicker: t('crm.leads.analytics.hero.kicker'),
      title: t('crm.leads.analytics.hero.title'),
      subtitle: t('crm.leads.analytics.hero.subtitle'),
    }),
    [t],
  );

  return (
    <ProjectsAnalyticsPage
      externalItems={mappedItems}
      analyticsFields={analyticsFields}
      storageNamespace="leads_analytics"
      dashboardPresetSource="leads"
      header={header}
    />
  );
};

