import { api } from './client';

export interface ClientAccount {
  id: string;
  clientId: string;
  clientName: string;
  balance: number;
  currency: string;
  status: string;
  lastTransactionDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientAccountTransaction {
  id: string;
  accountId: string;
  type: 'debit' | 'credit';
  amount: number;
  description: string | null;
  createdAt: string;
}

export async function fetchClientAccounts(): Promise<ClientAccount[]> {
  const res = await api.get<ClientAccount[] | { items?: ClientAccount[] }>('/client-accounts');
  const data = Array.isArray(res.data) ? res.data : res.data?.items || [];
  return data;
}

export async function fetchClientAccount(id: string): Promise<ClientAccount> {
  const res = await api.get<ClientAccount>(`/client-accounts/${id}`);
  return res.data;
}

export async function fetchClientAccountTransactions(accountId: string): Promise<ClientAccountTransaction[]> {
  const res = await api.get<ClientAccountTransaction[]>(`/client-accounts/${accountId}/transactions`);
  return res.data;
}




