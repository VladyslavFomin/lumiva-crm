import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { ccpApi, type CcpClientAnalytics, type CcpTxn } from '../../api/ccp';
import { MainLayout } from '../../layout/MainLayout';
import { ProjectsAnalyticsPage } from '../projects/ProjectsAnalyticsPage';
import type { Project, ProjectStatus } from '../projects/projectTypes';

function s(value: any) {
  return String(value ?? '').trim();
}

function money(value: any) {
  const n = Number(s(value).replace(/\s+/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function fmtMoney(value: any) {
  const n = typeof value === 'number' ? value : money(value);
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPercent(value: number | null | undefined, t: TFunction) {
  return value == null ? t('crm.clientAccounts.analytics.noData') : `${fmtMoney(value)}%`;
}

function fmtNullableMoney(value: number | null | undefined, t: TFunction) {
  return value == null ? t('crm.clientAccounts.analytics.noData') : fmtMoney(value);
}

function displayAccountBalance(account: any) {
  const financial = account?.financial || {};
  const explicit =
    account?.displayBalance ??
    account?.totalBalance ??
    account?.totalEquity ??
    financial?.totalEquity ??
    financial?.displayBalance ??
    financial?.totalBalance;
  if (explicit !== undefined && explicit !== null && String(explicit) !== '') return money(explicit);

  const operational = account?.balanceOperational ?? financial?.balanceOperational;
  const profitBalance = account?.profitBalance ?? financial?.profitBalance;
  const creditBalance = account?.creditBalance ?? financial?.creditBalance;
  if ([operational, profitBalance, creditBalance].some((value) => value !== undefined && value !== null && String(value) !== '')) {
    return money(operational) + money(profitBalance) + money(creditBalance);
  }

  return money(account?.balance ?? financial?.balance) +
    money(account?.profit ?? financial?.availableProfit) +
    money(account?.credit ?? financial?.creditLeverage ?? financial?.creditLeverageTotal);
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

const KpiCard: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: 'sky' | 'emerald' | 'amber' | 'rose' | 'slate';
}> = ({ label, value, hint, tone = 'slate' }) => {
  const tones = {
    sky: 'border-sky-200 bg-sky-50 text-sky-950',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    amber: 'border-amber-200 bg-amber-50 text-amber-950',
    rose: 'border-rose-200 bg-rose-50 text-rose-950',
    slate: 'border-neutral-200 bg-white text-[#222]',
  }[tone];

  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${tones}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {hint ? <div className="mt-2 text-xs text-neutral-600">{hint}</div> : null}
    </div>
  );
};

const ClientAccountAnalyticsPage: React.FC = () => {
  const { t } = useTranslation();
  const ca = (key: string, opts?: Record<string, unknown>) => t(`crm.clientAccounts.analytics.${key}`, opts as any) as string;
  const { clientId = '' } = useParams();
  const [data, setData] = useState<CcpClientAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = async (fresh: 0 | 1) => {
    if (!clientId) return;
    if (fresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const res = await ccpApi.clientAnalytics(clientId, { fresh });
      setData(res);
    } catch (err: any) {
      setError(err?.message || ca('loadError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const client = data?.client;
  const investments = Array.isArray(client?.meta?.investments) ? client.meta.investments : [];
  const accounts = Array.isArray(client?.meta?.accounts) ? client.meta.accounts : [];
  const financialSummary = Array.isArray(client?.meta?.financialSummary) ? client.meta.financialSummary : [];

  const currencyTotals = useMemo(() => {
    const empty = () => ({ USD: 0, EUR: 0 });
    const pickSummary = (...keys: string[]) => {
      const out = empty();
      financialSummary.forEach((row: any) => {
        const currency = String(row?.currency || '').toUpperCase();
        if (currency !== 'USD' && currency !== 'EUR') return;
        const key = keys.find((candidate) => row?.[candidate] !== undefined && row?.[candidate] !== null && String(row[candidate]) !== '');
        if (key) out[currency] += money(row[key]);
      });
      return out;
    };
    const addInvestments = (target: { USD: number; EUR: number }, key: 'invested' | 'expectedProfit') => {
      investments.forEach((investment: any) => {
        const currency = String(investment?.currency || '').toUpperCase();
        if (currency === 'USD' || currency === 'EUR') target[currency] += money(investment?.[key]);
      });
      return target;
    };
    const operationExpenses = empty();
    data?.txns.forEach((txn: any) => {
      const category = String(txn?.meta?.financialCategory || '').toLowerCase();
      if (!['account_fee', 'withdrawal', 'bank_transfer', 'transfer'].includes(category)) return;
      operationExpenses.EUR += Math.abs(money(txn.spendEur));
      operationExpenses.USD += Math.abs(money(txn.spendUsd));
    });

    const invested = pickSummary('invested', 'investmentTotal');
    if (!invested.USD && !invested.EUR) addInvestments(invested, 'invested');
    const expected = pickSummary('expectedProfit');
    if (!expected.USD && !expected.EUR) addInvestments(expected, 'expectedProfit');

    return {
      invested,
      expected,
      profit: pickSummary('profitAccrued', 'profitAccrualTotal'),
      accountFee: pickSummary('accountFee', 'accountWriteOff'),
      credit: pickSummary('creditLeverage', 'creditLeverageTotal'),
      expenses: operationExpenses,
    };
  }, [data?.txns, financialSummary, investments]);

  const dualMoney = (totals: { USD: number; EUR: number }) => ({
    value: `${fmtMoney(totals.USD)} USD`,
    hint: `${fmtMoney(totals.EUR)} EUR`,
  });

  const items = useMemo<Project[]>(() => {
    if (!data) return [];
    const txns = data.txns.map((txn) => {
      const eur = money(txn.spendEur);
      const usd = money(txn.spendUsd);
      const amount = Math.abs(eur || usd);
      const currency = eur ? 'EUR' : usd ? 'USD' : 'EUR';
      const category = classifyTxn(txn, t);
      return {
        id: `txn-${txn.id}`,
        name: txn.title || ca('txn.operationFallback', { id: txn.wpPostId }),
        description: txn.desc || '',
        amount,
        currency,
        status: statusFrom(txn.ccpStatus || txn.status),
        category,
        tags: [ca('txn.tag'), category],
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
      };
    });

    return txns;
  }, [client?.email, data, t]);

  const toolbar = data ? (
    <div className="space-y-4 rounded-[28px] border border-neutral-200 bg-white p-5 text-[#222] shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/app/client-accounts/${clientId}`}
            className="rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
          >
            {ca('clientCardLink')}
          </Link>
          <Link
            to="/app/client-accounts"
            className="rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
          >
            {ca('allClientsLink')}
          </Link>
        </div>
        <button
          type="button"
          onClick={() => load(1)}
          disabled={refreshing}
          className="rounded-2xl bg-sky-500 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-400 disabled:opacity-50"
        >
          {refreshing ? ca('syncingBtn') : ca('refreshFullBtn')}
        </button>
      </div>

      {data.sync.errors.length ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          {ca('syncErrorBanner', { errors: data.sync.errors.join('; ') })}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={ca('kpis.accountsBalance')}
          value={`${fmtMoney(data.metrics.balances.eur)} EUR`}
          hint={`${fmtMoney(data.metrics.balances.usd)} USD`}
          tone="sky"
        />
        <KpiCard
          label={ca('kpis.invested')}
          value={dualMoney(currencyTotals.invested).value}
          hint={ca('kpis.investedHintFormat', { eur: dualMoney(currencyTotals.invested).hint, style: data.metrics.investments.style || ca('kpis.noStyleData'), pct: fmtPercent(data.metrics.investments.annualPercent, t) })}
          tone="emerald"
        />
        <KpiCard
          label={ca('kpis.expectedProfit')}
          value={dualMoney(currencyTotals.expected).value}
          hint={ca('kpis.expectedProfitHintFormat', { eur: dualMoney(currencyTotals.expected).hint })}
          tone="amber"
        />
        <KpiCard
          label={ca('kpis.expensesAndTransfers')}
          value={dualMoney(currencyTotals.expenses).value}
          hint={ca('kpis.expensesHintFormat', { eur: dualMoney(currencyTotals.expenses).hint, count: data.metrics.counts.txns })}
          tone="slate"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <KpiCard
          label={ca('kpis.profitAccrual')}
          value={dualMoney(currencyTotals.profit).value}
          hint={ca('kpis.profitAccrualHintFormat', { eur: dualMoney(currencyTotals.profit).hint, pct: fmtPercent(data.metrics.investments.profitMonthlyPercent, t) })}
          tone="emerald"
        />
        <KpiCard
          label={ca('kpis.accountFeeWriteoff')}
          value={dualMoney(currencyTotals.accountFee).value}
          hint={ca('kpis.accountFeeHintFormat', { eur: dualMoney(currencyTotals.accountFee).hint, pct: fmtPercent(data.metrics.accountCosts.monthlyPercent, t) })}
          tone="rose"
        />
        <KpiCard
          label={ca('kpis.creditLeverage')}
          value={dualMoney(currencyTotals.credit).value}
          hint={ca('kpis.creditLeverageHintFormat', { eur: dualMoney(currencyTotals.credit).hint, repay: fmtNullableMoney(data.metrics.credit.expectedMonthlyRepay, t) })}
          tone="amber"
        />
      </div>

      {accounts.length ? (
        <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">{ca('accountsSection.title')}</div>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {accounts.map((account: any, index) => {
              const financial = account.financial || {};
              return (
                <div key={account.externalAccountId || account.id || index} className="rounded-2xl border border-neutral-200 bg-white p-4">
                  <div className="text-sm font-semibold text-[#222]">{account.number || ca('accountsSection.accountFallback', { n: index + 1 })}</div>
                  <div className="mt-1 text-xs text-neutral-500">{account.currency || financial.currency || '—'}</div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-neutral-500">{ca('accountsSection.crmBalance')}</span> {fmtMoney(displayAccountBalance(account))}</div>
                    <div><span className="text-neutral-500">{ca('accountsSection.operBalance')}</span> {fmtMoney(financial.balanceOperational ?? account.balanceOperational ?? financial.balance ?? account.balance)}</div>
                    <div><span className="text-neutral-500">{ca('accountsSection.accrued')}</span> {fmtMoney(financial.profitBalance ?? account.profitBalance ?? financial.availableProfit ?? account.profit)}</div>
                    <div><span className="text-neutral-500">{ca('accountsSection.credit')}</span> {fmtMoney(financial.creditBalance ?? account.creditBalance ?? financial.creditLeverage ?? account.credit)}</div>
                    <div><span className="text-neutral-500">{ca('accountsSection.invested')}</span> {fmtMoney(financial.invested ?? financial.investmentTotal)}</div>
                    <div><span className="text-neutral-500">{ca('accountsSection.profit')}</span> {fmtMoney(financial.profitAccrued ?? financial.profitAccrualTotal)}</div>
                    <div><span className="text-neutral-500">{ca('accountsSection.expected')}</span> {fmtMoney(financial.expectedProfit)}</div>
                    <div><span className="text-neutral-500">{ca('accountsSection.fee')}</span> {fmtMoney(financial.accountFee ?? financial.accountWriteOff)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {investments.length ? (
        <div className="rounded-3xl border border-neutral-200 bg-white p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">{ca('investmentsSection.title')}</div>
          <div className="mt-3 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                <tr>
                  <th className="py-2 pr-4">{ca('investmentsSection.colAsset')}</th>
                  <th className="py-2 pr-4">{ca('investmentsSection.colCategory')}</th>
                  <th className="py-2 pr-4">{ca('investmentsSection.colYield')}</th>
                  <th className="py-2 pr-4">{ca('investmentsSection.colInvested')}</th>
                  <th className="py-2 pr-4">{ca('investmentsSection.colExpectedProfit')}</th>
                </tr>
              </thead>
              <tbody>
                {investments.map((investment: any, index) => (
                  <tr key={investment.transactionId || `${investment.assetId}-${index}`} className="border-t border-neutral-100">
                    <td className="py-2 pr-4 font-medium text-[#222]">
                      {investment.assetName || '—'}
                      {investment.assetExcerpt ? <div className="mt-1 text-[11px] font-normal text-neutral-500">{investment.assetExcerpt}</div> : null}
                    </td>
                    <td className="py-2 pr-4 text-neutral-700">{investment.assetCategory || '—'}</td>
                    <td className="py-2 pr-4 text-neutral-700">{investment.assetCalculation || fmtPercent(money(investment.assetProfitRate), t)}</td>
                    <td className="py-2 pr-4 text-neutral-700">{fmtMoney(investment.invested)} {investment.currency || ''}</td>
                    <td className="py-2 pr-4 text-neutral-700">{fmtMoney(investment.expectedProfit)} {investment.currency || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  ) : null;

  if (loading) {
    return (
      <MainLayout>
        <div className="rounded-3xl border border-neutral-200 bg-white p-6 text-sm text-neutral-700">
          {ca('loadingText')}
        </div>
      </MainLayout>
    );
  }

  if (error || !data) {
    return (
      <MainLayout>
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-900">
          {error || ca('noAnalyticsData')}
        </div>
      </MainLayout>
    );
  }

  const title = client?.name || client?.email || ca('clientFallback', { id: client?.wpUserId || clientId });

  return (
    <ProjectsAnalyticsPage
      externalItems={items}
      storageNamespace={`client_account_operations_analytics_v3_${clientId}`}
      analyticsFields={[
        { key: 'source', label: ca('fields.source'), type: 'select' },
        { key: 'financialCategory', label: ca('fields.financialCategory'), type: 'select' },
        { key: 'amountUsd', label: ca('fields.amountUsd'), type: 'number' },
        { key: 'amountEur', label: ca('fields.amountEur'), type: 'number' },
        { key: 'ccpStatus', label: ca('fields.ccpStatus'), type: 'text' },
      ]}
      header={{
        kicker: ca('header.kicker'),
        title: ca('header.titleFormat', { name: title }),
        subtitle: ca('header.subtitle'),
      }}
      analyticsLabels={{
        total: ca('labels.total'),
        line: ca('labels.line'),
        table: ca('labels.table'),
        record: ca('labels.record'),
      }}
      defaultWidgetsOverride={[
        {
          id: 'metric-total-operations',
          type: 'metric',
          title: ca('widgets.totalOperations'),
          metricKey: 'total',
          size: 'sm',
          span: 3,
          height: 160,
        },
        {
          id: 'metric-total-usd',
          type: 'metric',
          title: ca('widgets.totalUsd'),
          metricKey: 'sum:amountUsd',
          size: 'sm',
          span: 3,
          height: 160,
        },
        {
          id: 'metric-total-eur',
          type: 'metric',
          title: ca('widgets.totalEur'),
          metricKey: 'sum:amountEur',
          size: 'sm',
          span: 3,
          height: 160,
        },
        {
          id: 'metric-categories',
          type: 'metric',
          title: ca('widgets.categoriesCount'),
          metricKey: 'filled:financialCategory',
          size: 'sm',
          span: 3,
          height: 160,
        },
        {
          id: 'chart-operations-line',
          type: 'line',
          title: ca('widgets.operationsLine'),
          chartKey: 'field:financialCategory',
          chartValueMode: 'count',
          size: 'md',
          span: 8,
          height: 360,
        },
        {
          id: 'chart-operations-donut',
          type: 'donut',
          title: ca('widgets.operationsTypes'),
          chartKey: 'field:financialCategory',
          size: 'md',
          span: 4,
          height: 320,
          showLabels: true,
        },
        {
          id: 'chart-operations-bar',
          type: 'bar',
          title: ca('widgets.operationsByTypeBar'),
          chartKey: 'field:financialCategory',
          chartValueMode: 'count',
          size: 'md',
          span: 6,
          height: 320,
        },
        {
          id: 'table-operations',
          type: 'table',
          title: ca('widgets.operationsTable'),
          tableKey: 'projects',
          size: 'md',
          span: 6,
          height: 320,
        },
      ]}
      toolbarSlot={toolbar}
    />
  );
};

export default ClientAccountAnalyticsPage;
