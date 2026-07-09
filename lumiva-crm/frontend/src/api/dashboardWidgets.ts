// src/api/dashboardWidgets.ts
import { api } from './client';

export interface FunnelStatusItem {
  status: string;
  count: number;
}

export interface LeadSourceItem {
  source: string;
  count: number;
}

export interface RecentSaleItem {
  id: string;
  name: string | null;
  amount: number | null;
  currency: string | null;
  status: string;
  createdAt: string;
}

export interface BirthdayContactItem {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  birthday: string | null;
}

export function getFunnelToday(): Promise<{ statuses: FunnelStatusItem[] }> {
  return api.get<{ statuses: FunnelStatusItem[] }>('/leads/funnel-today');
}

export function getLeadSourcesWeekly(): Promise<{ sources: LeadSourceItem[] }> {
  return api.get<{ sources: LeadSourceItem[] }>('/leads/sources-weekly');
}

export function getRecentSales(limit = 7): Promise<{ sales: RecentSaleItem[] }> {
  return api.get<{ sales: RecentSaleItem[] }>('/sales/recent', { params: { limit } });
}

export function getBirthdayContacts(): Promise<{ contacts: BirthdayContactItem[] }> {
  return api.get<{ contacts: BirthdayContactItem[] }>('/contacts/birthdays');
}
