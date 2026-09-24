import type { TFunction } from 'i18next';
import { ccpApi, type CcpClientAnalytics, type CcpTxn } from '../api/ccp';
import type { Project, ProjectStatus } from '../pages/projects/projectTypes';

function s(value: any) {
  return String(value ?? '').trim();
}

function money(value: any) {
  const n = Number(s(value).replace(/\s+/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function statusFrom(value: any): ProjectStatus {
  const key = s(value).toLowerCase();
  if (key.includes('done') || key.includes('completed') || key.includes('success') || key.includes('выполн')) {
    return 'Закрыт';
  }
  if (key.includes('fail') || key.includes('cancel') || key.includes('reject') || key.includes('ошиб')) {
    return 'Проиграно';
  }
  if (key.includes('pending') || key.includes('progress') || key.includes('ожида')) return 'В работе';
  return 'Новый';
}

function classifyTxn(txn: CcpTxn, t: TFunction) {
  const tx = (key: string) => t(`crm.clientAccounts.analytics.txn.${key}`);
  const category = s((txn as any).meta?.financialCategory);
  if (category === 'deposit') return tx('deposit');
  if (category === 'account_fee') return tx('writeOff');
  if (category === 'manual_adjustment') return tx('adjustment');
  if (category === 'transfer') return tx('transfer');
  if (category === 'profit_accrual') return tx('profitAccrual');
  if (category === 'withdrawal' || category === 'bank_transfer') return tx('withdrawal');
  if (category === 'investment') return tx('investment');
  if (category === 'credit_leverage') return tx('credit');
  if (category === 'credit_repayment') return tx('creditRepayment');
  const haystack = `${txn.title || ''} ${txn.desc || ''} ${txn.ccpStatus || ''} ${txn.status || ''}`.toLowerCase();
  if (/profit|прибыл|доход|yield/.test(haystack)) return tx('profit');
  if (/invest|инвест|deposit|вклад/.test(haystack)) return tx('investment');
  if (/fee|commission|списан|комисс|обслуж/.test(haystack)) return tx('writeOff');
  if (/credit|кредит|плеч/.test(haystack)) return tx('credit');
  return tx('expense');
}

function dateOf(value: any) {
  const raw = s(value);
  return raw || new Date().toISOString();
}

/** Приводит транзакции клиентского аккаунта (CCP) к Project[] — общая логика для
 * ClientAccountAnalyticsPage и блоков, переданных с неё на главную. */
export function mapCcpDataToItems(data: CcpClientAnalytics, t: TFunction): Project[] {
  const client = data.client;
  return data.txns.map((txn) => {
    const eur = money(txn.spendEur);
    const usd = money(txn.spendUsd);
    const amount = Math.abs(eur || usd);
    const currency = eur ? 'EUR' : usd ? 'USD' : 'EUR';
    const category = classifyTxn(txn, t);
    return {
      id: `txn-${txn.id}`,
      name: txn.title || t('crm.clientAccounts.analytics.txn.operationFallback', { id: txn.wpPostId }),
      description: txn.desc || '',
      amount,
      currency,
      status: statusFrom(txn.ccpStatus || txn.status),
      category,
      tags: [t('crm.clientAccounts.analytics.txn.tag'), category],
      owner: client?.email || null,
      leadId: null,
      leadName: null,
      leadEmail: client?.email || null,
      ownerUserIds: [],
      customFields: {
        source: 'txn',
        financialCategory: (txn as any).meta?.financialCategory || '',
        accountId: (txn as any).meta?.accountId || '',
        assetId: (txn as any).meta?.assetId || '',
        amountEur: eur,
        amountUsd: usd,
        wpPostId: txn.wpPostId,
        ccpStatus: txn.ccpStatus || txn.status || '',
      },
      tasks: [],
      comments: [],
      createdAt: dateOf(txn.date || txn.createdAt),
      updatedAt: txn.updatedAt,
    } as Project;
  });
}

/** Загружает аналитику клиента CCP и приводит транзакции к Project[]. */
export async function loadClientAccountAnalyticsItems(clientId: string, t: TFunction): Promise<Project[]> {
  const data = await ccpApi.clientAnalytics(clientId, { fresh: 0 });
  return mapCcpDataToItems(data, t);
}
